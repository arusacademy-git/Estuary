import { ActorType, PaymentMode, PaymentType, Prisma, StateGroup } from '@prisma/client';

import type { CreateInvoicePaymentRequestInput, InvoicePaymentRequestRecord, PaymentRequestDocument, PaymentRequestStatus } from '@/domain/payment-requests/invoice-payment/types';
import { prisma } from '@/lib/db/prisma';

const include = {
  invoice_detail: true,
  lines: { include: { project: true }, orderBy: { line_number: 'asc' as const } },
  transitions: { orderBy: { created_at: 'asc' as const } },
  approval_steps: { include: { decision: true }, orderBy: { step_number: 'asc' as const } },
} satisfies Prisma.SubmissionInclude;

type Stored = Prisma.SubmissionGetPayload<{ include: typeof include }>;
type Snapshot = CreateInvoicePaymentRequestInput;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function snapshot(record: Stored): Snapshot {
    const metadata = [...record.transitions].reverse().find((item) => item.action_code === 'CREATE' || item.action_code === 'RESUBMIT')?.metadata_json;
  if (!isObject(metadata) || !isObject(metadata.snapshot)) throw new Error('Invoice Payment details are incomplete.');
  return metadata.snapshot as unknown as Snapshot;
}

function map(record: Stored): InvoicePaymentRequestRecord {
  const data = snapshot(record);
  const transition = (code: string) => [...record.transitions].reverse().find((item) => item.action_code === code);
  const managerDecision = record.approval_steps.find((item) => item.required_role === 'MANAGER')?.decision;
  const directorDecision = record.approval_steps.find((item) => item.required_role === 'DIRECTOR')?.decision;
  const managerReturn = transition('RETURN_BY_MANAGER');
  const directorReturn = transition('RETURN_BY_DIRECTOR');
  const financeReturn = transition('RETURN_BY_FINANCE');
  const complete = transition('COMPLETE');
  const paymentProcessed = transition('PAYMENT_PROCESSED');
  const proofUpload = transition('UPLOAD_TRANSACTION_PROOF');
  const paymentMetadata = isObject(paymentProcessed?.metadata_json) ? paymentProcessed.metadata_json : undefined;
  const proofMetadata = isObject(proofUpload?.metadata_json) ? proofUpload.metadata_json : undefined;
  return {
    ...data,
    id: record.id,
    requestNumber: record.submission_number ?? `IV-DRAFT-${record.id.slice(-6)}`,
    requestType: 'INVOICE_PAYMENT',
    status: record.current_state_code as PaymentRequestStatus,
    totalAmount: Number(record.total_amount),
    managerReviewedAt: managerDecision?.decision_code === 'APPROVED' ? managerDecision.created_at.toISOString() : undefined,
    managerReviewedById: managerDecision?.decision_code === 'APPROVED' ? managerDecision.decided_by_user_id : undefined,
    managerReturnedAt: managerReturn?.created_at.toISOString(),
    managerReturnedById: managerReturn?.actor_user_id ?? undefined,
    managerReturnRemarks: managerReturn?.reason_text ?? undefined,
    directorReviewedAt: directorDecision?.decision_code === 'APPROVED' ? directorDecision.created_at.toISOString() : undefined,
    directorReviewedById: directorDecision?.decision_code === 'APPROVED' ? directorDecision.decided_by_user_id : undefined,
    directorReturnedAt: directorReturn?.created_at.toISOString(),
    directorReturnedById: directorReturn?.actor_user_id ?? undefined,
    directorReturnRemarks: directorReturn?.reason_text ?? undefined,
    financeVerifiedAt: complete?.created_at.toISOString(),
    financeVerifiedById: complete?.actor_user_id ?? undefined,
    financePaymentDate: typeof paymentMetadata?.paymentDate === 'string' ? paymentMetadata.paymentDate : typeof proofMetadata?.paymentDate === 'string' ? proofMetadata.paymentDate : undefined,
    financePaymentReference: typeof paymentMetadata?.paymentReference === 'string' ? paymentMetadata.paymentReference : typeof proofMetadata?.paymentReference === 'string' ? proofMetadata.paymentReference : undefined,
    financeTransactionProof: isObject(proofMetadata?.transactionProof) ? proofMetadata.transactionProof as unknown as PaymentRequestDocument : undefined,
    financeReturnedAt: financeReturn?.created_at.toISOString(),
    financeReturnedById: financeReturn?.actor_user_id ?? undefined,
    financeReturnRemarks: financeReturn?.reason_text ?? undefined,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}

async function nextNumber(tx: Prisma.TransactionClient, organizationId: string, now: Date) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const shortYear = String(year).slice(-2);
  const sequence = await tx.documentSequence.upsert({
    where: { organization_id_payment_type_year_month: { organization_id: organizationId, payment_type: PaymentType.INVOICE_PAYMENT, year, month } },
    create: { organization_id: organizationId, payment_type: PaymentType.INVOICE_PAYMENT, year, month, prefix: 'IV', last_sequence: 1 },
    update: { last_sequence: { increment: 1 } },
  });
  return `IV${shortYear}-${String(month).padStart(2, '0')}-${String(sequence.last_sequence).padStart(2, '0')}`;
}

export async function listInvoicePaymentsFromDatabase(scope?: { role: 'staff' | 'manager' | 'director' | 'finance'; userId: string; includeAll?: boolean }) {
  const mapped = (await prisma.submission.findMany({ where: { payment_type: PaymentType.INVOICE_PAYMENT }, include, orderBy: { updated_at: 'desc' } })).map(map);
  if (!scope) return mapped;
  if (scope.role === 'staff') return mapped.filter((item) => item.staffId === scope.userId);
  if (scope.role === 'manager') return mapped.filter((item) => item.managerApproverId === scope.userId);
  if (scope.role === 'director') return mapped.filter((item) => item.directorApproverId === scope.userId && item.status !== 'PENDING_MANAGER_REVIEW');
  if (scope.includeAll) return mapped;
  return mapped.filter((item) => ['PENDING_FINANCE_REVIEW', 'PAYMENT_PROCESSED', 'TRANSACTION_PROOF_UPLOADED', 'COMPLETED'].includes(item.status) || Boolean(item.financeReturnedAt));
}

export async function getInvoicePaymentFromDatabase(id: string) {
  const record = await prisma.submission.findFirst({ where: { payment_type: PaymentType.INVOICE_PAYMENT, OR: [{ id }, { submission_number: id }] }, include });
  return record ? map(record) : null;
}

export async function createInvoicePaymentInDatabase(input: CreateInvoicePaymentRequestInput) {
  if (input.requestedAmount <= 0 || input.requestedAmount > input.invoiceTotal) throw new Error('Enter a valid requested amount.');
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const [organization, staff, manager, director, project] = await Promise.all([
      tx.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } }),
      tx.user.findUnique({ where: { id: input.staffId }, select: { id: true } }),
      tx.user.findUnique({ where: { id: input.managerApproverId }, select: { id: true } }),
      tx.user.findUnique({ where: { id: input.directorApproverId }, select: { id: true } }),
      tx.project.findFirst({ where: { organization_id: input.organizationId, code: input.projectName }, select: { id: true } }),
    ]);
    if (!organization || !staff || !manager || !director) throw new Error('Organization, requester, Manager or Director was not found in PostgreSQL.');
    const requestNumber = await nextNumber(tx, input.organizationId, new Date(`${input.requestDate}T12:00:00Z`));
    const record = await tx.submission.create({
      data: {
        organization_id: input.organizationId, payment_type: PaymentType.INVOICE_PAYMENT,
        current_state_code: 'PENDING_MANAGER_REVIEW', current_state_group: StateGroup.IN_REVIEW,
        current_assignee_id: input.managerApproverId, submission_number: requestNumber,
        submitted_by_id: input.staffId, submitted_at: now,
        total_amount: new Prisma.Decimal(input.requestedAmount.toFixed(2)), currency: 'MYR', description: input.purpose,
        invoice_detail: { create: { vendor_name: input.vendorName, payment_mode: input.transferType === 'GIRO' ? PaymentMode.IBG : PaymentMode.DUITNOW } },
        lines: { create: { line_number: 1, description: input.title, amount: new Prisma.Decimal(input.requestedAmount.toFixed(2)), project_id: project?.id } },
        approval_steps: { create: [
          { step_number: 1, required_role: 'MANAGER', assigned_user_id: input.managerApproverId, status_code: 'ACTIVE' },
          { step_number: 2, required_role: 'DIRECTOR', assigned_user_id: input.directorApproverId, status_code: 'PENDING' },
        ] },
        transitions: { create: { from_state_code: 'NONE', action_code: 'CREATE', to_state_code: 'PENDING_MANAGER_REVIEW', actor_type: ActorType.INTERNAL_USER, actor_user_id: input.staffId, metadata_json: { snapshot: input } as Prisma.InputJsonValue } },
      }, include,
    });
    await tx.auditEvent.create({ data: { organization_id: input.organizationId, submission_id: record.id, event_type: 'invoice_payment.submitted', actor_type: ActorType.INTERNAL_USER, actor_user_id: input.staffId, payload_json: { requestNumber, totalAmount: input.requestedAmount.toFixed(2) } } });
    return map(record);
  }, { timeout: 15_000 });
}

export async function resubmitInvoicePaymentInDatabase(id: string, input: CreateInvoicePaymentRequestInput) {
    if (input.requestedAmount <= 0 || input.requestedAmount > input.invoiceTotal) throw new Error('Enter a valid requested amount.');
    return prisma.$transaction(async (tx) => {
        const current = await tx.submission.findFirst({ where: { id, payment_type: PaymentType.INVOICE_PAYMENT }, include: { approval_steps: true } });
        if (!current) throw new Error('Invoice Payment could not be found.');
        if (current.current_state_code !== 'RETURNED_TO_STAFF') throw new Error('Only an Invoice Payment returned for correction can be edited.');
        if (current.submitted_by_id !== input.staffId) throw new Error('Only the original requester can edit this Invoice Payment.');

        const [manager, director, project] = await Promise.all([
            tx.user.findUnique({ where: { id: input.managerApproverId }, select: { id: true } }),
            tx.user.findUnique({ where: { id: input.directorApproverId }, select: { id: true } }),
            tx.project.findFirst({ where: { organization_id: current.organization_id, code: input.projectName }, select: { id: true } }),
        ]);
        if (!manager || !director) throw new Error('The selected Manager or Director was not found in PostgreSQL.');

        const stepIds = current.approval_steps.map((step) => step.id);
        await tx.approvalDecision.deleteMany({ where: { approval_step_id: { in: stepIds } } });
        const managerStep = current.approval_steps.find((step) => step.required_role === 'MANAGER');
        const directorStep = current.approval_steps.find((step) => step.required_role === 'DIRECTOR');
        if (!managerStep || !directorStep) throw new Error('Invoice Payment approval steps are incomplete.');
        await tx.approvalStep.update({ where: { id: managerStep.id }, data: { assigned_user_id: input.managerApproverId, status_code: 'ACTIVE' } });
        await tx.approvalStep.update({ where: { id: directorStep.id }, data: { assigned_user_id: input.directorApproverId, status_code: 'PENDING' } });

        await tx.invoicePaymentDetail.update({ where: { submission_id: id }, data: { vendor_name: input.vendorName, payment_mode: input.transferType === 'GIRO' ? PaymentMode.IBG : PaymentMode.DUITNOW, paid_at: null, paid_reference: null } });
        await tx.submissionLine.deleteMany({ where: { submission_id: id } });
        await tx.submissionLine.create({ data: { submission_id: id, line_number: 1, description: input.title, amount: new Prisma.Decimal(input.requestedAmount.toFixed(2)), project_id: project?.id } });
        await tx.submissionTransition.create({ data: { submission_id: id, from_state_code: 'RETURNED_TO_STAFF', action_code: 'RESUBMIT', to_state_code: 'PENDING_MANAGER_REVIEW', actor_type: ActorType.INTERNAL_USER, actor_user_id: input.staffId, metadata_json: { snapshot: input } as Prisma.InputJsonValue } });
        await tx.submission.update({ where: { id }, data: { current_state_code: 'PENDING_MANAGER_REVIEW', current_state_group: StateGroup.IN_REVIEW, current_assignee_id: input.managerApproverId, total_amount: new Prisma.Decimal(input.requestedAmount.toFixed(2)), description: input.purpose, submitted_at: new Date(), closed_at: null } });
        await tx.auditEvent.create({ data: { organization_id: current.organization_id, submission_id: id, event_type: 'invoice_payment.resubmitted', actor_type: ActorType.INTERNAL_USER, actor_user_id: input.staffId, payload_json: { requestNumber: current.submission_number, totalAmount: input.requestedAmount.toFixed(2) } } });
        return map(await tx.submission.findUniqueOrThrow({ where: { id }, include }));
    }, { timeout: 15_000 });
}

async function approvalAction(id: string, actorId: string, role: 'MANAGER' | 'DIRECTOR', approved: boolean, reason?: string) {
  const from = role === 'MANAGER' ? 'PENDING_MANAGER_REVIEW' : 'PENDING_DIRECTOR_REVIEW';
  const to = approved ? (role === 'MANAGER' ? 'PENDING_DIRECTOR_REVIEW' : 'PENDING_FINANCE_REVIEW') : 'RETURNED_TO_STAFF';
  const actionCode = approved ? (role === 'MANAGER' ? 'REVIEW_BY_MANAGER' : 'REVIEW_BY_DIRECTOR') : (role === 'MANAGER' ? 'RETURN_BY_MANAGER' : 'RETURN_BY_DIRECTOR');
  const cleanReason = reason?.trim();
  if (!approved && (!cleanReason || cleanReason.length < 5)) throw new Error('Enter a clear reason for returning the request.');
  return prisma.$transaction(async (tx) => {
    const current = await tx.submission.findFirst({ where: { id, payment_type: PaymentType.INVOICE_PAYMENT }, include: { approval_steps: true } });
    if (!current) throw new Error('Invoice Payment could not be found.');
    if (current.current_state_code !== from) throw new Error(`This Invoice Payment is no longer awaiting ${role === 'MANAGER' ? 'Manager' : 'Director'} review.`);
    if (current.current_assignee_id !== actorId) throw new Error('This Invoice Payment is assigned to another reviewer.');
    const step = current.approval_steps.find((item) => item.required_role === role);
    if (!step) throw new Error(`${role} approval step is missing.`);
    await tx.approvalDecision.create({ data: { approval_step_id: step.id, decision_code: approved ? 'APPROVED' : 'REJECTED', decided_by_user_id: actorId, reason_text: cleanReason } });
    await tx.approvalStep.update({ where: { id: step.id }, data: { status_code: 'COMPLETE' } });
    let nextAssignee: string | null = current.submitted_by_id;
    if (approved && role === 'MANAGER') {
      const director = current.approval_steps.find((item) => item.required_role === 'DIRECTOR');
      if (!director?.assigned_user_id) throw new Error('Assigned Director is missing.');
      await tx.approvalStep.update({ where: { id: director.id }, data: { status_code: 'ACTIVE' } });
      nextAssignee = director.assigned_user_id;
    } else if (approved) nextAssignee = null;
    await tx.submissionTransition.create({ data: { submission_id: id, from_state_code: from, action_code: actionCode, to_state_code: to, actor_type: ActorType.INTERNAL_USER, actor_user_id: actorId, reason_text: cleanReason } });
    await tx.submission.update({ where: { id }, data: { current_state_code: to, current_state_group: approved ? (role === 'DIRECTOR' ? StateGroup.PENDING_VERIFICATION : StateGroup.IN_REVIEW) : StateGroup.REJECTED, current_assignee_id: nextAssignee } });
    await tx.auditEvent.create({ data: { organization_id: current.organization_id, submission_id: id, event_type: `invoice_payment.${actionCode.toLowerCase()}`, actor_type: ActorType.INTERNAL_USER, actor_user_id: actorId, payload_json: cleanReason ? { reason: cleanReason } : undefined } });
    return map(await tx.submission.findUniqueOrThrow({ where: { id }, include }));
  }, { timeout: 15_000 });
}

export const reviewInvoicePaymentByManagerInDatabase = (id: string, actorId: string) => approvalAction(id, actorId, 'MANAGER', true);
export const returnInvoicePaymentByManagerInDatabase = (id: string, actorId: string, reason: string) => approvalAction(id, actorId, 'MANAGER', false, reason);
export const reviewInvoicePaymentByDirectorInDatabase = (id: string, actorId: string) => approvalAction(id, actorId, 'DIRECTOR', true);
export const returnInvoicePaymentByDirectorInDatabase = (id: string, actorId: string, reason: string) => approvalAction(id, actorId, 'DIRECTOR', false, reason);

export async function processInvoicePaymentByFinanceInDatabase(id: string, financeId: string, paymentDate: string, paymentReference: string) {
  if (!paymentDate || !paymentReference.trim()) throw new Error('Payment date and reference are required.');
  return prisma.$transaction(async (tx) => {
    const current = await tx.submission.findFirst({ where: { id, payment_type: PaymentType.INVOICE_PAYMENT } });
    if (!current) throw new Error('Invoice Payment could not be found.');
    if (current.current_state_code !== 'PENDING_FINANCE_REVIEW') throw new Error('This Invoice Payment is no longer awaiting Finance verification.');
    await tx.submissionTransition.create({ data: { submission_id: id, from_state_code: current.current_state_code, action_code: 'PAYMENT_PROCESSED', to_state_code: 'PAYMENT_PROCESSED', actor_type: ActorType.INTERNAL_USER, actor_user_id: financeId, metadata_json: { paymentDate, paymentReference: paymentReference.trim() } as Prisma.InputJsonValue } });
    await tx.submission.update({ where: { id }, data: { current_state_code: 'PAYMENT_PROCESSED', current_state_group: StateGroup.PENDING_VERIFICATION, current_assignee_id: financeId } });
    return map(await tx.submission.findUniqueOrThrow({ where: { id }, include }));
  }, { timeout: 15_000 });
}

export async function uploadInvoicePaymentProofByFinanceInDatabase(id: string, financeId: string, transactionProof: PaymentRequestDocument) {
  if (!transactionProof.dataUrl) throw new Error('A payment transaction proof is required.');
  return prisma.$transaction(async (tx) => {
    const current = await tx.submission.findFirst({ where: { id, payment_type: PaymentType.INVOICE_PAYMENT } });
    if (!current) throw new Error('Invoice Payment could not be found.');
    if (current.current_state_code !== 'PAYMENT_PROCESSED') throw new Error('Verify the payment information before uploading its transaction proof.');
    await tx.submissionTransition.create({ data: { submission_id: id, from_state_code: 'PAYMENT_PROCESSED', action_code: 'UPLOAD_TRANSACTION_PROOF', to_state_code: 'TRANSACTION_PROOF_UPLOADED', actor_type: ActorType.INTERNAL_USER, actor_user_id: financeId, metadata_json: { transactionProof } as unknown as Prisma.InputJsonValue } });
    await tx.submission.update({ where: { id }, data: { current_state_code: 'TRANSACTION_PROOF_UPLOADED', current_state_group: StateGroup.PENDING_VERIFICATION, current_assignee_id: financeId } });
    return map(await tx.submission.findUniqueOrThrow({ where: { id }, include }));
  }, { timeout: 15_000 });
}

export async function completeInvoicePaymentByFinanceInDatabase(id: string, financeId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.submission.findFirst({ where: { id, payment_type: PaymentType.INVOICE_PAYMENT } });
    if (!current) throw new Error('Invoice Payment could not be found.');
    if (current.current_state_code !== 'TRANSACTION_PROOF_UPLOADED') throw new Error('Upload the payment transaction proof before completing this Invoice Payment.');
    await tx.submissionTransition.create({ data: { submission_id: id, from_state_code: 'TRANSACTION_PROOF_UPLOADED', action_code: 'COMPLETE', to_state_code: 'COMPLETED', actor_type: ActorType.INTERNAL_USER, actor_user_id: financeId } });
    await tx.submission.update({ where: { id }, data: { current_state_code: 'COMPLETED', current_state_group: StateGroup.COMPLETE, current_assignee_id: null, closed_at: new Date() } });
    await tx.auditEvent.create({ data: { organization_id: current.organization_id, submission_id: id, event_type: 'invoice_payment.finance_completed', actor_type: ActorType.INTERNAL_USER, actor_user_id: financeId } });
    return map(await tx.submission.findUniqueOrThrow({ where: { id }, include }));
  }, { timeout: 15_000 });
}

async function financeAction(id: string, financeId: string, complete: boolean, reason?: string) {
  const cleanReason = reason?.trim();
  if (!complete && (!cleanReason || cleanReason.length < 5)) throw new Error('Enter a clear reason for returning the request.');
  return prisma.$transaction(async (tx) => {
    const current = await tx.submission.findFirst({ where: { id, payment_type: PaymentType.INVOICE_PAYMENT } });
    if (!current) throw new Error('Invoice Payment could not be found.');
    if (!['PENDING_FINANCE_REVIEW', 'PAYMENT_PROCESSED'].includes(current.current_state_code)) throw new Error('This Invoice Payment can no longer be returned by Finance.');
    const to = complete ? 'COMPLETED' : 'RETURNED_TO_STAFF';
    const actionCode = complete ? 'COMPLETE' : 'RETURN_BY_FINANCE';
    await tx.submissionTransition.create({ data: { submission_id: id, from_state_code: current.current_state_code, action_code: actionCode, to_state_code: to, actor_type: ActorType.INTERNAL_USER, actor_user_id: financeId, reason_text: cleanReason } });
    await tx.submission.update({ where: { id }, data: { current_state_code: to, current_state_group: complete ? StateGroup.COMPLETE : StateGroup.REJECTED, current_assignee_id: complete ? null : current.submitted_by_id, closed_at: complete ? new Date() : null } });
    await tx.auditEvent.create({ data: { organization_id: current.organization_id, submission_id: id, event_type: complete ? 'invoice_payment.finance_completed' : 'invoice_payment.returned_by_finance', actor_type: ActorType.INTERNAL_USER, actor_user_id: financeId, payload_json: cleanReason ? { reason: cleanReason } : undefined } });
    return map(await tx.submission.findUniqueOrThrow({ where: { id }, include }));
  }, { timeout: 15_000 });
}

export const returnInvoicePaymentByFinanceInDatabase = (id: string, financeId: string, reason: string) => financeAction(id, financeId, false, reason);

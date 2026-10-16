import {
  ActorType,
  PaymentType,
  Prisma,
  ReconOutcome,
  StateGroup,
} from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { paymentRequestReference } from '@/domain/payment-requests/finance-payment-reference';
import {
  CASH_ADVANCE_RECONCILIATION_DAYS,
  addCalendarDays,
  cashAdvanceBalance,
  cashAdvanceExpenseTotal,
  cashAdvanceInitialWorkflow,
  cashAdvanceOutcome,
  cashAdvanceVisibleStatus,
  validateCashAdvanceRequest,
} from '@/domain/payment-requests/cash-advance/policy';
import type {
  CashAdvanceReconciliation,
  CashAdvanceReconciliationInput,
  CashAdvanceRecord,
  CashAdvanceRole,
  CreateCashAdvanceInput,
} from '@/domain/payment-requests/cash-advance/types';

const include = {
  ca_detail: true,
  lines: {
    include: { project: true },
    orderBy: { line_number: 'asc' as const },
  },
  transitions: { orderBy: { created_at: 'asc' as const } },
  approval_steps: {
    include: { decision: true },
    orderBy: { step_number: 'asc' as const },
  },
  evidence: {
    include: { document: true },
    orderBy: { created_at: 'asc' as const },
  },
} satisfies Prisma.SubmissionInclude;

type StoredCashAdvance = Prisma.SubmissionGetPayload<{ include: typeof include }>;
type Snapshot = CreateCashAdvanceInput;

type ListScope = {
  role: CashAdvanceRole;
  userId: string;
  month?: string;
  includeAll?: boolean;
  approvalOnly?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function cashAdvanceAccountIds(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  lines: CreateCashAdvanceInput['lines'],
) {
  const accountCodes = [...new Set(lines.map((line) => line.accountType?.trim()).filter((code): code is string => Boolean(code)))];
  if (!accountCodes.length) return new Map<string, string>();
  const accounts = await transaction.glAccount.findMany({
    where: { organization_id: organizationId, code: { in: accountCodes } },
    select: { id: true, code: true },
  });
  return new Map(accounts.map((account) => [account.code, account.id]));
}

function latestTransition(record: StoredCashAdvance, action: string) {
  return [...record.transitions].reverse().find((item) => item.action_code === action);
}

function readSnapshot(record: StoredCashAdvance) {
  const transition = [...record.transitions].reverse().find((item) => {
    if (item.action_code !== 'CREATE' && item.action_code !== 'RESUBMIT') return false;
    const metadata = item.metadata_json;
    return isRecord(metadata) && isRecord(metadata.snapshot);
  });
  const metadata = transition?.metadata_json;
  if (!isRecord(metadata) || !isRecord(metadata.snapshot)) {
    throw new Error('Cash Advance request details are incomplete.');
  }
  return metadata.snapshot as unknown as Snapshot;
}

function readReconciliation(record: StoredCashAdvance): CashAdvanceReconciliation | undefined {
  const transition = latestTransition(record, 'SUBMIT_RECONCILIATION');
  const metadata = transition?.metadata_json;
  if (!transition || !isRecord(metadata) || !isRecord(metadata.reconciliation)) return undefined;
  return {
    ...(metadata.reconciliation as unknown as CashAdvanceReconciliationInput),
    totalSpent: Number(metadata.totalSpent ?? 0),
    balance: Number(metadata.balance ?? 0),
    outcome: String(metadata.outcome ?? 'EXACT') as CashAdvanceReconciliation['outcome'],
    submittedAt: transition.created_at.toISOString(),
  };
}

function signatureFrom(record: StoredCashAdvance, action: string) {
  const metadata = latestTransition(record, action)?.metadata_json;
  return isRecord(metadata) && typeof metadata.signatureKey === 'string'
    ? metadata.signatureKey
    : undefined;
}

function mapCashAdvance(record: StoredCashAdvance): CashAdvanceRecord {
  if (!record.ca_detail) throw new Error(`Submission ${record.id} has no Cash Advance detail.`);
  const snapshot = readSnapshot(record);
  const managerApproval = latestTransition(record, 'APPROVE_BY_MANAGER');
  const managerPreview = latestTransition(record, 'MANAGER_PREVIEW');
  const directorApproval = latestTransition(record, 'APPROVE_BY_DIRECTOR');
  const financePayment = latestTransition(record, 'PAY_BY_FINANCE');
  const completed = latestTransition(record, 'COMPLETE');
  const returned = [...record.transitions].reverse().find((item) =>
    ['RETURN_BY_MANAGER', 'RETURN_BY_DIRECTOR', 'RETURN_BY_FINANCE', 'RETURN_RECONCILIATION'].includes(item.action_code),
  );
  const returnedMetadata = returned?.metadata_json;
  const detail = record.ca_detail;
  const requestNumber = record.submission_number ?? `CA-DRAFT-${record.id.slice(-6)}`;

  return {
    ...snapshot,
    id: record.id,
    requestNumber,
    requestType: 'CASH_ADVANCE',
    status: cashAdvanceVisibleStatus(record.current_state_code),
    totalAmount: Number(record.total_amount),
    staffSignedAt: record.created_at.toISOString(),
    managerSignatureKey: signatureFrom(record, 'APPROVE_BY_MANAGER'),
    managerPreviewedAt: (managerPreview ?? managerApproval)?.created_at.toISOString(),
    managerApprovedAt: managerApproval?.created_at.toISOString(),
    directorSignatureKey: signatureFrom(record, 'APPROVE_BY_DIRECTOR'),
    directorApprovedAt: directorApproval?.created_at.toISOString(),
    financePaidAt: detail.paid_at?.toISOString(),
    financePaidById: financePayment?.actor_user_id ?? undefined,
    financePaymentReference: financePayment ? requestNumber : undefined,
    reconciliationDueDate: detail.reconciliation_due_at?.toISOString().slice(0, 10),
    reconciliation: readReconciliation(record),
    returnRemarks: returned?.reason_text ?? undefined,
    returnedById: returned?.actor_user_id ?? undefined,
    returnedAt: returned?.created_at.toISOString(),
    returnedStage:
      isRecord(returnedMetadata) && returnedMetadata.stage === 'RECONCILIATION'
        ? 'RECONCILIATION'
        : returned
          ? 'REQUEST'
          : undefined,
    completedAt: completed?.created_at.toISOString(),
    completedById: completed?.actor_user_id ?? undefined,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}

async function nextNumber(tx: Prisma.TransactionClient, organizationId: string, requestDate: string) {
  const date = new Date(`${requestDate}T12:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const shortYear = String(year).slice(-2);
  const sequence = await tx.documentSequence.upsert({
    where: {
      organization_id_payment_type_year_month: {
        organization_id: organizationId,
        payment_type: PaymentType.CASH_ADVANCE,
        year,
        month,
      },
    },
    create: {
      organization_id: organizationId,
      payment_type: PaymentType.CASH_ADVANCE,
      year,
      month,
      prefix: 'CA',
      last_sequence: 1,
    },
    update: { last_sequence: { increment: 1 } },
  });
  return `CA${shortYear}-${String(month).padStart(2, '0')}-${String(sequence.last_sequence).padStart(2, '0')}`;
}

async function requireRole(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  role: 'STAFF' | 'MANAGER' | 'DIRECTOR' | 'FINANCE_ADMIN',
) {
  const membership = await tx.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
      is_active: true,
      membership_status: 'ACTIVE',
      roles: { some: { role } },
    },
    select: { id: true, signature_url: true },
  });
  if (!membership) throw new Error(`The acting user is not an active ${role.replace('_', ' ')} for this organization.`);
  return membership;
}

function requesterRoleFromMembership(
  membership: Awaited<ReturnType<typeof requireActiveMembership>>,
): CashAdvanceRole {
  const roles = new Set(membership.roles.map((item) => item.role));
  if (roles.has('DIRECTOR')) return 'director';
  if (roles.has('FINANCE_ADMIN')) return 'finance';
  if (roles.has('MANAGER')) return 'manager';
  return 'staff';
}

async function requireActiveMembership(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
) {
  const membership = await tx.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
      is_active: true,
      membership_status: 'ACTIVE',
    },
    select: { id: true, signature_url: true, roles: { select: { role: true } } },
  });
  if (!membership) throw new Error('The original requester is not an active member of this organization.');
  return membership;
}

async function requireActiveSignature(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  signatureDocumentId: string,
  activeStorageKey?: string | null,
) {
  if (!activeStorageKey) throw new Error('Upload an active signature in Settings before signing.');
  const document = await tx.document.findFirst({
    where: {
      id: signatureDocumentId,
      organization_id: organizationId,
      uploaded_by_id: userId,
      document_type: 'SIGNATURE_IMAGE',
      storage_key: activeStorageKey,
    },
    select: { id: true },
  });
  if (!document) throw new Error('The selected signature is not the user’s active database signature.');
  return document;
}

async function getStored(tx: Prisma.TransactionClient, id: string) {
  const record = await tx.submission.findFirst({
    where: { payment_type: PaymentType.CASH_ADVANCE, OR: [{ id }, { submission_number: id }] },
    include,
  });
  if (!record) throw new Error('Cash Advance could not be found.');
  return record;
}

function monthRange(month?: string) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return undefined;
  const [year, part] = month.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(year, part - 1, 1)),
    lt: new Date(Date.UTC(year, part, 1)),
  };
}

export async function listCashAdvancesFromDatabase(scope?: ListScope) {
  const records = await prisma.submission.findMany({
    where: {
      payment_type: PaymentType.CASH_ADVANCE,
      created_at: monthRange(scope?.month),
    },
    include,
    orderBy: { updated_at: 'desc' },
    take: 1000,
  });
  const mapped = records.map(mapCashAdvance);
  if (!scope || scope.includeAll) return mapped;
  if (scope.approvalOnly && scope.role === 'manager') {
    return mapped.filter((item) => item.managerApproverId === scope.userId && !item.managerPreviewedAt);
  }
  if (scope.approvalOnly && scope.role === 'director') {
    return mapped.filter((item) => item.directorApproverId === scope.userId && item.status === 'PENDING_DIRECTOR_APPROVAL');
  }
  return mapped.filter((item) => {
    if (item.requesterId === scope.userId) return true;
    if (scope.role === 'staff') return item.requesterId === scope.userId;
    if (scope.role === 'manager') return item.managerApproverId === scope.userId;
    if (scope.role === 'director') return item.directorApproverId === scope.userId;
    return true;
  });
}

export async function getCashAdvanceFromDatabase(id: string) {
  const record = await prisma.submission.findFirst({
    where: { payment_type: PaymentType.CASH_ADVANCE, OR: [{ id }, { submission_number: id }] },
    include,
  });
  return record ? mapCashAdvance(record) : null;
}

export async function createCashAdvanceInDatabase(input: CreateCashAdvanceInput) {
  const validation = validateCashAdvanceRequest(input.lines);
  if (validation) throw new Error(validation);
  if (!input.staffSignatureKey.trim()) throw new Error('Requester signature is required.');
  const total = input.lines.reduce((sum, line) => sum + line.amount, 0);

  return prisma.$transaction(async (tx) => {
    const requesterMembership = await requireActiveMembership(tx, input.organizationId, input.requesterId);
    const requesterRole = requesterRoleFromMembership(requesterMembership);
    const isDirectorRequest = requesterRole === 'director';
    if (!isDirectorRequest && !input.managerApproverId.trim()) throw new Error('Choose a Manager approver.');
    if (isDirectorRequest && input.directorApproverId === input.requesterId) throw new Error('Choose another Director to approve this request.');
    await Promise.all([
      ...(!isDirectorRequest ? [requireRole(tx, input.organizationId, input.managerApproverId, 'MANAGER')] : []),
      requireRole(tx, input.organizationId, input.directorApproverId, 'DIRECTOR'),
    ]);
    await requireActiveSignature(tx, input.organizationId, input.requesterId, input.staffSignatureKey, requesterMembership.signature_url);
    const snapshot: CreateCashAdvanceInput = { ...input, requesterRole };
    const { state: initialState, assigneeId: initialAssignee } = cashAdvanceInitialWorkflow(input.directorApproverId);
    const project = input.isOtherProject
      ? null
      : await tx.project.findFirst({
          where: { organization_id: input.organizationId, code: input.projectName },
          select: { id: true },
        });
    const accountIdByCode = await cashAdvanceAccountIds(tx, input.organizationId, input.lines);
    const requestNumber = await nextNumber(tx, input.organizationId, input.requestDate);
    const record = await tx.submission.create({
      data: {
        organization_id: input.organizationId,
        payment_type: PaymentType.CASH_ADVANCE,
        current_state_code: initialState,
        current_state_group: StateGroup.IN_REVIEW,
        current_assignee_id: initialAssignee,
        submission_number: requestNumber,
        submitted_by_id: input.requesterId,
        submitted_at: new Date(),
        total_amount: new Prisma.Decimal(total.toFixed(2)),
        currency: 'MYR',
        description: input.purpose,
        ca_detail: {
          create: {
            purpose_text: input.purpose,
            manager_user_id: isDirectorRequest ? null : input.managerApproverId,
            director_user_id: input.directorApproverId,
          },
        },
        lines: {
          create: input.lines.map((line, index) => ({
            line_number: index + 1,
            description: `${line.description} — ${line.purpose}`,
            amount: new Prisma.Decimal(line.amount.toFixed(2)),
            gl_account_id: line.accountType ? accountIdByCode.get(line.accountType.trim()) : undefined,
            project_id: project?.id,
          })),
        },
        approval_steps: {
          create: [{ step_number: 1, required_role: 'DIRECTOR', assigned_user_id: input.directorApproverId, status_code: 'ACTIVE' }],
        },
        transitions: {
          create: {
            from_state_code: 'NONE',
            action_code: 'CREATE',
            to_state_code: initialState,
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: input.requesterId,
            metadata_json: { snapshot, signatureKey: input.staffSignatureKey } as Prisma.InputJsonValue,
          },
        },
      },
      include,
    });
    await tx.auditEvent.create({
      data: {
        organization_id: input.organizationId,
        submission_id: record.id,
        event_type: 'cash_advance.submitted',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.requesterId,
        payload_json: { requestNumber, total: total.toFixed(2) },
      },
    });
    return mapCashAdvance(record);
  }, { maxWait: 10_000, timeout: 15_000 });
}

async function approve(
  id: string,
  actorId: string,
  signatureKey: string,
  role: 'MANAGER' | 'DIRECTOR',
) {
  if (!signatureKey.trim()) throw new Error(`${role === 'MANAGER' ? 'Manager' : 'Director'} signature is required.`);
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    const expectedState = role === 'MANAGER' ? 'PENDING_MANAGER_APPROVAL' : 'PENDING_DIRECTOR_APPROVAL';
    const legacyManagerState = role === 'DIRECTOR' && record.current_state_code === 'PENDING_MANAGER_APPROVAL';
    if (record.current_state_code !== expectedState && !legacyManagerState) throw new Error(`This Cash Advance is no longer awaiting ${role === 'MANAGER' ? 'Manager' : 'Director'} approval.`);
    const assignedActorId = legacyManagerState ? record.ca_detail?.director_user_id : record.current_assignee_id;
    if (assignedActorId !== actorId) throw new Error('This Cash Advance is assigned to another approver.');
    const membership = await requireRole(tx, record.organization_id, actorId, role);
    await requireActiveSignature(tx, record.organization_id, actorId, signatureKey, membership.signature_url);
    const active = record.approval_steps.find((step) => step.required_role === role && (step.status_code === 'ACTIVE' || (legacyManagerState && step.status_code === 'PENDING')));
    if (!active) throw new Error('The active approval step could not be found.');
    if (legacyManagerState) {
      const managerStep = record.approval_steps.find((step) => step.required_role === 'MANAGER' && step.status_code === 'ACTIVE');
      if (managerStep) await tx.approvalStep.update({ where: { id: managerStep.id }, data: { status_code: 'COMPLETE' } });
    }
    await tx.approvalDecision.create({ data: { approval_step_id: active.id, decision_code: 'APPROVED', decided_by_user_id: actorId } });
    await tx.approvalStep.update({ where: { id: active.id }, data: { status_code: 'COMPLETE' } });

    const nextState = role === 'MANAGER' ? 'PENDING_DIRECTOR_APPROVAL' : 'PENDING_FINANCE_PROCESSING';
    const nextAssignee = role === 'MANAGER' ? record.ca_detail?.director_user_id : null;
    if (role === 'MANAGER') {
      const directorStep = record.approval_steps.find((step) => step.required_role === 'DIRECTOR' && step.status_code === 'PENDING');
      if (!directorStep || !nextAssignee) throw new Error('The Director approval step is incomplete.');
      await tx.approvalStep.update({ where: { id: directorStep.id }, data: { status_code: 'ACTIVE', assigned_user_id: nextAssignee } });
    }
    await tx.submissionTransition.create({
      data: {
        submission_id: record.id,
        from_state_code: record.current_state_code,
        action_code: role === 'MANAGER' ? 'APPROVE_BY_MANAGER' : 'APPROVE_BY_DIRECTOR',
        to_state_code: nextState,
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: actorId,
        actor_membership_id: membership.id,
        metadata_json: { signatureKey },
      },
    });
    const updated = await tx.submission.update({
      where: { id: record.id },
      data: { current_state_code: nextState, current_state_group: StateGroup.IN_REVIEW, current_assignee_id: nextAssignee },
      include,
    });
    await tx.auditEvent.create({
      data: {
        organization_id: record.organization_id,
        submission_id: record.id,
        event_type: role === 'MANAGER' ? 'cash_advance.manager_approved' : 'cash_advance.director_approved',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: actorId,
        payload_json: { fromState: expectedState, toState: nextState },
      },
    });
    return mapCashAdvance(updated);
  }, { maxWait: 10_000, timeout: 15_000 });
}

export const approveCashAdvanceByManagerInDatabase = (id: string, managerId: string, signatureKey: string) =>
  approve(id, managerId, signatureKey, 'MANAGER');
export const approveCashAdvanceByDirectorInDatabase = (id: string, directorId: string, signatureKey: string) =>
  approve(id, directorId, signatureKey, 'DIRECTOR');

export async function previewCashAdvanceByManagerInDatabase(id: string, managerId: string) {
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    if (record.ca_detail?.manager_user_id !== managerId) throw new Error('This Cash Advance is assigned to another Manager.');
    const membership = await requireRole(tx, record.organization_id, managerId, 'MANAGER');
    if (record.transitions.some((transition) => transition.action_code === 'MANAGER_PREVIEW')) return mapCashAdvance(record);

    const legacyManagerStep = record.approval_steps.find((step) => step.required_role === 'MANAGER' && step.status_code === 'ACTIVE');
    const legacyDirectorStep = record.approval_steps.find((step) => step.required_role === 'DIRECTOR' && step.status_code === 'PENDING');
    const legacyState = record.current_state_code === 'PENDING_MANAGER_APPROVAL';
    if (legacyManagerStep) await tx.approvalStep.update({ where: { id: legacyManagerStep.id }, data: { status_code: 'COMPLETE' } });
    if (legacyDirectorStep) await tx.approvalStep.update({ where: { id: legacyDirectorStep.id }, data: { status_code: 'ACTIVE' } });

    await tx.submissionTransition.create({
      data: {
        submission_id: record.id,
        from_state_code: record.current_state_code,
        action_code: 'MANAGER_PREVIEW',
        to_state_code: legacyState ? 'PENDING_DIRECTOR_APPROVAL' : record.current_state_code,
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: managerId,
        actor_membership_id: membership.id,
        metadata_json: { informational: true },
      },
    });
    const updated = legacyState
      ? await tx.submission.update({
          where: { id: record.id },
          data: { current_state_code: 'PENDING_DIRECTOR_APPROVAL', current_state_group: StateGroup.IN_REVIEW, current_assignee_id: record.ca_detail?.director_user_id },
          include,
        })
      : await getStored(tx, record.id);
    await tx.auditEvent.create({
      data: {
        organization_id: record.organization_id,
        submission_id: record.id,
        event_type: 'cash_advance.manager_previewed',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: managerId,
        payload_json: { informational: true },
      },
    });
    return mapCashAdvance(updated);
  }, { maxWait: 10_000, timeout: 15_000 });
}

async function returnRequest(
  id: string,
  actorId: string,
  reason: string,
  role: 'MANAGER' | 'DIRECTOR' | 'FINANCE_ADMIN',
) {
  if (reason.trim().length < 5) throw new Error('Provide clear return remarks of at least 5 characters.');
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    const stateByRole = {
      MANAGER: 'PENDING_MANAGER_APPROVAL',
      DIRECTOR: 'PENDING_DIRECTOR_APPROVAL',
      FINANCE_ADMIN: 'PENDING_FINANCE_PROCESSING',
    } as const;
    const expectedState = stateByRole[role];
    const legacyManagerState = role === 'DIRECTOR' && record.current_state_code === 'PENDING_MANAGER_APPROVAL';
    if (record.current_state_code !== expectedState && !legacyManagerState) throw new Error('This Cash Advance is no longer available for return.');
    const assignedActorId = legacyManagerState ? record.ca_detail?.director_user_id : record.current_assignee_id;
    if (role !== 'FINANCE_ADMIN' && assignedActorId !== actorId) throw new Error('This Cash Advance is assigned to another approver.');
    const membership = await requireRole(tx, record.organization_id, actorId, role);
    const action = role === 'MANAGER' ? 'RETURN_BY_MANAGER' : role === 'DIRECTOR' ? 'RETURN_BY_DIRECTOR' : 'RETURN_BY_FINANCE';
    const active = legacyManagerState
      ? record.approval_steps.find((step) => step.required_role === 'DIRECTOR' && step.status_code === 'PENDING')
      : record.approval_steps.find((step) => step.status_code === 'ACTIVE');
    if (legacyManagerState) {
      const managerStep = record.approval_steps.find((step) => step.required_role === 'MANAGER' && step.status_code === 'ACTIVE');
      if (managerStep) await tx.approvalStep.update({ where: { id: managerStep.id }, data: { status_code: 'COMPLETE' } });
    }
    if (active) {
      await tx.approvalDecision.create({ data: { approval_step_id: active.id, decision_code: 'REJECTED', decided_by_user_id: actorId, reason_text: reason.trim() } });
      await tx.approvalStep.update({ where: { id: active.id }, data: { status_code: 'COMPLETE' } });
    }
    await tx.submissionTransition.create({
      data: {
        submission_id: record.id,
        from_state_code: record.current_state_code,
        action_code: action,
        to_state_code: 'RETURNED_TO_STAFF',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: actorId,
        actor_membership_id: membership.id,
        reason_text: reason.trim(),
        metadata_json: { stage: 'REQUEST' },
      },
    });
    const updated = await tx.submission.update({
      where: { id: record.id },
      data: { current_state_code: 'RETURNED_TO_STAFF', current_state_group: StateGroup.REJECTED, current_assignee_id: record.submitted_by_id },
      include,
    });
    return mapCashAdvance(updated);
  }, { maxWait: 10_000, timeout: 15_000 });
}

export const returnCashAdvanceByManagerInDatabase = (id: string, managerId: string, reason: string) =>
  returnRequest(id, managerId, reason, 'MANAGER');
export const returnCashAdvanceByDirectorInDatabase = (id: string, directorId: string, reason: string) =>
  returnRequest(id, directorId, reason, 'DIRECTOR');
export const returnCashAdvanceByFinanceInDatabase = (id: string, financeId: string, reason: string) =>
  returnRequest(id, financeId, reason, 'FINANCE_ADMIN');

export async function payCashAdvanceByFinanceInDatabase(
  id: string,
  financeId: string,
  paymentDate: string,
) {
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    if (record.current_state_code !== 'PENDING_FINANCE_PROCESSING') throw new Error('This Cash Advance is not ready for payment.');
    const membership = await requireRole(tx, record.organization_id, financeId, 'FINANCE_ADMIN');
    const dueDate = addCalendarDays(paymentDate, CASH_ADVANCE_RECONCILIATION_DAYS);
    const automaticReference = paymentRequestReference(record.submission_number ?? `CA-${record.id}`);
    await tx.cashAdvanceDetail.update({
      where: { submission_id: record.id },
      data: {
        paid_at: new Date(`${paymentDate}T12:00:00Z`),
        paid_reference: automaticReference,
        payment_mode: 'BANK_TRANSFER',
        reconciliation_due_at: new Date(`${dueDate}T12:00:00Z`),
      },
    });
    await tx.submissionTransition.create({
      data: {
        submission_id: record.id,
        from_state_code: 'PENDING_FINANCE_PROCESSING',
        action_code: 'PAY_BY_FINANCE',
        to_state_code: 'PENDING_RECONCILIATION',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        actor_membership_id: membership.id,
        metadata_json: { paymentDate, paymentReference: automaticReference, reconciliationDueDate: dueDate },
      },
    });
    const updated = await tx.submission.update({
      where: { id: record.id },
      data: { current_state_code: 'PENDING_RECONCILIATION', current_state_group: StateGroup.IN_REVIEW, current_assignee_id: record.submitted_by_id },
      include,
    });
    return mapCashAdvance(updated);
  }, { maxWait: 10_000, timeout: 15_000 });
}

export async function resubmitCashAdvanceInDatabase(id: string, input: CreateCashAdvanceInput) {
  const validation = validateCashAdvanceRequest(input.lines);
  if (validation) throw new Error(validation);
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    const mapped = mapCashAdvance(record);
    if (record.current_state_code !== 'RETURNED_TO_STAFF' || mapped.returnedStage !== 'REQUEST') {
      throw new Error('Only a returned Cash Advance request can be amended.');
    }
    if (record.submitted_by_id !== input.requesterId) throw new Error('Only the original requester can amend this Cash Advance.');
    const requesterMembership = await requireActiveMembership(tx, record.organization_id, input.requesterId);
    const requesterRole = requesterRoleFromMembership(requesterMembership);
    const isDirectorRequest = requesterRole === 'director';
    if (!isDirectorRequest && !input.managerApproverId.trim()) throw new Error('Choose a Manager approver.');
    if (isDirectorRequest && input.directorApproverId === input.requesterId) throw new Error('Choose another Director to approve this request.');
    await Promise.all([
      ...(!isDirectorRequest ? [requireRole(tx, record.organization_id, input.managerApproverId, 'MANAGER')] : []),
      requireRole(tx, record.organization_id, input.directorApproverId, 'DIRECTOR'),
    ]);
    await requireActiveSignature(tx, record.organization_id, input.requesterId, input.staffSignatureKey, requesterMembership.signature_url);
    const snapshot: CreateCashAdvanceInput = { ...input, requesterRole };
    const { state: initialState, assigneeId: initialAssignee } = cashAdvanceInitialWorkflow(input.directorApproverId);
    const nextStep = Math.max(0, ...record.approval_steps.map((step) => step.step_number)) + 1;
    const accountIdByCode = await cashAdvanceAccountIds(tx, record.organization_id, input.lines);
    await tx.submissionLine.deleteMany({ where: { submission_id: record.id } });
    await tx.submissionLine.createMany({
      data: input.lines.map((line, index) => ({
        submission_id: record.id,
        line_number: index + 1,
        description: `${line.description} — ${line.purpose}`,
        amount: new Prisma.Decimal(line.amount.toFixed(2)),
        gl_account_id: line.accountType ? accountIdByCode.get(line.accountType.trim()) : undefined,
      })),
    });
    await tx.cashAdvanceDetail.update({
      where: { submission_id: record.id },
      data: { purpose_text: input.purpose, manager_user_id: isDirectorRequest ? null : input.managerApproverId, director_user_id: input.directorApproverId },
    });
    await tx.approvalStep.createMany({
      data: [{ submission_id: record.id, step_number: nextStep, required_role: 'DIRECTOR', assigned_user_id: input.directorApproverId, status_code: 'ACTIVE' }],
    });
    const total = input.lines.reduce((sum, line) => sum + line.amount, 0);
    await tx.submissionTransition.create({
      data: {
        submission_id: record.id,
        from_state_code: 'RETURNED_TO_STAFF',
        action_code: 'RESUBMIT',
        to_state_code: initialState,
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.requesterId,
        metadata_json: { snapshot, signatureKey: input.staffSignatureKey } as Prisma.InputJsonValue,
      },
    });
    const updated = await tx.submission.update({
      where: { id: record.id },
      data: {
        current_state_code: initialState,
        current_state_group: StateGroup.IN_REVIEW,
        current_assignee_id: initialAssignee,
        total_amount: new Prisma.Decimal(total.toFixed(2)),
        description: input.purpose,
      },
      include,
    });
    return mapCashAdvance(updated);
  }, { maxWait: 10_000, timeout: 15_000 });
}

export async function submitCashAdvanceReconciliationInDatabase(
  id: string,
  input: CashAdvanceReconciliationInput,
) {
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    const mapped = mapCashAdvance(record);
    const returnedReconciliation = record.current_state_code === 'RETURNED_TO_STAFF' && mapped.returnedStage === 'RECONCILIATION';
    if (record.current_state_code !== 'PENDING_RECONCILIATION' && !returnedReconciliation) {
      throw new Error('This Cash Advance is not awaiting reconciliation.');
    }
    if (record.submitted_by_id !== input.requesterId) throw new Error('Only the original requester can reconcile this Cash Advance.');
    await requireActiveMembership(tx, record.organization_id, input.requesterId);
    if (!input.expenses.length) throw new Error('Add at least one actual expense.');
    if (input.expenses.some((expense) => !expense.expenseDate || !expense.supplier?.trim() || !expense.description.trim() || !expense.accountType?.trim() || expense.amount <= 0)) {
      throw new Error('Complete every Cash Spent Summary row.');
    }
    if (input.includesParticipantAllowance && !input.participantProof && !input.participantProofLink?.trim()) throw new Error('Provide the Participant Allowance Google Sheet link.');
    const totalSpent = cashAdvanceExpenseTotal(input.expenses);
    const balance = cashAdvanceBalance(Number(record.total_amount), totalSpent);
    const outcome = cashAdvanceOutcome(balance);
    if (outcome === 'UNDERSPEND' && (!input.balanceReturnDate || !input.balanceReturnReference?.trim() || !input.balanceReturnProof)) {
      throw new Error('Upload the balance-return proof and provide its transfer details.');
    }
    await tx.cashAdvanceDetail.update({
      where: { submission_id: record.id },
      data: { reconciliation_outcome: outcome as ReconOutcome },
    });
    await tx.submissionTransition.create({
      data: {
        submission_id: record.id,
        from_state_code: record.current_state_code,
        action_code: 'SUBMIT_RECONCILIATION',
        to_state_code: 'PENDING_FINANCE_RECONCILIATION',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.requesterId,
        metadata_json: { reconciliation: input, totalSpent, balance, outcome } as Prisma.InputJsonValue,
      },
    });
    const updated = await tx.submission.update({
      where: { id: record.id },
      data: { current_state_code: 'PENDING_FINANCE_RECONCILIATION', current_state_group: StateGroup.IN_REVIEW, current_assignee_id: null },
      include,
    });
    return mapCashAdvance(updated);
  }, { maxWait: 10_000, timeout: 15_000 });
}

export async function returnCashAdvanceReconciliationInDatabase(id: string, financeId: string, reason: string) {
  if (reason.trim().length < 5) throw new Error('Provide clear return remarks of at least 5 characters.');
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    if (record.current_state_code !== 'PENDING_FINANCE_RECONCILIATION') throw new Error('This reconciliation is no longer awaiting Finance review.');
    const membership = await requireRole(tx, record.organization_id, financeId, 'FINANCE_ADMIN');
    await tx.submissionTransition.create({
      data: {
        submission_id: record.id,
        from_state_code: 'PENDING_FINANCE_RECONCILIATION',
        action_code: 'RETURN_RECONCILIATION',
        to_state_code: 'RETURNED_TO_STAFF',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        actor_membership_id: membership.id,
        reason_text: reason.trim(),
        metadata_json: { stage: 'RECONCILIATION' },
      },
    });
    const updated = await tx.submission.update({
      where: { id: record.id },
      data: { current_state_code: 'RETURNED_TO_STAFF', current_state_group: StateGroup.REJECTED, current_assignee_id: record.submitted_by_id },
      include,
    });
    return mapCashAdvance(updated);
  }, { maxWait: 10_000, timeout: 15_000 });
}

export async function completeCashAdvanceInDatabase(id: string, financeId: string) {
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    if (record.current_state_code !== 'PENDING_FINANCE_RECONCILIATION') throw new Error('This Cash Advance reconciliation is not ready to complete.');
    const membership = await requireRole(tx, record.organization_id, financeId, 'FINANCE_ADMIN');
    const now = new Date();
    await tx.cashAdvanceDetail.update({ where: { submission_id: record.id }, data: { reconciliation_closed_at: now } });
    await tx.submissionTransition.create({
      data: {
        submission_id: record.id,
        from_state_code: 'PENDING_FINANCE_RECONCILIATION',
        action_code: 'COMPLETE',
        to_state_code: 'COMPLETED',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        actor_membership_id: membership.id,
      },
    });
    const updated = await tx.submission.update({
      where: { id: record.id },
      data: { current_state_code: 'COMPLETED', current_state_group: StateGroup.COMPLETE, current_assignee_id: null, closed_at: now },
      include,
    });
    return mapCashAdvance(updated);
  }, { maxWait: 10_000, timeout: 15_000 });
}

import {
  ActorType,
  OrgRole,
  PaymentType,
  PettyCashEntryType,
  Prisma,
  StateGroup,
} from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import {
  PETTY_CASH_MONTHLY_ALLOCATION,
  pettyCashTotal,
  validatePettyCashInput,
} from '@/domain/payment-requests/petty-cash/policy';
import type {
  CreatePettyCashInput,
  PettyCashFinanceInput,
  PettyCashLedgerSummary,
  PettyCashLedgerTransaction,
  PettyCashLocation,
  PettyCashRecord,
  PettyCashRole,
} from '@/domain/payment-requests/petty-cash/types';

const include = {
  submitted_by: true,
  petty_cash_detail: { include: { petty_cash_float: true } },
  lines: { orderBy: { line_number: 'asc' as const } },
  transitions: { orderBy: { created_at: 'asc' as const } },
  approval_steps: {
    include: { decision: true },
    orderBy: { step_number: 'asc' as const },
  },
} satisfies Prisma.SubmissionInclude;

type StoredPettyCash = Prisma.SubmissionGetPayload<{ include: typeof include }>;
type ListScope = {
  role: PettyCashRole;
  userId: string;
  month?: string;
  includeAll?: boolean;
};

const FLOAT_NAMES: Record<PettyCashLocation, string> = {
  PENANG: 'Penang Office Petty Cash',
  KUALA_LUMPUR: 'Kuala Lumpur Office Petty Cash',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function latestTransition(record: StoredPettyCash, action: string) {
  return [...record.transitions].reverse().find((item) => item.action_code === action);
}

function readSnapshot(record: StoredPettyCash): CreatePettyCashInput {
  const transition = [...record.transitions].reverse().find((item) => {
    if (!['CREATE', 'RESUBMIT'].includes(item.action_code)) return false;
    return isRecord(item.metadata_json) && isRecord(item.metadata_json.snapshot);
  });
  const metadata = transition?.metadata_json;
  if (!isRecord(metadata) || !isRecord(metadata.snapshot)) {
    throw new Error('Petty Cash request details are incomplete.');
  }
  return metadata.snapshot as unknown as CreatePettyCashInput;
}

function readVerification(record: StoredPettyCash) {
  const transition = latestTransition(record, 'VERIFY_BY_FINANCE');
  const metadata = transition?.metadata_json;
  if (!transition || !isRecord(metadata)) return undefined;
  return {
    at: transition.created_at.toISOString(),
    by: transition.actor_user_id ?? undefined,
    paymentDate: typeof metadata.paymentDate === 'string' ? metadata.paymentDate : undefined,
    paymentReference: typeof metadata.paymentReference === 'string' ? metadata.paymentReference : undefined,
    paymentProofLink: typeof metadata.paymentProofLink === 'string' ? metadata.paymentProofLink : undefined,
    notes: typeof metadata.notes === 'string' ? metadata.notes : undefined,
  };
}

function readRequesterReview(record: StoredPettyCash) {
  const transition = latestTransition(record, 'REVIEW_FINANCE_REQUEST');
  return transition ? {
    at: transition.created_at.toISOString(),
    by: transition.actor_user_id ?? undefined,
  } : undefined;
}

function locationFromFloatName(name: string): PettyCashLocation {
  return name.toLowerCase().includes('kuala') ? 'KUALA_LUMPUR' : 'PENANG';
}

function mapPettyCash(record: StoredPettyCash): PettyCashRecord {
  if (!record.petty_cash_detail) {
    throw new Error(`Submission ${record.id} has no Petty Cash detail.`);
  }
  const snapshot = readSnapshot(record);
  const managerApproval = latestTransition(record, 'APPROVE_BY_MANAGER');
  const directorApproval = latestTransition(record, 'APPROVE_BY_DIRECTOR');
  const verification = readVerification(record);
  const requesterReview = readRequesterReview(record);
  const paid = latestTransition(record, 'MARK_PAID');
  const returned = [...record.transitions].reverse().find((item) =>
    ['RETURN_BY_MANAGER', 'RETURN_BY_DIRECTOR', 'RETURN_BY_FINANCE'].includes(item.action_code),
  );

  return {
    ...snapshot,
    location: snapshot.location ?? locationFromFloatName(record.petty_cash_detail.petty_cash_float.name),
    id: record.id,
    requestNumber: record.submission_number ?? `PC-DRAFT-${record.id.slice(-6)}`,
    requestType: 'PETTY_CASH_REQUEST',
    status: record.current_state_code as PettyCashRecord['status'],
    totalAmount: Number(record.total_amount),
    managerApprovedAt: managerApproval?.created_at.toISOString(),
    directorApprovedAt: directorApproval?.created_at.toISOString(),
    requesterReviewedAt: snapshot.requesterRole === 'finance' ? requesterReview?.at ?? directorApproval?.created_at.toISOString() : undefined,
    requesterReviewedById: snapshot.requesterRole === 'finance' ? requesterReview?.by ?? directorApproval?.actor_user_id ?? undefined : undefined,
    financeVerifiedAt: verification?.at,
    financeVerifiedById: verification?.by,
    paymentDate: verification?.paymentDate,
    paymentReference: verification?.paymentReference,
    paymentProofLink: verification?.paymentProofLink,
    paidAt: paid?.created_at.toISOString(),
    paidById: paid?.actor_user_id ?? undefined,
    returnRemarks: returned?.reason_text ?? undefined,
    returnedById: returned?.actor_user_id ?? undefined,
    returnedAt: returned?.created_at.toISOString(),
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}

function monthRange(month?: string) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return undefined;
  const [year, monthPart] = month.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(year, monthPart - 1, 1)),
    lt: new Date(Date.UTC(year, monthPart, 1)),
  };
}

async function requireRole(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  role: OrgRole,
) {
  const membership = await tx.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
      is_active: true,
      membership_status: 'ACTIVE',
      roles: { some: { role } },
    },
    select: { id: true },
  });
  if (!membership) throw new Error(`The acting user is not an active ${role.replaceAll('_', ' ')}.`);
  return membership;
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
    select: { id: true },
  });
  if (!membership) throw new Error('The requester is not an active member of this organization.');
  return membership;
}

async function activeFinanceUser(tx: Prisma.TransactionClient, organizationId: string) {
  const membership = await tx.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      is_active: true,
      membership_status: 'ACTIVE',
      roles: { some: { role: OrgRole.FINANCE_ADMIN } },
    },
    select: { user_id: true },
  });
  if (!membership) throw new Error('No active Finance user is available for Petty Cash.');
  return membership.user_id;
}

function requesterOrgRole(role: PettyCashRole) {
  if (role === 'manager') return OrgRole.MANAGER;
  if (role === 'director') return OrgRole.DIRECTOR;
  if (role === 'finance') return OrgRole.FINANCE_ADMIN;
  return OrgRole.STAFF;
}

async function prepareRouting(
  tx: Prisma.TransactionClient,
  input: CreatePettyCashInput,
) {
  await requireRole(tx, input.organizationId, input.requesterId, requesterOrgRole(input.requesterRole));
  const financeId = input.requesterRole === 'finance'
    ? input.requesterId
    : await activeFinanceUser(tx, input.organizationId);
  const steps: Array<{ step_number: number; required_role: OrgRole; assigned_user_id: string; status_code: 'ACTIVE' }> = [];

  if (input.requesterRole === 'staff') {
    await requireRole(tx, input.organizationId, input.managerApproverId, OrgRole.MANAGER);
    await requireRole(tx, input.organizationId, input.directorApproverId, OrgRole.DIRECTOR);
    steps.push(
      { step_number: 1, required_role: OrgRole.MANAGER, assigned_user_id: input.managerApproverId, status_code: 'ACTIVE' },
      { step_number: 2, required_role: OrgRole.DIRECTOR, assigned_user_id: input.directorApproverId, status_code: 'ACTIVE' },
    );
  } else if (input.requesterRole === 'manager') {
    await requireRole(tx, input.organizationId, input.directorApproverId, OrgRole.DIRECTOR);
    steps.push({ step_number: 1, required_role: OrgRole.DIRECTOR, assigned_user_id: input.directorApproverId, status_code: 'ACTIVE' });
  } else if (input.requesterRole === 'finance') {
    if (!input.financeReviewerId || !input.financeReviewerRole || input.financeReviewerId === input.requesterId) {
      throw new Error('Choose another Finance user, Manager or Director to preview this request.');
    }
    const reviewerRole = input.financeReviewerRole === 'manager'
      ? OrgRole.MANAGER
      : input.financeReviewerRole === 'director'
        ? OrgRole.DIRECTOR
        : OrgRole.FINANCE_ADMIN;
    await requireRole(tx, input.organizationId, input.financeReviewerId, reviewerRole);
    steps.push({ step_number: 1, required_role: reviewerRole, assigned_user_id: input.financeReviewerId, status_code: 'ACTIVE' });
  }

  return { state: 'PENDING_FINANCE_PAYMENT', assigneeId: financeId, steps };
}

async function getOrCreateFloat(
  tx: Prisma.TransactionClient,
  organizationId: string,
  location: PettyCashLocation,
) {
  const name = FLOAT_NAMES[location];
  const existing = await tx.pettyCashFloat.findFirst({
    where: { organization_id: organizationId, name, is_active: true },
  });
  if (existing) return existing;
  const custodianId = await activeFinanceUser(tx, organizationId);
  return tx.pettyCashFloat.create({
    data: {
      organization_id: organizationId,
      custodian_id: custodianId,
      name,
      ceiling_amount: new Prisma.Decimal(PETTY_CASH_MONTHLY_ALLOCATION),
      low_threshold: new Prisma.Decimal(100),
      current_balance: new Prisma.Decimal(0),
    },
  });
}

async function nextNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
  requestDate: string,
) {
  const year = Number(requestDate.slice(0, 4));
  const month = Number(requestDate.slice(5, 7));
  const shortYear = String(year).slice(-2);
  const sequence = await tx.documentSequence.upsert({
    where: {
      organization_id_payment_type_year_month: {
        organization_id: organizationId,
        payment_type: PaymentType.PETTY_CASH_TOPUP,
        year,
        month,
      },
    },
    create: {
      organization_id: organizationId,
      payment_type: PaymentType.PETTY_CASH_TOPUP,
      year,
      month,
      prefix: 'PC',
      last_sequence: 1,
    },
    update: { last_sequence: { increment: 1 } },
  });
  return `${sequence.prefix}${shortYear}-${String(month).padStart(2, '0')}-${String(sequence.last_sequence).padStart(2, '0')}`;
}

async function getStored(tx: Prisma.TransactionClient, id: string) {
  const record = await tx.submission.findFirst({
    where: {
      payment_type: PaymentType.PETTY_CASH_TOPUP,
      OR: [{ id }, { submission_number: id }],
    },
    include,
  });
  if (!record) throw new Error('Petty Cash request could not be found.');
  return record;
}

export async function createPettyCashInDatabase(input: CreatePettyCashInput) {
  const validation = validatePettyCashInput(input);
  if (validation) throw new Error(validation);
  const total = pettyCashTotal(input.lines);

  return prisma.$transaction(async (tx) => {
    await requireActiveMembership(tx, input.organizationId, input.requesterId);
    const routing = await prepareRouting(tx, input);
    const float = await getOrCreateFloat(tx, input.organizationId, input.location);
    const requestNumber = await nextNumber(tx, input.organizationId, input.requestDate);
    const submission = await tx.submission.create({
      data: {
        organization_id: input.organizationId,
        payment_type: PaymentType.PETTY_CASH_TOPUP,
        current_state_code: routing.state,
        current_state_group: routing.state === 'PENDING_FINANCE_PAYMENT' ? StateGroup.PENDING_VERIFICATION : StateGroup.IN_REVIEW,
        current_assignee_id: routing.assigneeId,
        submission_number: requestNumber,
        submitted_by_id: input.requesterId,
        submitted_at: new Date(),
        total_amount: new Prisma.Decimal(total.toFixed(2)),
        currency: 'MYR',
        description: input.notes || input.lines[0]?.details,
        petty_cash_detail: {
          create: {
            petty_cash_float_id: float.id,
            manager_user_id: input.managerApproverId,
          },
        },
        lines: {
          create: input.lines.map((line, index) => ({
            line_number: index + 1,
            description: line.details,
            amount: new Prisma.Decimal(Number(line.amount).toFixed(2)),
          })),
        },
        approval_steps: routing.steps.length ? { create: routing.steps } : undefined,
        transitions: {
          create: {
            from_state_code: 'DRAFT',
            to_state_code: routing.state,
            action_code: 'CREATE',
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: input.requesterId,
            metadata_json: { snapshot: input } as unknown as Prisma.InputJsonValue,
          },
        },
      },
      include,
    });
    await tx.auditEvent.create({
      data: {
        organization_id: input.organizationId,
        submission_id: submission.id,
        event_type: 'petty_cash.created',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.requesterId,
      },
    });
    return mapPettyCash(submission);
  });
}

export async function listPettyCashFromDatabase(scope: ListScope) {
  const records = await prisma.submission.findMany({
    where: {
      payment_type: PaymentType.PETTY_CASH_TOPUP,
      created_at: monthRange(scope.month),
    },
    include,
    orderBy: { updated_at: 'desc' },
    take: 1000,
  });
  const mapped = records.map(mapPettyCash);
  if (scope.includeAll || scope.role === 'finance') return mapped;
  return mapped.filter((item) =>
    item.requesterId === scope.userId ||
    (scope.role === 'manager' && (item.managerApproverId === scope.userId || item.financeReviewerId === scope.userId)) ||
    (scope.role === 'director' && (item.directorApproverId === scope.userId || item.financeReviewerId === scope.userId)),
  );
}

export async function getPettyCashFromDatabase(id: string) {
  const record = await prisma.submission.findFirst({
    where: {
      payment_type: PaymentType.PETTY_CASH_TOPUP,
      OR: [{ id }, { submission_number: id }],
    },
    include,
  });
  return record ? mapPettyCash(record) : null;
}

export async function approvePettyCashByManagerInDatabase(
  id: string,
  managerId: string,
) {
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    const snapshot = readSnapshot(record);
    const assignedToManager = snapshot.managerApproverId === managerId || (
      snapshot.requesterRole === 'finance' &&
      snapshot.financeReviewerRole === 'manager' &&
      snapshot.financeReviewerId === managerId
    );
    if (!assignedToManager) {
      throw new Error('This Petty Cash request is assigned to another Manager.');
    }
    if (record.transitions.some((item) => item.action_code === 'APPROVE_BY_MANAGER')) throw new Error('The Manager preview has already been recorded.');
    if (record.current_state_code === 'RETURNED_TO_STAFF') throw new Error('A returned request is not available for Manager preview.');
    await requireRole(tx, record.organization_id, managerId, OrgRole.MANAGER);
    const managerStep = record.approval_steps.find((step) => step.required_role === OrgRole.MANAGER && step.assigned_user_id === managerId && step.status_code !== 'COMPLETE');
    if (!managerStep) throw new Error('The Manager preview step is missing.');
    await tx.approvalStep.update({
      where: { id: managerStep.id },
      data: {
        status_code: 'COMPLETE',
        decision: { create: { decision_code: 'APPROVED', decided_by_user_id: managerId } },
      },
    });
    const legacyState = ['PENDING_MANAGER_APPROVAL', 'PENDING_DIRECTOR_APPROVAL', 'PENDING_FINANCE_REVIEW'].includes(record.current_state_code);
    const financeId = snapshot.requesterRole === 'finance' ? snapshot.requesterId : await activeFinanceUser(tx, record.organization_id);
    return mapPettyCash(await tx.submission.update({
      where: { id: record.id },
      data: {
        current_state_code: legacyState ? 'PENDING_FINANCE_PAYMENT' : record.current_state_code,
        current_state_group: legacyState ? StateGroup.PENDING_VERIFICATION : record.current_state_group,
        current_assignee_id: legacyState ? financeId : record.current_assignee_id,
        transitions: {
          create: {
            from_state_code: record.current_state_code,
          to_state_code: legacyState ? 'PENDING_FINANCE_PAYMENT' : record.current_state_code,
            action_code: 'APPROVE_BY_MANAGER',
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: managerId,
          }
        },
      },
      include,
    }));
  });
}

export async function approvePettyCashByDirectorInDatabase(
  id: string,
  directorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    const snapshot = readSnapshot(record);
    const assignedToDirector = snapshot.directorApproverId === directorId || (
      snapshot.requesterRole === 'finance' &&
      snapshot.financeReviewerRole === 'director' &&
      snapshot.financeReviewerId === directorId
    );
    if (!assignedToDirector) {
      throw new Error('This Petty Cash request is assigned to another Director.');
    }
    if (record.transitions.some((item) => item.action_code === 'APPROVE_BY_DIRECTOR')) throw new Error('The Director preview has already been recorded.');
    if (record.current_state_code === 'RETURNED_TO_STAFF') throw new Error('A returned request is not available for Director preview.');
    await requireRole(tx, record.organization_id, directorId, OrgRole.DIRECTOR);
    const directorStep = record.approval_steps.find((step) => step.required_role === OrgRole.DIRECTOR && step.assigned_user_id === directorId && step.status_code !== 'COMPLETE');
    if (!directorStep) throw new Error('The Director preview step is missing.');
    await tx.approvalStep.update({
      where: { id: directorStep.id },
      data: {
        status_code: 'COMPLETE',
        decision: { create: { decision_code: 'APPROVED', decided_by_user_id: directorId } },
      },
    });
    const legacyState = ['PENDING_MANAGER_APPROVAL', 'PENDING_DIRECTOR_APPROVAL', 'PENDING_FINANCE_REVIEW'].includes(record.current_state_code);
    const financeId = snapshot.requesterRole === 'finance' ? snapshot.requesterId : await activeFinanceUser(tx, record.organization_id);
    return mapPettyCash(await tx.submission.update({
      where: { id: record.id },
      data: {
        current_state_code: legacyState ? 'PENDING_FINANCE_PAYMENT' : record.current_state_code,
        current_state_group: legacyState ? StateGroup.PENDING_VERIFICATION : record.current_state_group,
        current_assignee_id: legacyState ? financeId : record.current_assignee_id,
        transitions: {
          create: {
            from_state_code: record.current_state_code,
          to_state_code: legacyState ? 'PENDING_FINANCE_PAYMENT' : record.current_state_code,
            action_code: 'APPROVE_BY_DIRECTOR',
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: directorId,
          }
        },
      },
      include,
    }));
  });
}

export async function reviewPettyCashByFinancePeerInDatabase(
  id: string,
  reviewerId: string,
) {
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    const snapshot = readSnapshot(record);
    if (snapshot.requesterRole !== 'finance' || snapshot.financeReviewerRole !== 'finance') {
      throw new Error('This request does not require a Finance peer review.');
    }
    if (snapshot.requesterId === reviewerId) {
      throw new Error('A Finance requester cannot review their own Petty Cash request.');
    }
    if (snapshot.financeReviewerId !== reviewerId) {
      throw new Error('This Petty Cash request is assigned to another reviewer.');
    }
    if (record.transitions.some((item) => item.action_code === 'REVIEW_FINANCE_REQUEST')) throw new Error('The independent preview has already been recorded.');
    if (record.current_state_code === 'RETURNED_TO_STAFF') throw new Error('A returned request is not available for independent preview.');
    await requireRole(tx, record.organization_id, reviewerId, OrgRole.FINANCE_ADMIN);
    const reviewStep = record.approval_steps.find((step) => step.required_role === OrgRole.FINANCE_ADMIN && step.assigned_user_id === reviewerId && step.status_code !== 'COMPLETE');
    if (!reviewStep) throw new Error('The Finance preview step is missing.');
    await tx.approvalStep.update({
      where: { id: reviewStep.id },
      data: {
        status_code: 'COMPLETE',
        decision: { create: { decision_code: 'APPROVED', decided_by_user_id: reviewerId } },
      },
    });
    const legacyState = record.current_state_code === 'PENDING_FINANCE_REVIEW';
    return mapPettyCash(await tx.submission.update({
      where: { id: record.id },
      data: {
        current_state_code: legacyState ? 'PENDING_FINANCE_PAYMENT' : record.current_state_code,
        current_state_group: legacyState ? StateGroup.PENDING_VERIFICATION : record.current_state_group,
        current_assignee_id: legacyState ? snapshot.requesterId : record.current_assignee_id,
        transitions: {
          create: {
            from_state_code: record.current_state_code,
          to_state_code: legacyState ? 'PENDING_FINANCE_PAYMENT' : record.current_state_code,
            action_code: 'REVIEW_FINANCE_REQUEST',
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: reviewerId,
          }
        },
      },
      include,
    }));
  });
}

async function returnToStaff(id: string, actorId: string, reason: string, role: OrgRole) {
  if (!reason.trim()) throw new Error('Enter correction remarks before returning the request.');
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    await requireRole(tx, record.organization_id, actorId, role);
    if (role === OrgRole.MANAGER && record.current_state_code !== 'PENDING_MANAGER_APPROVAL') {
      throw new Error('This request is not pending Manager approval.');
    }
    if (role === OrgRole.DIRECTOR && record.current_state_code !== 'PENDING_DIRECTOR_APPROVAL') {
      throw new Error('This request is not pending Director approval.');
    }
    if (role === OrgRole.FINANCE_ADMIN && !['PENDING_FINANCE_REVIEW', 'PENDING_FINANCE_PAYMENT', 'FINANCE_VERIFIED'].includes(record.current_state_code)) {
      throw new Error('This request is not pending Finance processing.');
    }
    if (record.current_assignee_id && record.current_assignee_id !== actorId && record.current_state_code !== 'PENDING_FINANCE_PAYMENT' && record.current_state_code !== 'FINANCE_VERIFIED') {
      throw new Error('This request is assigned to another reviewer.');
    }
    return mapPettyCash(await tx.submission.update({
      where: { id: record.id },
      data: {
        current_state_code: 'RETURNED_TO_STAFF',
        current_state_group: StateGroup.REJECTED,
        current_assignee_id: record.submitted_by_id,
        transitions: {
          create: {
            from_state_code: record.current_state_code,
            to_state_code: 'RETURNED_TO_STAFF',
            action_code: role === OrgRole.MANAGER
              ? 'RETURN_BY_MANAGER'
              : role === OrgRole.DIRECTOR
                ? 'RETURN_BY_DIRECTOR'
                : 'RETURN_BY_FINANCE',
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: actorId,
            reason_text: reason.trim(),
          }
        },
      },
      include,
    }));
  });
}

export const returnPettyCashByManagerInDatabase = (id: string, managerId: string, reason: string) =>
  returnToStaff(id, managerId, reason, OrgRole.MANAGER);
export const returnPettyCashByDirectorInDatabase = (id: string, directorId: string, reason: string) =>
  returnToStaff(id, directorId, reason, OrgRole.DIRECTOR);
export const returnPettyCashByFinanceInDatabase = (id: string, financeId: string, reason: string) =>
  returnToStaff(id, financeId, reason, OrgRole.FINANCE_ADMIN);

export async function resubmitPettyCashInDatabase(id: string, input: CreatePettyCashInput) {
  const validation = validatePettyCashInput(input);
  if (validation) throw new Error(validation);
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    if (record.current_state_code !== 'RETURNED_TO_STAFF') throw new Error('Only a returned request can be resubmitted.');
    if (record.submitted_by_id !== input.requesterId) throw new Error('Only the original requester can resubmit this request.');
    await requireActiveMembership(tx, record.organization_id, input.requesterId);
    const routing = await prepareRouting(tx, input);
    const float = await getOrCreateFloat(tx, record.organization_id, input.location);
    const total = pettyCashTotal(input.lines);
    await tx.submissionLine.deleteMany({ where: { submission_id: record.id } });
    await tx.approvalDecision.deleteMany({ where: { approval_step: { submission_id: record.id } } });
    await tx.approvalStep.deleteMany({ where: { submission_id: record.id } });
    return mapPettyCash(await tx.submission.update({
      where: { id: record.id },
      data: {
        current_state_code: routing.state,
        current_state_group: routing.state === 'PENDING_FINANCE_PAYMENT' ? StateGroup.PENDING_VERIFICATION : StateGroup.IN_REVIEW,
        current_assignee_id: routing.assigneeId,
        total_amount: new Prisma.Decimal(total.toFixed(2)),
        description: input.notes || input.lines[0]?.details,
        petty_cash_detail: {
          update: {
            petty_cash_float_id: float.id,
            manager_user_id: input.managerApproverId,
          }
        },
        lines: {
          create: input.lines.map((line, index) => ({
            line_number: index + 1,
            description: line.details,
            amount: new Prisma.Decimal(Number(line.amount).toFixed(2)),
          }))
        },
        approval_steps: routing.steps.length ? { create: routing.steps } : undefined,
        transitions: {
          create: {
            from_state_code: record.current_state_code,
            to_state_code: routing.state,
            action_code: 'RESUBMIT',
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: input.requesterId,
            metadata_json: { snapshot: input } as unknown as Prisma.InputJsonValue,
          }
        },
      },
      include,
    }));
  });
}

export async function verifyPettyCashByFinanceInDatabase(
  id: string,
  input: PettyCashFinanceInput,
) {
  if (!input.paymentDate || !input.paymentReference.trim() || !input.paymentProofLink.trim()) {
    throw new Error('Complete the payment date, reference and proof link.');
  }
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    await requireRole(tx, record.organization_id, input.financeId, OrgRole.FINANCE_ADMIN);
    if (record.current_state_code !== 'PENDING_FINANCE_PAYMENT') {
      throw new Error('Only a request pending Finance payment can be verified.');
    }
    return mapPettyCash(await tx.submission.update({
      where: { id: record.id },
      data: {
        current_state_code: 'FINANCE_VERIFIED',
        current_state_group: StateGroup.PENDING_VERIFICATION,
        current_assignee_id: input.financeId,
        transitions: {
          create: {
            from_state_code: record.current_state_code,
            to_state_code: 'FINANCE_VERIFIED',
            action_code: 'VERIFY_BY_FINANCE',
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: input.financeId,
            metadata_json: {
              paymentDate: input.paymentDate,
              paymentReference: input.paymentReference.trim(),
              paymentProofLink: input.paymentProofLink.trim(),
              notes: input.notes?.trim(),
            },
          }
        },
      },
      include,
    }));
  });
}

async function ensureMonthlyAllocation(
  tx: Prisma.TransactionClient,
  floatId: string,
  financeId: string,
  month: string,
) {
  const range = monthRange(month);
  if (!range) throw new Error('A valid payment month is required.');
  const description = `Monthly allocation ${month}`;
  const existing = await tx.pettyCashEntry.findFirst({
    where: { float_id: floatId, entry_type: PettyCashEntryType.TOPUP, description, created_at: range },
  });
  if (!existing) {
    await tx.pettyCashEntry.create({
      data: {
        float_id: floatId,
        entry_type: PettyCashEntryType.TOPUP,
        amount: new Prisma.Decimal(PETTY_CASH_MONTHLY_ALLOCATION),
        description,
        recorded_by_id: financeId,
        created_at: new Date(`${month}-01T00:00:00.000Z`),
      },
    });
  }
  const ledgerEntries = await tx.pettyCashEntry.findMany({
    where: { float_id: floatId },
    select: { entry_type: true, amount: true },
  });
  const currentBalance = ledgerEntries.reduce((balance, entry) => {
    const amount = Number(entry.amount);
    return entry.entry_type === PettyCashEntryType.TOPUP
      ? balance + amount
      : balance - amount;
  }, 0);
  await tx.pettyCashFloat.update({
    where: { id: floatId },
    data: { current_balance: new Prisma.Decimal(currentBalance.toFixed(2)) },
  });
}

export async function markPettyCashPaidInDatabase(id: string, financeId: string) {
  return prisma.$transaction(async (tx) => {
    const record = await getStored(tx, id);
    await requireRole(tx, record.organization_id, financeId, OrgRole.FINANCE_ADMIN);
    if (!record.petty_cash_detail) throw new Error('Petty Cash fund information is missing.');
    if (record.current_state_code === 'PAID') return mapPettyCash(record);
    if (record.current_state_code !== 'FINANCE_VERIFIED') {
      throw new Error('Finance must verify the payment information before marking it paid.');
    }
    const verification = readVerification(record);
    if (!verification?.paymentDate || !verification.paymentReference || !verification.paymentProofLink) {
      throw new Error('The verified payment information is incomplete.');
    }

    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM petty_cash_floats
      WHERE id = ${record.petty_cash_detail.petty_cash_float_id}
      FOR UPDATE
    `);
    const duplicate = await tx.pettyCashEntry.findFirst({
      where: {
        float_id: record.petty_cash_detail.petty_cash_float_id,
        entry_type: PettyCashEntryType.DISBURSEMENT,
        topup_submission_id: record.id,
      },
    });
    if (duplicate) {
      return mapPettyCash(await tx.submission.update({
        where: { id: record.id },
        data: { current_state_code: 'PAID', current_state_group: StateGroup.COMPLETE, closed_at: new Date() },
        include,
      }));
    }

    const paymentMonth = verification.paymentDate.slice(0, 7);
    const snapshot = readSnapshot(record);
    const receiptProofLink = snapshot.lines.find((line) => line.proofLink.trim())?.proofLink;
    if (!receiptProofLink) {
      throw new Error('At least one Staff receipt or invoice link is required before payment.');
    }
    await ensureMonthlyAllocation(tx, record.petty_cash_detail.petty_cash_float_id, financeId, paymentMonth);
    const float = await tx.pettyCashFloat.findUniqueOrThrow({ where: { id: record.petty_cash_detail.petty_cash_float_id } });
    const amount = Number(record.total_amount);
    if (Number(float.current_balance) < amount) {
      throw new Error(`Insufficient Petty Cash balance. Available: RM${Number(float.current_balance).toFixed(2)}.`);
    }
    await tx.pettyCashEntry.create({
      data: {
        float_id: float.id,
        entry_type: PettyCashEntryType.DISBURSEMENT,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        description: verification.notes?.trim() ?? '',
        recorded_by_id: financeId,
        receipt_url: receiptProofLink,
        topup_submission_id: record.id,
        created_at: new Date(`${verification.paymentDate}T12:00:00.000Z`),
      },
    });
    await tx.pettyCashFloat.update({
      where: { id: float.id },
      data: { current_balance: { decrement: new Prisma.Decimal(amount.toFixed(2)) } },
    });
    return mapPettyCash(await tx.submission.update({
      where: { id: record.id },
      data: {
        current_state_code: 'PAID',
        current_state_group: StateGroup.COMPLETE,
        current_assignee_id: null,
        closed_at: new Date(),
        transitions: {
          create: {
            from_state_code: record.current_state_code,
            to_state_code: 'PAID',
            action_code: 'MARK_PAID',
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: financeId,
            metadata_json: { paymentMonth, amount, floatId: float.id },
          }
        },
      },
      include,
    }));
  });
}

export async function listPettyCashLedgerFromDatabase(input: {
  organizationId: string;
  month: string;
  location?: PettyCashLocation;
}): Promise<PettyCashLedgerSummary[]> {
  const range = monthRange(input.month);
  if (!range) throw new Error('Select a valid ledger month.');
  const locations = input.location ? [input.location] : (['PENANG', 'KUALA_LUMPUR'] as const);

  return Promise.all(locations.map(async (location) => {
    const float = await prisma.pettyCashFloat.findFirst({
      where: { organization_id: input.organizationId, name: FLOAT_NAMES[location], is_active: true },
    });
    const entries = float ? await prisma.pettyCashEntry.findMany({
      where: { float_id: float.id, created_at: range },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    }) : [];
    const previousEntries = float ? await prisma.pettyCashEntry.findMany({
      where: { float_id: float.id, created_at: { lt: range.gte } },
      select: { entry_type: true, amount: true },
    }) : [];
    const sourceIds = entries.flatMap((entry) => entry.topup_submission_id ? [entry.topup_submission_id] : []);
    const submissions = sourceIds.length ? await prisma.submission.findMany({
      where: { id: { in: sourceIds } },
      include: { submitted_by: true },
    }) : [];
    const submissionById = new Map(submissions.map((record) => [record.id, record]));
    const openingBalance = previousEntries.reduce((value, entry) => {
      const amount = Number(entry.amount);
      return entry.entry_type === PettyCashEntryType.TOPUP
        ? value + amount
        : value - amount;
    }, 0);
    let balance = openingBalance;
    const transactions: PettyCashLedgerTransaction[] = [];
    if (openingBalance !== 0) {
      transactions.push({
        id: `carry-forward-${location}-${input.month}`,
        date: `${input.month}-01`,
        name: 'Balance brought forward',
        location,
        moneyIn: Math.max(openingBalance, 0),
        moneyOut: Math.max(-openingBalance, 0),
        balance,
        notes: `Closing balance carried forward from the previous month`,
      });
    }
    const hasOpening = entries.some((entry) => entry.entry_type === PettyCashEntryType.TOPUP);
    if (!hasOpening) {
      balance += PETTY_CASH_MONTHLY_ALLOCATION;
      transactions.push({
        id: `opening-${location}-${input.month}`,
        date: `${input.month}-01`,
        name: 'Monthly allocation',
        location,
        moneyIn: PETTY_CASH_MONTHLY_ALLOCATION,
        moneyOut: 0,
        balance,
        notes: `${location === 'PENANG' ? 'Penang' : 'Kuala Lumpur'} monthly Petty Cash allocation`,
      });
    }
    for (const entry of entries) {
      const amount = Number(entry.amount);
      const moneyIn = entry.entry_type === PettyCashEntryType.TOPUP ? amount : 0;
      const moneyOut = entry.entry_type === PettyCashEntryType.DISBURSEMENT ? amount : 0;
      balance += moneyIn - moneyOut;
      const source = entry.topup_submission_id ? submissionById.get(entry.topup_submission_id) : undefined;
      transactions.push({
        id: entry.id,
        date: entry.created_at.toISOString().slice(0, 10),
        name: source?.submitted_by.name ?? (moneyIn ? 'Monthly allocation' : 'Finance'),
        location,
        moneyIn,
        moneyOut,
        balance,
        proofLink: entry.receipt_url ?? undefined,
        notes: entry.description,
        requestId: source?.id,
        requestNumber: source?.submission_number ?? undefined,
      });
    }
    const moneyIn = transactions.reduce((sum, item) => sum + item.moneyIn, 0);
    const moneyOut = transactions.reduce((sum, item) => sum + item.moneyOut, 0);
    return {
      location,
      month: input.month,
      allocation: PETTY_CASH_MONTHLY_ALLOCATION,
      openingBalance,
      moneyIn,
      moneyOut,
      balance,
      transactions,
    };
  }));
}

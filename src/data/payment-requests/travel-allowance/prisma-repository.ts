/* eslint-disable camelcase -- Prisma fields mirror the existing snake_case database schema. */
import {
  ActorType,
  PaymentType,
  Prisma,
  StateGroup,
} from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import type {
  CreateTravelAllowanceInput,
  TravelAllowanceRecord,
} from '@/domain/payment-requests/travel-allowance/types';

const travelAllowanceInclude = {
  travel_detail: true,
  lines: {
    include: { project: true },
    orderBy: { line_number: 'asc' as const },
  },
  transitions: {
    orderBy: { created_at: 'asc' as const },
  },
  approval_steps: {
    include: { decision: true },
    orderBy: { step_number: 'asc' as const },
  },
} satisfies Prisma.SubmissionInclude;

type StoredTravelAllowance = Prisma.SubmissionGetPayload<{
  include: typeof travelAllowanceInclude;
}>;

type TravelAllowanceSnapshot = CreateTravelAllowanceInput;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSnapshot(record: StoredTravelAllowance): TravelAllowanceSnapshot {
  const created = [...record.transitions].reverse().find(
    (transition) => transition.action_code === 'CREATE' || transition.action_code === 'RESUBMIT',
  );
  const metadata = created?.metadata_json;

  if (!isRecord(metadata) || !isRecord(metadata.snapshot)) {
    throw new Error('Travel Allowance request details are incomplete.');
  }

  return metadata.snapshot as unknown as TravelAllowanceSnapshot;
}

function previousBusinessDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  do date.setUTCDate(date.getUTCDate() - 1);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

function mapTravelAllowance(record: StoredTravelAllowance): TravelAllowanceRecord {
  const snapshot = readSnapshot(record);
  const managerDecision = record.approval_steps.find(
    (step) => step.required_role === 'MANAGER',
  )?.decision;
  const directorDecision = record.approval_steps.find(
    (step) => step.required_role === 'DIRECTOR',
  )?.decision;
  const managerReturn = [...record.transitions].reverse().find(
    (transition) => transition.action_code === 'RETURN_BY_MANAGER',
  );
  const directorReturn = [...record.transitions].reverse().find(
    (transition) => transition.action_code === 'RETURN_BY_DIRECTOR',
  );
  const financeReturn = [...record.transitions].reverse().find(
    (transition) => transition.action_code === 'RETURN_BY_FINANCE',
  );
  const financeComplete = record.transitions.find(
    (transition) => transition.action_code === 'COMPLETE',
  );
  const financeMetadata = isRecord(financeComplete?.metadata_json)
    ? financeComplete.metadata_json
    : undefined;
  const earliestTravelDate = [...snapshot.lines]
    .map((line) => line.travelDate)
    .sort()[0];

  return {
    ...snapshot,
    id: record.id,
    requestNumber: record.submission_number ?? `TA-DRAFT-${record.id.slice(-6)}`,
    requestType: 'TRAVEL_ALLOWANCE',
    status: record.current_state_code as TravelAllowanceRecord['status'],
    totalAmount: Number(record.total_amount),
    paymentDueDate: previousBusinessDay(earliestTravelDate),
    managerReviewedAt: managerDecision?.created_at.toISOString(),
    managerReviewedById: managerDecision?.decided_by_user_id,
    managerReturnedAt: managerReturn?.created_at.toISOString(),
    managerReturnedById: managerReturn?.actor_user_id ?? undefined,
    managerReturnRemarks: managerReturn?.reason_text ?? undefined,
    directorReviewedAt: directorDecision?.created_at.toISOString(),
    directorReviewedById: directorDecision?.decided_by_user_id,
    directorReturnedAt: directorReturn?.created_at.toISOString(),
    directorReturnedById: directorReturn?.actor_user_id ?? undefined,
    directorReturnRemarks: directorReturn?.reason_text ?? undefined,
    financeVerifiedAt: financeComplete?.created_at.toISOString(),
    financeVerifiedById: financeComplete?.actor_user_id ?? undefined,
    financeReturnedAt: financeReturn?.created_at.toISOString(),
    financeReturnedById: financeReturn?.actor_user_id ?? undefined,
    financeReturnRemarks: financeReturn?.reason_text ?? undefined,
    financePaymentDate: record.travel_detail?.paid_at?.toISOString().slice(0, 10),
    financePaymentReference: record.travel_detail?.paid_reference ?? undefined,
    financeRemarks:
      typeof financeMetadata?.financeRemarks === 'string'
        ? financeMetadata.financeRemarks
        : undefined,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}

async function nextTravelAllowanceNumber(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  now: Date,
) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const shortYear = String(year).slice(-2);
  const sequence = await transaction.documentSequence.upsert({
    where: {
      organization_id_payment_type_year_month: {
        organization_id: organizationId,
        payment_type: PaymentType.TRAVEL_ALLOWANCE,
        year,
        month,
      },
    },
    create: {
      organization_id: organizationId,
      payment_type: PaymentType.TRAVEL_ALLOWANCE,
      year,
      month,
      prefix: 'TA',
      last_sequence: 1,
    },
    update: { last_sequence: { increment: 1 } },
  });

  return `TA${shortYear}-${String(month).padStart(2, '0')}-${String(sequence.last_sequence).padStart(2, '0')}`;
}

export async function listTravelAllowancesFromDatabase(scope?: {
  role: 'staff' | 'manager' | 'director' | 'finance';
  userId: string;
  month?: string;
  includeAll?: boolean;
}) {
  const records = await prisma.submission.findMany({
    where: { payment_type: PaymentType.TRAVEL_ALLOWANCE },
    include: travelAllowanceInclude,
    orderBy: { updated_at: 'desc' },
  });
  const mapped = records.map(mapTravelAllowance);
  if (!scope) return mapped;

  if (scope.role === 'staff') {
    return mapped.filter(
      (record) =>
        record.requesterId === scope.userId ||
        record.lines.some((line) => line.employeeId === scope.userId),
    );
  }

  if (scope.role === 'finance') {
    return mapped.filter((record) => {
      if (scope.includeAll) return true;
      const visibleToFinance =
        record.status === 'PENDING_FINANCE_VERIFICATION' ||
        record.status === 'COMPLETED' ||
        Boolean(record.financeReturnedAt);
      const matchesMonth = !scope.month || record.lines.some(
        (line) => line.travelDate.startsWith(scope.month!),
      );
      return visibleToFinance && matchesMonth;
    });
  }

  if (scope.role === 'manager') {
    return mapped.filter(
      (record) =>
        record.managerApproverId === scope.userId ||
        record.requesterId === scope.userId,
    );
  }

  return mapped.filter(
    (record) =>
      record.projectDirectorId === scope.userId &&
      record.status !== 'PENDING_MANAGER_REVIEW' &&
      !(
        record.status === 'RETURNED_TO_STAFF' &&
        record.managerReturnedAt &&
        !record.directorReturnedAt
      ),
  );
}

export async function getTravelAllowanceFromDatabase(id: string) {
  const record = await prisma.submission.findFirst({
    where: {
      payment_type: PaymentType.TRAVEL_ALLOWANCE,
      OR: [{ id }, { submission_number: id }],
    },
    include: travelAllowanceInclude,
  });
  return record ? mapTravelAllowance(record) : null;
}

export async function createTravelAllowanceInDatabase(
  input: CreateTravelAllowanceInput,
) {
  if (input.requesterRole === 'staff' && !input.managerApproverId) {
    throw new Error('Select the Manager reviewer.');
  }

  const totalAmount = input.lines.reduce(
    (sum, line) => sum + line.meals.reduce(
      (mealTotal, meal) => mealTotal + (meal === 'BREAKFAST' ? 10 : 20),
      0,
    ) + line.specialAllowance,
    0,
  );
  if (totalAmount <= 0) {
    throw new Error('Travel Allowance total must be greater than RM 0.00.');
  }

  const startDate = [...input.lines].map((line) => line.travelDate).sort()[0];
  const endDate = [...input.lines].map((line) => line.travelDate).sort().at(-1) ?? startDate;
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const [organization, requester, manager, director] = await Promise.all([
      transaction.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } }),
      transaction.user.findUnique({ where: { id: input.requesterId }, select: { id: true } }),
      input.managerApproverId
        ? transaction.user.findUnique({ where: { id: input.managerApproverId }, select: { id: true } })
        : Promise.resolve(null),
      transaction.user.findUnique({ where: { id: input.projectDirectorId }, select: { id: true } }),
    ]);

    if (!organization) throw new Error('Travel Allowance organization was not found.');
    if (!requester) throw new Error('The Staff requester was not found in PostgreSQL.');
    if (input.requesterRole === 'staff' && !manager) {
      throw new Error('The assigned Manager was not found in PostgreSQL.');
    }
    if (!director) throw new Error('The assigned Director was not found in PostgreSQL.');

    const projectCodes = [...new Set(input.lines.map((line) => line.projectName))];
    const projects = await transaction.project.findMany({
      where: { organization_id: input.organizationId, code: { in: projectCodes } },
      select: { id: true, code: true },
    });
    const projectIdByCode = new Map(projects.map((project) => [project.code, project.id]));
    const requestNumber = await nextTravelAllowanceNumber(transaction, input.organizationId, new Date(`${input.requestDate}T12:00:00Z`));

    const isManagerRequest = input.requesterRole === 'manager';
    const initialState = isManagerRequest
      ? 'PENDING_DIRECTOR_APPROVAL'
      : 'PENDING_MANAGER_REVIEW';
    const initialAssigneeId = isManagerRequest
      ? input.projectDirectorId
      : input.managerApproverId;

    const record = await transaction.submission.create({
      data: {
        organization_id: input.organizationId,
        payment_type: PaymentType.TRAVEL_ALLOWANCE,
        current_state_code: initialState,
        current_state_group: StateGroup.IN_REVIEW,
        current_assignee_id: initialAssigneeId,
        submission_number: requestNumber,
        submitted_by_id: input.requesterId,
        submitted_at: now,
        total_amount: new Prisma.Decimal(totalAmount.toFixed(2)),
        currency: 'MYR',
        description: `Travel Allowance for ${input.lines.length} travel ${input.lines.length === 1 ? 'entry' : 'entries'}`,
        travel_detail: {
          create: {
            purpose_text: input.remarks,
            travel_start_date: new Date(`${startDate}T12:00:00Z`),
            travel_end_date: new Date(`${endDate}T12:00:00Z`),
            manager_user_id: input.managerApproverId,
            director_user_id: input.projectDirectorId,
          },
        },
        lines: {
          create: input.lines.map((line, index) => ({
            line_number: index + 1,
            description: line.reason,
            amount: new Prisma.Decimal((line.meals.reduce(
              (sum, meal) => sum + (meal === 'BREAKFAST' ? 10 : 20),
              0,
            ) + line.specialAllowance).toFixed(2)),
            project_id: projectIdByCode.get(line.projectName),
          })),
        },
        approval_steps: {
          create: [
            {
              step_number: 1,
              required_role: 'MANAGER',
              assigned_user_id: input.managerApproverId,
              status_code: isManagerRequest ? 'BYPASSED' : 'ACTIVE',
            },
            {
              step_number: 2,
              required_role: 'DIRECTOR',
              assigned_user_id: input.projectDirectorId,
              status_code: isManagerRequest ? 'ACTIVE' : 'PENDING',
            },
          ],
        },
        transitions: {
          create: {
            from_state_code: 'NONE',
            action_code: 'CREATE',
            to_state_code: initialState,
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: input.requesterId,
            metadata_json: { snapshot: input } as Prisma.InputJsonValue,
          },
        },
      },
      include: travelAllowanceInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: input.organizationId,
        submission_id: record.id,
        event_type: 'travel_allowance.submitted',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.requesterId,
        payload_json: {
          requestNumber,
          totalAmount: totalAmount.toFixed(2),
          managerId: input.managerApproverId,
          directorId: input.projectDirectorId,
          requesterRole: input.requesterRole,
        },
      },
    });

    return mapTravelAllowance(record);
  });
}

export async function resubmitTravelAllowanceInDatabase(
  id: string,
  input: CreateTravelAllowanceInput,
) {
  const totalAmount = input.lines.reduce(
    (sum, line) => sum + line.meals.reduce(
      (mealTotal, meal) => mealTotal + (meal === 'BREAKFAST' ? 10 : 20),
      0,
    ) + line.specialAllowance,
    0,
  );
  if (totalAmount <= 0) throw new Error('Travel Allowance total must be greater than RM 0.00.');

  const startDate = [...input.lines].map((line) => line.travelDate).sort()[0];
  const endDate = [...input.lines].map((line) => line.travelDate).sort().at(-1) ?? startDate;

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.submission.findFirst({ where: { id, payment_type: PaymentType.TRAVEL_ALLOWANCE }, include: { approval_steps: true } });
    if (!current) throw new Error('Travel Allowance could not be found.');
    if (current.current_state_code !== 'RETURNED_TO_STAFF') throw new Error('Only a Travel Allowance returned for correction can be edited.');
    if (current.submitted_by_id !== input.requesterId) throw new Error('Only the original requester can edit this Travel Allowance.');

    const [manager, director] = await Promise.all([
      input.managerApproverId ? transaction.user.findUnique({ where: { id: input.managerApproverId }, select: { id: true } }) : Promise.resolve(null),
      transaction.user.findUnique({ where: { id: input.projectDirectorId }, select: { id: true } }),
    ]);
    if (input.requesterRole === 'staff' && !manager) throw new Error('The assigned Manager was not found in PostgreSQL.');
    if (!director) throw new Error('The assigned Director was not found in PostgreSQL.');

    const projectCodes = [...new Set(input.lines.map((line) => line.projectName))];
    const projects = await transaction.project.findMany({ where: { organization_id: current.organization_id, code: { in: projectCodes } }, select: { id: true, code: true } });
    const projectIdByCode = new Map(projects.map((project) => [project.code, project.id]));
    const isManagerRequest = input.requesterRole === 'manager';
    const nextState = isManagerRequest ? 'PENDING_DIRECTOR_APPROVAL' : 'PENDING_MANAGER_REVIEW';
    const nextAssignee = isManagerRequest ? input.projectDirectorId : input.managerApproverId;

    const stepIds = current.approval_steps.map((step) => step.id);
    await transaction.approvalDecision.deleteMany({ where: { approval_step_id: { in: stepIds } } });
    const managerStep = current.approval_steps.find((step) => step.required_role === 'MANAGER');
    const directorStep = current.approval_steps.find((step) => step.required_role === 'DIRECTOR');
    if (!managerStep || !directorStep) throw new Error('Travel Allowance approval steps are incomplete.');
    await transaction.approvalStep.update({ where: { id: managerStep.id }, data: { assigned_user_id: input.managerApproverId, status_code: isManagerRequest ? 'BYPASSED' : 'ACTIVE' } });
    await transaction.approvalStep.update({ where: { id: directorStep.id }, data: { assigned_user_id: input.projectDirectorId, status_code: isManagerRequest ? 'ACTIVE' : 'PENDING' } });

    await transaction.travelAllowanceDetail.update({ where: { submission_id: id }, data: { purpose_text: input.remarks, travel_start_date: new Date(`${startDate}T12:00:00Z`), travel_end_date: new Date(`${endDate}T12:00:00Z`), manager_user_id: input.managerApproverId, director_user_id: input.projectDirectorId, paid_at: null, paid_reference: null } });
    await transaction.submissionLine.deleteMany({ where: { submission_id: id } });
    await transaction.submissionLine.createMany({ data: input.lines.map((line, index) => ({ submission_id: id, line_number: index + 1, description: line.reason, amount: new Prisma.Decimal((line.meals.reduce((sum, meal) => sum + (meal === 'BREAKFAST' ? 10 : 20), 0) + line.specialAllowance).toFixed(2)), project_id: projectIdByCode.get(line.projectName) })) });
    await transaction.submissionTransition.create({ data: { submission_id: id, from_state_code: 'RETURNED_TO_STAFF', action_code: 'RESUBMIT', to_state_code: nextState, actor_type: ActorType.INTERNAL_USER, actor_user_id: input.requesterId, metadata_json: { snapshot: input } as Prisma.InputJsonValue } });
    await transaction.submission.update({ where: { id }, data: { current_state_code: nextState, current_state_group: StateGroup.IN_REVIEW, current_assignee_id: nextAssignee, total_amount: new Prisma.Decimal(totalAmount.toFixed(2)), description: `Travel Allowance for ${input.lines.length} travel ${input.lines.length === 1 ? 'entry' : 'entries'}`, submitted_at: new Date(), closed_at: null } });
    await transaction.auditEvent.create({ data: { organization_id: current.organization_id, submission_id: id, event_type: 'travel_allowance.resubmitted', actor_type: ActorType.INTERNAL_USER, actor_user_id: input.requesterId, payload_json: { requestNumber: current.submission_number, totalAmount: totalAmount.toFixed(2), managerId: input.managerApproverId, directorId: input.projectDirectorId } } });
    return mapTravelAllowance(await transaction.submission.findUniqueOrThrow({ where: { id }, include: travelAllowanceInclude }));
  }, { timeout: 15_000 });
}

export async function reviewTravelAllowanceByManagerInDatabase(
  id: string,
  managerId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.submission.findFirst({
      where: { id, payment_type: PaymentType.TRAVEL_ALLOWANCE },
      include: { travel_detail: true, approval_steps: true },
    });
    if (!current) throw new Error('Travel Allowance could not be found.');
    if (current.current_state_code !== 'PENDING_MANAGER_REVIEW') {
      throw new Error('This Travel Allowance is no longer awaiting Manager review.');
    }
    if (current.current_assignee_id !== managerId) {
      throw new Error('This Travel Allowance is assigned to another Manager.');
    }
    const directorId = current.travel_detail?.director_user_id;
    if (!directorId) throw new Error('The assigned Project Director is missing.');
    const managerStep = current.approval_steps.find(
      (step) => step.required_role === 'MANAGER',
    );
    const directorStep = current.approval_steps.find(
      (step) => step.required_role === 'DIRECTOR',
    );
    if (!managerStep || !directorStep) {
      throw new Error('Travel Allowance approval steps are incomplete.');
    }

    await transaction.approvalDecision.create({
      data: {
        approval_step_id: managerStep.id,
        decision_code: 'APPROVED',
        decided_by_user_id: managerId,
      },
    });
    await transaction.approvalStep.update({
      where: { id: managerStep.id },
      data: { status_code: 'COMPLETE' },
    });
    await transaction.approvalStep.update({
      where: { id: directorStep.id },
      data: { status_code: 'ACTIVE', assigned_user_id: directorId },
    });
    await transaction.submissionTransition.create({
      data: {
        submission_id: current.id,
        from_state_code: current.current_state_code,
        action_code: 'REVIEW_BY_MANAGER',
        to_state_code: 'PENDING_DIRECTOR_APPROVAL',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: managerId,
      },
    });
    await transaction.submission.update({
      where: { id: current.id },
      data: {
        current_state_code: 'PENDING_DIRECTOR_APPROVAL',
        current_assignee_id: directorId,
      },
    });
    await transaction.auditEvent.create({
      data: {
        organization_id: current.organization_id,
        submission_id: current.id,
        event_type: 'travel_allowance.manager_reviewed',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: managerId,
        payload_json: { directorId },
      },
    });

    const updated = await transaction.submission.findUniqueOrThrow({
      where: { id: current.id },
      include: travelAllowanceInclude,
    });
    return mapTravelAllowance(updated);
  });
}

export async function returnTravelAllowanceByManagerInDatabase(
  id: string,
  managerId: string,
  reason: string,
) {
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) {
    throw new Error('Enter a clear reason for returning the request.');
  }

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.submission.findFirst({
      where: { id, payment_type: PaymentType.TRAVEL_ALLOWANCE },
      include: { approval_steps: true },
    });
    if (!current) throw new Error('Travel Allowance could not be found.');
    if (current.current_state_code !== 'PENDING_MANAGER_REVIEW') {
      throw new Error('This Travel Allowance is no longer awaiting Manager review.');
    }
    if (current.current_assignee_id !== managerId) {
      throw new Error('This Travel Allowance is assigned to another Manager.');
    }
    const managerStep = current.approval_steps.find(
      (step) => step.required_role === 'MANAGER',
    );
    if (!managerStep) throw new Error('The Manager approval step is missing.');

    await transaction.approvalDecision.create({
      data: {
        approval_step_id: managerStep.id,
        decision_code: 'REJECTED',
        decided_by_user_id: managerId,
        reason_text: cleanReason,
      },
    });
    await transaction.approvalStep.update({
      where: { id: managerStep.id },
      data: { status_code: 'COMPLETE' },
    });
    await transaction.submissionTransition.create({
      data: {
        submission_id: current.id,
        from_state_code: current.current_state_code,
        action_code: 'RETURN_BY_MANAGER',
        to_state_code: 'RETURNED_TO_STAFF',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: managerId,
        reason_text: cleanReason,
      },
    });
    await transaction.submission.update({
      where: { id: current.id },
      data: {
        current_state_code: 'RETURNED_TO_STAFF',
        current_state_group: StateGroup.REJECTED,
        current_assignee_id: current.submitted_by_id,
      },
    });
    await transaction.auditEvent.create({
      data: {
        organization_id: current.organization_id,
        submission_id: current.id,
        event_type: 'travel_allowance.returned_by_manager',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: managerId,
        payload_json: { reason: cleanReason },
      },
    });

    const updated = await transaction.submission.findUniqueOrThrow({
      where: { id: current.id },
      include: travelAllowanceInclude,
    });
    return mapTravelAllowance(updated);
  });
}

export async function approveTravelAllowanceByDirectorInDatabase(
  id: string,
  directorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.submission.findFirst({
      where: { id, payment_type: PaymentType.TRAVEL_ALLOWANCE },
      include: { approval_steps: true },
    });
    if (!current) throw new Error('Travel Allowance could not be found.');
    if (current.current_state_code !== 'PENDING_DIRECTOR_APPROVAL') {
      throw new Error('This Travel Allowance is no longer awaiting Director approval.');
    }
    if (current.current_assignee_id !== directorId) {
      throw new Error('This Travel Allowance is assigned to another Director.');
    }
    const directorStep = current.approval_steps.find(
      (step) => step.required_role === 'DIRECTOR',
    );
    if (!directorStep) throw new Error('The Director approval step is missing.');

    await transaction.approvalDecision.create({
      data: {
        approval_step_id: directorStep.id,
        decision_code: 'APPROVED',
        decided_by_user_id: directorId,
      },
    });
    await transaction.approvalStep.update({
      where: { id: directorStep.id },
      data: { status_code: 'COMPLETE' },
    });
    await transaction.submissionTransition.create({
      data: {
        submission_id: current.id,
        from_state_code: current.current_state_code,
        action_code: 'APPROVE_BY_DIRECTOR',
        to_state_code: 'PENDING_FINANCE_VERIFICATION',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: directorId,
      },
    });
    await transaction.submission.update({
      where: { id: current.id },
      data: {
        current_state_code: 'PENDING_FINANCE_VERIFICATION',
        current_state_group: StateGroup.PENDING_VERIFICATION,
        current_assignee_id: null,
      },
    });
    await transaction.auditEvent.create({
      data: {
        organization_id: current.organization_id,
        submission_id: current.id,
        event_type: 'travel_allowance.director_approved',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: directorId,
      },
    });

    const updated = await transaction.submission.findUniqueOrThrow({
      where: { id: current.id },
      include: travelAllowanceInclude,
    });
    return mapTravelAllowance(updated);
  });
}

export async function returnTravelAllowanceByDirectorInDatabase(
  id: string,
  directorId: string,
  reason: string,
) {
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) {
    throw new Error('Enter a clear reason for returning the request.');
  }

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.submission.findFirst({
      where: { id, payment_type: PaymentType.TRAVEL_ALLOWANCE },
      include: { approval_steps: true },
    });
    if (!current) throw new Error('Travel Allowance could not be found.');
    if (current.current_state_code !== 'PENDING_DIRECTOR_APPROVAL') {
      throw new Error('This Travel Allowance is no longer awaiting Director approval.');
    }
    if (current.current_assignee_id !== directorId) {
      throw new Error('This Travel Allowance is assigned to another Director.');
    }
    const directorStep = current.approval_steps.find(
      (step) => step.required_role === 'DIRECTOR',
    );
    if (!directorStep) throw new Error('The Director approval step is missing.');

    await transaction.approvalDecision.create({
      data: {
        approval_step_id: directorStep.id,
        decision_code: 'REJECTED',
        decided_by_user_id: directorId,
        reason_text: cleanReason,
      },
    });
    await transaction.approvalStep.update({
      where: { id: directorStep.id },
      data: { status_code: 'COMPLETE' },
    });
    await transaction.submissionTransition.create({
      data: {
        submission_id: current.id,
        from_state_code: current.current_state_code,
        action_code: 'RETURN_BY_DIRECTOR',
        to_state_code: 'RETURNED_TO_STAFF',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: directorId,
        reason_text: cleanReason,
      },
    });
    await transaction.submission.update({
      where: { id: current.id },
      data: {
        current_state_code: 'RETURNED_TO_STAFF',
        current_state_group: StateGroup.REJECTED,
        current_assignee_id: current.submitted_by_id,
      },
    });
    await transaction.auditEvent.create({
      data: {
        organization_id: current.organization_id,
        submission_id: current.id,
        event_type: 'travel_allowance.returned_by_director',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: directorId,
        payload_json: { reason: cleanReason },
      },
    });

    const updated = await transaction.submission.findUniqueOrThrow({
      where: { id: current.id },
      include: travelAllowanceInclude,
    });
    return mapTravelAllowance(updated);
  });
}

export async function completeTravelAllowanceByFinanceInDatabase(
  id: string,
  financeId: string,
  paymentDate: string,
  paymentReference: string,
  remarks?: string,
) {
  const cleanReference = paymentReference.trim();
  if (!paymentDate || !cleanReference) {
    throw new Error('Payment date and payment reference are required.');
  }

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.submission.findFirst({
      where: { id, payment_type: PaymentType.TRAVEL_ALLOWANCE },
    });
    if (!current) throw new Error('Travel Allowance could not be found.');
    if (current.current_state_code !== 'PENDING_FINANCE_VERIFICATION') {
      throw new Error('This Travel Allowance is no longer awaiting Finance verification.');
    }

    await transaction.travelAllowanceDetail.update({
      where: { submission_id: current.id },
      data: {
        paid_at: new Date(`${paymentDate}T12:00:00Z`),
        paid_reference: cleanReference,
      },
    });
    await transaction.submissionTransition.create({
      data: {
        submission_id: current.id,
        from_state_code: current.current_state_code,
        action_code: 'COMPLETE',
        to_state_code: 'COMPLETED',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        metadata_json: {
          paymentDate,
          paymentReference: cleanReference,
          financeRemarks: remarks?.trim() || null,
        },
      },
    });
    await transaction.submission.update({
      where: { id: current.id },
      data: {
        current_state_code: 'COMPLETED',
        current_state_group: StateGroup.COMPLETE,
        current_assignee_id: null,
        closed_at: new Date(),
      },
    });
    await transaction.auditEvent.create({
      data: {
        organization_id: current.organization_id,
        submission_id: current.id,
        event_type: 'travel_allowance.finance_completed',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        payload_json: { paymentDate, paymentReference: cleanReference },
      },
    });

    const updated = await transaction.submission.findUniqueOrThrow({
      where: { id: current.id },
      include: travelAllowanceInclude,
    });
    return mapTravelAllowance(updated);
  });
}

export async function returnTravelAllowanceByFinanceInDatabase(
  id: string,
  financeId: string,
  reason: string,
) {
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) {
    throw new Error('Enter a clear reason for returning the request.');
  }

  return prisma.$transaction(async (transaction) => {
    const current = await transaction.submission.findFirst({
      where: { id, payment_type: PaymentType.TRAVEL_ALLOWANCE },
    });
    if (!current) throw new Error('Travel Allowance could not be found.');
    if (current.current_state_code !== 'PENDING_FINANCE_VERIFICATION') {
      throw new Error('This Travel Allowance is no longer awaiting Finance verification.');
    }

    await transaction.submissionTransition.create({
      data: {
        submission_id: current.id,
        from_state_code: current.current_state_code,
        action_code: 'RETURN_BY_FINANCE',
        to_state_code: 'RETURNED_TO_STAFF',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        reason_text: cleanReason,
      },
    });
    await transaction.submission.update({
      where: { id: current.id },
      data: {
        current_state_code: 'RETURNED_TO_STAFF',
        current_state_group: StateGroup.REJECTED,
        current_assignee_id: current.submitted_by_id,
      },
    });
    await transaction.auditEvent.create({
      data: {
        organization_id: current.organization_id,
        submission_id: current.id,
        event_type: 'travel_allowance.returned_by_finance',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        payload_json: { reason: cleanReason },
      },
    });

    const updated = await transaction.submission.findUniqueOrThrow({
      where: { id: current.id },
      include: travelAllowanceInclude,
    });
    return mapTravelAllowance(updated);
  });
}

import { PaymentType, Prisma } from '@prisma/client';

import type {
  DashboardSummaryPaymentType,
  DashboardSummaryRecord,
} from '@/domain/dashboard/types';
import { prisma } from '@/lib/db/prisma';

type DashboardScope = {
  role: 'staff' | 'manager' | 'director' | 'finance';
  userId: string;
  view?: 'ROLE' | 'ORGANIZATION_COMPLETED';
};

const supportedTypes = [
  PaymentType.PAYMENT_VOUCHER,
  PaymentType.INVOICE_PAYMENT,
  PaymentType.TRAVEL_ALLOWANCE,
  PaymentType.CASH_ADVANCE,
  PaymentType.PETTY_CASH_TOPUP,
  PaymentType.EXPENSE_CLAIM,
  PaymentType.INTERNET_COMMUTE_CLAIM,
  PaymentType.MEDICAL_CLAIM,
  PaymentType.MILEAGE_CLAIM,
  PaymentType.PD_CLAIM,
  PaymentType.TECH_CLAIM,
];

const claimTypes: PaymentType[] = [
  PaymentType.EXPENSE_CLAIM,
  PaymentType.INTERNET_COMMUTE_CLAIM,
  PaymentType.MEDICAL_CLAIM,
  PaymentType.MILEAGE_CLAIM,
  PaymentType.PD_CLAIM,
  PaymentType.TECH_CLAIM,
];

const select = {
  id: true,
  submission_number: true,
  payment_type: true,
  current_state_code: true,
  current_assignee_id: true,
  submitted_by_id: true,
  total_amount: true,
  updated_at: true,
  submitted_by: { select: { name: true } },
  approval_steps: { select: { assigned_user_id: true } },
  transitions: {
    where: { action_code: { in: ['MANAGER_PREVIEW', 'APPROVE_BY_MANAGER', 'FORWARD_BY_DIRECTOR', 'ISSUE_RECIPIENT_LINK', 'RETURN_SIGNED_PV'] } },
    select: { action_code: true, created_at: true },
  },
} satisfies Prisma.SubmissionSelect;

type StoredSummary = Prisma.SubmissionGetPayload<{ select: typeof select }>;

function normalizedType(type: PaymentType): DashboardSummaryPaymentType {
  if (type === PaymentType.PETTY_CASH_TOPUP) return 'PETTY_CASH';
  if (claimTypes.includes(type)) return 'EXPENSE_CLAIM';
  return type as DashboardSummaryPaymentType;
}

function fallbackReference(record: StoredSummary) {
  const prefixes: Record<DashboardSummaryPaymentType, string> = {
    PAYMENT_VOUCHER: 'PV',
    INVOICE_PAYMENT: 'IV',
    TRAVEL_ALLOWANCE: 'TA',
    CASH_ADVANCE: 'CA',
    PETTY_CASH: 'PC',
    EXPENSE_CLAIM: 'CL',
  };
  return `${prefixes[normalizedType(record.payment_type)]}-DRAFT-${record.id.slice(-6)}`;
}

function roleWhere(scope: DashboardScope): Prisma.SubmissionWhereInput {
  if (scope.view === 'ORGANIZATION_COMPLETED') {
    return { current_state_code: { in: ['COMPLETED', 'COMPLETE', 'CLOSED', 'PAID'] } };
  }
  if (scope.role === 'finance') return {};
  if (scope.role === 'staff') return { submitted_by_id: scope.userId };
  return {
    OR: [
      { current_assignee_id: scope.userId },
      { approval_steps: { some: { assigned_user_id: scope.userId } } },
      { submitted_by_id: scope.userId },
    ],
  };
}

export async function listDashboardSummaryFromDatabase(scope: DashboardScope) {
  const records = await prisma.submission.findMany({
    where: {
      payment_type: { in: supportedTypes },
      ...roleWhere(scope),
    },
    select,
    orderBy: { updated_at: 'desc' },
    take: 1000,
  });

  return records.map((record): DashboardSummaryRecord => {
    const managerViewed = record.transitions.some((transition) => transition.action_code === 'MANAGER_PREVIEW');
    const claimManagerPreviewed = record.transitions.some((transition) => transition.action_code === 'APPROVE_BY_MANAGER');
    const claimDirectorPreviewed = record.transitions.some((transition) => transition.action_code === 'FORWARD_BY_DIRECTOR');
    const latestLinkIssue = record.transitions
      .filter((transition) => transition.action_code === 'ISSUE_RECIPIENT_LINK')
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0];
    const latestSignatureReturn = record.transitions
      .filter((transition) => transition.action_code === 'RETURN_SIGNED_PV')
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0];
    const recipientLinkIssued = Boolean(
      latestLinkIssue &&
      (!latestSignatureReturn || latestLinkIssue.created_at > latestSignatureReturn.created_at),
    );

    return {
      id: record.id,
      reference: record.submission_number ?? fallbackReference(record),
      paymentType: normalizedType(record.payment_type),
      requesterId: record.submitted_by_id,
      requesterName: record.submitted_by.name,
      status: record.current_state_code,
      amount: Number(record.total_amount),
      updatedAt: record.updated_at.toISOString(),
      currentAssigneeId: record.current_assignee_id ?? undefined,
      approverIds: [...new Set(record.approval_steps.map((step) => step.assigned_user_id).filter((id): id is string => Boolean(id)))],
      managerViewed,
      claimManagerPreviewed,
      claimDirectorPreviewed,
      recipientLinkIssued,
    };
  });
}

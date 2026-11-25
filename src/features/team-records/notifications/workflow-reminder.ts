import { createLocalNotification } from '@/data/notifications/local-notification-store';
import type { TeamRecord } from '@/data/team-records/team-records-api';
import type { NotificationEntityType } from '@/domain/notifications/types';
import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';

export type WorkflowReminderStage = 'APPROVAL' | 'PAYMENT' | 'RECONCILIATION';

const entityType: Record<TeamRecord['paymentType'], NotificationEntityType> = {
  PAYMENT_VOUCHER: 'PAYMENT_VOUCHER',
  INVOICE_PAYMENT: 'INVOICE_PAYMENT',
  TRAVEL_ALLOWANCE: 'TRAVEL_ALLOWANCE',
  CASH_ADVANCE: 'CASH_ADVANCE',
  PETTY_CASH: 'PETTY_CASH',
  EXPENSE_CLAIM: 'EXPENSE_CLAIM',
};

export function workflowReminderAction(record: TeamRecord, stage: WorkflowReminderStage) {
  if (stage === 'RECONCILIATION') return {
    label: 'Remind requester',
    recipientId: record.requesterId,
    recipientLabel: 'requester',
  };
  if (stage === 'PAYMENT') return {
    label: 'Remind Finance',
    recipientId: record.currentAssigneeId ?? betaAccounts.find((account) => account.role === 'finance')?.id,
    recipientLabel: 'Finance',
  };
  if (record.status?.includes('DIRECTOR')) return {
    label: 'Remind Director',
    recipientId: record.currentAssigneeId,
    recipientLabel: 'Director',
  };
  if (record.status?.includes('MANAGER')) return {
    label: 'Remind Manager',
    recipientId: record.currentAssigneeId,
    recipientLabel: 'Manager',
  };
  return {
    label: 'Remind approver',
    recipientId: record.currentAssigneeId,
    recipientLabel: 'approver',
  };
}

export function sendWorkflowReminder({ account, record, stage }: {
  account: BetaAccount;
  record: TeamRecord;
  stage: WorkflowReminderStage;
}) {
  const { recipientId, recipientLabel } = workflowReminderAction(record, stage);
  if (!recipientId) {
    throw new Error(`No ${recipientLabel} is assigned to this request.`);
  }
  if (!betaAccounts.some((candidate) => candidate.id === recipientId)) {
    throw new Error(`The assigned ${recipientLabel} is not an active beta account.`);
  }
  if (recipientId === account.id) throw new Error('This workflow stage is already assigned to you.');
  const stageName = stage === 'RECONCILIATION' ? 'reconciliation' : stage === 'PAYMENT' ? 'payment' : 'approval';
  return createLocalNotification({
    recipientId,
    actorId: account.id,
    type: 'GENERAL',
    entityType: entityType[record.paymentType],
    entityId: record.id,
    referenceNumber: record.reference,
    title: `${record.reference} needs your ${stageName} action`,
    message: `${account.name} sent a reminder for ${record.reference}. Please review the pending ${stageName} step.`,
    href: record.href,
  });
}

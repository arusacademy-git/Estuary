import { createLocalNotification } from '@/data/notifications/local-notification-store';
import type { TeamRecord } from '@/data/team-records/team-records-api';
import type { NotificationEntityType } from '@/domain/notifications/types';
import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';

type WorkflowStage = 'APPROVAL' | 'PAYMENT' | 'RECONCILIATION';

const entityType: Record<TeamRecord['paymentType'], NotificationEntityType> = {
  PAYMENT_VOUCHER: 'PAYMENT_VOUCHER',
  INVOICE_PAYMENT: 'INVOICE_PAYMENT',
  TRAVEL_ALLOWANCE: 'TRAVEL_ALLOWANCE',
  CASH_ADVANCE: 'CASH_ADVANCE',
  PETTY_CASH: 'PETTY_CASH',
  EXPENSE_CLAIM: 'EXPENSE_CLAIM',
};

export function workflowReminderAction(record: TeamRecord, stage: WorkflowStage) {
  if (stage === 'RECONCILIATION') return { label: 'Remind requester', recipientId: record.requesterId };
  if (stage === 'PAYMENT') return {
    label: 'Remind Finance',
    recipientId: record.currentAssigneeId ?? betaAccounts.find((account) => account.role === 'finance')?.id,
  };
  return { label: 'Remind approver', recipientId: record.currentAssigneeId };
}

export function sendWorkflowReminder({ account, record, stage }: {
  account: BetaAccount;
  record: TeamRecord;
  stage: WorkflowStage;
}) {
  const { recipientId } = workflowReminderAction(record, stage);
  if (!recipientId || !betaAccounts.some((candidate) => candidate.id === recipientId)) {
    throw new Error('No active beta account is assigned to this workflow stage.');
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

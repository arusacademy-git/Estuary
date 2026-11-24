import { describe, expect, it, vi } from 'vitest';
import type { TeamRecord } from '@/data/team-records/team-records-api';
import { getBetaAccount } from '@/lib/auth/beta-accounts';

vi.mock('@/data/notifications/local-notification-store', () => ({ createLocalNotification: vi.fn((input) => input) }));

import { sendWorkflowReminder, workflowReminderAction } from './workflow-reminder';

const record = {
  id: 'claim-1', reference: 'CL-001', paymentType: 'EXPENSE_CLAIM',
  requesterId: 'afiq-rahman', currentAssigneeId: 'nadia-hassan',
  href: '/beta/payment-records/claims/claim-1',
} as TeamRecord;

describe('workflow reminders', () => {
  it('targets the assigned approver, Finance, and requester for their respective stages', () => {
    expect(workflowReminderAction(record, 'APPROVAL').recipientId).toBe('nadia-hassan');
    expect(workflowReminderAction({ ...record, currentAssigneeId: undefined }, 'PAYMENT').recipientId).toBe('siti-farhana');
    expect(workflowReminderAction(record, 'RECONCILIATION').recipientId).toBe('afiq-rahman');
  });

  it('creates a reminder linked to the exact record and rejects an unassigned stage', () => {
    const account = getBetaAccount('daniel-lee')!;
    expect(sendWorkflowReminder({ account, record, stage: 'APPROVAL' })).toMatchObject({
      recipientId: 'nadia-hassan', entityType: 'EXPENSE_CLAIM', entityId: 'claim-1', href: record.href,
    });
    expect(() => sendWorkflowReminder({ account, record: { ...record, currentAssigneeId: undefined }, stage: 'APPROVAL' })).toThrow('No active beta account');
  });
});

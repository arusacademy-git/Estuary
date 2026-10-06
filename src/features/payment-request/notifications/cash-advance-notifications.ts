import { createLocalNotification } from '@/data/notifications/local-notification-store';
import type { CreateNotificationInput } from '@/domain/notifications/types';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';

function createSafely(input: CreateNotificationInput) { try { createLocalNotification(input); } catch (error) { console.error('The Cash Advance changed, but its notification could not be created.', error); } }
const staffHref = (record: CashAdvanceRecord) => `/beta/payment-records/cash-advances/${encodeURIComponent(record.requestNumber)}`;

export function notifyCashAdvanceSubmitted(record: CashAdvanceRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.managerApproverId, actorId: actor.id, type: 'CASH_ADVANCE_SUBMITTED', entityType: 'CASH_ADVANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Cash Advance requires review', message: `${actor.name} submitted ${record.requestNumber}. Manager approval is required.`, href: `/beta/project-manager/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}` });
}
export function notifyCashAdvanceManagerApproved(record: CashAdvanceRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.directorApproverId, actorId: actor.id, type: 'CASH_ADVANCE_MANAGER_APPROVED', entityType: 'CASH_ADVANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Cash Advance requires Director approval', message: `${actor.name} approved ${record.requestNumber}. Director approval is required.`, href: `/beta/director/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}` });
}
export function notifyCashAdvanceDirectorApproved(record: CashAdvanceRecord, actor: BetaAccount) {
  betaAccounts.filter((item) => item.role === 'finance').forEach((finance) => createSafely({ recipientId: finance.id, actorId: actor.id, type: 'CASH_ADVANCE_DIRECTOR_APPROVED', entityType: 'CASH_ADVANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Cash Advance requires payment', message: `${actor.name} approved ${record.requestNumber}. Finance payment is required.`, href: `/beta/finance/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}` }));
}
export function notifyCashAdvanceReturned(record: CashAdvanceRecord, actor: BetaAccount, stage: 'Manager' | 'Director' | 'Finance' | 'Finance reconciliation') {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'CASH_ADVANCE_RETURNED', entityType: 'CASH_ADVANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Cash Advance returned for correction', message: `${stage} returned ${record.requestNumber}. Review the correction notes before resubmitting.`, href: staffHref(record) });
}
export function notifyCashAdvancePaid(record: CashAdvanceRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'CASH_ADVANCE_PAID', entityType: 'CASH_ADVANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Cash Advance paid — reconciliation required', message: `Finance recorded payment for ${record.requestNumber}. Submit the Cash Advance reconciliation after spending.`, href: staffHref(record) });
}
export function notifyCashAdvanceReconciliationSubmitted(record: CashAdvanceRecord, actor: BetaAccount) {
  betaAccounts.filter((item) => item.role === 'finance').forEach((finance) => createSafely({ recipientId: finance.id, actorId: actor.id, type: 'CASH_ADVANCE_RECONCILIATION_SUBMITTED', entityType: 'CASH_ADVANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Cash Advance reconciliation requires review', message: `${actor.name} submitted the reconciliation for ${record.requestNumber}.`, href: `/beta/finance/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}` }));
}
export function notifyCashAdvanceCompleted(record: CashAdvanceRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'CASH_ADVANCE_COMPLETED', entityType: 'CASH_ADVANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Cash Advance completed', message: `${record.requestNumber} reconciliation was verified and the Cash Advance is complete.`, href: staffHref(record) });
}

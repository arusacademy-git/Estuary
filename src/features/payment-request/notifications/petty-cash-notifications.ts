import { createLocalNotification } from '@/data/notifications/local-notification-store';
import type { CreateNotificationInput } from '@/domain/notifications/types';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';

function createSafely(input: CreateNotificationInput) { try { createLocalNotification(input); } catch (error) { console.error('The Petty Cash request changed, but its notification could not be created.', error); } }
const recordHref = (record: PettyCashRecord) => `/beta/payment-records/petty-cash/${encodeURIComponent(record.requestNumber)}`;
export function notifyPettyCashSubmitted(record: PettyCashRecord, actor: BetaAccount) {
  if (record.managerApproverId && record.managerApproverId !== record.requesterId) createSafely({ recipientId: record.managerApproverId, actorId: actor.id, type: 'PETTY_CASH_SUBMITTED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request available for optional review', message: `${actor.name} submitted ${record.requestNumber}. Your Manager review is optional; Director approval is mandatory.`, href: `/beta/project-manager/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` });
  createSafely({ recipientId: record.directorApproverId, actorId: actor.id, type: 'PETTY_CASH_SUBMITTED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request requires approval', message: `${actor.name} submitted ${record.requestNumber}. Finance cannot release the money until you approve it.`, href: `/beta/director/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` });
}
export function notifyPettyCashManagerApproved(record: PettyCashRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'PETTY_CASH_MANAGER_APPROVED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Manager preview recorded', message: `${actor.name} previewed ${record.requestNumber}. Finance processing continues independently.`, href: recordHref(record) });
}
export function notifyPettyCashDirectorApproved(record: PettyCashRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'PETTY_CASH_DIRECTOR_APPROVED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash approved by Director', message: `${actor.name} approved ${record.requestNumber}. It is now available for Finance payment.`, href: recordHref(record) });
  betaAccounts.filter((item) => item.role === 'finance').forEach((finance) => createSafely({ recipientId: finance.id, actorId: actor.id, type: 'PETTY_CASH_DIRECTOR_APPROVED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash ready for payment', message: `${record.requestNumber} received mandatory Director approval and is ready for fund release.`, href: `/beta/finance/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` }));
}
export function notifyPettyCashFinancePeerReviewed(record: PettyCashRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'PETTY_CASH_FINANCE_REVIEWED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Independent preview recorded', message: `${actor.name} previewed ${record.requestNumber}. Finance processing continues independently.`, href: recordHref(record) });
}
export function notifyPettyCashReturned(record: PettyCashRecord, actor: BetaAccount, stage: 'Manager' | 'Director' | 'Finance') {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'PETTY_CASH_RETURNED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request returned', message: `${stage} returned ${record.requestNumber}. Review the correction notes before resubmitting.`, href: recordHref(record) });
}
export function notifyPettyCashFinanceVerified(record: PettyCashRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'PETTY_CASH_FINANCE_VERIFIED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash payment information verified', message: `Finance verified payment information for ${record.requestNumber}. Final paid confirmation is pending.`, href: recordHref(record) });
}
export function notifyPettyCashPaid(record: PettyCashRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'PETTY_CASH_PAID', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash released — reconciliation required', message: `${record.requestNumber} was paid. Give the purchase receipts and any unused balance to Finance for reconciliation.`, href: recordHref(record) });
}

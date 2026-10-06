import { createLocalNotification } from '@/data/notifications/local-notification-store';
import type { CreateNotificationInput } from '@/domain/notifications/types';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';

function createSafely(input: CreateNotificationInput) { try { createLocalNotification(input); } catch (error) { console.error('The Petty Cash request changed, but its notification could not be created.', error); } }
const recordHref = (record: PettyCashRecord) => `/beta/payment-records/petty-cash/${encodeURIComponent(record.requestNumber)}`;
export function notifyPettyCashSubmitted(record: PettyCashRecord, actor: BetaAccount) {
  if (record.status === 'PENDING_MANAGER_APPROVAL') {
    createSafely({ recipientId: record.managerApproverId, actorId: actor.id, type: 'PETTY_CASH_SUBMITTED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request requires review', message: `${actor.name} submitted ${record.requestNumber}. Manager review is required.`, href: `/beta/project-manager/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` });
    return;
  }
  if (record.status === 'PENDING_DIRECTOR_APPROVAL') {
    createSafely({ recipientId: record.directorApproverId, actorId: actor.id, type: 'PETTY_CASH_SUBMITTED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request requires Director preview', message: `${actor.name} submitted ${record.requestNumber}. Director preview is required.`, href: `/beta/director/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` });
    return;
  }
  if (record.status === 'PENDING_FINANCE_REVIEW' && record.financeReviewerId) {
    createSafely({ recipientId: record.financeReviewerId, actorId: actor.id, type: 'PETTY_CASH_SUBMITTED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request requires independent review', message: `${actor.name} submitted ${record.requestNumber}. Your independent Finance review is required.`, href: `/beta/finance/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` });
    return;
  }
  betaAccounts.filter((item) => item.role === 'finance').forEach((finance) => createSafely({ recipientId: finance.id, actorId: actor.id, type: 'PETTY_CASH_SUBMITTED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request requires processing', message: `${actor.name} submitted ${record.requestNumber}. Finance processing is required.`, href: `/beta/finance/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` }));
}
export function notifyPettyCashManagerApproved(record: PettyCashRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.directorApproverId, actorId: actor.id, type: 'PETTY_CASH_MANAGER_APPROVED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request requires Director preview', message: `${actor.name} reviewed ${record.requestNumber}. Director preview is required.`, href: `/beta/director/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` });
}
export function notifyPettyCashDirectorApproved(record: PettyCashRecord, actor: BetaAccount) {
  betaAccounts.filter((item) => item.role === 'finance').forEach((finance) => createSafely({ recipientId: finance.id, actorId: actor.id, type: 'PETTY_CASH_DIRECTOR_APPROVED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request requires payment', message: `${actor.name} previewed ${record.requestNumber}. Finance processing is required.`, href: `/beta/finance/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` }));
}
export function notifyPettyCashFinancePeerReviewed(record: PettyCashRecord, actor: BetaAccount) {
  betaAccounts.filter((item) => item.role === 'finance').forEach((finance) => createSafely({ recipientId: finance.id, actorId: actor.id, type: 'PETTY_CASH_FINANCE_REVIEWED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request requires processing', message: `${actor.name} independently reviewed ${record.requestNumber}. Finance processing is required.`, href: `/beta/finance/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}` }));
}
export function notifyPettyCashReturned(record: PettyCashRecord, actor: BetaAccount, stage: 'Manager' | 'Director' | 'Finance') {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'PETTY_CASH_RETURNED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request returned', message: `${stage} returned ${record.requestNumber}. Review the correction notes before resubmitting.`, href: recordHref(record) });
}
export function notifyPettyCashFinanceVerified(record: PettyCashRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'PETTY_CASH_FINANCE_VERIFIED', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash payment information verified', message: `Finance verified payment information for ${record.requestNumber}. Final paid confirmation is pending.`, href: recordHref(record) });
}
export function notifyPettyCashPaid(record: PettyCashRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'PETTY_CASH_PAID', entityType: 'PETTY_CASH', entityId: record.id, referenceNumber: record.requestNumber, title: 'Petty Cash request paid', message: `${record.requestNumber} was marked paid and recorded in the Petty Cash ledger.`, href: recordHref(record) });
}

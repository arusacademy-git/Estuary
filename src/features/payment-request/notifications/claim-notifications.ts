import { createLocalNotification } from '@/data/notifications/local-notification-store';
import type { CreateNotificationInput } from '@/domain/notifications/types';
import type { ClaimRecord } from '@/domain/payment-requests/claims/types';
import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';

function createSafely(input: CreateNotificationInput) { try { createLocalNotification(input); } catch (error) { console.error('The Claim changed, but its notification could not be created.', error); } }
const recordHref = (record: ClaimRecord) => `/beta/payment-records/claims/${encodeURIComponent(record.claimNumber)}`;
function notifyFinance(record: ClaimRecord, actor: BetaAccount, type: 'CLAIM_SUBMITTED' | 'CLAIM_DIRECTOR_FORWARDED') {
  const recipients = record.requesterRole === 'finance'
    ? betaAccounts.filter((item) => item.id === record.requesterId)
    : betaAccounts.filter((item) => item.role === 'finance');
  recipients.forEach((finance) => createSafely({ recipientId: finance.id, actorId: actor.id, type, entityType: 'EXPENSE_CLAIM', entityId: record.id, referenceNumber: record.claimNumber, title: 'Claim requires Finance processing', message: `${record.claimNumber} is ready for Finance payment processing.`, href: `/beta/finance/payment-requests/claims/${encodeURIComponent(record.claimNumber)}` }));
}
export function notifyClaimSubmitted(record: ClaimRecord, actor: BetaAccount) {
  if (record.status === 'PENDING_MANAGER_APPROVAL') createSafely({ recipientId: record.managerApproverId ?? '', actorId: actor.id, type: 'CLAIM_SUBMITTED', entityType: 'EXPENSE_CLAIM', entityId: record.id, referenceNumber: record.claimNumber, title: 'Claim requires Manager review', message: `${actor.name} submitted ${record.claimNumber}. Manager review is required.`, href: `/beta/project-manager/payment-requests/claims/${encodeURIComponent(record.claimNumber)}` });
  else if (record.status === 'PENDING_DIRECTOR_APPROVAL') createSafely({ recipientId: record.directorApproverId ?? '', actorId: actor.id, type: 'CLAIM_SUBMITTED', entityType: 'EXPENSE_CLAIM', entityId: record.id, referenceNumber: record.claimNumber, title: 'Claim requires Director preview', message: `${actor.name} submitted ${record.claimNumber}. Director preview is required.`, href: `/beta/director/payment-requests/claims/${encodeURIComponent(record.claimNumber)}` });
  else if (record.status === 'PENDING_FINANCE_PROCESSING') {
    if (record.managerApproverId) createSafely({ recipientId: record.managerApproverId, actorId: actor.id, type: 'CLAIM_SUBMITTED', entityType: 'EXPENSE_CLAIM', entityId: record.id, referenceNumber: record.claimNumber, title: 'Claim available for Manager preview', message: `${actor.name} submitted ${record.claimNumber}. This preview is informational and does not block Finance.`, href: `/beta/project-manager/payment-requests/claims/${encodeURIComponent(record.claimNumber)}` });
    if (record.directorApproverId) createSafely({ recipientId: record.directorApproverId, actorId: actor.id, type: 'CLAIM_SUBMITTED', entityType: 'EXPENSE_CLAIM', entityId: record.id, referenceNumber: record.claimNumber, title: 'Claim available for Director preview', message: `${actor.name} submitted ${record.claimNumber}. This preview is informational and does not block Finance.`, href: `/beta/director/payment-requests/claims/${encodeURIComponent(record.claimNumber)}` });
    notifyFinance(record, actor, 'CLAIM_SUBMITTED');
  }
}
export function notifyClaimManagerApproved(record: ClaimRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'CLAIM_MANAGER_APPROVED', entityType: 'EXPENSE_CLAIM', entityId: record.id, referenceNumber: record.claimNumber, title: 'Manager preview recorded', message: `${actor.name} completed the informational preview for ${record.claimNumber}. Finance processing continues independently.`, href: recordHref(record) });
}
export function notifyClaimDirectorForwarded(record: ClaimRecord, actor: BetaAccount) { createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'CLAIM_DIRECTOR_FORWARDED', entityType: 'EXPENSE_CLAIM', entityId: record.id, referenceNumber: record.claimNumber, title: 'Director preview recorded', message: `${actor.name} completed the informational preview for ${record.claimNumber}. Finance processing continues independently.`, href: recordHref(record) }); }
export function notifyClaimReturned(record: ClaimRecord, actor: BetaAccount, stage: 'Manager' | 'Director' | 'Finance') {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'CLAIM_RETURNED', entityType: 'EXPENSE_CLAIM', entityId: record.id, referenceNumber: record.claimNumber, title: 'Claim returned for correction', message: `${stage} returned ${record.claimNumber}. Review the correction notes before resubmitting.`, href: recordHref(record) });
}
export function notifyClaimPaid(record: ClaimRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'CLAIM_PAID', entityType: 'EXPENSE_CLAIM', entityId: record.id, referenceNumber: record.claimNumber, title: 'Claim paid', message: `${record.claimNumber} was processed by Finance and marked paid.`, href: recordHref(record) });
}

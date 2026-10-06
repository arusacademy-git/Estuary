import { createLocalNotification } from '@/data/notifications/local-notification-store';
import type { CreateNotificationInput } from '@/domain/notifications/types';
import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';

function createSafely(input: CreateNotificationInput) {
  try { createLocalNotification(input); }
  catch (error) { console.error('The Travel Allowance changed, but its notification could not be created.', error); }
}

export function notifyTravelAllowanceSubmitted(record: TravelAllowanceRecord, actor: BetaAccount) {
  const managerStage = record.status === 'PENDING_MANAGER_REVIEW';
  createSafely({
    recipientId: managerStage ? record.managerApproverId ?? '' : record.projectDirectorId,
    actorId: actor.id, type: 'TRAVEL_ALLOWANCE_SUBMITTED', entityType: 'TRAVEL_ALLOWANCE',
    entityId: record.id, referenceNumber: record.requestNumber,
    title: managerStage ? 'Travel Allowance requires review' : 'Travel Allowance requires Director approval',
    message: `${actor.name} submitted ${record.requestNumber}. ${managerStage ? 'Manager review' : 'Director approval'} is required.`,
    href: managerStage ? `/beta/project-manager/payment-requests/travel-allowances/${record.id}` : `/beta/director/payment-requests/travel-allowances/${record.id}`,
  });
}

export function notifyTravelAllowanceManagerApproved(record: TravelAllowanceRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.projectDirectorId, actorId: actor.id, type: 'TRAVEL_ALLOWANCE_MANAGER_APPROVED', entityType: 'TRAVEL_ALLOWANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Travel Allowance requires Director approval', message: `${actor.name} reviewed ${record.requestNumber}. Director approval is required.`, href: `/beta/director/payment-requests/travel-allowances/${record.id}` });
}

export function notifyTravelAllowanceDirectorApproved(record: TravelAllowanceRecord, actor: BetaAccount) {
  betaAccounts.filter((item) => item.role === 'finance').forEach((finance) => createSafely({ recipientId: finance.id, actorId: actor.id, type: 'TRAVEL_ALLOWANCE_DIRECTOR_APPROVED', entityType: 'TRAVEL_ALLOWANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Travel Allowance requires Finance verification', message: `${actor.name} approved ${record.requestNumber}. Finance verification is required.`, href: `/beta/finance/payment-requests/travel-allowances/${record.id}` }));
}

export function notifyTravelAllowanceReturned(record: TravelAllowanceRecord, actor: BetaAccount, stage: 'Manager' | 'Director' | 'Finance') {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'TRAVEL_ALLOWANCE_RETURNED', entityType: 'TRAVEL_ALLOWANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Travel Allowance returned for correction', message: `${stage} returned ${record.requestNumber}. Review the correction notes before resubmitting.`, href: `/beta/payment-records/travel-allowances/${record.id}` });
}

export function notifyTravelAllowanceCompleted(record: TravelAllowanceRecord, actor: BetaAccount) {
  createSafely({ recipientId: record.requesterId, actorId: actor.id, type: 'TRAVEL_ALLOWANCE_COMPLETED', entityType: 'TRAVEL_ALLOWANCE', entityId: record.id, referenceNumber: record.requestNumber, title: 'Travel Allowance completed', message: `${record.requestNumber} was verified by Finance and marked completed.`, href: `/beta/payment-records/travel-allowances/${record.id}` });
}

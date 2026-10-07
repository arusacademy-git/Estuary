import { fetchDashboardSummary } from '@/data/dashboard/api';
import type { DashboardSummaryRecord } from '@/domain/dashboard/types';
import type { BetaAccount } from '@/lib/auth/beta-accounts';

export type SidebarPaymentType =
  | 'PAYMENT_VOUCHER'
  | 'INVOICE_PAYMENT'
  | 'TRAVEL_ALLOWANCE'
  | 'CASH_ADVANCE'
  | 'PETTY_CASH'
  | 'EXPENSE_CLAIM'
  | 'MY_REQUESTS';

export type SidebarActionCounts = Record<SidebarPaymentType, number>;

const emptyCounts: SidebarActionCounts = {
  PAYMENT_VOUCHER: 0,
  INVOICE_PAYMENT: 0,
  TRAVEL_ALLOWANCE: 0,
  CASH_ADVANCE: 0,
  PETTY_CASH: 0,
  EXPENSE_CLAIM: 0,
  MY_REQUESTS: 0,
};

function needsRequesterAction(record: DashboardSummaryRecord, account: BetaAccount) {
  if (record.requesterId !== account.id) return false;

  if (
    record.paymentType === 'PAYMENT_VOUCHER' &&
    record.status === 'AWAITING_RECIPIENT_SIGNATURE'
  ) {
    return !record.recipientLinkIssued;
  }

  return [
    'DRAFT',
    'REJECTED',
    'RETURNED_TO_STAFF',
    'RETURNED_TO_CLAIMANT',
    'AWAITING_STAFF_CONFIRMATION',
    'AWAITING_SIGNED_PV_UPLOAD',
    'AWAITING_STAFF_VERIFICATION',
    'PENDING_RECONCILIATION',
    'PROCESSED_PENDING_RECONCILIATION',
  ].includes(record.status);
}

function needsRoleAction(record: DashboardSummaryRecord, account: BetaAccount) {
  if (account.role === 'staff') {
    return [
      'DRAFT',
      'REJECTED',
      'RETURNED_TO_STAFF',
      'RETURNED_TO_CLAIMANT',
      'AWAITING_STAFF_CONFIRMATION',
      'AWAITING_SIGNED_PV_UPLOAD',
      'AWAITING_STAFF_VERIFICATION',
      'PENDING_RECONCILIATION',
      'PROCESSED_PENDING_RECONCILIATION',
    ].includes(record.status);
  }

  if (account.role === 'manager') {
    if (record.paymentType === 'PAYMENT_VOUCHER') {
      return record.status === 'APPROVED_FOR_PAYMENT'
        && record.approverIds.includes(account.id)
        && !record.managerViewed;
    }
    if (record.paymentType === 'EXPENSE_CLAIM') {
      return record.approverIds.includes(account.id)
        && !record.claimManagerPreviewed
        && !['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status);
    }
    if (record.paymentType === 'PETTY_CASH') {
      return record.approverIds.includes(account.id)
        && !record.claimManagerPreviewed
        && !['DRAFT', 'RETURNED_TO_STAFF'].includes(record.status);
    }
    return ['PENDING_MANAGER_APPROVAL', 'PENDING_MANAGER_REVIEW'].includes(record.status)
      && record.currentAssigneeId === account.id;
  }

  if (account.role === 'director') {
    if (record.paymentType === 'EXPENSE_CLAIM') {
      return record.approverIds.includes(account.id)
        && !record.claimDirectorPreviewed
        && !['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status);
    }
    if (record.paymentType === 'PETTY_CASH') {
      return record.approverIds.includes(account.id)
        && !record.claimDirectorPreviewed
        && !['DRAFT', 'RETURNED_TO_STAFF'].includes(record.status);
    }
    return ['PENDING_DIRECTOR_APPROVAL', 'PENDING_DIRECTOR_REVIEW'].includes(record.status)
      && record.currentAssigneeId === account.id;
  }

  if (record.status === 'PENDING_FINANCE_REVIEW') return record.currentAssigneeId === account.id;

  return [
    'APPROVED_FOR_PAYMENT',
    'FINANCE_PROCESSING',
    'PENDING_FINANCE_VERIFICATION',
    'PENDING_FINANCE_PAYMENT',
    'PENDING_FINANCE_PROCESSING',
    'PENDING_FINANCE_RECONCILIATION',
    'FINANCE_VERIFIED',
    'APPROVED_PENDING_PAYMENT',
    'PENDING_PAYMENT',
    'RECON_PENDING_CHILD_CLOSURE',
  ].includes(record.status);
}

export async function fetchSidebarActionCounts(account: BetaAccount): Promise<SidebarActionCounts> {
  const records = await fetchDashboardSummary({ role: account.role, userId: account.id });
  return records.reduce<SidebarActionCounts>((counts, record) => {
    if (needsRoleAction(record, account)) counts[record.paymentType] += 1;
    if (needsRequesterAction(record, account)) counts.MY_REQUESTS += 1;
    return counts;
  }, { ...emptyCounts });
}

export function createEmptySidebarActionCounts(): SidebarActionCounts {
  return { ...emptyCounts };
}

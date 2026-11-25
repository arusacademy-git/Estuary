import {
  fetchDirectorDashboardSummary,
  fetchDirectorOrganizationDashboardSummary,
} from '@/data/dashboard/api';
import { getPaymentVoucherStatusLabel } from '@/domain/payment-vouchers/status';
import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';
import type { BetaAccount } from '@/lib/auth/beta-accounts';
import { DIVISION_SELECT_OPTIONS } from '@/shared/constants/payment-options';

export type DirectorDashboardType =
  | 'PAYMENT_VOUCHER'
  | 'INVOICE_PAYMENT'
  | 'TRAVEL_ALLOWANCE'
  | 'CASH_ADVANCE'
  | 'PETTY_CASH'
  | 'EXPENSE_CLAIM';

export type DirectorDashboardRecord = {
  id: string;
  reference: string;
  type: DirectorDashboardType;
  typeLabel: string;
  requesterId: string;
  requesterName: string;
  purpose: string;
  status: string;
  statusLabel: string;
  amount: number;
  updatedAt: string;
  projectCode?: string;
  projectName?: string;
  href: string;
};

export type DirectorProjectOption = { value: string; label: string };

export const directorTypeLabels: Record<DirectorDashboardType, string> = {
  PAYMENT_VOUCHER: 'Payment Voucher',
  INVOICE_PAYMENT: 'Invoice Payment',
  TRAVEL_ALLOWANCE: 'Travel Allowance',
  CASH_ADVANCE: 'Cash Advance',
  PETTY_CASH: 'Petty Cash',
  EXPENSE_CLAIM: 'Claims',
};

export const directorTypeCodes: Record<DirectorDashboardType, string> = {
  PAYMENT_VOUCHER: 'PV',
  INVOICE_PAYMENT: 'INV',
  TRAVEL_ALLOWANCE: 'TA',
  CASH_ADVANCE: 'CA',
  PETTY_CASH: 'PC',
  EXPENSE_CLAIM: 'CL',
};

export const directorCompletedStatuses = new Set([
  'COMPLETED',
  'PAID',
  'RECONCILED',
  'CLOSED',
]);

export const directorReturnedStatuses = new Set([
  'REJECTED',
  'PAYMENT_REJECTED',
  'RETURNED_TO_STAFF',
  'RETURNED_TO_CLAIMANT',
]);

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function directorRecordHref(type: DirectorDashboardType, id: string) {
  const segment: Record<DirectorDashboardType, string> = {
    PAYMENT_VOUCHER: 'payment-vouchers',
    INVOICE_PAYMENT: 'director/payment-requests/invoice-payments',
    TRAVEL_ALLOWANCE: 'director/payment-requests/travel-allowances',
    CASH_ADVANCE: 'director/payment-requests/cash-advance',
    PETTY_CASH: 'director/payment-requests/petty-cash',
    EXPENSE_CLAIM: 'director/payment-requests/claims',
  };
  return `/beta/${segment[type]}/${encodeURIComponent(id)}`;
}

export function directorNeedsApproval(record: DirectorDashboardRecord) {
  return ['PENDING_DIRECTOR_APPROVAL', 'PENDING_DIRECTOR_REVIEW'].includes(
    record.status
  );
}

export function directorRequesterAction(record: DirectorDashboardRecord) {
  return (
    directorReturnedStatuses.has(record.status) ||
    [
      'PENDING_RECONCILIATION',
      'PROCESSED_PENDING_RECONCILIATION',
      'AWAITING_RECIPIENT_SIGNATURE',
      'AWAITING_STAFF_CONFIRMATION',
    ].includes(record.status)
  );
}

export async function fetchDirectorDashboard(account: BetaAccount) {
  const [records, organizationRecords] = await Promise.all([
    fetchDirectorDashboardSummary(account.id),
    fetchDirectorOrganizationDashboardSummary(account.id),
  ]);

  const mapRecord = (
    record: (typeof records)[number]
  ): DirectorDashboardRecord => ({
    id: record.id,
    reference: record.reference,
    type: record.paymentType,
    typeLabel: directorTypeLabels[record.paymentType],
    requesterId: record.requesterId,
    requesterName: record.requesterName,
    purpose: record.projectName ?? directorTypeLabels[record.paymentType],
    status: record.status,
    statusLabel:
      record.paymentType === 'PAYMENT_VOUCHER'
        ? getPaymentVoucherStatusLabel(
            record.status as PaymentVoucherRecord['status']
          )
        : titleCase(record.status),
    amount: record.amount,
    updatedAt: record.updatedAt,
    projectCode: record.projectCode,
    projectName: record.projectName,
    href: directorRecordHref(record.paymentType, record.id),
  });

  return {
    records: records.map(mapRecord),
    organizationRecords: organizationRecords.map(mapRecord),
    projects: DIVISION_SELECT_OPTIONS.map<DirectorProjectOption>((project) => ({
      value: project.value,
      label: project.label,
    })),
  };
}

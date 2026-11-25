import { fetchStaffDashboardSummary } from '@/data/dashboard/api';
import type { DashboardSummaryPaymentType } from '@/domain/dashboard/types';
import { standardPaymentStatusLabel } from '@/domain/payment-requests/standard-payment-status';
import type { BetaAccount } from '@/lib/auth/beta-accounts';

export type StaffDashboardType = DashboardSummaryPaymentType;

export type StaffDashboardRecord = {
  id: string;
  type: StaffDashboardType;
  typeLabel: string;
  reference: string;
  requesterName: string;
  status: string;
  statusLabel: string;
  amount: number;
  updatedAt: string;
  href: string;
};

export const staffTypeOrder: StaffDashboardType[] = [
  'PAYMENT_VOUCHER',
  'INVOICE_PAYMENT',
  'TRAVEL_ALLOWANCE',
  'CASH_ADVANCE',
  'PETTY_CASH',
  'EXPENSE_CLAIM',
];

export const staffTypeCodes: Record<StaffDashboardType, string> = {
  PAYMENT_VOUCHER: 'PV',
  INVOICE_PAYMENT: 'INV',
  TRAVEL_ALLOWANCE: 'TA',
  CASH_ADVANCE: 'CA',
  PETTY_CASH: 'PC',
  EXPENSE_CLAIM: 'CL',
};

export const staffTypeLabels: Record<StaffDashboardType, string> = {
  PAYMENT_VOUCHER: 'Payment Vouchers',
  INVOICE_PAYMENT: 'Invoice Payments',
  TRAVEL_ALLOWANCE: 'Travel Allowances',
  CASH_ADVANCE: 'Cash Advances',
  PETTY_CASH: 'Petty Cash',
  EXPENSE_CLAIM: 'Claims',
};

const singularTypeLabels: Record<StaffDashboardType, string> = {
  PAYMENT_VOUCHER: 'Payment Voucher',
  INVOICE_PAYMENT: 'Invoice Payment',
  TRAVEL_ALLOWANCE: 'Travel Allowance',
  CASH_ADVANCE: 'Cash Advance',
  PETTY_CASH: 'Petty Cash',
  EXPENSE_CLAIM: 'Claim',
};

export const staffCompletedStatuses = new Set([
  'COMPLETED',
  'COMPLETE',
  'CLOSED',
  'PAID',
  'RECONCILED',
]);

export const staffReturnedStatuses = new Set([
  'REJECTED',
  'PAYMENT_REJECTED',
  'RETURNED_TO_STAFF',
  'RETURNED_TO_CLAIMANT',
]);

const staffActionStatuses = new Set([
  'DRAFT',
  ...staffReturnedStatuses,
  'AWAITING_STAFF_CONFIRMATION',
  'AWAITING_SIGNED_PV_UPLOAD',
  'AWAITING_STAFF_VERIFICATION',
  'PENDING_RECONCILIATION',
  'PROCESSED_PENDING_RECONCILIATION',
]);

export function staffNeedsAction(record: StaffDashboardRecord) {
  return staffActionStatuses.has(record.status);
}

export function staffRequestsHref(
  type?: StaffDashboardType,
  summary?: 'ACTION' | 'PROGRESS' | 'COMPLETED',
) {
  const query = new URLSearchParams({ scope: 'mine' });
  if (type) query.set('type', type === 'EXPENSE_CLAIM' ? 'CLAIM' : type);
  if (summary) query.set('summary', summary);
  return `/beta/payment-records?${query.toString()}`;
}

export async function fetchStaffDashboardRecords(account: BetaAccount): Promise<StaffDashboardRecord[]> {
  const records = await fetchStaffDashboardSummary(account.id);
  return records
    .filter((record) => record.requesterId === account.id)
    .map((record) => {
      const type = record.paymentType;
      const query = new URLSearchParams({
        scope: 'mine',
        type: type === 'EXPENSE_CLAIM' ? 'CLAIM' : type,
        request: record.id,
        open: '1',
      });
      return {
        id: record.id,
        type,
        typeLabel: singularTypeLabels[type],
        reference: record.reference,
        requesterName: record.requesterName,
        status: record.status,
        statusLabel: standardPaymentStatusLabel(record.status),
        amount: record.amount,
        updatedAt: record.updatedAt,
        href: `/beta/payment-records?${query.toString()}`,
      };
    });
}

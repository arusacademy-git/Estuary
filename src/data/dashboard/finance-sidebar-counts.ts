import { PaymentType } from '@prisma/client';

import { listPettyCashFromDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { listClaimsFromDatabase } from '@/data/payment-requests/claims/prisma-repository';
import type { SidebarActionCounts } from '@/app/beta/sidebar-action-counts';
import { prisma } from '@/lib/db/prisma';

const voucherStatuses = ['APPROVED_FOR_PAYMENT', 'FINANCE_PROCESSING', 'PENDING_FINANCE_VERIFICATION'];
const invoiceStatuses = ['PENDING_FINANCE_REVIEW', 'PAYMENT_PROCESSED', 'TRANSACTION_PROOF_UPLOADED'];
const travelStatuses = ['PENDING_FINANCE_VERIFICATION', 'PAYMENT_PROCESSED', 'TRANSACTION_PROOF_UPLOADED'];
const cashAdvanceStatuses = ['PENDING_FINANCE_PROCESSING', 'PAYMENT_PROCESSED', 'PENDING_FINANCE_RECONCILIATION', 'TRANSACTION_PROOF_UPLOADED'];

export async function financeSidebarCounts(userId: string): Promise<SidebarActionCounts> {
  const [voucherCount, invoiceCount, travelCount, cashAdvances, pettyCash, claims] =
    await Promise.all([
      prisma.submission.count({ where: { payment_type: PaymentType.PAYMENT_VOUCHER, current_state_code: { in: voucherStatuses } } }),
      prisma.submission.count({ where: { payment_type: PaymentType.INVOICE_PAYMENT, current_state_code: { in: invoiceStatuses } } }),
      prisma.submission.count({ where: { payment_type: PaymentType.TRAVEL_ALLOWANCE, current_state_code: { in: travelStatuses } } }),
      prisma.submission.findMany({ where: { payment_type: PaymentType.CASH_ADVANCE }, select: { current_state_code: true }, orderBy: { updated_at: 'desc' }, take: 1000 }),
      listPettyCashFromDatabase({ role: 'finance', userId, includeAll: true }),
      listClaimsFromDatabase({ role: 'finance', userId }),
    ]);

  const counts: SidebarActionCounts = {
    PAYMENT_VOUCHER: voucherCount,
    INVOICE_PAYMENT: invoiceCount,
    TRAVEL_ALLOWANCE: travelCount,
    CASH_ADVANCE: cashAdvances.filter((record) => cashAdvanceStatuses.includes(record.current_state_code)).length,
    PETTY_CASH: pettyCash.filter((record) => ['PENDING_FINANCE_REVIEW', 'PENDING_FINANCE_PAYMENT', 'FINANCE_VERIFIED', 'PENDING_FINANCE_RECONCILIATION', 'TRANSACTION_PROOF_UPLOADED'].includes(record.status) && (record.status !== 'PENDING_FINANCE_REVIEW' || record.financeReviewerId === userId)).length,
    EXPENSE_CLAIM: claims.filter((record) => ['PENDING_FINANCE_VERIFICATION', 'PENDING_FINANCE_PROCESSING', 'APPROVED_FOR_PAYMENT', 'PAYMENT_PROCESSED', 'TRANSACTION_PROOF_UPLOADED'].includes(record.status)).length,
    ALL_PENDING: 0,
    MY_REQUESTS: 0,
  };
  counts.ALL_PENDING = counts.PAYMENT_VOUCHER + counts.INVOICE_PAYMENT + counts.TRAVEL_ALLOWANCE + counts.CASH_ADVANCE + counts.PETTY_CASH + counts.EXPENSE_CLAIM;
  return counts;
}

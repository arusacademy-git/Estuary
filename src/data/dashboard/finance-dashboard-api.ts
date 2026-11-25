import { fetchDashboardSummary } from "@/data/dashboard/api";
import {
  managerTypeLabels,
  type ManagerDashboardRecord,
} from "@/data/dashboard/manager-dashboard-api";
import { getPaymentVoucherStatusLabel } from "@/domain/payment-vouchers/status";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

function financeRecordHref(type: ManagerDashboardRecord["type"], id: string) {
  const segment: Record<ManagerDashboardRecord["type"], string> = {
    PAYMENT_VOUCHER: "payment-vouchers",
    INVOICE_PAYMENT: "finance/payment-requests/invoice-payments",
    TRAVEL_ALLOWANCE: "finance/payment-requests/travel-allowances",
    CASH_ADVANCE: "finance/payment-requests/cash-advance",
    PETTY_CASH: "finance/payment-requests/petty-cash",
    EXPENSE_CLAIM: "finance/payment-requests/claims",
  };
  return `/beta/${segment[type]}/${encodeURIComponent(id)}`;
}

export const financeCompletedStatuses = new Set([
  "COMPLETED",
  "COMPLETE",
  "CLOSED",
  "PAID",
  "RECONCILED",
]);

export function financeNeedsProcessing(record: ManagerDashboardRecord) {
  const statuses: Record<ManagerDashboardRecord["type"], string[]> = {
    PAYMENT_VOUCHER: [
      "APPROVED_FOR_PAYMENT",
      "FINANCE_PROCESSING",
      "PENDING_FINANCE_VERIFICATION",
    ],
    INVOICE_PAYMENT: [
      "PENDING_FINANCE_REVIEW",
      "PAYMENT_PROCESSED",
      "TRANSACTION_PROOF_UPLOADED",
    ],
    TRAVEL_ALLOWANCE: [
      "PENDING_FINANCE_VERIFICATION",
      "PAYMENT_PROCESSED",
      "TRANSACTION_PROOF_UPLOADED",
    ],
    CASH_ADVANCE: [
      "PENDING_FINANCE_PROCESSING",
      "PAYMENT_PROCESSED",
      "PENDING_FINANCE_RECONCILIATION",
      "TRANSACTION_PROOF_UPLOADED",
    ],
    PETTY_CASH: [
      "PENDING_FINANCE_REVIEW",
      "PENDING_FINANCE_PAYMENT",
      "FINANCE_VERIFIED",
      "PENDING_FINANCE_RECONCILIATION",
      "TRANSACTION_PROOF_UPLOADED",
    ],
    EXPENSE_CLAIM: [
      "PENDING_FINANCE_VERIFICATION",
      "PENDING_FINANCE_PROCESSING",
      "APPROVED_FOR_PAYMENT",
      "PAYMENT_PROCESSED",
      "TRANSACTION_PROOF_UPLOADED",
    ],
  };
  return statuses[record.type].includes(record.status);
}

export async function fetchFinanceDashboard(account: BetaAccount) {
  const records = await fetchDashboardSummary({
    role: "finance",
    userId: account.id,
    view: "ORGANIZATION",
  });

  return records.map<ManagerDashboardRecord>((record) => ({
    id: record.id,
    reference: record.reference,
    type: record.paymentType,
    typeLabel: managerTypeLabels[record.paymentType],
    requesterId: record.requesterId,
    requesterName: record.requesterName,
    purpose: record.projectName ?? managerTypeLabels[record.paymentType],
    status: record.status,
    statusLabel:
      record.paymentType === "PAYMENT_VOUCHER"
        ? getPaymentVoucherStatusLabel(
            record.status as PaymentVoucherRecord["status"],
          )
        : titleCase(record.status),
    amount: record.amount,
    updatedAt: record.updatedAt,
    projectCode: record.projectCode,
    projectName: record.projectName,
    href: financeRecordHref(record.paymentType, record.id),
  }));
}

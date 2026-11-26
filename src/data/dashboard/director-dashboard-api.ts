import { fetchDashboardSummary } from "@/data/dashboard/api";
import {
  managerCompletedStatuses,
  managerRequesterAction,
  managerReturnedStatuses,
  managerTypeCodes,
  managerTypeLabels,
  type ManagerDashboardRecord,
  type ManagerDashboardType,
  type ManagerProjectOption,
} from "@/data/dashboard/manager-dashboard-api";
import { getPaymentVoucherStatusLabel } from "@/domain/payment-vouchers/status";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import type { BetaAccount } from "@/lib/auth/beta-accounts";
import { DIVISION_SELECT_OPTIONS } from "@/shared/constants/payment-options";

export type DirectorDashboardRecord = ManagerDashboardRecord;
export type DirectorDashboardType = ManagerDashboardType;
export type DirectorProjectOption = ManagerProjectOption;
export const directorCompletedStatuses = managerCompletedStatuses;
export const directorRequesterAction = managerRequesterAction;
export const directorReturnedStatuses = managerReturnedStatuses;
export const directorTypeCodes = managerTypeCodes;
export const directorTypeLabels = managerTypeLabels;

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

function directorRecordHref(type: ManagerDashboardRecord["type"], id: string) {
  const segment: Record<ManagerDashboardRecord["type"], string> = {
    PAYMENT_VOUCHER: "payment-vouchers",
    INVOICE_PAYMENT: "director/payment-requests/invoice-payments",
    TRAVEL_ALLOWANCE: "director/payment-requests/travel-allowances",
    CASH_ADVANCE: "director/payment-requests/cash-advance",
    PETTY_CASH: "director/payment-requests/petty-cash",
    EXPENSE_CLAIM: "director/payment-requests/claims",
  };
  return `/beta/${segment[type]}/${encodeURIComponent(id)}`;
}

export function directorNeedsApproval(record: ManagerDashboardRecord) {
  return ["PENDING_DIRECTOR_APPROVAL", "PENDING_DIRECTOR_REVIEW"].includes(
    record.status,
  );
}

export async function fetchDirectorDashboard(account: BetaAccount) {
  const [records, organizationRecords] = await Promise.all([
    fetchDashboardSummary({ role: "director", userId: account.id }),
    fetchDashboardSummary({
      role: "director",
      userId: account.id,
      view: "ORGANIZATION",
    }),
  ]);

  const mapRecord = (record: (typeof records)[number]) => ({
    id: record.id,
    reference: record.reference,
    type: record.paymentType,
    typeLabel: managerTypeLabels[record.paymentType],
    requesterId: record.requesterId,
    requesterName: record.requesterName,
    purpose: record.purpose || managerTypeLabels[record.paymentType],
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
    href: directorRecordHref(record.paymentType, record.id),
  });

  return {
    records: records.map<ManagerDashboardRecord>(mapRecord),
    organizationRecords:
      organizationRecords.map<ManagerDashboardRecord>(mapRecord),
    projects: DIVISION_SELECT_OPTIONS.map<ManagerProjectOption>((project) => ({
      value: project.value,
      label: project.label,
    })),
  };
}

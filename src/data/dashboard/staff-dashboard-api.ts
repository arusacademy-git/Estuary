import { fetchDashboardSummary } from "@/data/dashboard/api";

import { getPaymentVoucherStatusLabel } from "@/domain/payment-vouchers/status";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

export type StaffDashboardType =
    | "PAYMENT_VOUCHER"
    | "INVOICE_PAYMENT"
    | "TRAVEL_ALLOWANCE"
    | "CASH_ADVANCE"
    | "PETTY_CASH"
    | "EXPENSE_CLAIM";

export type StaffDashboardRecord = {
    id: string;
    reference: string;
    type: StaffDashboardType;
    typeLabel: string;
    requesterName: string;
    status: string;
    statusLabel: string;
    amount: number;
    updatedAt: string;
    href: string;
};

export const staffTypeOrder: StaffDashboardType[] = [
    "PAYMENT_VOUCHER",
    "INVOICE_PAYMENT",
    "TRAVEL_ALLOWANCE",
    "CASH_ADVANCE",
    "PETTY_CASH",
    "EXPENSE_CLAIM",
];

export const staffTypeLabels: Record<StaffDashboardType, string> = {
    PAYMENT_VOUCHER: "Payment Vouchers",
    INVOICE_PAYMENT: "Invoice Payments",
    TRAVEL_ALLOWANCE: "Travel Allowances",
    CASH_ADVANCE: "Cash Advances",
    PETTY_CASH: "Petty Cash",
    EXPENSE_CLAIM: "Claims",
};

export const staffTypeCodes: Record<StaffDashboardType, string> = {
    PAYMENT_VOUCHER: "PV",
    INVOICE_PAYMENT: "INV",
    TRAVEL_ALLOWANCE: "TA",
    CASH_ADVANCE: "CA",
    PETTY_CASH: "PC",
    EXPENSE_CLAIM: "CL",
};

export const staffCompletedStatuses = new Set([
    "COMPLETED",
    "PAID",
    "RECONCILED",
    "ARCHIVED",
]);

export const staffReturnedStatuses = new Set([
    "REJECTED",
    "PAYMENT_REJECTED",
    "RETURNED_TO_STAFF",
    "RETURNED_TO_CLAIMANT",
]);

const actionStatuses = new Set([
    "DRAFT",
    ...staffReturnedStatuses,
    "AWAITING_RECIPIENT_SIGNATURE",
    "AWAITING_STAFF_CONFIRMATION",
    "AWAITING_SIGNED_PV_UPLOAD",
    "AWAITING_STAFF_VERIFICATION",
    "PENDING_RECONCILIATION",
    "PROCESSED_PENDING_RECONCILIATION",
]);

function titleCase(value: string) {
    return value
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function staffNeedsAction(record: StaffDashboardRecord) {
    return actionStatuses.has(record.status);
}

export function staffRequestsHref(
    type?: StaffDashboardType,
    summary?: "ACTION" | "PROGRESS" | "COMPLETED",
) {
    const query = new URLSearchParams({ scope: "mine" });
    if (type) query.set("type", type === "EXPENSE_CLAIM" ? "CLAIM" : type);
    if (summary) query.set("summary", summary);
    return `/beta/payment-records?${query.toString()}`;
}

export async function fetchStaffDashboardRecords(account: BetaAccount) {
    const records = await fetchDashboardSummary({
        role: "staff",
        userId: account.id,
    });

    return records.map<StaffDashboardRecord>((record) => ({
        id: record.id,
        reference: record.reference,
        type: record.paymentType,
        typeLabel: staffTypeLabels[record.paymentType],
        requesterName: record.requesterName,
        status: record.status,
        statusLabel:
            record.paymentType === "PAYMENT_VOUCHER"
                ? getPaymentVoucherStatusLabel(
                    record.status as PaymentVoucherRecord["status"],
                )
                : titleCase(record.status),
        amount: record.amount,
        updatedAt: record.updatedAt,
        href: staffRequestsHref(record.paymentType),
    }));
}

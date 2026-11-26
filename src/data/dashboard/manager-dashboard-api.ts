import { fetchDashboardSummary } from "@/data/dashboard/api";
import { getPaymentVoucherStatusLabel } from "@/domain/payment-vouchers/status";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import type { BetaAccount } from "@/lib/auth/beta-accounts";
import { DIVISION_SELECT_OPTIONS } from "@/shared/constants/payment-options";

export type ManagerDashboardType =
    | "PAYMENT_VOUCHER"
    | "INVOICE_PAYMENT"
    | "TRAVEL_ALLOWANCE"
    | "CASH_ADVANCE"
    | "PETTY_CASH"
    | "EXPENSE_CLAIM";

export type ManagerDashboardRecord = {
    id: string;
    reference: string;
    type: ManagerDashboardType;
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

export type ManagerProjectOption = { value: string; label: string };

export const managerTypeLabels: Record<ManagerDashboardType, string> = {
    PAYMENT_VOUCHER: "Payment Voucher",
    INVOICE_PAYMENT: "Invoice Payment",
    TRAVEL_ALLOWANCE: "Travel Allowance",
    CASH_ADVANCE: "Cash Advance",
    PETTY_CASH: "Petty Cash",
    EXPENSE_CLAIM: "Claims",
};
export const managerTypeCodes: Record<ManagerDashboardType, string> = {
    PAYMENT_VOUCHER: "PV",
    INVOICE_PAYMENT: "INV",
    TRAVEL_ALLOWANCE: "TA",
    CASH_ADVANCE: "CA",
    PETTY_CASH: "PC",
    EXPENSE_CLAIM: "CL",
};

export const managerCompletedStatuses = new Set([
    "COMPLETED",
    "PAID",
    "RECONCILED",
    "CLOSED",
]);

export const managerReturnedStatuses = new Set([
    "REJECTED",
    "PAYMENT_REJECTED",
    "RETURNED_TO_STAFF",
    "RETURNED_TO_CLAIMANT",
]);

export function managerNeedsApproval(record: ManagerDashboardRecord) {
    return ["PENDING_MANAGER_APPROVAL", "PENDING_MANAGER_REVIEW"].includes(
        record.status,
    );
}

export function managerRequesterAction(record: ManagerDashboardRecord) {
    return (
        managerReturnedStatuses.has(record.status) ||
        [
            "PENDING_RECONCILIATION",
            "PROCESSED_PENDING_RECONCILIATION",
            "AWAITING_RECIPIENT_SIGNATURE",
            "AWAITING_STAFF_CONFIRMATION",
        ].includes(record.status)
    );
}

function titleCase(value: string) {
    return value
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function detailHref(type: ManagerDashboardType, id: string) {
    const segment: Record<ManagerDashboardType, string> = {
        PAYMENT_VOUCHER: "payment-vouchers",
        INVOICE_PAYMENT: "payment-records/invoice-payments",
        TRAVEL_ALLOWANCE: "payment-records/travel-allowances",
        CASH_ADVANCE: "payment-records/cash-advances",
        PETTY_CASH: "payment-records/petty-cash",
        EXPENSE_CLAIM: "payment-records/claims",
    };
    return `/beta/${segment[type]}/${encodeURIComponent(id)}`;
}

export async function fetchManagerDashboard(account: BetaAccount) {
    const records = await fetchDashboardSummary({
        role: "manager",
        userId: account.id,
    });

    return {
        records: records.map<ManagerDashboardRecord>((record) => ({
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
            href: detailHref(record.paymentType, record.id),
        })),
        projects: DIVISION_SELECT_OPTIONS.map<ManagerProjectOption>((project) => ({
            value: project.value,
            label: project.label,
        })),
    };
}

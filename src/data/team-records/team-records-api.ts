import { fetchDashboardSummary } from "@/data/dashboard/api";
import type {
    DashboardSummaryPaymentType,
    DashboardSummaryRecord,
} from "@/domain/dashboard/types";
import type { BetaAccount } from "@/lib/auth/beta-accounts";
import { DIVISION_SELECT_OPTIONS } from "@/shared/constants/payment-options";

export type TeamRecord = DashboardSummaryRecord & {
    typeLabel: string;
    typeCode: string;
    statusLabel: string;
    purpose: string;
    href: string;
};

export const teamRecordTypeLabels: Record<DashboardSummaryPaymentType, string> =
{
    PAYMENT_VOUCHER: "Payment Voucher",
    INVOICE_PAYMENT: "Invoice Payment",
    TRAVEL_ALLOWANCE: "Travel Allowance",
    CASH_ADVANCE: "Cash Advance",
    PETTY_CASH: "Petty Cash",
    EXPENSE_CLAIM: "Claims",
};

export const teamRecordTypeCodes: Record<DashboardSummaryPaymentType, string> =
{
    PAYMENT_VOUCHER: "PV",
    INVOICE_PAYMENT: "INV",
    TRAVEL_ALLOWANCE: "TA",
    CASH_ADVANCE: "CA",
    PETTY_CASH: "PC",
    EXPENSE_CLAIM: "CL",
};

export const teamProjectOptions = DIVISION_SELECT_OPTIONS.map((project) => ({
    value: project.value,
    label: project.label,
}));

export const completedTeamStatuses = new Set([
    "COMPLETED",
    "COMPLETE",
    "PAID",
    "CLOSED",
]);
export const reconciledTeamStatuses = new Set(["RECONCILED"]);
export const inactiveTeamStatuses = new Set([
    "REJECTED",
    "PAYMENT_REJECTED",
    "INACTIVE",
    "VOIDED",
    "CANCELLED",
]);

export function teamRecordGroup(record: TeamRecord) {
    if (reconciledTeamStatuses.has(record.status)) return "RECONCILED" as const;
    if (completedTeamStatuses.has(record.status)) return "COMPLETED" as const;
    if (inactiveTeamStatuses.has(record.status)) return "INACTIVE" as const;
    if (
        record.status.includes("FINANCE") ||
        record.status.includes("PAYMENT") ||
        record.status.includes("PROCESS")
    )
        return "PAYMENT" as const;
    return "APPROVAL" as const;
}

const titleCase = (value: string) =>
    value
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

function recordHref(type: DashboardSummaryPaymentType, id: string) {
    const segment: Record<DashboardSummaryPaymentType, string> = {
        PAYMENT_VOUCHER: "payment-vouchers",
        INVOICE_PAYMENT: "payment-records/invoice-payments",
        TRAVEL_ALLOWANCE: "payment-records/travel-allowances",
        CASH_ADVANCE: "payment-records/cash-advances",
        PETTY_CASH: "payment-records/petty-cash",
        EXPENSE_CLAIM: "payment-records/claims",
    };
    return `/beta/${segment[type]}/${encodeURIComponent(id)}`;
}

export async function fetchTeamRecords(account: BetaAccount) {
    const role = account.role === "staff" ? "manager" : account.role;
    const records = await fetchDashboardSummary({ role, userId: account.id });
    return records.map<TeamRecord>((record) => ({
        ...record,
        typeLabel: teamRecordTypeLabels[record.paymentType],
        typeCode: teamRecordTypeCodes[record.paymentType],
        statusLabel: titleCase(record.status),
        purpose: record.purpose || teamRecordTypeLabels[record.paymentType],
        href: recordHref(record.paymentType, record.id),
    }));
}

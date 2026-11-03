import { fetchDashboardSummary } from "@/data/dashboard/api";
import { fetchManualFormDrafts } from "@/data/payment-requests/manual-drafts/api";
import type { DashboardSummaryRecord } from "@/domain/dashboard/types";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

export type SidebarPaymentType =
  | "PAYMENT_VOUCHER"
  | "INVOICE_PAYMENT"
  | "TRAVEL_ALLOWANCE"
  | "CASH_ADVANCE"
  | "PETTY_CASH"
  | "EXPENSE_CLAIM"
  | "ALL_PENDING"
  | "MY_REQUESTS";

export type SidebarActionCounts = Record<SidebarPaymentType, number>;

export const PENDING_QUEUE_COUNT_EVENT = "estuary:pending-queue-count-synced";

function pendingQueueStorageKey(role: BetaAccount["role"]) {
  return `estuary:pending-queue-count:${role}`;
}

export function publishPendingQueueCount(
  role: BetaAccount["role"],
  count: number,
) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(pendingQueueStorageKey(role), String(count));
  window.dispatchEvent(
    new CustomEvent(PENDING_QUEUE_COUNT_EVENT, {
      detail: { role, count },
    }),
  );
}

export function readPublishedPendingQueueCount(
  role: BetaAccount["role"],
): number | null {
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(pendingQueueStorageKey(role));
  if (stored === null) return null;
  const count = Number(stored);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

const emptyCounts: SidebarActionCounts = {
  PAYMENT_VOUCHER: 0,
  INVOICE_PAYMENT: 0,
  TRAVEL_ALLOWANCE: 0,
  CASH_ADVANCE: 0,
  PETTY_CASH: 0,
  EXPENSE_CLAIM: 0,
  ALL_PENDING: 0,
  MY_REQUESTS: 0,
};

function needsRequesterAction(
  record: DashboardSummaryRecord,
  account: BetaAccount,
) {
  if (record.requesterId !== account.id) return false;

  if (
    record.paymentType === "PAYMENT_VOUCHER" &&
    record.status === "AWAITING_RECIPIENT_SIGNATURE"
  ) {
    return !record.recipientLinkIssued;
  }

  return [
    "DRAFT",
    "REJECTED",
    "PAYMENT_REJECTED",
    "RETURNED_TO_STAFF",
    "RETURNED_TO_CLAIMANT",
    "AWAITING_STAFF_CONFIRMATION",
    "AWAITING_SIGNED_PV_UPLOAD",
    "AWAITING_STAFF_VERIFICATION",
    "PENDING_RECONCILIATION",
    "PROCESSED_PENDING_RECONCILIATION",
  ].includes(record.status);
}

function needsRoleAction(record: DashboardSummaryRecord, account: BetaAccount) {
  if (account.role === "staff") {
    return [
      "DRAFT",
      "REJECTED",
      "PAYMENT_REJECTED",
      "RETURNED_TO_STAFF",
      "RETURNED_TO_CLAIMANT",
      "AWAITING_STAFF_CONFIRMATION",
      "AWAITING_SIGNED_PV_UPLOAD",
      "AWAITING_STAFF_VERIFICATION",
      "PENDING_RECONCILIATION",
      "PROCESSED_PENDING_RECONCILIATION",
    ].includes(record.status);
  }

  if (account.role === "manager") {
    if (record.paymentType === "TRAVEL_ALLOWANCE") {
      return false;
    }
    if (record.paymentType === "PAYMENT_VOUCHER") {
      return (
        record.status === "APPROVED_FOR_PAYMENT" &&
        record.approverIds.includes(account.id) &&
        !record.managerViewed
      );
    }
    if (record.paymentType === "EXPENSE_CLAIM") {
      return false;
    }
    if (record.paymentType === "PETTY_CASH") {
      return (
        record.approverIds.includes(account.id) &&
        !record.claimManagerPreviewed &&
        !["DRAFT", "RETURNED_TO_STAFF"].includes(record.status)
      );
    }
    if (record.paymentType === "CASH_ADVANCE") {
      return (
        record.approverIds.includes(account.id) &&
        !record.managerViewed &&
        !["DRAFT", "RETURNED_TO_STAFF"].includes(record.status)
      );
    }
    return (
      ["PENDING_MANAGER_APPROVAL", "PENDING_MANAGER_REVIEW"].includes(
        record.status,
      ) && record.currentAssigneeId === account.id
    );
  }

  if (account.role === "director") {
    if (record.paymentType === "EXPENSE_CLAIM") {
      return (
        record.approverIds.includes(account.id) &&
        record.status === "PENDING_DIRECTOR_APPROVAL" &&
        record.currentAssigneeId === account.id
      );
    }
    if (record.paymentType === "PETTY_CASH") {
      return (
        record.approverIds.includes(account.id) &&
        !record.claimDirectorPreviewed &&
        !["DRAFT", "RETURNED_TO_STAFF"].includes(record.status)
      );
    }
    return (
      ["PENDING_DIRECTOR_APPROVAL", "PENDING_DIRECTOR_REVIEW"].includes(
        record.status,
      ) && record.currentAssigneeId === account.id
    );
  }

  if (record.status === "PENDING_FINANCE_REVIEW")
    return record.currentAssigneeId === account.id;

  return [
    "APPROVED_FOR_PAYMENT",
    "FINANCE_PROCESSING",
    "PENDING_FINANCE_VERIFICATION",
    "PENDING_FINANCE_PAYMENT",
    "PENDING_FINANCE_PROCESSING",
    "PAYMENT_PROCESSED",
    "PENDING_FINANCE_RECONCILIATION",
    "FINANCE_VERIFIED",
    "APPROVED_PENDING_PAYMENT",
    "PENDING_PAYMENT",
    "RECON_PENDING_CHILD_CLOSURE",
    "TRANSACTION_PROOF_UPLOADED",
  ].includes(record.status);
}

export async function fetchSidebarActionCounts(
  account: BetaAccount,
): Promise<SidebarActionCounts> {
  const records = await fetchDashboardSummary({
    role: account.role,
    userId: account.id,
  });
  const counts = records.reduce<SidebarActionCounts>(
    (current, record) => {
      if (needsRoleAction(record, account)) {
        current[record.paymentType] += 1;
        current.ALL_PENDING += 1;
      }
      if (needsRequesterAction(record, account)) current.MY_REQUESTS += 1;
      return current;
    },
    { ...emptyCounts },
  );

  const manualDrafts = await fetchManualFormDrafts(
    "beta-arus-org",
    account.id,
  ).catch(() => []);
  counts.MY_REQUESTS += manualDrafts.length;

  return counts;
}

export function createEmptySidebarActionCounts(): SidebarActionCounts {
  return { ...emptyCounts };
}

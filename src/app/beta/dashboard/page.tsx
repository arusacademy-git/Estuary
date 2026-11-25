"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  fetchSidebarActionCounts,
  PENDING_QUEUE_COUNT_EVENT,
} from "@/app/beta/sidebar-action-counts";
import { fetchDashboardSummary } from "@/data/dashboard/api";
import type {
  DashboardSummaryPaymentType,
  DashboardSummaryRecord,
} from "@/domain/dashboard/types";
import { getPaymentVoucherStatusLabel } from "@/domain/payment-vouchers/status";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import {
  MyRequestAction,
  type MyRequestActionRecord,
} from "@/features/payment-records/components/shared/my-request-action";
import { isProjectManagerAccount } from "@/features/administration/admin-settings";
import {
  readBetaSession,
  type BetaAccount,
  type BetaRole,
} from "@/lib/auth/beta-accounts";

import styles from "./dashboard.module.css";
import { DirectorDashboard } from "./director/director-dashboard";
import { FinanceDashboard } from "./finance/finance-dashboard";
import { ManagerDashboard } from "./manager/manager-dashboard";
import { StaffDashboard } from "./staff/staff-dashboard";

const dashboardKpiIcons = [
  "/assets/icons/submitted-doc-icon.png",
  "/assets/icons/in-progress-clock-icon.png",
  "/assets/icons/completed-check-icon.png",
  "/assets/icons/reconciliation-sync-icon.png",
] as const;

type DashboardType = DashboardSummaryPaymentType;
type Tone = "blue" | "amber" | "green" | "red" | "gray";
type AnalyticsRange = "LAST_6_MONTHS" | "THIS_YEAR" | "ALL_TIME";
type RecentStatusFilter = "ALL" | "IN_PROGRESS" | "COMPLETED";
type DashboardRecord = {
  id: string;
  reference: string;
  type: DashboardType;
  typeLabel: string;
  requesterId: string;
  requesterName: string;
  status: string;
  statusLabel: string;
  amount: number;
  updatedAt: string;
  href: string;
  managerViewed?: boolean;
  claimManagerPreviewed?: boolean;
  claimDirectorPreviewed?: boolean;
  currentAssigneeId?: string;
  approverIds: string[];
  recipientLinkIssued: boolean;
};
function modalPaymentType(type: DashboardType): MyRequestActionRecord["type"] {
  return type === "EXPENSE_CLAIM" ? "CLAIM" : type;
}
type CreatePaymentOption = {
  type: DashboardType;
  label: string;
  description: string;
  href: string;
};
const typeOrder: DashboardType[] = [
  "PAYMENT_VOUCHER",
  "INVOICE_PAYMENT",
  "TRAVEL_ALLOWANCE",
  "CASH_ADVANCE",
  "PETTY_CASH",
  "EXPENSE_CLAIM",
];
const typeLabels: Record<DashboardType, string> = {
  PAYMENT_VOUCHER: "Payment Vouchers",
  INVOICE_PAYMENT: "Invoice Payments",
  TRAVEL_ALLOWANCE: "Travel Allowances",
  CASH_ADVANCE: "Cash Advances",
  PETTY_CASH: "Petty Cash",
  EXPENSE_CLAIM: "Claims",
};
const typeCodes: Record<DashboardType, string> = {
  PAYMENT_VOUCHER: "PV",
  INVOICE_PAYMENT: "INV",
  TRAVEL_ALLOWANCE: "TA",
  CASH_ADVANCE: "CA",
  PETTY_CASH: "PC",
  EXPENSE_CLAIM: "CL",
};
const analyticsRangeLabels: Record<AnalyticsRange, string> = {
  LAST_6_MONTHS: "Last 6 Months",
  THIS_YEAR: "This Year",
  ALL_TIME: "All Time",
};
const completedStatuses = new Set([
  "COMPLETED",
  "COMPLETE",
  "CLOSED",
  "PAID",
  "RECONCILED",
]);
const returnedStatuses = new Set([
  "REJECTED",
  "PAYMENT_REJECTED",
  "RETURNED_TO_STAFF",
  "RETURNED_TO_CLAIMANT",
]);
const inactiveStatuses = new Set(["INACTIVE"]);

const roleCopy: Record<BetaRole, { title: string; description: string }> = {
  staff: {
    title: "My payment workspace",
    description:
      "Create payments, follow every request type and respond to corrections from one place.",
  },
  manager: {
    title: "Manager workspace",
    description:
      "Preview Payment Vouchers and review assigned Payment Requests across every request type.",
  },
  director: {
    title: "Director workspace",
    description:
      "Review assigned approvals and monitor requests already forwarded to Finance.",
  },
  finance: {
    title: "Finance workspace",
    description:
      "Process approved payments, verify evidence and monitor completion across all payment types.",
  },
};

const createPaymentOptions: CreatePaymentOption[] = [
  {
    type: "PAYMENT_VOUCHER",
    label: "Payment Voucher",
    description: "Pay a person or vendor",
    href: "/beta/payment-vouchers/new",
  },
  {
    type: "INVOICE_PAYMENT",
    label: "Invoice Payment",
    description: "Pay against a supplier invoice",
    href: "/beta/payment-requests/invoice-payment/new",
  },
  {
    type: "TRAVEL_ALLOWANCE",
    label: "Travel Allowance",
    description: "Get approval and allowance for travel",
    href: "/beta/payment-requests/travel-allowance/new",
  },
  {
    type: "CASH_ADVANCE",
    label: "Cash Advance",
    description: "Get money before an activity",
    href: "/beta/payment-requests/cash-advance/new",
  },
  {
    type: "PETTY_CASH",
    label: "Petty Cash",
    description: "Small day-to-day spending",
    href: "/beta/payment-requests/petty-cash/new",
  },
  {
    type: "EXPENSE_CLAIM",
    label: "Claims",
    description: "Get reimbursed for an expense",
    href: "/beta/payment-requests/claims/new",
  },
];

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function chartMaximum(value: number) {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 4;
  return Math.ceil(value / step) * step;
}

function scaleMoney(value: number) {
  if (value === 0) return "0";
  if (value >= 1000) {
    const scaled = value / 1000;
    return `RM${scaled.toLocaleString("en-MY", { maximumFractionDigits: scaled % 1 === 0 ? 0 : 1 })}k`;
  }
  return `RM${value.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function monthlyExpenditure(records: DashboardRecord[], range: AnalyticsRange) {
  const completed = records.filter(
    (record) =>
      completedStatuses.has(record.status) &&
      !Number.isNaN(new Date(record.updatedAt).getTime()),
  );
  const today = new Date();
  const currentMonth = monthStart(today);
  const earliestRecord = completed.reduce<Date | null>((earliest, record) => {
    const recordMonth = monthStart(new Date(record.updatedAt));
    return !earliest || recordMonth < earliest ? recordMonth : earliest;
  }, null);
  const start =
    range === "LAST_6_MONTHS"
      ? addMonths(currentMonth, -5)
      : range === "THIS_YEAR"
        ? new Date(today.getFullYear(), 0, 1)
        : (earliestRecord ?? currentMonth);
  const months: Array<{
    key: string;
    label: string;
    values: Record<DashboardType, number>;
    total: number;
  }> = [];

  for (
    let cursor = start;
    cursor <= currentMonth;
    cursor = addMonths(cursor, 1)
  ) {
    months.push({
      key: monthKey(cursor),
      label: cursor.toLocaleDateString("en-MY", {
        month: "short",
        ...(range === "ALL_TIME" ? { year: "2-digit" as const } : {}),
      }),
      values: Object.fromEntries(typeOrder.map((type) => [type, 0])) as Record<
        DashboardType,
        number
      >,
      total: 0,
    });
  }

  const byMonth = new Map(months.map((month) => [month.key, month]));
  completed.forEach((record) => {
    const month = byMonth.get(monthKey(new Date(record.updatedAt)));
    if (!month) return;
    month.values[record.type] += record.amount;
    month.total += record.amount;
  });
  return months;
}

const requesterActionStatuses = new Set([
  "DRAFT",
  "REJECTED",
  "PAYMENT_REJECTED",
  "RETURNED_TO_STAFF",
  "RETURNED_TO_CLAIMANT",
  "AWAITING_RECIPIENT_SIGNATURE",
  "AWAITING_STAFF_CONFIRMATION",
  "AWAITING_SIGNED_PV_UPLOAD",
  "AWAITING_STAFF_VERIFICATION",
  "PENDING_RECONCILIATION",
  "PROCESSED_PENDING_RECONCILIATION",
]);

function myRequestsHref(
  type: DashboardType,
  options: { requestId?: string; actionOnly?: boolean } = {},
) {
  const parameters = new URLSearchParams({
    scope: "mine",
    type: modalPaymentType(type),
  });
  if (options.actionOnly) parameters.set("summary", "ACTION");
  if (options.requestId) {
    parameters.set("request", options.requestId);
    parameters.set("open", "1");
  }
  return `/beta/payment-records?${parameters.toString()}`;
}

function detailHref(
  type: DashboardType,
  id: string,
  account: BetaAccount,
  requesterId: string,
  status: string,
) {
  const encoded = encodeURIComponent(id);
  const requesterAction =
    requesterId === account.id && requesterActionStatuses.has(status);
  if (account.role === "staff" || requesterAction)
    return myRequestsHref(type, { requestId: id, actionOnly: requesterAction });
  if (type === "PAYMENT_VOUCHER") return `/beta/payment-vouchers/${encoded}`;
  if (type === "EXPENSE_CLAIM")
    return account.role === "manager"
      ? `/beta/project-manager/payment-requests/claims/${encoded}`
      : account.role === "director"
        ? `/beta/director/payment-requests/claims/${encoded}`
        : account.role === "finance"
          ? `/beta/finance/payment-requests/claims/${encoded}`
          : "/beta/payment-records/claims";
  const segments: Record<
    Exclude<DashboardType, "PAYMENT_VOUCHER" | "EXPENSE_CLAIM">,
    string
  > = {
    INVOICE_PAYMENT: "invoice-payments",
    TRAVEL_ALLOWANCE: "travel-allowances",
    CASH_ADVANCE: "cash-advance",
    PETTY_CASH: "petty-cash",
  };
  const segment = segments[type as keyof typeof segments];
  if (account.role === "manager")
    return `/beta/project-manager/payment-requests/${segment}/${encoded}`;
  if (account.role === "director")
    return `/beta/director/payment-requests/${segment}/${encoded}`;
  if (account.role === "finance")
    return `/beta/finance/payment-requests/${segment}/${encoded}`;
  const recordSegment = type === "CASH_ADVANCE" ? "cash-advances" : segment;
  return `/beta/payment-records/${recordSegment}/${encoded}`;
}

function typeHref(type: DashboardType, role: BetaRole) {
  const pendingType = typeCodes[type];

  if (role === "manager") {
    return `/beta/project-manager/pending-approvals?type=${pendingType}`;
  }
  if (role === "director") {
    return `/beta/director/pending-approvals?type=${pendingType}`;
  }
  if (role === "finance") {
    return `/beta/finance/pending-processing?type=${pendingType}`;
  }

  return myRequestsHref(type);
}

function myRequestRecordHref(record: DashboardRecord) {
  return myRequestsHref(record.type, {
    requestId: record.id,
    actionOnly: true,
  });
}

function isRequesterActionRecord(
  record: DashboardRecord,
  account: BetaAccount,
) {
  return (
    record.requesterId === account.id &&
    requesterActionStatuses.has(record.status)
  );
}

function pendingRecordHref(record: DashboardRecord, account: BetaAccount) {
  if (account.role === "staff" || isRequesterActionRecord(record, account))
    return myRequestRecordHref(record);

  const categoryHref = typeHref(record.type, account.role);
  return `${categoryHref}&request=${encodeURIComponent(record.id)}`;
}

function needsRequesterAction(record: DashboardRecord, userId: string) {
  if (record.requesterId === userId) {
    if (
      record.type === "PAYMENT_VOUCHER" &&
      record.status === "AWAITING_RECIPIENT_SIGNATURE"
    )
      return !record.recipientLinkIssued;
    if (requesterActionStatuses.has(record.status)) return true;
  }
  return false;
}

function needsRoleAction(
  record: DashboardRecord,
  role: BetaRole,
  userId: string,
) {
  if (role === "staff") return false;
  if (role === "manager")
    return record.type === "PAYMENT_VOUCHER"
      ? record.status === "APPROVED_FOR_PAYMENT" &&
          record.approverIds.includes(userId) &&
          !record.managerViewed
      : record.type === "EXPENSE_CLAIM"
        ? false
        : record.type === "PETTY_CASH"
          ? record.approverIds.includes(userId) &&
            !record.claimManagerPreviewed &&
            !["DRAFT", "RETURNED_TO_STAFF"].includes(record.status)
          : record.type === "CASH_ADVANCE"
            ? record.approverIds.includes(userId) &&
              !record.managerViewed &&
              !["DRAFT", "RETURNED_TO_STAFF"].includes(record.status)
            : ["PENDING_MANAGER_APPROVAL", "PENDING_MANAGER_REVIEW"].includes(
                record.status,
              ) && record.currentAssigneeId === userId;
  if (role === "director")
    return record.type === "EXPENSE_CLAIM"
      ? record.approverIds.includes(userId) &&
          record.status === "PENDING_DIRECTOR_APPROVAL" &&
          record.currentAssigneeId === userId
      : record.type === "PETTY_CASH"
        ? record.approverIds.includes(userId) &&
          !record.claimDirectorPreviewed &&
          !["DRAFT", "RETURNED_TO_STAFF"].includes(record.status)
        : ["PENDING_DIRECTOR_APPROVAL", "PENDING_DIRECTOR_REVIEW"].includes(
            record.status,
          ) && record.currentAssigneeId === userId;
  if (record.type === "PAYMENT_VOUCHER")
    return [
      "APPROVED_FOR_PAYMENT",
      "FINANCE_PROCESSING",
      "PENDING_FINANCE_VERIFICATION",
    ].includes(record.status);
  if (record.type === "INVOICE_PAYMENT")
    return [
      "PENDING_FINANCE_REVIEW",
      "PAYMENT_PROCESSED",
      "TRANSACTION_PROOF_UPLOADED",
    ].includes(record.status);
  if (record.type === "TRAVEL_ALLOWANCE")
    return [
      "PENDING_FINANCE_VERIFICATION",
      "PAYMENT_PROCESSED",
      "TRANSACTION_PROOF_UPLOADED",
    ].includes(record.status);
  if (record.type === "CASH_ADVANCE")
    return [
      "PENDING_FINANCE_PROCESSING",
      "PAYMENT_PROCESSED",
      "PENDING_FINANCE_RECONCILIATION",
      "TRANSACTION_PROOF_UPLOADED",
    ].includes(record.status);
  if (record.type === "PETTY_CASH")
    return (
      [
        "PENDING_FINANCE_REVIEW",
        "PENDING_FINANCE_PAYMENT",
        "FINANCE_VERIFIED",
        "PENDING_FINANCE_RECONCILIATION",
        "TRANSACTION_PROOF_UPLOADED",
      ].includes(record.status) &&
      (record.status !== "PENDING_FINANCE_REVIEW" ||
        record.currentAssigneeId === userId)
    );
  return [
    "PENDING_FINANCE_VERIFICATION",
    "PENDING_FINANCE_PROCESSING",
    "APPROVED_FOR_PAYMENT",
    "PAYMENT_PROCESSED",
    "TRANSACTION_PROOF_UPLOADED",
  ].includes(record.status);
}

function needsAction(record: DashboardRecord, role: BetaRole, userId: string) {
  return (
    needsRequesterAction(record, userId) ||
    needsRoleAction(record, role, userId)
  );
}

function tone(record: DashboardRecord, role: BetaRole, userId: string): Tone {
  if (completedStatuses.has(record.status)) return "green";
  if (
    returnedStatuses.has(record.status) ||
    inactiveStatuses.has(record.status)
  )
    return "red";
  if (needsAction(record, role, userId)) return "amber";
  return "blue";
}

function normalizeSummary(
  account: BetaAccount,
  records: DashboardSummaryRecord[],
): DashboardRecord[] {
  return records.map((record) => ({
    id: record.id,
    reference: record.reference,
    type: record.paymentType,
    typeLabel: typeLabels[record.paymentType],
    requesterId: record.requesterId,
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
    href: detailHref(
      record.paymentType,
      record.id,
      account,
      record.requesterId,
      record.status,
    ),
    managerViewed: record.managerViewed,
    claimManagerPreviewed: record.claimManagerPreviewed,
    claimDirectorPreviewed: record.claimDirectorPreviewed,
    currentAssigneeId: record.currentAssigneeId,
    approverIds: record.approverIds,
    recipientLinkIssued: record.recipientLinkIssued,
  }));
}

export default function BetaDashboardPage() {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [financeWorkspace] = useState<"finance" | "staff">(() =>
    typeof window !== "undefined" &&
    window.localStorage.getItem("estuary:finance-workspace") === "staff"
      ? "staff"
      : "finance",
  );
  const requestedFinanceWorkspace = searchParameters.get("workspace");
  const activeFinanceWorkspace =
    requestedFinanceWorkspace === "staff" ||
    requestedFinanceWorkspace === "finance"
      ? requestedFinanceWorkspace
      : financeWorkspace;
  const [now, setNow] = useState(() => new Date());
  const [records, setRecords] = useState<DashboardRecord[]>([]);
  const [analyticsRecords, setAnalyticsRecords] = useState<DashboardRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analyticsRange, setAnalyticsRange] =
    useState<AnalyticsRange>("LAST_6_MONTHS");
  const [selectedActionType, setSelectedActionType] =
    useState<DashboardType | null>(null);
  const [makePaymentOpen, setMakePaymentOpen] = useState(false);
  const [recentStatusFilter, setRecentStatusFilter] =
    useState<RecentStatusFilter>("ALL");
  const [recentTypeFilter, setRecentTypeFilter] = useState<
    "ALL" | DashboardType
  >("ALL");
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const projectManager = account ? isProjectManagerAccount(account) : false;
  const effectiveRole: BetaRole = projectManager
    ? "manager"
    : (account?.role ?? "staff");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!account) {
      router.replace("/beta");
      return;
    }

    if (
      (account.role === "staff" && !projectManager) ||
      account.role === "manager" ||
      projectManager
    ) {
      return;
    }

    const signedInAccount = account;
    let active = true;
    const organizationAnalytics =
      signedInAccount.role === "director" || signedInAccount.role === "finance";
    Promise.all([
      fetchDashboardSummary({
        role: signedInAccount.role,
        userId: signedInAccount.id,
      }),
      organizationAnalytics
        ? fetchDashboardSummary({
            role: signedInAccount.role,
            userId: signedInAccount.id,
            view: "ORGANIZATION_COMPLETED",
          })
        : Promise.resolve([]),
    ])
      .then(([items, analyticsItems]) => {
        if (!active) return;
        setRecords(normalizeSummary(signedInAccount, items));
        setAnalyticsRecords(normalizeSummary(signedInAccount, analyticsItems));
      })
      .catch(() => {
        if (active) setWarnings(["Dashboard records could not be loaded."]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [account, projectManager, router]);

  useEffect(() => {
    if (!account || (account.role === "staff" && !projectManager)) return;
    const actionAccount: BetaAccount = projectManager
      ? { ...account, role: "manager" }
      : account;
    let active = true;
    fetchSidebarActionCounts(actionAccount)
      .then((counts) => {
        if (active) setPendingQueueCount(counts.ALL_PENDING);
      })
      .catch(() => undefined);
    const syncPublishedCount = (event: Event) => {
      const detail = (event as CustomEvent<{ role: BetaRole; count: number }>)
        .detail;
      if (detail?.role === actionAccount.role)
        setPendingQueueCount(detail.count);
    };
    window.addEventListener(PENDING_QUEUE_COUNT_EVENT, syncPublishedCount);
    return () => {
      active = false;
      window.removeEventListener(PENDING_QUEUE_COUNT_EVENT, syncPublishedCount);
    };
  }, [account, projectManager]);

  useEffect(() => {
    if (!selectedActionType) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedActionType(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedActionType]);

  const summary = useMemo(() => {
    const attention = records.filter(
      (record) => account && needsAction(record, effectiveRole, account.id),
    ).length;
    const completed = records.filter((record) =>
      completedStatuses.has(record.status),
    ).length;
    const returned = records.filter((record) =>
      returnedStatuses.has(record.status),
    ).length;
    const inProgress = records.filter(
      (record) =>
        !completedStatuses.has(record.status) &&
        !returnedStatuses.has(record.status) &&
        !inactiveStatuses.has(record.status),
    ).length;
    return { attention, completed, returned, inProgress };
  }, [account, effectiveRole, records]);
  const recentMatching = useMemo(
    () =>
      records
        .filter(
          (record) =>
            recentTypeFilter === "ALL" || record.type === recentTypeFilter,
        )
        .filter((record) => {
          if (recentStatusFilter === "COMPLETED")
            return completedStatuses.has(record.status);
          if (recentStatusFilter === "IN_PROGRESS")
            return (
              !completedStatuses.has(record.status) &&
              !returnedStatuses.has(record.status) &&
              !inactiveStatuses.has(record.status)
            );
          return true;
        })
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    [recentStatusFilter, recentTypeFilter, records],
  );
  const recent = useMemo(
    () =>
      recentMatching.slice(
        0,
        account?.role === "staff" && !projectManager ? 10 : 8,
      ),
    [account?.role, projectManager, recentMatching],
  );
  const actionRecords = useMemo(
    () =>
      records
        .filter(
          (record) => account && needsAction(record, effectiveRole, account.id),
        )
        .sort(
          (a, b) =>
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
        ),
    [account, effectiveRole, records],
  );
  const actionCounts = useMemo(
    () =>
      Object.fromEntries(
        typeOrder.map((type) => [
          type,
          actionRecords.filter((record) => record.type === type).length,
        ]),
      ) as Record<DashboardType, number>,
    [actionRecords],
  );
  const expenditureMonths = useMemo(
    () => monthlyExpenditure(analyticsRecords, analyticsRange),
    [analyticsRange, analyticsRecords],
  );
  const expenditureMaximum = Math.max(
    ...expenditureMonths.map((month) => month.total),
    0,
  );
  const expenditureScaleMaximum = chartMaximum(expenditureMaximum);
  const expenditureScaleTicks = [1, 0.75, 0.5, 0.25, 0].map(
    (ratio) => expenditureScaleMaximum * ratio,
  );
  const expenditureByType = Object.fromEntries(
    typeOrder.map((type) => [
      type,
      expenditureMonths.reduce((sum, month) => sum + month.values[type], 0),
    ]),
  ) as Record<DashboardType, number>;
  const expenditureTotal = expenditureMonths.reduce(
    (sum, month) => sum + month.total,
    0,
  );

  if (account?.role === "staff" && !projectManager)
    return <StaffDashboard account={account} />;

  if (account && (account.role === "manager" || projectManager))
    return <ManagerDashboard account={account} />;

  if (account && (["director"] as BetaRole[]).includes(account.role))
    return <DirectorDashboard account={account} />;

  if (account?.role === "finance" && activeFinanceWorkspace === "staff")
    return <StaffDashboard account={{ ...account, role: "staff" }} />;

  if (account?.role === "finance")
    return <FinanceDashboard account={account} />;

  if (loading || !account)
    return (
      <div className={styles.loading}>Loading your Estuary workspace…</div>
    );
  const routingAccount: BetaAccount =
    effectiveRole === account.role
      ? account
      : { ...account, role: effectiveRole };
  const isPlainStaff = account.role === "staff" && !projectManager;
  const copy = roleCopy[effectiveRole];
  const selectedActions = selectedActionType
    ? actionRecords.filter((record) => record.type === selectedActionType)
    : [];
  const selectedRequesterActions = selectedActions.filter((record) =>
    isRequesterActionRecord(record, account),
  );
  const selectedRoleActions = selectedActions.filter(
    (record) => !isRequesterActionRecord(record, account),
  );
  const resolved = summary.completed + summary.returned;
  const completionRate =
    resolved > 0 ? Math.round((summary.completed / resolved) * 100) : 0;
  const reconciliations = records.filter(
    (record) =>
      ["CASH_ADVANCE", "PETTY_CASH"].includes(record.type) &&
      [
        "PENDING_RECONCILIATION",
        "PENDING_FINANCE_RECONCILIATION",
        "RECONCILED",
      ].includes(record.status),
  );
  const reconciliationRate = reconciliations.length
    ? Math.round(
        (reconciliations.filter((record) => record.status === "RECONCILED")
          .length /
          reconciliations.length) *
          100,
      )
    : 0;
  const pendingReconciliations = records.filter(
    (record) =>
      ["CASH_ADVANCE", "PETTY_CASH"].includes(record.type) &&
      ["PENDING_RECONCILIATION", "PROCESSED_PENDING_RECONCILIATION"].includes(
        record.status,
      ),
  ).length;
  const actionCopy: Record<BetaRole, { title: string; detail: string }> = {
    staff: {
      title: "Requester follow-up",
      detail:
        "Continue drafts, respond to corrections, complete confirmations and submit required reconciliation.",
    },
    manager: {
      title: "Pending approvals and requester follow-up",
      detail:
        "Review assigned requests here; your own returned, rejected or reconciliation work remains under My Requests.",
    },
    director: {
      title: "Pending approvals and requester follow-up",
      detail:
        "Complete assigned Director actions here; your own returned, rejected or reconciliation work remains under My Requests.",
    },
    finance: {
      title: "Pending processing and requester follow-up",
      detail:
        "Process assigned Finance work here; your own returned, rejected or reconciliation work remains under My Requests.",
    },
  };
  const kpis =
    account.role === "staff" && !projectManager
      ? [
          {
            label: "My requests submitted",
            value: records.length,
            note: "Across all payment types",
          },
          {
            label: "My requests in progress",
            value: summary.inProgress,
            note: "Moving through the workflow",
          },
          {
            label: "My requests completed",
            value: summary.completed,
            note: "Paid or fully closed",
          },
          {
            label: "Cash advance pending reconciliation",
            value: pendingReconciliations,
            note: "Advance waiting for your action",
          },
          {
            label: "Completion rate",
            value: `${completionRate}%`,
            note: "Completed versus returned",
          },
        ]
      : projectManager || account.role === "manager"
        ? [
            {
              label: "Records visible to Manager",
              value: records.length,
              note: "Assigned and submitted records",
            },
            {
              label: "Pending manager approvals",
              value: pendingQueueCount,
              note: "Waiting for Manager action",
            },
            {
              label: "Completed payments",
              value: summary.completed,
              note: "Paid or fully closed",
            },
            {
              label: "Requests needing action",
              value: summary.attention,
              note: "Assigned approvals and follow-up",
            },
            {
              label: "Advance reconciliation rate",
              value: `${reconciliationRate}%`,
              note: "Cash Advance and Petty Cash",
            },
          ]
        : account.role === "director"
          ? [
              {
                label: "Records visible to Director",
                value: records.length,
                note: "Assigned and organization records",
              },
              {
                label: "Pending director approvals",
                value: pendingQueueCount,
                note: "Waiting for Director action",
              },
              {
                label: "Completed payments",
                value: summary.completed,
                note: "Paid or fully closed",
              },
              {
                label: "Advance reconciliation rate",
                value: `${reconciliationRate}%`,
                note: "Cash Advance and Petty Cash",
              },
            ]
          : [
              {
                label: "Payments received by Finance",
                value: records.length,
                note: "Across all payment types",
              },
              {
                label: "Pending finance processing",
                value: pendingQueueCount,
                note: "Waiting for Finance action",
              },
              {
                label: "Payments completed",
                value: summary.completed,
                note: "Paid or fully closed",
              },
              {
                label: "Advance reconciliation rate",
                value: `${reconciliationRate}%`,
                note: "Cash Advance and Petty Cash",
              },
            ];
  const visibleCreateOptions = createPaymentOptions.filter((option) => {
    if (option.type === "TRAVEL_ALLOWANCE")
      return projectManager || account.role === "manager";
    if (option.type === "PAYMENT_VOUCHER") return account.role !== "director";
    return true;
  });
  const greetingDate = new Intl.DateTimeFormat("en-MY", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);
  const greetingPeriod =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  const recentCreateType = recent[0]?.type;
  const recentCreateOption = visibleCreateOptions.find(
    (option) => option.type === recentCreateType,
  );

  return (
    <main className={styles.dashboard}>
      <section className={styles.hero}>
        <div>
          <p>
            {greetingPeriod}, {account.name.split(" ")[0]} · {greetingDate}
          </p>
          <h1>{copy.title}</h1>
          <span>{copy.description}</span>
        </div>
        <div className={styles.heroActions}>
          <button
            aria-expanded={makePaymentOpen}
            className={styles.makePaymentButton}
            onClick={() => setMakePaymentOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true">＋</span>{" "}
            {isPlainStaff ? "Request a payment" : "Make a payment"}
          </button>
          <Link
            className={styles.followUpLink}
            data-empty={summary.attention === 0}
            href={
              summary.attention > 0
                ? account.role === "staff" && !projectManager
                  ? "/beta/payment-records?scope=mine"
                  : projectManager || account.role === "manager"
                    ? "/beta/project-manager/pending-approvals"
                    : account.role === "director"
                      ? "/beta/director/pending-approvals"
                      : "/beta/finance/pending-processing"
                : "/beta/payment-records?scope=mine"
            }
          >
            {summary.attention > 0
              ? `${summary.attention} to follow up`
              : "All caught up"}
          </Link>
          {makePaymentOpen && (
            <div className={styles.makePaymentMenu}>
              {recentCreateOption && (
                <div className={styles.makePaymentGroup}>
                  <span>Recent</span>
                  <Link
                    data-type={recentCreateOption.type}
                    href={recentCreateOption.href}
                    onClick={() => setMakePaymentOpen(false)}
                  >
                    <i />
                    <b>{recentCreateOption.label}</b>
                    <small>{recentCreateOption.description}</small>
                    <em>Last used</em>
                  </Link>
                </div>
              )}
              <div className={styles.makePaymentGroup}>
                <span>All payment types</span>
                {visibleCreateOptions.map((option) => (
                  <Link
                    data-type={option.type}
                    href={option.href}
                    key={option.type}
                    onClick={() => setMakePaymentOpen(false)}
                  >
                    <i />
                    <b>{option.label}</b>
                    <small>{option.description}</small>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {warnings.length > 0 && (
        <div className={styles.warning} role="status">
          Showing available data. {warnings.join(" ")}
        </div>
      )}

      {isPlainStaff ? (
        <section className={styles.staffKpis} aria-label="My request summary">
          <Link
            className={styles.staffKpiCard}
            data-tone="action"
            href="/beta/payment-records?scope=mine&summary=ACTION"
          >
            <span>Needs your action</span>
            <strong>{summary.attention}</strong>
            <small>Requests waiting for your follow-up</small>
            <i aria-hidden="true">!</i>
          </Link>
          <Link
            className={styles.staffKpiCard}
            data-tone="progress"
            href="/beta/payment-records?scope=mine&summary=PROGRESS"
          >
            <span>In progress</span>
            <strong>{summary.inProgress}</strong>
            <small>Awaiting approval or processing</small>
            <i aria-hidden="true">◷</i>
          </Link>
          <Link
            className={styles.staffKpiCard}
            data-tone="completed"
            href="/beta/payment-records?scope=mine&summary=COMPLETED"
          >
            <span>Completed</span>
            <strong>{summary.completed}</strong>
            <small>Paid or fully closed</small>
            <i aria-hidden="true">✓</i>
          </Link>
        </section>
      ) : (
        <section
          className={styles.roleKpis}
          data-count={kpis.length}
          aria-label={`${account.position} dashboard metrics`}
        >
          {kpis.map((kpi, index) => {
            const percentage =
              typeof kpi.value === "string" && kpi.value.endsWith("%")
                ? Math.min(100, Math.max(0, Number.parseFloat(kpi.value)))
                : null;
            const iconPath = dashboardKpiIcons[index];

            return (
              <article
                data-tone={
                  percentage !== null
                    ? "reconciliation"
                    : index === 0
                      ? "blue"
                      : index === 1
                        ? "amber"
                        : index === 2
                          ? "green"
                          : "red"
                }
                key={kpi.label}
              >
                <span className={styles.kpiVisual} aria-hidden="true">
                  {percentage !== null ? (
                    <svg className={styles.kpiRing} viewBox="0 0 36 36">
                      <circle
                        className={styles.kpiRingTrack}
                        cx="18"
                        cy="18"
                        r="15.5"
                      />
                      <circle
                        className={styles.kpiRingValue}
                        cx="18"
                        cy="18"
                        pathLength="100"
                        r="15.5"
                        strokeDasharray={`${percentage} 100`}
                      />
                    </svg>
                  ) : iconPath ? (
                    <Image
                      className={styles.kpiIcon}
                      src={iconPath}
                      alt=""
                      width={96}
                      height={96}
                    />
                  ) : null}
                </span>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <small>{kpi.note}</small>
                <Link
                  href={
                    account.role === "staff" && !projectManager
                      ? kpi.label === "My requests in progress"
                        ? "/beta/payment-records?scope=mine&summary=PROGRESS"
                        : kpi.label === "My requests completed" ||
                            kpi.label === "Completion rate"
                          ? "/beta/payment-records?scope=mine&summary=COMPLETED"
                          : kpi.label === "Cash advance pending reconciliation"
                            ? "/beta/payment-records?scope=mine&summary=ACTION&type=CASH_ADVANCE&status=PENDING_RECONCILIATION"
                            : "/beta/payment-records?scope=mine"
                      : index === 1
                        ? projectManager || account.role === "manager"
                          ? "/beta/project-manager/pending-approvals"
                          : account.role === "director"
                            ? "/beta/director/pending-approvals"
                            : "/beta/finance/pending-processing"
                        : kpi.label.toLowerCase().includes("completed")
                          ? "/beta/payment-records?group=COMPLETED"
                          : kpi.label.toLowerCase().includes("reconciliation")
                            ? "/beta/payment-records?group=RECONCILED"
                            : "/beta/payment-records"
                  }
                >
                  {kpi.label === "Cash advance pending reconciliation"
                    ? "Reconcile now"
                    : "View list"}
                </Link>
              </article>
            );
          })}
        </section>
      )}

      {isPlainStaff ? (
        <section
          className={styles.staffActionPanel}
          data-empty={summary.attention === 0}
          aria-label="Needs your action"
        >
          <header className={styles.staffActionHeader}>
            <div>
              <h2>
                <span aria-hidden="true">!</span> Needs your action
              </h2>
              <p>
                These requests need a response from you before they can move
                forward.
              </p>
            </div>
            <strong>
              {summary.attention} request{summary.attention === 1 ? "" : "s"}
            </strong>
          </header>
          <div className={styles.staffActionList}>
            {typeOrder
              .filter((type) => actionCounts[type] > 0)
              .map((type) => (
                <div
                  className={styles.staffActionRow}
                  data-type={type}
                  key={type}
                >
                  <i>{typeCodes[type]}</i>
                  <div>
                    <strong>{typeLabels[type]}</strong>
                    <span>
                      {actionCounts[type]} request
                      {actionCounts[type] === 1 ? "" : "s"} need follow-up
                    </span>
                  </div>
                  <Link href={myRequestsHref(type, { actionOnly: true })}>
                    Review {typeLabels[type].toLowerCase()} →
                  </Link>
                </div>
              ))}
            {summary.attention === 0 && (
              <div className={styles.staffActionEmpty}>
                All caught up. Nothing needs your action right now.
              </div>
            )}
          </div>
        </section>
      ) : (
        <section
          className={styles.actionPanel}
          data-empty={summary.attention === 0}
          aria-label="Needs your action"
        >
          <header>
            <span>
              {summary.attention === 0
                ? "✓ All caught up"
                : "● Action required"}
            </span>
            <h2>
              {summary.attention === 0
                ? "Nothing needs your action right now"
                : `Need your action (${summary.attention} item${summary.attention === 1 ? "" : "s"} waiting)`}
            </h2>
            <p>{actionCopy[effectiveRole].detail}</p>
          </header>
          <div className={styles.actionTypes}>
            {typeOrder.map((type) => (
              <button
                aria-label={`${typeLabels[type]}: ${actionCounts[type]} actions`}
                data-active={selectedActionType === type}
                data-type={type}
                disabled={actionCounts[type] === 0}
                key={type}
                onClick={() => setSelectedActionType(type)}
                type="button"
              >
                <span>{typeLabels[type]}</span>
                <strong>{actionCounts[type]}</strong>
                <small>
                  {actionCounts[type]
                    ? `${actionCounts[type]} item${actionCounts[type] === 1 ? "" : "s"}`
                    : "No action"}
                </small>
              </button>
            ))}
          </div>
        </section>
      )}

      {!isPlainStaff && (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <p>Payment portfolio</p>
              <h2>Records by payment type</h2>
              <span>
                Counts and action items update from live request data.
              </span>
            </div>
          </div>
          <div className={styles.typeGrid}>
            {typeOrder.map((type) => {
              const items = records.filter((record) => record.type === type);
              const attention = items.filter((record) =>
                needsAction(record, effectiveRole, account.id),
              ).length;
              return (
                <Link
                  className={styles.typeCard}
                  data-type={type}
                  href={typeHref(type, effectiveRole)}
                  key={type}
                >
                  <div className={styles.typeCardTop}>
                    <i>{typeCodes[type]}</i>
                    <span
                      className={styles.actionBadge}
                      data-attention={attention > 0}
                    >
                      {attention > 0
                        ? `${attention} need${attention === 1 ? "s" : ""} your action`
                        : "No action required"}
                    </span>
                  </div>
                  <h3>{typeLabels[type]}</h3>
                  <small>
                    {items.length} record{items.length === 1 ? "" : "s"} tracked
                  </small>
                  <footer>
                    <b>View</b>
                  </footer>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(["director", "finance"] as BetaRole[]).includes(account.role) && (
        <section className={`${styles.section} ${styles.analyticsSection}`}>
          <div className={styles.analyticsHeading}>
            <div>
              <p>Expenditure analytics</p>
              <h2>Monthly completed expenditure</h2>
              <span>
                Organization-wide paid and completed amounts, shared across all
                Director and Finance dashboards.
              </span>
            </div>
            <div
              className={styles.rangeTabs}
              aria-label="Expenditure period"
              role="group"
            >
              {(Object.keys(analyticsRangeLabels) as AnalyticsRange[]).map(
                (range) => (
                  <button
                    aria-pressed={analyticsRange === range}
                    data-active={analyticsRange === range}
                    key={range}
                    onClick={() => setAnalyticsRange(range)}
                    type="button"
                  >
                    {analyticsRangeLabels[range]}
                  </button>
                ),
              )}
            </div>
          </div>
          <div
            className={styles.analyticsTypeCards}
            aria-label="Completed expenditure by payment type"
          >
            {typeOrder.map((type) => (
              <article className={styles.analyticsTypeCard} key={type}>
                <span>
                  <i data-type={type} />
                  {typeCodes[type]}
                </span>
                <strong>{money(expenditureByType[type])}</strong>
                <small>{typeLabels[type]}</small>
              </article>
            ))}
          </div>
          {expenditureMaximum === 0 ? (
            <div className={styles.analyticsEmpty}>
              <h3>No completed expenditure yet</h3>
              <p>Paid or completed records will appear in this chart.</p>
            </div>
          ) : (
            <>
              <div className={styles.chartViewport}>
                <div
                  className={styles.chartFrame}
                  style={{
                    minWidth: `${Math.max(720, expenditureMonths.length * 104 + 58)}px`,
                  }}
                >
                  <div className={styles.chartScale} aria-hidden="true">
                    {expenditureScaleTicks.map((tick) => (
                      <span key={tick}>{scaleMoney(tick)}</span>
                    ))}
                  </div>
                  <div className={styles.chart}>
                    {expenditureMonths.map((month) => (
                      <div className={styles.chartColumn} key={month.key}>
                        <strong>
                          {month.total > 0 ? money(month.total) : ""}
                        </strong>
                        <div
                          className={styles.chartBar}
                          aria-label={`${month.label}: ${money(month.total)}`}
                        >
                          {typeOrder.map(
                            (type) =>
                              month.values[type] > 0 && (
                                <span
                                  data-type={type}
                                  key={type}
                                  style={{
                                    height: `${(month.values[type] / expenditureScaleMaximum) * 100}%`,
                                  }}
                                  title={`${typeLabels[type]}: ${money(month.values[type])}`}
                                />
                              ),
                          )}
                        </div>
                        <small>{month.label}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.analyticsFooter}>
                <span>
                  <i />
                  Completed expenditure in this period
                </span>
                <strong>{money(expenditureTotal)}</strong>
              </div>
            </>
          )}
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p>Recent activity</p>
            <h2>
              {account.role === "staff" && !projectManager
                ? "My latest payments and requests"
                : "Latest records visible to your role"}
            </h2>
            <span>
              Combined activity from every supported payment workflow.
            </span>
          </div>
          <Link
            href={
              account.role === "staff" && !projectManager
                ? "/beta/payment-records?scope=mine"
                : "/beta/payment-records"
            }
          >
            View all records
          </Link>
        </div>
        {isPlainStaff && (
          <div className={styles.recentFilters}>
            <div
              aria-label="Filter recent requests by status"
              className={styles.recentStatusTabs}
            >
              {(
                [
                  ["ALL", "All requests"],
                  ["IN_PROGRESS", "In progress"],
                  ["COMPLETED", "Completed"],
                ] as const
              ).map(([value, label]) => (
                <button
                  aria-pressed={recentStatusFilter === value}
                  key={value}
                  onClick={() => setRecentStatusFilter(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <label className={styles.recentTypeFilter}>
              <span>Payment type</span>
              <select
                onChange={(event) =>
                  setRecentTypeFilter(
                    event.target.value as "ALL" | DashboardType,
                  )
                }
                value={recentTypeFilter}
              >
                <option value="ALL">All types</option>
                {typeOrder.map((type) => (
                  <option key={type} value={type}>
                    {typeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {recent.length === 0 ? (
          <div className={styles.empty}>
            <h3>No records yet</h3>
            <p>New Payment Vouchers and Payment Requests will appear here.</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  {!isPlainStaff && <th>Type</th>}
                  <th>Requester</th>
                  <th>Amount</th>
                  <th>{isPlainStaff ? "Submitted" : "Updated"}</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((record) => (
                  <tr key={`${record.type}-${record.id}`}>
                    <td>
                      <strong>{record.reference}</strong>
                      {isPlainStaff && (
                        <small className={styles.referenceType}>
                          {record.typeLabel}
                        </small>
                      )}
                    </td>
                    {!isPlainStaff && <td>{record.typeLabel}</td>}
                    <td>{record.requesterName}</td>
                    <td>
                      <strong>{money(record.amount)}</strong>
                    </td>
                    <td>{date(record.updatedAt)}</td>
                    <td>
                      <span
                        className={styles.status}
                        data-status={record.status}
                        data-tone={tone(record, effectiveRole, account.id)}
                      >
                        {record.statusLabel}
                      </span>
                    </td>
                    <td>
                      <MyRequestAction
                        label="Open"
                        onDraftDeleted={() => undefined}
                        organizationId="beta-arus-org"
                        record={{
                          id: record.id,
                          type: modalPaymentType(record.type),
                          reference: record.reference,
                          purpose: record.typeLabel,
                          amount: record.amount,
                          href: record.href,
                          draft: false,
                        }}
                        requesterId={account.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isPlainStaff && (
              <div className={styles.recentTableFooter}>
                Showing {recent.length} of {recentMatching.length} requests
              </div>
            )}
          </div>
        )}
      </section>
      {selectedActionType && (
        <div
          className={styles.drawerBackdrop}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target)
              setSelectedActionType(null);
          }}
          role="presentation"
        >
          <aside
            aria-label={`${typeLabels[selectedActionType]} actions`}
            aria-modal="true"
            className={styles.actionDrawer}
            data-type={selectedActionType}
            role="dialog"
          >
            <header>
              <div>
                <span>
                  <i>{typeCodes[selectedActionType]}</i> Need your action
                </span>
                <h2>{typeLabels[selectedActionType]}</h2>
                <p>
                  {selectedActions.length} item
                  {selectedActions.length === 1 ? "" : "s"} waiting for you
                </p>
              </div>
              <button
                aria-label="Close action drawer"
                onClick={() => setSelectedActionType(null)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className={styles.drawerList}>
              {selectedActions.slice(0, 10).map((record) => (
                <Link
                  href={pendingRecordHref(record, routingAccount)}
                  key={`${record.type}-${record.id}`}
                >
                  <div>
                    <strong>{record.reference}</strong>
                    <span>
                      {record.requesterName} · {date(record.updatedAt)}
                    </span>
                    <small data-tone={tone(record, effectiveRole, account.id)}>
                      {record.statusLabel}
                    </small>
                  </div>
                  <b>{money(record.amount)}</b>
                  <i aria-hidden="true">›</i>
                </Link>
              ))}
            </div>
            <footer>
              {selectedRequesterActions.length > 0 && (
                <Link
                  href={myRequestsHref(selectedActionType, {
                    actionOnly: true,
                  })}
                >
                  View {selectedRequesterActions.length === 1 ? "" : "all "}
                  {selectedRequesterActions.length} of my{" "}
                  {typeLabels[selectedActionType]} →
                </Link>
              )}
              {selectedRoleActions.length > 0 && effectiveRole !== "staff" && (
                <Link href={typeHref(selectedActionType, effectiveRole)}>
                  View {selectedRoleActions.length === 1 ? "" : "all "}
                  {selectedRoleActions.length} pending{" "}
                  {typeLabels[selectedActionType]} →
                </Link>
              )}
              <small>
                Your own requests open in My Requests. Assigned approvals and
                processing stay in the role queue. Press Esc to close.
              </small>
            </footer>
          </aside>
        </div>
      )}
    </main>
  );
}

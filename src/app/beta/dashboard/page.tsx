"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { fetchDashboardSummary } from "@/data/dashboard/api";
import type {
  DashboardSummaryPaymentType,
  DashboardSummaryRecord,
} from "@/domain/dashboard/types";
import { getPaymentVoucherStatusLabel } from "@/domain/payment-vouchers/status";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import {
  readBetaSession,
  type BetaAccount,
  type BetaRole,
} from "@/lib/auth/beta-accounts";

import styles from "./dashboard.module.css";

type DashboardType = DashboardSummaryPaymentType;
type Tone = "blue" | "amber" | "green" | "red" | "gray";
type AnalyticsRange = "LAST_6_MONTHS" | "THIS_YEAR" | "ALL_TIME";
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

function myRequestHref(type: DashboardType, id: string) {
  const encoded = encodeURIComponent(id);
  if (type === "PAYMENT_VOUCHER") return `/beta/payment-vouchers/${encoded}`;
  if (type === "INVOICE_PAYMENT")
    return `/beta/payment-records/invoice-payments/${encoded}`;
  if (type === "TRAVEL_ALLOWANCE")
    return `/beta/payment-records/travel-allowances/${encoded}`;
  if (type === "EXPENSE_CLAIM")
    return `/beta/payment-records/claims/${encoded}`;
  if (type === "PETTY_CASH")
    return `/beta/payment-records/petty-cash/${encoded}`;
  return `/beta/payment-records/cash-advances/${encoded}`;
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
  if (account.role === "staff" || requesterAction) return myRequestHref(type, id);
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

  if (type === "PAYMENT_VOUCHER") return "/beta/payment-vouchers";
  if (type === "EXPENSE_CLAIM") return "/beta/payment-records/claims";

  const staffRecords: Record<
    Exclude<DashboardType, "PAYMENT_VOUCHER" | "EXPENSE_CLAIM">,
    string
  > = {
    INVOICE_PAYMENT: "/beta/payment-records/invoice-payments",
    TRAVEL_ALLOWANCE: "/beta/payment-records/travel-allowances",
    CASH_ADVANCE: "/beta/payment-records/cash-advances",
    PETTY_CASH: "/beta/payment-records/petty-cash",
  };
  return staffRecords[type as keyof typeof staffRecords];
}

function myRequestRecordHref(record: DashboardRecord) {
  return myRequestHref(record.type, record.id);
}

function pendingRecordHref(record: DashboardRecord, account: BetaAccount) {
  const isRequesterAction =
    record.requesterId === account.id && requesterActionStatuses.has(record.status);
  if (account.role === "staff" || isRequesterAction)
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
    if (requesterActionStatuses.has(record.status))
      return true;
  }
  return false;
}

function needsRoleAction(record: DashboardRecord, role: BetaRole, userId: string) {
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
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
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

  useEffect(() => {
    if (!account) {
      router.replace("/beta");
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
  }, [account, router]);

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
      (record) => account && needsAction(record, account.role, account.id),
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
  }, [account, records]);
  const recent = useMemo(
    () =>
      [...records]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 8),
    [records],
  );
  const actionRecords = useMemo(
    () =>
      records
        .filter(
          (record) => account && needsAction(record, account.role, account.id),
        )
        .sort(
          (a, b) =>
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
        ),
    [account, records],
  );
  const requesterActionCount = useMemo(
    () =>
      records.filter(
        (record) => account && needsRequesterAction(record, account.id),
      ).length,
    [account, records],
  );
  const roleActionCount = useMemo(
    () =>
      records.filter(
        (record) =>
          account && needsRoleAction(record, account.role, account.id),
      ).length,
    [account, records],
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

  if (loading || !account)
    return (
      <div className={styles.loading}>Loading your Estuary workspace…</div>
    );
  const copy = roleCopy[account.role];
  const selectedActions = selectedActionType
    ? actionRecords.filter((record) => record.type === selectedActionType)
    : [];
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
  const actionCopy: Record<BetaRole, { title: string; detail: string }> = {
    staff: {
      title: `${summary.attention} item${summary.attention === 1 ? "" : "s"} waiting for you`,
      detail:
        "Continue drafts, respond to corrections, complete confirmations and submit required reconciliation.",
    },
    manager: {
      title: `${summary.attention} item${summary.attention === 1 ? "" : "s"}: ${roleActionCount} Pending Approvals + ${requesterActionCount} My Requests`,
      detail:
        "Review assigned requests here; your own returned, rejected or reconciliation work remains under My Requests.",
    },
    director: {
      title: `${summary.attention} item${summary.attention === 1 ? "" : "s"}: ${roleActionCount} Pending Approvals + ${requesterActionCount} My Requests`,
      detail:
        "Complete assigned Director actions here; your own returned, rejected or reconciliation work remains under My Requests.",
    },
    finance: {
      title: `${summary.attention} item${summary.attention === 1 ? "" : "s"}: ${roleActionCount} Pending Processing + ${requesterActionCount} My Requests`,
      detail:
        "Process assigned Finance work here; your own returned, rejected or reconciliation work remains under My Requests.",
    },
  };
  const kpis =
    account.role === "staff"
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
            label: "Completion rate",
            value: `${completionRate}%`,
            note: "Completed versus returned",
          },
        ]
      : account.role === "manager"
        ? [
            {
              label: "Records visible to Manager",
              value: records.length,
              note: "Assigned and submitted records",
            },
            {
              label: "Awaiting Manager action",
              value: summary.attention,
              note: "Reviews and previews required",
            },
            {
              label: "Beyond Manager review",
              value: Math.max(0, summary.inProgress - summary.attention),
              note: "Progressing to Director or Finance",
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
        : account.role === "director"
          ? [
              {
                label: "Records visible to Director",
                value: records.length,
                note: "Assigned and organization records",
              },
              {
                label: "Awaiting Director action",
                value: summary.attention,
                note: "Approvals and exceptions required",
              },
              {
                label: "Forwarded beyond Director",
                value: Math.max(0, summary.inProgress - summary.attention),
                note: "Progressing through Finance",
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
                label: "Awaiting Finance action",
                value: summary.attention,
                note: "Verification or processing required",
              },
              {
                label: "In Finance workflow",
                value: Math.max(0, summary.inProgress - summary.attention),
                note: "Already progressing",
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

  return (
    <main className={styles.dashboard}>
      <section className={styles.hero}>
        <div>
          <p>Dashboard · {account.position}</p>
          <h1>{copy.title}</h1>
          <span>{copy.description}</span>
        </div>
      </section>

      {warnings.length > 0 && (
        <div className={styles.warning} role="status">
          Showing available data. {warnings.join(" ")}
        </div>
      )}

      <section
        className={styles.actionPanel}
        data-empty={summary.attention === 0}
        aria-label="Needs your action"
      >
        <header>
          <span>● Action required</span>
          <h2>
            Need your action <small>({actionCopy[account.role].title})</small>
          </h2>
          <p>{actionCopy[account.role].detail}</p>
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

      <section
        className={styles.roleKpis}
        data-count={kpis.length}
        aria-label={`${account.position} dashboard metrics`}
      >
        {kpis.map((kpi) => (
          <article key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.note}</small>
          </article>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p>Payment portfolio</p>
            <h2>Records by payment type</h2>
            <span>Counts and action items update from live request data.</span>
          </div>
        </div>
        <div className={styles.typeGrid}>
          {typeOrder.map((type) => {
            const items = records.filter((record) => record.type === type);
            const attention = items.filter((record) =>
              needsAction(record, account.role, account.id),
            ).length;
            const total = items.reduce((sum, record) => sum + record.amount, 0);
            return (
              <Link
                className={styles.typeCard}
                data-type={type}
                href={typeHref(type, account.role)}
                key={type}
                prefetch={false}
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
                <div className={styles.volume}>
                  <span>Total Requested</span>
                  <strong>{money(total)}</strong>
                </div>
                <footer>
                  <b>View category →</b>
                </footer>
              </Link>
            );
          })}
        </div>
      </section>

      {(account.role === "director" || account.role === "finance") && (
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
              {account.role === "staff"
                ? "My latest payments and requests"
                : "Latest records visible to your role"}
            </h2>
            <span>
              Combined activity from every supported payment workflow.
            </span>
          </div>
          <Link
            href={
              account.role === "staff"
                ? "/beta/payment-records?scope=mine"
                : "/beta/payment-records"
            }
            prefetch={false}
          >
            View all records
          </Link>
        </div>
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
                  <th>Type</th>
                  <th>Requester</th>
                  <th>Amount</th>
                  <th>Updated</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((record) => (
                  <tr key={`${record.type}-${record.id}`}>
                    <td>
                      <strong>{record.reference}</strong>
                    </td>
                    <td>{record.typeLabel}</td>
                    <td>{record.requesterName}</td>
                    <td>
                      <strong>{money(record.amount)}</strong>
                    </td>
                    <td>{date(record.updatedAt)}</td>
                    <td>
                      <span
                        className={styles.status}
                        data-tone={tone(record, account.role, account.id)}
                      >
                        {record.statusLabel}
                      </span>
                    </td>
                    <td>
                      <Link href={record.href} prefetch={false}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  href={pendingRecordHref(record, account)}
                  key={`${record.type}-${record.id}`}
                  prefetch={false}
                >
                  <div>
                    <strong>{record.reference}</strong>
                    <span>
                      {record.requesterName} · {date(record.updatedAt)}
                    </span>
                    <small data-tone={tone(record, account.role, account.id)}>
                      {record.statusLabel}
                    </small>
                  </div>
                  <b>{money(record.amount)}</b>
                  <i aria-hidden="true">›</i>
                </Link>
              ))}
            </div>
            <footer>
              <Link href={typeHref(selectedActionType, account.role)} prefetch={false}>
                View all {selectedActions.length}{" "}
                {typeLabels[selectedActionType]} →
              </Link>
              <small>
                Select a record to open its full action page. Press Esc to
                close.
              </small>
            </footer>
          </aside>
        </div>
      )}
    </main>
  );
}

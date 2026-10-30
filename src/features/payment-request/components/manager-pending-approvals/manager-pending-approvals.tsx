"use client";

import { useEffect, useMemo, useState } from "react";

import {
  fetchCashAdvances,
  previewCashAdvanceByManager,
} from "@/data/payment-requests/cash-advance/cash-advance-api";
import {
  fetchInvoicePayments,
  reviewInvoicePaymentByManager,
} from "@/data/payment-requests/invoice-payment/api";
import {
  approvePettyCashByManager,
  fetchPettyCashRequests,
} from "@/data/payment-requests/petty-cash/api";
import {
  fetchTravelAllowances,
  reviewTravelAllowanceByManager,
} from "@/data/payment-requests/travel-allowance/api";
import { usePaymentVouchers } from "@/features/payment-voucher/hooks/use-payment-vouchers";
import { markPaymentVoucherManagerViewed } from "@/data/payment-vouchers/payment-voucher-api";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import { travelLineTotal } from "@/domain/payment-requests/travel-allowance/types";
import { amountToMalayWords } from "@/lib/currency/amount-words";
import { fetchSidebarActionCounts } from "@/app/beta/sidebar-action-counts";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "./manager-pending-approvals.module.css";
import filterStyles from "./manager-pending-approvals-filter.module.css";

type PaymentType = "PV" | "PC" | "INV" | "TA" | "CA" | "CL";
type ApprovalRow = {
  key: string;
  id: string;
  type: PaymentType;
  reference: string;
  requester: string;
  requesterRole?: string;
  programme: string;
  amount: number;
  submittedAt: string;
  status: string;
  stage: string;
  actionable: boolean;
  reviewed: boolean;
  details: Array<{ label: string; value: string }>;
  lines: Array<{ label: string; description: string; amount?: number }>;
  documents: Array<{ name: string; href: string; download?: string }>;
  href: string;
  voucher?: PaymentVoucherRecord;
};

const tabs: Array<{ value: PaymentType; label: string; colour: string }> = [
  { value: "PV", label: "Payment Voucher", colour: "#2563eb" },
  { value: "PC", label: "Petty Cash", colour: "#ffffff" },
  { value: "INV", label: "Invoice Payment", colour: "#10b981" },
  { value: "TA", label: "Travel Allowance", colour: "#f59e0b" },
  { value: "CA", label: "Cash Advance", colour: "#e11d48" },
  { value: "CL", label: "Claims", colour: "#111827" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function date(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function typeDetail(row: ApprovalRow) {
  const label =
    row.type === "CL"
      ? "Claim type"
      : row.type === "PC"
        ? "Location"
        : row.type === "INV"
          ? "Vendor"
          : row.type === "PV"
            ? "Division"
            : "Project";
  return (
    row.details.find((item) => item.label === label)?.value ?? row.programme
  );
}

function initialStatus() {
  return "ALL_PENDING";
}

export function ManagerPendingApprovals() {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeType, setActiveType] = useState<PaymentType>("PV");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL_PENDING");
  const [claimTypeFilter, setClaimTypeFilter] = useState("ALL");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<"OLDEST" | "NEWEST" | "AMOUNT_DESC">(
    "OLDEST",
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [reviewedKeys, setReviewedKeys] = useState<string[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [standaloneReview, setStandaloneReview] = useState<ApprovalRow | null>(
    null,
  );
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const {
    records: vouchers,
    isLoading: vouchersLoading,
    refresh: refreshVouchers,
  } = usePaymentVouchers();

  useEffect(() => {
    const requestedType = new URLSearchParams(window.location.search).get(
      "type",
    ) as PaymentType | null;
    if (!requestedType || !tabs.some((tab) => tab.value === requestedType))
      return;
    setActiveType(requestedType);
    setStatusFilter(initialStatus());
    setClaimTypeFilter("ALL");
  }, []);

  useEffect(() => {
    if (!account || account.role !== "manager") return;
    let cancelled = false;
    Promise.all([
      fetchInvoicePayments({
        role: "manager",
        userId: account.id,
        includeAll: true,
      }),
      fetchTravelAllowances({
        role: "manager",
        userId: account.id,
        includeAll: true,
      }),
      fetchCashAdvances({
        role: "manager",
        userId: account.id,
        includeAll: true,
      }),
      fetchPettyCashRequests({
        role: "manager",
        userId: account.id,
        includeAll: true,
      }),
    ])
      .then(([invoices, travel, cash, petty]) => {
        if (cancelled) return;
        const next: ApprovalRow[] = [
          ...invoices
            .filter((record) => record.managerApproverId === account.id)
            .map((record) => ({
              key: `INV:${record.id}`,
              id: record.id,
              type: "INV" as const,
              reference: record.requestNumber,
              requester: record.staffName,
              programme: record.projectName,
              amount: record.totalAmount,
              submittedAt: record.requestDate,
              status: record.status,
              stage:
                record.status === "PENDING_MANAGER_REVIEW"
                  ? "Pending Manager Review"
                  : record.status === "PENDING_DIRECTOR_REVIEW"
                    ? "Pending Director Review"
                    : record.status.replaceAll("_", " "),
              actionable: record.status === "PENDING_MANAGER_REVIEW",
              reviewed: record.status !== "PENDING_MANAGER_REVIEW",
              details: [
                { label: "Vendor", value: record.vendorName },
                { label: "Purpose", value: record.purpose },
                { label: "Project", value: record.projectName },
                { label: "Payment portion", value: record.paymentPortion },
              ],
              lines: [
                {
                  label: record.vendorName,
                  description: record.purpose,
                  amount: record.totalAmount,
                },
              ],
              documents: record.supportingDocuments.map((document) => ({
                name: document.fileName,
                href: document.dataUrl,
                download: document.fileName,
              })),
              href: `/beta/project-manager/payment-requests/invoice-payments/${record.id}`,
            })),
          ...travel
            .filter((record) => record.managerApproverId === account.id)
            .map((record) => ({
              key: `TA:${record.id}`,
              id: record.id,
              type: "TA" as const,
              reference: record.requestNumber,
              requester: record.requesterName,
              requesterRole: record.requesterPosition,
              programme: record.lines[0]?.projectName ?? "—",
              amount: record.totalAmount,
              submittedAt: record.requestDate,
              status: record.status,
              stage:
                record.status === "PENDING_MANAGER_REVIEW"
                  ? "Pending Manager Review"
                  : record.status === "PENDING_DIRECTOR_APPROVAL"
                    ? "Pending Director Review"
                    : record.status === "PENDING_FINANCE_VERIFICATION"
                      ? "Pending Finance Verification"
                      : record.status === "COMPLETED"
                        ? "Completed"
                        : record.status.replaceAll("_", " "),
              actionable: record.status === "PENDING_MANAGER_REVIEW",
              reviewed: record.status !== "PENDING_MANAGER_REVIEW",
              details: [
                { label: "Entries", value: String(record.lines.length) },
                {
                  label: "Travel month",
                  value: record.lines[0]?.travelDate?.slice(0, 7) ?? "—",
                },
                {
                  label: "Project",
                  value: record.lines[0]?.projectName ?? "—",
                },
              ],
              lines: record.lines.map((line) => ({
                label: line.employeeName,
                description: `${date(line.travelDate)} · ${line.projectName} · ${line.reason} · ${line.meals.join(", ") || "No meals"}`,
                amount: travelLineTotal(line),
              })),
              documents: record.supportingDocuments.map((document) => ({
                name: document.fileName,
                href: document.dataUrl,
                download: document.fileName,
              })),
              href: `/beta/project-manager/payment-requests/travel-allowances/${record.id}`,
            })),
          ...cash
            .filter((record) => record.managerApproverId === account.id)
            .map((record) => ({
              key: `CA:${record.id}`,
              id: record.id,
              type: "CA" as const,
              reference: record.requestNumber,
              requester: record.requesterName,
              requesterRole: record.requesterPosition,
              programme: record.projectName,
              amount: record.totalAmount,
              submittedAt: record.requestDate,
              status: record.status,
              stage: record.managerPreviewedAt ? "Viewed" : "Preview",
              actionable:
                !record.managerPreviewedAt &&
                !["RETURNED_TO_STAFF", "COMPLETED"].includes(record.status),
              reviewed: Boolean(record.managerPreviewedAt),
              details: [
                { label: "Project", value: record.projectName },
                { label: "Purpose", value: record.purpose },
                { label: "Entries", value: String(record.lines.length) },
              ],
              lines: record.lines.map((line) => ({
                label: line.description,
                description: line.purpose,
                amount: line.amount,
              })),
              documents: record.supportingDocuments.map((document) => ({
                name: document.fileName,
                href: document.dataUrl,
                download: document.fileName,
              })),
              href: `/beta/project-manager/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}`,
            })),
          ...petty
            .filter(
              (record) =>
                record.managerApproverId === account.id ||
                record.financeReviewerId === account.id,
            )
            .map((record) => ({
              key: `PC:${record.id}`,
              id: record.id,
              type: "PC" as const,
              reference: record.requestNumber,
              requester: record.requesterName,
              requesterRole: record.requesterPosition,
              programme:
                record.location === "PENANG" ? "Penang" : "Kuala Lumpur",
              amount: record.totalAmount,
              submittedAt: record.requestDate,
              status: record.status,
              stage: record.managerApprovedAt ? "Previewed" : "Needs preview",
              actionable:
                !record.managerApprovedAt &&
                !["RETURNED_TO_STAFF", "RECONCILED", "PAID"].includes(
                  record.status,
                ),
              reviewed: Boolean(record.managerApprovedAt),
              details: [
                {
                  label: "Location",
                  value:
                    record.location === "PENANG" ? "Penang" : "Kuala Lumpur",
                },
                { label: "Entries", value: String(record.lines.length) },
                { label: "Contact", value: record.requesterContact },
              ],
              lines: record.lines.map((line) => ({
                label: line.supplier,
                description: line.details,
                amount: line.amount,
              })),
              documents: record.lines
                .filter((line) => line.proofLink?.trim())
                .map((line, index) => ({
                  name: `${line.supplier || `Expense ${index + 1}`} proof`,
                  href: line.proofLink,
                })),
              href: `/beta/project-manager/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}`,
            })),
        ];
        setRows(next);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Pending approvals could not be loaded.",
        ),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account]);

  useEffect(() => {
    if (!account || account.role !== "manager") return;
    let cancelled = false;
    fetchSidebarActionCounts(account)
      .then((counts) => {
        if (!cancelled) setWaitingCount(counts.ALL_PENDING);
      })
      .catch(() => {
        if (!cancelled) setWaitingCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [account]);

  const voucherRows = useMemo<ApprovalRow[]>(() => {
    if (!account) return [];
    return vouchers
      .filter(
        (voucher) =>
          voucher.projectManagerId === account.id &&
          voucher.status === "APPROVED_FOR_PAYMENT",
      )
      .map((voucher) => ({
        key: `PV:${voucher.id}`,
        id: voucher.id,
        type: "PV",
        reference: voucher.voucherNumber,
        requester: voucher.recipientName,
        programme: voucher.division,
        amount: voucher.amount,
        submittedAt: voucher.createdAt,
        status: voucher.status,
        stage: voucher.projectManagerViewedAt ? "Viewed" : "Preview",
        actionable: !voucher.projectManagerViewedAt,
        reviewed: Boolean(voucher.projectManagerViewedAt),
        details: [
          { label: "PV date", value: date(voucher.pvDate) },
          { label: "Division", value: voucher.division },
          { label: "Recipient email", value: voucher.recipientEmail },
          { label: "Recipient reference", value: voucher.recipientReference },
          { label: "Payment method", value: voucher.paymentMethod },
          { label: "Purpose", value: voucher.purpose },
        ],
        lines: voucher.lines.map((line) => ({
          label: line.accountCode,
          description: line.description,
          amount: line.quantity * line.unitAmount + line.taxAmount,
        })),
        documents: [],
        href: "/beta/project-manager/payment-vouchers",
        voucher,
      }));
  }, [account, vouchers]);

  const allRows = useMemo(
    () => [...voucherRows, ...rows].filter((row) => row.actionable),
    [rows, voucherRows],
  );

  useEffect(() => {
    if (deepLinkHandled || allRows.length === 0) return;
    const requestedRecord = new URLSearchParams(window.location.search).get(
      "request",
    );
    if (!requestedRecord) {
      setDeepLinkHandled(true);
      return;
    }
    const row = allRows.find(
      (item) =>
        item.id === requestedRecord || item.reference === requestedRecord,
    );
    if (!row) return;
    setActiveType(row.type);
    setStatusFilter(initialStatus());
    setStandaloneReview(row);
    setDeepLinkHandled(true);
  }, [allRows, deepLinkHandled]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        tabs.map((tab) => [
          tab.value,
          allRows.filter((row) => row.type === tab.value).length,
        ]),
      ),
    [allRows],
  );
  const statusOptions = [
    { value: "ALL_PENDING", label: "All pending actions" },
    { value: "APPROVAL_REQUIRED", label: "Approval required" },
    { value: "OPTIONAL_PREVIEW", label: "Optional preview" },
  ];
  const claimTypeOptions = useMemo(
    () =>
      [
        ...new Set(
          allRows
            .filter((row) => row.type === "CL")
            .map(typeDetail)
            .filter(Boolean),
        ),
      ].sort(),
    [allRows],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchesStatus = (row: ApprovalRow) => {
      if (statusFilter === "ALL_PENDING") return true;
      const requiresApproval = row.type === "INV" || row.type === "TA";
      return statusFilter === "APPROVAL_REQUIRED"
        ? requiresApproval
        : !requiresApproval;
    };
    return allRows
      .filter(
        (row) =>
          row.type === activeType &&
          matchesStatus(row) &&
          (row.type !== "CL" ||
            claimTypeFilter === "ALL" ||
            typeDetail(row) === claimTypeFilter) &&
          (!month || row.submittedAt.startsWith(month)) &&
          (!query ||
            [
              row.reference,
              row.requester,
              row.programme,
              typeDetail(row),
              ...row.details.map((item) => item.value),
            ].some((value) => value.toLowerCase().includes(query))),
      )
      .sort((a, b) =>
        sort === "AMOUNT_DESC"
          ? b.amount - a.amount
          : sort === "NEWEST"
            ? b.submittedAt.localeCompare(a.submittedAt)
            : a.submittedAt.localeCompare(b.submittedAt),
      );
  }, [activeType, allRows, claimTypeFilter, month, search, sort, statusFilter]);
  const selected = allRows.filter((row) => selectedKeys.includes(row.key));
  const reviewedCount = selected.filter((row) =>
    reviewedKeys.includes(row.key),
  ).length;
  const activeReview =
    standaloneReview ??
    (reviewIndex === null ? null : (selected[reviewIndex] ?? null));
  const standaloneIndex = standaloneReview
    ? visible.findIndex((row) => row.key === standaloneReview.key)
    : -1;
  const totalSelected = selected.reduce((sum, row) => sum + row.amount, 0);

  function toggle(row: ApprovalRow) {
    if (row.type === "PV") return;
    setSelectedKeys((current) =>
      current.includes(row.key)
        ? current.filter((key) => key !== row.key)
        : [...current, row.key],
    );
    setReviewedKeys((current) => current.filter((key) => key !== row.key));
    setConfirmed(false);
  }

  async function markReviewed() {
    if (!activeReview) return;
    if (activeReview.type === "PV") {
      if (!account) return;
      setSaving(true);
      try {
        await markPaymentVoucherManagerViewed(activeReview.id, account.id);
        await refreshVouchers();
        setMessage(`${activeReview.reference} was marked as reviewed.`);
        setStandaloneReview(null);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The Payment Voucher could not be marked as reviewed.",
        );
      } finally {
        setSaving(false);
      }
      return;
    }
    if (standaloneReview) {
      setSelectedKeys([activeReview.key]);
      setReviewedKeys([activeReview.key]);
      setStandaloneReview(null);
      setShowConfirmation(true);
      return;
    }
    setReviewedKeys((current) =>
      current.includes(activeReview.key)
        ? current
        : [...current, activeReview.key],
    );
    if (reviewIndex !== null && reviewIndex < selected.length - 1)
      setReviewIndex(reviewIndex + 1);
    else setReviewIndex(null);
  }

  async function approveSelected() {
    if (!account || reviewedCount !== selected.length || !confirmed) return;
    setSaving(true);
    setError("");
    const succeeded: string[] = [];
    for (const row of selected) {
      try {
        if (row.type === "INV")
          await reviewInvoicePaymentByManager(row.id, account.id);
        if (row.type === "TA")
          await reviewTravelAllowanceByManager(row.id, account.id);
        if (row.type === "CA")
          await previewCashAdvanceByManager(row.id, account.id);
        if (row.type === "PC")
          await approvePettyCashByManager(row.id, account.id);
        succeeded.push(row.key);
      } catch {
        /* Preserve failed rows for retry. */
      }
    }
    setRows((current) => current.filter((row) => !succeeded.includes(row.key)));
    setSelectedKeys((current) =>
      current.filter((key) => !succeeded.includes(key)),
    );
    setReviewedKeys((current) =>
      current.filter((key) => !succeeded.includes(key)),
    );
    setShowConfirmation(false);
    setConfirmed(false);
    setSaving(false);
    setMessage(
      `${succeeded.length} of ${selected.length} selected requests were approved or marked as reviewed.`,
    );
    if (succeeded.length !== selected.length)
      setError(
        "Some requests could not be updated. The remaining selections are ready to retry.",
      );
  }

  if (!account || account.role !== "manager")
    return (
      <main className={styles.state}>
        <h1>Manager access required</h1>
        <p>Sign in using a Manager account.</p>
      </main>
    );
  if (loading || vouchersLoading)
    return (
      <main className={styles.state}>
        <h1>Loading pending approvals</h1>
        <p>Combining your assigned payment requests…</p>
      </main>
    );

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Manager · Pending approvals</p>
          <h1>Pending approvals</h1>
          <span>
            Every request assigned to you, across all payment types, in one
            list.
          </span>
        </div>
        <div>
          <small>Waiting for you</small>
          <strong>{waitingCount ?? allRows.length}</strong>
        </div>
      </header>
      <nav className={styles.tabs} aria-label="Payment type filters">
        {tabs.map((tab) => (
          <button
            data-active={activeType === tab.value}
            key={tab.value}
            onClick={() => {
              setActiveType(tab.value);
              setStatusFilter(initialStatus());
              setClaimTypeFilter("ALL");
            }}
            style={{
              borderBottomColor:
                activeType === tab.value ? tab.colour : "transparent",
            }}
            type="button"
          >
            <i style={{ background: tab.colour }} />
            {tab.label}
            <b>{counts[tab.value] ?? 0}</b>
          </button>
        ))}
      </nav>
      <section className={styles.queue}>
        <header>
          <div>
            <p>Approval queue</p>
            <h2>{tabs.find((tab) => tab.value === activeType)?.label}</h2>
          </div>
          <span>{visible.length} records</span>
        </header>
        <div className={filterStyles.panel}>
          <div className={filterStyles.heading}>
            <div>
              <h3>Find a pending approval</h3>
              <p>Search, filter and sort the requests assigned to you.</p>
            </div>
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter(initialStatus());
                setClaimTypeFilter("ALL");
                setMonth("");
                setSort("OLDEST");
              }}
              type="button"
            >
              Clear filters
            </button>
          </div>
          <div
            className={`${filterStyles.fields} ${activeType === "CL" ? filterStyles.claimFields : ""}`}
          >
            <label>
              <span>Search</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Reference, requester or programme"
                type="search"
                value={search}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {activeType === "CL" && (
              <label>
                <span>Claim type</span>
                <select
                  onChange={(event) => setClaimTypeFilter(event.target.value)}
                  value={claimTypeFilter}
                >
                  <option value="ALL">All Claim types</option>
                  {claimTypeOptions.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>Submitted month</span>
              <input
                onChange={(event) => setMonth(event.target.value)}
                type="month"
                value={month}
              />
            </label>
            <label>
              <span>Sort by</span>
              <select
                onChange={(event) => setSort(event.target.value as typeof sort)}
                value={sort}
              >
                <option value="OLDEST">Oldest first</option>
                <option value="NEWEST">Newest first</option>
                <option value="AMOUNT_DESC">Highest amount</option>
              </select>
            </label>
          </div>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.message}>{message}</div>}
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th />
                <th>Type</th>
                <th>Reference</th>
                <th>Requester</th>
                <th>Amount</th>
                <th>Submitted</th>
                <th>Stage</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.key}>
                  <td>
                    <input
                      aria-label={`Select ${row.reference}`}
                      checked={selectedKeys.includes(row.key)}
                      disabled={row.type === "PV" || !row.actionable}
                      onChange={() => toggle(row)}
                      type="checkbox"
                    />
                  </td>
                  <td>
                    <span className={styles.typeBadge} data-type={row.type}>
                      {row.type}
                    </span>
                  </td>
                  <td>
                    <strong>{row.reference}</strong>
                  </td>
                  <td>
                    {row.requester}
                    <small>{row.programme}</small>
                  </td>
                  <td className={styles.amount}>{money(row.amount)}</td>
                  <td>{date(row.submittedAt)}</td>
                  <td>
                    <span
                      className={styles.stage}
                      data-preview={row.type === "PV"}
                    >
                      {row.stage}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => setStandaloneReview(row)}
                      type="button"
                    >
                      {row.type === "PV" ? "Preview" : "Review"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <div className={styles.empty}>
            No pending records match these filters.
          </div>
        )}
        {selected.length > 0 && (
          <footer className={filterStyles.selectionFooter}>
            <span>{selected.length} selected</span>
            <div>
              <button
                onClick={() => {
                  setSelectedKeys([]);
                  setReviewedKeys([]);
                }}
                type="button"
              >
                Clear
              </button>
              <button onClick={() => setShowConfirmation(true)} type="button">
                Review selected ({selected.length})
              </button>
            </div>
          </footer>
        )}
      </section>

      {showConfirmation && (
        <div className={styles.backdrop} role="presentation">
          <section
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <p>Approval confirmation</p>
                <h2>Approve {selected.length} selected requests</h2>
                <span>
                  Review every selected request before forwarding it to the next
                  workflow stage.
                </span>
              </div>
              <button
                aria-label="Close"
                onClick={() => setShowConfirmation(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className={styles.progress}>
              <span>
                Reviewed {reviewedCount} of {selected.length}
              </span>
              <i>
                <b
                  style={{
                    width: `${selected.length ? (reviewedCount / selected.length) * 100 : 0}%`,
                  }}
                />
              </i>
            </div>
            <ul>
              {selected.map((row, index) => (
                <li key={row.key}>
                  <div>
                    <strong>{row.reference}</strong>
                    <span>
                      {row.requester} ·{" "}
                      {tabs.find((tab) => tab.value === row.type)?.label}
                    </span>
                  </div>
                  <b>{money(row.amount)}</b>
                  <em>
                    {reviewedKeys.includes(row.key)
                      ? "Reviewed"
                      : "Not reviewed"}
                  </em>
                  {!reviewedKeys.includes(row.key) && (
                    <button
                      className={filterStyles.openButton}
                      onClick={() => setReviewIndex(index)}
                      type="button"
                    >
                      Open
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className={filterStyles.confirmTotal}>
              <span>Total selected amount</span>
              <strong>{money(totalSelected)}</strong>
            </div>
            <label className={styles.confirmCheck}>
              <input
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                type="checkbox"
              />
              I confirm that I reviewed and approve the selected requests.
            </label>
            <footer>
              <button
                className={filterStyles.confirmButton}
                onClick={() => setShowConfirmation(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={filterStyles.confirmButton}
                disabled={
                  !confirmed || reviewedCount !== selected.length || saving
                }
                onClick={approveSelected}
                type="button"
              >
                {saving
                  ? "Approving…"
                  : `Approve and forward ${selected.length} selected`}
              </button>
            </footer>
          </section>
        </div>
      )}

      {activeReview && (
        <div className={styles.backdrop} role="presentation">
          <section
            className={styles.detailModal}
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <p>
                  {activeReview.type === "PV"
                    ? "Review selected voucher"
                    : "Preview details"}
                </p>
                <h2>{activeReview.reference}</h2>
              </div>
              <span>
                {tabs.find((tab) => tab.value === activeReview.type)?.label}
              </span>
              <button
                aria-label="Close"
                onClick={() => {
                  setReviewIndex(null);
                  setStandaloneReview(null);
                }}
                type="button"
              >
                ×
              </button>
            </header>
            <div className={filterStyles.directorReviewLayout}>
              <div className={styles.detailBody}>
                {activeReview.voucher ? (
                  <>
                    <section>
                      <h3>Payment details</h3>
                      <dl>
                        <div>
                          <dt>PV date</dt>
                          <dd>{date(activeReview.voucher.pvDate)}</dd>
                        </div>
                        <div>
                          <dt>Submitter</dt>
                          <dd>{activeReview.voucher.submitterId}</dd>
                        </div>
                        <div>
                          <dt>Assigned Director</dt>
                          <dd>{activeReview.voucher.directorId}</dd>
                        </div>
                        <div>
                          <dt>Division</dt>
                          <dd>{activeReview.voucher.division}</dd>
                        </div>
                        <div>
                          <dt>Organization</dt>
                          <dd>{activeReview.voucher.organizationId}</dd>
                        </div>
                        <div>
                          <dt>Created</dt>
                          <dd>{date(activeReview.voucher.createdAt)}</dd>
                        </div>
                      </dl>
                      <dl className={filterStyles.wideDetails}>
                        <div>
                          <dt>Purpose of payment</dt>
                          <dd>{activeReview.voucher.purpose}</dd>
                        </div>
                        <div>
                          <dt>Amount in words</dt>
                          <dd>
                            {amountToMalayWords(activeReview.voucher.amount)}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <section>
                      <h3>Recipient information</h3>
                      <dl>
                        <div>
                          <dt>Recipient name</dt>
                          <dd>{activeReview.voucher.recipientName}</dd>
                        </div>
                        <div>
                          <dt>Recipient email</dt>
                          <dd>{activeReview.voucher.recipientEmail}</dd>
                        </div>
                        <div>
                          <dt>IC / identity number</dt>
                          <dd>{activeReview.voucher.recipientIc ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>Malaysian</dt>
                          <dd>
                            {activeReview.voucher.recipientIsMalaysian
                              ? "Yes"
                              : "No"}
                          </dd>
                        </div>
                        <div>
                          <dt>Payment method</dt>
                          <dd>{activeReview.voucher.paymentMethod}</dd>
                        </div>
                        <div>
                          <dt>Bank name</dt>
                          <dd>{activeReview.voucher.bankName ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>Bank account number</dt>
                          <dd>
                            {activeReview.voucher.bankAccountNumber ?? "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Recipient reference</dt>
                          <dd>{activeReview.voucher.recipientReference}</dd>
                        </div>
                      </dl>
                    </section>
                    <section>
                      <h3>Payment breakdown</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>Unit amount</th>
                            <th>Tax</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeReview.voucher.lines.map((line, index) => (
                            <tr key={`${line.accountCode}-${index}`}>
                              <td>{line.accountCode}</td>
                              <td>{line.description}</td>
                              <td>{line.quantity}</td>
                              <td>{money(line.unitAmount)}</td>
                              <td>{money(line.taxAmount)}</td>
                              <td>
                                {money(
                                  line.quantity * line.unitAmount +
                                    line.taxAmount,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className={filterStyles.grandTotal}>
                        <span>Grand total</span>
                        <strong>{money(activeReview.voucher.amount)}</strong>
                      </div>
                    </section>
                  </>
                ) : (
                  <>
                    <section>
                      <h3>Request overview</h3>
                      <dl>
                        <div>
                          <dt>Requester</dt>
                          <dd>{activeReview.requester}</dd>
                        </div>
                        <div>
                          <dt>Position</dt>
                          <dd>{activeReview.requesterRole ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>Date</dt>
                          <dd>{date(activeReview.submittedAt)}</dd>
                        </div>
                        <div>
                          <dt>Programme</dt>
                          <dd>{activeReview.programme}</dd>
                        </div>
                        <div>
                          <dt>Entries</dt>
                          <dd>{activeReview.lines.length}</dd>
                        </div>
                        <div>
                          <dt>Total</dt>
                          <dd>{money(activeReview.amount)}</dd>
                        </div>
                        {activeReview.details.map((item) => (
                          <div key={item.label}>
                            <dt>{item.label}</dt>
                            <dd>{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                    <section>
                      <h3>Request breakdown ({activeReview.lines.length})</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Item</th>
                            <th>Details</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeReview.lines.map((line, index) => (
                            <tr key={`${line.label}-${index}`}>
                              <td>{index + 1}</td>
                              <td>{line.label}</td>
                              <td>{line.description}</td>
                              <td>
                                {line.amount === undefined
                                  ? "—"
                                  : money(line.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  </>
                )}
                {activeReview.documents.length > 0 && (
                  <section>
                    <h3>Supporting documents</h3>
                    <div className={filterStyles.documentList}>
                      {activeReview.documents.map((document, index) => (
                        <a
                          download={document.download}
                          href={document.href}
                          key={`${document.href}-${index}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span>{document.name}</span>
                          <b>Preview / download</b>
                        </a>
                      ))}
                    </div>
                  </section>
                )}
              </div>
              <aside className={filterStyles.directorActionRail}>
                <section className={filterStyles.directorActionCard}>
                  <p>Manager action</p>
                  <h3>
                    {activeReview.type === "INV" || activeReview.type === "TA"
                      ? "Review and forward"
                      : "Optional preview"}
                  </h3>
                  <span>
                    {activeReview.type === "INV" || activeReview.type === "TA"
                      ? "Review the request details and supporting documents before forwarding it to the next stage."
                      : "This preview is informational. The request can continue through its workflow even if it is not opened here."}
                  </span>
                  <button
                    className={filterStyles.approveButton}
                    disabled={
                      saving ||
                      activeReview.reviewed ||
                      !activeReview.actionable
                    }
                    onClick={markReviewed}
                    type="button"
                  >
                    {saving
                      ? "Saving…"
                      : activeReview.reviewed || !activeReview.actionable
                        ? "Reviewed"
                        : activeReview.type === "INV" ||
                            activeReview.type === "TA"
                          ? "Review and continue"
                          : "Mark as previewed"}
                  </button>
                </section>
              </aside>
            </div>
            <footer>
              <button
                disabled={
                  standaloneReview ? standaloneIndex <= 0 : reviewIndex === 0
                }
                onClick={() =>
                  standaloneReview
                    ? setStandaloneReview(
                        visible[Math.max(0, standaloneIndex - 1)] ?? null,
                      )
                    : setReviewIndex((current) =>
                        current === null ? null : Math.max(0, current - 1),
                      )
                }
                type="button"
              >
                Previous
              </button>
              <button
                disabled={
                  standaloneReview
                    ? standaloneIndex >= visible.length - 1
                    : reviewIndex === selected.length - 1
                }
                onClick={() =>
                  standaloneReview
                    ? setStandaloneReview(
                        visible[
                          Math.min(visible.length - 1, standaloneIndex + 1)
                        ] ?? null,
                      )
                    : setReviewIndex((current) =>
                        current === null
                          ? null
                          : Math.min(selected.length - 1, current + 1),
                      )
                }
                type="button"
              >
                Next
              </button>
              <span />
              <button
                onClick={() => {
                  setReviewIndex(null);
                  setStandaloneReview(null);
                }}
                type="button"
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

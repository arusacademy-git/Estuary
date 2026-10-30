"use client";

import { useEffect, useMemo, useState } from "react";

import {
  fetchInvoicePayments,
  reviewInvoicePaymentByDirector,
  returnInvoicePaymentByDirector,
} from "@/data/payment-requests/invoice-payment/api";
import {
  fetchTravelAllowances,
  approveTravelAllowanceByDirector,
  returnTravelAllowanceByDirector,
} from "@/data/payment-requests/travel-allowance/api";
import {
  fetchCashAdvances,
  approveCashAdvanceByDirector,
  returnCashAdvanceByDirector,
} from "@/data/payment-requests/cash-advance/cash-advance-api";
import {
  fetchPettyCashRequests,
  approvePettyCashByDirector,
  returnPettyCashByDirector,
} from "@/data/payment-requests/petty-cash/api";
import {
  fetchClaimRequests,
  forwardClaimByDirector,
  returnClaimByDirector,
} from "@/data/payment-requests/claims/api";
import {
  approvePaymentVoucher,
  rejectPaymentVoucher,
} from "@/data/payment-vouchers/payment-voucher-api";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import {
  travelLineTotal,
  type TravelAllowanceRecord,
} from "@/domain/payment-requests/travel-allowance/types";
import { amountToMalayWords } from "@/lib/currency/amount-words";
import { usePaymentVouchers } from "@/features/payment-voucher/hooks/use-payment-vouchers";
import { useUserSignature } from "@/features/signatures/hooks/use-user-signature";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";
import { fetchSidebarActionCounts } from "@/app/beta/sidebar-action-counts";

import styles from "../manager-pending-approvals/manager-pending-approvals.module.css";
import filterStyles from "../manager-pending-approvals/manager-pending-approvals-filter.module.css";

type PaymentType = "PV" | "PC" | "INV" | "TA" | "CA" | "CL";
type Row = {
  key: string;
  id: string;
  type: PaymentType;
  reference: string;
  requester: string;
  programme: string;
  amount: number;
  submittedAt: string;
  details: Array<{ label: string; value: string }>;
  lines: Array<{ label: string; description: string; amount?: number }>;
  documents: Array<{ name: string; href: string; download?: string }>;
  claimType?: string;
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
const money = (value: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    value,
  );
function displayDate(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function travelEmployeeBreakdown(record: TravelAllowanceRecord): Row["lines"] {
  const grouped = new Map<
    string,
    {
      employeeName: string;
      dates: string[];
      projects: Set<string>;
      reasons: Set<string>;
      meals: Set<string>;
      entries: number;
      total: number;
    }
  >();

  record.lines.forEach((line) => {
    const key = line.employeeId || line.employeeName;
    const summary = grouped.get(key) ?? {
      employeeName: line.employeeName,
      dates: [],
      projects: new Set<string>(),
      reasons: new Set<string>(),
      meals: new Set<string>(),
      entries: 0,
      total: 0,
    };
    summary.dates.push(line.travelDate);
    summary.projects.add(line.projectName);
    summary.reasons.add(line.reason);
    line.meals.forEach((meal) => summary.meals.add(meal));
    summary.entries += 1;
    summary.total += travelLineTotal(line);
    grouped.set(key, summary);
  });

  return [...grouped.values()].map((summary) => {
    const dates = [...new Set(summary.dates)].sort();
    const dateRange =
      dates.length < 2
        ? displayDate(dates[0] ?? "")
        : `${displayDate(dates[0])} – ${displayDate(dates.at(-1) ?? dates[0])}`;
    return {
      label: summary.employeeName,
      description: [
        dateRange,
        [...summary.projects].join(", "),
        [...summary.reasons].join(", "),
        [...summary.meals].join(", ") || "No meals",
        `${summary.entries} ${summary.entries === 1 ? "entry" : "entries"}`,
      ].join(" · "),
      amount: summary.total,
    };
  });
}

export function DirectorPendingApprovals() {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeType, setActiveType] = useState<PaymentType>("PV");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<"OLDEST" | "NEWEST" | "AMOUNT_DESC">(
    "OLDEST",
  );
  const [claimType, setClaimType] = useState("ALL");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [reviewedKeys, setReviewedKeys] = useState<string[]>([]);
  const [rejectedKeys, setRejectedKeys] = useState<string[]>([]);
  const [rejectionRemarks, setRejectionRemarks] = useState<
    Record<string, string>
  >({});
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [standalone, setStandalone] = useState<Row | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waitingCount, setWaitingCount] = useState<number | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const {
    records: vouchers,
    isLoading: vouchersLoading,
    refresh: refreshVouchers,
  } = usePaymentVouchers();
  const { signature } = useUserSignature(account?.id);

  useEffect(() => {
    const requestedType = new URLSearchParams(window.location.search).get(
      "type",
    ) as PaymentType | null;
    if (!requestedType || !tabs.some((tab) => tab.value === requestedType))
      return;
    setActiveType(requestedType);
    setClaimType("ALL");
  }, []);

  useEffect(() => {
    if (!account || account.role !== "director") return;
    let cancelled = false;
    Promise.all([
      fetchInvoicePayments({
        role: "director",
        userId: account.id,
        includeAll: true,
      }),
      fetchTravelAllowances({
        role: "director",
        userId: account.id,
        includeAll: true,
      }),
      fetchCashAdvances({
        role: "director",
        userId: account.id,
        includeAll: true,
      }),
      fetchPettyCashRequests({
        role: "director",
        userId: account.id,
        includeAll: true,
      }),
      fetchClaimRequests({ role: "director", userId: account.id }),
    ])
      .then(([invoices, travel, cash, petty, claims]) => {
        if (cancelled) return;
        setRows([
          ...invoices
            .filter(
              (r) =>
                r.status === "PENDING_DIRECTOR_REVIEW" &&
                r.directorApproverId === account.id,
            )
            .map(
              (r): Row => ({
                key: `INV:${r.id}`,
                id: r.id,
                type: "INV",
                reference: r.requestNumber,
                requester: r.staffName,
                programme: r.projectName,
                amount: r.totalAmount,
                submittedAt: r.requestDate,
                details: [
                  { label: "Request title", value: r.title },
                  { label: "Vendor", value: r.vendorName },
                  { label: "Purpose", value: r.purpose },
                  { label: "Transfer type", value: r.transferType },
                  { label: "Invoice total", value: money(r.invoiceTotal) },
                  { label: "Tax / SST", value: money(r.taxAmount) },
                  {
                    label: "Supporting documents",
                    value: String(r.supportingDocuments.length),
                  },
                ],
                lines: [
                  {
                    label: r.vendorName,
                    description: r.purpose,
                    amount: r.totalAmount,
                  },
                ],
                documents: r.supportingDocuments.map((document) => ({
                  name: document.fileName,
                  href: document.dataUrl,
                  download: document.fileName,
                })),
              }),
            ),
          ...travel
            .filter(
              (r) =>
                r.status === "PENDING_DIRECTOR_APPROVAL" &&
                r.projectDirectorId === account.id,
            )
            .map(
              (r): Row => ({
                key: `TA:${r.id}`,
                id: r.id,
                type: "TA",
                reference: r.requestNumber,
                requester: r.requesterName,
                programme: r.lines[0]?.projectName ?? "—",
                amount: r.totalAmount,
                submittedAt: r.requestDate,
                details: [
                  { label: "Requester role", value: r.requesterPosition },
                  { label: "Contact", value: r.contact },
                  { label: "Entries", value: String(r.lines.length) },
                  {
                    label: "Payment target",
                    value: displayDate(r.paymentDueDate),
                  },
                  {
                    label: "Supporting documents",
                    value: String(r.supportingDocuments.length),
                  },
                  { label: "Remarks", value: r.remarks || "—" },
                ],
                lines: travelEmployeeBreakdown(r),
                documents: r.supportingDocuments.map((document) => ({
                  name: document.fileName,
                  href: document.dataUrl,
                  download: document.fileName,
                })),
              }),
            ),
          ...cash
            .filter(
              (r) =>
                r.status === "PENDING_DIRECTOR_APPROVAL" &&
                r.directorApproverId === account.id,
            )
            .map(
              (r): Row => ({
                key: `CA:${r.id}`,
                id: r.id,
                type: "CA",
                reference: r.requestNumber,
                requester: r.requesterName,
                programme: r.projectName,
                amount: r.totalAmount,
                submittedAt: r.requestDate,
                details: [
                  { label: "Position", value: r.requesterPosition },
                  { label: "Department", value: r.requesterDepartment },
                  { label: "Contact", value: r.requesterContact },
                  { label: "Purpose", value: r.purpose },
                  { label: "Account holder", value: r.accountHolderName },
                  { label: "Bank", value: r.bankName },
                  { label: "Bank account", value: r.bankAccountNumber },
                ],
                lines: r.lines.map((line) => ({
                  label: line.description,
                  description: line.purpose,
                  amount: line.amount,
                })),
                documents: r.supportingDocuments.map((document) => ({
                  name: document.fileName,
                  href: document.dataUrl,
                  download: document.fileName,
                })),
              }),
            ),
          ...petty
            .filter(
              (r) =>
                r.directorApproverId === account.id &&
                !r.directorApprovedAt &&
                !["RETURNED_TO_STAFF", "PAID"].includes(r.status),
            )
            .map(
              (r): Row => ({
                key: `PC:${r.id}`,
                id: r.id,
                type: "PC",
                reference: r.requestNumber,
                requester: r.requesterName,
                programme: r.location === "PENANG" ? "Penang" : "Kuala Lumpur",
                amount: r.totalAmount,
                submittedAt: r.requestDate,
                details: [
                  { label: "Requester role", value: r.requesterRole },
                  { label: "Position", value: r.requesterPosition },
                  { label: "Contact", value: r.requesterContact },
                  { label: "Location", value: r.location },
                  { label: "Notes", value: r.notes || "—" },
                ],
                lines: r.lines.map((line) => ({
                  label: line.supplier,
                  description: line.details,
                  amount: line.amount,
                })),
                documents: r.lines
                  .filter((line) => line.proofLink?.trim())
                  .map((line, index) => ({
                    name: `${line.supplier || `Expense ${index + 1}`} proof`,
                    href: line.proofLink,
                  })),
              }),
            ),
          ...claims
            .filter(
              (r) =>
                r.directorApproverId === account.id &&
                r.status === "PENDING_DIRECTOR_APPROVAL",
            )
            .map(
              (r): Row => ({
                key: `CL:${r.id}`,
                id: r.id,
                type: "CL",
                reference: r.claimNumber,
                requester: r.requesterName,
                programme: r.lines[0]?.division ?? "—",
                amount: r.totalAmount,
                submittedAt: r.claimDate,
                claimType: r.claimType,
                details: [
                  { label: "Claim type", value: r.claimType },
                  { label: "Entries", value: String(r.lines.length) },
                  { label: "Position", value: r.requesterPosition },
                  { label: "Requester role", value: r.requesterRole },
                  { label: "Contact", value: r.requesterContact },
                  { label: "Notes", value: r.notes || "—" },
                ],
                lines: r.lines.map((line) => ({
                  label: line.supplier || line.from || "Claim item",
                  description: line.details,
                  amount: line.amount,
                })),
                documents: r.lines.flatMap((line, index) => {
                  if (line.receiptDocumentId)
                    return [
                      {
                        name:
                          line.receiptFileName || `Claim receipt ${index + 1}`,
                        href: `/api/v1/payment-requests/claims/documents/${encodeURIComponent(line.receiptDocumentId)}?userId=${encodeURIComponent(account.id)}`,
                      },
                    ];
                  if (line.receiptLink?.trim())
                    return [
                      {
                        name:
                          line.receiptFileName || `Claim receipt ${index + 1}`,
                        href: line.receiptLink!,
                      },
                    ];
                  return [];
                }),
              }),
            ),
        ]);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Director approvals could not be loaded.",
        ),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetchSidebarActionCounts(account)
      .then((counts) => {
        if (!cancelled) setWaitingCount(counts.ALL_PENDING);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [account]);

  const voucherRows = useMemo<Row[]>(
    () =>
      !account
        ? []
        : vouchers
            .filter(
              (v) =>
                v.directorId === account.id &&
                v.status === "PENDING_DIRECTOR_APPROVAL",
            )
            .map((v) => ({
              key: `PV:${v.id}`,
              id: v.id,
              type: "PV",
              reference: v.voucherNumber,
              requester: v.recipientName,
              programme: v.division,
              amount: v.amount,
              submittedAt: v.createdAt,
              details: [
                { label: "PV date", value: displayDate(v.pvDate) },
                { label: "Purpose", value: v.purpose },
                { label: "Recipient email", value: v.recipientEmail },
                { label: "Payment method", value: v.paymentMethod },
              ],
              lines: v.lines.map((line) => ({
                label: line.accountCode,
                description: line.description,
                amount: line.quantity * line.unitAmount + line.taxAmount,
              })),
              documents: [],
              voucher: v,
            })),
    [account, vouchers],
  );
  const allRows = useMemo(() => [...voucherRows, ...rows], [rows, voucherRows]);
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
  const claimTypes = useMemo(
    () =>
      [
        ...new Set(
          allRows
            .filter((row) => row.type === "CL")
            .map((row) => row.claimType)
            .filter(Boolean),
        ),
      ].sort(),
    [allRows],
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
    setClaimType("ALL");
    setStandalone(row);
    setDeepLinkHandled(true);
  }, [allRows, deepLinkHandled]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allRows
      .filter(
        (row) =>
          row.type === activeType &&
          (row.type !== "CL" ||
            claimType === "ALL" ||
            row.claimType === claimType) &&
          (!month || row.submittedAt.startsWith(month)) &&
          (!query ||
            [
              row.reference,
              row.requester,
              row.programme,
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
  }, [activeType, allRows, claimType, month, search, sort]);
  const selected = allRows.filter((row) => selectedKeys.includes(row.key));
  const reviewedCount = selected.filter((row) =>
    reviewedKeys.includes(row.key),
  ).length;
  const activeReview =
    standalone ??
    (reviewIndex === null ? null : (selected[reviewIndex] ?? null));
  const total = selected.reduce((sum, row) => sum + row.amount, 0);
  const selectedRequiresSignature = selected.some(
    (row) =>
      !rejectedKeys.includes(row.key) &&
      (row.type === "PV" || row.type === "CA"),
  );
  const standaloneIndex = standalone
    ? visible.findIndex((row) => row.key === standalone.key)
    : -1;
  function toggle(row: Row) {
    setSelectedKeys((current) =>
      current.includes(row.key)
        ? current.filter((key) => key !== row.key)
        : [...current, row.key],
    );
    setReviewedKeys((current) => current.filter((key) => key !== row.key));
    setRejectedKeys((current) => current.filter((key) => key !== row.key));
    setRejectionRemarks((current) => {
      const next = { ...current };
      delete next[row.key];
      return next;
    });
    setConfirmed(false);
  }
  function recordDecision(decision: "approve" | "reject") {
    if (!activeReview || standalone) return;
    if (decision === "reject" && !rejectReason.trim()) return;
    setReviewedKeys((current) =>
      current.includes(activeReview.key)
        ? current
        : [...current, activeReview.key],
    );
    setRejectedKeys((current) =>
      decision === "reject"
        ? current.includes(activeReview.key)
          ? current
          : [...current, activeReview.key]
        : current.filter((key) => key !== activeReview.key),
    );
    if (decision === "reject")
      setRejectionRemarks((current) => ({
        ...current,
        [activeReview.key]: rejectReason.trim(),
      }));
    else
      setRejectionRemarks((current) => {
        const next = { ...current };
        delete next[activeReview.key];
        return next;
      });
    setShowReject(false);
    setRejectReason("");
    if (reviewIndex !== null && reviewIndex < selected.length - 1)
      setReviewIndex(reviewIndex + 1);
    else setReviewIndex(null);
  }
  async function approveSelected() {
    if (
      !account ||
      (selectedRequiresSignature && !signature) ||
      reviewedCount !== selected.length ||
      !confirmed
    )
      return;
    setSaving(true);
    setError("");
    const succeeded: string[] = [];
    for (const row of selected) {
      try {
        if (rejectedKeys.includes(row.key)) {
          const remarks = rejectionRemarks[row.key];
          if (row.type === "PV")
            await rejectPaymentVoucher(row.id, account.id, remarks);
          if (row.type === "INV")
            await returnInvoicePaymentByDirector(row.id, account.id, remarks);
          if (row.type === "TA")
            await returnTravelAllowanceByDirector(row.id, account.id, remarks);
          if (row.type === "CA")
            await returnCashAdvanceByDirector(row.id, account.id, remarks);
          if (row.type === "PC")
            await returnPettyCashByDirector(row.id, account.id, remarks);
          if (row.type === "CL")
            await returnClaimByDirector(row.id, account.id, remarks);
        } else {
          if (row.type === "PV")
            await approvePaymentVoucher(row.id, account.id, signature!.id);
          if (row.type === "INV")
            await reviewInvoicePaymentByDirector(row.id, account.id);
          if (row.type === "TA")
            await approveTravelAllowanceByDirector(row.id, account.id);
          if (row.type === "CA")
            await approveCashAdvanceByDirector(
              row.id,
              account.id,
              signature!.id,
            );
          if (row.type === "PC")
            await approvePettyCashByDirector(row.id, account.id);
          if (row.type === "CL")
            await forwardClaimByDirector(row.id, account.id);
        }
        succeeded.push(row.key);
      } catch {
        /* Keep failed rows selected. */
      }
    }
    setRows((current) => current.filter((row) => !succeeded.includes(row.key)));
    await refreshVouchers();
    setSelectedKeys((current) =>
      current.filter((key) => !succeeded.includes(key)),
    );
    setReviewedKeys((current) =>
      current.filter((key) => !succeeded.includes(key)),
    );
    setRejectedKeys((current) =>
      current.filter((key) => !succeeded.includes(key)),
    );
    setRejectionRemarks((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => !succeeded.includes(key)),
      ),
    );
    setShowConfirmation(false);
    setConfirmed(false);
    setSaving(false);
    fetchSidebarActionCounts(account)
      .then((counts) => setWaitingCount(counts.ALL_PENDING))
      .catch(() => undefined);
    if (succeeded.length !== selected.length)
      setError(
        "Some decisions could not be submitted. The remaining selections are ready to retry.",
      );
  }
  async function actOnActive(action: "approve" | "reject") {
    if (!account || !activeReview) return;
    if (action === "reject" && !rejectReason.trim()) {
      setError("Enter rejection remarks so the requester knows what to amend.");
      return;
    }
    if (
      action === "approve" &&
      ["PV", "CA"].includes(activeReview.type) &&
      !signature
    ) {
      setError(
        "Upload your signature in Settings before approving this request.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (action === "approve") {
        if (activeReview.type === "PV")
          await approvePaymentVoucher(
            activeReview.id,
            account.id,
            signature!.id,
          );
        if (activeReview.type === "INV")
          await reviewInvoicePaymentByDirector(activeReview.id, account.id);
        if (activeReview.type === "TA")
          await approveTravelAllowanceByDirector(activeReview.id, account.id);
        if (activeReview.type === "CA")
          await approveCashAdvanceByDirector(
            activeReview.id,
            account.id,
            signature!.id,
          );
        if (activeReview.type === "PC")
          await approvePettyCashByDirector(activeReview.id, account.id);
        if (activeReview.type === "CL")
          await forwardClaimByDirector(activeReview.id, account.id);
      } else {
        const remarks = rejectReason.trim();
        if (activeReview.type === "PV")
          await rejectPaymentVoucher(activeReview.id, account.id, remarks);
        if (activeReview.type === "INV")
          await returnInvoicePaymentByDirector(
            activeReview.id,
            account.id,
            remarks,
          );
        if (activeReview.type === "TA")
          await returnTravelAllowanceByDirector(
            activeReview.id,
            account.id,
            remarks,
          );
        if (activeReview.type === "CA")
          await returnCashAdvanceByDirector(
            activeReview.id,
            account.id,
            remarks,
          );
        if (activeReview.type === "PC")
          await returnPettyCashByDirector(activeReview.id, account.id, remarks);
        if (activeReview.type === "CL")
          await returnClaimByDirector(activeReview.id, account.id, remarks);
      }
      const completedKey = activeReview.key;
      if (activeReview.type === "PV") await refreshVouchers();
      else
        setRows((current) => current.filter((row) => row.key !== completedKey));
      setSelectedKeys((current) =>
        current.filter((key) => key !== completedKey),
      );
      setReviewedKeys((current) =>
        current.filter((key) => key !== completedKey),
      );
      setStandalone(null);
      setReviewIndex(null);
      setShowReject(false);
      setRejectReason("");
      fetchSidebarActionCounts(account)
        .then((counts) => setWaitingCount(counts.ALL_PENDING))
        .catch(() => undefined);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `The request could not be ${action === "approve" ? "approved" : "returned"}.`,
      );
    } finally {
      setSaving(false);
    }
  }

  if (!account || account.role !== "director")
    return (
      <main className={styles.state}>
        <h1>Director access required</h1>
        <p>Sign in using a Director account.</p>
      </main>
    );
  if (loading || vouchersLoading)
    return (
      <main className={styles.state}>
        <h1>Loading pending approvals</h1>
        <p>Combining assigned Director requests…</p>
      </main>
    );
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Director · Pending approvals</p>
          <h1>Pending approvals</h1>
          <span>
            Every request waiting for your approval, across all payment types.
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
              setClaimType("ALL");
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
              <p>Only records waiting for Director action are shown.</p>
            </div>
            <button
              onClick={() => {
                setSearch("");
                setMonth("");
                setSort("OLDEST");
                setClaimType("ALL");
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
            {activeType === "CL" && (
              <label>
                <span>Claim type</span>
                <select
                  onChange={(event) => setClaimType(event.target.value)}
                  value={claimType}
                >
                  <option value="ALL">All Claim types</option>
                  {claimTypes.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
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
                  <td>{displayDate(row.submittedAt)}</td>
                  <td>
                    <span
                      className={styles.stage}
                      data-preview={row.type === "PC"}
                    >
                      {row.type === "PC"
                        ? "Optional Director Preview"
                        : "Pending Director Approval"}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => setStandalone(row)} type="button">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <div className={styles.empty}>
            No pending Director approvals match these filters.
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
        <div className={styles.backdrop}>
          <section
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <p>Approval confirmation</p>
                <h2>Review {selected.length} selected requests</h2>
                <span>Open each request and choose Approve or Reject.</span>
              </div>
              <button onClick={() => setShowConfirmation(false)} type="button">
                ×
              </button>
            </header>
            <div className={styles.progress}>
              <span>
                Decided {reviewedCount} of {selected.length}
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
              {selected.map((row, index) => {
                const decision = !reviewedKeys.includes(row.key)
                  ? "Not reviewed"
                  : rejectedKeys.includes(row.key)
                    ? "Rejected"
                    : row.type === "PC"
                      ? "Previewed"
                      : "Approved";
                return (
                  <li key={row.key}>
                    <div>
                      <strong>{row.reference}</strong>
                      <span>
                        {row.requester} ·{" "}
                        {tabs.find((tab) => tab.value === row.type)?.label}
                      </span>
                    </div>
                    <b>{money(row.amount)}</b>
                    <em
                      className={filterStyles.decisionBadge}
                      data-decision={decision.toLowerCase().replace(" ", "-")}
                    >
                      {decision}
                    </em>
                    <button
                      className={filterStyles.openButton}
                      onClick={() => {
                        setRejectReason(rejectionRemarks[row.key] ?? "");
                        setReviewIndex(index);
                      }}
                      type="button"
                    >
                      Open
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className={filterStyles.confirmTotal}>
              <span>Total selected amount</span>
              <strong>{money(total)}</strong>
            </div>
            {selectedRequiresSignature && !signature && (
              <div className={styles.error}>
                Upload your signature in Settings before approving Payment
                Voucher or Cash Advance requests.
              </div>
            )}
            <label className={styles.confirmCheck}>
              <input
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                type="checkbox"
              />
              I confirm the approval and rejection decisions above.
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
                  (selectedRequiresSignature && !signature) ||
                  !confirmed ||
                  reviewedCount !== selected.length ||
                  saving
                }
                onClick={approveSelected}
                type="button"
              >
                {saving ? "Submitting…" : `Submit ${selected.length} decisions`}
              </button>
            </footer>
          </section>
        </div>
      )}
      {activeReview && (
        <div className={styles.backdrop}>
          <section
            className={styles.detailModal}
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <p>
                  {activeReview.voucher
                    ? "Review selected voucher"
                    : "Review details"}
                </p>
                <h2>{activeReview.reference}</h2>
              </div>
              <span>
                {tabs.find((tab) => tab.value === activeReview.type)?.label}
              </span>
              <button
                onClick={() => {
                  setReviewIndex(null);
                  setStandalone(null);
                  setShowReject(false);
                  setRejectReason("");
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
                          <dd>{displayDate(activeReview.voucher.pvDate)}</dd>
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
                          <dd>{displayDate(activeReview.voucher.createdAt)}</dd>
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
                          <dt>Date</dt>
                          <dd>{displayDate(activeReview.submittedAt)}</dd>
                        </div>
                        <div>
                          <dt>Programme</dt>
                          <dd>{activeReview.programme}</dd>
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
                          key={`${document.name}-${index}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span>{document.name}</span>
                          <b>{document.download ? "Download" : "Preview"} ↗</b>
                        </a>
                      ))}
                    </div>
                  </section>
                )}
              </div>
              <aside className={filterStyles.directorActionRail}>
                <section className={filterStyles.directorActionCard}>
                  <p>Director action</p>
                  <h3>
                    {activeReview.type === "PC"
                      ? "Optional preview"
                      : activeReview.type === "CL"
                        ? "Final Claim decision"
                        : "Approve or reject"}
                  </h3>
                  <span>
                    {activeReview.type === "PC"
                      ? "Review this request for visibility. Finance processing continues independently even if you do not preview it."
                      : activeReview.type === "CL"
                        ? "Finance has verified this Claim. Approve it for payment or reject it with a reason."
                        : "Review the complete request details before approving it or returning it with correction remarks."}
                  </span>
                  {activeReview.type !== "PC" && (
                    <button
                      className={filterStyles.rejectButton}
                      disabled={saving}
                      onClick={() => setShowReject(true)}
                      type="button"
                    >
                      Reject
                    </button>
                  )}
                  <button
                    className={filterStyles.approveButton}
                    disabled={
                      saving ||
                      (["PV", "CA"].includes(activeReview.type) && !signature)
                    }
                    onClick={() =>
                      standalone
                        ? actOnActive("approve")
                        : recordDecision("approve")
                    }
                    type="button"
                  >
                    {saving
                      ? "Saving…"
                      : activeReview.type === "PC"
                        ? "Mark as previewed"
                        : activeReview.type === "CL"
                          ? "Approve for payment"
                          : "Approve and forward"}
                  </button>
                  {["PV", "CA"].includes(activeReview.type) && !signature && (
                    <small>
                      Upload your signature in Settings before approving.
                    </small>
                  )}
                </section>
                {showReject && (
                  <section className={filterStyles.rejectPanel}>
                    <label>
                      <span>Rejection remarks *</span>
                      <textarea
                        autoFocus
                        onChange={(event) =>
                          setRejectReason(event.target.value)
                        }
                        placeholder="Explain what the requester needs to amend"
                        rows={4}
                        value={rejectReason}
                      />
                    </label>
                    <div>
                      <button
                        onClick={() => {
                          setShowReject(false);
                          setRejectReason("");
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className={filterStyles.rejectButton}
                        disabled={!rejectReason.trim() || saving}
                        onClick={() =>
                          standalone
                            ? actOnActive("reject")
                            : recordDecision("reject")
                        }
                        type="button"
                      >
                        {saving
                          ? "Returning…"
                          : standalone
                            ? "Reject and return"
                            : "Confirm rejection"}
                      </button>
                    </div>
                  </section>
                )}
              </aside>
            </div>
            <footer>
              <button
                disabled={standalone ? standaloneIndex <= 0 : reviewIndex === 0}
                onClick={() => {
                  setShowReject(false);
                  setRejectReason("");
                  if (standalone)
                    setStandalone(
                      visible[Math.max(0, standaloneIndex - 1)] ?? null,
                    );
                  else
                    setReviewIndex((value) =>
                      value === null ? null : Math.max(0, value - 1),
                    );
                }}
                type="button"
              >
                Previous
              </button>
              <button
                disabled={
                  standalone
                    ? standaloneIndex >= visible.length - 1
                    : reviewIndex === selected.length - 1
                }
                onClick={() => {
                  setShowReject(false);
                  setRejectReason("");
                  if (standalone)
                    setStandalone(
                      visible[
                        Math.min(visible.length - 1, standaloneIndex + 1)
                      ] ?? null,
                    );
                  else
                    setReviewIndex((value) =>
                      value === null
                        ? null
                        : Math.min(selected.length - 1, value + 1),
                    );
                }}
                type="button"
              >
                Next
              </button>
              <span />
              <button
                onClick={() => {
                  setReviewIndex(null);
                  setStandalone(null);
                  setShowReject(false);
                  setRejectReason("");
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

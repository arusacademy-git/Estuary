"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchInvoicePayments } from "@/data/payment-requests/invoice-payment/api";
import { fetchTravelAllowances } from "@/data/payment-requests/travel-allowance/api";
import { fetchCashAdvances } from "@/data/payment-requests/cash-advance/cash-advance-api";
import { fetchPettyCashRequests } from "@/data/payment-requests/petty-cash/api";
import { fetchClaimRequests } from "@/data/payment-requests/claims/api";
import {
  CLAIM_TYPES,
  claimTypeDetails,
} from "@/domain/payment-requests/claims/types";
import { usePaymentVouchers } from "@/features/payment-voucher/hooks/use-payment-vouchers";
import { savePaymentVoucherFinanceInformation } from "@/data/payment-vouchers/payment-voucher-api";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import { FinanceProcessingPanel } from "@/features/payment-voucher/components/finance/finance-payment-panel";
import type { InvoicePaymentRequestRecord } from "@/domain/payment-requests/invoice-payment/types";
import type { TravelAllowanceRecord } from "@/domain/payment-requests/travel-allowance/types";
import type { CashAdvanceRecord } from "@/domain/payment-requests/cash-advance/types";
import type { PettyCashRecord } from "@/domain/payment-requests/petty-cash/types";
import type { ClaimRecord } from "@/domain/payment-requests/claims/types";
import { standardPaymentStatusLabel } from "@/domain/payment-requests/standard-payment-status";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "../manager-pending-approvals/manager-pending-approvals.module.css";
import filterStyles from "../manager-pending-approvals/manager-pending-approvals-filter.module.css";
import financeStyles from "./finance-pending-processing.module.css";
import { InvoicePaymentFinanceReview } from "../invoice-payment/finance/invoice-payment-finance-review";
import { TravelAllowanceFinanceReview } from "../travel-allowance/finance/travel-allowance-finance-review";
import { CashAdvanceFinanceReview } from "../cash-advance/finance/cash-advance-finance-review";
import { PettyCashFinanceReview } from "../petty-cash/finance/petty-cash-finance-review";
import { ClaimFinanceReview } from "../claims/finance/claim-finance-review";

type PaymentType = "PV" | "PC" | "INV" | "TA" | "CA" | "CL";
type StageFilter =
  | "ALL"
  | "PROCESSING"
  | "RECONCILIATION"
  | "VERIFICATION"
  | "PROOF"
  | "PROOF_UPLOADED";
type Row = {
  key: string;
  type: PaymentType;
  reference: string;
  requester: string;
  programme: string;
  amount: number;
  updatedAt: string;
  status: string;
  statusLabel: string;
  claimType?: string;
  paymentReference?: string;
  proofRecorded: boolean;
  href: string;
  voucher?: PaymentVoucherRecord;
  detail?:
    | InvoicePaymentRequestRecord
    | TravelAllowanceRecord
    | CashAdvanceRecord
    | PettyCashRecord
    | ClaimRecord;
};

const tabs: Array<{ value: PaymentType; label: string; colour: string }> = [
  { value: "PV", label: "Payment Voucher", colour: "#2563eb" },
  { value: "PC", label: "Petty Cash", colour: "#ffffff" },
  { value: "INV", label: "Invoice Payment", colour: "#10b981" },
  { value: "TA", label: "Travel Allowance", colour: "#f59e0b" },
  { value: "CA", label: "Cash Advance", colour: "#e11d48" },
  { value: "CL", label: "Claims", colour: "#111827" },
];
const financeVoucherStatuses = [
  "APPROVED_FOR_PAYMENT",
  "FINANCE_PROCESSING",
  "PENDING_FINANCE_VERIFICATION",
];
const financePettyStatuses = [
  "PENDING_FINANCE_REVIEW",
  "PENDING_FINANCE_PAYMENT",
  "FINANCE_VERIFIED",
  "PENDING_FINANCE_RECONCILIATION",
  "TRANSACTION_PROOF_UPLOADED",
];
const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    value,
  );
const requestedPaymentType = (): PaymentType => {
  if (typeof window === "undefined") return "PV";
  const requestedType = new URLSearchParams(window.location.search).get(
    "type",
  ) as PaymentType | null;
  return requestedType && tabs.some((tab) => tab.value === requestedType)
    ? requestedType
    : "PV";
};
function stage(row: Row): Exclude<StageFilter, "ALL"> {
  if (row.proofRecorded) return "PROOF_UPLOADED";
  if (
    ["PENDING_FINANCE_RECONCILIATION", "RECON_PENDING_CHILD_CLOSURE"].includes(
      row.status,
    )
  )
    return "RECONCILIATION";
  if (row.paymentReference && !row.proofRecorded) return "PROOF";
  if (["PENDING_FINANCE_VERIFICATION", "FINANCE_VERIFIED"].includes(row.status))
    return "VERIFICATION";
  return "PROCESSING";
}
export function FinancePendingProcessing() {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [records, setRecords] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeType, setActiveType] =
    useState<PaymentType>(requestedPaymentType);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StageFilter>("ALL");
  const [claimType, setClaimType] = useState("ALL");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<"OLDEST" | "NEWEST" | "AMOUNT_DESC">(
    "OLDEST",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [uploadingProofKey, setUploadingProofKey] = useState<string | null>(
    null,
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const {
    records: vouchers,
    isLoading: vouchersLoading,
    refresh: refreshVouchers,
  } = usePaymentVouchers();

  useEffect(() => {
    const refresh = () => setRefreshVersion((current) => current + 1);
    window.addEventListener("estuary:finance-queue-changed", refresh);
    return () => window.removeEventListener("estuary:finance-queue-changed", refresh);
  }, []);

  useEffect(() => {
    if (!account || account.role !== "finance") return;
    let cancelled = false;
    Promise.all([
      fetchInvoicePayments({
        role: "finance",
        userId: account.id,
        includeAll: true,
      }),
      fetchTravelAllowances({
        role: "finance",
        userId: account.id,
        includeAll: true,
      }),
      fetchCashAdvances({
        role: "finance",
        userId: account.id,
        includeAll: true,
      }),
      fetchPettyCashRequests({
        role: "finance",
        userId: account.id,
        includeAll: true,
      }),
      fetchClaimRequests({ role: "finance", userId: account.id }),
    ])
      .then(([invoices, travel, cash, petty, claims]) => {
        if (cancelled) return;
        setRecords([
          ...invoices
            .filter((item) => ["PENDING_FINANCE_REVIEW", "PAYMENT_PROCESSED", "TRANSACTION_PROOF_UPLOADED"].includes(item.status))
            .map(
              (item): Row => ({
                key: `INV:${item.id}`,
                type: "INV",
                reference: item.requestNumber,
                requester: item.staffName,
                programme: item.projectName,
                amount: item.totalAmount,
                updatedAt: item.updatedAt,
                status: item.status,
                statusLabel: standardPaymentStatusLabel(item.status),
                paymentReference: item.financePaymentReference,
                proofRecorded: item.status === "TRANSACTION_PROOF_UPLOADED",
                href: `/beta/finance/payment-requests/invoice-payments/${item.id}`,
                detail: item,
              }),
            ),
          ...travel
            .filter((item) => ["PENDING_FINANCE_VERIFICATION", "PAYMENT_PROCESSED", "TRANSACTION_PROOF_UPLOADED"].includes(item.status))
            .map(
              (item): Row => ({
                key: `TA:${item.id}`,
                type: "TA",
                reference: item.requestNumber,
                requester: item.requesterName,
                programme: item.lines[0]?.projectName ?? "—",
                amount: item.totalAmount,
                updatedAt: item.updatedAt,
                status: item.status,
                statusLabel: "Pending Finance Verification",
                paymentReference: item.financePaymentReference,
                proofRecorded: item.status === "TRANSACTION_PROOF_UPLOADED" || Boolean(item.financeTransactionProof),
                href: `/beta/finance/payment-requests/travel-allowances/${item.id}`,
                detail: item,
              }),
            ),
          ...cash
            .filter((item) =>
              [
                "PENDING_FINANCE_PROCESSING",
                "PAYMENT_PROCESSED",
                "PENDING_FINANCE_RECONCILIATION",
                "TRANSACTION_PROOF_UPLOADED",
              ].includes(item.status),
            )
            .map(
              (item): Row => ({
                key: `CA:${item.id}`,
                type: "CA",
                reference: item.requestNumber,
                requester: item.requesterName,
                programme: item.projectName,
                amount: item.totalAmount,
                updatedAt: item.updatedAt,
                status: item.status,
                statusLabel: label(item.status),
                paymentReference: item.financePaymentReference,
                proofRecorded: item.status === "TRANSACTION_PROOF_UPLOADED" || Boolean(item.financeTransactionProof),
                href: `/beta/finance/payment-requests/cash-advance/${item.id}`,
                detail: item,
              }),
            ),
          ...petty
            .filter(
              (item) =>
                financePettyStatuses.includes(item.status) &&
                (item.status !== "PENDING_FINANCE_REVIEW" ||
                  item.financeReviewerId === account.id),
            )
            .map(
              (item): Row => ({
                key: `PC:${item.id}`,
                type: "PC",
                reference: item.requestNumber,
                requester: item.requesterName,
                programme:
                  item.location === "PENANG" ? "Penang" : "Kuala Lumpur",
                amount: item.totalAmount,
                updatedAt: item.updatedAt,
                status: item.status,
                statusLabel: label(item.status),
                paymentReference: item.paymentReference,
                proofRecorded: Boolean(item.paymentProofLink),
                href: `/beta/finance/payment-requests/petty-cash/${item.id}`,
                detail: item,
              }),
            ),
          ...claims
            .filter((item) =>
              [
                "PENDING_FINANCE_VERIFICATION",
                "PENDING_FINANCE_PROCESSING",
                "APPROVED_FOR_PAYMENT",
                "PAYMENT_PROCESSED",
                "TRANSACTION_PROOF_UPLOADED",
              ].includes(item.status),
            )
            .map(
              (item): Row => ({
                key: `CL:${item.id}`,
                type: "CL",
                reference: item.claimNumber,
                requester: item.requesterName,
                programme: item.lines[0]?.division ?? "—",
                amount: item.totalAmount,
                updatedAt: item.updatedAt,
                status: item.status,
                statusLabel: standardPaymentStatusLabel(item.status),
                claimType: item.claimType,
                paymentReference: item.paymentReference,
                proofRecorded: item.status === "TRANSACTION_PROOF_UPLOADED",
                href: `/beta/finance/payment-requests/claims/${item.id}`,
                detail: item,
              }),
            ),
        ]);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Finance requests could not be loaded.",
        ),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, refreshVersion]);

  const voucherRows = useMemo<Row[]>(
    () =>
      vouchers
        .filter((item) => financeVoucherStatuses.includes(item.status))
        .map((item) => ({
          key: `PV:${item.id}`,
          type: "PV",
          reference: item.voucherNumber,
          requester: item.recipientName,
          programme: item.division,
          amount: item.amount,
          updatedAt: item.updatedAt,
          status: item.status,
          statusLabel: label(item.status),
          paymentReference: item.paymentReference,
          proofRecorded: Boolean(
            item.paymentProofFileName || item.receiptFileName,
          ),
          href: `/beta/finance?queue=processing&voucher=${encodeURIComponent(item.id)}`,
          voucher: item,
        })),
    [vouchers],
  );
  const allRows = useMemo(
    () => [...voucherRows, ...records],
    [records, voucherRows],
  );
  const waitingCount = allRows.length;

  async function uploadVoucherProof(row: Row, file: File) {
    if (!account || !row.voucher) return;
    setUploadingProofKey(row.key);
    setError("");
    try {
      await savePaymentVoucherFinanceInformation(row.voucher.id, {
        financeId: account.id,
        paymentDate:
          row.voucher.paymentDate || new Date().toISOString().slice(0, 10),
        paymentReference:
          row.voucher.paymentReference || row.voucher.voucherNumber,
        paymentRemarks: row.voucher.paymentRemarks,
        paymentProofFileName: file.name,
      });
      await refreshVouchers();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The transaction proof could not be uploaded.",
      );
    } finally {
      setUploadingProofKey(null);
    }
  }

  useEffect(() => {
    if (deepLinkHandled || allRows.length === 0) return;
    const requestedRecord = new URLSearchParams(window.location.search).get(
      "request",
    );
    if (!requestedRecord) {
      const timeoutId = window.setTimeout(() => setDeepLinkHandled(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    const row = allRows.find(
      (item) =>
        item.key === requestedRecord ||
        item.key.endsWith(`:${requestedRecord}`) ||
        item.reference === requestedRecord,
    );
    if (!row) return;
    const timeoutId = window.setTimeout(() => {
      setActiveType(row.type);
      setStatus("ALL");
      setClaimType("ALL");
      setSelected([row.key]);
      setOpenIndex(0);
      setDeepLinkHandled(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
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
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allRows
      .filter(
        (row) =>
          row.type === activeType &&
          (status === "ALL" || stage(row) === status) &&
          (row.type !== "CL" ||
            claimType === "ALL" ||
            row.claimType === claimType) &&
          (!month || row.updatedAt.startsWith(month)) &&
          (!query ||
            [
              row.reference,
              row.requester,
              row.programme,
              row.paymentReference ?? "",
              row.statusLabel,
              row.claimType
                ? claimTypeDetails(
                    row.claimType as Parameters<typeof claimTypeDetails>[0],
                  ).label
                : "",
            ].some((value) => value.toLowerCase().includes(query))),
      )
      .sort((a, b) =>
        sort === "AMOUNT_DESC"
          ? b.amount - a.amount
          : sort === "NEWEST"
            ? b.updatedAt.localeCompare(a.updatedAt)
            : a.updatedAt.localeCompare(b.updatedAt),
      );
  }, [activeType, allRows, claimType, month, search, sort, status]);
  const selectedRows = useMemo(
    () => allRows.filter((row) => selected.includes(row.key)),
    [allRows, selected],
  );
  const openRow = openIndex === null ? undefined : selectedRows[openIndex];

  if (!account || account.role !== "finance")
    return (
      <main className={styles.state}>
        <h1>Finance access required</h1>
        <p>Sign in using a Finance account.</p>
      </main>
    );
  if (loading || vouchersLoading)
    return (
      <main className={styles.state}>
        <h1>Loading pending processing</h1>
        <p>Combining Finance requests…</p>
      </main>
    );
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Finance · Pending processing</p>
          <h1>Pending processing</h1>
          <span>
            Finance processing, verification, reconciliation and transaction
            proofs in one queue.
          </span>
        </div>
        <div>
          <small>Waiting for Finance</small>
          <strong>{loading || vouchersLoading ? "—" : waitingCount}</strong>
        </div>
      </header>
      <nav className={styles.tabs} aria-label="Payment type filters">
        {tabs.map((tab) => (
          <button
            data-active={activeType === tab.value}
            key={tab.value}
            onClick={() => {
              setActiveType(tab.value);
              setStatus("ALL");
              setClaimType("ALL");
              setSelected([]);
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
            <p>Finance queue</p>
            <h2>{tabs.find((tab) => tab.value === activeType)?.label}</h2>
          </div>
          <span>{visible.length} records</span>
        </header>
        <div className={filterStyles.panel}>
          <div className={filterStyles.heading}>
            <div>
              <h3>Find pending processing</h3>
              <p>
                Search and filter requests that still require Finance action.
              </p>
            </div>
            <button
              onClick={() => {
                setSearch("");
                setStatus("ALL");
                setClaimType("ALL");
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
                onChange={(event) =>
                  setStatus(event.target.value as StageFilter)
                }
                value={status}
              >
                <option value="ALL">All Finance actions</option>
                <option value="PROCESSING">Finance processing</option>
                <option value="VERIFICATION">Finance verifying</option>
                <option value="RECONCILIATION">Finance reconciliation</option>
                <option value="PROOF">Finance payment is processed</option>
                <option value="PROOF_UPLOADED">
                  Finance payment transaction proof has been uploaded
                </option>
              </select>
            </label>
            {activeType === "CL" && (
              <label>
                <span>Claim type</span>
                <select
                  aria-label="Filter Claims by type"
                  onChange={(event) => setClaimType(event.target.value)}
                  value={claimType}
                >
                  <option value="ALL">All Claim types</option>
                  {CLAIM_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>Updated month</span>
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
                <th>
                  <span className="sr-only">Select</span>
                </th>
                <th>Type</th>
                <th>Reference</th>
                <th>Requester</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment reference</th>
                <th>Transaction proof</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.key}>
                  <td>
                    <input
                      aria-label={`Select ${row.reference}`}
                      checked={selected.includes(row.key)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, row.key]
                            : current.filter((key) => key !== row.key),
                        )
                      }
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
                  <td>
                    <span className={styles.stage}>{row.statusLabel}</span>
                  </td>
                  <td>
                    {row.paymentReference || (
                      <span className={filterStyles.mutedValue}>
                        Not recorded
                      </span>
                    )}
                  </td>
                  <td>
                    {!row.paymentReference ? (
                      <span className={filterStyles.mutedValue}>
                        Add reference first
                      </span>
                    ) : row.type === "PV" ? (
                      <div className={filterStyles.proofControls}>
                        {row.proofRecorded && (
                          <span className={filterStyles.proofComplete}>
                            {row.voucher?.paymentProofFileName ||
                              row.voucher?.receiptFileName ||
                              "Uploaded"}
                          </span>
                        )}
                        <label className={filterStyles.proofAction}>
                          {uploadingProofKey === row.key
                            ? "Uploading…"
                            : row.proofRecorded
                              ? "Replace receipt"
                              : "Upload receipt"}
                          <input
                            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                            disabled={uploadingProofKey === row.key}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              if (file) void uploadVoucherProof(row, file);
                              event.currentTarget.value = "";
                            }}
                            type="file"
                          />
                        </label>
                      </div>
                    ) : row.proofRecorded ? (
                      <span className={filterStyles.proofComplete}>
                        Uploaded
                      </span>
                    ) : (
                      <button
                        className={filterStyles.proofAction}
                        onClick={() => {
                          setSelected([row.key]);
                          setOpenIndex(0);
                        }}
                        type="button"
                      >
                        Upload receipt
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      className={filterStyles.rowAction}
                      onClick={() => {
                        setSelected([row.key]);
                        setOpenIndex(0);
                      }}
                      type="button"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <div className={styles.empty}>
            No pending Finance records match these filters.
          </div>
        )}
        {selectedRows.length > 0 && openIndex === null && (
          <div className={financeStyles.selectionBar}>
            <strong>{selectedRows.length} selected</strong>
            <div>
              <button onClick={() => setSelected([])} type="button">
                Clear
              </button>
              <button onClick={() => setOpenIndex(0)} type="button">
                Review selected ({selectedRows.length})
              </button>
            </div>
          </div>
        )}
      </section>
      {openRow && (
        <div className={financeStyles.overlay} role="presentation">
          <section
            aria-modal="true"
            className={financeStyles.modal}
            role="dialog"
          >
            <header>
              <div>
                <p>
                  Finance processing · {openIndex! + 1} of {selectedRows.length}
                </p>
                <h2>{openRow.reference}</h2>
              </div>
              <button
                aria-label="Close"
                onClick={() => setOpenIndex(null)}
                type="button"
              >
                ×
              </button>
            </header>
            {openRow.type === "PV" && openRow.voucher ? (
              <FinanceProcessingPanel
                finance={account}
                key={`${openRow.voucher.id}-${openRow.voucher.updatedAt}`}
                onUpdated={refreshVouchers}
                voucher={openRow.voucher}
              />
            ) : (
              <div className={financeStyles.embeddedReview}>
                {openRow.type === "INV" && (
                  <InvoicePaymentFinanceReview
                    embedded
                    initialRecord={
                      openRow.detail as InvoicePaymentRequestRecord
                    }
                    requestId={openRow.key.slice(4)}
                  />
                )}
                {openRow.type === "TA" && (
                  <TravelAllowanceFinanceReview
                    embedded
                    initialRecord={openRow.detail as TravelAllowanceRecord}
                    requestId={openRow.key.slice(3)}
                  />
                )}
                {openRow.type === "CA" && (
                  <CashAdvanceFinanceReview
                    embedded
                    id={openRow.key.slice(3)}
                    initialRecord={openRow.detail as CashAdvanceRecord}
                  />
                )}
                {openRow.type === "PC" && (
                  <PettyCashFinanceReview
                    embedded
                    initialRecord={openRow.detail as PettyCashRecord}
                    requestId={openRow.key.slice(3)}
                  />
                )}
                {openRow.type === "CL" && (
                  <ClaimFinanceReview
                    embedded
                    initialRecord={openRow.detail as ClaimRecord}
                    requestId={openRow.key.slice(3)}
                  />
                )}
              </div>
            )}
            <footer>
              <button
                disabled={openIndex === 0}
                onClick={() =>
                  setOpenIndex((value) => Math.max(0, (value ?? 0) - 1))
                }
                type="button"
              >
                Previous
              </button>
              <button
                disabled={openIndex === selectedRows.length - 1}
                onClick={() =>
                  setOpenIndex((value) =>
                    Math.min(selectedRows.length - 1, (value ?? 0) + 1),
                  )
                }
                type="button"
              >
                Next
              </button>
              <button onClick={() => setOpenIndex(null)} type="button">
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ListPagination } from "@/components/ui/list-pagination/list-pagination";
import { useListPagination } from "@/components/ui/list-pagination/use-list-pagination";
import { fetchCashAdvances } from "@/data/payment-requests/cash-advance/cash-advance-api";
import { fetchClaimRequests } from "@/data/payment-requests/claims/api";
import { fetchInvoicePayments } from "@/data/payment-requests/invoice-payment/api";
import { fetchManualFormDrafts } from "@/data/payment-requests/manual-drafts/api";
import { fetchPettyCashRequests } from "@/data/payment-requests/petty-cash/api";
import { fetchTravelAllowances } from "@/data/payment-requests/travel-allowance/api";
import type { CashAdvanceStatus } from "@/domain/payment-requests/cash-advance/types";
import type { ClaimStatus } from "@/domain/payment-requests/claims/types";
import type { PaymentRequestStatus } from "@/domain/payment-requests/invoice-payment/types";
import type { PettyCashStatus } from "@/domain/payment-requests/petty-cash/types";
import type { TravelAllowanceStatus } from "@/domain/payment-requests/travel-allowance/types";
import {
  getPaymentVoucherStatusLabel,
  PAYMENT_VOUCHER_STATUSES,
  PAYMENT_VOUCHER_STATUS_LABELS,
} from "@/domain/payment-vouchers/status";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import {
  PaymentRecordDownloadPanel,
  type DownloadablePaymentRecord,
} from "@/features/payment-records/components/shared/payment-record-download-panel";
import type { PaymentRecordZipEntry } from "@/features/payment-records/components/shared/download-payment-record-forms-zip";
import { MyRequestAction } from "@/features/payment-records/components/shared/my-request-action";
import { usePaymentVouchers } from "@/features/payment-voucher/hooks/use-payment-vouchers";
import { createSignedPaymentVoucherPdfEntry } from "@/features/payment-voucher/pdf/download-signed-payment-vouchers-zip";
import { readBetaSession } from "@/lib/auth/beta-accounts";

import styles from "./unified-payment-records.module.css";

type PaymentType =
  | "PAYMENT_VOUCHER"
  | "INVOICE_PAYMENT"
  | "TRAVEL_ALLOWANCE"
  | "CASH_ADVANCE"
  | "PETTY_CASH"
  | "CLAIM";
type Row = {
  id: string;
  type: PaymentType;
  reference: string;
  purpose: string;
  requesterId: string;
  status: string;
  statusLabel: string;
  submittedAt: string;
  updatedAt: string;
  amount: number;
  href: string;
  draft: boolean;
  action: boolean;
  forms: PaymentRecordZipEntry[];
  receipts: PaymentRecordZipEntry[];
};
type SummaryFilter = "ALL" | "DRAFT" | "PROGRESS" | "ACTION" | "COMPLETED";

const types: Array<{ value: PaymentType; label: string; code: string }> = [
  { value: "PAYMENT_VOUCHER", label: "Payment Vouchers", code: "PV" },
  { value: "INVOICE_PAYMENT", label: "Invoice Payments", code: "INV" },
  { value: "TRAVEL_ALLOWANCE", label: "Travel Allowances", code: "TA" },
  { value: "CASH_ADVANCE", label: "Cash Advances", code: "CA" },
  { value: "PETTY_CASH", label: "Petty Cash", code: "PC" },
  { value: "CLAIM", label: "Claims", code: "CL" },
];
const createOptions: Array<{
  type: PaymentType;
  label: string;
  description: string;
  href: string;
}> = [
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
    description: "Submit travel-related allowances",
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
    type: "CLAIM",
    label: "Claims",
    description: "Get reimbursed for an expense",
    href: "/beta/payment-requests/claims/new",
  },
];
const summaryIcons: Record<Exclude<SummaryFilter, "ALL">, string> = {
  DRAFT: "/assets/icons/submitted-doc-white.png",
  PROGRESS: "/assets/icons/in-progress-clock-white.png",
  ACTION: "/assets/icons/requires-action-bell-white.png",
  COMPLETED: "/assets/icons/completed-check-white.png",
};
const completed = new Set(["COMPLETED", "PAID", "RECONCILED", "CLOSED"]);
const actionStatuses = new Set([
  "DRAFT",
  "REJECTED",
  "RETURNED_TO_STAFF",
  "RETURNED_TO_CLAIMANT",
  "PENDING_RECONCILIATION",
  "AWAITING_RECIPIENT_SIGNATURE",
  "AWAITING_STAFF_CONFIRMATION",
  "AWAITING_STAFF_VERIFICATION",
]);

type StatusOption = { value: string; label: string };
const options = (values: readonly string[]): StatusOption[] =>
  values.map((value) => ({
    value,
    label: value
      .toLowerCase()
      .split("_")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
  }));

const invoiceStatuses = [
  "DRAFT",
  "PENDING_MANAGER_REVIEW",
  "PENDING_DIRECTOR_REVIEW",
  "PENDING_FINANCE_REVIEW",
  "PAYMENT_PROCESSED",
  "TRANSACTION_PROOF_UPLOADED",
  "COMPLETED",
  "RETURNED_TO_STAFF",
] as const satisfies readonly PaymentRequestStatus[];
const travelStatuses = [
  "PENDING_MANAGER_REVIEW",
  "PENDING_DIRECTOR_APPROVAL",
  "PENDING_FINANCE_VERIFICATION",
  "PAYMENT_PROCESSED",
  "TRANSACTION_PROOF_UPLOADED",
  "RETURNED_TO_STAFF",
  "COMPLETED",
] as const satisfies readonly TravelAllowanceStatus[];
const cashAdvanceStatuses = [
  "PENDING_MANAGER_APPROVAL",
  "PENDING_DIRECTOR_APPROVAL",
  "PENDING_FINANCE_PROCESSING",
  "PAYMENT_PROCESSED",
  "PENDING_RECONCILIATION",
  "PENDING_FINANCE_RECONCILIATION",
  "TRANSACTION_PROOF_UPLOADED",
  "RETURNED_TO_STAFF",
  "COMPLETED",
] as const satisfies readonly CashAdvanceStatus[];
const pettyCashStatuses = [
  "PENDING_MANAGER_APPROVAL",
  "PENDING_DIRECTOR_APPROVAL",
  "PENDING_FINANCE_REVIEW",
  "PENDING_FINANCE_PAYMENT",
  "PAYMENT_PROCESSED",
  "FINANCE_VERIFIED",
  "TRANSACTION_PROOF_UPLOADED",
  "PENDING_RECONCILIATION",
  "PENDING_FINANCE_RECONCILIATION",
  "RECONCILED",
  "RETURNED_TO_STAFF",
  "PAID",
] as const satisfies readonly PettyCashStatus[];
const claimStatuses = [
  "DRAFT",
  "CLAIM_SUBMITTED",
  "PENDING_FINANCE_VERIFICATION",
  "PENDING_DIRECTOR_APPROVAL",
  "RETURNED_TO_CLAIMANT",
  "PAYMENT_REJECTED",
  "APPROVED_FOR_PAYMENT",
  "PAYMENT_PROCESSED",
  "TRANSACTION_PROOF_UPLOADED",
  "COMPLETED",
] as const satisfies readonly ClaimStatus[];

const statusOptionsByType: Record<PaymentType, StatusOption[]> = {
  PAYMENT_VOUCHER: PAYMENT_VOUCHER_STATUSES.map((value) => ({
    value,
    label: PAYMENT_VOUCHER_STATUS_LABELS[value],
  })),
  INVOICE_PAYMENT: options(invoiceStatuses),
  TRAVEL_ALLOWANCE: [
    { value: "DRAFT", label: "Draft" },
    ...options(travelStatuses),
  ],
  CASH_ADVANCE: [
    { value: "DRAFT", label: "Draft" },
    ...options(cashAdvanceStatuses),
  ],
  PETTY_CASH: [
    { value: "DRAFT", label: "Draft" },
    ...options(pettyCashStatuses),
  ],
  CLAIM: options(claimStatuses),
};

const object = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
function stringValue(
  record: Record<string, unknown>,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}
function numberValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}
const statusLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

function documentEntries(record: Record<string, unknown>) {
  const documents = Array.isArray(record.supportingDocuments)
    ? record.supportingDocuments
    : [];
  const supporting = documents.flatMap((value, index) => {
    const document = object(value);
    const url = stringValue(document, ["dataUrl", "url", "href"]);
    if (!url) return [];
    return [
      {
        name: stringValue(
          document,
          ["fileName", "name"],
          `document-${index + 1}`,
        ),
        url,
      },
    ];
  });
  const lines = Array.isArray(record.lines) ? record.lines : [];
  const receipts = lines.flatMap((value, index) => {
    const line = object(value);
    const url = stringValue(line, ["receiptLink", "proofLink"]);
    if (!url) return [];
    return [
      {
        name: stringValue(
          line,
          ["receiptFileName", "proofFileName"],
          `receipt-${index + 1}`,
        ),
        url,
      },
    ];
  });
  return [...supporting, ...receipts];
}

function formEntries(
  record: Record<string, unknown>,
  type: PaymentType,
  id: string,
  reference: string,
  status: string,
): PaymentRecordZipEntry[] {
  if (!completed.has(status)) return [];
  if (type === "PAYMENT_VOUCHER") {
    const url = stringValue(record, ["signedPvDataUrl"]);
    const name = stringValue(
      record,
      ["signedPvFileName"],
      `${reference}-signed.pdf`,
    );
    if (url) return [{ name, url }];
    if (!stringValue(record, ["recipientSignatureDataUrl"])) return [];
    return [
      {
        name,
        load: async () =>
          (
            await createSignedPaymentVoucherPdfEntry(
              record as unknown as PaymentVoucherRecord,
            )
          ).bytes,
      },
    ];
  }
  if (type === "TRAVEL_ALLOWANCE" && id)
    return [
      {
        name: `${reference}.pdf`,
        url: `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}/form`,
      },
    ];
  if (type === "CASH_ADVANCE" && reference)
    return [
      {
        name: `${reference}-forms.pdf`,
        url: `/api/v1/payment-requests/cash-advance/${encodeURIComponent(reference)}/forms?form=pack`,
      },
    ];
  if (type === "CLAIM" && reference)
    return [
      {
        name: `${reference}.pdf`,
        url: `/api/v1/payment-requests/claims/${encodeURIComponent(reference)}?form=1`,
      },
    ];
  return [];
}

function normalize(
  value: unknown,
  type: PaymentType,
  requesterKeys: string[],
  route: string,
  useId = false,
): Row {
  const record = object(value);
  const id = stringValue(record, ["id"]);
  const reference = stringValue(
    record,
    [
      "requestNumber",
      "claimNumber",
      "referenceNumber",
      "voucherNumber",
      "reference",
      "id",
    ],
    id,
  );
  const status = stringValue(record, ["status"], "DRAFT");
  const submittedAt = stringValue(record, [
    "submittedAt",
    "requestDate",
    "claimDate",
    "createdAt",
    "updatedAt",
  ]);
  return {
    id: id || reference,
    type,
    reference,
    purpose: stringValue(
      record,
      ["title", "purpose", "description", "notes", "projectName", "vendorName"],
      types.find((item) => item.value === type)?.label,
    ),
    requesterId: stringValue(record, requesterKeys),
    status,
    statusLabel:
      type === "PAYMENT_VOUCHER"
        ? getPaymentVoucherStatusLabel(status as PaymentVoucherRecord["status"])
        : statusLabel(status),
    submittedAt,
    updatedAt: stringValue(
      record,
      ["updatedAt", "submittedAt", "createdAt"],
      submittedAt,
    ),
    amount: numberValue(record, [
      "totalAmount",
      "amount",
      "claimAmount",
      "requestedAmount",
    ]),
    href: `${route}/${encodeURIComponent(useId ? id : reference)}`,
    draft: status === "DRAFT",
    action: actionStatuses.has(status),
    forms: formEntries(record, type, id, reference, status),
    receipts: documentEntries(record),
  };
}

const formatDate = (value: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};
const money = (value: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    value,
  );
function actionLabel(row: Row) {
  if (row.draft) return "Continue draft";
  if (row.status === "PENDING_RECONCILIATION") return "Reconcile now";
  if (row.action) return "View action";
  if (completed.has(row.status)) return "View completed";
  return "View progress";
}

export function MyRequests() {
  const router = useRouter();
  const [account] = useState(() => readBetaSession());
  const { records: vouchers, isLoading: voucherLoading } = usePaymentVouchers();
  const [otherRows, setOtherRows] = useState<Row[]>([]);
  const [draftRows, setDraftRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"ALL" | PaymentType>("ALL"),
    [status, setStatus] = useState("ALL"),
    [search, setSearch] = useState(""),
    [month, setMonth] = useState(""),
    [exactDate, setExactDate] = useState(""),
    [sort, setSort] = useState("UPDATED_DESC"),
    [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("ALL"),
    [paymentMenuOpen, setPaymentMenuOpen] = useState(false);

  useEffect(() => {
    if (!account) {
      router.replace("/beta");
      return;
    }
    let active = true;
    Promise.all([
      fetchInvoicePayments({
        role: account.role,
        userId: account.id,
        includeAll: true,
      }),
      fetchTravelAllowances({
        role: account.role,
        userId: account.id,
        includeAll: true,
      }),
      fetchCashAdvances({
        role: account.role,
        userId: account.id,
        includeAll: true,
      }),
      fetchPettyCashRequests({
        role: account.role,
        userId: account.id,
        includeAll: true,
      }),
      fetchClaimRequests({ role: account.role, userId: account.id }),
      fetchManualFormDrafts("beta-arus-org", account.id),
    ])
      .then(([invoice, travel, cash, petty, claims, drafts]) => {
        if (!active) return;
        setOtherRows([
          ...invoice.map((item) =>
            normalize(
              item,
              "INVOICE_PAYMENT",
              ["staffId", "requesterId"],
              "/beta/payment-records/invoice-payments",
              true,
            ),
          ),
          ...travel.map((item) =>
            normalize(
              item,
              "TRAVEL_ALLOWANCE",
              ["requesterId"],
              "/beta/payment-records/travel-allowances",
              true,
            ),
          ),
          ...cash.map((item) =>
            normalize(
              item,
              "CASH_ADVANCE",
              ["requesterId"],
              "/beta/payment-records/cash-advances",
            ),
          ),
          ...petty.map((item) =>
            normalize(
              item,
              "PETTY_CASH",
              ["requesterId"],
              "/beta/payment-records/petty-cash",
            ),
          ),
          ...claims.map((item) =>
            normalize(
              item,
              "CLAIM",
              ["requesterId"],
              "/beta/payment-records/claims",
            ),
          ),
        ]);
        const draftRoutes: Record<PaymentType, string> = {
          PAYMENT_VOUCHER: "/beta/payment-vouchers/new",
          INVOICE_PAYMENT: "/beta/payment-requests/invoice-payment/new",
          TRAVEL_ALLOWANCE: "/beta/payment-requests/travel-allowance/new",
          CASH_ADVANCE: "/beta/payment-requests/cash-advance/new",
          PETTY_CASH: "/beta/payment-requests/petty-cash/new",
          CLAIM: "/beta/payment-requests/claims/draft",
        };
        setDraftRows(
          drafts.map((draft) => ({
            id: `draft-${draft.id}`,
            type: draft.paymentType,
            reference: "Draft",
            purpose: stringValue(
              object(draft.snapshot),
              ["title", "purpose", "notes"],
              "Saved manual draft",
            ),
            requesterId: draft.requesterId,
            status: "DRAFT",
            statusLabel: "Draft",
            submittedAt: draft.createdAt,
            updatedAt: draft.updatedAt,
            amount: numberValue(object(draft.snapshot), [
              "totalAmount",
              "amount",
            ]),
            href: `${draftRoutes[draft.paymentType]}?${new URLSearchParams({
              draft: "1",
              draftId: draft.id,
              ...(draft.paymentType === "PAYMENT_VOUCHER"
                ? { mode: "single" }
                : {}),
            })}`,
            draft: true,
            action: true,
            forms: [],
            receipts: [],
          })),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [account, router]);

  const rows = useMemo(() => {
    if (!account) return [];
    const voucherRows = vouchers.map((item) =>
      normalize(
        item,
        "PAYMENT_VOUCHER",
        ["submitterId"],
        "/beta/payment-vouchers",
        true,
      ),
    );
    return [...draftRows, ...voucherRows, ...otherRows].filter(
      (row) => row.draft || row.requesterId === account.id,
    );
  }, [account, draftRows, otherRows, vouchers]);
  const statuses = useMemo(() => {
    const source =
      type === "ALL"
        ? types.flatMap((item) => statusOptionsByType[item.value])
        : statusOptionsByType[type];
    return [
      ...new Map(
        source.map((option) => [option.value, option.label]),
      ).entries(),
    ];
  }, [type]);
  const effectiveStatus =
    status === "ALL" || statuses.some(([value]) => value === status)
      ? status
      : "ALL";
  const filtered = useMemo(
    () =>
      rows
        .filter((row) =>
          summaryFilter === "ALL"
            ? true
            : summaryFilter === "DRAFT"
              ? row.draft
              : summaryFilter === "ACTION"
                ? row.action && !row.draft
                : summaryFilter === "COMPLETED"
                  ? completed.has(row.status)
                  : !row.draft && !row.action && !completed.has(row.status),
        )
        .filter((row) => type === "ALL" || row.type === type)
        .filter(
          (row) => effectiveStatus === "ALL" || row.status === effectiveStatus,
        )
        .filter((row) => !month || row.submittedAt.slice(0, 7) === month)
        .filter(
          (row) => !exactDate || row.submittedAt.slice(0, 10) === exactDate,
        )
        .filter(
          (row) =>
            !search.trim() ||
            [row.reference, row.purpose, row.statusLabel].some((value) =>
              value.toLowerCase().includes(search.trim().toLowerCase()),
            ),
        )
        .sort((a, b) =>
          sort === "UPDATED_ASC"
            ? a.updatedAt.localeCompare(b.updatedAt)
            : sort === "AMOUNT_DESC"
              ? b.amount - a.amount
              : sort === "AMOUNT_ASC"
                ? a.amount - b.amount
                : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [
      effectiveStatus,
      exactDate,
      month,
      rows,
      search,
      sort,
      summaryFilter,
      type,
    ],
  );
  const pagination = useListPagination(filtered);
  const counts = {
    drafts: rows.filter((row) => row.draft).length,
    progress: rows.filter(
      (row) => !row.draft && !row.action && !completed.has(row.status),
    ).length,
    action: rows.filter((row) => row.action && !row.draft).length,
    completed: rows.filter((row) => completed.has(row.status)).length,
  };
  if (!account || loading || voucherLoading)
    return (
      <section className={styles.state}>
        <h1>Loading your requests</h1>
        <p>Combining all payment types into one view…</p>
      </section>
    );
  const clear = () => {
    setType("ALL");
    setStatus("ALL");
    setSearch("");
    setMonth("");
    setExactDate("");
    setSort("UPDATED_DESC");
    setSummaryFilter("ALL");
  };
  const selectType = (nextType: "ALL" | PaymentType) => {
    setType(nextType);
    setStatus("ALL");
  };
  const selectSummary = (nextFilter: Exclude<SummaryFilter, "ALL">) => {
    setSummaryFilter((current) =>
      current === nextFilter ? "ALL" : nextFilter,
    );
  };
  const visibleCreateOptions = createOptions.filter((option) => {
    if (option.type === "TRAVEL_ALLOWANCE") return account.role === "manager";
    if (option.type === "PAYMENT_VOUCHER") return account.role !== "director";
    return true;
  });
  const recentType = [...rows].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0]?.type;
  const recentOption = visibleCreateOptions.find(
    (option) => option.type === recentType,
  );
  const downloadRecords: DownloadablePaymentRecord[] = rows
    .filter((row) => !row.draft)
    .map((row) => ({
      id: row.id,
      type: row.type,
      reference: row.reference,
      status: row.status,
      completedAt: row.updatedAt || row.submittedAt,
      forms: row.forms,
      receipts: row.receipts,
    }));

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Your requests</p>
          <h1>My requests</h1>
          <span>
            Track what you submitted and act on anything that needs you: continue drafts, amend returned requests, upload reconciliation.
          </span>
        </div>
        <div className={styles.heroActions}>
          <button
            aria-expanded={paymentMenuOpen}
            className={styles.requestButton}
            onClick={() => setPaymentMenuOpen((open) => !open)}
            type="button"
          >
            ＋ Request a payment
          </button>
          <PaymentRecordDownloadPanel records={downloadRecords} />
          {paymentMenuOpen && (
            <div className={styles.paymentMenu}>
              {recentOption && (
                <div className={styles.paymentMenuGroup}>
                  <span>Recent</span>
                  <Link
                    data-type={recentOption.type}
                    href={recentOption.href}
                    onClick={() => setPaymentMenuOpen(false)}
                  >
                    <i />
                    <b>{recentOption.label}</b>
                    <small>{recentOption.description}</small>
                    <em>Last used</em>
                  </Link>
                </div>
              )}
              <div className={styles.paymentMenuGroup}>
                <span>All payment types</span>
                {visibleCreateOptions.map((option) => (
                  <Link
                    data-type={option.type}
                    href={option.href}
                    key={option.type}
                    onClick={() => setPaymentMenuOpen(false)}
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
      </header>
      <section className={styles.summary}>
        <button
          data-active={summaryFilter === "DRAFT"}
          data-tone="draft"
          onClick={() => selectSummary("DRAFT")}
          type="button"
        >
          {summaryFilter === "DRAFT" && <em>Showing</em>}
          <Image
            alt=""
            className={styles.summaryIcon}
            height={96}
            src={summaryIcons.DRAFT}
            width={96}
          />
          <span>Drafts</span>
          <strong>{counts.drafts}</strong>
          <small>Saved, not submitted</small>
        </button>
        <button
          data-active={summaryFilter === "PROGRESS"}
          data-tone="progress"
          onClick={() => selectSummary("PROGRESS")}
          type="button"
        >
          {summaryFilter === "PROGRESS" && <em>Showing</em>}
          <Image
            alt=""
            className={styles.summaryIcon}
            height={96}
            src={summaryIcons.PROGRESS}
            width={96}
          />
          <span>In progress</span>
          <strong>{counts.progress}</strong>
          <small>Moving through workflow</small>
        </button>
        <button
          data-active={summaryFilter === "ACTION"}
          data-tone="action"
          onClick={() => selectSummary("ACTION")}
          type="button"
        >
          {summaryFilter === "ACTION" && <em>Showing</em>}
          <Image
            alt=""
            className={styles.summaryIcon}
            height={96}
            src={summaryIcons.ACTION}
            width={96}
          />
          <span>Requires action</span>
          <strong>{counts.action}</strong>
          <small>Returned or reconciliation due</small>
        </button>
        <button
          data-active={summaryFilter === "COMPLETED"}
          data-tone="complete"
          onClick={() => selectSummary("COMPLETED")}
          type="button"
        >
          {summaryFilter === "COMPLETED" && <em>Showing</em>}
          <Image
            alt=""
            className={styles.summaryIcon}
            height={96}
            src={summaryIcons.COMPLETED}
            width={96}
          />
          <span>Completed</span>
          <strong>{counts.completed}</strong>
          <small>Paid or fully closed</small>
        </button>
      </section>
      <section className={styles.records}>
        <header>
          <div>
            <h2>
              {type === "ALL"
                ? summaryFilter === "ALL"
                  ? "All requests"
                  : summaryFilter === "DRAFT"
                    ? "Drafts"
                    : summaryFilter === "PROGRESS"
                      ? "In progress"
                      : summaryFilter === "ACTION"
                        ? "Requires action"
                        : "Completed"
                : types.find((item) => item.value === type)?.label}
            </h2>
            <p>Showing {filtered.length} matching requests</p>
          </div>
        </header>
        <div className={styles.typeTabs}>
          <button
            data-active={type === "ALL"}
            onClick={() => selectType("ALL")}
            type="button"
          >
            All types <span>{rows.length}</span>
          </button>
          {types.map((item) => (
            <button
              data-active={type === item.value}
              data-type={item.value}
              key={item.value}
              onClick={() => selectType(item.value)}
              type="button"
            >
              <i />
              {item.code}{" "}
              <span>
                {rows.filter((row) => row.type === item.value).length}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.filters}>
          <label>
            <span>Search</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Request no. or purpose"
              type="search"
              value={search}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              onChange={(event) => setStatus(event.target.value)}
              value={effectiveStatus}
            >
              <option value="ALL">All statuses</option>
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Month</span>
            <input
              onChange={(event) => setMonth(event.target.value)}
              type="month"
              value={month}
            />
          </label>
          <label>
            <span>Exact date</span>
            <input
              onChange={(event) => setExactDate(event.target.value)}
              type="date"
              value={exactDate}
            />
          </label>
          <label>
            <span>Sort by</span>
            <select
              onChange={(event) => setSort(event.target.value)}
              value={sort}
            >
              <option value="UPDATED_DESC">Newest updated</option>
              <option value="UPDATED_ASC">Oldest updated</option>
              <option value="AMOUNT_DESC">Highest amount</option>
              <option value="AMOUNT_ASC">Lowest amount</option>
            </select>
          </label>
          <button onClick={clear} type="button">
            Clear filters
          </button>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Request no.</th>
                <th>Type</th>
                <th>Purpose</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageRecords.map((row) => (
                <tr key={`${row.type}-${row.id}`}>
                  <td>
                    <strong>{row.reference}</strong>
                  </td>
                  <td>
                    <span className={styles.typeCode} data-type={row.type}>
                      {types.find((item) => item.value === row.type)?.code}
                    </span>
                  </td>
                  <td>{row.purpose}</td>
                  <td>
                    {row.draft ? "Not submitted" : formatDate(row.submittedAt)}
                  </td>
                  <td>
                    <span
                      className={styles.status}
                      data-action={row.action}
                      data-complete={completed.has(row.status)}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td>
                    <strong>{row.amount ? money(row.amount) : "—"}</strong>
                  </td>
                  <td>
                    <MyRequestAction
                      label={actionLabel(row)}
                      onDraftDeleted={(id) =>
                        setDraftRows((current) =>
                          current.filter((draft) => draft.id !== id),
                        )
                      }
                      organizationId="beta-arus-org"
                      record={row}
                      requesterId={account.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.totalRecords === 0 && (
            <div className={styles.empty}>
              <h3>No requests found</h3>
              <p>Try changing or clearing the selected filters.</p>
            </div>
          )}
        </div>
        <ListPagination
          currentPage={pagination.currentPage}
          firstRecord={pagination.firstRecord}
          lastRecord={pagination.lastRecord}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalRecords={pagination.totalRecords}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>
    </div>
  );
}

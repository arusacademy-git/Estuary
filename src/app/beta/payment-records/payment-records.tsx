"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ListPagination } from "@/components/ui/list-pagination/list-pagination";
import { useListPagination } from "@/components/ui/list-pagination/use-list-pagination";
import { fetchCashAdvances } from "@/data/payment-requests/cash-advance/cash-advance-api";
import { fetchClaimRequests } from "@/data/payment-requests/claims/api";
import { fetchInvoicePayments } from "@/data/payment-requests/invoice-payment/api";
import { fetchPettyCashRequests } from "@/data/payment-requests/petty-cash/api";
import { fetchTravelAllowances } from "@/data/payment-requests/travel-allowance/api";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import {
    MyRequestAction,
    type MyRequestActionRecord,
} from "@/features/payment-records/components/shared/my-request-action";
import {
    PaymentRecordDownloadPanel,
    type DownloadablePaymentRecord,
} from "@/features/payment-records/components/shared/payment-record-download-panel";
import type { PaymentRecordZipEntry } from "@/features/payment-records/components/shared/download-payment-record-forms-zip";
import { usePaymentVouchers } from "@/features/payment-voucher/hooks/use-payment-vouchers";
import { createSignedPaymentVoucherPdfEntry } from "@/features/payment-voucher/pdf/download-signed-payment-vouchers-zip";
import { readBetaSession } from "@/lib/auth/beta-accounts";

import styles from "./unified-payment-records.module.css";

type PaymentType = MyRequestActionRecord["type"];
type HistoryGroup = "COMPLETED" | "RECONCILED" | "INACTIVE";
type Row = MyRequestActionRecord & {
    status: string;
    statusLabel: string;
    group: HistoryGroup;
    paidOn: string;
    updatedAt: string;
    paymentReference: string;
    forms: PaymentRecordZipEntry[];
    receipts: PaymentRecordZipEntry[];
};

const types: Array<{ value: PaymentType; code: string }> = [
    { value: "PAYMENT_VOUCHER", code: "PV" },
    { value: "INVOICE_PAYMENT", code: "INV" },
    { value: "TRAVEL_ALLOWANCE", code: "TA" },
    { value: "CASH_ADVANCE", code: "CA" },
    { value: "PETTY_CASH", code: "PC" },
    { value: "CLAIM", code: "CL" },
];
const completedStatuses = new Set(["COMPLETED", "PAID", "CLOSED"]);
const reconciledStatuses = new Set(["RECONCILED"]);
const inactiveStatuses = new Set([
    "INACTIVE",
    "VOIDED",
    "PAYMENT_REJECTED",
    "CANCELLED",
]);

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
    const supporting = Array.isArray(record.supportingDocuments)
        ? record.supportingDocuments
        : [];
    const entries = supporting.flatMap((value, index) => {
        const document = object(value);
        const url = stringValue(document, ["dataUrl", "url", "href"]);
        return url
            ? [
                {
                    name: stringValue(
                        document,
                        ["fileName", "name"],
                        `document-${index + 1}`,
                    ),
                    url,
                },
            ]
            : [];
    });
    const lines = Array.isArray(record.lines) ? record.lines : [];
    return [
        ...entries,
        ...lines.flatMap((value, index) => {
            const line = object(value);
            const url = stringValue(line, ["receiptLink", "proofLink"]);
            return url
                ? [
                    {
                        name: stringValue(
                            line,
                            ["receiptFileName", "proofFileName"],
                            `receipt-${index + 1}`,
                        ),
                        url,
                    },
                ]
                : [];
        }),
    ];
}

function formEntries(
    record: Record<string, unknown>,
    type: PaymentType,
    id: string,
    reference: string,
    status: string,
): PaymentRecordZipEntry[] {
    if (!completedStatuses.has(status) && !reconciledStatuses.has(status))
        return [];
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
    if (type === "CASH_ADVANCE")
        return [
            {
                name: `${reference}-forms.pdf`,
                url: `/api/v1/payment-requests/cash-advance/${encodeURIComponent(reference)}/forms?form=pack`,
            },
        ];
    if (type === "CLAIM")
        return [
            {
                name: `${reference}.pdf`,
                url: `/api/v1/payment-requests/claims/${encodeURIComponent(reference)}?form=1`,
            },
        ];
    return [];
}

function normalize(value: unknown, type: PaymentType): Row | null {
    const record = object(value);
    const status = stringValue(record, ["status"]);
    const group =
        reconciledStatuses.has(status) ||
            (type === "CASH_ADVANCE" && status === "COMPLETED")
            ? "RECONCILED"
            : inactiveStatuses.has(status)
                ? "INACTIVE"
                : completedStatuses.has(status)
                    ? "COMPLETED"
                    : null;
    if (!group) return null;
    const id = stringValue(record, ["id"]);
    const reference = stringValue(
        record,
        ["requestNumber", "claimNumber", "voucherNumber", "referenceNumber", "id"],
        id,
    );
    const paidOn = stringValue(record, [
        "completedAt",
        "paidAt",
        "paymentDate",
        "financePaymentDate",
        "financePaidAt",
        "updatedAt",
    ]);
    return {
        id: id || reference,
        type,
        reference,
        purpose: stringValue(
            record,
            ["title", "purpose", "description", "notes", "projectName", "vendorName"],
            "Historical payment record",
        ),
        amount: numberValue(record, [
            "totalAmount",
            "amount",
            "claimAmount",
            "requestedAmount",
        ]),
        href: "#",
        draft: false,
        status,
        statusLabel: statusLabel(status),
        group,
        paidOn,
        updatedAt: stringValue(
            record,
            ["updatedAt", "completedAt", "paidAt"],
            paidOn,
        ),
        paymentReference: stringValue(record, [
            "paymentReference",
            "financePaymentReference",
            "referenceNumber",
        ]),
        forms: formEntries(record, type, id, reference, status),
        receipts: documentEntries(record),
    };
}

const date = (value: string) => {
    const parsed = new Date(value);
    return !value || Number.isNaN(parsed.getTime())
        ? "—"
        : parsed.toLocaleDateString("en-MY", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
};
const money = (value: number) =>
    new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
    }).format(value);

export function PaymentRecords() {
    const router = useRouter();
    const searchParameters = useSearchParams();
    const requestedGroup = searchParameters.get("group");
    const [account] = useState(() => readBetaSession());
    const { records: vouchers, isLoading: vouchersLoading } =
        usePaymentVouchers();
    const [otherRows, setOtherRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [group, setGroup] = useState<HistoryGroup | "ALL">(() =>
        ["COMPLETED", "RECONCILED", "INACTIVE", "ALL"].includes(
            requestedGroup ?? "",
        )
            ? (requestedGroup as HistoryGroup | "ALL")
            : "COMPLETED",
    );
    const [type, setType] = useState<"ALL" | PaymentType>("ALL");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("ALL");
    const [month, setMonth] = useState("");
    const [exactDate, setExactDate] = useState("");
    const [sort, setSort] = useState("UPDATED_DESC");

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
        ])
            .then(([invoice, travel, cash, petty, claims]) => {
                if (!active) return;
                setOtherRows(
                    [
                        ...invoice.map((item) => normalize(item, "INVOICE_PAYMENT")),
                        ...travel.map((item) => normalize(item, "TRAVEL_ALLOWANCE")),
                        ...cash.map((item) => normalize(item, "CASH_ADVANCE")),
                        ...petty.map((item) => normalize(item, "PETTY_CASH")),
                        ...claims.map((item) => normalize(item, "CLAIM")),
                    ].filter((row): row is Row => Boolean(row)),
                );
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [account, router]);

    const rows = useMemo(
        () => [
            ...vouchers
                .map((item) => normalize(item, "PAYMENT_VOUCHER"))
                .filter((row): row is Row => Boolean(row)),
            ...otherRows,
        ],
        [otherRows, vouchers],
    );
    const groupRows =
        group === "ALL" ? rows : rows.filter((row) => row.group === group);
    const statuses = [
        ...new Set(
            groupRows
                .filter((row) => type === "ALL" || row.type === type)
                .map((row) => row.status),
        ),
    ];
    const filtered = groupRows
        .filter((row) => type === "ALL" || row.type === type)
        .filter((row) => status === "ALL" || row.status === status)
        .filter((row) => !month || row.paidOn.slice(0, 7) === month)
        .filter((row) => !exactDate || row.paidOn.slice(0, 10) === exactDate)
        .filter(
            (row) =>
                !search.trim() ||
                [row.reference, row.purpose, row.paymentReference].some((value) =>
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
        );
    const pagination = useListPagination(filtered);
    const downloadRecords: DownloadablePaymentRecord[] = rows.map((row) => ({
        id: row.id,
        type: row.type,
        reference: row.reference,
        status: row.status,
        completedAt: row.paidOn || row.updatedAt,
        forms: row.forms,
        receipts: row.receipts,
    }));
    const clear = () => {
        setType("ALL");
        setStatus("ALL");
        setSearch("");
        setMonth("");
        setExactDate("");
        setSort("UPDATED_DESC");
    };

    if (!account || loading || vouchersLoading)
        return (
            <section className={styles.state}>
                <h1>Loading payment records</h1>
                <p>Combining historical records from every payment type…</p>
            </section>
        );

    const groups = [
        {
            value: "COMPLETED" as const,
            label: "Completed",
            caption: "Paid and closed, all time",
            icon: "/assets/icons/completed-check-white.png",
        },
        {
            value: "RECONCILED" as const,
            label: "Reconciled",
            caption: "Cash Advance or Petty Cash closed",
            icon: "/assets/icons/reconciliation-sync-white.png",
        },
        {
            value: "INACTIVE" as const,
            label: "Rejected / inactive",
            caption: "Kept for reference",
            icon: "/assets/icons/rejected-inactive-shield-white.png",
        },
    ];

    return (
        <div className={styles.page}>
            <header className={styles.hero}>
                <div>
                    <p>Historical records</p>
                    <h1>Payment records</h1>
                    <span>
                        Your final history: payment reference and date, forms and receipts,
                        with approval history on every record.
                    </span>
                </div>
                <div className={styles.heroActions}>
                    <PaymentRecordDownloadPanel records={downloadRecords} />
                </div>
            </header>

            <section className={`${styles.summary} ${styles.historySummary}`}>
                {groups.map((item) => (
                    <button
                        data-active={group === item.value}
                        data-tone={item.value.toLowerCase()}
                        key={item.value}
                        onClick={() => {
                            setGroup((current) =>
                                current === item.value ? "ALL" : item.value,
                            );
                            clear();
                        }}
                        type="button"
                    >
                        {group === item.value && <em>Showing</em>}
                        <span>{item.label}</span>
                        <strong>
                            {rows.filter((row) => row.group === item.value).length}
                        </strong>
                        <small>{item.caption}</small>
                        <Image
                            alt=""
                            className={styles.summaryIcon}
                            height={76}
                            src={item.icon}
                            width={76}
                        />
                    </button>
                ))}
            </section>

            <section className={styles.records}>
                <header>
                    <div>
                        <h2>
                            {group === "INACTIVE"
                                ? "Rejected / inactive"
                                : group === "RECONCILED"
                                    ? "Reconciled"
                                    : group === "COMPLETED"
                                        ? "Completed"
                                        : "All historical records"}
                        </h2>
                        <p>Showing {filtered.length} matching records</p>
                    </div>
                </header>
                <div className={styles.typeTabs}>
                    <button
                        data-active={type === "ALL"}
                        onClick={() => {
                            setType("ALL");
                            setStatus("ALL");
                        }}
                        type="button"
                    >
                        All types <span>{groupRows.length}</span>
                    </button>
                    {types.map((item) => (
                        <button
                            data-active={type === item.value}
                            data-type={item.value}
                            key={item.value}
                            onClick={() => {
                                setType(item.value);
                                setStatus("ALL");
                            }}
                            type="button"
                        >
                            <i />
                            {item.code}{" "}
                            <span>
                                {groupRows.filter((row) => row.type === item.value).length}
                            </span>
                        </button>
                    ))}
                </div>
                <div className={styles.filters}>
                    <label>
                        Search
                        <input
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Request no. or ref."
                            value={search}
                        />
                    </label>
                    <label>
                        Status
                        <select
                            onChange={(event) => setStatus(event.target.value)}
                            value={status}
                        >
                            <option value="ALL">All statuses</option>
                            {statuses.map((value) => (
                                <option key={value} value={value}>
                                    {statusLabel(value)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Month
                        <input
                            onChange={(event) => setMonth(event.target.value)}
                            type="month"
                            value={month}
                        />
                    </label>
                    <label>
                        Exact date
                        <input
                            onChange={(event) => setExactDate(event.target.value)}
                            type="date"
                            value={exactDate}
                        />
                    </label>
                    <label>
                        Sort by
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
                                <th>Paid on</th>
                                <th>Payment ref.</th>
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
                                    <td>
                                        {row.purpose}
                                        <br />
                                        <span
                                            className={styles.historyStatus}
                                            data-group={row.group}
                                            data-status={row.status}
                                        >
                                            {row.statusLabel}
                                        </span>
                                    </td>
                                    <td>{date(row.paidOn)}</td>
                                    <td>{row.paymentReference || "—"}</td>
                                    <td>
                                        <strong>{money(row.amount)}</strong>
                                    </td>
                                    <td>
                                        <MyRequestAction
                                            label="History"
                                            onDraftDeleted={() => undefined}
                                            organizationId="beta-arus-org"
                                            record={row}
                                            requesterId={account.id}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!filtered.length && (
                        <div className={styles.empty}>
                            <h3>No historical records found</h3>
                            <p>Try another status, payment type, or date filter.</p>
                        </div>
                    )}
                </div>
                <ListPagination
                    currentPage={pagination.currentPage}
                    firstRecord={pagination.firstRecord}
                    lastRecord={pagination.lastRecord}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={pagination.setPageSize}
                    pageSize={pagination.pageSize}
                    pageCount={pagination.pageCount}
                    totalRecords={pagination.totalRecords}
                />
            </section>
        </div>
    );
}

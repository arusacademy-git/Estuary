"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchManualFormDrafts } from "@/data/payment-requests/manual-drafts/api";
import type {
  ManualDraftType,
  ManualFormDraft,
} from "@/domain/payment-requests/manual-drafts/types";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "./manual-draft-records.module.css";

const createHref: Record<ManualDraftType, string> = {
  PAYMENT_VOUCHER: "/beta/payment-vouchers/new",
  INVOICE_PAYMENT: "/beta/payment-requests/invoice-payment/new",
  TRAVEL_ALLOWANCE: "/beta/payment-requests/travel-allowance/new",
  CASH_ADVANCE: "/beta/payment-requests/cash-advance/new",
  PETTY_CASH: "/beta/payment-requests/petty-cash/new",
};

const labels: Record<ManualDraftType, string> = {
  PAYMENT_VOUCHER: "Payment Voucher",
  INVOICE_PAYMENT: "Invoice Payment",
  TRAVEL_ALLOWANCE: "Travel Allowance",
  CASH_ADVANCE: "Cash Advance",
  PETTY_CASH: "Petty Cash",
};

function draftTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: value, time: "" };
  return {
    date: parsed.toLocaleDateString("en-MY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: parsed.toLocaleTimeString("en-MY", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function manualDraftHref(
  paymentType: ManualDraftType,
  account: BetaAccount,
  snapshot?: unknown,
) {
  if (paymentType === "PAYMENT_VOUCHER") {
    const value =
      snapshot && typeof snapshot === "object"
        ? (snapshot as Record<string, unknown>)
        : null;
    const isMultiple = Boolean(
      value &&
      (value.creationMode === "multiple" ||
        value.entryMode === "manual" ||
        value.entryMode === "spreadsheet" ||
        Array.isArray(value.manualRows) ||
        Array.isArray(value.rows)),
    );
    return `/beta/payment-vouchers/new?draft=1&mode=${isMultiple ? "multiple" : "single"}`;
  }
  if (paymentType === "TRAVEL_ALLOWANCE" && account.role === "manager") {
    return "/beta/project-manager/payment-requests/travel-allowances/new?draft=1";
  }
  return `${createHref[paymentType]}?draft=1`;
}

export function usePaymentTypeManualDrafts(
  paymentType: ManualDraftType,
  account: BetaAccount | null,
  enabled: boolean,
) {
  const [drafts, setDrafts] = useState<ManualFormDraft[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = account ? `${account.id}:${paymentType}` : null;

  useEffect(() => {
    if (!account || !enabled) return;

    let cancelled = false;
    fetchManualFormDrafts("beta-arus-org", account.id)
      .then((items) => {
        if (!cancelled) {
          setDrafts(items.filter((item) => item.paymentType === paymentType));
          setLoadedKey(`${account.id}:${paymentType}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDrafts([]);
          setLoadedKey(`${account.id}:${paymentType}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [account, enabled, paymentType]);

  return {
    drafts: enabled ? drafts : [],
    loading: Boolean(enabled && requestKey && loadedKey !== requestKey),
  };
}

export function filterManualDrafts(
  drafts: ManualFormDraft[],
  filters: {
    status: string;
    search: string;
    month: string;
    specificDate: string;
  },
) {
  if (
    filters.status !== "ALL" &&
    filters.status !== "DRAFT" &&
    filters.status !== "Draft"
  )
    return [];
  const term = filters.search.trim().toLowerCase();

  return drafts.filter((draft) => {
    const updatedDate = draft.updatedAt.slice(0, 10);
    if (filters.month && !updatedDate.startsWith(filters.month)) return false;
    if (filters.specificDate && updatedDate !== filters.specificDate) return false;
    if (!term) return true;
    return `${labels[draft.paymentType]} ${JSON.stringify(draft.snapshot)}`
      .toLowerCase()
      .includes(term);
  });
}

export function ManualDraftRecordList({
  drafts,
  account,
  viewMode,
}: {
  drafts: ManualFormDraft[];
  account: BetaAccount;
  viewMode: "grid" | "list";
}) {
  const ordered = useMemo(
    () =>
      [...drafts].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      ),
    [drafts],
  );

  if (ordered.length === 0) return null;

  if (viewMode === "grid") {
    return (
      <div className={styles.grid}>
        {ordered.map((draft) => (
          <article className={styles.card} key={draft.id}>
            <div className={styles.cardTop}>
              <span>Reference pending</span>
              <strong>Draft</strong>
            </div>
            <h2>{labels[draft.paymentType]}</h2>
            <p>Continue the saved form before submitting it for approval.</p>
            <dl>
              <div>
                <dt>Updated</dt>
                <dd>{new Date(draft.updatedAt).toLocaleString("en-MY")}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Not submitted</dd>
              </div>
            </dl>
            <Link href={manualDraftHref(draft.paymentType, account, draft.snapshot)}>
              Continue draft
            </Link>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Payment type</th>
            <th>Updated</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ordered.map((draft) => (
            <tr key={draft.id}>
              <td>
                <strong>Draft</strong>
                <small>Reference assigned after submission</small>
              </td>
              <td>{labels[draft.paymentType]}</td>
              <td>{new Date(draft.updatedAt).toLocaleString("en-MY")}</td>
              <td>
                <span className={styles.status}>Draft</span>
              </td>
              <td className={styles.actionCell}>
                <Link href={manualDraftHref(draft.paymentType, account, draft.snapshot)}>
                  Continue draft
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ManualDraftCards({
  drafts,
  account,
}: {
  drafts: ManualFormDraft[];
  account: BetaAccount;
}) {
  return (
    <>
      {drafts.map((draft) => (
        <article className={styles.card} key={draft.id}>
          <div className={styles.cardTop}>
            <span>Reference pending</span>
            <strong>Draft</strong>
          </div>
          <h2>{labels[draft.paymentType]}</h2>
          <p>Continue the saved form before submitting it for approval.</p>
          <dl>
            <div>
              <dt>Updated</dt>
              <dd>{new Date(draft.updatedAt).toLocaleString("en-MY")}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Not submitted</dd>
            </div>
          </dl>
          <Link href={manualDraftHref(draft.paymentType, account, draft.snapshot)}>
            Continue draft
          </Link>
        </article>
      ))}
    </>
  );
}

export function ManualDraftTableRows({
  drafts,
  account,
  columnCount,
  statusBeforeUpdated = false,
}: {
  drafts: ManualFormDraft[];
  account: BetaAccount;
  columnCount: number;
  statusBeforeUpdated?: boolean;
}) {
  return (
    <>
      {drafts.map((draft) => (
        <tr key={`manual-draft-${draft.id}`}>
          <td>
            <strong>Draft</strong>
            <small>Reference assigned after submission</small>
          </td>
          <td colSpan={Math.max(1, columnCount - 4)}>
            {labels[draft.paymentType]}
          </td>
          {statusBeforeUpdated ? (
            <>
              <td>
                <span className={styles.status}>Draft</span>
              </td>
              <td>
                <span className={styles.draftDate}>
                  <span>{draftTimestamp(draft.updatedAt).date}</span>
                  <small>{draftTimestamp(draft.updatedAt).time}</small>
                </span>
              </td>
            </>
          ) : (
            <>
              <td>
                <span className={styles.draftDate}>
                  <span>{draftTimestamp(draft.updatedAt).date}</span>
                  <small>{draftTimestamp(draft.updatedAt).time}</small>
                </span>
              </td>
              <td>
                <span className={styles.status}>Draft</span>
              </td>
            </>
          )}
          <td className={styles.actionCell}>
            <Link href={manualDraftHref(draft.paymentType, account, draft.snapshot)}>
              Continue draft
            </Link>
          </td>
        </tr>
      ))}
    </>
  );
}

import Link from "next/link";

import type { ManualFormDraft } from "@/domain/payment-requests/manual-drafts/types";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import {
  ManualDraftCards,
  ManualDraftTableRows,
} from "@/features/payment-records/components/shared/manual-draft-records";
import { betaAccounts, type BetaAccount } from "@/lib/auth/beta-accounts";

import { PaymentVoucherRecordCard } from "@/features/payment-voucher/components/payment-voucher-record-card";
import { PaymentVoucherStatusBadge } from "@/features/payment-voucher/components/payment-voucher-status-badge";
import styles from "./payment-voucher.module.css";

type Props = {
  vouchers: PaymentVoucherRecord[];
  drafts?: ManualFormDraft[];
  account?: BetaAccount;
  viewMode?: "grid" | "list";
  onViewDetails?: (voucher: PaymentVoucherRecord) => void;
  viewActionLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

function money(amount: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(amount);
}

function date(value?: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(parsed);
}

function accountName(accountId: string) {
  return betaAccounts.find((item) => item.id === accountId)?.name ?? accountId;
}

export function PaymentVoucherRecordList({
  vouchers,
  drafts = [],
  account,
  viewMode = "grid",
  onViewDetails,
  viewActionLabel = "View details",
  emptyTitle = "No Payment Vouchers found",
  emptyDescription = "There are no Payment Voucher records to display.",
}: Props) {
  if (vouchers.length === 0 && drafts.length === 0) {
    return (
      <div className={styles.voucherRecordEmptyState}>
        <div className={styles.voucherRecordEmptyIcon} aria-hidden="true">
          PV
        </div>
        <h3>{emptyTitle}</h3>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className={styles.voucherRecordTableWrapper}>
        <table className={styles.voucherRecordTable}>
          <thead>
            <tr>
              <th>PV number</th>
              <th>Staff</th>
              <th>Recipient</th>
              <th>Division</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Updated</th>
              <th>
                <span className={styles.visuallyHidden}>Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {account && (
              <ManualDraftTableRows
                account={account}
                columnCount={8}
                drafts={drafts}
                statusBeforeUpdated
              />
            )}
            {vouchers.map((voucher) => (
              <tr key={voucher.id}>
                <td>
                  <Link
                    className={styles.voucherTableReference}
                    href={`/beta/payment-vouchers/${voucher.id}`}
                  >
                    {voucher.voucherNumber}
                  </Link>
                </td>
                <td>{accountName(voucher.submitterId)}</td>
                <td>
                  <strong>{voucher.recipientName}</strong>
                  <small>{voucher.recipientEmail}</small>
                </td>
                <td>{voucher.division}</td>
                <td className={styles.voucherTableAmount}>
                  {money(voucher.amount)}
                </td>
                <td>
                  <PaymentVoucherStatusBadge status={voucher.status} />
                </td>
                <td>{date(voucher.updatedAt)}</td>
                <td className={styles.voucherTableActionCell}>
                  {onViewDetails ? (
                    <button
                      className={styles.voucherTableViewButton}
                      onClick={() => onViewDetails(voucher)}
                      type="button"
                    >
                      {viewActionLabel}
                    </button>
                  ) : (
                    <Link
                      className={styles.voucherTableViewButton}
                      href={`/beta/payment-vouchers/${voucher.id}`}
                    >
                      {viewActionLabel}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={styles.voucherRecordGrid}>
      {account && (
        <ManualDraftCards
          account={account}
          drafts={drafts}
        />
      )}
      {vouchers.map((voucher) => (
        <PaymentVoucherRecordCard
          key={voucher.id}
          onViewDetails={onViewDetails}
          voucher={voucher}
          viewActionLabel={viewActionLabel}
        />
      ))}
    </div>
  );
}

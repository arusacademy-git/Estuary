import Link from 'next/link';

import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';

import {
  betaAccounts,
} from '@/lib/auth/beta-accounts';

import { PaymentVoucherRecordCard } from './payment-voucher-record-card';

import {
  PaymentVoucherStatusBadge,
} from './payment-voucher-status-badge';

import styles from './payment-voucher.module.css';

type PaymentVoucherRecordListProps = {
  vouchers: PaymentVoucherRecord[];
  viewMode?: 'grid' | 'list';
  onViewDetails?: (
    voucher: PaymentVoucherRecord,
  ) => void;
  viewActionLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

function formatCurrency(
  amount: number,
) {
  return new Intl.NumberFormat(
    'en-MY',
    {
      style: 'currency',
      currency: 'MYR',
    },
  ).format(amount);
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-MY',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}

function getAccountName(
  accountId: string,
) {
  return (
    betaAccounts.find(
      (account) =>
        account.id === accountId,
    )?.name ?? accountId
  );
}

export function PaymentVoucherRecordList({
  vouchers,
  viewMode = 'grid',
  onViewDetails,
  viewActionLabel = 'View details',
  emptyTitle = 'No Payment Vouchers found',
  emptyDescription = 'There are no Payment Voucher records to display.',
}: PaymentVoucherRecordListProps) {
  if (vouchers.length === 0) {
    return (
      <div className={styles.voucherRecordEmptyState}>
        <div
          className={styles.voucherRecordEmptyIcon}
          aria-hidden="true"
        >
          PV
        </div>

        <h3>{emptyTitle}</h3>

        <p>{emptyDescription}</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div
        className={
          styles.voucherRecordTableWrapper
        }
      >
        <table
          className={
            styles.voucherRecordTable
          }
        >
          <thead>
            <tr>
              <th scope="col">PV number</th>
              <th scope="col">Staff</th>
              <th scope="col">Recipient</th>
              <th scope="col">Division</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">
                <span
                  className={
                    styles.visuallyHidden
                  }
                >
                  Action
                </span>
              </th>
            </tr>
          </thead>

          <tbody>
            {vouchers.map((voucher) => (
              <tr key={voucher.id}>
                <td>
                  <Link
                    className={
                      styles.voucherTableReference
                    }
                    href={`/beta/payment-vouchers/${voucher.id}`}
                  >
                    {voucher.voucherNumber}
                  </Link>
                </td>

                <td>
                  {getAccountName(
                    voucher.submitterId,
                  )}
                </td>

                <td>
                  <strong>
                    {voucher.recipientName}
                  </strong>

                  <small>
                    {voucher.recipientEmail}
                  </small>
                </td>

                <td>{voucher.division}</td>

                <td
                  className={
                    styles.voucherTableAmount
                  }
                >
                  {formatCurrency(
                    voucher.amount,
                  )}
                </td>

                <td>
                  <PaymentVoucherStatusBadge
                    status={voucher.status}
                  />
                </td>

                <td>
                  {formatDate(
                    voucher.updatedAt,
                  )}
                </td>

                <td
                  className={
                    styles.voucherTableActionCell
                  }
                >
                  {onViewDetails ? (
                    <button
                      className={
                        styles.voucherTableViewButton
                      }
                      onClick={() =>
                        onViewDetails(voucher)
                      }
                      type="button"
                    >
                      {viewActionLabel}
                    </button>
                  ) : (
                    <Link
                      className={
                        styles.voucherTableViewButton
                      }
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
      {vouchers.map((voucher) => (
        <PaymentVoucherRecordCard
          key={voucher.id}
          onViewDetails={onViewDetails}
          voucher={voucher}
          viewActionLabel={
            viewActionLabel
          }
        />
      ))}
    </div>
  );
}
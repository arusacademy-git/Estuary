'use client';

import {
  useState,
} from 'react';

import Link from 'next/link';

import type {
  BetaAccount,
} from '@/lib/auth/beta-accounts';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  markPaymentVoucherManagerViewed,
} from '@/data/payment-vouchers/payment-voucher-api';

import {
  PaymentVoucherStatusBadge,
} from '@/features/payment-voucher/components/payment-voucher-status-badge';

import styles from '@/features/payment-voucher/components/project_manager/project-manager-preview.module.css';

type ProjectManagerPreviewPanelProps = {
  manager: BetaAccount;
  voucher: PaymentVoucherRecord;
  onUpdated?: () => void | Promise<void>;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(amount);
}

function formatDate(value?: string) {
  if (!value) {
    return 'Not viewed';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function ProjectManagerPreviewPanel({
  manager,
  voucher,
  onUpdated,
}: ProjectManagerPreviewPanelProps) {
  const [isProcessing, setIsProcessing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const isAssignedManager =
    voucher.projectManagerId === manager.id;

  const hasViewed =
    Boolean(voucher.projectManagerViewedAt);

  async function handleMarkViewed() {
    setErrorMessage('');

    if (!isAssignedManager) {
      setErrorMessage(
        'This Payment Voucher is assigned to another Manager.',
      );

      return;
    }

    setIsProcessing(true);

    try {
      await markPaymentVoucherManagerViewed(
        voucher.id,
        manager.id,
      );

      await onUpdated?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to mark the Payment Voucher as viewed.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <article
      className={
        hasViewed
          ? styles.viewedCard
          : styles.previewCard
      }
    >
      <div className={styles.cardHeader}>
        <div>
          <Link
            className={styles.voucherNumber}
            href={`/beta/payment-vouchers/${voucher.id}`}
          >
            {voucher.voucherNumber}
          </Link>

          <h2>{voucher.recipientName}</h2>

          <p>{voucher.purpose}</p>
        </div>

        <div className={styles.statusArea}>
          <PaymentVoucherStatusBadge
            status={voucher.status}
          />

          {hasViewed ? (
            <span className={styles.viewedBadge}>
              Viewed
            </span>
          ) : (
            <span
              className={
                styles.notViewedBadge
              }
            >
              Preview required
            </span>
          )}
        </div>
      </div>

      <dl className={styles.informationGrid}>
        <div>
          <dt>Amount</dt>

          <dd>
            {formatCurrency(voucher.amount)}
          </dd>
        </div>

        <div>
          <dt>Division</dt>

          <dd>{voucher.division}</dd>
        </div>

        <div>
          <dt>Recipient reference</dt>

          <dd>
            {voucher.recipientReference}
          </dd>
        </div>

        <div>
          <dt> Manager viewed</dt>

          <dd>
            {formatDate(
              voucher.projectManagerViewedAt,
            )}
          </dd>
        </div>
      </dl>

      {errorMessage && (
        <div
          className={styles.errorMessage}
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <div className={styles.cardActions}>
        <Link
          className={styles.secondaryButton}
          href={`/beta/payment-vouchers/${voucher.id}`}
        >
          View full details
        </Link>

        <button
          className={styles.primaryButton}
          disabled={
            hasViewed ||
            !isAssignedManager ||
            isProcessing
          }
          onClick={handleMarkViewed}
          type="button"
        >
          {isProcessing
            ? 'Saving…'
            : hasViewed
              ? 'Preview completed'
              : 'Mark as viewed'}
        </button>
      </div>
    </article>
  );
}

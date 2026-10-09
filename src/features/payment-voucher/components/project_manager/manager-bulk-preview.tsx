'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';
import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';
import { markPaymentVoucherManagerViewed } from '@/data/payment-vouchers/payment-voucher-api';
import { BulkVoucherReviewModal } from '@/features/payment-voucher/components/director/bulk-voucher-review-modal';

import styles from '../bulk/payment-voucher-bulk.module.css';

type Props = {
  manager: BetaAccount;
  vouchers: PaymentVoucherRecord[];
};

const previewableStatuses = new Set([
  'APPROVED_FOR_PAYMENT',
  'FINANCE_PROCESSING',
  'AWAITING_RECIPIENT_SIGNATURE',
  'AWAITING_STAFF_CONFIRMATION',
  'PENDING_FINANCE_VERIFICATION',
  'COMPLETED',
  'INACTIVE',
  'AWAITING_SIGNATURE',
  'AWAITING_STAFF_VERIFICATION',
]);

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(amount);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
}

function accountName(id: string) {
  return betaAccounts.find((account) => account.id === id)?.name ?? id;
}

export function ManagerBulkPreview({ manager, vouchers }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const pending = useMemo(
    () => vouchers.filter((voucher) =>
      voucher.projectManagerId === manager.id &&
      !voucher.projectManagerViewedAt &&
      !completedIds.includes(voucher.id) &&
      previewableStatuses.has(voucher.status)),
    [completedIds, manager.id, vouchers],
  );

  const selected = pending.filter((voucher) => selectedIds.includes(voucher.id));
  const allSelected = pending.length > 0 && selectedIds.length === pending.length;
  const allReviewed = selectedIds.length > 0 && selectedIds.every((id) => reviewedIds.includes(id));
  const selectedTotal = selected.reduce((total, voucher) => total + voucher.amount, 0);

  function resetMessages() {
    setMessage('');
    setError('');
    setConfirmed(false);
  }

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
    resetMessages();
  }

  async function submit() {
    setError('');
    setMessage('');

    if (!allReviewed || !confirmed) {
      setError('Review every selected Payment Voucher and confirm the preview first.');
      return;
    }

    setSubmitting(true);
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const id of selectedIds) {
      try {
        await markPaymentVoucherManagerViewed(id, manager.id);
        succeeded.push(id);
      } catch {
        failed.push(id);
      }
    }

    setCompletedIds((current) => [...current, ...succeeded]);
    setSelectedIds(failed);
    setReviewedIds((current) => current.filter((id) => failed.includes(id)));
    setConfirmed(false);
    setSubmitting(false);

    if (succeeded.length) {
      setMessage(`${succeeded.length} Payment ${succeeded.length === 1 ? 'Voucher was' : 'Vouchers were'} marked as previewed.`);
    }
    if (failed.length) {
      setError(`${failed.length} selected ${failed.length === 1 ? 'voucher could' : 'vouchers could'} not be updated. Please retry.`);
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Manager workspace</p>
          <h1>Bulk Payment Voucher preview</h1>
          <p>Review approved Payment Vouchers assigned to you, then acknowledge the previews together. This does not approve or change the workflow stage.</p>
        </div>
        <Link className={styles.backButton} href="/beta/project-manager/payment-vouchers">Back to Payment Vouchers</Link>
      </header>

      {message && <div className={styles.message} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}><span>Pending preview</span><strong>{pending.length}</strong><p>Assigned vouchers not previewed yet.</p></article>
        <article className={styles.summaryCard}><span>Selected</span><strong>{selectedIds.length}</strong><p>Vouchers selected in this batch.</p></article>
        <article className={styles.summaryCard}><span>Reviewed</span><strong>{selectedIds.filter((id) => reviewedIds.includes(id)).length}</strong><p>Selected vouchers fully reviewed.</p></article>
        <article className={styles.summaryCard}><span>Selected total</span><strong>{formatCurrency(selectedTotal)}</strong><p>Combined value of this batch.</p></article>
      </div>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.selectAll}>
            <input type="checkbox" checked={allSelected} disabled={!pending.length} onChange={() => {
              setSelectedIds(allSelected ? [] : pending.map((voucher) => voucher.id));
              resetMessages();
            }} />
            Select all pending previews
          </label>
          <span>{pending.length} {pending.length === 1 ? 'record' : 'records'}</span>
        </div>

        {!pending.length ? (
          <div className={styles.empty}><h2>No pending previews</h2><p>All assigned Payment Vouchers have been previewed.</p></div>
        ) : (
          <div className={`${styles.selectionTableWrapper} ${styles.voucherTableWrapper}`}>
            <table className={`${styles.selectionTable} ${styles.voucherFitTable}`}>
              <thead><tr><th aria-label="Select" /><th>Payment Voucher</th><th>Recipient</th><th>Submitter</th><th>PV date</th><th>Division</th><th>Amount</th><th>Review</th><th aria-label="Actions" /></tr></thead>
              <tbody>{pending.map((voucher) => {
                const isSelected = selectedIds.includes(voucher.id);
                const isReviewed = reviewedIds.includes(voucher.id);
                return <tr data-selected={isSelected} key={voucher.id}>
                  <td className={styles.checkCell}><input aria-label={`Select ${voucher.voucherNumber}`} type="checkbox" checked={isSelected} onChange={() => toggle(voucher.id)} /></td>
                  <td><strong className={styles.voucherNumber}>{voucher.voucherNumber}</strong></td>
                  <td>{voucher.recipientName}</td>
                  <td>{accountName(voucher.submitterId)}</td>
                  <td>{formatDate(voucher.pvDate)}</td>
                  <td>{voucher.division}</td>
                  <td className={styles.amountCell}>{formatCurrency(voucher.amount)}</td>
                  <td>{isReviewed ? <span className={styles.reviewed}>Reviewed</span> : <span className={styles.notReviewed}>Not reviewed</span>}</td>
                  <td className={styles.actionCell}><button className={styles.reviewButton} type="button" onClick={() => setReviewId(voucher.id)}>View details</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      {selectedIds.length > 0 && (
        <section className={styles.confirmationPanel}>
          <div><p className={styles.eyebrow}>Preview confirmation</p><h2>Confirm {selectedIds.length} selected {selectedIds.length === 1 ? 'preview' : 'previews'}</h2><p>Every selected voucher must be reviewed. This records only that the Manager viewed it.</p></div>
          {!allReviewed && <p className={styles.notice}>Review every selected Payment Voucher before continuing.</p>}
          <label className={styles.confirmationCheck}><input type="checkbox" checked={confirmed} disabled={!allReviewed} onChange={(event) => setConfirmed(event.target.checked)} />I confirm that I reviewed the selected Payment Vouchers.</label>
          <button className={`${styles.primaryButton} ${styles.fullWidthButton}`} type="button" disabled={!allReviewed || !confirmed || submitting} onClick={submit}>{submitting ? 'Saving previews…' : `Confirm ${selectedIds.length} selected`}</button>
        </section>
      )}

      {reviewId && (
        <BulkVoucherReviewModal
          vouchers={pending}
          currentVoucherId={reviewId}
          reviewedVoucherIds={reviewedIds}
          onClose={() => setReviewId(null)}
          onChangeVoucher={setReviewId}
          onMarkReviewed={(id) => setReviewedIds((current) => current.includes(id) ? current : [...current, id])}
        />
      )}
    </section>
  );
}

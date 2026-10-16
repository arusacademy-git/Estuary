'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { BetaAccount } from '@/lib/auth/beta-accounts';
import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';
import { issuePaymentVoucherRecipientLink } from '@/data/payment-vouchers/payment-voucher-api';
import { BulkVoucherReviewModal } from '@/features/payment-voucher/components/director/bulk-voucher-review-modal';

import styles from '../bulk/payment-voucher-bulk.module.css';
import staffStyles from './staff-bulk-signature-follow-up.module.css';

type Props = {
  staff: BetaAccount;
  vouchers: PaymentVoucherRecord[];
};

type PreparedLink = {
  token: string;
  voucher: PaymentVoucherRecord;
};

const BATCH_SIZE = 4;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(amount);
}

function formatDateTime(value?: string) {
  if (!value) return 'Not sent yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
}

function recipientUrl(token: string) {
  return new URL(
    `/beta/recipient/${encodeURIComponent(token)}`,
    window.location.origin,
  ).toString();
}

function openRecipientEmail(prepared: PreparedLink) {
  const { voucher, token } = prepared;
  const subject = `Payment Voucher ${voucher.voucherNumber} requires your confirmation`;
  const body = [
    `Hello ${voucher.recipientName},`,
    '',
    `Payment Voucher ${voucher.voucherNumber} is ready for your review and signature.`,
    '',
    `Amount: RM ${voucher.amount.toFixed(2)}`,
    `Payment reference: ${voucher.paymentReference ?? 'Not provided'}`,
    '',
    'Open this secure link to review and sign:',
    recipientUrl(token),
    '',
    'The secure link is valid for 7 days.',
    '',
    'Thank you.',
    'Estuary',
  ].join('\n');

  window.location.href = `mailto:${encodeURIComponent(voucher.recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function copyText(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  textArea.remove();

  if (!copied) throw new Error('The secure link could not be copied.');
}

export function StaffBulkSignatureFollowUp({ staff, vouchers }: Props) {
  const [currentVouchers, setCurrentVouchers] = useState(vouchers);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preparedLinks, setPreparedLinks] = useState<Record<string, PreparedLink>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const pending = useMemo(
    () => currentVouchers.filter(
      (voucher) =>
        voucher.submitterId === staff.id &&
        voucher.status === 'AWAITING_RECIPIENT_SIGNATURE',
    ),
    [currentVouchers, staff.id],
  );
  const selectable = pending.filter((voucher) => voucher.recipientEmail.trim());
  const selected = pending.filter((voucher) => selectedIds.includes(voucher.id));
  const selectedTotal = selected.reduce((total, voucher) => total + voucher.amount, 0);
  const allSelected = selectable.length > 0 && selectable.every((voucher) => selectedIds.includes(voucher.id));
  const preparedSelected = selected.filter((voucher) => preparedLinks[voucher.id]);

  function resetConfirmation() {
    setConfirmed(false);
    setMessage('');
    setError('');
  }

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
    resetConfirmation();
  }

  async function prepareSelectedLinks() {
    if (!confirmed || !selectedIds.length) {
      setError('Select at least one Payment Voucher and confirm the recipient details first.');
      return;
    }

    setPreparing(true);
    setMessage('');
    setError('');
    const succeeded: PreparedLink[] = [];
    const failed: string[] = [];

    for (let index = 0; index < selected.length; index += BATCH_SIZE) {
      const group = selected.slice(index, index + BATCH_SIZE);
      const results = await Promise.allSettled(
        group.map((voucher) => issuePaymentVoucherRecipientLink(voucher.id, staff.id)),
      );

      results.forEach((result, resultIndex) => {
        const voucher = group[resultIndex];
        if (result.status === 'fulfilled') {
          succeeded.push(result.value);
        } else {
          failed.push(voucher.id);
        }
      });
    }

    if (succeeded.length) {
      setPreparedLinks((current) => {
        const next = { ...current };
        succeeded.forEach((prepared) => {
          next[prepared.voucher.id] = prepared;
        });
        return next;
      });
      setCurrentVouchers((current) => current.map((voucher) =>
        succeeded.find((prepared) => prepared.voucher.id === voucher.id)?.voucher ?? voucher));
      setMessage(`${succeeded.length} secure ${succeeded.length === 1 ? 'link is' : 'links are'} ready. Open each personalized email below to complete the follow-up.`);
    }

    if (failed.length) {
      setError(`${failed.length} ${failed.length === 1 ? 'link could' : 'links could'} not be prepared. Retry the affected records.`);
    }

    setConfirmed(false);
    setPreparing(false);
  }

  async function copyPreparedLink(prepared: PreparedLink) {
    setError('');
    try {
      await copyText(recipientUrl(prepared.token));
      setMessage(`Secure link for ${prepared.voucher.voucherNumber} copied.`);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'The secure link could not be copied.');
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Staff workspace</p>
          <h1>Bulk recipient signature follow-up</h1>
          <p>Prepare secure recipient links together, then open each personalized email. This does not sign, confirm or advance a Payment Voucher for the recipient.</p>
        </div>
        <Link className={styles.backButton} href="/beta/payment-vouchers">Back to Payment Vouchers</Link>
      </header>

      {message && <div className={styles.message} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}><span>Awaiting signature</span><strong>{pending.length}</strong><p>Your vouchers waiting for recipients.</p></article>
        <article className={styles.summaryCard}><span>Selected</span><strong>{selectedIds.length}</strong><p>Records in this follow-up batch.</p></article>
        <article className={styles.summaryCard}><span>Links prepared</span><strong>{preparedSelected.length}</strong><p>Personalized links ready to email.</p></article>
        <article className={styles.summaryCard}><span>Selected total</span><strong>{formatCurrency(selectedTotal)}</strong><p>Combined value of this batch.</p></article>
      </div>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.selectAll}>
            <input
              checked={allSelected}
              disabled={!selectable.length}
              onChange={() => {
                setSelectedIds(allSelected ? [] : selectable.map((voucher) => voucher.id));
                resetConfirmation();
              }}
              type="checkbox"
            />
            Select all awaiting signatures
          </label>
          <span>{pending.length} {pending.length === 1 ? 'record' : 'records'}</span>
        </div>

        {!pending.length ? (
          <div className={styles.empty}><h2>No recipient follow-ups</h2><p>You have no Payment Vouchers awaiting recipient signature.</p></div>
        ) : (
          <div className={styles.selectionTableWrapper}>
            <table className={`${styles.selectionTable} ${staffStyles.table}`}>
              <thead><tr><th aria-label="Select" /><th>Payment Voucher</th><th>Recipient</th><th>Email</th><th>Last link issued</th><th>Amount</th><th>Status</th><th aria-label="Actions" /></tr></thead>
              <tbody>{pending.map((voucher) => {
                const hasEmail = Boolean(voucher.recipientEmail.trim());
                const prepared = preparedLinks[voucher.id];
                return (
                  <tr data-selected={selectedIds.includes(voucher.id)} key={voucher.id}>
                    <td className={styles.checkCell}><input aria-label={`Select ${voucher.voucherNumber}`} checked={selectedIds.includes(voucher.id)} disabled={!hasEmail} onChange={() => toggle(voucher.id)} type="checkbox" /></td>
                    <td><strong className={styles.voucherNumber}>{voucher.voucherNumber}</strong><small className={styles.tableSubtext}>{voucher.purpose}</small></td>
                    <td>{voucher.recipientName}</td>
                    <td>{hasEmail ? voucher.recipientEmail : <span className={staffStyles.missing}>Missing email</span>}</td>
                    <td>{formatDateTime(voucher.recipientLinkSentAt)}</td>
                    <td className={styles.amountCell}>{formatCurrency(voucher.amount)}</td>
                    <td>{prepared ? <span className={styles.reviewed}>Link ready</span> : voucher.recipientLinkSentAt ? <span className={styles.notReviewed}>Follow-up</span> : <span className={styles.notReviewed}>Not sent</span>}</td>
                    <td className={styles.actionCell}><button className={styles.reviewButton} onClick={() => setReviewId(voucher.id)} type="button">View details</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      {selectedIds.length > 0 && (
        <section className={`${styles.confirmationPanel} ${styles.compactConfirmation}`}>
          <header className={styles.compactConfirmationHeader}><div><p className={styles.eyebrow}>Signature follow-up</p><h2>Prepare {selectedIds.length} selected {selectedIds.length === 1 ? 'link' : 'links'}</h2><p>Each recipient receives a unique secure link. Existing links are safely refreshed.</p></div><div className={styles.compactConfirmationTotal}><span>Total amount</span><strong>{formatCurrency(selectedTotal)}</strong></div></header>
          <footer className={styles.compactConfirmationFooter}><label className={styles.confirmationCheck}><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />I confirm the selected recipient names and email addresses are correct.</label><button className={styles.primaryButton} disabled={!confirmed || preparing} onClick={prepareSelectedLinks} type="button">{preparing ? 'Preparing links…' : `Prepare ${selectedIds.length} follow-up${selectedIds.length === 1 ? '' : 's'}`}</button></footer>
        </section>
      )}

      {preparedSelected.length > 0 && (
        <section className={`${styles.panel} ${staffStyles.preparedPanel}`}>
          <div className={staffStyles.preparedHeading}><div><p className={styles.eyebrow}>Ready to contact</p><h2>Personalized recipient emails</h2><p>Open each draft in your email app, review it and send it to the recipient.</p></div><strong>{preparedSelected.length} ready</strong></div>
          <div className={staffStyles.preparedList}>{preparedSelected.map((voucher) => {
            const prepared = preparedLinks[voucher.id];
            return <article className={staffStyles.preparedRow} key={voucher.id}><div><strong>{voucher.voucherNumber}</strong><span>{voucher.recipientName} · {voucher.recipientEmail}</span></div><div><button className={styles.reviewButton} onClick={() => copyPreparedLink(prepared)} type="button">Copy link</button><button className={styles.primaryButton} onClick={() => openRecipientEmail(prepared)} type="button">Open email</button></div></article>;
          })}</div>
        </section>
      )}

      {reviewId && (
        <BulkVoucherReviewModal
          currentVoucherId={reviewId}
          onChangeVoucher={setReviewId}
          onClose={() => setReviewId(null)}
          onMarkReviewed={(id) => setReviewedIds((current) => current.includes(id) ? current : [...current, id])}
          reviewedVoucherIds={reviewedIds}
          vouchers={pending}
        />
      )}
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';
import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';
import {
  savePaymentVoucherFinanceInformation,
  startPaymentVoucherFinanceProcessing,
} from '@/data/payment-vouchers/payment-voucher-api';
import { BulkVoucherReviewModal } from '@/features/payment-voucher/components/director/bulk-voucher-review-modal';

import styles from '../bulk/payment-voucher-bulk.module.css';

type Props = {
  finance: BetaAccount;
  vouchers: PaymentVoucherRecord[];
};

function localIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
}

function accountName(id: string) {
  return betaAccounts.find((account) => account.id === id)?.name ?? id;
}

export function FinanceBulkProcessing({ finance, vouchers }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(localIsoDate());
  const [remarks, setRemarks] = useState('');
  const [references, setReferences] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const pending = useMemo(
    () => vouchers.filter((voucher) =>
      voucher.status === 'APPROVED_FOR_PAYMENT' && !processedIds.includes(voucher.id)),
    [processedIds, vouchers],
  );
  const selected = pending.filter((voucher) => selectedIds.includes(voucher.id));
  const selectedTotal = selected.reduce((total, voucher) => total + voucher.amount, 0);
  const allSelected = pending.length > 0 && selectedIds.length === pending.length;
  const allReviewed = selectedIds.length > 0 && selectedIds.every((id) => reviewedIds.includes(id));
  const allReferencesEntered = selectedIds.every((id) => references[id]?.trim());

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

  async function submit() {
    setMessage('');
    setError('');
    if (!paymentDate || !allReviewed || !allReferencesEntered || !confirmed) {
      setError('Review every selected voucher, enter each payment reference and confirm the batch.');
      return;
    }

    setSubmitting(true);
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const id of selectedIds) {
      try {
        await startPaymentVoucherFinanceProcessing(id, finance.id);
        await savePaymentVoucherFinanceInformation(id, {
          financeId: finance.id,
          paymentDate,
          paymentReference: references[id].trim(),
          paymentRemarks: remarks.trim() || undefined,
        });
        succeeded.push(id);
      } catch {
        failed.push(id);
      }
    }

    setProcessedIds((current) => [...current, ...succeeded]);
    setSelectedIds(failed);
    setReviewedIds((current) => current.filter((id) => failed.includes(id)));
    setConfirmed(false);
    setSubmitting(false);

    if (succeeded.length) {
      setMessage(`${succeeded.length} Payment ${succeeded.length === 1 ? 'Voucher is' : 'Vouchers are'} now in Finance processing.`);
    }
    if (failed.length) {
      setError(`${failed.length} ${failed.length === 1 ? 'voucher needs' : 'vouchers need'} attention. The failed records remain selected for retry.`);
    }
    if (succeeded.length && failed.length === 0) {
      const firstVoucherId = encodeURIComponent(succeeded[0]);
      router.push(`/beta/finance?queue=processing&voucher=${firstVoucherId}&batch=${succeeded.length}`);
    }
  }

  return (
    <section className={`${styles.page} ${styles.financeBulkPage}`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Finance workspace</p>
          <h1>Bulk Payment Voucher processing</h1>
          <p>Review Director-approved vouchers, record the payment date and unique bank reference for each selected voucher, then begin Finance processing together.</p>
        </div>
        <Link className={styles.backButton} href="/beta/finance">Back to Finance</Link>
      </header>

      {message && <div className={styles.message} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}><span>Ready for Finance</span><strong>{pending.length}</strong><p>Director-approved vouchers.</p></article>
        <article className={styles.summaryCard}><span>Selected</span><strong>{selectedIds.length}</strong><p>Vouchers in this batch.</p></article>
        <article className={styles.summaryCard}><span>Reviewed</span><strong>{selectedIds.filter((id) => reviewedIds.includes(id)).length}</strong><p>Selected vouchers reviewed.</p></article>
        <article className={styles.summaryCard}><span>Selected total</span><strong>{formatCurrency(selectedTotal)}</strong><p>Combined payment value.</p></article>
      </div>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.selectAll}><input type="checkbox" checked={allSelected} disabled={!pending.length} onChange={() => {
            setSelectedIds(allSelected ? [] : pending.map((voucher) => voucher.id));
            resetConfirmation();
          }} />Select all ready vouchers</label>
          <span>{pending.length} {pending.length === 1 ? 'record' : 'records'}</span>
        </div>

        {!pending.length ? (
          <div className={styles.empty}><h2>No vouchers ready for bulk processing</h2><p>Director-approved Payment Vouchers will appear here.</p></div>
        ) : (
          <div className={styles.selectionTableWrapper}>
            <table className={styles.selectionTable}>
              <thead><tr><th aria-label="Select" /><th>Payment Voucher</th><th>Recipient</th><th>Submitter</th><th>PV date</th><th>Division</th><th>Amount</th><th>Review</th><th aria-label="Actions" /></tr></thead>
              <tbody>{pending.map((voucher) => {
                const isSelected = selectedIds.includes(voucher.id);
                const isReviewed = reviewedIds.includes(voucher.id);
                return <tr data-selected={isSelected} key={voucher.id}>
                  <td className={styles.checkCell}><input aria-label={`Select ${voucher.voucherNumber}`} type="checkbox" checked={isSelected} onChange={() => toggle(voucher.id)} /></td>
                  <td><strong className={styles.voucherNumber}>{voucher.voucherNumber}</strong><span className={styles.tableSubtext}>{voucher.purpose}</span></td>
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
        <section className={`${styles.confirmationPanel} ${styles.financeConfirmationPanel}`}>
          <div className={styles.financeConfirmationHeader}><div><p className={styles.eyebrow}>Finance information</p><h2>Process {selectedIds.length} selected {selectedIds.length === 1 ? 'voucher' : 'vouchers'}</h2></div><div className={styles.batchTotal}><span>Total amount</span><strong>{formatCurrency(selectedTotal)}</strong></div></div>
          <div className={styles.financeSection}>
            <div className={styles.sectionHeading}><h3>Shared details</h3><p>Applied to every selected voucher.</p></div>
            <div className={styles.financeFields}>
              <label>Payment date *<input type="date" value={paymentDate} onChange={(event) => { setPaymentDate(event.target.value); resetConfirmation(); }} /></label>
              <label>Finance remarks <span className={styles.optionalText}>(optional)</span><textarea value={remarks} placeholder="Note applied to every selected voucher" onChange={(event) => setRemarks(event.target.value)} /></label>
            </div>
          </div>
          <div className={styles.financeSection}>
            <div className={styles.sectionHeading}><h3>Payment reference per voucher</h3><p>Each voucher needs its own unique reference.</p></div>
            <div className={styles.referenceList}>{selected.map((voucher) => <div className={styles.referenceRow} key={voucher.id}>
              <div><strong className={styles.voucherNumber}>{voucher.voucherNumber}</strong><span>{voucher.recipientName}</span></div>
              <strong>{formatCurrency(voucher.amount)}</strong>
              <label><span className={styles.visuallyHidden}>Payment reference for {voucher.voucherNumber}</span><input value={references[voucher.id] ?? ''} placeholder="Payment reference" onChange={(event) => {
                setReferences((current) => ({ ...current, [voucher.id]: event.target.value }));
                resetConfirmation();
              }} /></label>
            </div>)}</div>
          </div>
          <div className={styles.followUpNotice}><strong>Still completed per voucher afterwards</strong><ul><li>Payment proof upload</li><li>PDF generation and recipient signature</li><li>Final Finance verification</li></ul></div>
          {!allReviewed && <p className={styles.notice}>Review every selected Payment Voucher before processing.</p>}
          {!allReferencesEntered && <p className={styles.notice}>Enter a unique payment reference for every selected voucher.</p>}
          <div className={styles.financeConfirmationFooter}><label className={styles.confirmationCheck}><input type="checkbox" checked={confirmed} disabled={!allReviewed || !allReferencesEntered || !paymentDate} onChange={(event) => setConfirmed(event.target.checked)} />I confirm the selected vouchers and payment information are correct.</label>
          <button className={styles.primaryButton} type="button" disabled={!confirmed || !allReviewed || !allReferencesEntered || !paymentDate || submitting} onClick={submit}>{submitting ? 'Processing vouchers…' : `Process ${selectedIds.length} ${selectedIds.length === 1 ? 'voucher' : 'vouchers'}`}</button></div>
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

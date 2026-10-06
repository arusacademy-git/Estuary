'use client';

import { useMemo } from 'react';

import type { CreatePaymentVoucherInput } from '@/domain/payment-vouchers/types';
import { betaAccounts } from '@/lib/auth/beta-accounts';
import { amountToMalayWords } from '@/lib/currency/amount-words';

import styles from '@/features/payment-voucher/components/staff/payment-voucher-review.module.css';

type PaymentVoucherReviewProps = {
  voucher: CreatePaymentVoucherInput;
  supportingDocumentNames?: string[];
  isAmendment?: boolean;
  isSubmitting?: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

function formatDate(value: string) {
  if (!value) return 'Not provided';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function displayValue(value?: string) {
  return value?.trim() || 'Not provided';
}

function formatMoney(value: number) {
  return `RM ${value.toFixed(2)}`;
}

function EditIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m2.25 0H5.625A1.125 1.125 0 0 0 4.5 3.375v17.25c0 .621.504 1.125 1.125 1.125h12.75a1.125 1.125 0 0 0 1.125-1.125V11.25a9 9 0 0 0-9-9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

export function PaymentVoucherReview({
  voucher,
  supportingDocumentNames = [],
  isAmendment = false,
  isSubmitting = false,
  onBack,
  onSubmit,
}: PaymentVoucherReviewProps) {
  const director = betaAccounts.find((account) => account.id === voucher.directorId);
  const submitter = betaAccounts.find((account) => account.id === voucher.submitterId);

  const totals = useMemo(() => {
    const subtotal = voucher.lines.reduce(
      (total, line) => total + line.quantity * line.unitAmount,
      0,
    );
    const tax = voucher.lines.reduce((total, line) => total + line.taxAmount, 0);
    return { subtotal, tax, grandTotal: subtotal + tax };
  }, [voucher.lines]);

  const amountInWords = useMemo(
    () => amountToMalayWords(totals.grandTotal),
    [totals.grandTotal],
  );

  return (
    <section className={styles.reviewPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.stepLabel}>Step 2 of 2</p>
          <h1>{isAmendment ? 'Review Payment Voucher Amendment' : 'Review Payment Voucher'}</h1>
          <p className={styles.pageDescription}>
            {isAmendment
              ? 'Check the corrected information before resubmitting this Payment Voucher to the assigned Director.'
              : 'Check all information before sending this Payment Voucher to the assigned Director.'}
          </p>
        </div>
        <span className={styles.readyBadge}>
          <i aria-hidden="true" />
          {isAmendment ? 'Ready for resubmission' : 'Ready for submission'}
        </span>
      </header>

      <article className={styles.reviewCard}>
        <header className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <i aria-hidden="true" />
            <strong>Payment Voucher Review</strong>
          </div>
          <button className={styles.editLink} onClick={onBack} type="button">
            <EditIcon /> Edit this section
          </button>
        </header>

        <div className={styles.cardBody}>
          {isAmendment && (
            <div className={styles.amendmentNote}>
              <strong>Amendment review</strong>
              <span>The existing PV number will remain unchanged after resubmission.</span>
            </div>
          )}

          <section className={styles.informationSection}>
            <h2>General Information</h2>
            <dl className={styles.informationGrid}>
              <div><dt>PV date</dt><dd>{formatDate(voucher.pvDate)}</dd></div>
              <div><dt>Division</dt><dd>{voucher.division}</dd></div>
              <div><dt>Created by</dt><dd>{submitter?.name ?? voucher.submitterId}</dd></div>
              <div>
                <dt>Assigned Director</dt>
                <dd className={styles.directorValue}>
                  {director?.name ?? voucher.directorId}<span>Reviewer</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className={styles.informationSection}>
            <h2>Recipient Information</h2>
            <dl className={styles.informationGrid}>
              <div><dt>Recipient name</dt><dd>{voucher.recipientName}</dd></div>
              <div><dt>Recipient email</dt><dd>{voucher.recipientEmail}</dd></div>
              <div><dt>IC / identity number</dt><dd className={styles.monospace}>{displayValue(voucher.recipientIc)}</dd></div>
              <div><dt>Malaysian</dt><dd>{voucher.recipientIsMalaysian ? 'Yes' : 'No'}</dd></div>
            </dl>
          </section>

          <section className={styles.informationSection}>
            <h2>Payment Information</h2>
            <dl className={styles.informationGrid}>
              <div><dt>Payment method</dt><dd>{voucher.paymentMethod}</dd></div>
              <div><dt>Bank name</dt><dd>{displayValue(voucher.bankName)}</dd></div>
              <div><dt>Bank account number</dt><dd className={styles.monospace}>{displayValue(voucher.bankAccountNumber)}</dd></div>
              <div><dt>Purpose of payment</dt><dd>{voucher.purpose}</dd></div>
            </dl>
          </section>

          <section className={styles.informationSection}>
            <div className={styles.sectionHeadingRow}>
              <h2>Payment Breakdown</h2>
              <span className={styles.lineCount}>{voucher.lines.length} {voucher.lines.length === 1 ? 'line' : 'lines'}</span>
            </div>

            <div className={styles.breakdownTable} role="table">
              <div className={styles.breakdownHeader} role="row">
                <span>Account</span><span>Description</span><span>Quantity</span>
                <span>Unit price</span><span>Tax</span><span>Total</span>
              </div>
              <div className={styles.breakdownBody}>
                {voucher.lines.map((line, index) => {
                  const lineTotal = line.quantity * line.unitAmount + line.taxAmount;
                  const cells = [
                    ['Account', line.accountCode],
                    ['Description', line.description],
                    ['Quantity', String(line.quantity)],
                    ['Unit price', formatMoney(line.unitAmount)],
                    ['Tax', formatMoney(line.taxAmount)],
                    ['Total', formatMoney(lineTotal)],
                  ];
                  return (
                    <div className={styles.breakdownRow} key={`${line.accountCode}-${index}`} role="row">
                      {cells.map(([label, cellValue]) => (
                        <div key={label} role="cell">
                          <span>{label}</span>
                          <strong className={label === 'Account' || label === 'Unit price' || label === 'Tax' || label === 'Total' ? styles.monospace : undefined}>{cellValue}</strong>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.totalsPanel}>
              <div><span>Subtotal</span><strong>{formatMoney(totals.subtotal)}</strong></div>
              <div><span>Tax</span><strong>{formatMoney(totals.tax)}</strong></div>
              <div className={styles.grandTotal}><span>Grand total</span><strong>{formatMoney(totals.grandTotal)}</strong></div>
            </div>

            <div className={styles.amountWords}>
              <span>Amount in words</span><strong>{amountInWords}</strong>
            </div>
          </section>

          <section className={styles.documentsSection}>
            <h2>Supporting Documents</h2>
            <div className={styles.documentsBox}>
              {supportingDocumentNames.length ? (
                <ul className={styles.documentList}>
                  {supportingDocumentNames.map((name) => (
                    <li key={name}><DocumentIcon /><span>{name}</span></li>
                  ))}
                </ul>
              ) : (
                <div className={styles.emptyDocuments}>
                  <DocumentIcon />
                  <span>{isAmendment ? 'No replacement or additional supporting documents selected.' : 'No supporting documents selected.'}</span>
                </div>
              )}
              <button className={styles.attachButton} onClick={onBack} type="button">Attach files</button>
            </div>
          </section>

          <footer className={styles.reviewActions}>
            <span>Step 2 of 2: {isAmendment ? 'Director Resubmission' : 'Director Submission'}</span>
            <div>
              <button className={styles.secondaryButton} disabled={isSubmitting} onClick={onBack} type="button">Back to edit</button>
              <button className={styles.primaryButton} disabled={isSubmitting} onClick={onSubmit} type="button">
                {isSubmitting
                  ? isAmendment ? 'Resubmitting…' : 'Submitting…'
                  : isAmendment ? 'Resubmit to Director' : 'Submit to Director'}
                {!isSubmitting && <span aria-hidden="true">→</span>}
              </button>
            </div>
          </footer>
        </div>
      </article>
    </section>
  );
}

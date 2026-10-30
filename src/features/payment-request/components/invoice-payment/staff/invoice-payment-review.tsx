'use client';

import type {
  InvoicePaymentPortion,
  InvoiceTransferType,
  PaymentRequestDocument,
} from '@/domain/payment-requests/invoice-payment/types';
import { amountToMalayWords } from '@/lib/currency/amount-words';
import styles from './invoice-payment-review.module.css';

type Props = {
  staffName: string;
  requestDate: string;
  projectName: string;
  purpose: string;
  vendorName: string;
  eInvoiceLink: string;
  transferType: InvoiceTransferType | '';
  paymentPortion: InvoicePaymentPortion | '';
  paymentPortionOther: string;
  invoiceTotal: number;
  requestedAmount: number;
  documents: PaymentRequestDocument[];
  error?: string;
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));

const portionLabel = (value: InvoicePaymentPortion | '', other: string) =>
  value === 'UPFRONT_50'
    ? '50% upfront payment'
    : value === 'BALANCE_50'
      ? '50% balance payment'
      : value === 'FULL'
        ? 'Full payment'
        : other || 'Other payment';

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function InvoicePaymentReview(p: Props) {
  const payment = portionLabel(p.paymentPortion, p.paymentPortionOther);
  const initials = p.staffName
    .split(/\s+/)
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className={styles.page}>
      {p.error && (
        <div className={styles.errorNotice} role="alert">
          {p.error}
        </div>
      )}

      <section className={styles.reviewCard}>
        <div className={styles.detailPane}>
          <header className={styles.titleBlock}>
            <p>
              <span className={styles.typeBadge}>INV</span>Invoice Payment
              Request
            </p>
            <h1>{p.purpose}</h1>
            <small>
              Review the details below before sending this request for Manager
              approval.
            </small>
          </header>

          <section className={styles.section}>
            <h2>Request details</h2>
            <dl className={styles.grid}>
              <Value
                label="Request date"
                value={dateLabel(p.requestDate)}
              />
              <div>
                <dt>Requester</dt>
                <dd className={styles.person}>
                  <i>{initials}</i>
                  {p.staffName}
                </dd>
              </div>
              <Value label="Project name" value={p.projectName} />
              <Value label="Vendor / Payee" value={p.vendorName} />
            </dl>
          </section>

          <section className={styles.section}>
            <h2>Payment terms</h2>
            <dl className={styles.terms}>
              <Value
                label="Transfer method"
                value={
                  p.transferType === 'GIRO'
                    ? 'GIRO transfer — next working day'
                    : 'Instant transfer'
                }
              />
              <Value label="Payment portion" value={payment} />
              <Value
                label="Full invoice total"
                value={`RM ${p.invoiceTotal.toFixed(2)}`}
              />
            </dl>
          </section>

          <section className={styles.section}>
            <h2>Documents</h2>
            <div className={styles.documentRow}>
              <div>
                <small>Digital E-Invoice Link</small>
                <a href={p.eInvoiceLink} target="_blank" rel="noreferrer">
                  {p.eInvoiceLink} ↗
                </a>
              </div>
              <span>Linked &amp; Active</span>
            </div>
            {p.documents.map((d) => (
              <div className={styles.documentRow} key={d.id}>
                <div>
                  <small>Supporting document</small>
                  <strong>{d.fileName}</strong>
                </div>
                <span>Attached</span>
              </div>
            ))}
          </section>
        </div>

        <aside className={styles.actionPane}>
          <div>
            <small>Amount requested now</small>
            <strong>RM {p.requestedAmount.toFixed(2)}</strong>
            <p>{amountToMalayWords(p.requestedAmount)}</p>
          </div>
          <div className={styles.next}>
            <small>What happens next</small>
            <p>
              Your Manager reviews this request, then it moves to Director
              approval and Finance verification.
            </p>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              disabled={p.isSaving}
              type="button"
              onClick={p.onSubmit}
            >
              {p.isSaving ? 'Submitting…' : 'Submit for Manager review →'}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={p.onBack}
            >
              Back to edit
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
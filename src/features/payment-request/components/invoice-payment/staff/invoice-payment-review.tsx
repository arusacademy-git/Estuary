'use client';

import type {
  InvoicePaymentPortion,
  InvoiceTransferType,
  PaymentRequestDocument,
} from '@/domain/payment-requests/invoice-payment/types';
import { amountToMalayWords } from '@/lib/currency/amount-words';

import styles from '@/features/payment-request/components/invoice-payment/staff/invoice-payment-review.module.css';

type InvoicePaymentReviewProps = {
  staffName: string;
  requestDate: string;
  projectName: string;
  title: string;
  purpose: string;
  vendorName: string;
  eInvoiceLink: string;
  transferType: InvoiceTransferType | '';
  paymentPortion: InvoicePaymentPortion | '';
  paymentPortionOther: string;
  invoiceTotal: number;
  taxAmount: number;
  requestedAmount: number;
  documents: PaymentRequestDocument[];
  error?: string;
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsed);
}

function portionLabel(portion: InvoicePaymentPortion | '', other: string) {
  if (portion === 'UPFRONT_50') return '50% upfront payment';
  if (portion === 'BALANCE_50') return '50% balance payment';
  if (portion === 'FULL') return 'Full payment';
  return other || 'Other payment';
}

function downloadDocument(document: PaymentRequestDocument) {
  const link = window.document.createElement('a');
  link.href = document.dataUrl;
  link.download = document.fileName;
  link.style.display = 'none';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}

export function InvoicePaymentReview({
  staffName,
  requestDate,
  projectName,
  title,
  purpose,
  vendorName,
  eInvoiceLink,
  transferType,
  paymentPortion,
  paymentPortionOther,
  invoiceTotal,
  taxAmount,
  requestedAmount,
  documents,
  error,
  isSaving,
  onBack,
  onSubmit,
}: InvoicePaymentReviewProps) {
  const staffInitials = staffName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const paymentLabel = portionLabel(paymentPortion, paymentPortionOther);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>Payment Requests <span>/</span> Invoice Payment <span>/</span> Review</p>
          <h1>Review Invoice Payment</h1>
          <small>
            Verify all payment terms and attached documents before routing the
            request to management for review.
          </small>
        </div>
        <span className={styles.readyBadge}><i /> Ready for Review</span>
      </header>

      {error && <div className={styles.errorNotice} role="alert">{error}</div>}

      <section className={styles.reviewCard}>
        <div className={styles.hero}>
          <div>
            <span>Invoice Payment Request</span>
            <h2>{title}</h2>
            <p>{purpose}</p>
          </div>
          <div className={styles.requestedTotal}>
            <span>Total requested now</span>
            <strong>RM {requestedAmount.toFixed(2)}</strong>
            <small>{paymentLabel}</small>
          </div>
        </div>

        <ReviewSection title="Parties & Project Info">
          <dl className={styles.fourColumn}>
            <Value label="Request date" value={formatDate(requestDate)} />
            <div>
              <dt>Staff requester</dt>
              <dd className={styles.staffValue}><span>{staffInitials}</span>{staffName}</dd>
            </div>
            <Value label="Project name" value={projectName} />
            <Value label="Vendor / Payee" value={vendorName} />
          </dl>
        </ReviewSection>

        <ReviewSection title="Financial Summary & Terms">
          <dl className={styles.fourColumn}>
            <Value
              label="Transfer method"
              value={
                transferType === 'GIRO'
                  ? 'GIRO transfer — next working day'
                  : 'Instant transfer'
              }
            />
            <Value label="Payment portion" value={paymentLabel} />
            <div>
              <dt>Full invoice total</dt>
              <dd>RM {invoiceTotal.toFixed(2)}</dd>
              <small>Tax/SST included: RM {taxAmount.toFixed(2)}</small>
            </div>
            <div>
              <dt>Amount requested</dt>
              <dd className={styles.emphasizedAmount}>
                RM {requestedAmount.toFixed(2)}
              </dd>
              <small>{amountToMalayWords(requestedAmount)}</small>
            </div>
          </dl>
        </ReviewSection>

        <ReviewSection title="Documentation & Compliance">
          <div className={styles.complianceList}>
            <div>
              <span className={styles.documentIcon} aria-hidden="true">↗</span>
              <div>
                <small>Digital E-Invoice Link</small>
                <a href={eInvoiceLink} target="_blank" rel="noreferrer">
                  {eInvoiceLink} ↗
                </a>
              </div>
              <strong className={styles.linkedBadge}>Linked & Active</strong>
            </div>

            {documents.map((document, index) => (
              <div key={document.id}>
                <span
                  className={`${styles.documentIcon} ${styles.fileIcon}`}
                  aria-hidden="true"
                >
                  □
                </span>
                <div>
                  <small>
                    Supporting file{' '}
                    {documents.length > 1
                      ? `${index + 1} of ${documents.length}`
                      : '(1 attached)'}
                  </small>
                  <strong>{document.fileName}</strong>
                </div>
                <button type="button" onClick={() => downloadDocument(document)}>
                  Download
                </button>
              </div>
            ))}
          </div>
        </ReviewSection>

        <footer className={styles.actions}>
          <button className={styles.secondaryButton} type="button" onClick={onBack}>
            Back to edit
          </button>
          <button
            className={styles.primaryButton}
            disabled={isSaving}
            type="button"
            onClick={onSubmit}
          >
            {isSaving ? 'Submitting…' : 'Submit for Manager review'}
            <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.reviewSection}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

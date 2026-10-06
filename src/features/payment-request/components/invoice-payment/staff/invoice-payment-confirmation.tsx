'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';
import { getBetaAccount } from '@/lib/auth/beta-accounts';

import styles from '@/features/payment-request/components/invoice-payment/staff/invoice-payment-confirmation.module.css';

type InvoicePaymentConfirmationProps = {
  request: InvoicePaymentRequestRecord;
  onCreateAnother: () => void;
};

const PAYMENT_PORTION_LABELS: Record<
  InvoicePaymentRequestRecord['paymentPortion'],
  string
> = {
  UPFRONT_50: '50% upfront payment',
  BALANCE_50: '50% balance payment',
  FULL: 'Full payment',
  OTHER: 'Custom payment portion',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value);
}

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

export function InvoicePaymentConfirmation({
  request,
  onCreateAnother,
}: InvoicePaymentConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const manager = getBetaAccount(request.managerApproverId);
  const portionLabel =
    request.paymentPortion === 'OTHER' && request.paymentPortionOther
      ? request.paymentPortionOther
      : PAYMENT_PORTION_LABELS[request.paymentPortion];

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(request.requestNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <span>Payment Requests</span>
        <i aria-hidden="true">›</i>
        <span>Invoice Payment</span>
        <i aria-hidden="true">›</i>
        <strong>Confirmation</strong>
      </nav>

      <section className={styles.card}>
        <header className={styles.successHeader}>
          <span aria-hidden="true" className={styles.successIcon}>✓</span>
          <h1>Invoice Payment request submitted</h1>
          <div className={styles.referenceRow}>
            <span className={styles.referenceBox}>
              <small>REF ID</small>
              <strong>{request.requestNumber}</strong>
              <button
                aria-label="Copy request reference"
                type="button"
                onClick={copyReference}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </span>
            <span className={styles.statusBadge}>
              <i aria-hidden="true" /> Pending Manager Review
            </span>
          </div>
          <p>
            Your request has been saved and routed to the assigned Manager.
            You can follow its progress from Payment Records.
          </p>
        </header>

        <section className={styles.summarySection}>
          <h2>Request summary</h2>
          <dl className={styles.summaryGrid}>
            <div>
              <dt>Amount requested</dt>
              <dd className={styles.amount}>{formatCurrency(request.requestedAmount)}</dd>
              <small>{portionLabel} of {formatCurrency(request.invoiceTotal)}</small>
            </div>
            <div>
              <dt>Vendor / Payee</dt>
              <dd>{request.vendorName}</dd>
              <small>{request.transferType === 'GIRO' ? 'GIRO transfer' : 'Instant transfer'}</small>
            </div>
            <div>
              <dt>Project</dt>
              <dd>{request.projectName}</dd>
              <small>Request date: {formatDate(request.requestDate)}</small>
            </div>
            <div>
              <dt>Assigned reviewer</dt>
              <dd>{manager?.name ?? request.managerApproverId}</dd>
              <small>{manager?.position ?? 'Manager reviewer'}</small>
            </div>
          </dl>
        </section>

        <section className={styles.workflowSection}>
          <h2>Workflow progress</h2>
          <ol className={styles.workflow}>
            <WorkflowStep state="complete" number="✓" title="Request Submitted" copy={request.staffName} />
            <WorkflowStep state="active" number="2" title="Manager Review" copy={`Assigned to ${manager?.name ?? 'Manager'}`} />
            <WorkflowStep number="3" title="Director Review" copy="Awaiting Manager approval" />
            <WorkflowStep number="4" title="Finance Verification" copy="Awaiting Director approval" />
            <WorkflowStep number="5" title="Completed" copy="Awaiting Finance confirmation" />
          </ol>
        </section>

        <footer className={styles.actions}>
          <div>
            <button className={styles.secondaryButton} type="button" onClick={onCreateAnother}>
              Create another Invoice Payment
            </button>
            <Link className={styles.primaryButton} href="/beta/payment-records">
              Track in Payment Records
            </Link>
          </div>
        </footer>
      </section>

      <p className={styles.note}>
        Need to make a correction? Contact the assigned Manager before the review is completed.
      </p>
    </main>
  );
}

function WorkflowStep({
  state = 'pending',
  number,
  title,
  copy,
}: {
  state?: 'complete' | 'active' | 'pending';
  number: string;
  title: string;
  copy: string;
}) {
  return (
    <li className={`${styles.workflowStep} ${styles[state]}`}>
      <span aria-hidden="true">{number}</span>
      <strong>{title}</strong>
      <small>{copy}</small>
    </li>
  );
}

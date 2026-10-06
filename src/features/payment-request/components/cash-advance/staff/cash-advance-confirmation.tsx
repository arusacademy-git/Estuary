'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { betaAccounts } from '@/lib/auth/beta-accounts';
import styles from '../cash-advance.module.css';

const money = (value: number) => new Intl.NumberFormat('en-MY', {
  style: 'currency', currency: 'MYR', minimumFractionDigits: 2,
}).format(value);
const accountName = (id: string) => betaAccounts.find((account) => account.id === id)?.name ?? id;
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY');
};

export function CashAdvanceConfirmation({ record }: { record: CashAdvanceRecord }) {
  const [copied, setCopied] = useState(false);
  async function copyReference() {
    try {
      await navigator.clipboard.writeText(record.requestNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  return (
    <main className={styles.confirmationPage}>
      <nav className={styles.confirmationBreadcrumb} aria-label="Breadcrumb">
        <span>Payment Requests</span><i>›</i><span>Cash Advance</span><i>›</i><strong>Confirmation</strong>
      </nav>
      <section className={styles.confirmationReceipt}>
        <header className={styles.confirmationHeader}>
          <span className={styles.confirmationSuccess} aria-hidden="true">✓</span>
          <h1>Cash Advance request submitted</h1>
          <div className={styles.confirmationReferenceRow}>
            <span className={styles.confirmationReference}>
              <small>REF ID</small><strong>{record.requestNumber}</strong>
              <button type="button" onClick={copyReference}>{copied ? 'Copied' : 'Copy'}</button>
            </span>
            <span className={styles.confirmationStatus}><i />Pending Manager Review</span>
          </div>
          <p>Your signed request was routed to {accountName(record.managerApproverId)} for review.</p>
        </header>

        <section className={styles.confirmationSection}>
          <h2>Request summary</h2>
          <dl className={styles.confirmationGrid}>
            <div><dt>Amount requested</dt><dd className={styles.confirmationAmount}>{money(record.totalAmount)}</dd><small>{record.lines.length} expense {record.lines.length === 1 ? 'entry' : 'entries'}</small></div>
            <div><dt>Project</dt><dd>{record.projectName}</dd><small>Submitted by {record.requesterName}</small></div>
            <div><dt>Request date</dt><dd>{date(record.requestDate)}</dd><small>Cash Advance request</small></div>
            <div><dt>Next reviewer</dt><dd>{accountName(record.managerApproverId)}</dd><small>Manager reviewer</small></div>
          </dl>
        </section>

        <section className={styles.confirmationSection}>
          <h2>Workflow progress</h2>
          <ol className={styles.confirmationWorkflow}>
            <ConfirmationStep state="complete" title="Request Submitted" copy={record.requesterName} />
            <ConfirmationStep state="active" title="Manager Review" copy={`Assigned to ${accountName(record.managerApproverId)}`} />
            <ConfirmationStep title="Director Review" copy="Awaiting Manager review" />
            <ConfirmationStep title="Finance Payment" copy="Awaiting Director approval" />
            <ConfirmationStep title="Reconciliation" copy="After payment" />
            <ConfirmationStep title="Completed" copy="Awaiting reconciliation" />
          </ol>
        </section>

        <footer className={styles.confirmationActions}>
          <Link className={styles.secondary} href="/beta/payment-records">View Payment Records</Link>
          <Link className={styles.primary} href={`/beta/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}`}>Track request</Link>
        </footer>
      </section>
      <p className={styles.confirmationNote}>Need a correction? Contact the current reviewer before the request moves to the next stage.</p>
    </main>
  );
}

function ConfirmationStep({ state = 'pending', title, copy }: {
  state?: 'complete' | 'active' | 'pending'; title: string; copy: string;
}) {
  return <li className={styles.confirmationStep} data-state={state}><span>{state === 'complete' ? '✓' : ''}</span><strong>{title}</strong><small>{copy}</small></li>;
}
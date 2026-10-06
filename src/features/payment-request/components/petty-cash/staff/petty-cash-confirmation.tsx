'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { getBetaAccount } from '@/lib/auth/beta-accounts';

import styles from '../petty-cash.module.css';

function money(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value);
}

function date(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY');
}

export function PettyCashConfirmation({
  request,
  onCreateAnother,
}: {
  request: PettyCashRecord;
  onCreateAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const manager = getBetaAccount(request.managerApproverId);
  const director = getBetaAccount(request.directorApproverId);
  const independentReviewer = request.financeReviewerId ? getBetaAccount(request.financeReviewerId) : undefined;
  const location = request.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur';
  const requesterRole = request.requesterRole ?? 'staff';
  const nextReviewer = requesterRole === 'staff' ? manager?.name ?? 'the assigned Manager' : requesterRole === 'manager' ? director?.name ?? 'the assigned Director' : requesterRole === 'director' ? 'Finance' : independentReviewer?.name ?? 'the independent reviewer';
  const nextStage = requesterRole === 'staff' ? 'Manager review' : requesterRole === 'manager' ? 'Director preview' : requesterRole === 'director' ? 'Finance processing' : 'Independent review';
  const workflow = requesterRole === 'staff'
    ? [['Manager Review', `Assigned to ${manager?.name ?? 'Manager'}`], ['Director Preview', `Assigned to ${director?.name ?? 'Director'}`], ['Finance Processing', 'After Director preview'], ['Completed', 'After Finance payment']]
    : requesterRole === 'manager'
      ? [['Director Preview', `Assigned to ${director?.name ?? 'Director'}`], ['Finance Processing', 'After Director preview'], ['Completed', 'After Finance payment']]
      : requesterRole === 'director'
        ? [['Finance Processing', 'Sent directly to Finance'], ['Completed', 'After Finance payment']]
        : [['Independent Review', `Assigned to ${independentReviewer?.name ?? 'reviewer'}`], ['Finance Processing', 'After independent review'], ['Completed', 'After Finance payment']];

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
    <main className={styles.confirmationPage}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <span>Payment Requests</span><i>›</i><span>Petty Cash</span><i>›</i><strong>Confirmation</strong>
      </nav>

      <section className={styles.confirmationCard}>
        <header className={styles.confirmationHeader}>
          <span aria-hidden="true" className={styles.confirmationSuccess}>✓</span>
          <h1>Petty Cash request submitted</h1>
          <div className={styles.referenceRow}>
            <span className={styles.referenceBox}>
              <small>REF ID</small>
              <strong>{request.requestNumber}</strong>
              <button aria-label="Copy request reference" type="button" onClick={copyReference}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </span>
            <span className={styles.confirmationStatus}><i />{nextStage}</span>
          </div>
          <p>
            Your request was routed to {nextReviewer}. The workflow will continue according to your requester role.
          </p>
        </header>

        <section className={styles.confirmationSection}>
          <h2>Request summary</h2>
          <dl className={styles.confirmationGrid}>
            <div><dt>Request total</dt><dd className={styles.confirmationAmount}>{money(request.totalAmount)}</dd><small>{request.lines.length} expense {request.lines.length === 1 ? 'entry' : 'entries'}</small></div>
            <div><dt>Requester</dt><dd>{request.requesterName}</dd><small>{request.requesterPosition}</small></div>
            <div><dt>Request date</dt><dd>{date(request.requestDate)}</dd><small>{location} office fund</small></div>
            <div><dt>Next stage</dt><dd>{nextReviewer}</dd><small>{nextStage}</small></div>
          </dl>
        </section>

        <section className={styles.confirmationSection}>
          <h2>Workflow progress</h2>
          <ol className={styles.confirmationWorkflow}>
            <ConfirmationStep state="complete" number="✓" title="Request Submitted" copy={request.requesterName} />
            {workflow.map(([title, copy], index) => <ConfirmationStep key={title} state={index === 0 ? 'active' : 'pending'} number={String(index + 2)} title={title} copy={copy} />)}
          </ol>
        </section>

        <footer className={styles.confirmationActions}>
          <button className={styles.secondaryButton} type="button" onClick={onCreateAnother}>
            Create another Petty Cash request
          </button>
          <Link className={styles.primaryButton} href="/beta/payment-records/petty-cash?scope=mine">
            Track in Payment Records
          </Link>
        </footer>
      </section>

      <p className={styles.confirmationNote}>
        Need a correction? Contact the current reviewer before the request moves to Finance.
      </p>
    </main>
  );
}

function ConfirmationStep({
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
    <li className={styles.confirmationStep} data-state={state}>
      <span>{number}</span><strong>{title}</strong><small>{copy}</small>
    </li>
  );
}

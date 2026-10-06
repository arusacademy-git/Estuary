'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';

import { claimTypeDetails, type ClaimRecord } from '@/domain/payment-requests/claims/types';
import { getBetaAccount } from '@/lib/auth/beta-accounts';

import styles from './claim-confirmation.module.css';

type WorkflowStage = 'submitted' | 'manager' | 'director' | 'finance' | 'completed';
type WorkflowState = 'complete' | 'active' | 'returned' | 'pending' | 'informational';

function formatDate(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value);
}

function workflowStages(record: ClaimRecord): WorkflowStage[] {
  if (record.requesterRole !== 'director') return ['submitted', 'manager', 'director', 'finance', 'completed'];
  return ['submitted', 'finance', 'completed'];
}

function currentStage(record: ClaimRecord): WorkflowStage {
  if (record.status === 'PENDING_MANAGER_APPROVAL') return 'manager';
  if (record.status === 'PENDING_DIRECTOR_APPROVAL') return 'director';
  if (record.status === 'PENDING_FINANCE_PROCESSING') return 'finance';
  if (record.status === 'PAID') return 'completed';
  if (record.status === 'RETURNED_TO_CLAIMANT') {
    if (record.returnedFromStage === 'FINANCE') return 'finance';
    if (record.returnedFromStage === 'DIRECTOR') return 'director';
    return 'manager';
  }
  return 'submitted';
}

function stageState(record: ClaimRecord, stages: WorkflowStage[], stage: WorkflowStage): WorkflowState {
  if (stage === 'manager') return record.managerApprovedAt ? 'complete' : record.status === 'DRAFT' ? 'pending' : 'informational';
  if (stage === 'director') return record.directorReviewedAt ? 'complete' : record.status === 'DRAFT' ? 'pending' : 'informational';
  const selectedStage = currentStage(record);
  const selectedIndex = stages.indexOf(selectedStage);
  const stageIndex = stages.indexOf(stage);

  if (record.status === 'RETURNED_TO_CLAIMANT' && stage === selectedStage) return 'returned';
  if (record.status === 'PAID' || stageIndex < selectedIndex) return 'complete';
  if (stage === selectedStage) return 'active';
  return 'pending';
}

function statusLabel(record: ClaimRecord) {
  if (record.status === 'DRAFT') return 'Draft saved';
  if (record.status === 'PENDING_MANAGER_APPROVAL') return 'Pending Manager Review';
  if (record.status === 'PENDING_DIRECTOR_APPROVAL') return 'Pending Director Review';
  if (record.status === 'PENDING_FINANCE_PROCESSING') return 'Pending Finance Processing';
  if (record.status === 'RETURNED_TO_CLAIMANT') return 'Correction Required';
  if (record.status === 'PAID') return 'Completed';
  return 'Submitted';
}

export function ClaimConfirmation({ record, onCreateAnother }: { record: ClaimRecord; onCreateAnother: () => void }) {
  const [copied, setCopied] = useState(false);
  const isDraft = record.status === 'DRAFT';
  const stages = workflowStages(record);
  const manager = record.managerApproverId ? getBetaAccount(record.managerApproverId) : null;
  const director = record.directorApproverId ? getBetaAccount(record.directorApproverId) : null;
  const claimType = claimTypeDetails(record.claimType).label;
  const nextReviewer = record.status === 'PENDING_MANAGER_APPROVAL'
    ? manager?.name ?? 'Assigned Manager'
    : record.status === 'PENDING_DIRECTOR_APPROVAL'
      ? director?.name ?? 'Assigned Director'
      : record.status === 'PENDING_FINANCE_PROCESSING'
        ? 'Finance team'
        : record.status === 'PAID'
          ? 'Completed by Finance'
          : isDraft ? 'Not submitted' : 'Claim workflow';
  const headerMessage = isDraft
    ? `Your ${claimType.toLowerCase()} has been saved without entering the approval workflow.`
    : record.status === 'PENDING_MANAGER_APPROVAL'
      ? `Your claim was routed to ${manager?.name ?? 'the assigned Manager'} for review.`
      : record.status === 'PENDING_DIRECTOR_APPROVAL'
        ? `Your claim was routed to ${director?.name ?? 'the assigned Director'} for preview.`
        : record.status === 'PENDING_FINANCE_PROCESSING'
          ? 'Your claim was routed to Finance for verification and payment processing.'
          : 'Your claim has been saved in the Claims workflow.';

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(record.claimNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <span>Payment Requests</span><i>›</i><span>Claims</span><i>›</i>
        <strong>{isDraft ? 'Draft saved' : 'Confirmation'}</strong>
      </nav>

      <section className={styles.card}>
        <header className={`${styles.successHeader} ${isDraft ? styles.draftHeader : ''}`}>
          <span aria-hidden="true" className={styles.successIcon}>✓</span>
          <h1>{isDraft ? 'Claim draft saved' : 'Claim request submitted'}</h1>
          <div className={styles.referenceRow}>
            <span className={styles.referenceBox}>
              <small>REF ID</small><strong>{record.claimNumber}</strong>
              <button aria-label="Copy Claim reference" type="button" onClick={copyReference}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </span>
            <span className={`${styles.statusBadge} ${isDraft ? styles.draftBadge : ''}`}>
              <i aria-hidden="true" />{statusLabel(record)}
            </span>
          </div>
          <p>{headerMessage} You can follow it from Claims Payment Records.</p>
        </header>

        <section className={styles.summarySection}>
          <h2>Request summary</h2>
          <dl className={styles.summaryGrid}>
            <div><dt>Total requested</dt><dd className={styles.amount}>{formatCurrency(record.totalAmount)}</dd><small>{record.lines.length} expense {record.lines.length === 1 ? 'item' : 'items'}</small></div>
            <div><dt>Claim type</dt><dd>{claimType}</dd><small>Claim date: {formatDate(record.claimDate)}</small></div>
            <div><dt>Claimant</dt><dd>{record.requesterName}</dd><small>{record.requesterPosition}</small></div>
            <div><dt>{isDraft ? 'Workflow status' : 'Next reviewer'}</dt><dd>{nextReviewer}</dd><small>{isDraft ? 'Continue this Draft from Payment Records' : statusLabel(record)}</small></div>
          </dl>
        </section>

        <section className={styles.workflowSection}>
          <h2>Workflow progress</h2>
          <ol className={styles.workflow} style={{ '--stage-count': stages.length } as CSSProperties}>
            {stages.map((stage, index) => (
              <WorkflowStep
                key={stage}
                state={stageState(record, stages, stage)}
                number={String(index + 1)}
                title={stageTitle(stage, isDraft)}
                copy={stageCopy(stage, record, manager?.name, director?.name)}
              />
            ))}
          </ol>
        </section>

        <footer className={styles.actions}>
          <div>
            <button className={styles.secondaryButton} type="button" onClick={onCreateAnother}>Create another Claim</button>
            <Link className={styles.primaryButton} href="/beta/payment-records/claims?scope=mine">
              {isDraft ? 'Continue in Payment Records' : 'Track in Payment Records'}
            </Link>
          </div>
        </footer>
      </section>

      <p className={styles.note}>
        {isDraft
          ? 'This Draft is private to your role and can be edited before submission.'
          : 'Manager and Director previews are informational; Finance processing starts immediately.'}
      </p>
    </main>
  );
}

function stageTitle(stage: WorkflowStage, isDraft: boolean) {
  if (stage === 'submitted') return isDraft ? 'Draft Saved' : 'Claim Submitted';
  if (stage === 'manager') return 'Manager Preview';
  if (stage === 'director') return 'Director Preview';
  if (stage === 'finance') return 'Finance Processing';
  return 'Completed';
}

function stageCopy(stage: WorkflowStage, record: ClaimRecord, managerName?: string, directorName?: string) {
  if (stage === 'submitted') return `${record.requesterName} · ${formatDate(record.createdAt)}`;
  if (stage === 'manager') return `Optional preview by ${managerName ?? 'Manager'} · Finance is not blocked`;
  if (stage === 'director') return `Optional preview by ${directorName ?? 'Director'} · Finance is not blocked`;
  if (stage === 'finance') return 'Document verification and payment';
  return 'Claim paid and closed';
}

function WorkflowStep({ state, number, title, copy }: { state: WorkflowState; number: string; title: string; copy: string }) {
  return (
    <li className={`${styles.workflowStep} ${styles[state]}`}>
      <span aria-hidden="true">{state === 'complete' ? '✓' : state === 'returned' ? '!' : number}</span>
      <strong>{title}</strong>
      <small>{state === 'returned' ? 'Returned for correction' : copy}</small>
    </li>
  );
}

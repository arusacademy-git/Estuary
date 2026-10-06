'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import {
  approvePettyCashByManager,
  fetchPettyCashRequest,
  returnPettyCashByManager,
} from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { notifyPettyCashManagerApproved, notifyPettyCashReturned } from '@/features/payment-request/notifications/petty-cash-notifications';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import { PettyCashPdfForm } from '../petty-cash-pdf-form';
import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

function money(value: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}

function date(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function location(record: PettyCashRecord) {
  return record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur';
}

export function PettyCashManagerReview({ requestId }: { requestId: string }) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<PettyCashRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccount(readBetaSession());
    fetchPettyCashRequest(requestId)
      .then(setRecord)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Request could not be loaded.'))
      .finally(() => setChecked(true));
  }, [requestId]);

  async function approve() {
    if (!account || account.role !== 'manager' || !record) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await approvePettyCashByManager(record.id, account.id);
      notifyPettyCashManagerApproved(updated, account);
      setRecord(updated);
      setSuccess('The Petty Cash request was reviewed and forwarded to the Director.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request could not be approved.');
    } finally {
      setSaving(false);
    }
  }

  async function returnRequest() {
    if (!account || account.role !== 'manager' || !record) return;
    if (remarks.trim().length < 3) {
      setError('Enter correction remarks before returning the request.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await returnPettyCashByManager(record.id, account.id, remarks.trim());
      notifyPettyCashReturned(updated, account, 'Manager');
      setRecord(updated);
      setSuccess('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request could not be returned.');
    } finally {
      setSaving(false);
    }
  }

  if (!checked) return <StatePage title="Loading request" copy="Reading the Petty Cash details…" />;
  if (!account || account.role !== 'manager') return <StatePage title="Manager access required" copy="This page is available only to a Manager." />;
  if (!record) return <StatePage title="Petty Cash request not found" copy={error || 'The request could not be found.'} />;
  if (record.managerApproverId !== account.id) return <StatePage title="Request assigned to another Manager" copy="You cannot review this Petty Cash request." />;

  const actionable = record.status === 'PENDING_MANAGER_APPROVAL';

  return <main className={styles.managerReviewPage}>
    <div className={styles.managerBackRow}><Link href="/beta/project-manager/payment-requests/petty-cash">← Back to Petty Cash requests</Link></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {success && <div className={styles.managerSuccess} role="status">{success}</div>}

    <div className={styles.detailLayout}>
      <div className={styles.detailMain}>
        <header className={styles.detailHero}>
          <div>
            <div className={styles.managerReviewEyebrow}><p>Manager review</p><PettyCashStatusBadge status={record.status} /></div>
            <h1>{record.requestNumber}</h1>
            <span>{record.requesterName} · {location(record)}</span>
          </div>
          <div><small>Total requested</small><strong>{money(record.totalAmount)}</strong></div>
        </header>

        <DetailSection title="Request overview">
          <dl className={styles.managerReviewGrid}>
            <Value label="Request date" value={date(record.requestDate)} />
            <Value label="Staff" value={record.requesterName} />
            <Value label="Position" value={record.requesterPosition} />
            <Value label="Contact" value={record.requesterContact} />
            <Value label="Office location" value={location(record)} />
            <Value label="Manager reviewer" value={account.name} />
          </dl>
        </DetailSection>

        <DetailSection title="Petty Cash Form">
          <PettyCashPdfForm record={record} />
        </DetailSection>

        <DetailSection title="Expense breakdown">
          <div className={styles.managerReviewTable}><table><thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Details / purpose</th><th>Account category</th><th>Division</th><th>Receipt</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{date(line.expenseDate)}</td><td>{line.supplier}</td><td>{line.details}</td><td>{line.accountType}</td><td>{line.division}</td><td>{line.proofLink ? <a href={line.proofLink} rel="noreferrer" target="_blank">Open proof ↗</a> : '—'}</td><td><strong>{money(line.amount)}</strong></td></tr>)}</tbody></table></div>
          <div className={styles.managerReviewTotal}><span>Total requested</span><strong>{money(record.totalAmount)}</strong></div>
        </DetailSection>

        <DetailSection title="Notes / purpose justification">
          <p className={styles.detailCopy}>{record.notes?.trim() || 'No additional notes were provided.'}</p>
        </DetailSection>
      </div>

      <div className={styles.detailRail}>
        <aside className={styles.managerDecisionPanel}>
          <p>Manager action</p>
          <h2>{actionable ? 'Review and approve' : record.status === 'RETURNED_TO_STAFF' ? 'Returned to Staff' : 'Approval recorded'}</h2>
          {actionable ? <>
            <span>Confirm that the expenses and receipt links are complete, or return the request with correction notes.</span>
            <button className={styles.managerApproveButton} disabled={saving} onClick={approve} type="button">Review and send for Director preview <b aria-hidden="true">→</b></button>
            <div className={styles.managerActionDivider}><span>or return with notes</span></div>
            <label><span>Correction remarks</span><textarea rows={4} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Explain what Staff must correct" /></label>
            <button className={styles.managerReturnButton} disabled={saving || remarks.trim().length < 3} onClick={returnRequest} type="button">Return to Staff</button>
          </> : <>
            <span>This request is now: <strong>{record.status.replaceAll('_', ' ')}</strong>.</span>
            {record.managerApprovedAt && <small>Approved {date(record.managerApprovedAt)}</small>}
            {record.status === 'RETURNED_TO_STAFF' && record.returnRemarks && <div className={styles.managerReturnedReason}><strong>Return reason</strong><p>{record.returnRemarks}</p></div>}
          </>}
        </aside>
        <WorkflowProgress record={record} managerName={account.name} />
      </div>
    </div>
  </main>;
}

function WorkflowProgress({ record, managerName }: { record: PettyCashRecord; managerName: string }) {
  const activeStep = record.status === 'PENDING_MANAGER_APPROVAL' || record.status === 'RETURNED_TO_STAFF'
    ? 2
    : record.status === 'PENDING_DIRECTOR_APPROVAL'
      ? 3
      : record.status === 'PENDING_FINANCE_PAYMENT' || record.status === 'FINANCE_VERIFIED'
        ? 4
        : 5;
  const steps = [
    { title: 'Request Submitted', copy: `Submitted by ${record.requesterName}` },
    { title: 'Manager Review', copy: record.status === 'RETURNED_TO_STAFF' ? 'Returned to requester for correction' : `Reviewed by ${managerName}` },
    { title: 'Director Preview', copy: record.directorApprovedAt ? 'Preview completed' : 'Waiting for Director preview' },
    { title: 'Finance Processing', copy: record.status === 'FINANCE_VERIFIED' ? 'Payment details verified' : 'Finance verification and payment' },
    { title: 'Completed', copy: 'Payment completed and ledger updated' },
  ];

  return <aside className={styles.progressPanel}><header><p>Payment progress</p><span>Step {activeStep} of 4</span></header><ol>{steps.map((step, index) => {
    const number = index + 1;
    const state = record.status === 'RETURNED_TO_STAFF' && number === 2
      ? 'returned'
      : number < activeStep || (record.status === 'PAID' && number === 5)
        ? 'complete'
        : number === activeStep
          ? 'active'
          : 'pending';
    return <li className={styles.progressStep} data-state={state} key={step.title}><i aria-hidden="true">{state === 'complete' ? '✓' : ''}</i><div><strong>{step.title}</strong><small>{state === 'active' || state === 'returned' ? `Current stage: ${step.copy}` : step.copy}</small></div></li>;
  })}</ol></aside>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.detailSection}><h2>{title}</h2>{children}</section>;
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function StatePage({ title, copy }: { title: string; copy: string }) {
  return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/project-manager/payment-requests/petty-cash">Back to Petty Cash requests</Link></main>;
}

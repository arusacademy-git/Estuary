'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import {
  approvePettyCashByManager,
  fetchPettyCashRequest,
} from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { notifyPettyCashManagerApproved } from '@/features/payment-request/notifications/petty-cash-notifications';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

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
      setSuccess('Your informational preview was recorded. Finance processing continues independently.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request could not be approved.');
    } finally {
      setSaving(false);
    }
  }

  if (!checked) return <StatePage title="Loading request" copy="Reading the Petty Cash details…" />;
  if (!account || account.role !== 'manager') return <StatePage title="Manager access required" copy="This page is available only to a Manager." />;
  if (!record) return <StatePage title="Petty Cash request not found" copy={error || 'The request could not be found.'} />;
  if (record.managerApproverId !== account.id && record.financeReviewerId !== account.id) return <StatePage title="Request assigned to another Manager" copy="You cannot preview this Petty Cash request." />;

  const actionable = !record.managerApprovedAt && record.status !== 'RETURNED_TO_STAFF';

  return <main className={styles.managerReviewPage}>
    <div className={styles.managerBackRow}><Link href="/beta/project-manager/payment-requests/petty-cash">← Back to Petty Cash requests</Link></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {success && <div className={styles.managerSuccess} role="status">{success}</div>}

    <div className={styles.detailLayout}>
      <div className={styles.detailMain}>
        <header className={styles.detailHero}>
          <div>
            <div className={styles.managerReviewEyebrow}><p>Manager preview · informational</p><PettyCashStatusBadge status={record.status} /></div>
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
          <h2>{actionable ? 'Preview Petty Cash request' : 'Preview recorded'}</h2>
          {actionable ? <>
            <span>Review the expenses and receipt links for visibility. Finance can process this request before or after your preview.</span>
            <button className={styles.managerApproveButton} disabled={saving} onClick={approve} type="button">Record Manager preview <b aria-hidden="true">→</b></button>
          </> : <>
            <span>Finance processing is independent from this informational preview.</span>
            {record.managerApprovedAt && <small>Previewed {date(record.managerApprovedAt)}</small>}
          </>}
        </aside>
        <WorkflowProgress record={record} managerName={account.name} />
      </div>
    </div>
  </main>;
}

function WorkflowProgress({ record, managerName }: { record: PettyCashRecord; managerName: string }) {
  const activeStep = record.status === 'PAID' ? 5 : record.status === 'FINANCE_VERIFIED' ? 5 : 4;
  const steps = [
    { title: 'Request Submitted', copy: `Submitted by ${record.requesterName}`, state: 'complete' },
    { title: 'Manager Preview', copy: record.managerApprovedAt ? `Previewed by ${managerName}` : 'Informational preview available', state: record.managerApprovedAt ? 'complete' : 'pending' },
    { title: 'Director Preview', copy: record.directorApprovedAt ? 'Preview completed' : 'Informational preview available', state: record.directorApprovedAt ? 'complete' : 'pending' },
    { title: 'Finance Processing', copy: record.status === 'FINANCE_VERIFIED' ? 'Payment details verified' : 'Finance verification and payment', state: record.financeVerifiedAt || record.status === 'PAID' ? 'complete' : record.status === 'RETURNED_TO_STAFF' ? 'returned' : 'active' },
    { title: 'Completed', copy: 'Payment completed and ledger updated', state: record.status === 'PAID' ? 'complete' : record.status === 'FINANCE_VERIFIED' ? 'active' : 'pending' },
  ];

  return <aside className={styles.progressPanel}><header><p>Payment progress</p><span>Step {activeStep} of 5</span></header><ol>{steps.map((step) => {
    return <li className={styles.progressStep} data-state={step.state} key={step.title}><i aria-hidden="true">{step.state === 'complete' ? '✓' : ''}</i><div><strong>{step.title}</strong><small>{step.state === 'active' || step.state === 'returned' ? `Current stage: ${step.copy}` : step.copy}</small></div></li>;
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

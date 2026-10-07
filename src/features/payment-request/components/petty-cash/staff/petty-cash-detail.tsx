'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchPettyCashRequest } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { getBetaAccount, readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

function money(value: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value); }
function date(value?: string) { if (!value) return 'Not recorded'; const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY'); }
function canView(record: PettyCashRecord, account: BetaAccount) { if (record.requesterId === account.id) return true; if (account.role === 'manager') return record.managerApproverId === account.id || record.financeReviewerId === account.id; if (account.role === 'director') return record.directorApproverId === account.id || record.financeReviewerId === account.id; return account.role === 'finance'; }

export function PettyCashDetail({ requestId }: { requestId: string }) {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [record, setRecord] = useState<PettyCashRecord | null>(null);
  const [checked, setChecked] = useState(() => !account);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    fetchPettyCashRequest(requestId)
      .then((value) => { if (!cancelled) setRecord(value); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'The request could not be loaded.'); })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [account, requestId]);
  if (!checked) return <State title="Loading Petty Cash request" copy="Reading the payment record…" />;
  if (!account) return <State title="Sign in required" copy="Sign in to view this Petty Cash request." />;
  if (!record) return <State title="Petty Cash request not found" copy={error || 'The request could not be found.'} />;
  if (!canView(record, account)) return <State title="Record access required" copy="This Petty Cash request is not available to your account." />;

  const manager = getBetaAccount(record.managerApproverId)?.name ?? record.managerApproverId;
  const location = record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur';
  const canCorrect = record.status === 'RETURNED_TO_STAFF' && record.requesterId === account.id;

  return <main className={`${styles.page} ${styles.detailPage}`}>
    <div className={styles.backRow}><Link href="/beta/payment-records/petty-cash">← Back to Petty Cash records</Link></div>
    <div className={styles.detailLayout}>
      <section className={styles.detailMain}>
        <header className={styles.detailHero}><div><p>Petty Cash record</p><h1>{record.requestNumber}</h1><span>Submitted by {record.requesterName} · {date(record.createdAt)}</span></div><div><small>Request total</small><strong>{money(record.totalAmount)}</strong><PettyCashStatusBadge status={record.status} /></div></header>
        <DetailSection title="Request overview"><dl className={styles.detailGrid}><Value label="Request date" value={date(record.requestDate)} /><Value label="Requester" value={record.requesterName} /><Value label="Position" value={record.requesterPosition} /><Value label="Office fund" value={`${location} Petty Cash`} /><Value label="Manager" value={manager} /><Value label="Contact" value={record.requesterContact} /></dl></DetailSection>
        <DetailSection title="Expense details"><div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Details / purpose</th><th>Account</th><th>Division</th><th>Proof</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{date(line.expenseDate)}</td><td>{line.supplier}</td><td>{line.details}</td><td>{line.accountType}</td><td>{line.division}</td><td><a href={line.proofLink} rel="noreferrer" target="_blank">Preview receipt</a></td><td><strong>{money(line.amount)}</strong></td></tr>)}</tbody></table></div><div className={styles.detailTotal}><span>Total requested</span><strong>{money(record.totalAmount)}</strong></div></DetailSection>
        {record.notes && <DetailSection title="Notes / purpose"><p className={styles.detailCopy}>{record.notes}</p></DetailSection>}
        {record.paymentReference && <DetailSection title="Finance payment"><dl className={styles.detailGrid}><Value label="Payment date" value={date(record.paymentDate)} /><Value label="Reference" value={record.paymentReference} /><div><dt>Payment proof</dt><dd>{record.paymentProofLink ? <a href={record.paymentProofLink} rel="noreferrer" target="_blank">Preview payment proof</a> : 'Not recorded'}</dd></div></dl></DetailSection>}
      </section>
      <aside className={styles.detailRail}>{record.status === 'RETURNED_TO_STAFF' && record.returnRemarks && <div className={styles.detailReturnNotice}><strong>Action required</strong><small>Manager&apos;s remarks</small><blockquote>{record.returnRemarks}</blockquote><p>Update the requested information and resubmit it to the Manager.</p>{canCorrect && <Link href={`/beta/payment-requests/petty-cash/new?amend=${encodeURIComponent(record.id)}`}>Start Corrections →</Link>}</div>}<Progress record={record} manager={manager} /></aside>
    </div>
  </main>;
}

function Progress({ record, manager }: { record: PettyCashRecord; manager: string }) {
  const requesterRole = record.requesterRole ?? 'staff';
  const submitted = { title: 'Request Submitted', copy: `Submitted by ${record.requesterName}`, time: record.createdAt, complete: true, active: false };
  const managerStep = { title: 'Manager Preview', copy: record.managerApprovedAt ? `Previewed by ${manager}` : 'Informational preview available; Finance is not blocked', time: record.managerApprovedAt, complete: Boolean(record.managerApprovedAt), active: false };
  const directorStep = { title: 'Director Preview', copy: record.directorApprovedAt ? `Previewed by ${getBetaAccount(record.directorApproverId)?.name ?? 'Director'}` : 'Informational preview available; Finance is not blocked', time: record.directorApprovedAt, complete: Boolean(record.directorApprovedAt), active: false };
  const independentTime = record.requesterReviewedAt ?? (record.financeReviewerRole === 'director' ? record.directorApprovedAt : record.financeReviewerRole === 'manager' ? record.managerApprovedAt : undefined);
  const independentStep = { title: 'Independent Preview', copy: independentTime ? `Previewed by ${record.financeReviewerId ? getBetaAccount(record.financeReviewerId)?.name ?? 'assigned reviewer' : 'assigned reviewer'}` : 'Informational preview available; Finance is not blocked', time: independentTime, complete: Boolean(independentTime), active: false };
  const financeComplete = Boolean(record.financeVerifiedAt || record.paidAt);
  const financeStep = { title: 'Finance Processing', copy: record.financeVerifiedAt ? `Payment verified by ${record.financeVerifiedById ? getBetaAccount(record.financeVerifiedById)?.name ?? 'Finance' : 'Finance'}` : 'Finance verification and payment', time: record.financeVerifiedAt, complete: financeComplete, active: ['PENDING_FINANCE_PAYMENT', 'FINANCE_VERIFIED'].includes(record.status) };
  const completed = { title: 'Completed', copy: record.paymentReference ? `Payment completed · Ref ${record.paymentReference}` : 'Payment completed and ledger updated', time: record.paidAt, complete: record.status === 'PAID', active: record.status === 'FINANCE_VERIFIED' };
  const steps = requesterRole === 'staff'
    ? [submitted, managerStep, directorStep, financeStep, completed]
    : requesterRole === 'manager'
      ? [submitted, directorStep, financeStep, completed]
      : requesterRole === 'director'
        ? [submitted, financeStep, completed]
        : [submitted, independentStep, financeStep, completed];
  const active = record.status === 'PAID' ? steps.length : Math.max(1, steps.findIndex((step) => step.active) + 1);
  return <section className={styles.progressPanel}><header><p>Payment progress</p><span>Step {active} of {steps.length}</span></header><ol>{steps.map((step) => { const returned = record.status === 'RETURNED_TO_STAFF' && step.title === 'Finance Processing'; const state = step.complete ? 'complete' : returned ? 'returned' : step.active ? 'active' : 'pending'; return <li className={styles.progressStep} data-state={state} key={step.title}><i>{step.complete ? '✓' : ''}</i><div><strong>{step.title}</strong><small>{step.copy}{step.time ? ` · ${date(step.time)}` : ''}</small></div></li>; })}</ol></section>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.detailSection}><h2>{title}</h2>{children}</section>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/payment-records">Back to Payment Records</Link></main>; }

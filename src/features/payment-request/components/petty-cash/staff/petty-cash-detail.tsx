'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchPettyCashRequest } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { getBetaAccount, readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { PettyCashPdfForm } from '../petty-cash-pdf-form';
import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

function money(value: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value); }
function date(value?: string) { if (!value) return 'Not recorded'; const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY'); }
function canView(record: PettyCashRecord, account: BetaAccount) { if (record.requesterId === account.id) return true; if (account.role === 'manager') return record.managerApproverId === account.id; if (account.role === 'director') return record.directorApproverId === account.id || record.financeReviewerId === account.id; return account.role === 'finance'; }

export function PettyCashDetail({ requestId }: { requestId: string }) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<PettyCashRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const session = readBetaSession(); setAccount(session); if (!session) { setChecked(true); return; } fetchPettyCashRequest(requestId).then(setRecord).catch((caught) => setError(caught instanceof Error ? caught.message : 'The request could not be loaded.')).finally(() => setChecked(true)); }, [requestId]);
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
        <DetailSection title="Petty Cash Form"><PettyCashPdfForm record={record} /></DetailSection>
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
  const submitted = { title: 'Request Submitted', copy: `Submitted by ${record.requesterName}`, time: record.createdAt };
  const managerStep = { title: 'Manager Review', copy: `Reviewed and approved by ${manager}`, time: record.managerApprovedAt };
  const directorStep = { title: 'Director Preview', copy: `Preview completed by ${getBetaAccount(record.directorApproverId)?.name ?? 'Director'}`, time: record.directorApprovedAt };
  const independentStep = { title: 'Independent Review', copy: `Reviewed by ${record.financeReviewerId ? getBetaAccount(record.financeReviewerId)?.name ?? 'assigned reviewer' : 'assigned reviewer'}`, time: record.requesterReviewedAt ?? record.directorApprovedAt };
  const financeStep = { title: 'Finance Processing', copy: `Payment processed by ${record.financeVerifiedById ? getBetaAccount(record.financeVerifiedById)?.name ?? 'Finance' : 'Finance'}`, time: record.financeVerifiedAt };
  const completed = { title: 'Completed', copy: record.paymentReference ? `Payment completed · Ref ${record.paymentReference}` : 'Payment completed and ledger updated', time: record.paidAt };
  const steps = requesterRole === 'staff'
    ? [submitted, managerStep, directorStep, financeStep, completed]
    : requesterRole === 'manager'
      ? [submitted, directorStep, financeStep, completed]
      : requesterRole === 'director'
        ? [submitted, financeStep, completed]
        : [submitted, independentStep, financeStep, completed];
  const stageTitle = record.status === 'PENDING_MANAGER_APPROVAL' ? 'Manager Review'
    : record.status === 'PENDING_DIRECTOR_APPROVAL' ? (requesterRole === 'finance' ? 'Independent Review' : 'Director Preview')
      : record.status === 'PENDING_FINANCE_REVIEW' ? 'Independent Review'
        : ['PENDING_FINANCE_PAYMENT', 'FINANCE_VERIFIED'].includes(record.status) ? 'Finance Processing'
          : record.status === 'PAID' ? 'Completed' : 'Request Submitted';
  const active = Math.max(1, steps.findIndex((step) => step.title === stageTitle) + 1);
  return <section className={styles.progressPanel}><header><p>Payment progress</p><span>Step {active} of {steps.length}</span></header><ol>{steps.map((step, index) => { const number = index + 1; const complete = number < active || (record.status === 'PAID' && number === steps.length); const returned = record.status === 'RETURNED_TO_STAFF' && number === active; const state = complete ? 'complete' : returned ? 'returned' : number === active ? 'active' : 'pending'; return <li className={styles.progressStep} data-state={state} key={step.title}><i>{complete ? '✓' : ''}</i><div><strong>{step.title}</strong><small>{step.copy}{step.time ? ` · ${date(step.time)}` : ''}</small></div></li>; })}</ol></section>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.detailSection}><h2>{title}</h2>{children}</section>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/payment-records">Back to Payment Records</Link></main>; }

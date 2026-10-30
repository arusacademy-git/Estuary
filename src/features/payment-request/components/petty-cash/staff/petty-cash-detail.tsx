'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchPettyCashRequest } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { getBetaAccount, readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import { PettyCashReconciliationForm } from './petty-cash-reconciliation';
import { PaymentRecordActionCard } from '@/features/payment-records/components/shared/payment-record-action-card';
import styles from '../petty-cash.module.css';

function money(value: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value); }
function date(value?: string) { if (!value) return 'Not recorded'; const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY'); }
function canView(record: PettyCashRecord, account: BetaAccount) { if (record.requesterId === account.id) return true; if (account.role === 'manager') return record.managerApproverId === account.id || record.financeReviewerId === account.id; if (account.role === 'director') return record.directorApproverId === account.id || record.financeReviewerId === account.id; return account.role === 'finance'; }

export function PettyCashDetail({ requestId, showRoleAction = false }: { requestId: string; showRoleAction?: boolean }) {
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
        <DetailSection title="Planned expenses"><div className={styles.tableWrap}><table className={styles.dataTable}><thead><tr><th>#</th><th>Details / purpose</th><th>Account</th><th>Division</th><th>Estimated amount</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.details}</td><td>{line.accountType}</td><td>{line.division}</td><td><strong>{money(line.amount)}</strong></td></tr>)}</tbody></table></div><div className={styles.detailTotal}><span>Total requested</span><strong>{money(record.totalAmount)}</strong></div></DetailSection>
        {record.notes && <DetailSection title="Notes / purpose"><p className={styles.detailCopy}>{record.notes}</p></DetailSection>}
        {record.paymentReference && <DetailSection title="Finance payment"><dl className={styles.detailGrid}><Value label="Payment date" value={date(record.paymentDate)} /><Value label="Reference" value={record.paymentReference} /><div><dt>Payment proof</dt><dd>{record.paymentProofLink ? <a href={record.paymentProofLink} rel="noreferrer" target="_blank">Preview payment proof</a> : 'Not recorded'}</dd></div></dl></DetailSection>}
        {record.status === 'PENDING_RECONCILIATION' && record.returnRemarks && <div className={styles.detailReturnNotice}><strong>Reconciliation returned for correction</strong><blockquote>{record.returnRemarks}</blockquote></div>}
        {record.status === 'PENDING_RECONCILIATION' && record.requesterId === account.id && <PettyCashReconciliationForm onSubmitted={setRecord} record={record} requesterId={account.id} />}
        {record.reconciliation && <DetailSection title="Reconciliation"><dl className={styles.detailGrid}><Value label="Actual spent" value={money(record.reconciliation.actualSpent)} /><Value label="Returned balance" value={money(record.reconciliation.returnedBalance)} /><Value label="Submitted" value={date(record.reconciliation.submittedAt)} /><Value label="No balance declaration" value={record.reconciliation.noBalanceRemark || 'Not applicable'} /></dl><div className={styles.reconciliationFiles}>{record.reconciliation.receipts.map((receipt) => <a href={receipt.dataUrl} key={receipt.id} rel="noreferrer" target="_blank">{receipt.fileName}</a>)}</div>{record.reconciliation.balanceReturnProof && <p><a href={record.reconciliation.balanceReturnProof.dataUrl} rel="noreferrer" target="_blank">Open balance return proof</a></p>}</DetailSection>}
      </section>
      <aside className={styles.detailRail}>{showRoleAction && <PaymentRecordActionCard account={account} directorApproverId={record.directorApproverId} managerApproverId={record.managerApproverId} paymentType="PC" reference={record.requestNumber} requestId={record.id} status={record.status} />}{record.status === 'RETURNED_TO_STAFF' && record.returnRemarks && <div className={styles.detailReturnNotice}><strong>Action required</strong><small>Manager&apos;s remarks</small><blockquote>{record.returnRemarks}</blockquote><p>Update the requested information and resubmit it to the Manager.</p>{canCorrect && <Link href={`/beta/payment-requests/petty-cash/new?amend=${encodeURIComponent(record.id)}`}>Start Corrections →</Link>}</div>}<Progress record={record} manager={manager} /></aside>
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
  const financeComplete = Boolean(record.paidAt);
  const financeStep = { title: 'Finance Processing', copy: record.financeVerifiedAt ? `Payment verified by ${record.financeVerifiedById ? getBetaAccount(record.financeVerifiedById)?.name ?? 'Finance' : 'Finance'}` : 'Finance verification and payment', time: record.financeVerifiedAt, complete: financeComplete, active: ['PENDING_FINANCE_REVIEW', 'PENDING_FINANCE_PAYMENT'].includes(record.status) };
  const transactionProofStep = { title: 'Payment transaction proof uploaded', copy: 'Finance uploaded the payment transaction proof for the requester', time: record.financeVerifiedAt, complete: ['PENDING_RECONCILIATION', 'PENDING_FINANCE_RECONCILIATION', 'RECONCILED'].includes(record.status), active: ['FINANCE_VERIFIED', 'TRANSACTION_PROOF_UPLOADED'].includes(record.status) };
  const reconciliation = { title: 'Reconciliation', copy: record.status === 'PENDING_RECONCILIATION' ? 'Upload purchase receipts and account for any unused balance' : record.status === 'PENDING_FINANCE_RECONCILIATION' ? 'Submitted; awaiting Finance verification' : 'Receipts and balance verified by Finance', time: record.reconciliation?.submittedAt, complete: record.status === 'RECONCILED', active: ['PENDING_RECONCILIATION', 'PENDING_FINANCE_RECONCILIATION'].includes(record.status) };
  const steps = requesterRole === 'staff'
    ? [submitted, managerStep, directorStep, financeStep, transactionProofStep, reconciliation]
    : requesterRole === 'manager'
      ? [submitted, directorStep, financeStep, transactionProofStep, reconciliation]
      : requesterRole === 'director'
        ? [submitted, financeStep, transactionProofStep, reconciliation]
        : [submitted, independentStep, financeStep, transactionProofStep, reconciliation];
  const active = record.status === 'RECONCILED' ? steps.length : Math.max(1, steps.findIndex((step) => step.active) + 1);
  return <section className={styles.progressPanel}><header><p>Payment progress</p><span>Step {active} of {steps.length}</span></header><ol>{steps.map((step) => { const returned = record.status === 'RETURNED_TO_STAFF' && step.title === 'Finance Processing'; const state = step.complete ? 'complete' : returned ? 'returned' : step.active ? 'active' : 'pending'; return <li className={styles.progressStep} data-state={state} key={step.title}><i>{step.complete ? '✓' : ''}</i><div><strong>{step.title}</strong><small>{step.copy}{step.time ? ` · ${date(step.time)}` : ''}</small></div></li>; })}</ol></section>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.detailSection}><h2>{title}</h2>{children}</section>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/payment-records">Back to Payment Records</Link></main>; }

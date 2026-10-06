'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { approvePettyCashByDirector, fetchPettyCashRequest, returnPettyCashByDirector } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { notifyPettyCashDirectorApproved, notifyPettyCashReturned } from '@/features/payment-request/notifications/petty-cash-notifications';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import { PettyCashPdfForm } from '../petty-cash-pdf-form';
import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
const date = (value?: string) => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('en-MY') : '—';

export function PettyCashDirectorReview({ requestId }: { requestId: string }) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<PettyCashRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setAccount(readBetaSession()); fetchPettyCashRequest(requestId).then(setRecord).catch((caught) => setError(caught instanceof Error ? caught.message : 'Request could not be loaded.')).finally(() => setChecked(true)); }, [requestId]);

  async function approve() {
    if (!account || !record) return;
    setSaving(true); setError(''); setSuccess('');
    try { const updated = await approvePettyCashByDirector(record.id, account.id); notifyPettyCashDirectorApproved(updated, account); setRecord(updated); setSuccess('The Petty Cash request was previewed and forwarded to Finance.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Request could not be approved.'); }
    finally { setSaving(false); }
  }

  async function returnRequest() {
    if (!account || !record || remarks.trim().length < 3) { setError('Enter correction remarks before returning the request.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try { const updated = await returnPettyCashByDirector(record.id, account.id, remarks.trim()); notifyPettyCashReturned(updated, account, 'Director'); setRecord(updated); setSuccess('The request was returned to the requester.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Request could not be returned.'); }
    finally { setSaving(false); }
  }

  if (!checked) return <State title="Loading Petty Cash request" copy="Reading the approval details…" />;
  if (!account || account.role !== 'director') return <State title="Director access required" copy="This page is available only to a Director." />;
  if (!record) return <State title="Petty Cash request not found" copy={error || 'The request could not be found.'} />;
  if (record.directorApproverId !== account.id) return <State title="Request assigned to another Director" copy="You cannot preview this Petty Cash request." />;
  const canAct = record.status === 'PENDING_DIRECTOR_APPROVAL';

  return <main className={styles.managerReviewPage}>
    <div className={styles.managerBackRow}><Link href="/beta/director/payment-requests/petty-cash">← Back to Petty Cash approvals</Link></div>
    {error && <div className={styles.error} role="alert">{error}</div>}{success && <div className={styles.managerSuccess} role="status">{success}</div>}
    <div className={styles.detailLayout}><div className={styles.detailMain}>
      <header className={styles.detailHero}><div><p>Director preview</p><h1>{record.requestNumber}</h1><span>{record.requesterName} · {date(record.requestDate)}</span></div><div><small>Total requested</small><strong>{money(record.totalAmount)}</strong><PettyCashStatusBadge status={record.status} /></div></header>
      <section className={styles.detailSection}><h2>Request overview</h2><dl className={styles.managerReviewGrid}><Value label="Requester" value={record.requesterName} /><Value label="Position" value={record.requesterPosition} /><Value label="Contact" value={record.requesterContact} /><Value label="Manager reviewed" value={date(record.managerApprovedAt)} /></dl></section>
      <section className={styles.detailSection}><h2>Petty Cash Form</h2><PettyCashPdfForm record={record} /></section>
      <section className={styles.detailSection}><h2>Expense breakdown</h2><div className={styles.managerReviewTable}><table><thead><tr><th>#</th><th>Supplier</th><th>Purpose</th><th>Receipt</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.supplier}</td><td>{line.details}</td><td><a href={line.proofLink} rel="noreferrer" target="_blank">Open proof ↗</a></td><td><strong>{money(line.amount)}</strong></td></tr>)}</tbody></table></div></section>
    </div><aside className={styles.detailRail}><div className={styles.managerDecisionPanel}><p>Director action</p><h2>{canAct ? 'Preview Petty Cash request' : 'Preview recorded'}</h2>{canAct && <><span>Preview the request before Finance processes payment.</span><button className={styles.managerApproveButton} disabled={saving} onClick={approve} type="button">Preview and send to Finance →</button><div className={styles.managerActionDivider}><span>or return with notes</span></div><label><span>Correction remarks</span><textarea rows={4} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label><button className={styles.managerReturnButton} disabled={saving || remarks.trim().length < 3} onClick={returnRequest} type="button">Return to requester</button></>}</div></aside></div>
  </main>;
}

function Value({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/director/payment-requests/petty-cash">Back to Petty Cash approvals</Link></main>; }

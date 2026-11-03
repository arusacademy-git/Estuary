'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { approveTravelAllowanceByDirector, fetchTravelAllowance, returnTravelAllowanceByDirector } from '@/data/payment-requests/travel-allowance/api';
import { notifyTravelAllowanceDirectorApproved, notifyTravelAllowanceReturned } from '@/features/payment-request/notifications/travel-allowance-notifications';
import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import { TravelAllowanceGroupedTable } from '../travel-allowance-grouped-table';
import { standardPaymentStatusLabel } from '@/domain/payment-requests/standard-payment-status';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from '../travel-allowance-workflow.module.css';

const baseHref = '/beta/director/payment-requests/travel-allowances';
function displayDate(value: string) { const parsed = new Date(`${value}T12:00:00`); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY'); }
function statusLabel(status: TravelAllowanceRecord['status']) { return standardPaymentStatusLabel(status); }

export function TravelAllowanceDirectorReview({ requestId }: { requestId: string }) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<TravelAllowanceRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const session = readBetaSession(); setAccount(session);
    if (!session || session.role !== 'director') { setChecked(true); return; }
    fetchTravelAllowance(requestId).then(setRecord).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Request could not be loaded.')).finally(() => setChecked(true));
  }, [requestId]);

  async function approve() {
    if (!record || !account) return;
    setError(''); setSuccess(''); setIsSaving(true);
    try { const updated = await approveTravelAllowanceByDirector(record.id, account.id); notifyTravelAllowanceDirectorApproved(updated, account); setRecord(updated); setSuccess('The Travel Allowance was approved and forwarded to Finance.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The request could not be approved.'); }
    finally { setIsSaving(false); }
  }
  async function returnToRequester() {
    if (!record || !account) return;
    setError(''); setSuccess(''); setIsSaving(true);
    try { const updated = await returnTravelAllowanceByDirector(record.id, account.id, remarks); notifyTravelAllowanceReturned(updated, account, 'Director'); setRecord(updated); setSuccess('The Travel Allowance was returned to the requester for correction.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The request could not be returned.'); }
    finally { setIsSaving(false); }
  }

  if (!checked) return <State title="Loading Travel Allowance" copy="Reading the request from the database…" />;
  if (!account || account.role !== 'director') return <State title="Director access required" copy="Sign in using a Director account." />;
  if (!record) return <State title="Travel Allowance not found" copy={error || 'The request could not be found.'} />;
  if (record.projectDirectorId !== account.id) return <State title="Assigned to another Director" copy="You cannot approve this Travel Allowance." />;

  const canAct = record.status === 'PENDING_DIRECTOR_APPROVAL';
  return <main className={styles.page}>
    <div className={styles.back}><Link href={baseHref}>← Back to Travel Allowances</Link></div>
    {error && <div className={styles.error} role="alert">{error}</div>}{success && <div className={styles.success} role="status">{success}</div>}
    <div className={styles.detailLayout}>
      <section className={styles.detailMain}>
        <header className={styles.compactRequestHeader}><p><b>TA</b> Travel Allowance request</p><h1>Request overview</h1><span>Submitted on {displayDate(record.requestDate)} by {record.requesterName}</span></header>
        <InfoSection title="Request details"><dl className={styles.infoGrid}><Value label="Requester" value={record.requesterName} /><Value label="Requester role" value={record.requesterRole === 'manager' ? 'Operations Manager' : 'Staff'} /><Value label="Programme" value={record.lines[0]?.projectName ?? '—'} /><Value label="Contact" value={record.contact} /><Value label="Payment target" value={displayDate(record.paymentDueDate)} /><Value label="Supporting documents" value={String(record.supportingDocuments.length)} /><Value label="Remarks" value={record.remarks || '—'} /></dl></InfoSection>
        <InfoSection title={`Request breakdown · ${record.lines.length} entries`}><TravelAllowanceGroupedTable lines={record.lines} /></InfoSection>
        {(record.remarks || record.supportingDocuments.length > 0) && <InfoSection title="Supporting Information">{record.remarks && <p className={styles.longText}>{record.remarks}</p>}<div className={styles.documents}>{record.supportingDocuments.map((document) => <a download={document.fileName} href={document.dataUrl} key={document.id}>{document.fileName}</a>)}</div></InfoSection>}
      </section>
      <aside className={styles.rail}><section className={styles.actionCard}><p>Director action</p><h2>{canAct ? 'Approve or return' : 'Action recorded'}</h2>{canAct ? <><span>Approve this allowance for Finance verification, or return it with correction notes.</span><button className={styles.primary} disabled={isSaving} type="button" onClick={approve}>Approve and forward to Finance →</button><div className={styles.divider}>or return with notes</div><label><span>Reason for returning</span><textarea rows={4} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label><button className={styles.returnButton} disabled={isSaving || remarks.trim().length < 5} type="button" onClick={returnToRequester}>Return to requester</button></> : <span>This request is now {statusLabel(record.status)}.</span>}</section><Progress record={record} /></aside>
    </div>
  </main>;
}

function Progress({ record }: { record: TravelAllowanceRecord }) { const steps = record.requesterRole === 'manager' ? ['Request Submitted by Manager', 'Director Review', 'Finance Verification', 'Completed'] : ['Request Submitted', 'Manager Review', 'Director Review', 'Finance Verification', 'Completed']; const active = record.status === 'PENDING_MANAGER_REVIEW' ? 2 : record.status === 'PENDING_DIRECTOR_APPROVAL' ? (record.requesterRole === 'manager' ? 2 : 3) : record.status === 'PENDING_FINANCE_VERIFICATION' ? (record.requesterRole === 'manager' ? 3 : 4) : record.status === 'COMPLETED' ? steps.length : Math.min(2, steps.length); return <section className={styles.progress}><header><p>Payment progress</p><span>Step {active} of {steps.length}</span></header><ol>{steps.map((title, index) => { const number = index + 1; const state = number < active || (record.status === 'COMPLETED' && number === steps.length) ? 'complete' : number === active ? 'active' : 'pending'; return <li data-state={state} key={title}><i>{state === 'complete' ? '✓' : number}</i><div><strong>{title}</strong><small>{state === 'active' ? 'Current stage' : state === 'complete' ? 'Completed' : 'Waiting'}</small></div></li>; })}</ol></section>; }
function InfoSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.infoSection}><h2>{title}</h2>{children}</section>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.state}><h1>{title}</h1><p>{copy}</p><Link href={baseHref}>Back to Travel Allowances</Link></main>; }

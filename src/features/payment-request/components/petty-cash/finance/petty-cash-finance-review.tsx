'use client';

import Link from 'next/link';
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';

import { fetchPettyCashRequest, markPettyCashPaid, returnPettyCashByFinance, reviewPettyCashByFinancePeer, verifyPettyCashByFinance } from '@/data/payment-requests/petty-cash/api';
import { notifyPettyCashFinancePeerReviewed, notifyPettyCashFinanceVerified, notifyPettyCashPaid, notifyPettyCashReturned } from '@/features/payment-request/notifications/petty-cash-notifications';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import { PettyCashPdfForm } from '../petty-cash-pdf-form';
import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const MAX_RECEIPT_SIZE = 2.5 * 1024 * 1024;
const ACCEPTED_RECEIPT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
const location = (record: PettyCashRecord) => record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur';
function date(value?: string) { if (!value) return '—'; const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed); }
function readReceipt(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The receipt could not be read.')); reader.onerror = () => reject(new Error('The receipt could not be read.')); reader.readAsDataURL(file); }); }

export function PettyCashFinanceReview({ requestId }: { requestId: string }) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<PettyCashRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProofLink, setPaymentProofLink] = useState('');
  const [paymentProofName, setPaymentProofName] = useState('');
  const [notes, setNotes] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccount(readBetaSession());
    fetchPettyCashRequest(requestId).then((next) => {
      setRecord(next); setPaymentDate(next.paymentDate ?? today()); setPaymentReference(next.paymentReference ?? ''); setPaymentProofLink(next.paymentProofLink ?? '');
    }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Request could not be loaded.')).finally(() => setChecked(true));
  }, [requestId]);

  async function verify() {
    if (!account || !record) return;
    setSaving(true); setError(''); setSuccess('');
    try { const updated = await verifyPettyCashByFinance(record.id, { financeId: account.id, paymentDate, paymentReference: paymentReference.trim(), paymentProofLink: paymentProofLink.trim(), notes: notes.trim() }); notifyPettyCashFinanceVerified(updated, account); setRecord(updated); setSuccess('Payment information was verified. Review it once more before marking the request as paid.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Payment could not be verified.'); }
    finally { setSaving(false); }
  }

  async function reviewFinanceRequest() {
    if (!account || !record) return;
    setSaving(true); setError(''); setSuccess('');
    try { const updated = await reviewPettyCashByFinancePeer(record.id, account.id); notifyPettyCashFinancePeerReviewed(updated, account); setRecord(updated); setSuccess('The independent review was recorded and the request was forwarded for Finance processing.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The request could not be reviewed.'); }
    finally { setSaving(false); }
  }

  async function selectReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) { setError('Upload the payment receipt as a PDF, JPG or PNG file.'); event.target.value = ''; return; }
    if (file.size > MAX_RECEIPT_SIZE) { setError('The payment receipt must be 2.5 MB or smaller.'); event.target.value = ''; return; }
    try { setPaymentProofLink(await readReceipt(file)); setPaymentProofName(file.name); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The receipt could not be uploaded.'); }
  }

  async function markPaid() {
    if (!account || !record || !window.confirm(`Mark ${record.requestNumber} as paid and create the Money Out transaction?`)) return;
    setSaving(true); setError(''); setSuccess('');
    try { const updated = await markPettyCashPaid(record.id, account.id); notifyPettyCashPaid(updated, account); setRecord(updated); setSuccess('Payment completed. The Money Out transaction and updated balance were created automatically.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Request could not be marked paid.'); }
    finally { setSaving(false); }
  }

  async function returnRequest() {
    if (!account || !record) return;
    if (remarks.trim().length < 3) { setError('Enter correction remarks before returning the request.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try { const updated = await returnPettyCashByFinance(record.id, account.id, remarks.trim()); notifyPettyCashReturned(updated, account, 'Finance'); setRecord(updated); setSuccess('The Petty Cash request was returned to Staff for correction.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Request could not be returned.'); }
    finally { setSaving(false); }
  }

  if (!checked) return <StatePage title="Loading request" copy="Reading the Petty Cash payment details…" />;
  if (!account || account.role !== 'finance') return <StatePage title="Finance access required" copy="This page is available only to Finance." />;
  if (!record) return <StatePage title="Petty Cash request not found" copy={error || 'The request could not be found.'} />;

  const canVerify = record.status === 'PENDING_FINANCE_PAYMENT';
  const canComplete = record.status === 'FINANCE_VERIFIED';
  const canPeerReview = record.status === 'PENDING_FINANCE_REVIEW' && record.financeReviewerId === account.id && record.requesterId !== account.id;

  return <main className={styles.managerReviewPage}>
    <div className={styles.managerBackRow}><Link href="/beta/finance/payment-requests/petty-cash">← Back to Petty Cash payments</Link></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {success && <div className={styles.managerSuccess} role="status">{success}</div>}
    <div className={styles.detailLayout}>
      <div className={styles.detailMain}>
        <header className={styles.detailHero}><div><div className={styles.managerReviewEyebrow}><p>Finance payment</p><PettyCashStatusBadge status={record.status} /></div><h1>{record.requestNumber}</h1><span>{record.requesterName} · {location(record)}</span></div><div><small>Total requested</small><strong>{money(record.totalAmount)}</strong></div></header>
        {record.status === 'RETURNED_TO_STAFF' && record.returnRemarks && <div className={styles.detailReturnNotice}><strong>Returned for correction</strong><blockquote>{record.returnRemarks}</blockquote><p>{date(record.returnedAt)}</p></div>}
        <DetailSection title="Request & approval overview"><dl className={styles.managerReviewGrid}><Value label="Request date" value={date(record.requestDate)} /><Value label="Staff" value={record.requesterName} /><Value label="Position" value={record.requesterPosition} /><Value label="Location" value={location(record)} /><Value label="Manager approved" value={date(record.managerApprovedAt)} /><Value label="Contact" value={record.requesterContact} /></dl></DetailSection>
        <DetailSection title="Petty Cash Form"><PettyCashPdfForm record={record} /></DetailSection>
        <DetailSection title="Expense breakdown"><div className={styles.managerReviewTable}><table><thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Details / purpose</th><th>Account category</th><th>Division</th><th>Receipt</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{date(line.expenseDate)}</td><td>{line.supplier}</td><td>{line.details}</td><td>{line.accountType}</td><td>{line.division}</td><td>{line.proofLink ? <a href={line.proofLink} rel="noreferrer" target="_blank">Open proof ↗</a> : '—'}</td><td><strong>{money(line.amount)}</strong></td></tr>)}</tbody></table></div><div className={styles.managerReviewTotal}><span>Total requested</span><strong>{money(record.totalAmount)}</strong></div></DetailSection>
        <DetailSection title="Notes / purpose justification"><p className={styles.detailCopy}>{record.notes?.trim() || 'No additional notes were provided.'}</p></DetailSection>
        {(record.paymentReference || record.paymentProofLink) && <DetailSection title="Payment information"><dl className={styles.managerReviewGrid}><Value label="Payment date" value={date(record.paymentDate)} /><Value label="Payment reference" value={record.paymentReference || '—'} /><div><dt>Payment proof</dt><dd>{record.paymentProofLink ? <a href={record.paymentProofLink} rel="noreferrer" target="_blank">Open payment proof ↗</a> : '—'}</dd></div><Value label="Verified" value={date(record.financeVerifiedAt)} /></dl></DetailSection>}
      </div>

      <div className={styles.detailRail}>
        <aside className={styles.managerDecisionPanel}><p>Finance action</p><h2>{canPeerReview ? 'Independently review request' : canVerify ? 'Verify payment information' : canComplete ? 'Complete payment' : record.status === 'PAID' ? 'Payment completed' : 'Processing recorded'}</h2>
          {canPeerReview && <><span>This request was submitted by Finance. Confirm it independently before Finance payment processing begins.</span><button className={styles.managerApproveButton} disabled={saving} onClick={reviewFinanceRequest} type="button">Review and forward to processing <b aria-hidden="true">→</b></button></>}
          {canVerify && <><span>Record the payment information and upload the receipt before completing the Petty Cash payment.</span><label><span>Payment date</span><input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label><label><span>Payment reference</span><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Bank or transaction reference" /></label><label><span>Upload payment receipt</span><div className={styles.financeReceiptUpload}><input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" type="file" onChange={selectReceipt} /><small>PDF, JPG or PNG · maximum 2.5 MB</small>{paymentProofLink && <div><strong>{paymentProofName || 'Payment receipt attached'}</strong><a href={paymentProofLink} rel="noreferrer" target="_blank">Preview</a><button type="button" onClick={() => { setPaymentProofLink(''); setPaymentProofName(''); }}>Remove</button></div>}</div></label><label><span>Finance notes</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional payment notes" /></label><button className={styles.managerApproveButton} disabled={saving || !paymentDate || !paymentReference.trim() || !paymentProofLink.trim()} onClick={verify} type="button">Verify payment information <b aria-hidden="true">→</b></button></>}
          {canComplete && <><span>Payment information is verified. Marking this request as paid will automatically create the Money Out transaction and update the location balance.</span><div className={styles.managerPaymentSummary}><span>Reference</span><strong>{record.paymentReference}</strong><span>Payment date</span><strong>{date(record.paymentDate)}</strong></div><button className={styles.managerApproveButton} disabled={saving} onClick={markPaid} type="button">Mark as Paid <b aria-hidden="true">→</b></button></>}
          {record.status === 'PAID' && <><span>This payment is complete and appears in the Petty Cash ledger.</span><small>Paid {date(record.paidAt)}</small></>}
          {record.status === 'RETURNED_TO_STAFF' && <><span>This request was returned to Staff.</span><div className={styles.managerReturnedReason}><strong>Return reason</strong><p>{record.returnRemarks}</p></div></>}
          {(canPeerReview || canVerify || canComplete) && <><div className={styles.managerActionDivider}><span>or return with notes</span></div><label><span>Correction remarks</span><textarea rows={4} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Explain what the requester must correct" /></label><button className={styles.managerReturnButton} disabled={saving || remarks.trim().length < 3} onClick={returnRequest} type="button">Return to requester</button></>}
        </aside>
        <WorkflowProgress record={record} />
      </div>
    </div>
  </main>;
}

function WorkflowProgress({ record }: { record: PettyCashRecord }) {
  const requesterRole = record.requesterRole ?? 'staff';
  const submitted = { title: 'Request Submitted', copy: `Submitted by ${record.requesterName}` };
  const manager = { title: 'Manager Review', copy: record.managerApprovedAt ? `Reviewed ${date(record.managerApprovedAt)}` : 'Manager review' };
  const director = { title: 'Director Preview', copy: record.directorApprovedAt ? `Previewed ${date(record.directorApprovedAt)}` : 'Director preview' };
  const independent = { title: 'Independent Review', copy: record.requesterReviewedAt ? `Reviewed ${date(record.requesterReviewedAt)}` : 'Independent reviewer' };
  const finance = { title: 'Finance Processing', copy: record.status === 'FINANCE_VERIFIED' ? 'Payment information verified' : 'Finance verification and payment' };
  const completed = { title: 'Completed', copy: 'Payment completed and ledger updated' };
  const steps = requesterRole === 'staff' ? [submitted, manager, director, finance, completed] : requesterRole === 'manager' ? [submitted, director, finance, completed] : requesterRole === 'director' ? [submitted, finance, completed] : [submitted, independent, finance, completed];
  const activeTitle = record.status === 'PENDING_MANAGER_APPROVAL' ? 'Manager Review' : record.status === 'PENDING_DIRECTOR_APPROVAL' ? (requesterRole === 'finance' ? 'Independent Review' : 'Director Preview') : record.status === 'PENDING_FINANCE_REVIEW' ? 'Independent Review' : ['PENDING_FINANCE_PAYMENT', 'FINANCE_VERIFIED'].includes(record.status) ? 'Finance Processing' : record.status === 'PAID' ? 'Completed' : 'Request Submitted';
  const activeStep = Math.max(1, steps.findIndex((step) => step.title === activeTitle) + 1);
  return <aside className={styles.progressPanel}><header><p>Payment progress</p><span>Step {activeStep} of {steps.length}</span></header><ol>{steps.map((step, index) => { const number = index + 1; const state = record.status === 'RETURNED_TO_STAFF' && number === activeStep ? 'returned' : number < activeStep || (record.status === 'PAID' && number === steps.length) ? 'complete' : number === activeStep ? 'active' : 'pending'; return <li className={styles.progressStep} data-state={state} key={step.title}><i aria-hidden="true">{state === 'complete' ? '✓' : ''}</i><div><strong>{step.title}</strong><small>{state === 'active' || state === 'returned' ? `Current stage: ${step.copy}` : step.copy}</small></div></li>; })}</ol></aside>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) { return <section className={styles.detailSection}><h2>{title}</h2>{children}</section>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function StatePage({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/finance/payment-requests/petty-cash">Back to Petty Cash payments</Link></main>; }

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchInvoicePayment, returnInvoicePaymentByDirector, reviewInvoicePaymentByDirector } from '@/data/payment-requests/invoice-payment/api';
import type { InvoicePaymentRequestRecord, PaymentRequestDocument } from '@/domain/payment-requests/invoice-payment/types';
import { getBetaAccount, readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from './invoice-payment-director.module.css';
import {
    notifyFinanceInvoicePaymentApprovedByDirector,
    notifyStaffInvoicePaymentReturned,
} from '@/features/payment-request/notifications/invoice-payment-notifications';

function money(value: number) {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}
function date(value: string) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}
function downloadDocument(document: PaymentRequestDocument) {
    const link = window.document.createElement('a');
    link.href = document.dataUrl;
    link.download = document.fileName;
    link.click();
}

export function InvoicePaymentDirectorReview({ requestId }: { requestId: string }) {
    const [account, setAccount] = useState<BetaAccount | null>(null);
    const [record, setRecord] = useState<InvoicePaymentRequestRecord | null>(null);
    const [checked, setChecked] = useState(false);
    const [returnRemarks, setReturnRemarks] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setAccount(readBetaSession());
        fetchInvoicePayment(requestId).then(setRecord).finally(() => setChecked(true));
    }, [requestId]);

    async function approve() {
        if (!record || !account) return;
        setError(''); setIsSaving(true);
        try {
            const updated = await reviewInvoicePaymentByDirector(record.id, account.id);
            notifyFinanceInvoicePaymentApprovedByDirector(updated, account);
            setRecord(updated); setSuccess('The Invoice Payment was approved and forwarded to Finance.');
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'The request could not be approved.');
        } finally { setIsSaving(false); }
    }
    async function returnToStaff() {
        if (!record || !account) return;
        setError(''); setIsSaving(true);
        try {
            const updated = await returnInvoicePaymentByDirector(record.id, account.id, returnRemarks);
            notifyStaffInvoicePaymentReturned(updated, account, 'Director');
            setRecord(updated); setSuccess('The Invoice Payment was returned to Staff for correction.');
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'The request could not be returned.');
        } finally { setIsSaving(false); }
    }

    if (!checked) return <StatePage title="Loading request" copy="Reading the Invoice Payment details…" />;
    if (!account || account.role !== 'director') return <StatePage title="Director access required" copy="This page is available only to a Director." />;
    if (!record) return <StatePage title="Invoice Payment not found" copy="The local request could not be found in this browser." />;
    if (record.directorApproverId !== account.id) return <StatePage title="Request assigned to another Director" copy="You cannot review this Invoice Payment." />;

    const canAct = record.status === 'PENDING_DIRECTOR_REVIEW';
    const managerName = getBetaAccount(record.managerApproverId)?.name ?? record.managerApproverId;
    const portion = record.paymentPortion === 'UPFRONT_50' ? '50% upfront payment' : record.paymentPortion === 'BALANCE_50' ? '50% balance payment' : record.paymentPortion === 'FULL' ? 'Full payment' : record.paymentPortionOther ?? 'Other';

    return (
        <main className={styles.page}>
            <div className={styles.backRow}><Link href="/beta/director/payment-requests/invoice-payments">← Back to Invoice Payments</Link></div>
            {error && <div className={styles.errorNotice} role="alert">{error}</div>}
            {success && <div className={styles.successNotice} role="status">{success}</div>}
            <div className={styles.detailLayout}>
                <div className={styles.detailMain}>
                    <header className={styles.detailHero}><div><div className={styles.detailEyebrow}><span>Director review</span><span className={styles.detailStatusBadge} data-status={record.status}>{canAct ? 'Pending Director Review' : record.status === 'PENDING_FINANCE_REVIEW' ? 'Pending Finance Verification' : record.status === 'COMPLETED' ? 'Completed' : 'Returned to Staff'}</span></div><h1>{record.requestNumber}</h1><p>{record.title}</p></div><div className={styles.detailTotal}><small>Total requested</small><strong>{money(record.totalAmount)}</strong></div></header>
                    <DetailSection title="Request Overview"><dl className={styles.detailGrid}><Value label="Request date" value={date(record.requestDate)} /><Value label="Staff" value={record.staffName} /><Value label="Project" value={record.projectName} /><Value label="Manager reviewer" value={managerName} /></dl></DetailSection>
                    <DetailSection title="Invoice Details"><dl className={styles.detailGrid}><Value label="Vendor" value={record.vendorName} /><Value label="Transfer type" value={record.transferType === 'GIRO' ? 'GIRO transfer — next working day' : 'Instant transfer'} /><Value label="Payment portion" value={portion} /><div><dt>E-invoice link</dt><dd><a href={record.eInvoiceLink} target="_blank" rel="noreferrer">Open e-invoice ↗</a></dd></div></dl><div className={styles.longValue}><span>Purpose</span><p>{record.purpose}</p></div>{record.remarks && <div className={styles.longValue}><span>Additional remarks</span><p>{record.remarks}</p></div>}</DetailSection>
                    <DetailSection title="Payment Amount"><dl className={styles.detailGrid}><Value label="Currency" value="MYR" /><Value label="Invoice total" value={money(record.invoiceTotal)} /><Value label="Tax / SST" value={money(record.taxAmount)} /><Value label="Amount requested" value={money(record.requestedAmount)} /></dl></DetailSection>
                    <DetailSection title="Supporting Documents"><div className={styles.documents}>{record.supportingDocuments.map((document) => <div key={document.id}><span aria-hidden="true" className={styles.documentIcon}>▧</span><div><strong>{document.fileName}</strong><span>{Math.max(1, Math.round(document.size / 1024))} KB</span></div><button type="button" onClick={() => downloadDocument(document)}>Download</button></div>)}</div></DetailSection>
                </div>
                <div className={styles.rightRail}>
                    <aside className={styles.actionPanel}><p>Director action</p><h2>{canAct ? 'Approve and forward' : 'Review recorded'}</h2>{canAct ? <><span>Confirm the request is appropriate and forward it to Finance. No signature is required.</span><button className={styles.primaryAction} disabled={isSaving} type="button" onClick={approve}>Approve and forward to Finance <b aria-hidden="true">→</b></button><div className={styles.actionDivider}><span>or return with notes</span></div><label><span>Reason for returning</span><textarea rows={4} placeholder="Explain what Staff needs to correct" value={returnRemarks} onChange={(event) => setReturnRemarks(event.target.value)} /></label><button className={styles.returnAction} disabled={isSaving || !returnRemarks.trim()} type="button" onClick={returnToStaff}>Return to Staff</button></> : <><span>This request is now: <strong>{record.status.replaceAll('_', ' ')}</strong>.</span>{record.directorReviewedAt && <small>Reviewed {date(record.directorReviewedAt)}</small>}{record.directorReturnRemarks && <div className={styles.returnedReason}><strong>Return reason</strong><p>{record.directorReturnRemarks}</p></div>}</>}</aside>
                    <Progress record={record} managerName={managerName} />
                </div>
            </div>
        </main>
    );
}

function Progress({ record, managerName }: { record: InvoicePaymentRequestRecord; managerName: string }) {
    const active = record.status === 'PENDING_DIRECTOR_REVIEW' ? 3 : record.status === 'PENDING_FINANCE_REVIEW' ? 4 : record.status === 'COMPLETED' ? 5 : 3;
    const steps = [{ title: 'Request Submitted', copy: `Submitted by ${record.staffName}` }, { title: 'Manager Review', copy: `Approved by ${managerName}` }, { title: 'Director Review', copy: 'Director verification' }, { title: 'Finance Verification', copy: 'Payment checks and confirmation' }, { title: 'Completed', copy: 'Request verified and closed' }];
    return <aside className={styles.progressPanel}><header><p>Payment progress</p><span>Step {active} of 5</span></header><ol>{steps.map((step, index) => { const number = index + 1; const state = number < active || (record.status === 'COMPLETED' && number === 5) ? 'complete' : number === active ? 'active' : 'pending'; return <li className={styles.progressStep} data-state={state} key={step.title}><i aria-hidden="true">{state === 'complete' ? '✓' : ''}</i><div><strong>{step.title}</strong><small>{state === 'active' ? `Current stage: ${step.copy}` : step.copy}</small></div></li>; })}</ol></aside>;
}
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.detailSection}><h2>{title}</h2>{children}</section>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function StatePage({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/director/payment-requests/invoice-payments">Back to Invoice Payments</Link></main>; }

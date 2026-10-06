'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { fetchInvoicePayment, returnInvoicePaymentByManager, reviewInvoicePaymentByManager } from '@/data/payment-requests/invoice-payment/api';
import type {
    InvoicePaymentRequestRecord,
    PaymentRequestDocument,
} from '@/domain/payment-requests/invoice-payment/types';
import {
    getBetaAccount,
    readBetaSession,
    type BetaAccount,
} from '@/lib/auth/beta-accounts';

import styles from './invoice-payment-manager.module.css';
import {
    notifyDirectorInvoicePaymentApprovedByManager,
    notifyStaffInvoicePaymentReturned,
} from '@/features/payment-request/notifications/invoice-payment-notifications';

function money(amount: number) {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(amount);
}

function date(value: string) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? value
        : new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function downloadDocument(document: PaymentRequestDocument) {
    const link = window.document.createElement('a');
    link.href = document.dataUrl;
    link.download = document.fileName;
    link.style.display = 'none';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
}

export function InvoicePaymentManagerReview({ requestId }: { requestId: string }) {
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

    async function forwardToDirector() {
        if (!record || !account) return;
        setError('');
        setIsSaving(true);
        try {
            const updated = await reviewInvoicePaymentByManager(record.id, account.id);
            notifyDirectorInvoicePaymentApprovedByManager(updated, account);
            setRecord(updated);
            setSuccess('The Invoice Payment was reviewed and forwarded to the Director.');
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'The request could not be forwarded.');
        } finally {
            setIsSaving(false);
        }
    }

    async function returnToStaff() {
        if (!record || !account) return;
        setError('');
        setIsSaving(true);
        try {
            const updated = await returnInvoicePaymentByManager(record.id, account.id, returnRemarks);
            notifyStaffInvoicePaymentReturned(updated, account, 'Manager');
            setRecord(updated);
            setSuccess('The Invoice Payment was returned to Staff for correction.');
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'The request could not be returned.');
        } finally {
            setIsSaving(false);
        }
    }

    if (!checked) return <StatePage title="Loading request" copy="Reading the Invoice Payment details…" />;
    if (!account || account.role !== 'manager') return <StatePage title="Manager access required" copy="This page is available only to a Manager." />;
    if (!record) return <StatePage title="Invoice Payment not found" copy="The local request could not be found in this browser." />;
    if (record.managerApproverId !== account.id) return <StatePage title="Request assigned to another Manager" copy="You cannot review this Invoice Payment." />;

    const canAct = record.status === 'PENDING_MANAGER_REVIEW';
    const directorName = getBetaAccount(record.directorApproverId)?.name ?? record.directorApproverId;

    return (
        <main className={styles.page}>
            <div className={styles.backRow}><Link href="/beta/project-manager/payment-requests/invoice-payments">← Back to Invoice Payments</Link></div>
            {error && <div className={styles.errorNotice} role="alert">{error}</div>}
            {success && <div className={styles.successNotice} role="status">{success}</div>}

            <div className={styles.detailLayout}>
                <div className={styles.detailMain}>
                    <header className={styles.detailHero}>
                        <div>
                            <div className={styles.detailEyebrow}>
                                <span>Manager review</span>
                                <span className={styles.detailStatusBadge} data-status={record.status}>
                                    {record.status === 'PENDING_MANAGER_REVIEW'
                                        ? 'Pending Manager Review'
                                        : record.status === 'PENDING_DIRECTOR_REVIEW'
                                            ? 'Pending Director Review'
                                            : record.status === 'PENDING_FINANCE_REVIEW'
                                                ? 'Pending Finance Verification'
                                                : record.status === 'COMPLETED'
                                                    ? 'Completed'
                                                    : 'Returned to Staff'}
                                </span>
                            </div>
                            <h1>{record.requestNumber}</h1>
                            <p>{record.title}</p>
                        </div>
                        <div className={styles.detailTotal}>
                            <small>Total requested</small>
                            <strong>{money(record.totalAmount)}</strong>
                        </div>
                    </header>
                    <DetailSection title="Request Overview">
                        <dl className={styles.detailGrid}><Value label="Request date" value={date(record.requestDate)} /><Value label="Staff" value={record.staffName} /><Value label="Project" value={record.projectName} /><Value label="Director reviewer" value={directorName} /></dl>
                    </DetailSection>
                    <DetailSection title="Invoice Details">
                        <dl className={styles.detailGrid}><Value label="Vendor" value={record.vendorName} /><Value label="Transfer type" value={record.transferType === 'GIRO' ? 'GIRO transfer — next working day' : 'Instant transfer'} /><Value label="Payment portion" value={record.paymentPortion === 'UPFRONT_50' ? '50% upfront payment' : record.paymentPortion === 'BALANCE_50' ? '50% balance payment' : record.paymentPortion === 'FULL' ? 'Full payment' : record.paymentPortionOther ?? 'Other'} /><div><dt>E-invoice link</dt><dd><a href={record.eInvoiceLink} target="_blank" rel="noreferrer">Open e-invoice ↗</a></dd></div></dl>
                        <div className={styles.longValue}><span>Purpose</span><p>{record.purpose}</p></div>
                        {record.remarks && <div className={styles.longValue}><span>Additional remarks</span><p>{record.remarks}</p></div>}
                    </DetailSection>
                    <DetailSection title="Payment Amount">
                        <dl className={styles.detailGrid}>
                            <Value label="Currency" value="MYR" />
                            <Value label="Invoice total" value={money(record.invoiceTotal)} />
                            <Value label="Tax / SST" value={money(record.taxAmount)} />
                            <Value label="Amount requested" value={money(record.requestedAmount)} />
                        </dl>
                    </DetailSection>
                    <DetailSection title="Supporting Documents">
                        <div className={styles.documents}>{record.supportingDocuments.map((document) => <div key={document.id}><span aria-hidden="true" className={styles.documentIcon}>▧</span><div><strong>{document.fileName}</strong><span>{(document.size / 1024).toFixed(0)} KB</span></div><button type="button" onClick={() => downloadDocument(document)}>Download</button></div>)}</div>
                    </DetailSection>
                </div>

                <div className={styles.rightRail}>
                    <aside className={styles.actionPanel}>
                        <p>Manager action</p><h2>{canAct ? 'Review and forward' : 'Review recorded'}</h2>
                        {canAct ? <><span>Confirm the information is complete, or return it to Staff with correction notes. No signature is required.</span><button className={styles.primaryAction} disabled={isSaving} type="button" onClick={forwardToDirector}>Review and forward to Director <b aria-hidden="true">→</b></button><div className={styles.actionDivider}><span>or return with notes</span></div><label><span>Reason for returning</span><textarea rows={4} placeholder="Explain what Staff needs to correct" value={returnRemarks} onChange={(event) => setReturnRemarks(event.target.value)} /></label><button className={styles.returnAction} disabled={isSaving || !returnRemarks.trim()} type="button" onClick={returnToStaff}>Return to Staff</button></> : <><span>This request is now: <strong>{record.status.replaceAll('_', ' ')}</strong>.</span>{record.managerReviewedAt && <small>Reviewed {date(record.managerReviewedAt)}</small>}{record.managerReturnRemarks && <div className={styles.returnedReason}><strong>Return reason</strong><p>{record.managerReturnRemarks}</p></div>}</>}
                    </aside>
                    <WorkflowProgress record={record} directorName={directorName} />
                </div>
            </div>
        </main>
    );
}

function WorkflowProgress({ record, directorName }: { record: InvoicePaymentRequestRecord; directorName: string }) {
    const activeStep = record.status === 'PENDING_MANAGER_REVIEW' || record.status === 'RETURNED_TO_STAFF'
        ? 2
        : record.status === 'PENDING_DIRECTOR_REVIEW'
            ? 3
            : record.status === 'PENDING_FINANCE_REVIEW'
                ? 4
                : 5;
    const isCompleted = record.status === 'COMPLETED';
    const steps = [
        { title: 'Request Submitted', copy: `Submitted by ${record.staffName}` },
        { title: 'Manager Review', copy: record.status === 'RETURNED_TO_STAFF' ? 'Returned to Staff for correction' : 'Manager verification' },
        { title: 'Director Review', copy: `Assigned to ${directorName}` },
        { title: 'Finance Verification', copy: 'Payment checks and confirmation' },
        { title: 'Completed', copy: 'Request verified and closed' },
    ];

    return (
        <aside className={styles.progressPanel}>
            <header><p>Payment progress</p><span>Step {activeStep} of 5</span></header>
            <ol>
                {steps.map((step, index) => {
                    const number = index + 1;
                    const state = number < activeStep || (isCompleted && number === 5) ? 'complete' : number === activeStep ? 'active' : 'pending';
                    return <li className={styles.progressStep} data-state={state} key={step.title}><i aria-hidden="true">{state === 'complete' ? '✓' : ''}</i><div><strong>{step.title}</strong><small>{state === 'active' ? `Current stage: ${step.copy}` : step.copy}</small></div></li>;
                })}
            </ol>
        </aside>
    );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
    return <section className={styles.detailSection}><h2>{title}</h2>{children}</section>;
}
function Value({ label, value }: { label: string; value: string }) {
    return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
function StatePage({ title, copy }: { title: string; copy: string }) {
    return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/project-manager/payment-requests/invoice-payments">Back to Invoice Payments</Link></main>;
}

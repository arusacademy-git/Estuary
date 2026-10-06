'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchTravelAllowance, returnTravelAllowanceByManager, reviewTravelAllowanceByManager } from '@/data/payment-requests/travel-allowance/api';
import { notifyTravelAllowanceManagerApproved, notifyTravelAllowanceReturned } from '@/features/payment-request/notifications/travel-allowance-notifications';
import { TRAVEL_MEAL_RATES, travelLineMealSubtotal, travelLineTotal } from '@/domain/payment-requests/travel-allowance/types';
import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import { getBetaAccount, readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from '../travel-allowance-workflow.module.css';

const baseHref = '/beta/project-manager/payment-requests/travel-allowances';
const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
function displayDate(value: string) { const parsed = new Date(`${value}T12:00:00`); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY'); }
function statusLabel(status: TravelAllowanceRecord['status']) { return status === 'PENDING_MANAGER_REVIEW' ? 'Pending Manager Review' : status === 'PENDING_DIRECTOR_APPROVAL' ? 'Pending Director Approval' : status === 'PENDING_FINANCE_VERIFICATION' ? 'Pending Finance Verification' : status === 'RETURNED_TO_STAFF' ? 'Returned to Staff' : 'Completed'; }

export function TravelAllowanceManagerReview({ requestId }: { requestId: string }) {
    const [account, setAccount] = useState<BetaAccount | null>(null);
    const [record, setRecord] = useState<TravelAllowanceRecord | null>(null);
    const [checked, setChecked] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const session = readBetaSession();
        setAccount(session);
        if (!session || session.role !== 'manager') { setChecked(true); return; }
        fetchTravelAllowance(requestId).then(setRecord).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Request could not be loaded.')).finally(() => setChecked(true));
    }, [requestId]);

    async function forwardToDirector() {
        if (!record || !account) return;
        setError(''); setSuccess(''); setIsSaving(true);
        try { const updated = await reviewTravelAllowanceByManager(record.id, account.id); notifyTravelAllowanceManagerApproved(updated, account); setRecord(updated); setSuccess('The Travel Allowance was reviewed and forwarded to the Project Director.'); }
        catch (caught) { setError(caught instanceof Error ? caught.message : 'The request could not be forwarded.'); }
        finally { setIsSaving(false); }
    }

    async function returnToStaff() {
        if (!record || !account) return;
        setError(''); setSuccess(''); setIsSaving(true);
        try { const updated = await returnTravelAllowanceByManager(record.id, account.id, remarks); notifyTravelAllowanceReturned(updated, account, 'Manager'); setRecord(updated); setSuccess('The Travel Allowance was returned to Staff for correction.'); }
        catch (caught) { setError(caught instanceof Error ? caught.message : 'The request could not be returned.'); }
        finally { setIsSaving(false); }
    }

    if (!checked) return <State title="Loading Travel Allowance" copy="Reading the request from the database…" />;
    if (!account || account.role !== 'manager') return <State title="Manager access required" copy="Sign in using a Manager account." />;
    if (!record) return <State title="Travel Allowance not found" copy={error || 'The request could not be found.'} />;
    if (record.managerApproverId !== account.id && record.requesterId !== account.id) return <State title="Travel Allowance unavailable" copy="This request is not assigned to or created by your Manager account." />;

    const canAct = record.status === 'PENDING_MANAGER_REVIEW' && record.managerApproverId === account.id;
    const isOwnRequest = record.requesterRole === 'manager';
    const directorName = getBetaAccount(record.projectDirectorId)?.name ?? record.projectDirectorId;
    return (
        <main className={styles.page}>
            <div className={styles.back}><Link href={baseHref}>← Back to Travel Allowances</Link></div>
            {error && <div className={styles.error} role="alert">{error}</div>}{success && <div className={styles.success} role="status">{success}</div>}
            <div className={styles.detailLayout}>
                <section className={styles.detailMain}>
                    <header className={styles.hero}><div><p>{isOwnRequest ? 'Manager request tracking' : 'Manager review'}</p><h1>{record.requestNumber}</h1><span>Submitted by {record.requesterName}</span></div><div><small>Total allowance</small><strong>{money(record.totalAmount)}</strong><span className={styles.status} data-status={record.status}>{statusLabel(record.status)}</span></div></header>
                    <InfoSection title="Request Overview"><dl className={styles.infoGrid}><Value label="Request date" value={displayDate(record.requestDate)} /><Value label="Submitted by" value={record.requesterName} /><Value label="Requester role" value={isOwnRequest ? 'Manager — on behalf of Staff' : 'Staff'} /><Value label="Contact" value={record.contact} /><Value label="Project Director" value={directorName} /><Value label="Payment target" value={displayDate(record.paymentDueDate)} /></dl></InfoSection>
                    <InfoSection title="Travel Entries"><div className={styles.tableWrapper}><table><thead><tr><th>#</th><th>Employee</th><th>Travel date</th><th>Project</th><th>Reason</th><th>Meals</th><th>Meal subtotal</th><th>Special</th><th>Total</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.employeeName}</td><td>{displayDate(line.travelDate)}</td><td>{line.projectName}</td><td>{line.reason}</td><td>{line.meals.length ? line.meals.map((meal) => `${meal[0]}${meal.slice(1).toLowerCase()} RM${TRAVEL_MEAL_RATES[meal]}`).join(', ') : '—'}</td><td>{money(travelLineMealSubtotal(line))}</td><td>{money(line.specialAllowance)}{line.specialAllowanceReason && <small>{line.specialAllowanceReason}</small>}</td><td><strong>{money(travelLineTotal(line))}</strong></td></tr>)}</tbody></table></div></InfoSection>
                    {(record.remarks || record.supportingDocuments.length > 0) && <InfoSection title="Supporting Information">{record.remarks && <p className={styles.longText}>{record.remarks}</p>}<div className={styles.documents}>{record.supportingDocuments.map((document) => <a download={document.fileName} href={document.dataUrl} key={document.id}>{document.fileName}</a>)}</div></InfoSection>}
                </section>
                <aside className={styles.rail}><section className={styles.actionCard}><p>Manager action</p><h2>{canAct ? 'Review and forward' : isOwnRequest ? 'Tracking only' : 'Action recorded'}</h2>{canAct ? <><span>Confirm the Staff request and forward it to the Project Director.</span><button className={styles.primary} disabled={isSaving} type="button" onClick={forwardToDirector}>Review and forward to Director →</button><div className={styles.divider}>or return with notes</div><label><span>Reason for returning</span><textarea rows={4} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label><button className={styles.returnButton} disabled={isSaving || remarks.trim().length < 5} type="button" onClick={returnToStaff}>Return to Staff</button></> : <span>{isOwnRequest ? 'This request bypassed Manager review and is available here for tracking.' : `This request is now ${statusLabel(record.status)}.`}</span>}</section><Progress record={record} /></aside>
            </div>
        </main>
    );
}

function Progress({ record }: { record: TravelAllowanceRecord }) { const steps = record.requesterRole === 'manager' ? ['Request Submitted by Manager', 'Director Review', 'Finance Verification', 'Completed'] : ['Request Submitted', 'Manager Review', 'Director Review', 'Finance Verification', 'Completed']; const active = record.status === 'PENDING_MANAGER_REVIEW' ? 2 : record.status === 'PENDING_DIRECTOR_APPROVAL' ? (record.requesterRole === 'manager' ? 2 : 3) : record.status === 'PENDING_FINANCE_VERIFICATION' ? (record.requesterRole === 'manager' ? 3 : 4) : record.status === 'COMPLETED' ? steps.length : Math.min(2, steps.length); return <section className={styles.progress}><header><p>Payment progress</p><span>Step {active} of {steps.length}</span></header><ol>{steps.map((title, index) => { const number = index + 1; const state = number < active || (record.status === 'COMPLETED' && number === steps.length) ? 'complete' : number === active ? 'active' : 'pending'; return <li data-state={state} key={title}><i>{state === 'complete' ? '✓' : number}</i><div><strong>{title}</strong><small>{state === 'active' ? 'Current stage' : state === 'complete' ? 'Completed' : 'Waiting'}</small></div></li>; })}</ol></section>; }
function InfoSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.infoSection}><h2>{title}</h2>{children}</section>; }
function Value({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.state}><h1>{title}</h1><p>{copy}</p><Link href={baseHref}>Back to Travel Allowances</Link></main>; }

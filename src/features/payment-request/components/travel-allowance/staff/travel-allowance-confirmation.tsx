'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import { getBetaAccount } from '@/lib/auth/beta-accounts';

import styles from './travel-allowance-confirmation.module.css';

type Props = {
    request: TravelAllowanceRecord;
    onCreateAnother: () => void;
};

function money(value: number) {
    return new Intl.NumberFormat('en-MY', {
        style: 'currency',
        currency: 'MYR',
        minimumFractionDigits: 2,
    }).format(value);
}

function date(value: string) {
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY');
}

export function TravelAllowanceConfirmation({ request, onCreateAnother }: Props) {
    const [copied, setCopied] = useState(false);
    const manager = request.managerApproverId
        ? getBetaAccount(request.managerApproverId)
        : null;
    const director = getBetaAccount(request.projectDirectorId);
    const employees = [...new Set(request.lines.map((line) => line.employeeName))]
        .filter(Boolean);
    const firstTravelDate = [...request.lines]
        .sort((a, b) => a.travelDate.localeCompare(b.travelDate))[0]?.travelDate;
    const isManagerRequest = request.requesterRole === 'manager';

    async function copyReference() {
        try {
            await navigator.clipboard.writeText(request.requestNumber);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    }

    return (
        <main className={styles.page}>
            <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                <span>Payment Requests</span><i>›</i><span>Travel Allowance</span><i>›</i><strong>Confirmation</strong>
            </nav>

            <section className={styles.card}>
                <header className={styles.successHeader}>
                    <span aria-hidden="true" className={styles.successIcon}>✓</span>
                    <h1>Travel Allowance request submitted</h1>
                    <div className={styles.referenceRow}>
                        <span className={styles.referenceBox}>
                            <small>REF ID</small><strong>{request.requestNumber}</strong>
                            <button aria-label="Copy request reference" type="button" onClick={copyReference}>{copied ? 'Copied' : 'Copy'}</button>
                        </span>
                        <span className={styles.statusBadge}><i />{isManagerRequest ? 'Pending Director Approval' : 'Pending Manager Review'}</span>
                    </div>
                    <p>
                        {isManagerRequest
                            ? `The request was created on behalf of Staff and routed directly to ${director?.name ?? 'the Project Director'}.`
                            : `The request was routed to ${manager?.name ?? 'the assigned Manager'} for review.`}
                    </p>
                </header>

                <section className={styles.summarySection}>
                    <h2>Request summary</h2>
                    <dl className={styles.summaryGrid}>
                        <div><dt>Total allowance</dt><dd className={styles.amount}>{money(request.totalAmount)}</dd><small>{request.lines.length} travel {request.lines.length === 1 ? 'entry' : 'entries'}</small></div>
                        <div><dt>Employee(s)</dt><dd>{employees.join(', ') || 'Not available'}</dd><small>Submitted by {request.requesterName}</small></div>
                        <div><dt>First travel date</dt><dd>{firstTravelDate ? date(firstTravelDate) : 'Not available'}</dd><small>Payment target: {date(request.paymentDueDate)}</small></div>
                        <div><dt>Next reviewer</dt><dd>{isManagerRequest ? director?.name ?? request.projectDirectorId : manager?.name ?? request.managerApproverId}</dd><small>{isManagerRequest ? 'Project Director' : 'Manager reviewer'}</small></div>
                    </dl>
                </section>

                <section className={styles.workflowSection}>
                    <h2>Workflow progress</h2>
                    <ol className={styles.workflow} data-count={isManagerRequest ? '4' : '5'}>
                        <Step state="complete" number="✓" title={isManagerRequest ? 'Manager Request Submitted' : 'Request Submitted'} copy={request.requesterName} />
                        {!isManagerRequest && <Step state="active" number="2" title="Manager Review" copy={`Assigned to ${manager?.name ?? 'Manager'}`} />}
                        <Step state={isManagerRequest ? 'active' : 'pending'} number={isManagerRequest ? '2' : '3'} title="Director Review" copy={isManagerRequest ? `Assigned to ${director?.name ?? 'Director'}` : 'Awaiting Manager review'} />
                        <Step number={isManagerRequest ? '3' : '4'} title="Finance Verification" copy="Awaiting Director approval" />
                        <Step number={isManagerRequest ? '4' : '5'} title="Completed" copy="Awaiting Finance payment" />
                    </ol>
                </section>

                <footer className={styles.actions}>
                    <div>
                        <button className={styles.secondaryButton} type="button" onClick={onCreateAnother}>Create another Travel Allowance</button>
                        <Link className={styles.primaryButton} href="/beta/payment-records/travel-allowances">Track in Payment Records</Link>
                    </div>
                </footer>
            </section>

            <p className={styles.note}>Need a correction? Contact the current reviewer before the request moves to the next stage.</p>
        </main>
    );
}

function Step({ state = 'pending', number, title, copy }: { state?: 'complete' | 'active' | 'pending'; number: string; title: string; copy: string }) {
    return <li className={`${styles.workflowStep} ${styles[state]}`}><span aria-hidden="true">{number}</span><strong>{title}</strong><small>{copy}</small></li>;
}

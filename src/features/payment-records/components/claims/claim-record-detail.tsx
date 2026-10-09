'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchClaimRequest } from '@/data/payment-requests/claims/api';
import type { ClaimRecord } from '@/domain/payment-requests/claims/types';
import { getBetaAccount, readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { claimDate, ClaimReviewDetails, ClaimWorkflow } from '@/features/payment-request/components/claims/claim-review-shared';
import { PaymentPageState } from '@/shared/payment-page-state';
import styles from '@/features/payment-request/components/claims/claims.module.css';

function visible(record: ClaimRecord, account: BetaAccount) { if (account.role === 'staff') return record.requesterId === account.id; if (account.role === 'manager') return record.requesterId === account.id || record.managerApproverId === account.id; if (account.role === 'director') return record.requesterId === account.id || record.directorApproverId === account.id; return true; }
export function ClaimRecordDetail({ requestId }: { requestId: string }) {
    const [account, setAccount] = useState<BetaAccount | null>(null); const [record, setRecord] = useState<ClaimRecord | null>(null); const [checked, setChecked] = useState(false); const [error, setError] = useState('');
    useEffect(() => {
        let cancelled = false;

        // Session lives in the browser, so it is read after mount, inside a callback
        Promise.resolve().then(async () => {
            const session = readBetaSession();
            if (cancelled) return;
            setAccount(session);

            try {
                const value = await fetchClaimRequest(requestId);
                if (!session || !visible(value, session)) throw new Error('You do not have access to this Claim.');
                if (!cancelled) setRecord(value);
            } catch (caught) {
                if (!cancelled) setError(caught instanceof Error ? caught.message : 'The Claim could not be loaded.');
            } finally {
                if (!cancelled) setChecked(true);
            }
        });

        return () => { cancelled = true; };
    }, [requestId]);
    if (!checked) return <State title="Loading Claim" copy="Reading the Claim record…" />; if (!account || !record) return <State title="Claim unavailable" copy={error || 'The Claim could not be found.'} />;
    const returnedBy = record.returnedById ? getBetaAccount(record.returnedById)?.name ?? record.returnedById : 'Approver';
    const returnedRole = record.returnedFromStage === 'FINANCE' ? 'Finance' : record.returnedFromStage === 'DIRECTOR' ? 'Director' : 'Manager';
    return <main className={styles.reviewPage}><p className={styles.backLink}><Link href="/beta/payment-records/claims">← Back to Claim records</Link></p><div className={styles.reviewLayout}><div className={styles.reviewMain}><ClaimReviewDetails record={record} userId={account.id} /></div><div className={styles.reviewRail}>{record.status === 'RETURNED_TO_CLAIMANT' && record.returnRemarks && <aside className={styles.returnedRecordCard}><div><strong>Action required</strong><span>Returned by {returnedBy}{record.returnedAt ? ` · ${claimDate(record.returnedAt)}` : ''}</span></div><small>Changes requested by {returnedRole}</small><blockquote>{record.returnRemarks}</blockquote><p>Update the requested Claim information and resubmit it to resume the approval workflow.</p>{record.requesterId === account.id && <Link href={`/beta/payment-requests/claims/${encodeURIComponent(record.claimNumber)}/edit`}>Start Corrections →</Link>}</aside>}{record.status === 'DRAFT' && record.requesterId === account.id && <aside className={styles.decisionCard}><p>Draft Claim</p><h2>Continue this form</h2><span>This Draft has not entered the approval workflow.</span><Link className={styles.approveButton} href={`/beta/payment-requests/claims/${encodeURIComponent(record.claimNumber)}/edit`}>Continue Draft →</Link></aside>}<ClaimWorkflow record={record} /></div></div></main>;
}
function State({ title, copy }: { title: string; copy: string }) { return <PaymentPageState title={title} copy={copy} backHref="/beta/payment-records/claims" backLabel="Back to Claim records" />; }
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { approveClaimByManager, fetchClaimRequest } from '@/data/payment-requests/claims/api';
import { notifyClaimManagerApproved } from '@/features/payment-request/notifications/claim-notifications';
import { requiresTechManagerApproval } from '@/domain/payment-requests/claims/policy';
import type { ClaimRecord } from '@/domain/payment-requests/claims/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { isProjectManagerAccount } from '@/features/administration/admin-settings';

import { ClaimReviewDetails, ClaimWorkflow, claimStatusLabel } from '../claim-review-shared';
import styles from '../claim-workflow.module.css';

const baseHref = '/beta/project-manager/payment-requests/claims';

export function ClaimManagerReview({ requestId }: { requestId: string }) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<ClaimRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccount(readBetaSession());
    fetchClaimRequest(requestId).then(setRecord)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'The Claim could not be loaded.'))
      .finally(() => setChecked(true));
  }, [requestId]);

  async function approve() {
    if (!account || !record) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const updated = await approveClaimByManager(record.id, account.id);
      notifyClaimManagerApproved(updated, account);
      setRecord(updated);
      setSuccess(record.approvalRoute === 'MANAGER' || requiresTechManagerApproval(record)
        ? updated.status === 'PENDING_FINANCE_VERIFICATION' ? 'Claim approved by all assigned Managers and forwarded to Finance.' : 'Your programme approval was recorded. Other assigned Managers still need to approve.'
        : 'Manager preview recorded. Finance processing is not affected.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The Claim could not be approved.');
    } finally { setSaving(false); }
  }

  if (!checked) return <State title="Loading Claim" copy="Reading the Claim details and receipts…" />;
  if (!account || !isProjectManagerAccount(account)) return <State title="Manager access required" copy="You need an active project manager assignment." />;
  if (!record) return <State title="Claim not found" copy={error || 'This Claim could not be found.'} />;
  if (!(record.managerApproverIds ?? [record.managerApproverId]).includes(account.id) && record.requesterId !== account.id) return <State title="Claim unavailable" copy="This Claim is not assigned to or created by your Manager account." />;

  const alreadyApproved = record.managerApprovals?.some((item) => item.managerId === account.id && item.approvedAt);
  const actionable = record.approvalRoute !== 'DIRECTOR' && !alreadyApproved && !['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status) && (record.managerApproverIds ?? [record.managerApproverId]).includes(account.id) && (record.approvalRoute !== 'MANAGER' || record.status === 'PENDING_MANAGER_APPROVAL');
  const approvalRequired = record.approvalRoute === 'MANAGER' || requiresTechManagerApproval(record);
  return (
    <main className={styles.page}>
      <div className={styles.back}><Link href={baseHref}>← Back to Claims</Link></div>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {success && <div className={styles.success} role="status">{success}</div>}
      <div className={styles.detailLayout}>
        <section className={styles.detailMain}><ClaimReviewDetails contextLabel="Manager review" record={record} userId={account.id} /></section>
        <aside className={styles.rail}>
          <section className={styles.actionCard}>
            <p>Manager action</p>
            <h2>{actionable ? approvalRequired ? 'Approve Claim' : 'Informational preview' : approvalRequired ? 'Approval recorded' : 'Preview recorded'}</h2>
            {actionable ? <>
              <span>{record.approvalRoute === 'MANAGER' ? 'Review and approve this Claim before Finance can verify and process it.' : approvalRequired ? 'This staff Tech Claim is above RM500. Review and approve it before Finance can process payment.' : 'Review the Claim details and receipts for tracking. Finance can process the Claim before or after this preview.'}</span>
              <button className={styles.primary} disabled={saving} onClick={approve} type="button">{approvalRequired ? 'Approve my programme entries →' : 'Mark preview complete →'}</button>
            </> : <>
              <span>{approvalRequired ? 'Manager approval is recorded.' : 'Manager preview is recorded.'} Current payment status: {claimStatusLabel(record.status)}.</span>
            </>}
          </section>
          <ClaimWorkflow record={record} />
        </aside>
      </div>
    </main>
  );
}

function State({ title, copy }: { title: string; copy: string }) {
  return <main className={styles.state}><h1>{title}</h1><p>{copy}</p><Link href={baseHref}>Back to Claims</Link></main>;
}

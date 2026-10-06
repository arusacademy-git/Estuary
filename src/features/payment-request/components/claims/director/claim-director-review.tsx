'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchClaimRequest, forwardClaimByDirector } from '@/data/payment-requests/claims/api';
import { notifyClaimDirectorForwarded } from '@/features/payment-request/notifications/claim-notifications';
import type { ClaimRecord } from '@/domain/payment-requests/claims/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { ClaimReviewDetails, ClaimWorkflow } from '../claim-review-shared';
import styles from '../claim-workflow.module.css';

export function ClaimDirectorReview({ requestId }: { requestId: string }) {
  const [account, setAccount] = useState<BetaAccount | null>(null); const [record, setRecord] = useState<ClaimRecord | null>(null); const [checked, setChecked] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { setAccount(readBetaSession()); fetchClaimRequest(requestId).then(setRecord).catch((caught) => setError(caught instanceof Error ? caught.message : 'The Claim could not be loaded.')).finally(() => setChecked(true)); }, [requestId]);
  async function forward() { if (!account || !record) return; setSaving(true); setError(''); setSuccess(''); try { const updated = await forwardClaimByDirector(record.id, account.id); notifyClaimDirectorForwarded(updated, account); setRecord(updated); setSuccess('Director preview recorded. Finance processing is not affected.'); } catch (caught) { setError(caught instanceof Error ? caught.message : 'The Claim preview could not be recorded.'); } finally { setSaving(false); } }
  if (!checked) return <State title="Loading Claim" copy="Reading the Claim and receipts…" />;
  if (!account || account.role !== 'director') return <State title="Director access required" copy="This page is available only to Directors." />;
  if (!record) return <State title="Claim not found" copy={error || 'This Claim could not be found.'} />;
  if (record.directorApproverId !== account.id && record.requesterId !== account.id) return <State title="Claim assigned to another Director" copy="You cannot preview this Claim." />;
  const actionable = !record.directorReviewedAt && !['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status) && record.directorApproverId === account.id;
  return <main className={styles.page}><div className={styles.back}><Link href="/beta/director/payment-requests/claims">← Back to Claims</Link></div>{error && <div className={styles.error} role="alert">{error}</div>}{success && <div className={styles.success} role="status">{success}</div>}<div className={styles.detailLayout}><section className={styles.detailMain}><ClaimReviewDetails contextLabel="Director preview" record={record} userId={account.id} /></section><aside className={styles.rail}><section className={styles.actionCard}><p>Director action</p><h2>{actionable ? 'Informational preview' : 'Preview recorded'}</h2>{actionable ? <><span>Review the Claim and receipts for tracking. Finance can process the Claim before or after this preview.</span><button className={styles.primary} disabled={saving} onClick={forward} type="button">Mark preview complete →</button></> : <><span>Director preview has been recorded. Finance processing remains independent.</span></>}</section><ClaimWorkflow record={record} /></aside></div></main>;
}
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.state}><h1>{title}</h1><p>{copy}</p><Link href="/beta/director/payment-requests/claims">Back to Director Claims</Link></main>; }

'use client';
import { useEffect, useState } from 'react';
import { approveCashAdvanceByManager, fetchCashAdvance, returnCashAdvanceByManager } from '@/data/payment-requests/cash-advance/cash-advance-api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { notifyCashAdvanceManagerApproved, notifyCashAdvanceReturned } from '@/features/payment-request/notifications/cash-advance-notifications';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { useUserSignature } from '@/features/signatures/hooks/use-user-signature';
import { CashAdvanceDetail } from '../cash-advance-detail';
import styles from '../cash-advance.module.css';

export function CashAdvanceManagerReview({ id }: { id: string }) {
  const [record, setRecord] = useState<CashAdvanceRecord | null>(null); const [account, setAccount] = useState<ReturnType<typeof readBetaSession>>(null); const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const { signature } = useUserSignature(account?.id);
  useEffect(() => { setAccount(readBetaSession()); fetchCashAdvance(id).then(setRecord).catch((caught) => setError(caught instanceof Error ? caught.message : 'Cash Advance could not be loaded.')); }, [id]);
  async function act(kind: 'approve' | 'return') { if (!account || account.role !== 'manager') return setError('Sign in using a Manager account.'); if (kind === 'approve' && !signature) return setError('Upload your signature in Settings before approving.'); setSaving(true); setError(''); try { const updated = kind === 'approve' ? await approveCashAdvanceByManager(id, account.id, signature!.id) : await returnCashAdvanceByManager(id, account.id, reason); if (kind === 'approve') notifyCashAdvanceManagerApproved(updated, account); else notifyCashAdvanceReturned(updated, account, 'Manager'); setRecord(updated); } catch (caught) { setError(caught instanceof Error ? caught.message : 'The Manager action failed.'); } finally { setSaving(false); } }
  if (error && !record) return <div className={styles.error}>{error}</div>; if (!record) return <div className={styles.notice}>Loading Cash Advance…</div>;
  const actions = record.status === 'PENDING_MANAGER_APPROVAL' ? <section className={styles.sideCard}><h3>Manager action</h3>{error && <div className={styles.error}>{error}</div>}{signature ? <div className={styles.signature}><strong>Saved signature</strong><img alt="Manager signature" src={signature.imageUrl} style={{ display: 'block', maxHeight: 70, maxWidth: 220 }} /></div> : <div className={styles.error}>Upload your signature in <a href="/beta/settings/signature">Settings</a>.</div>}<div className={styles.actions}><button className={styles.primary} disabled={saving || !signature} onClick={() => act('approve')} type="button">Sign and forward</button></div><div className={styles.field}><label>Return remarks</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div><button className={styles.danger} disabled={saving} onClick={() => act('return')} type="button">Return to Staff</button></section> : undefined;
  return <CashAdvanceDetail actions={actions} backHref="/beta/project-manager/payment-requests/cash-advance" record={record} />;
}

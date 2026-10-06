'use client';
import { useEffect, useState } from 'react';
import { completeCashAdvance, fetchCashAdvance, payCashAdvanceByFinance, returnCashAdvanceByFinance, returnCashAdvanceReconciliation } from '@/data/payment-requests/cash-advance/cash-advance-api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { notifyCashAdvanceCompleted, notifyCashAdvancePaid, notifyCashAdvanceReturned } from '@/features/payment-request/notifications/cash-advance-notifications';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { CashAdvanceDetail } from '../cash-advance-detail';
import { CashAdvanceReconciliationReview } from './cash-advance-reconciliation-review';
import styles from '../cash-advance.module.css';
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function CashAdvanceFinanceReview({ id }: { id: string }) {
  const [record, setRecord] = useState<CashAdvanceRecord | null>(null); const [date, setDate] = useState(today()); const [reference, setReference] = useState(''); const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { fetchCashAdvance(id).then(setRecord).catch((caught) => setError(caught instanceof Error ? caught.message : 'Cash Advance could not be loaded.')); }, [id]);
  async function act(kind: 'pay' | 'return' | 'complete' | 'return-reconciliation') { const account = readBetaSession(); if (!account || account.role !== 'finance') return setError('Sign in using a Finance account.'); setSaving(true); setError(''); try { let updated: CashAdvanceRecord; if (kind === 'pay') updated = await payCashAdvanceByFinance(id, account.id, date, reference); else if (kind === 'complete') updated = await completeCashAdvance(id, account.id); else if (kind === 'return-reconciliation') updated = await returnCashAdvanceReconciliation(id, account.id, reason); else updated = await returnCashAdvanceByFinance(id, account.id, reason); if (kind === 'pay') notifyCashAdvancePaid(updated, account); else if (kind === 'complete') notifyCashAdvanceCompleted(updated, account); else notifyCashAdvanceReturned(updated, account, kind === 'return-reconciliation' ? 'Finance reconciliation' : 'Finance'); setRecord(updated); } catch (caught) { setError(caught instanceof Error ? caught.message : 'The Finance action failed.'); } finally { setSaving(false); } }
  if (error && !record) return <div className={styles.error}>{error}</div>; if (!record) return <div className={styles.notice}>Loading Cash Advance…</div>;
  let actions: React.ReactNode;
  if (record.status === 'PENDING_FINANCE_PROCESSING') actions = <section className={styles.sideCard}><h3>Record payment</h3>{error && <div className={styles.error}>{error}</div>}<div className={styles.field}><label>Payment date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className={styles.field}><label>Bank reference</label><input value={reference} onChange={(e) => setReference(e.target.value)} /></div><button className={styles.primary} disabled={saving} onClick={() => act('pay')} type="button">Confirm payment</button><div className={styles.field}><label>Return remarks</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div><button className={styles.danger} disabled={saving} onClick={() => act('return')} type="button">Return to Staff</button></section>;
  if (record.status === 'PENDING_FINANCE_RECONCILIATION') actions = <CashAdvanceReconciliationReview error={error} onComplete={() => act('complete')} onReasonChange={setReason} onReturn={() => act('return-reconciliation')} reason={reason} record={record} saving={saving} />;
  return <CashAdvanceDetail actions={actions} backHref="/beta/finance/payment-requests/cash-advance" record={record} />;
}
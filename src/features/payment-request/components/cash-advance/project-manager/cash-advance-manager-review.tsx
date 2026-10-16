'use client';
import { useEffect, useState } from 'react';
import { fetchCashAdvance, previewCashAdvanceByManager } from '@/data/payment-requests/cash-advance/cash-advance-api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { CashAdvanceDetail } from '../cash-advance-detail';
import styles from '../cash-advance.module.css';

export function CashAdvanceManagerReview({ id }: { id: string }) {
  const [record, setRecord] = useState<CashAdvanceRecord | null>(null); const [account, setAccount] = useState<ReturnType<typeof readBetaSession>>(null); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { setAccount(readBetaSession()); fetchCashAdvance(id).then(setRecord).catch((caught) => setError(caught instanceof Error ? caught.message : 'Cash Advance could not be loaded.')); }, [id]);
  async function markPreviewed() { if (!account || account.role !== 'manager') return setError('Sign in using a Manager account.'); setSaving(true); setError(''); try { setRecord(await previewCashAdvanceByManager(id, account.id)); } catch (caught) { setError(caught instanceof Error ? caught.message : 'The Manager preview could not be saved.'); } finally { setSaving(false); } }
  if (error && !record) return <div className={styles.error}>{error}</div>; if (!record) return <div className={styles.notice}>Loading Cash Advance…</div>;
  const actions = <section className={styles.sideCard}><p className={styles.informationalLabel}>Informational</p><h3>Manager preview</h3>{error && <div className={styles.error}>{error}</div>}<p className={styles.muted}>{record.managerPreviewedAt ? 'Your preview has been recorded. Director approval continues independently.' : 'Preview this Cash Advance for visibility. Director approval is already available and is not blocked by this preview.'}</p>{!record.managerPreviewedAt && <button className={styles.primary} disabled={saving} onClick={markPreviewed} type="button">{saving ? 'Saving…' : 'Mark preview complete'}</button>}</section>;
  return <CashAdvanceDetail actions={actions} backHref="/beta/project-manager/payment-requests/cash-advance" record={record} />;
}

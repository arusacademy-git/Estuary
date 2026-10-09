'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCashAdvances } from '@/data/payment-requests/cash-advance/cash-advance-api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { CashAdvanceStatusBadge } from '../cash-advance-status-badge';
import styles from '../cash-advance.module.css';

type Session = ReturnType<typeof readBetaSession>;

export function CashAdvanceStaffQueue() {
  // undefined = session not read yet, null = no session found
  const [account, setAccount] = useState<Session | undefined>(undefined);
  const [records, setRecords] = useState<CashAdvanceRecord[]>([]);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    let cancelled = false;

    // Session lives in the browser, so it is read after mount, inside a callback
    Promise.resolve().then(() => {
      const current = readBetaSession();
      if (cancelled) return;
      setAccount(current);
      if (!current || current.role !== 'staff') return;

      return fetchCashAdvances({ role: 'staff', userId: current.id })
        .then((data) => { if (!cancelled) setRecords(data); })
        .catch((caught) => {
          if (!cancelled) setFetchError(caught instanceof Error ? caught.message : 'Cash Advances could not be loaded.');
        });
    });

    return () => { cancelled = true; };
  }, []);

  // Derived: no setError needed for the sign-in message
  const signInError = account !== undefined && (!account || account.role !== 'staff') ? 'Sign in using a Staff account.' : '';
  const error = signInError || fetchError;

  return <section className={styles.card}><div className={styles.header}><div><h1>Cash Advances</h1><p className={styles.muted}>Track requests, payment and reconciliation.</p></div><Link className={styles.primary} href="/beta/payment-requests/cash-advance/new">+ New Cash Advance</Link></div>{error && <div className={styles.error}>{error}</div>}{!records.length ? <div className={styles.empty}>No Cash Advances found.</div> : <table className={styles.queue}><thead><tr><th>Reference</th><th>Project</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{record.requestNumber}</td><td>{record.projectName}</td><td>RM {record.totalAmount.toFixed(2)}</td><td><CashAdvanceStatusBadge status={record.status} /></td><td><Link className={styles.secondary} href={`/beta/payment-requests/cash-advance/${record.id}`}>View</Link></td></tr>)}</tbody></table>}</section>;
}
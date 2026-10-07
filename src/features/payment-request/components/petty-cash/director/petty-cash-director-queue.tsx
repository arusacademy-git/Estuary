'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { fetchPettyCashRequests } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
const date = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('en-MY');

export function PettyCashDirectorQueue() {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [records, setRecords] = useState<PettyCashRecord[]>([]);
  const [checked, setChecked] = useState(() => !account || account.role !== 'director');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!account || account.role !== 'director') return;
    let cancelled = false;
    fetchPettyCashRequests({ role: 'director', userId: account.id })
      .then((values) => { if (!cancelled) setRecords(values); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Requests could not be loaded.'); })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [account]);

  const assigned = useMemo(() => records.filter((record) => (record.directorApproverId === account?.id || record.financeReviewerId === account?.id) && record.requesterRole !== 'director'), [account, records]);
  if (!checked) return <State title="Loading Petty Cash requests" copy="Checking your Director approvals…" />;
  if (!account || account.role !== 'director') return <State title="Director access required" copy="This page is available only to the assigned Director." />;

  return <main className={styles.managerPage}>
    <header className={styles.managerHeader}><div><p className={styles.eyebrow}>Director workspace</p><h1>Petty Cash previews</h1><p>Preview assigned requests while Finance processes them independently.</p></div><div className={styles.managerAccountCard}><span>Signed in as</span><strong>{account.name}</strong><small>{account.position}</small></div></header>
    <section className={styles.managerQueuePanel}><div className={styles.managerQueueHeader}><div><h2>Assigned Petty Cash requests</h2><p>{assigned.filter((record) => !record.directorApprovedAt).length} request(s) are available for informational preview.</p></div></div>
      {error ? <div className={styles.error}>{error}</div> : assigned.length === 0 ? <div className={styles.managerEmpty}><h2>No assigned requests</h2><p>Petty Cash requests assigned to you will appear here.</p></div> : <div className={styles.managerTableWrapper}><table><thead><tr><th>Request</th><th>Requester</th><th>Date</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{assigned.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong></td><td>{record.requesterName}</td><td>{date(record.requestDate)}</td><td className={styles.managerAmount}>{money(record.totalAmount)}</td><td><PettyCashStatusBadge status={record.status} /></td><td className={styles.managerActionCell}><Link href={`/beta/director/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}`}>{record.directorApprovedAt ? 'View details' : 'Preview request'}</Link></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}

function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>; }

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchCashAdvances } from '@/data/payment-requests/cash-advance/cash-advance-api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { CashAdvanceStatusBadge } from '../cash-advance-status-badge';
import styles from '../cash-advance.module.css';

type QueueFilter = 'ACTION' | 'COMPLETED' | 'ALL';

export function CashAdvanceFinanceQueue() {
  const [account] = useState<ReturnType<typeof readBetaSession>>(() => readBetaSession());
    const [records, setRecords] = useState<CashAdvanceRecord[]>([]);
  const [error, setError] = useState(() =>
    !account || account.role !== 'finance'
      ? 'Sign in using a Finance account.'
      : '',
  );
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<QueueFilter>('ACTION');
    const [view, setView] = useState<'GRID' | 'LIST'>('LIST');
    const [page, setPage] = useState(1);
    const pageSize = 25;

    useEffect(() => {
        const current = readBetaSession();
    if (!current || current.role !== 'finance') return;
        fetchCashAdvances({ role: 'finance', userId: current.id }).then(setRecords).catch((caught) => setError(caught instanceof Error ? caught.message : 'Cash Advances could not be loaded.'));
    }, []);

    const requiresAction = (record: CashAdvanceRecord) => record.status === 'PENDING_FINANCE_PROCESSING' || record.status === 'PENDING_FINANCE_RECONCILIATION';
    const isCompleted = (record: CashAdvanceRecord) => record.status === 'COMPLETED';
    const paymentCount = records.filter((record) => record.status === 'PENDING_FINANCE_PROCESSING').length;
    const reconciliationCount = records.filter((record) => record.status === 'PENDING_FINANCE_RECONCILIATION').length;
    const actionCount = paymentCount + reconciliationCount;
    const completedCount = records.filter(isCompleted).length;
    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return records.filter((record) => {
            if (filter === 'ACTION' && !requiresAction(record)) return false;
            if (filter === 'COMPLETED' && !isCompleted(record)) return false;
            return !term || [record.requestNumber, record.requesterName, record.projectName].some((value) => value.toLowerCase().includes(term));
        });
    }, [filter, records, search]);
  useEffect(() => {
    const resetTimer = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(resetTimer);
  }, [filter, search]);
    const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const paged = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const hrefFor = (record: CashAdvanceRecord) => `/beta/finance/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}`;
    const actionLabel = (record: CashAdvanceRecord) => record.status === 'PENDING_FINANCE_PROCESSING' ? 'Process payment' : record.status === 'PENDING_FINANCE_RECONCILIATION' ? 'Verify reconciliation' : 'View request';

    return <div className={styles.workspace}>
        <header className={styles.workspaceHero}><div><p className={styles.eyebrow}>Finance workspace</p><h1>Cash Advance processing</h1><p>Record approved payments and verify Staff reconciliation.</p></div><div className={styles.signedIn}><span>Signed in as</span><strong>{account?.name ?? '—'}</strong><small>Finance Administrator</small></div></header>
        <section className={styles.statGrid}><article><span>Payment required</span><strong>{paymentCount}</strong><small>Director-approved requests</small></article><article><span>Reconciliation review</span><strong>{reconciliationCount}</strong><small>Submitted by Staff</small></article><article><span>Completed</span><strong>{completedCount}</strong><small>Verified and closed</small></article></section>
        <section className={styles.queueReceipt}>
            <div className={styles.queueToolbar}><div><h2>Cash Advances for Finance</h2><p>Process payment or inspect the submitted cash reconciliation.</p></div><label className={styles.searchField}>Search<input onChange={(event) => setSearch(event.target.value)} placeholder="Request number, Staff or project" value={search} /></label></div>
            <div className={styles.queueControls}><div className={styles.filterTabs}><button className={filter === 'ACTION' ? styles.filterActive : undefined} onClick={() => setFilter('ACTION')} type="button">Requires action <span>{actionCount}</span></button><button className={filter === 'COMPLETED' ? styles.filterActive : undefined} onClick={() => setFilter('COMPLETED')} type="button">Completed <span>{completedCount}</span></button><button className={filter === 'ALL' ? styles.filterActive : undefined} onClick={() => setFilter('ALL')} type="button">All <span>{records.length}</span></button></div><div className={styles.viewToggle}><button className={view === 'GRID' ? styles.viewActive : undefined} onClick={() => setView('GRID')} type="button">▦ Grid</button><button className={view === 'LIST' ? styles.viewActive : undefined} onClick={() => setView('LIST')} type="button">☷ List</button></div></div>
            {error && <div className={styles.error}>{error}</div>}
            {!paged.length ? <div className={styles.empty}><strong>No Cash Advances found</strong><span>There are no requests matching this filter.</span></div> : view === 'LIST' ? <div className={styles.queueTableWrap}><table className={styles.queue}><thead><tr><th>Request</th><th>Staff</th><th>Project</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{paged.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong></td><td>{record.requesterName}</td><td>{record.projectName}</td><td className={styles.amount}>RM {record.totalAmount.toFixed(2)}</td><td><CashAdvanceStatusBadge status={record.status} /></td><td><Link className={styles.secondary} href={hrefFor(record)}>{actionLabel(record)}</Link></td></tr>)}</tbody></table></div> : <div className={styles.queueGrid}>{paged.map((record) => <article key={record.id}><div><strong>{record.requestNumber}</strong><CashAdvanceStatusBadge status={record.status} /></div><h3>{record.requesterName}</h3><p>{record.projectName}</p><b>RM {record.totalAmount.toFixed(2)}</b><Link className={styles.secondary} href={hrefFor(record)}>{actionLabel(record)}</Link></article>)}</div>}
            {visible.length > 0 && <footer className={styles.pagination}><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visible.length)} of {visible.length}</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">‹</button><strong>{currentPage}</strong><button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} type="button">›</button></div></footer>}
        </section>
    </div>;
}

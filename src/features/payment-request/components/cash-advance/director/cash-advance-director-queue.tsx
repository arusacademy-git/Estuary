'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchCashAdvances } from '@/data/payment-requests/cash-advance/cash-advance-api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { CashAdvanceStatusBadge } from '../cash-advance-status-badge';
import styles from '../cash-advance.module.css';

type QueueFilter = 'APPROVAL' | 'FORWARDED' | 'ALL';
type Session = ReturnType<typeof readBetaSession>;

export function CashAdvanceDirectorQueue() {
    // undefined = session not read yet, null = no session found
    const [account, setAccount] = useState<Session | undefined>(undefined);
    const [records, setRecords] = useState<CashAdvanceRecord[]>([]);
    const [fetchError, setFetchError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<QueueFilter>('APPROVAL');
    const [view, setView] = useState<'GRID' | 'LIST'>('LIST');
    const [page, setPage] = useState(1);
    const pageSize = 25;

    useEffect(() => {
        let cancelled = false;

        Promise.resolve().then(() => {
            const current = readBetaSession();
            if (cancelled) return;
            setAccount(current);
            if (!current || current.role !== 'director') return;

            return fetchCashAdvances({ role: 'director', userId: current.id })
                .then((data) => { if (!cancelled) setRecords(data); })
                .catch((caught) => {
                    if (!cancelled) setFetchError(caught instanceof Error ? caught.message : 'Cash Advances could not be loaded.');
                });
        });

        return () => { cancelled = true; };
    }, []);

    // Derived: no setError needed for the sign-in message
    const signInError = account !== undefined && (!account || account.role !== 'director') ? 'Sign in using a Director account.' : '';
    const error = signInError || fetchError;

    const changeFilter = (next: QueueFilter) => { setFilter(next); setPage(1); };
    const changeSearch = (next: string) => { setSearch(next); setPage(1); };

    const requiresApproval = (record: CashAdvanceRecord) => record.status === 'PENDING_DIRECTOR_APPROVAL';
    const wasForwarded = (record: CashAdvanceRecord) => Boolean(record.directorApprovedAt);
    const approvalCount = records.filter(requiresApproval).length;
    const forwardedCount = records.filter(wasForwarded).length;
    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return records.filter((record) => {
            if (filter === 'APPROVAL' && record.status !== 'PENDING_DIRECTOR_APPROVAL') return false;
            if (filter === 'FORWARDED' && !record.directorApprovedAt) return false;
            return !term || [record.requestNumber, record.requesterName, record.projectName].some((value) => value.toLowerCase().includes(term));
        });
    }, [filter, records, search]);
    const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const paged = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const hrefFor = (record: CashAdvanceRecord) => `/beta/director/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}`;

    return <div className={styles.workspace}>
        <header className={styles.workspaceHero}><div><p className={styles.eyebrow}>Director workspace</p><h1>Cash Advance approvals</h1><p>Review Manager-approved requests and forward them to Finance.</p>{approvalCount > 0 && <Link className={styles.bulkActionButton} href="/beta/director/payment-requests/cash-advance/bulk">Bulk review and approve</Link>}</div><div className={styles.signedIn}><span>Signed in as</span><strong>{account?.name ?? '—'}</strong><small>School Director</small></div></header>
        <section className={styles.statGrid}><article><span>Requires approval</span><strong>{approvalCount}</strong><small>Waiting for your action</small></article><article><span>Forwarded</span><strong>{forwardedCount}</strong><small>Sent to Finance</small></article><article><span>All assigned</span><strong>{records.length}</strong><small>Your Cash Advances</small></article></section>
        <section className={styles.queueReceipt}>
            <div className={styles.queueToolbar}><div><h2>Assigned Cash Advances</h2><p>Inspect the request, documents and Manager approval.</p></div><label className={styles.searchField}>Search<input onChange={(event) => changeSearch(event.target.value)} placeholder="Request number, Staff or project" value={search} /></label></div>
            <div className={styles.queueControls}><div className={styles.filterTabs}><button className={filter === 'APPROVAL' ? styles.filterActive : undefined} onClick={() => changeFilter('APPROVAL')} type="button">Requires approval <span>{approvalCount}</span></button><button className={filter === 'FORWARDED' ? styles.filterActive : undefined} onClick={() => changeFilter('FORWARDED')} type="button">Forwarded <span>{forwardedCount}</span></button><button className={filter === 'ALL' ? styles.filterActive : undefined} onClick={() => changeFilter('ALL')} type="button">All <span>{records.length}</span></button></div><div className={styles.viewToggle}><button className={view === 'GRID' ? styles.viewActive : undefined} onClick={() => setView('GRID')} type="button">▦ Grid</button><button className={view === 'LIST' ? styles.viewActive : undefined} onClick={() => setView('LIST')} type="button">☷ List</button></div></div>
            {error && <div className={styles.error}>{error}</div>}
            {!paged.length ? <div className={styles.empty}><strong>No Cash Advances found</strong><span>There are no assigned requests matching this filter.</span></div> : view === 'LIST' ? <div className={styles.queueTableWrap}><table className={styles.queue}><thead><tr><th>Request</th><th>Staff</th><th>Project</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{paged.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong></td><td>{record.requesterName}</td><td>{record.projectName}</td><td className={styles.amount}>RM {record.totalAmount.toFixed(2)}</td><td><CashAdvanceStatusBadge status={record.status} /></td><td><Link className={styles.secondary} href={hrefFor(record)}>{requiresApproval(record) ? 'Review request' : 'View request'}</Link></td></tr>)}</tbody></table></div> : <div className={styles.queueGrid}>{paged.map((record) => <article key={record.id}><div><strong>{record.requestNumber}</strong><CashAdvanceStatusBadge status={record.status} /></div><h3>{record.requesterName}</h3><p>{record.projectName}</p><b>RM {record.totalAmount.toFixed(2)}</b><Link className={styles.secondary} href={hrefFor(record)}>{requiresApproval(record) ? 'Review request' : 'View request'}</Link></article>)}</div>}
            {visible.length > 0 && <footer className={styles.pagination}><span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visible.length)} of {visible.length}</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">‹</button><strong>{currentPage}</strong><button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} type="button">›</button></div></footer>}
        </section>
    </div>;
}

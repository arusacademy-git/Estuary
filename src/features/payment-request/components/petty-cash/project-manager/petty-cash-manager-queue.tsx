'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchPettyCashRequests } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

type Filter = 'PENDING' | 'FORWARDED' | 'ALL';
type ViewMode = 'grid' | 'list';

function money(value: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}

function date(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY');
}

function location(record: PettyCashRecord) {
  return record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur';
}

export function PettyCashManagerQueue() {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [records, setRecords] = useState<PettyCashRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    // Session lives in the browser, so it is read after mount, inside a callback
    Promise.resolve().then(async () => {
      const current = readBetaSession();
      if (cancelled) return;
      setAccount(current);
      if (!current || current.role !== 'manager') {
        setSessionChecked(true);
        return;
      }

      try {
        const data = await fetchPettyCashRequests({ role: 'manager', userId: current.id });
        if (!cancelled) setRecords(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Requests could not be loaded.');
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    });

    return () => { cancelled = true; };
  }, []);

  const assigned = useMemo(
    () => records
      .filter((record) => record.managerApproverId === account?.id || record.financeReviewerId === account?.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [account, records],
  );
  const pendingCount = assigned.filter((record) => !record.managerApprovedAt).length;
  const forwardedCount = assigned.filter((record) => Boolean(record.managerApprovedAt)).length;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assigned.filter((record) => {
      if (filter === 'PENDING' && record.managerApprovedAt) return false;
      if (filter === 'FORWARDED' && !record.managerApprovedAt) return false;
      if (!term) return true;
      return [record.requestNumber, record.requesterName, location(record), record.notes ?? '', ...record.lines.flatMap((line) => [line.supplier, line.details])]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [assigned, filter, search]);
  const pagination = useListPagination(visible);

  if (!sessionChecked) return <StatePage title="Loading Petty Cash requests" copy="Checking your Manager assignments…" />;
  if (!account || account.role !== 'manager') return <StatePage title="Manager access required" copy="This page is available only to the assigned Manager." />;

  return <main className={styles.managerPage}>
    <header className={styles.managerHeader}>
      <div><p className={styles.eyebrow}>Manager workspace</p><h1>Petty Cash previews</h1><p>Preview assigned requests while Finance processes them independently.</p>{pendingCount > 0 && <Link className={styles.bulkPreviewButton} href="/beta/project-manager/payment-requests/petty-cash/bulk">Bulk preview Petty Cash</Link>}</div>
      <div className={styles.managerAccountCard}><span>Signed in as</span><strong>{account.name}</strong><small>{account.position}</small></div>
    </header>

    <section className={styles.managerSummary}>
      <article><span>Needs preview</span><strong>{pendingCount}</strong><small>Informational action</small></article>
      <article><span>Previewed</span><strong>{forwardedCount}</strong><small>Your preview is recorded</small></article>
      <article><span>All assigned</span><strong>{assigned.length}</strong><small>Your Petty Cash requests</small></article>
    </section>

    <section className={styles.managerQueuePanel}>
      <div className={styles.managerQueueHeader}>
        <div><h2>Assigned Petty Cash requests</h2><p>Open a request to inspect its expenses, receipts and payment details.</p></div>
        <label className={styles.managerSearch}><span>Search</span><input type="search" placeholder="Request number, Staff or supplier" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>

      <div className={styles.managerToolbar}>
        <div className={styles.managerTabs} role="group" aria-label="Petty Cash filters">
          <button aria-pressed={filter === 'PENDING'} data-active={filter === 'PENDING'} type="button" onClick={() => setFilter('PENDING')}>Needs preview <span>{pendingCount}</span></button>
          <button aria-pressed={filter === 'FORWARDED'} data-active={filter === 'FORWARDED'} type="button" onClick={() => setFilter('FORWARDED')}>Previewed <span>{forwardedCount}</span></button>
          <button aria-pressed={filter === 'ALL'} data-active={filter === 'ALL'} type="button" onClick={() => setFilter('ALL')}>All <span>{assigned.length}</span></button>
        </div>
        <div className={styles.managerViewToggle} role="group" aria-label="Choose queue view">
          <button aria-pressed={viewMode === 'grid'} data-active={viewMode === 'grid'} type="button" onClick={() => setViewMode('grid')}>▦ Grid</button>
          <button aria-pressed={viewMode === 'list'} data-active={viewMode === 'list'} type="button" onClick={() => setViewMode('list')}>☷ List</button>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : visible.length === 0 ? <div className={styles.managerEmpty}><h2>No Petty Cash requests found</h2><p>There are no assigned requests matching this filter.</p></div> : viewMode === 'grid' ? <div className={styles.managerCardGrid}>{pagination.pageRecords.map((record) => <RequestCard key={record.id} record={record} />)}</div> : <div className={styles.managerTableWrapper}><table><thead><tr><th>Request</th><th>Staff</th><th>Location</th><th>Entries</th><th>Amount</th><th>Status</th><th><span className={styles.srOnly}>Action</span></th></tr></thead><tbody>{pagination.pageRecords.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong><small>{date(record.requestDate)}</small></td><td>{record.requesterName}</td><td>{location(record)}</td><td>{record.lines.length}</td><td className={styles.managerAmount}>{money(record.totalAmount)}</td><td><PettyCashStatusBadge status={record.status} /></td><td className={styles.managerActionCell}><Link href={`/beta/project-manager/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}`}>{record.managerApprovedAt ? 'View details' : 'Preview request'}</Link></td></tr>)}</tbody></table></div>}

      {!error && visible.length > 0 && <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />}
    </section>
  </main>;
}

function RequestCard({ record }: { record: PettyCashRecord }) {
  return <article className={styles.managerRequestCard}><div className={styles.managerCardTop}><span>{record.requestNumber}</span><PettyCashStatusBadge status={record.status} /></div><h2>{record.requesterName}</h2><p>{record.lines.length} expense {record.lines.length === 1 ? 'entry' : 'entries'}</p><dl><div><dt>Location</dt><dd>{location(record)}</dd></div><div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div><div><dt>Request date</dt><dd>{date(record.requestDate)}</dd></div><div><dt>Updated</dt><dd>{date(record.updatedAt)}</dd></div></dl><Link href={`/beta/project-manager/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}`}>{record.managerApprovedAt ? 'View details' : 'Preview request'}</Link></article>;
}

function StatePage({ title, copy }: { title: string; copy: string }) {
  return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>;
}

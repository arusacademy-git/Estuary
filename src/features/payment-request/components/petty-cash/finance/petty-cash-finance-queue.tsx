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

type Filter = 'PENDING' | 'PAID' | 'ALL';
type ViewMode = 'grid' | 'list';

const pendingStatuses = ['PENDING_FINANCE_REVIEW', 'PENDING_FINANCE_PAYMENT', 'FINANCE_VERIFIED'];
const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
const location = (record: PettyCashRecord) => record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur';
function date(value: string) { const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY'); }

export function PettyCashFinanceQueue() {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const [records, setRecords] = useState<PettyCashRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [error, setError] = useState('');

  useEffect(() => {
    const current = readBetaSession(); setAccount(current);
    if (!current || current.role !== 'finance') { setChecked(true); return; }
    fetchPettyCashRequests({ role: 'finance', userId: current.id })
      .then(setRecords)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Requests could not be loaded.'))
      .finally(() => setChecked(true));
  }, []);

  const financeRecords = useMemo(() => [...records].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [records]);
  const pendingCount = financeRecords.filter((record) => pendingStatuses.includes(record.status) && (record.status !== 'PENDING_FINANCE_REVIEW' || record.financeReviewerId === account?.id)).length;
  const paidCount = financeRecords.filter((record) => record.status === 'PAID').length;
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return financeRecords.filter((record) => {
      if (filter === 'PENDING' && (!pendingStatuses.includes(record.status) || (record.status === 'PENDING_FINANCE_REVIEW' && record.financeReviewerId !== account?.id))) return false;
      if (filter === 'PAID' && record.status !== 'PAID') return false;
      return !term || [record.requestNumber, record.requesterName, location(record), ...record.lines.map((line) => line.supplier)].some((value) => value.toLowerCase().includes(term));
    });
  }, [account, filter, financeRecords, search]);
  const pagination = useListPagination(visible);

  if (!checked) return <StatePage title="Loading Petty Cash payments" copy="Checking the Finance payment queue…" />;
  if (!account || account.role !== 'finance') return <StatePage title="Finance access required" copy="This page is available only to Finance." />;

  return <main className={styles.managerPage}>
    <header className={styles.managerHeader}><div><p className={styles.eyebrow}>Finance workspace</p><h1>Petty Cash payment processing</h1><p>Process submitted requests immediately; informational previews may be completed independently.</p></div><div className={styles.managerAccountCard}><span>Signed in as</span><strong>{account.name}</strong><small>{account.position}</small></div></header>
    <section className={styles.managerSummary}><article><span>Requires processing</span><strong>{pendingCount}</strong><small>Waiting for Finance action</small></article><article><span>Paid</span><strong>{paidCount}</strong><small>Payment and ledger completed</small></article><article><span>All received</span><strong>{financeRecords.length}</strong><small>Petty Cash requests received</small></article></section>
    <section className={styles.managerQueuePanel}>
      <div className={styles.managerQueueHeader}><div><h2>Petty Cash payments for Finance</h2><p>Open a request to verify its expenses, receipts and payment information.</p></div><label className={styles.managerSearch}><span>Search</span><input type="search" placeholder="Request number, Staff or supplier" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
      <div className={styles.managerToolbar}><div className={styles.managerTabs} role="group" aria-label="Petty Cash payment filters"><button aria-pressed={filter === 'PENDING'} data-active={filter === 'PENDING'} type="button" onClick={() => setFilter('PENDING')}>Requires processing <span>{pendingCount}</span></button><button aria-pressed={filter === 'PAID'} data-active={filter === 'PAID'} type="button" onClick={() => setFilter('PAID')}>Paid <span>{paidCount}</span></button><button aria-pressed={filter === 'ALL'} data-active={filter === 'ALL'} type="button" onClick={() => setFilter('ALL')}>All <span>{financeRecords.length}</span></button></div><div className={styles.managerViewToggle} role="group" aria-label="Choose queue view"><button aria-pressed={viewMode === 'grid'} data-active={viewMode === 'grid'} type="button" onClick={() => setViewMode('grid')}>▦ Grid</button><button aria-pressed={viewMode === 'list'} data-active={viewMode === 'list'} type="button" onClick={() => setViewMode('list')}>☷ List</button></div></div>
      {error ? <div className={styles.error}>{error}</div> : visible.length === 0 ? <div className={styles.managerEmpty}><h2>No Petty Cash payments found</h2><p>There are no requests matching this filter.</p></div> : viewMode === 'grid' ? <div className={styles.managerCardGrid}>{pagination.pageRecords.map((record) => <RequestCard key={record.id} record={record} />)}</div> : <div className={styles.managerTableWrapper}><table><thead><tr><th>Request</th><th>Requester</th><th>Location</th><th>Entries</th><th>Amount</th><th>Status</th><th><span className={styles.srOnly}>Action</span></th></tr></thead><tbody>{pagination.pageRecords.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong><small>{date(record.requestDate)}</small></td><td>{record.requesterName}</td><td>{location(record)}</td><td>{record.lines.length}</td><td className={styles.managerAmount}>{money(record.totalAmount)}</td><td><PettyCashStatusBadge status={record.status} /></td><td className={styles.managerActionCell}><Link href={`/beta/finance/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}`}>{record.status === 'PENDING_FINANCE_REVIEW' ? 'Review request' : pendingStatuses.includes(record.status) ? 'Process payment' : 'View details'}</Link></td></tr>)}</tbody></table></div>}
      {!error && visible.length > 0 && <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />}
    </section>
  </main>;
}

function RequestCard({ record }: { record: PettyCashRecord }) { return <article className={styles.managerRequestCard}><div className={styles.managerCardTop}><span>{record.requestNumber}</span><PettyCashStatusBadge status={record.status} /></div><h2>{record.requesterName}</h2><p>{record.lines.length} expense {record.lines.length === 1 ? 'entry' : 'entries'}</p><dl><div><dt>Location</dt><dd>{location(record)}</dd></div><div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div><div><dt>Manager reviewed</dt><dd>{date(record.managerApprovedAt ?? record.updatedAt)}</dd></div><div><dt>Payment reference</dt><dd>{record.paymentReference || '—'}</dd></div></dl><Link href={`/beta/finance/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}`}>{record.status === 'PENDING_FINANCE_REVIEW' ? 'Review request' : pendingStatuses.includes(record.status) ? 'Process payment' : 'View details'}</Link></article>; }
function StatePage({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>; }

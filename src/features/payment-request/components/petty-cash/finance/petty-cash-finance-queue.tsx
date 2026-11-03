'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ActionQueueFilterCard } from '@/components/ui/action-queue-filter/action-queue-filter-card';
import { useActionQueueFilter } from '@/components/ui/action-queue-filter/use-action-queue-filter';
import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { PaymentViewToggle } from '@/components/ui/payment-view-toggle';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchPettyCashRequests } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { FinanceBulkProcessLink } from '@/features/payment-request/components/bulk/finance-bulk-process-link';

import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

type Filter = 'PENDING' | 'PAID' | 'ALL';
type ViewMode = 'grid' | 'list';

const pendingStatuses = ['PENDING_FINANCE_REVIEW', 'PENDING_FINANCE_PAYMENT', 'PAYMENT_PROCESSED', 'FINANCE_VERIFIED', 'TRANSACTION_PROOF_UPLOADED', 'PENDING_FINANCE_RECONCILIATION'];
const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
const location = (record: PettyCashRecord) => record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur';
function date(value: string) { const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY'); }

export function PettyCashFinanceQueue() {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const [records, setRecords] = useState<PettyCashRecord[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    // Session lives in the browser, so it is read after mount, inside a callback
    Promise.resolve().then(async () => {
      const current = readBetaSession();
      if (cancelled) return;
      setAccount(current);
      if (!current || current.role !== 'finance') { setChecked(true); return; }

      try {
        const data = await fetchPettyCashRequests({ role: 'finance', userId: current.id });
        if (!cancelled) setRecords(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Requests could not be loaded.');
      } finally {
        if (!cancelled) setChecked(true);
      }
    });

    return () => { cancelled = true; };
  }, []);

  const financeRecords = useMemo(() => [...records].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [records]);
  const pendingCount = financeRecords.filter((record) => pendingStatuses.includes(record.status) && (record.status !== 'PENDING_FINANCE_REVIEW' || record.financeReviewerId === account?.id)).length;
  const paidCount = financeRecords.filter((record) => ['PAID', 'RECONCILED'].includes(record.status)).length;
  const queueFilter = useActionQueueFilter({
    records: financeRecords,
    initialStatus: 'PENDING' as Filter,
    getUpdatedAt: (record) => record.updatedAt,
    getAmount: (record) => record.totalAmount,
    getSearchText: (record) => [record.requestNumber, record.requesterName, location(record), record.notes ?? '', ...record.lines.flatMap((line) => [line.supplier, line.details])],
    matchesStatus: (record, filter) => {
      if (filter === 'PENDING') return pendingStatuses.includes(record.status) && (record.status !== 'PENDING_FINANCE_REVIEW' || record.financeReviewerId === account?.id);
      if (filter === 'PAID') return ['PAID', 'RECONCILED'].includes(record.status);
      return true;
    },
  });
  const visible = queueFilter.filteredRecords;
  const pagination = useListPagination(visible);

  if (!checked) return <StatePage title="Loading Petty Cash payments" copy="Checking the Finance payment queue…" />;
  if (!account || account.role !== 'finance') return <StatePage title="Finance access required" copy="This page is available only to Finance." />;

  return <main className={styles.managerPage}>
    <header className={styles.managerHeader}><div><p className={styles.eyebrow}>Finance workspace</p><h1>Petty Cash payment and reconciliation</h1><p>Release approved Petty Cash, then close each request after receipts and any returned balance are recorded.</p>{pendingCount > 0 && <FinanceBulkProcessLink className={styles.bulkPreviewButton} href="/beta/finance/payment-requests/petty-cash/bulk">Bulk process Petty Cash</FinanceBulkProcessLink>}</div><div className={styles.managerAccountCard}><span>Signed in as</span><strong>{account.name}</strong><small>{account.position}</small></div></header>
    <section className={styles.managerSummary}><article><span>Requires processing</span><strong>{pendingCount}</strong><small>Waiting for Finance action</small></article><article><span>Paid</span><strong>{paidCount}</strong><small>Payment and ledger completed</small></article><article><span>All received</span><strong>{financeRecords.length}</strong><small>Petty Cash requests received</small></article></section>
    <ActionQueueFilterCard title="Find a Petty Cash Request" description="Search, filter and sort Finance Petty Cash requests." placeholder="Reference, requester or supplier" search={queueFilter.search} onSearchChange={queueFilter.setSearch} status={queueFilter.status} onStatusChange={queueFilter.setStatus} statusOptions={[{ value: 'PENDING', label: 'Requires processing' }, { value: 'PAID', label: 'Reconciled' }, { value: 'ALL', label: 'All statuses' }]} month={queueFilter.month} onMonthChange={queueFilter.changeMonth} exactDate={queueFilter.exactDate} onExactDateChange={queueFilter.setExactDate} sort={queueFilter.sort} onSortChange={queueFilter.setSort} onClear={queueFilter.clear} />
    <section className={styles.managerQueuePanel}>
      <div className={styles.managerQueueHeader}><div><h2>Petty Cash payments for Finance</h2><p>Open a request to verify its expenses, receipts and payment information.</p></div><PaymentViewToggle label="Choose Petty Cash queue view" onChange={setViewMode} value={viewMode} /></div>

      {error ? <div className={styles.error}>{error}</div> : visible.length === 0 ? <div className={styles.managerEmpty}><h2>No Petty Cash payments found</h2><p>There are no requests matching this filter.</p></div> : viewMode === 'grid' ? <div className={styles.managerCardGrid}>{pagination.pageRecords.map((record) => <RequestCard key={record.id} record={record} />)}</div> : <div className={styles.managerTableWrapper}><table><thead><tr><th>Request</th><th>Requester</th><th>Location</th><th>Entries</th><th>Amount</th><th>Status</th><th><span className={styles.srOnly}>Action</span></th></tr></thead><tbody>{pagination.pageRecords.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong><small>{date(record.requestDate)}</small></td><td>{record.requesterName}</td><td>{location(record)}</td><td>{record.lines.length}</td><td className={styles.managerAmount}>{money(record.totalAmount)}</td><td><PettyCashStatusBadge status={record.status} /></td><td className={styles.managerActionCell}><Link href={`/beta/finance/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}`}>{record.status === 'PENDING_FINANCE_REVIEW' ? 'Review request' : pendingStatuses.includes(record.status) ? 'Process payment' : 'View details'}</Link></td></tr>)}</tbody></table></div>}
      {!error && visible.length > 0 && <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />}
    </section>
  </main>;
}

function RequestCard({ record }: { record: PettyCashRecord }) { return <article className={styles.managerRequestCard}><div className={styles.managerCardTop}><span>{record.requestNumber}</span><PettyCashStatusBadge status={record.status} /></div><h2>{record.requesterName}</h2><p>{record.lines.length} expense {record.lines.length === 1 ? 'entry' : 'entries'}</p><dl><div><dt>Location</dt><dd>{location(record)}</dd></div><div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div><div><dt>Manager reviewed</dt><dd>{date(record.managerApprovedAt ?? record.updatedAt)}</dd></div><div><dt>Payment reference</dt><dd>{record.paymentReference || '—'}</dd></div></dl><Link href={`/beta/finance/payment-requests/petty-cash/${encodeURIComponent(record.requestNumber)}`}>{record.status === 'PENDING_FINANCE_REVIEW' ? 'Review request' : pendingStatuses.includes(record.status) ? 'Process payment' : 'View details'}</Link></article>; }
function StatePage({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>; }



'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchInvoicePayments } from '@/data/payment-requests/invoice-payment/api';
import type { InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from './invoice-payment-director.module.css';

type Filter = 'PENDING' | 'FORWARDED' | 'ALL';
type ViewMode = 'grid' | 'list';

function money(value: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}

export function InvoicePaymentDirectorQueue() {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const [records, setRecords] = useState<InvoicePaymentRequestRecord[]>([]);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const session = readBetaSession(); setAccount(session);
    if (!session || session.role !== 'director') { setChecked(true); return; }
    fetchInvoicePayments({ role: 'director', userId: session.id }).then(setRecords).finally(() => setChecked(true));
  }, []);

  const assigned = useMemo(
    () => records
      .filter((record) => record.directorApproverId === account?.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [account, records],
  );
  const pendingCount = assigned.filter((record) => record.status === 'PENDING_DIRECTOR_REVIEW').length;
  const forwardedCount = assigned.filter((record) => record.status === 'PENDING_FINANCE_REVIEW' || record.status === 'COMPLETED').length;
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assigned.filter((record) => {
      if (filter === 'PENDING' && record.status !== 'PENDING_DIRECTOR_REVIEW') return false;
      if (filter === 'FORWARDED' && record.status !== 'PENDING_FINANCE_REVIEW' && record.status !== 'COMPLETED') return false;
      return !query || [record.requestNumber, record.title, record.vendorName, record.projectName, record.staffName]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [assigned, filter, search]);
  const pagination = useListPagination(visible);

  if (!checked) return <StatePage title="Loading Invoice Payments" copy="Checking your Director assignments…" />;
  if (!account || account.role !== 'director') return <StatePage title="Director access required" copy="This page is available only to the assigned Director." />;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p>Director workspace</p><h1>Invoice Payment approvals</h1><span>Review Manager-approved requests and forward them to Finance.</span></div>
        <div className={styles.accountCard}><span>Signed in as</span><strong>{account.name}</strong><small>{account.position}</small></div>
      </header>

      <section className={styles.summaryGrid}>
        <article><span>Requires approval</span><strong>{pendingCount}</strong><small>Waiting for your action</small></article>
        <article><span>Forwarded</span><strong>{forwardedCount}</strong><small>Sent to Finance</small></article>
        <article><span>All assigned</span><strong>{assigned.length}</strong><small>Your Invoice Payments</small></article>
      </section>

      <section className={styles.queuePanel}>
        <div className={styles.queueHeader}>
          <div><h2>Assigned Invoice Payments</h2><p>Open a request to inspect its invoice, documents and Manager review.</p></div>
          <label className={styles.searchField}><span>Search</span><input type="search" placeholder="Request number or vendor" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="group" aria-label="Invoice Payment filters">
            <button data-active={filter === 'PENDING'} type="button" onClick={() => setFilter('PENDING')}>Requires approval <span>{pendingCount}</span></button>
            <button data-active={filter === 'FORWARDED'} type="button" onClick={() => setFilter('FORWARDED')}>Forwarded <span>{forwardedCount}</span></button>
            <button data-active={filter === 'ALL'} type="button" onClick={() => setFilter('ALL')}>All <span>{assigned.length}</span></button>
          </div>
          <div className={styles.viewToggle} role="group" aria-label="Choose queue view">
            <button aria-pressed={viewMode === 'grid'} data-active={viewMode === 'grid'} type="button" onClick={() => setViewMode('grid')}>▦ Grid</button>
            <button aria-pressed={viewMode === 'list'} data-active={viewMode === 'list'} type="button" onClick={() => setViewMode('list')}>☷ List</button>
          </div>
        </div>
        {visible.length === 0 ? <div className={styles.emptyState}><h2>No Invoice Payments found</h2><p>There are no assigned requests matching this filter.</p></div> : (
          viewMode === 'grid'
            ? <div className={styles.cardGrid}>{pagination.pageRecords.map((record) => <RequestCard key={record.id} record={record} />)}</div>
            : <div className={styles.tableWrapper}><table><thead><tr><th>Request</th><th>Staff</th><th>Vendor</th><th>Project</th><th>Amount</th><th>Status</th><th><span className={styles.srOnly}>Action</span></th></tr></thead><tbody>{pagination.pageRecords.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong></td><td>{record.staffName}</td><td>{record.vendorName}</td><td>{record.projectName}</td><td className={styles.amount}>{money(record.totalAmount)}</td><td><StatusBadge status={record.status} /></td><td className={styles.actionCell}><Link href={`/beta/director/payment-requests/invoice-payments/${record.id}`}>{record.status === 'PENDING_DIRECTOR_REVIEW' ? 'Review request' : 'View details'}</Link></td></tr>)}</tbody></table></div>
        )}
        <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
      </section>
    </main>
  );
}

function RequestCard({ record }: { record: InvoicePaymentRequestRecord }) {
  return <article className={styles.requestCard}><div className={styles.cardTop}><span>{record.requestNumber}</span><StatusBadge status={record.status} /></div><h2>{record.title}</h2><p>{record.vendorName}</p><dl><div><dt>Project</dt><dd>{record.projectName}</dd></div><div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div><div><dt>Requested by</dt><dd>{record.staffName}</dd></div><div><dt>Documents</dt><dd>{record.supportingDocuments.length}</dd></div></dl><Link href={`/beta/director/payment-requests/invoice-payments/${record.id}`}>{record.status === 'PENDING_DIRECTOR_REVIEW' ? 'Review request' : 'View details'}</Link></article>;
}

function StatusBadge({ status }: { status: InvoicePaymentRequestRecord['status'] }) {
  const label = status === 'PENDING_DIRECTOR_REVIEW' ? 'Director approval required' : status === 'PENDING_FINANCE_REVIEW' ? 'Forwarded to Finance' : status === 'COMPLETED' ? 'Completed' : status === 'RETURNED_TO_STAFF' ? 'Returned to Staff' : status.replaceAll('_', ' ');
  return <span className={styles.statusBadge} data-status={status}>{label}</span>;
}

function StatePage({ title, copy }: { title: string; copy: string }) {
  return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>;
}

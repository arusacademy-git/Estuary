'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchClaimRequests } from '@/data/payment-requests/claims/api';
import { CLAIM_TYPES, claimTypeDetails, type ClaimRecord } from '@/domain/payment-requests/claims/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from '../claim-workflow.module.css';

type Filter = 'ACTIVE' | 'FORWARDED' | 'ALL';
type ViewMode = 'grid' | 'list';

function date(value: string) {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
}

function money(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency', currency: 'MYR', minimumFractionDigits: 2,
  }).format(value);
}

function statusLabel(record: ClaimRecord) {
  if (record.status === 'PENDING_MANAGER_APPROVAL') return 'Pending Manager Review';
  if (record.status === 'PENDING_DIRECTOR_APPROVAL') return 'Pending Director Review';
  if (record.status === 'PENDING_FINANCE_PROCESSING') return 'Pending Finance Processing';
  if (record.status === 'RETURNED_TO_CLAIMANT') return 'Returned for Correction';
  if (record.status === 'PAID') return 'Completed';
  return record.status.replaceAll('_', ' ');
}

function needsManagerPreview(record: ClaimRecord) {
  return !record.managerApprovedAt && !['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status);
}

export function ClaimManagerQueue() {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [checked, setChecked] = useState(() => !account || account.role !== 'manager');
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [claimType, setClaimType] = useState('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!account || account.role !== 'manager') return;
    let cancelled = false;
    fetchClaimRequests({ role: 'manager', userId: account.id })
      .then((values) => { if (!cancelled) setRecords(values); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Claims could not be loaded.'); })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [account]);

  const activeCount = records.filter(needsManagerPreview).length;
  const forwardedCount = records.filter((record) => Boolean(record.managerApprovedAt)).length;
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (filter === 'ACTIVE' && !needsManagerPreview(record)) return false;
      if (filter === 'FORWARDED' && !record.managerApprovedAt) return false;
      if (claimType !== 'ALL' && record.claimType !== claimType) return false;
      return !term || [record.claimNumber, record.requesterName, claimTypeDetails(record.claimType).label]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [claimType, filter, records, search]);
  const pagination = useListPagination(visible);

  if (!checked) return <State title="Loading Claims" copy="Checking your assigned reviews…" />;
  if (!account || account.role !== 'manager') return <State title="Manager access required" copy="This page is available only to Managers." />;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p>Manager workspace</p><h1>Claim previews</h1><span>Preview assigned Claims for tracking without delaying Finance processing.</span></div>
        <aside><span>Signed in as</span><strong>{account.name}</strong><small>{account.position}</small></aside>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <section className={styles.summaryGrid}>
        <article><span>Awaiting preview</span><strong>{activeCount}</strong></article>
        <article><span>Previewed</span><strong>{forwardedCount}</strong></article>
        <article><span>All Manager records</span><strong>{records.length}</strong></article>
      </section>

      <section className={styles.queuePanel}>
        <div className={styles.queueHeader}>
          <div><h2>Claim requests</h2><p>Open a Claim to review its type, expenses, receipts and approval progress.</p></div>
          <div className={styles.queueFilters}>
            <label><span>Claim type</span><select aria-label="Filter Claims by type" onChange={(event) => setClaimType(event.target.value)} value={claimType}><option value="ALL">All Claim types</option>{CLAIM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label><span>Search</span><input aria-label="Search Claims" onChange={(event) => setSearch(event.target.value)} placeholder="Claim number, claimant or type" type="search" value={search} /></label>
          </div>
        </div>
        <div className={styles.tabs}>
          <button data-active={filter === 'ACTIVE'} onClick={() => setFilter('ACTIVE')} type="button">Awaiting preview <span>{activeCount}</span></button>
          <button data-active={filter === 'FORWARDED'} onClick={() => setFilter('FORWARDED')} type="button">Previewed <span>{forwardedCount}</span></button>
          <button data-active={filter === 'ALL'} onClick={() => setFilter('ALL')} type="button">All <span>{records.length}</span></button>
        </div>
        <div className={styles.queueDisplayBar}>
          <span>Showing {visible.length} {visible.length === 1 ? 'Claim' : 'Claims'}</span>
          <div className={styles.viewToggle} role="group" aria-label="Claims view">
            <span>View</span>
            <button data-active={viewMode === 'grid'} onClick={() => setViewMode('grid')} type="button">▦ Grid</button>
            <button data-active={viewMode === 'list'} onClick={() => setViewMode('list')} type="button">☷ List</button>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className={styles.empty}><h2>No Claims found</h2><p>There are no assigned Claims matching this filter.</p></div>
        ) : viewMode === 'grid' ? (
          <div className={styles.claimQueueGrid}>{pagination.pageRecords.map((record) => (
            <article className={styles.claimQueueCard} key={record.id}>
              <div className={styles.claimCardTop}>
                <strong>{record.claimNumber}</strong>
                <span className={styles.status} data-status={record.status}>{statusLabel(record)}</span>
              </div>
              <h3>{record.requesterName}</h3>
              <p>{record.requesterPosition}</p>
              <dl className={styles.claimCardDetails}>
                <div><dt>Claim type</dt><dd>{claimTypeDetails(record.claimType).label}</dd></div>
                <div><dt>Claim date</dt><dd>{date(record.claimDate)}</dd></div>
                <div><dt>Items</dt><dd>{record.lines.length}</dd></div>
                <div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div>
              </dl>
              <Link href={`/beta/project-manager/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`}>{needsManagerPreview(record) ? 'Preview Claim' : 'View progress'}</Link>
            </article>
          ))}</div>
        ) : (
          <div className={styles.tableWrapper}><table>
            <thead><tr><th>Reference</th><th>Claimant</th><th>Type</th><th>Claim date</th><th>Items</th><th>Amount</th><th>Status</th><th /></tr></thead>
            <tbody>{pagination.pageRecords.map((record) => <tr key={record.id}>
              <td><strong>{record.claimNumber}</strong></td>
              <td>{record.requesterName}<small>{record.requesterPosition}</small></td>
              <td>{claimTypeDetails(record.claimType).label}</td>
              <td>{date(record.claimDate)}</td>
              <td>{record.lines.length}</td>
              <td><strong>{money(record.totalAmount)}</strong></td>
              <td><span className={styles.status} data-status={record.status}>{statusLabel(record)}</span></td>
              <td><Link href={`/beta/project-manager/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`}>{needsManagerPreview(record) ? 'Preview Claim' : 'View progress'}</Link></td>
            </tr>)}</tbody>
          </table></div>
        )}
        <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
      </section>
    </main>
  );
}

function State({ title, copy }: { title: string; copy: string }) {
  return <main className={styles.state}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>;
}

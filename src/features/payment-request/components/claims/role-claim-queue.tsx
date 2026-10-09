'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchClaimRequests } from '@/data/payment-requests/claims/api';
import { CLAIM_TYPES, claimTypeDetails, type ClaimRecord } from '@/domain/payment-requests/claims/types';
import { readBetaSession, type BetaAccount, type BetaRole } from '@/lib/auth/beta-accounts';

import { claimDate } from './claim-review-shared';
import styles from './claim-workflow.module.css';

type Filter = 'ACTIVE' | 'PROCESSED' | 'ALL';
type ViewMode = 'grid' | 'list';

function money(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency', currency: 'MYR', minimumFractionDigits: 2,
  }).format(value);
}

function statusLabel(status: ClaimRecord['status']) {
  if (status === 'PENDING_MANAGER_APPROVAL') return 'Pending Manager Review';
  if (status === 'PENDING_DIRECTOR_APPROVAL') return 'Pending Director Review';
  if (status === 'PENDING_FINANCE_PROCESSING') return 'Pending Finance Processing';
  if (status === 'RETURNED_TO_CLAIMANT') return 'Returned for Correction';
  if (status === 'PAID') return 'Completed';
  return status.replaceAll('_', ' ');
}

export function RoleClaimQueue({
  role,
  title,
  copy,
  basePath,
}: {
  role: Extract<BetaRole, 'director' | 'finance'>;
  title: string;
  copy: string;
  pendingStatus: ClaimRecord['status'];
  basePath: string;
}) {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [checked, setChecked] = useState(
    () => !account || account.role !== role,
  );
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [claimType, setClaimType] = useState('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!account || account.role !== role) return;
    fetchClaimRequests({ role, userId: account.id })
      .then(setRecords)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Claims could not be loaded.'))
      .finally(() => setChecked(true));
  }, [account, role]);

  const needsAction = (record: ClaimRecord) => role === 'director'
    ? !record.directorReviewedAt && !['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status)
    : ['PENDING_MANAGER_APPROVAL', 'PENDING_DIRECTOR_APPROVAL', 'PENDING_FINANCE_PROCESSING'].includes(record.status);
  const activeCount = records.filter(needsAction).length;
  const processedCount = records.filter((record) => {
    if (role === 'director') return Boolean(record.directorReviewedAt);
    return record.status === 'PAID';
  }).length;
  const visible = (() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (filter === 'ACTIVE' && !needsAction(record)) return false;
      if (filter === 'PROCESSED') {
        const processed = role === 'director'
          ? Boolean(record.directorReviewedAt)
          : record.status === 'PAID';
        if (!processed) return false;
      }
      if (claimType !== 'ALL' && record.claimType !== claimType) return false;
      return !term || [record.claimNumber, record.requesterName, claimTypeDetails(record.claimType).label]
        .some((value) => value.toLowerCase().includes(term));
    });
  })();
  const pagination = useListPagination(visible);

  if (!checked) return <State title="Loading Claims" copy="Checking assigned Claims…" />;
  if (!account || account.role !== role) return <State title={`${role === 'director' ? 'Director' : 'Finance'} access required`} copy="This Claims workspace is not available for the signed-in role." />;

  const processedLabel = role === 'director' ? 'Forwarded / completed' : 'Completed payments';
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div><p>{role === 'director' ? 'Director workspace' : 'Finance workspace'}</p><h1>{title}</h1><span>{copy}</span>{role === 'director' && activeCount > 0 && <Link className={styles.bulkPreviewButton} href="/beta/director/payment-requests/claims/bulk">Bulk preview Claims</Link>}</div>
        <aside><span>Signed in as</span><strong>{account.name}</strong><small>{account.position}</small></aside>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <section className={styles.summaryGrid}>
        <article><span>Requires your action</span><strong>{activeCount}</strong></article>
        <article><span>{processedLabel}</span><strong>{processedCount}</strong></article>
        <article><span>All visible Claims</span><strong>{records.length}</strong></article>
      </section>

      <section className={styles.queuePanel}>
        <div className={styles.queueHeader}>
          <div><h2>{role === 'director' ? 'Assigned Claim previews' : 'Claims ready for processing'}</h2><p>Open a Claim to inspect the form details, supporting receipts and workflow history.</p></div>
          <div className={styles.queueFilters}>
            <label><span>Claim type</span><select aria-label="Filter Claims by type" onChange={(event) => setClaimType(event.target.value)} value={claimType}><option value="ALL">All Claim types</option>{CLAIM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label><span>Search</span><input aria-label="Search Claims" onChange={(event) => setSearch(event.target.value)} placeholder="Claim number, claimant or type" type="search" value={search} /></label>
          </div>
        </div>
        <div className={styles.tabs}>
          <button data-active={filter === 'ACTIVE'} onClick={() => setFilter('ACTIVE')} type="button">Requires action <span>{activeCount}</span></button>
          <button data-active={filter === 'PROCESSED'} onClick={() => setFilter('PROCESSED')} type="button">{role === 'director' ? 'Forwarded' : 'Completed'} <span>{processedCount}</span></button>
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
          <div className={styles.empty}><h2>No Claims found</h2><p>There are no Claims matching this filter.</p></div>
        ) : viewMode === 'grid' ? (
          <div className={styles.claimQueueGrid}>{pagination.pageRecords.map((record) => (
            <article className={styles.claimQueueCard} key={record.id}>
              <div className={styles.claimCardTop}>
                <strong>{record.claimNumber}</strong>
                <span className={styles.status} data-status={record.status}>{statusLabel(record.status)}</span>
              </div>
              <h3>{record.requesterName}</h3>
              <p>{record.requesterPosition} · <span className={styles.capitalize}>{record.requesterRole}</span></p>
              <dl className={styles.claimCardDetails}>
                <div><dt>Claim type</dt><dd>{claimTypeDetails(record.claimType).label}</dd></div>
                <div><dt>Claim date</dt><dd>{claimDate(record.claimDate)}</dd></div>
                <div><dt>Items</dt><dd>{record.lines.length}</dd></div>
                <div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div>
              </dl>
              <Link href={`${basePath}/${encodeURIComponent(record.claimNumber)}`}>{needsAction(record) ? role === 'director' ? 'Preview Claim' : 'Process Claim' : 'View progress'}</Link>
            </article>
          ))}</div>
        ) : (
          <div className={styles.tableWrapper}><table>
            <thead><tr><th>Reference</th><th>Claimant</th><th>Role</th><th>Type</th><th>Claim date</th><th>Items</th><th>Amount</th><th>Status</th><th /></tr></thead>
            <tbody>{pagination.pageRecords.map((record) => <tr key={record.id}>
              <td><strong>{record.claimNumber}</strong></td>
              <td>{record.requesterName}<small>{record.requesterPosition}</small></td>
              <td className={styles.capitalize}>{record.requesterRole}</td>
              <td>{claimTypeDetails(record.claimType).label}</td>
              <td>{claimDate(record.claimDate)}</td>
              <td>{record.lines.length}</td>
              <td><strong>{money(record.totalAmount)}</strong></td>
              <td><span className={styles.status} data-status={record.status}>{statusLabel(record.status)}</span></td>
              <td><Link href={`${basePath}/${encodeURIComponent(record.claimNumber)}`}>{needsAction(record) ? role === 'director' ? 'Preview Claim' : 'Process Claim' : 'View progress'}</Link></td>
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

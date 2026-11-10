'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ActionQueueFilterCard } from '@/components/ui/action-queue-filter/action-queue-filter-card';
import { useActionQueueFilter } from '@/components/ui/action-queue-filter/use-action-queue-filter';
import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { PaymentViewToggle } from '@/components/ui/payment-view-toggle';
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
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Requests could not be loaded.');
        }
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const assigned = useMemo(
    () =>
      records
        .filter(
          (record) =>
            record.managerApproverId === account?.id || record.financeReviewerId === account?.id
        )
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [account, records]
  );

  const pendingCount = assigned.filter((record) => !record.managerApprovedAt).length;
  const forwardedCount = assigned.filter((record) => Boolean(record.managerApprovedAt)).length;

  const queueFilter = useActionQueueFilter({
    records: assigned,
    initialStatus: 'PENDING' as Filter,
    getUpdatedAt: (record) => record.updatedAt,
    getAmount: (record) => record.totalAmount,
    getSearchText: (record) => [
      record.requestNumber,
      record.requesterName,
      location(record),
      record.notes ?? '',
      ...record.lines.flatMap((line) => [line.supplier, line.details]),
    ],
    matchesStatus: (record, filter) => {
      if (filter === 'PENDING') return !record.managerApprovedAt;
      if (filter === 'FORWARDED') return Boolean(record.managerApprovedAt);
      return true;
    },
  });

  const visible = queueFilter.filteredRecords;
  const pagination = useListPagination(visible);

  if (!sessionChecked) {
    return <StatePage title="Loading Petty Cash requests" copy="Checking your Manager assignments…" />;
  }
  if (!account || account.role !== 'manager') {
    return (
      <StatePage
        title="Manager access required"
        copy="This page is available only to the assigned Manager."
      />
    );
  }

  return (
    <main className={styles.managerPage}>
      <header className={styles.managerHeader}>
        <div>
          <p className={styles.eyebrow}>Manager workspace</p>
          <h1>Petty Cash reviews</h1>
          <p>
            Approve Staff requests before they move to the Director. Other assigned requests remain
            informational previews.
          </p>
          {pendingCount > 0 && (
            <Link
              className={styles.bulkPreviewButton}
              href="/beta/project-manager/payment-requests/petty-cash/bulk"
            >
              Review Petty Cash requests
            </Link>
          )}
        </div>
        <div className={styles.managerAccountCard}>
          <span>Signed in as</span>
          <strong>{account.name}</strong>
          <small>{account.position}</small>
        </div>
      </header>

      <section className={styles.managerSummary}>
        <article>
          <span>Needs review</span>
          <strong>{pendingCount}</strong>
          <small>Approval or preview action</small>
        </article>
        <article>
          <span>Reviewed</span>
          <strong>{forwardedCount}</strong>
          <small>Your action is recorded</small>
        </article>
        <article>
          <span>All assigned</span>
          <strong>{assigned.length}</strong>
          <small>Your Petty Cash requests</small>
        </article>
      </section>

      <ActionQueueFilterCard
        title="Find a Petty Cash Request"
        description="Search, filter and sort Petty Cash requests."
        placeholder="Reference, requester or supplier"
        search={queueFilter.search}
        onSearchChange={queueFilter.setSearch}
        status={queueFilter.status}
        onStatusChange={queueFilter.setStatus}
        statusOptions={[
          { value: 'PENDING', label: 'Needs review' },
          { value: 'FORWARDED', label: 'Reviewed' },
          { value: 'ALL', label: 'All statuses' },
        ]}
        month={queueFilter.month}
        onMonthChange={queueFilter.changeMonth}
        exactDate={queueFilter.exactDate}
        onExactDateChange={queueFilter.setExactDate}
        sort={queueFilter.sort}
        onSortChange={queueFilter.setSort}
        onClear={queueFilter.clear}
      />

      <section className={styles.managerQueuePanel}>
        <div className={styles.managerQueueHeader}>
          <div>
            <h2>Assigned Petty Cash requests</h2>
            <p>Open a request to inspect its planned expenses and payment progress.</p>
          </div>
          <PaymentViewToggle label="Choose Petty Cash queue view" onChange={setViewMode} value={viewMode} />
        </div>

        {error ? (
          <div className={styles.error}>{error}</div>
        ) : visible.length === 0 ? (
          <div className={styles.managerEmpty}>
            <h2>No Petty Cash requests found</h2>
            <p>There are no assigned requests matching this filter.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles.managerCardGrid}>
            {pagination.pageRecords.map((record) => (
              <RequestCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <div className={styles.managerTableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Staff</th>
                  <th>Location</th>
                  <th>Entries</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>
                    <span className={styles.srOnly}>Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.requestNumber}</strong>
                      <small>{date(record.requestDate)}</small>
                    </td>
                    <td>{record.requesterName}</td>
                    <td>{location(record)}</td>
                    <td>{record.lines.length}</td>
                    <td className={styles.managerAmount}>{money(record.totalAmount)}</td>
                    <td>
                      <PettyCashStatusBadge status={record.status} />
                    </td>
                    <td className={styles.managerActionCell}>
                      <Link
                        href={`/beta/project-manager/payment-requests/petty-cash/${encodeURIComponent(
                          record.requestNumber
                        )}`}
                      >
                        {record.managerApprovedAt
                          ? 'View details'
                          : record.requesterRole === 'staff'
                            ? 'Review request'
                            : 'Preview request'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!error && visible.length > 0 && (
          <ListPagination
            currentPage={pagination.currentPage}
            firstRecord={pagination.firstRecord}
            lastRecord={pagination.lastRecord}
            pageCount={pagination.pageCount}
            pageSize={pagination.pageSize}
            totalRecords={pagination.totalRecords}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        )}
      </section>
    </main>
  );
}

interface RequestCardProps {
  record: PettyCashRecord;
}

function RequestCard({ record }: RequestCardProps) {
  return (
    <article className={styles.managerRequestCard}>
      <div className={styles.managerCardTop}>
        <span>{record.requestNumber}</span>
        <PettyCashStatusBadge status={record.status} />
      </div>
      <h2>{record.requesterName}</h2>
      <p>
        {record.lines.length} expense {record.lines.length === 1 ? 'entry' : 'entries'}
      </p>
      <dl>
        <div>
          <dt>Location</dt>
          <dd>{location(record)}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{money(record.totalAmount)}</dd>
        </div>
        <div>
          <dt>Request date</dt>
          <dd>{date(record.requestDate)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{date(record.updatedAt)}</dd>
        </div>
      </dl>
      <Link
        href={`/beta/project-manager/payment-requests/petty-cash/${encodeURIComponent(
          record.requestNumber
        )}`}
      >
        {record.managerApprovedAt
          ? 'View details'
          : record.requesterRole === 'staff'
            ? 'Review request'
            : 'Preview request'}
      </Link>
    </article>
  );
}

interface StatePageProps {
  title: string;
  copy: string;
}

function StatePage({ title, copy }: StatePageProps) {
  return (
    <main className={styles.statePage}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href="/beta/dashboard">Back to dashboard</Link>
    </main>
  );
}
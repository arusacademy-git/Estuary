'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchTravelAllowances } from '@/data/payment-requests/travel-allowance/api';
import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from '../travel-allowance-workflow.module.css';

type Filter = 'ACTIVE' | 'FORWARDED' | 'ALL';
const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
function statusLabel(status: TravelAllowanceRecord['status']) { return status === 'PENDING_MANAGER_REVIEW' ? 'Pending Manager Review' : status === 'PENDING_DIRECTOR_APPROVAL' ? 'Pending Director Approval' : status === 'PENDING_FINANCE_VERIFICATION' ? 'Pending Finance Verification' : status === 'RETURNED_TO_STAFF' ? 'Returned for Correction' : 'Completed'; }

export function TravelAllowanceDirectorQueue() {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [records, setRecords] = useState<TravelAllowanceRecord[]>([]);
  const [checked, setChecked] = useState(false);
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const session = readBetaSession();
    setAccount(session);
    if (!session || session.role !== 'director') { setChecked(true); return; }
    fetchTravelAllowances({ role: 'director', userId: session.id })
      .then(setRecords)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Requests could not be loaded.'))
      .finally(() => setChecked(true));
  }, []);

  const activeCount = records.filter((record) => record.status === 'PENDING_DIRECTOR_APPROVAL').length;
  const forwardedCount = records.filter((record) => ['PENDING_FINANCE_VERIFICATION', 'COMPLETED'].includes(record.status)).length;
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (filter === 'ACTIVE' && record.status !== 'PENDING_DIRECTOR_APPROVAL') return false;
      if (filter === 'FORWARDED' && !['PENDING_FINANCE_VERIFICATION', 'COMPLETED'].includes(record.status)) return false;
      return !query || [record.requestNumber, record.requesterName, ...record.lines.flatMap((line) => [line.employeeName, line.projectName])].some((value) => value.toLowerCase().includes(query));
    });
  }, [filter, records, search]);
  const pagination = useListPagination(visible);

  if (!checked) return <State title="Loading Travel Allowances" copy="Reading Director assignments from the database…" />;
  if (!account || account.role !== 'director') return <State title="Director access required" copy="Sign in using a Director account." />;
  return <main className={styles.page}>
    <header className={styles.pageHeader}><div><p>Director workspace</p><h1>Travel Allowance approvals</h1><span>Review assigned requests and forward approved allowances to Finance.</span></div><aside><span>Signed in as</span><strong>{account.name}</strong><small>{account.position}</small></aside></header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <section className={styles.summaryGrid}><article><span>Requires approval</span><strong>{activeCount}</strong></article><article><span>Forwarded / completed</span><strong>{forwardedCount}</strong></article><article><span>All assigned</span><strong>{records.length}</strong></article></section>
    <section className={styles.queuePanel}>
      <div className={styles.queueHeader}><div><h2>Assigned Travel Allowances</h2><p>Open a request to inspect its entries, Manager review and total.</p></div><div className={styles.queueControls}><label><span>Search</span><input type="search" placeholder="TA number, employee or project" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div></div>
      <div className={styles.tabs}><button data-active={filter === 'ACTIVE'} type="button" onClick={() => setFilter('ACTIVE')}>Requires approval <span>{activeCount}</span></button><button data-active={filter === 'FORWARDED'} type="button" onClick={() => setFilter('FORWARDED')}>Forwarded <span>{forwardedCount}</span></button><button data-active={filter === 'ALL'} type="button" onClick={() => setFilter('ALL')}>All <span>{records.length}</span></button></div>
      {visible.length === 0 ? <div className={styles.empty}><h2>No Travel Allowances found</h2><p>There are no assigned requests matching this filter.</p></div> : <div className={styles.tableWrapper}><table><thead><tr><th>Reference</th><th>Staff</th><th>First travel date</th><th>Entries</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{pagination.pageRecords.map((record) => { const firstDate = [...record.lines].sort((a, b) => a.travelDate.localeCompare(b.travelDate))[0]?.travelDate; const employees = [...new Set(record.lines.map((line) => line.employeeName))].filter(Boolean); return <tr key={record.id}><td><strong>{record.requestNumber}</strong></td><td>{employees.join(', ') || record.requesterName}</td><td>{firstDate || '—'}</td><td>{record.lines.length}</td><td><strong>{money(record.totalAmount)}</strong></td><td><span className={styles.status} data-status={record.status}>{statusLabel(record.status)}</span></td><td><Link href={`/beta/director/payment-requests/travel-allowances/${record.id}`}>{record.status === 'PENDING_DIRECTOR_APPROVAL' ? 'Review request' : 'View progress'}</Link></td></tr>; })}</tbody></table></div>}
      <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
    </section>
  </main>;
}

function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.state}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>; }

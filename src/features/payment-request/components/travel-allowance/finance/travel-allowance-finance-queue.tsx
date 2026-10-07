'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchTravelAllowances } from '@/data/payment-requests/travel-allowance/api';
import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from '../travel-allowance-workflow.module.css';

type Filter = 'PENDING' | 'COMPLETED' | 'ALL';
const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
function statusLabel(status: TravelAllowanceRecord['status']) { return status === 'PENDING_FINANCE_VERIFICATION' ? 'Pending Finance Verification' : status === 'COMPLETED' ? 'Completed' : 'Returned for Correction'; }

export function TravelAllowanceFinanceQueue() {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [records, setRecords] = useState<TravelAllowanceRecord[]>([]);
  const [checked, setChecked] = useState(() => !account || account.role !== 'finance');
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [month, setMonth] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!account || account.role !== 'finance') return;
    let cancelled = false;
    fetchTravelAllowances({ role: 'finance', userId: account.id, month: month || undefined })
      .then((values) => { if (!cancelled) setRecords(values); })
      .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Requests could not be loaded.'); })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [account, month]);

  function changeMonth(value: string) {
    setChecked(false);
    setError('');
    setMonth(value);
  }

  const pendingCount = records.filter((record) => record.status === 'PENDING_FINANCE_VERIFICATION').length;
  const completedCount = records.filter((record) => record.status === 'COMPLETED').length;
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (filter === 'PENDING' && record.status !== 'PENDING_FINANCE_VERIFICATION') return false;
      if (filter === 'COMPLETED' && record.status !== 'COMPLETED') return false;
      return !query || [record.requestNumber, record.requesterName, ...record.lines.flatMap((line) => [line.employeeName, line.projectName])].some((value) => value.toLowerCase().includes(query));
    });
  }, [filter, records, search]);
  const pagination = useListPagination(visible);

  if (!checked) return <State title="Loading Travel Allowances" copy="Reading Finance records from the database…" />;
  if (!account || account.role !== 'finance') return <State title="Finance access required" copy="Sign in using a Finance account." />;
  return <main className={styles.page}>
    <header className={styles.pageHeader}><div><p>Finance workspace</p><h1>Travel Allowance verification</h1><span>Review Director-approved allowances, download TA forms and record payment.</span></div><aside><span>Signed in as</span><strong>{account.name}</strong><small>{account.position}</small></aside></header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <section className={styles.summaryGrid}><article><span>Requires verification</span><strong>{pendingCount}</strong></article><article><span>Completed</span><strong>{completedCount}</strong></article><article><span>Visible records</span><strong>{records.length}</strong></article></section>
    <section className={styles.queuePanel}>
      <div className={styles.queueHeader}><div><h2>Travel Allowances for Finance</h2><p>Filter by travel month, inspect the approved request and download its form.</p></div><div className={styles.queueControls}><label><span>Travel month</span><input type="month" value={month} onChange={(event) => changeMonth(event.target.value)} /></label><label><span>Search</span><input type="search" placeholder="TA number, employee or project" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div></div>
      <div className={styles.tabs}><button data-active={filter === 'PENDING'} type="button" onClick={() => setFilter('PENDING')}>Requires verification <span>{pendingCount}</span></button><button data-active={filter === 'COMPLETED'} type="button" onClick={() => setFilter('COMPLETED')}>Completed <span>{completedCount}</span></button><button data-active={filter === 'ALL'} type="button" onClick={() => setFilter('ALL')}>All <span>{records.length}</span></button></div>
      {visible.length === 0 ? <div className={styles.empty}><h2>No Travel Allowances found</h2><p>There are no Finance records matching these filters.</p></div> : <div className={styles.tableWrapper}><table><thead><tr><th>Reference</th><th>Staff</th><th>Travel month</th><th>Entries</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{pagination.pageRecords.map((record) => { const firstDate = [...record.lines].sort((a, b) => a.travelDate.localeCompare(b.travelDate))[0]?.travelDate; const employees = [...new Set(record.lines.map((line) => line.employeeName))].filter(Boolean); return <tr key={record.id}><td><strong>{record.requestNumber}</strong></td><td>{employees.join(', ') || record.requesterName}</td><td>{firstDate?.slice(0, 7) || '—'}</td><td>{record.lines.length}</td><td><strong>{money(record.totalAmount)}</strong></td><td><span className={styles.status} data-status={record.status}>{statusLabel(record.status)}</span></td><td><Link href={`/beta/finance/payment-requests/travel-allowances/${record.id}`}>{record.status === 'PENDING_FINANCE_VERIFICATION' ? 'Verify request' : 'View record'}</Link></td></tr>; })}</tbody></table></div>}
      <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
    </section>
  </main>;
}

function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.state}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>; }

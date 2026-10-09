'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { useEffect, useMemo, useState } from 'react';

import { fetchTravelAllowances } from '@/data/payment-requests/travel-allowance/api';
import { PAYMENT_RECORD_SORT_OPTIONS, sortPaymentRecords, type PaymentRecordSort } from '@/domain/payment-records/payment-record-sort';
import type { TravelAllowanceRecord, TravelAllowanceStatus } from '@/domain/payment-requests/travel-allowance/types';
import { PaymentRecordZipActions } from '../shared/payment-record-zip-actions';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from './travel-allowance-records.module.css';

type ViewMode = 'grid' | 'list';

const statuses: Array<{ value: 'ALL' | TravelAllowanceStatus; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_MANAGER_REVIEW', label: 'Pending Manager Review' },
  { value: 'PENDING_DIRECTOR_APPROVAL', label: 'Pending Director Approval' },
  { value: 'PENDING_FINANCE_VERIFICATION', label: 'Pending Finance Verification' },
  { value: 'RETURNED_TO_STAFF', label: 'Returned to requester' },
  { value: 'COMPLETED', label: 'Completed' },
];

const labels: Record<TravelAllowanceStatus, string> = {
  PENDING_MANAGER_REVIEW: 'Pending Manager Review',
  PENDING_DIRECTOR_APPROVAL: 'Pending Director Approval',
  PENDING_FINANCE_VERIFICATION: 'Pending Finance Verification',
  RETURNED_TO_STAFF: 'Returned to requester',
  COMPLETED: 'Completed',
};

function money(value: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value); }
function canView(record: TravelAllowanceRecord, account: BetaAccount) {
  if (account.role === 'staff') return record.requesterId === account.id || record.lines.some((line) => line.employeeId === account.id);
  if (account.role === 'manager') return record.managerApproverId === account.id || record.requesterId === account.id;
  if (account.role === 'director') return record.projectDirectorId === account.id;
  return account.role === 'finance';
}
function needsAttention(record: TravelAllowanceRecord, account: BetaAccount) {
  if (account.role === 'staff') return record.status === 'RETURNED_TO_STAFF';
  if (account.role === 'manager') return record.status === 'PENDING_MANAGER_REVIEW' && record.managerApproverId === account.id;
  if (account.role === 'director') return record.status === 'PENDING_DIRECTOR_APPROVAL' && record.projectDirectorId === account.id;
  return record.status === 'PENDING_FINANCE_VERIFICATION';
}

export function TravelAllowanceRecords() {
  const searchParameters = useSearchParams();
  const personalOnly = searchParameters.get('scope') === 'mine';
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const [records, setRecords] = useState<TravelAllowanceRecord[]>([]);
  const [status, setStatus] = useState<'ALL' | TravelAllowanceStatus>('ALL');
  const [month, setMonth] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [sort, setSort] = useState<PaymentRecordSort>('UPDATED_DESC');

  useEffect(() => {
    let cancelled = false;

    // Session lives in the browser, so it is read after mount, inside a callback
    Promise.resolve().then(async () => {
      const session = readBetaSession();
      if (cancelled) return;
      setAccount(session);
      if (!session) {
        setChecked(true);
        return;
      }

      try {
        const data = await fetchTravelAllowances({ role: session.role, userId: session.id, includeAll: true });
        if (!cancelled) setRecords(data);
      } catch (caught: unknown) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Travel Allowance records could not be loaded.',
          );
        }
      } finally {
        if (!cancelled) setChecked(true);
      }
    });

    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => account ? records.filter((record) => personalOnly ? record.requesterId === account.id : canView(record, account)) : [], [account, personalOnly, records]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = visible.filter((record) => {
      if (status !== 'ALL' && record.status !== status) return false;
      if (month && !record.requestDate.startsWith(month)) return false;
      if (specificDate && record.requestDate !== specificDate) return false;
      return !query || [record.requestNumber, record.requesterName, ...record.lines.flatMap((line) => [line.employeeName, line.projectName])].some((value) => (value ?? '').toLowerCase().includes(query));
    });
    return sortPaymentRecords(matching, sort, (record) => ({ reference: record.requestNumber, updatedAt: record.updatedAt, amount: record.totalAmount }));
  }, [month, search, sort, specificDate, status, visible]);
  const downloadableForms = filtered.filter((record) => record.status === 'COMPLETED');
  const zipEntries = downloadableForms.map((record) => ({
    name: `${record.requestNumber}.pdf`,
    url: `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(record.id)}/form`,
  }));
  const pagination = useListPagination(filtered);
  const attention = account ? visible.filter((record) => needsAttention(record, account)).length : 0;
  const completed = visible.filter((record) => record.status === 'COMPLETED').length;

  function clearFilters() { setSearch(''); setStatus('ALL'); setMonth(''); setSpecificDate(''); setSort('UPDATED_DESC'); }
  if (!checked) return <State title="Loading Travel Allowances" copy="Reading your payment records…" />;
  if (!account) return <State title="Sign in required" copy="Sign in to view Travel Allowance records." />;

  return <main className={styles.page}>
    <div className={styles.backRow}><Link href={personalOnly ? '/beta/payment-records?scope=mine' : '/beta/payment-records'}>← Back to {personalOnly ? 'My Requests' : 'Payment Records'}</Link></div>
    <header className={styles.pageHeader}><div><p>{personalOnly ? 'My Requests' : 'Payment Records'}</p><h1>{personalOnly ? 'My Travel Allowance requests' : 'Travel Allowances'}</h1><span>{personalOnly ? 'Track only the Travel Allowance requests you created.' : 'Track requests through Manager, Director and Finance processing.'}</span></div><div className={styles.accountCard}><span>Viewing records for</span><strong>{account.name}</strong><small>{account.position}</small></div></header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <section className={styles.summaryGrid}><article><span>Visible records</span><strong>{visible.length}</strong><small>Available to your role</small></article><article><span>Require attention</span><strong>{attention}</strong><small>Waiting for your action</small></article><article><span>Completed</span><strong>{completed}</strong><small>Verified by Finance</small></article></section>
    <section className={styles.recordsFilterCard}><div className={styles.recordsFilterHeading}><div><h2>Find a Travel Allowance</h2><p>Search, filter and sort your payment records.</p></div><button className={styles.clearFiltersButton} type="button" onClick={clearFilters}>Clear filters</button></div><div className={styles.recordsFilters}><label className={styles.recordsSearchField}><span>Search</span><input type="search" placeholder="TA number, employee or project" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | TravelAllowanceStatus)}>{statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Month</span><input type="month" value={month} onChange={(event) => { const value = event.target.value; setMonth(value); if (specificDate && !specificDate.startsWith(value)) setSpecificDate(''); }} /></label><label><span>Exact date</span><input type="date" value={specificDate} min={month ? `${month}-01` : undefined} max={month ? `${month}-31` : undefined} onChange={(event) => setSpecificDate(event.target.value)} /></label><label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as PaymentRecordSort)}>{PAYMENT_RECORD_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div></section>
    <section className={styles.recordsResults}><div className={styles.recordsResultsHeader}><div><h2>Travel Allowances</h2><p>Showing {filtered.length} of {visible.length} visible records</p></div><div className={styles.zipActions}><PaymentRecordZipActions archiveName="travel-allowance-forms" entries={zipEntries} recordCount={downloadableForms.length}><div className={styles.recordsViewToggle}><span>View</span><button data-active={viewMode === 'grid'} type="button" onClick={() => setViewMode('grid')}>▦ Grid</button><button data-active={viewMode === 'list'} type="button" onClick={() => setViewMode('list')}>☷ List</button></div></PaymentRecordZipActions></div></div>
      {filtered.length === 0 ? <div className={styles.emptyState}><h2>No Travel Allowances found</h2><p>Try clearing the selected filters.</p></div> : viewMode === 'grid' ? <div className={styles.cardGrid}>{pagination.pageRecords.map((record) => <Card key={record.id} record={record} />)}</div> : <div className={styles.tableWrapper}><table><thead><tr><th>Reference</th><th>Employees</th><th>Entries</th><th>Amount</th><th>Updated</th><th>Status</th><th /></tr></thead><tbody>{pagination.pageRecords.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong><small>{record.requesterRole === 'manager' ? 'Manager request' : 'Staff request'}</small></td><td>{[...new Set(record.lines.map((line) => line.employeeName))].join(', ')}</td><td>{record.lines.length}</td><td className={styles.amount}>{money(record.totalAmount)}</td><td>{new Date(record.updatedAt).toLocaleDateString('en-MY')}</td><td><Status status={record.status} /></td><td className={styles.actionCell}><Link href={`/beta/payment-records/travel-allowances/${record.id}`}>View record</Link></td></tr>)}</tbody></table></div>}
      <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
    </section>
  </main>;
}

function Card({ record }: { record: TravelAllowanceRecord }) { const employees = [...new Set(record.lines.map((line) => line.employeeName))].filter(Boolean); return <article className={styles.recordCard}><div className={styles.cardTop}><span>{record.requestNumber}</span><Status status={record.status} /></div><h2>{employees.join(', ') || record.requesterName}</h2><p>{record.lines.length} travel entries</p><dl><div><dt>Total</dt><dd>{money(record.totalAmount)}</dd></div><div><dt>Submitted by</dt><dd>{record.requesterName}</dd></div><div><dt>Payment target</dt><dd>{record.paymentDueDate}</dd></div><div><dt>Documents</dt><dd>{record.supportingDocuments.length}</dd></div></dl><Link href={`/beta/payment-records/travel-allowances/${record.id}`}>View record</Link></article>; }
function Status({ status }: { status: TravelAllowanceStatus }) { return <span className={styles.statusBadge} data-status={status}>{labels[status]}</span>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/payment-records">Back to Payment Records</Link></main>; }
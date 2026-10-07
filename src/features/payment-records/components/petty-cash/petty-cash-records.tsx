'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchPettyCashRequests } from '@/data/payment-requests/petty-cash/api';
import { PAYMENT_RECORD_SORT_OPTIONS, sortPaymentRecords, type PaymentRecordSort } from '@/domain/payment-records/payment-record-sort';
import type { PettyCashLocation, PettyCashRecord, PettyCashStatus } from '@/domain/payment-requests/petty-cash/types';
import { PettyCashStatusBadge } from '@/features/payment-request/components/petty-cash/petty-cash-status-badge';
import styles from '@/features/payment-request/components/petty-cash/petty-cash.module.css';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

type ViewMode = 'grid' | 'list';
const statuses: Array<{ value: 'ALL' | PettyCashStatus; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager Approval' },
  { value: 'PENDING_FINANCE_PAYMENT', label: 'Pending Finance Payment' },
  { value: 'FINANCE_VERIFIED', label: 'Finance Verified' },
  { value: 'RETURNED_TO_STAFF', label: 'Returned to Staff' },
  { value: 'PAID', label: 'Paid' },
];
function money(value: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value); }
function date(value: string) { const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-MY'); }
function needsAttention(record: PettyCashRecord, account: BetaAccount) { if (record.requesterId === account.id && record.status === 'RETURNED_TO_STAFF') return true; if (account.role === 'manager') return record.status === 'PENDING_MANAGER_APPROVAL' && record.managerApproverId === account.id; if (account.role === 'director') return record.status === 'PENDING_DIRECTOR_APPROVAL' && record.directorApproverId === account.id; if (account.role === 'finance') return (record.status === 'PENDING_FINANCE_REVIEW' && record.financeReviewerId === account.id) || ['PENDING_FINANCE_PAYMENT', 'FINANCE_VERIFIED'].includes(record.status); return false; }

export function PettyCashRecords() {
  const query = useSearchParams();
  const personalOnly = query.get('scope') === 'mine';
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const [records, setRecords] = useState<PettyCashRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | PettyCashStatus>('ALL');
  const [location, setLocation] = useState<'ALL' | PettyCashLocation>('ALL');
  const [month, setMonth] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [error, setError] = useState('');
  const [sort, setSort] = useState<PaymentRecordSort>('UPDATED_DESC');

  useEffect(() => { const session = readBetaSession(); setAccount(session); if (!session) { setChecked(true); return; } fetchPettyCashRequests({ role: session.role, userId: session.id, includeAll: true }).then((items) => setRecords(personalOnly ? items.filter((item) => item.requesterId === session.id) : items)).catch((caught) => setError(caught instanceof Error ? caught.message : 'Petty Cash records could not be loaded.')).finally(() => setChecked(true)); }, [personalOnly]);

  const visible = useMemo(() => records, [records]);
  const filtered = useMemo(() => { const term = search.trim().toLowerCase(); const matching = visible.filter((record) => { if (status !== 'ALL' && record.status !== status) return false; if (location !== 'ALL' && record.location !== location) return false; if (month && !record.requestDate.startsWith(month)) return false; if (specificDate && record.requestDate !== specificDate) return false; return !term || [record.requestNumber, record.requesterName, record.notes ?? '', ...record.lines.flatMap((line) => [line.supplier, line.details, line.accountType])].some((value) => value.toLowerCase().includes(term)); }); return sortPaymentRecords(matching, sort, (record) => ({ reference: record.requestNumber, updatedAt: record.updatedAt, amount: record.totalAmount })); }, [location, month, search, sort, specificDate, status, visible]);
  const pagination = useListPagination(filtered);
  const attention = account ? visible.filter((record) => needsAttention(record, account)).length : 0;
  const completed = visible.filter((record) => record.status === 'PAID').length;
  function clearFilters() { setSearch(''); setStatus('ALL'); setLocation('ALL'); setMonth(''); setSpecificDate(''); setSort('UPDATED_DESC'); }

  if (!checked) return <State title="Loading Petty Cash records" copy="Reading your payment records…" />;
  if (!account) return <State title="Sign in required" copy="Sign in to view Petty Cash records." />;

  return <main className={`${styles.workspace} ${styles.recordsPage}`}>
    <div className={styles.backRow}><Link href={personalOnly ? '/beta/payment-records?scope=mine' : '/beta/payment-records'}>← Back to {personalOnly ? 'My Requests' : 'Payment Records'}</Link></div>
    <header className={styles.recordsHeader}><div><p>{personalOnly ? 'My Requests' : 'Payment Records'}</p><h1>{personalOnly ? 'My Petty Cash requests' : 'Petty Cash requests'}</h1><span>{personalOnly ? 'Track only the Petty Cash requests you created.' : 'Track each role-aware review path through Director preview and Finance payment.'}</span></div><div className={styles.accountCard}><span>Viewing records for</span><strong>{account.name}</strong><small>{account.position}</small></div></header>
    {error && <div className={styles.error}>{error}</div>}
    <section className={styles.recordsSummary}><article><span>Visible records</span><strong>{visible.length}</strong><small>Available to your role</small></article><article><span>Require attention</span><strong>{attention}</strong><small>Waiting for your action</small></article><article><span>Completed</span><strong>{completed}</strong><small>Paid by Finance</small></article></section>
    <section className={styles.recordsFilterCard}><div className={styles.recordsFilterHeading}><div><h2>Find a Petty Cash request</h2><p>Search, filter and sort your payment records.</p></div><button type="button" onClick={clearFilters}>Clear filters</button></div><div className={styles.recordsFilters}><label className={styles.recordsSearch}><span>Search</span><input type="search" placeholder="PC number, requester or supplier" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | PettyCashStatus)}>{statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Location</span><select value={location} onChange={(event) => setLocation(event.target.value as 'ALL' | PettyCashLocation)}><option value="ALL">All locations</option><option value="PENANG">Penang</option><option value="KUALA_LUMPUR">Kuala Lumpur</option></select></label><label><span>Month</span><input type="month" value={month} onChange={(event) => { const value = event.target.value; setMonth(value); if (specificDate && !specificDate.startsWith(value)) setSpecificDate(''); }} /></label><label><span>Exact date</span><input type="date" value={specificDate} min={month ? `${month}-01` : undefined} max={month ? `${month}-31` : undefined} onChange={(event) => setSpecificDate(event.target.value)} /></label><label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as PaymentRecordSort)}>{PAYMENT_RECORD_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div></section>
    <section className={styles.recordsResults}><div className={styles.recordsResultsHeader}><div><h2>Petty Cash requests</h2><p>Showing {filtered.length} of {visible.length} visible records</p></div><div aria-label="Choose Petty Cash view" className={styles.recordsViewToggle} role="group"><span>View</span><button aria-pressed={viewMode === 'grid'} data-active={viewMode === 'grid'} type="button" onClick={() => setViewMode('grid')}>▦ Grid</button><button aria-pressed={viewMode === 'list'} data-active={viewMode === 'list'} type="button" onClick={() => setViewMode('list')}>☷ List</button></div></div>
      {filtered.length === 0 ? <div className={styles.empty}><strong>No Petty Cash requests found</strong><p>Try clearing the selected filters.</p></div> : viewMode === 'grid' ? <div className={styles.recordGrid}>{pagination.pageRecords.map((record) => <RecordCard key={record.id} record={record} />)}</div> : <div className={styles.tableWrap}><table className={styles.queueTable}><thead><tr><th>Reference</th><th>Requester</th><th>Entries</th><th>Location</th><th>Amount</th><th>Updated</th><th>Status</th><th /></tr></thead><tbody>{pagination.pageRecords.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong><small>Staff request</small></td><td>{record.requesterName}</td><td>{record.lines.length}</td><td>{record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur'}</td><td className={styles.amount}>{money(record.totalAmount)}</td><td>{date(record.updatedAt)}</td><td><PettyCashStatusBadge status={record.status} /></td><td><Link className={styles.secondaryButton} href={`/beta/payment-records/petty-cash/${encodeURIComponent(record.requestNumber)}`}>View record</Link></td></tr>)}</tbody></table></div>}
      <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
    </section>
  </main>;
}

function RecordCard({ record }: { record: PettyCashRecord }) { return <article className={styles.recordCard}><div className={styles.recordCardTop}><span>{record.requestNumber}</span><PettyCashStatusBadge status={record.status} /></div><h2>{record.requesterName}</h2><p>{record.lines.length} expense {record.lines.length === 1 ? 'entry' : 'entries'}</p><dl><div><dt>Total</dt><dd>{money(record.totalAmount)}</dd></div><div><dt>Location</dt><dd>{record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur'}</dd></div><div><dt>Request date</dt><dd>{date(record.requestDate)}</dd></div><div><dt>Updated</dt><dd>{date(record.updatedAt)}</dd></div></dl><Link href={`/beta/payment-records/petty-cash/${encodeURIComponent(record.requestNumber)}`}>View record</Link></article>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/payment-records">Back to Payment Records</Link></main>; }

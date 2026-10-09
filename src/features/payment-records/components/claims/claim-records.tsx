'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchClaimRequests } from '@/data/payment-requests/claims/api';
import { PAYMENT_RECORD_SORT_OPTIONS, sortPaymentRecords, type PaymentRecordSort } from '@/domain/payment-records/payment-record-sort';
import { CLAIM_TYPES, claimTypeDetails, type ClaimRecord, type ClaimStatus } from '@/domain/payment-requests/claims/types';
import { PaymentRecordZipActions } from '../shared/payment-record-zip-actions';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import styles from './claim-records.module.css';

type ViewMode = 'grid' | 'list';
const statuses: Array<{ value: 'ALL' | ClaimStatus; label: string }> = [
  { value: 'ALL', label: 'All statuses' }, { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager Review' },
  { value: 'PENDING_DIRECTOR_APPROVAL', label: 'Pending Director Preview' },
  { value: 'PENDING_FINANCE_PROCESSING', label: 'Pending Finance Processing' },
  { value: 'RETURNED_TO_CLAIMANT', label: 'Returned to Claimant' }, { value: 'PAID', label: 'Paid' },
];
function money(value: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value)); }
function label(status: ClaimStatus) { return statuses.find((item) => item.value === status)?.label ?? status.replaceAll('_', ' '); }
function needsAttention(record: ClaimRecord, account: BetaAccount) { if (record.requesterId === account.id && ['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status)) return true; if (account.role === 'manager') return record.status === 'PENDING_MANAGER_APPROVAL' && record.managerApproverId === account.id; if (account.role === 'director') return record.status === 'PENDING_DIRECTOR_APPROVAL' && record.directorApproverId === account.id; return account.role === 'finance' && record.status === 'PENDING_FINANCE_PROCESSING'; }
function href(record: ClaimRecord, account: BetaAccount) { if (record.status === 'DRAFT' && record.requesterId === account.id) return `/beta/payment-requests/claims/${encodeURIComponent(record.claimNumber)}/edit`; if (account.role === 'manager' && record.managerApproverId === account.id) return `/beta/project-manager/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`; if (account.role === 'director' && (record.directorApproverId === account.id || record.requesterId === account.id)) return `/beta/director/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`; if (account.role === 'finance') return `/beta/finance/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`; return `/beta/payment-records/claims/${encodeURIComponent(record.claimNumber)}`; }

export function ClaimRecords() {
  const searchParameters = useSearchParams();
  const personalOnly = searchParameters.get('scope') === 'mine';
  const [account, setAccount] = useState<BetaAccount | null>(null); const [checked, setChecked] = useState(false); const [records, setRecords] = useState<ClaimRecord[]>([]); const [status, setStatus] = useState<'ALL' | ClaimStatus>('ALL'); const [claimType, setClaimType] = useState('ALL'); const [month, setMonth] = useState(''); const [specificDate, setSpecificDate] = useState(''); const [search, setSearch] = useState(''); const [sort, setSort] = useState<PaymentRecordSort>('UPDATED_DESC'); const [viewMode, setViewMode] = useState<ViewMode>('list'); const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;

    // Session lives in the browser, so it is read after mount, inside a callback
    Promise.resolve().then(async () => {
      const session = readBetaSession();
      if (cancelled) return;
      setAccount(session);
      if (!session) { setChecked(true); return; }

      try {
        const data = await fetchClaimRequests({ role: session.role, userId: session.id });
        if (!cancelled) setRecords(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Claim records could not be loaded.');
      } finally {
        if (!cancelled) setChecked(true);
      }
    });

    return () => { cancelled = true; };
  }, []);
  const visible = useMemo(() => records.filter((record) => !personalOnly || record.requesterId === account?.id), [account?.id, personalOnly, records]);
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); const matching = visible.filter((record) => { if (status !== 'ALL' && record.status !== status) return false; if (claimType !== 'ALL' && record.claimType !== claimType) return false; if (month && !record.claimDate.startsWith(month)) return false; if (specificDate && record.claimDate !== specificDate) return false; return !query || [record.claimNumber, record.requesterName, claimTypeDetails(record.claimType).label, record.notes ?? ''].some((value) => value.toLowerCase().includes(query)); }); return sortPaymentRecords(matching, sort, (record) => ({ reference: record.claimNumber, updatedAt: record.updatedAt, amount: record.totalAmount })); }, [claimType, month, search, sort, specificDate, status, visible]);
  const downloadableForms = filtered.filter((record) => record.status === 'PAID');
  const zipEntries = downloadableForms.map((record) => ({ name: `${record.claimNumber}.pdf`, url: `/api/v1/payment-requests/claims/${encodeURIComponent(record.claimNumber)}?form=1` }));
  const pagination = useListPagination(filtered); const attention = account ? visible.filter((record) => needsAttention(record, account)).length : 0; const drafts = visible.filter((record) => record.status === 'DRAFT').length; const completed = visible.filter((record) => record.status === 'PAID').length;
  function clearFilters() { setSearch(''); setStatus('ALL'); setClaimType('ALL'); setMonth(''); setSpecificDate(''); setSort('UPDATED_DESC'); }
  if (!checked) return <State title="Loading Claims" copy="Reading your payment records…" />; if (!account) return <State title="Sign in required" copy="Sign in to view Claim records." />;
  return <main className={styles.page}><div className={styles.backRow}><Link href={personalOnly ? '/beta/payment-records?scope=mine' : '/beta/payment-records'}>← Back to {personalOnly ? 'My Requests' : 'Payment Records'}</Link></div><header className={styles.pageHeader}><div><p>{personalOnly ? 'My Requests' : 'Payment Records'}</p><h1>{personalOnly ? 'My Claims' : 'Claims'}</h1><span>{personalOnly ? 'Track only the Claim requests you created.' : 'Track Drafts, reviews, Director previews and Finance processing in one place.'}</span></div><div className={styles.accountCard}><span>Viewing records for</span><strong>{account.name}</strong><small>{account.position}</small></div></header>{error && <div className={styles.error}>{error}</div>}<section className={styles.summaryGrid}><article><span>Visible records</span><strong>{visible.length}</strong><small>Available to your role</small></article><article><span>Require attention</span><strong>{attention}</strong><small>Waiting for your action</small></article><article><span>Drafts</span><strong>{drafts}</strong><small>Not submitted yet</small></article><article><span>Paid</span><strong>{completed}</strong><small>Completed by Finance</small></article></section><section className={styles.recordsFilterCard}><div className={styles.recordsFilterHeading}><div><h2>Find a Claim</h2><p>Search, filter and sort your payment records.</p></div><button className={styles.clearFiltersButton} onClick={clearFilters} type="button">Clear filters</button></div><div className={styles.recordsFilters}><label className={styles.recordsSearchField}><span>Search</span><input onChange={(event) => setSearch(event.target.value)} placeholder="CL number, claimant or purpose" type="search" value={search} /></label><label><span>Status</span><select onChange={(event) => setStatus(event.target.value as 'ALL' | ClaimStatus)} value={status}>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Claim type</span><select onChange={(event) => setClaimType(event.target.value)} value={claimType}><option value="ALL">All Claim types</option>{CLAIM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Month</span><input onChange={(event) => { setMonth(event.target.value); if (specificDate && !specificDate.startsWith(event.target.value)) setSpecificDate(''); }} type="month" value={month} /></label><label><span>Exact date</span><input max={month ? `${month}-31` : undefined} min={month ? `${month}-01` : undefined} onChange={(event) => setSpecificDate(event.target.value)} type="date" value={specificDate} /></label><label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as PaymentRecordSort)}>{PAYMENT_RECORD_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div></section><section className={styles.recordsResults}><div className={styles.recordsResultsHeader}><div><h2>Claim records</h2><p>Showing {filtered.length} of {visible.length} visible records</p></div><div className={styles.zipActions}><PaymentRecordZipActions archiveName="claim-forms" entries={zipEntries} recordCount={downloadableForms.length}><div className={styles.recordsViewToggle}><span>View</span><button data-active={viewMode === 'grid'} onClick={() => setViewMode('grid')} type="button">▦ Grid</button><button data-active={viewMode === 'list'} onClick={() => setViewMode('list')} type="button">☷ List</button></div></PaymentRecordZipActions></div></div>{filtered.length === 0 ? <div className={styles.emptyState}><h2>No Claims found</h2><p>No records match the selected filters.</p><button className={styles.clearFiltersButton} onClick={clearFilters} type="button">Clear filters</button></div> : viewMode === 'grid' ? <div className={styles.cardGrid}>{pagination.pageRecords.map((record) => <Card account={account} key={record.id} record={record} />)}</div> : <div className={styles.tableWrapper}><table><thead><tr><th>Reference</th><th>Claim type</th><th>Claimant</th><th>Amount</th><th>Updated</th><th>Status</th><th /></tr></thead><tbody>{pagination.pageRecords.map((record) => <tr key={record.id}><td><strong>{record.claimNumber}</strong><small>{record.lines.length} {record.lines.length === 1 ? 'item' : 'items'}</small></td><td>{claimTypeDetails(record.claimType).label}</td><td>{record.requesterName}<small>{record.requesterPosition}</small></td><td className={styles.amount}>{money(record.totalAmount)}</td><td>{date(record.updatedAt)}</td><td><Status status={record.status} /></td><td className={styles.actionCell}><Link href={href(record, account)}>{record.status === 'DRAFT' && record.requesterId === account.id ? 'Continue draft' : needsAttention(record, account) ? 'Open action' : 'View record'}</Link></td></tr>)}</tbody></table></div>}<ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></section></main>;
}

function Card({ record, account }: { record: ClaimRecord; account: BetaAccount }) {
  return (
    <article className={styles.recordCard}>
      <div className={styles.cardTop}>
        <span>{record.claimNumber}</span>
        <Status status={record.status} />
      </div>
      <h2>{claimTypeDetails(record.claimType).label}</h2>
      <p>{record.requesterName}</p>
      <dl>
        <div><dt>Claim date</dt><dd>{date(record.claimDate)}</dd></div>
        <div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div>
        <div><dt>Items</dt><dd>{record.lines.length}</dd></div>
        <div><dt>Role</dt><dd className={styles.capitalize}>{record.requesterRole}</dd></div>
      </dl>
      <Link href={href(record, account)}>
        {record.status === 'DRAFT' && record.requesterId === account.id ? 'Continue draft' : 'View record'}
      </Link>
    </article>
  );
}
function Status({ status }: { status: ClaimStatus }) { return <span className={styles.statusBadge} data-status={status}>{label(status)}</span>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/payment-records">Back to Payment Records</Link></main>; }
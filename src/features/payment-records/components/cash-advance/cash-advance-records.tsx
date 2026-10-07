'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { fetchCashAdvances } from '@/data/payment-requests/cash-advance/cash-advance-api';
import { PAYMENT_RECORD_SORT_OPTIONS, sortPaymentRecords, type PaymentRecordSort } from '@/domain/payment-records/payment-record-sort';
import type { CashAdvanceRecord, CashAdvanceStatus } from '@/domain/payment-requests/cash-advance/types';
import { PaymentRecordZipActions } from '../shared/payment-record-zip-actions';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from './cash-advance-records.module.css';

type ViewMode = 'grid' | 'list';

const statusOptions: Array<{ value: 'ALL' | CashAdvanceStatus; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'PENDING_MANAGER_APPROVAL', label: 'Pending Manager Review' },
  { value: 'PENDING_DIRECTOR_APPROVAL', label: 'Pending Director Approval' },
  { value: 'PENDING_FINANCE_PROCESSING', label: 'Pending Finance Payment' },
  { value: 'PENDING_RECONCILIATION', label: 'Pending Requester Reconciliation' },
  { value: 'PENDING_FINANCE_RECONCILIATION', label: 'Pending Finance Reconciliation' },
  { value: 'RETURNED_TO_STAFF', label: 'Returned to Requester' },
  { value: 'COMPLETED', label: 'Completed' },
];

const statusLabels: Record<CashAdvanceStatus, string> = {
  PENDING_MANAGER_APPROVAL: 'Pending Manager Review',
  PENDING_DIRECTOR_APPROVAL: 'Pending Director Approval',
  PENDING_FINANCE_PROCESSING: 'Pending Finance Payment',
  PENDING_RECONCILIATION: 'Pending Reconciliation',
  PENDING_FINANCE_RECONCILIATION: 'Pending Finance Reconciliation',
  RETURNED_TO_STAFF: 'Returned to Requester',
  COMPLETED: 'Completed',
};

function money(value: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}

function visibleFor(records: CashAdvanceRecord[], account: BetaAccount) {
  return records.filter((record) => {
    if (record.requesterId === account.id) return true;
    if (account.role === 'staff') return record.requesterId === account.id;
    if (account.role === 'manager') return record.managerApproverId === account.id;
    if (account.role === 'director') return record.directorApproverId === account.id;
    return account.role === 'finance';
  });
}

function needsAttention(record: CashAdvanceRecord, account: BetaAccount) {
  if (
    record.requesterId === account.id &&
    (record.status === 'PENDING_RECONCILIATION' ||
      (record.status === 'RETURNED_TO_STAFF' && record.returnedStage === 'RECONCILIATION'))
  ) return true;
  if (account.role === 'staff') {
    return record.status === 'RETURNED_TO_STAFF' || record.status === 'PENDING_RECONCILIATION';
  }
  if (account.role === 'manager') return record.status === 'PENDING_MANAGER_APPROVAL';
  if (account.role === 'director') return record.status === 'PENDING_DIRECTOR_APPROVAL';
  return record.status === 'PENDING_FINANCE_PROCESSING' || record.status === 'PENDING_FINANCE_RECONCILIATION';
}

export function CashAdvanceRecords() {
  const searchParameters = useSearchParams();
  const personalOnly = searchParameters.get('scope') === 'mine';
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [checked, setChecked] = useState(() => !account);
  const [records, setRecords] = useState<CashAdvanceRecord[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'ALL' | CashAdvanceStatus>('ALL');
  const [month, setMonth] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<PaymentRecordSort>('UPDATED_DESC');

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    fetchCashAdvances({ role: account.role, userId: account.id, includeAll: true })
      .then((values) => { if (!cancelled) setRecords(values); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Cash Advance records could not be loaded.'); })
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [account]);

  const visible = useMemo(() => account ? (personalOnly ? records.filter((record) => record.requesterId === account.id) : visibleFor(records, account)) : [], [account, personalOnly, records]);
  const attentionCount = account ? visible.filter((record) => needsAttention(record, account)).length : 0;
  const completedCount = visible.filter((record) => record.status === 'COMPLETED').length;
  const reconciliationCount = visible.filter((record) => record.status === 'PENDING_RECONCILIATION' || record.status === 'PENDING_FINANCE_RECONCILIATION').length;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = visible.filter((record) => {
      if (status !== 'ALL' && record.status !== status) return false;
      if (month && !record.requestDate.startsWith(month)) return false;
      if (specificDate && record.requestDate !== specificDate) return false;
      return !query || [record.requestNumber, record.requesterName, record.projectName, record.purpose]
        .some((value) => value.toLowerCase().includes(query));
    });
    return sortPaymentRecords(matching, sort, (record) => ({ reference: record.requestNumber, updatedAt: record.updatedAt, amount: record.totalAmount }));
  }, [month, search, sort, specificDate, status, visible]);
  const downloadableForms = filtered.filter((record) => record.status === 'COMPLETED');
  const zipEntries = downloadableForms.map((record) => ({
    name: `${record.requestNumber}-forms.pdf`,
    url: `/api/v1/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}/forms?form=pack`,
  }));
  const pagination = useListPagination(filtered);

  function handleMonthChange(value: string) {
    setMonth(value);
    if (specificDate && !specificDate.startsWith(value)) setSpecificDate('');
  }

  function clearFilters() {
    setSearch('');
    setStatus('ALL');
    setMonth('');
    setSpecificDate('');
    setSort('UPDATED_DESC');
  }

  if (!checked) return <State title="Loading Cash Advances" copy="Reading your payment records…" />;
  if (!account) return <State title="Sign in required" copy="Sign in to view Cash Advance records." />;

  return <main className={styles.page}>
    <div className={styles.backRow}><Link href={personalOnly ? '/beta/payment-records?scope=mine' : '/beta/payment-records'}>← Back to {personalOnly ? 'My Requests' : 'Payment Records'}</Link></div>
    <header className={styles.pageHeader}><div><p>{personalOnly ? 'My Requests' : 'Payment Records'}</p><h1>{personalOnly ? 'My Cash Advance requests' : 'Cash Advances'}</h1><span>{personalOnly ? 'Track only the Cash Advance requests you created.' : 'Track each request through approval, payment, requester reconciliation and Finance completion.'}</span></div><div className={styles.accountCard}><span>Viewing records for</span><strong>{account.name}</strong><small>{account.position}</small></div></header>
    <section className={styles.summaryGrid}><article><span>Visible records</span><strong>{visible.length}</strong><small>Available to your role</small></article><article><span>Require attention</span><strong>{attentionCount}</strong><small>Waiting for your action</small></article><article><span>In reconciliation</span><strong>{reconciliationCount}</strong><small>Requester or Finance review</small></article><article><span>Completed</span><strong>{completedCount}</strong><small>Reconciled and closed</small></article></section>
    <section className={styles.recordsFilterCard}>
      <div className={styles.recordsFilterHeading}><div><h2>Find a Cash Advance</h2><p>Search, filter and sort your payment records.</p></div><button className={styles.clearFiltersButton} onClick={clearFilters} type="button">Clear filters</button></div>
      <div className={styles.recordsFilters}><label className={styles.recordsSearchField}><span>Search</span><input onChange={(event) => setSearch(event.target.value)} placeholder="CA number, Staff, project or purpose" type="search" value={search} /></label><label><span>Status</span><select onChange={(event) => setStatus(event.target.value as 'ALL' | CashAdvanceStatus)} value={status}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Month</span><input onChange={(event) => handleMonthChange(event.target.value)} type="month" value={month} /></label><label><span>Exact date</span><input max={month ? `${month}-31` : undefined} min={month ? `${month}-01` : undefined} onChange={(event) => setSpecificDate(event.target.value)} type="date" value={specificDate} /></label><label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as PaymentRecordSort)}>{PAYMENT_RECORD_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
    </section>
    <section className={styles.recordsResults}>
      <div className={styles.recordsResultsHeader}><div><h2>Cash Advances</h2><p>Showing {filtered.length} of {visible.length} visible records</p></div><PaymentRecordZipActions archiveName="cash-advance-forms" entries={zipEntries} recordCount={downloadableForms.length}><div aria-label="Choose Cash Advance view" className={styles.recordsViewToggle} role="group"><span>View</span><button aria-pressed={viewMode === 'grid'} data-active={viewMode === 'grid'} onClick={() => setViewMode('grid')} type="button"><span aria-hidden="true">▦</span> Grid</button><button aria-pressed={viewMode === 'list'} data-active={viewMode === 'list'} onClick={() => setViewMode('list')} type="button"><span aria-hidden="true">☷</span> List</button></div></PaymentRecordZipActions></div>
      {error && <div className={styles.errorState}>{error}</div>}
      {!error && filtered.length === 0 ? <div className={styles.emptyState}><h2>No Cash Advances found</h2><p>No records match the selected filters. Try clearing the filters.</p><button className={styles.clearFiltersButton} onClick={clearFilters} type="button">Clear filters</button></div> : viewMode === 'grid' ? <div className={styles.cardGrid}>{pagination.pageRecords.map((record) => <RecordCard key={record.id} record={record} />)}</div> : <div className={styles.tableWrapper}><table><thead><tr><th>Reference</th><th>Staff</th><th>Project</th><th>Amount</th><th>Updated</th><th>Status</th><th><span className={styles.srOnly}>Action</span></th></tr></thead><tbody>{pagination.pageRecords.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong></td><td>{record.requesterName}</td><td>{record.projectName}</td><td className={styles.amount}>{money(record.totalAmount)}</td><td>{new Date(record.updatedAt).toLocaleDateString('en-MY')}</td><td><Status status={record.status} /></td><td className={styles.actionCell}><Link href={`/beta/payment-records/cash-advances/${encodeURIComponent(record.requestNumber)}`}>View record</Link></td></tr>)}</tbody></table></div>}
      <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} />
    </section>
  </main>;
}

function RecordCard({ record }: { record: CashAdvanceRecord }) {
  return <article className={styles.recordCard}><div className={styles.cardTop}><span>{record.requestNumber}</span><Status status={record.status} /></div><h2>{record.projectName}</h2><p>{record.purpose}</p><dl><div><dt>Requested by</dt><dd>{record.requesterName}</dd></div><div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div><div><dt>Request date</dt><dd>{new Date(record.requestDate).toLocaleDateString('en-MY')}</dd></div><div><dt>Documents</dt><dd>{record.supportingDocuments.length}</dd></div></dl><Link href={`/beta/payment-records/cash-advances/${encodeURIComponent(record.requestNumber)}`}>View record</Link></article>;
}

function Status({ status }: { status: CashAdvanceStatus }) {
  return <span className={styles.statusBadge} data-status={status}>{statusLabels[status]}</span>;
}

function State({ title, copy }: { title: string; copy: string }) {
  return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/payment-records">Back to Payment Records</Link></main>;
}

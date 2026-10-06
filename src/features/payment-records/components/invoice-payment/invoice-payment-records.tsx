'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';
import { useEffect, useMemo, useState } from 'react';

import { fetchInvoicePayments } from '@/data/payment-requests/invoice-payment/api';
import { PAYMENT_RECORD_SORT_OPTIONS, sortPaymentRecords, type PaymentRecordSort } from '@/domain/payment-records/payment-record-sort';
import type { InvoicePaymentRequestRecord, PaymentRequestStatus } from '@/domain/payment-requests/invoice-payment/types';
import { PaymentRecordZipActions } from '../shared/payment-record-zip-actions';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from './invoice-payment-records.module.css';

type ViewMode = 'grid' | 'list';

const statusOptions = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_MANAGER_REVIEW', label: 'Pending Manager Review' },
  { value: 'PENDING_DIRECTOR_REVIEW', label: 'Pending Director Review' },
  { value: 'PENDING_FINANCE_REVIEW', label: 'Pending Finance Verification' },
  { value: 'RETURNED_TO_STAFF', label: 'Returned to Staff' },
  { value: 'COMPLETED', label: 'Completed' },
];

const statusLabels: Record<PaymentRequestStatus, string> = {
  DRAFT: 'Draft', PENDING_MANAGER_REVIEW: 'Pending Manager Review', PENDING_DIRECTOR_REVIEW: 'Pending Director Review', PENDING_FINANCE_REVIEW: 'Pending Finance Verification', COMPLETED: 'Completed', RETURNED_TO_STAFF: 'Returned to Staff',
};
function money(value: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value); }
function visibleFor(records: InvoicePaymentRequestRecord[], account: BetaAccount) {
  return records.filter((record) => account.role === 'staff' ? record.staffId === account.id : account.role === 'manager' ? record.managerApproverId === account.id : account.role === 'director' ? record.directorApproverId === account.id : true);
}
function needsAttention(record: InvoicePaymentRequestRecord, account: BetaAccount) {
  return account.role === 'staff' ? record.status === 'RETURNED_TO_STAFF' : account.role === 'manager' ? record.status === 'PENDING_MANAGER_REVIEW' : account.role === 'director' ? record.status === 'PENDING_DIRECTOR_REVIEW' : record.status === 'PENDING_FINANCE_REVIEW';
}

export function InvoicePaymentRecords() {
  const searchParameters = useSearchParams();
  const personalOnly = searchParameters.get('scope') === 'mine';
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const [records, setRecords] = useState<InvoicePaymentRequestRecord[]>([]);
  const [status, setStatus] = useState('ALL');
  const [month, setMonth] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<PaymentRecordSort>('UPDATED_DESC');

  useEffect(() => { const session = readBetaSession(); setAccount(session); if (!session) { setChecked(true); return; } fetchInvoicePayments({ role: session.role, userId: session.id, includeAll: true }).then(setRecords).finally(() => setChecked(true)); }, []);
  const visible = useMemo(() => account ? (personalOnly ? records.filter((record) => record.staffId === account.id) : visibleFor(records, account)) : [], [account, personalOnly, records]);
  const attentionCount = account ? visible.filter((record) => needsAttention(record, account)).length : 0;
  const completedCount = visible.filter((record) => record.status === 'COMPLETED').length;
  const filtered = useMemo(() => {
    if (!account) return [];
    const query = search.trim().toLowerCase();
    const matching = visible.filter((record) => {
      if (status !== 'ALL' && record.status !== status) return false;
      if (month && !record.requestDate.startsWith(month)) return false;
      if (specificDate && record.requestDate !== specificDate) return false;
      return !query || [record.requestNumber, record.title, record.vendorName, record.projectName, record.staffName].some((value) => value.toLowerCase().includes(query));
    });
    return sortPaymentRecords(matching, sort, (record) => ({ reference: record.requestNumber, updatedAt: record.updatedAt, amount: record.totalAmount }));
  }, [account, month, search, sort, specificDate, status, visible]);
  const downloadableForms = filtered.filter((record) => record.status === 'COMPLETED' && record.supportingDocuments.length > 0);
  const zipEntries = downloadableForms.flatMap((record) => record.supportingDocuments.map((document, index) => ({
    name: `${record.requestNumber}-${index + 1}-${document.fileName}`,
    url: document.dataUrl,
  })));
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

  if (!checked) return <State title="Loading Invoice Payments" copy="Reading your payment records…" />;
  if (!account) return <State title="Sign in required" copy="Sign in to view Invoice Payment records." />;

  return (
    <main className={styles.page}>
      <div className={styles.backRow}><Link href={personalOnly ? '/beta/payment-records?scope=mine' : '/beta/payment-records'}>← Back to {personalOnly ? 'My Requests' : 'Payment Records'}</Link></div>
      <header className={styles.pageHeader}><div><p>{personalOnly ? 'My Requests' : 'Payment Records'}</p><h1>{personalOnly ? 'My Invoice Payment requests' : 'Invoice Payments'}</h1><span>{personalOnly ? 'Track only the Invoice Payment requests you created.' : 'Track requests from submission through Manager, Director and Finance verification.'}</span></div><div className={styles.accountCard}><span>Viewing records for</span><strong>{account.name}</strong><small>{account.position}</small></div></header>
      <section className={styles.summaryGrid}><article><span>Visible records</span><strong>{visible.length}</strong><small>Available to your role</small></article><article><span>Require attention</span><strong>{attentionCount}</strong><small>Waiting for your action</small></article><article><span>Completed</span><strong>{completedCount}</strong><small>Verified by Finance</small></article></section>
      <section className={styles.recordsFilterCard}>
        <div className={styles.recordsFilterHeading}><div><h2>Find an Invoice Payment</h2><p>Search, filter and sort your payment records.</p></div><button className={styles.clearFiltersButton} type="button" onClick={clearFilters}>Clear filters</button></div>
        <div className={styles.recordsFilters}><label className={styles.recordsSearchField}><span>Search</span><input type="search" placeholder="IV number, vendor or project" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label><span>Month</span><input type="month" value={month} onChange={(event) => handleMonthChange(event.target.value)} /></label><label><span>Exact date</span><input type="date" value={specificDate} min={month ? `${month}-01` : undefined} max={month ? `${month}-31` : undefined} onChange={(event) => setSpecificDate(event.target.value)} /></label><label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as PaymentRecordSort)}>{PAYMENT_RECORD_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
      </section>
      <section className={styles.recordsResults}>
        <div className={styles.recordsResultsHeader}><div><h2>Invoice Payments</h2><p>Showing {filtered.length} of {visible.length} visible records</p></div><PaymentRecordZipActions archiveName="invoice-payment-documents" entries={zipEntries} recordCount={downloadableForms.length}><div aria-label="Choose Invoice Payment view" className={styles.recordsViewToggle} role="group"><span>View</span><button aria-pressed={viewMode === 'grid'} data-active={viewMode === 'grid'} type="button" onClick={() => setViewMode('grid')}><span aria-hidden="true">▦</span> Grid</button><button aria-pressed={viewMode === 'list'} data-active={viewMode === 'list'} type="button" onClick={() => setViewMode('list')}><span aria-hidden="true">☷</span> List</button></div></PaymentRecordZipActions></div>
        {filtered.length === 0 ? <div className={styles.emptyState}><h2>No Invoice Payments found</h2><p>No records match the selected filters. Try clearing the filters.</p><button className={styles.clearFiltersButton} type="button" onClick={clearFilters}>Clear filters</button></div> : viewMode === 'grid' ? <div className={styles.cardGrid}>{pagination.pageRecords.map((record) => <RecordCard key={record.id} record={record} />)}</div> : <div className={styles.tableWrapper}><table><thead><tr><th>Reference</th><th>Vendor</th><th>Project</th><th>Amount</th><th>Updated</th><th>Status</th><th><span className={styles.srOnly}>Action</span></th></tr></thead><tbody>{pagination.pageRecords.map((record) => <tr key={record.id}><td><strong>{record.requestNumber}</strong></td><td>{record.vendorName}</td><td>{record.projectName}</td><td className={styles.amount}>{money(record.totalAmount)}</td><td>{new Date(record.updatedAt).toLocaleDateString('en-MY')}</td><td><Status status={record.status} /></td><td className={styles.actionCell}><Link href={`/beta/payment-records/invoice-payments/${record.id}`}>View record</Link></td></tr>)}</tbody></table></div>}
        <ListPagination currentPage={pagination.currentPage} firstRecord={pagination.firstRecord} lastRecord={pagination.lastRecord} pageCount={pagination.pageCount} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
      </section>
    </main>
  );
}

function RecordCard({ record }: { record: InvoicePaymentRequestRecord }) { return <article className={styles.recordCard}><div className={styles.cardTop}><span>{record.requestNumber}</span><Status status={record.status} /></div><h2>{record.title}</h2><p>{record.vendorName}</p><dl><div><dt>Project</dt><dd>{record.projectName}</dd></div><div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div><div><dt>Requested by</dt><dd>{record.staffName}</dd></div><div><dt>Documents</dt><dd>{record.supportingDocuments.length}</dd></div></dl><Link href={`/beta/payment-records/invoice-payments/${record.id}`}>View record</Link></article>; }
function Status({ status }: { status: PaymentRequestStatus }) { return <span className={styles.statusBadge} data-status={status}>{statusLabels[status]}</span>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={styles.statePage}><h1>{title}</h1><p>{copy}</p><Link href="/beta/payment-records">Back to Payment Records</Link></main>; }
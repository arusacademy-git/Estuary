'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  SqlEntryPaymentType,
  SqlEntryRecord,
  SqlEntryStatus,
  SqlEntryTrackingEntry,
} from '@/domain/sql-entry-tracker/types';
import {
  fetchSqlEntryTracking,
  saveSqlEntryTracking,
} from '@/data/sql-entry-tracker/api';
import { fetchInvoicePayments } from '@/data/payment-requests/invoice-payment/api';
import { fetchTravelAllowances } from '@/data/payment-requests/travel-allowance/api';
import { fetchCashAdvances } from '@/data/payment-requests/cash-advance/cash-advance-api';
import { fetchClaimRequests } from '@/data/payment-requests/claims/api';
import { fetchPettyCashRequests } from '@/data/payment-requests/petty-cash/api';
import { usePaymentVouchers } from '@/features/payment-voucher/hooks/use-payment-vouchers';
import {
  betaAccounts,
  readBetaSession,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';

import styles from './sql-entry-tracker.module.css';

const paymentTypes: Array<{
  value: SqlEntryPaymentType;
  label: string;
  short: string;
  colour: string;
}> = [
    { value: 'PAYMENT_VOUCHER', label: 'Payment Vouchers', short: 'PV', colour: '#07456b' },
    { value: 'INVOICE_PAYMENT', label: 'Invoice Payments', short: 'INV', colour: '#0c6f50' },
    { value: 'TRAVEL_ALLOWANCE', label: 'Travel Allowances', short: 'TA', colour: '#f29221' },
    { value: 'CASH_ADVANCE', label: 'Cash Advances', short: 'CA', colour: '#db224a' },
    { value: 'PETTY_CASH', label: 'Petty Cash', short: 'PC', colour: '#ffffff' },
    { value: 'CLAIM', label: 'Claims', short: 'CL', colour: '#000000' },
  ];

const statusLabels: Record<SqlEntryStatus, string> = {
  PENDING_ENTRY: 'Pending SQL entry',
  RECORDED_IN_SQL_SYSTEM: 'Recorded in SQL System',
  NEEDS_CORRECTION: 'Needs correction',
  NOT_REQUIRED: 'Not required',
};

const statusOptions = Object.entries(statusLabels) as Array<[
  SqlEntryStatus,
  string,
]>;

function currency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(amount);
}

function displayDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function accountName(accountId: string) {
  return betaAccounts.find((account) => account.id === accountId)?.name ?? accountId;
}

function dateOnly(value?: string) {
  return value?.slice(0, 10) ?? '';
}

function applyTrackingEntries(records: SqlEntryRecord[], entries: SqlEntryTrackingEntry[]) {
  const bySubmission = new Map(entries.map((entry) => [entry.submissionId, entry]));
  return records.map((record) => ({
    ...record,
    ...bySubmission.get(record.submissionId),
  }));
}

export function SqlEntryTracker() {
  const router = useRouter();
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const { records: paymentVouchers, isLoading: vouchersLoading } = usePaymentVouchers();
  const [records, setRecords] = useState<SqlEntryRecord[]>([]);
  const [trackingEntries, setTrackingEntries] = useState<SqlEntryTrackingEntry[]>([]);
  const [activeType, setActiveType] = useState<SqlEntryPaymentType>('PAYMENT_VOUCHER');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SqlEntryStatus>('ALL');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SqlEntryRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    if (!account) {
      router.replace('/beta');
      return;
    }
    if (account.role !== 'finance') {
      router.replace('/beta/dashboard');
      return;
    }

    let active = true;
    Promise.all([
      fetchInvoicePayments({ role: 'finance', userId: account.id, includeAll: true }),
      fetchTravelAllowances({ role: 'finance', userId: account.id, includeAll: true }),
      fetchCashAdvances({ role: 'finance', userId: account.id, includeAll: true }),
      fetchPettyCashRequests({ role: 'finance', userId: account.id, includeAll: true }),
      fetchClaimRequests({ role: 'finance', userId: account.id }),
      fetchSqlEntryTracking(account.id),
    ])
      .then(([invoices, travel, cashAdvances, pettyCash, claims, savedEntries]) => {
        if (!active) return;
        setTrackingEntries(savedEntries);
        const items: SqlEntryRecord[] = [
          ...invoices.filter((record) => record.status === 'COMPLETED').map((record) => ({
            submissionId: record.id,
            referenceNumber: record.requestNumber,
            paymentType: 'INVOICE_PAYMENT' as const,
            requesterName: record.staffName,
            programme: record.projectName,
            amount: record.totalAmount,
            paymentDate: dateOnly(record.financePaymentDate || record.financeVerifiedAt || record.updatedAt),
            status: 'PENDING_ENTRY' as const,
            sqlReference: '', recordedAt: '', notes: '', updatedByName: '', updatedAt: '',
            detailHref: `/beta/payment-records/invoice-payments/${encodeURIComponent(record.id)}`,
          })),
          ...travel.filter((record) => record.status === 'COMPLETED').map((record) => ({
            submissionId: record.id,
            referenceNumber: record.requestNumber,
            paymentType: 'TRAVEL_ALLOWANCE' as const,
            requesterName: record.requesterName,
            programme: record.lines[0]?.projectName ?? 'Unassigned',
            amount: record.totalAmount,
            paymentDate: dateOnly(record.financePaymentDate || record.financeVerifiedAt || record.updatedAt),
            status: 'PENDING_ENTRY' as const,
            sqlReference: '', recordedAt: '', notes: '', updatedByName: '', updatedAt: '',
            detailHref: `/beta/payment-records/travel-allowances/${encodeURIComponent(record.id)}`,
          })),
          ...cashAdvances.filter((record) => record.status === 'COMPLETED').map((record) => ({
            submissionId: record.id,
            referenceNumber: record.requestNumber,
            paymentType: 'CASH_ADVANCE' as const,
            requesterName: record.requesterName,
            programme: record.projectName,
            amount: record.totalAmount,
            paymentDate: dateOnly(record.financePaidAt),
            status: 'PENDING_ENTRY' as const,
            sqlReference: '', recordedAt: '', notes: '', updatedByName: '', updatedAt: '',
            detailHref: `/beta/payment-records/cash-advances/${encodeURIComponent(record.id)}`,
          })),
          ...pettyCash.filter((record) => record.status === 'PAID').map((record) => ({
            submissionId: record.id,
            referenceNumber: record.requestNumber,
            paymentType: 'PETTY_CASH' as const,
            requesterName: record.requesterName,
            programme: record.lines[0]?.division ?? record.location,
            amount: record.totalAmount,
            paymentDate: dateOnly(record.paymentDate || record.paidAt),
            status: 'PENDING_ENTRY' as const,
            sqlReference: '', recordedAt: '', notes: '', updatedByName: '', updatedAt: '',
            detailHref: `/beta/payment-records/petty-cash/${encodeURIComponent(record.id)}`,
          })),
          ...claims.filter((record) => record.status === 'COMPLETED').map((record) => ({
            submissionId: record.id,
            referenceNumber: record.claimNumber,
            paymentType: 'CLAIM' as const,
            requesterName: record.requesterName,
            programme: record.lines[0]?.division ?? 'Unassigned',
            amount: record.totalAmount,
            paymentDate: dateOnly(record.paymentDate || record.financeProcessedAt || record.updatedAt),
            status: 'PENDING_ENTRY' as const,
            sqlReference: '', recordedAt: '', notes: '', updatedByName: '', updatedAt: '',
            detailHref: `/beta/payment-records/claims/${encodeURIComponent(record.id)}`,
          })),
        ];
        setRecords((current) => applyTrackingEntries([
          ...current.filter((record) => record.paymentType === 'PAYMENT_VOUCHER'),
          ...items,
        ], savedEntries));
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error
            ? requestError.message
            : 'The SQL Entry Tracker could not be loaded.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [account, router]);

  useEffect(() => {
    if (!account || account.role !== 'finance' || vouchersLoading) return;
    let cancelled = false;
    const voucherRecords: SqlEntryRecord[] = paymentVouchers
      .filter((record) => record.status === 'COMPLETED')
      .map((record) => ({
        submissionId: record.id,
        referenceNumber: record.voucherNumber,
        paymentType: 'PAYMENT_VOUCHER',
        requesterName: accountName(record.submitterId),
        programme: record.division || 'Unassigned',
        amount: record.amount,
        paymentDate: dateOnly(record.paymentDate),
        status: 'PENDING_ENTRY',
        sqlReference: '', recordedAt: '', notes: '', updatedByName: '', updatedAt: '',
        detailHref: `/beta/payment-vouchers/${encodeURIComponent(record.id)}`,
      }));
    Promise.resolve().then(() => {
      if (cancelled) return;
      setRecords((current) => applyTrackingEntries([
        ...current.filter((record) => record.paymentType !== 'PAYMENT_VOUCHER'),
        ...voucherRecords,
      ], trackingEntries));
    });
    return () => {
      cancelled = true;
    };
  }, [account, paymentVouchers, trackingEntries, vouchersLoading]);

  const typeRecords = useMemo(() => records.filter(
    (record) => record.paymentType === activeType,
  ), [activeType, records]);

  const filteredBeforeStatus = useMemo(() => {
    const query = search.trim().toLowerCase();
    return typeRecords.filter((record) => {
      if (dateFrom && record.paymentDate < dateFrom) return false;
      if (dateTo && record.paymentDate > dateTo) return false;
      if (!query) return true;
      return [
        record.referenceNumber,
        record.requesterName,
        record.programme,
        record.sqlReference,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [dateFrom, dateTo, search, typeRecords]);

  const visibleRecords = useMemo(() => filteredBeforeStatus.filter(
    (record) => statusFilter === 'ALL' || record.status === statusFilter,
  ), [filteredBeforeStatus, statusFilter]);
  const selectedRecords = useMemo(() => records.filter(
    (record) => selectedIds.includes(record.submissionId),
  ), [records, selectedIds]);
  const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every(
    (record) => selectedIds.includes(record.submissionId),
  );

  const requiredRecords = filteredBeforeStatus.filter(
    (record) => record.status !== 'NOT_REQUIRED',
  );
  const recordedCount = requiredRecords.filter(
    (record) => record.status === 'RECORDED_IN_SQL_SYSTEM',
  ).length;
  const pendingCount = requiredRecords.filter(
    (record) => record.status === 'PENDING_ENTRY',
  ).length;
  const correctionCount = requiredRecords.filter(
    (record) => record.status === 'NEEDS_CORRECTION',
  ).length;
  const completion = requiredRecords.length
    ? Math.round((recordedCount / requiredRecords.length) * 100)
    : 0;
  const activeDefinition = paymentTypes.find((item) => item.value === activeType)!;

  function clearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
  }

  function toggleRecord(submissionId: string) {
    setSelectedIds((current) => current.includes(submissionId)
      ? current.filter((id) => id !== submissionId)
      : [...current, submissionId]);
  }

  function toggleVisibleRecords() {
    const visibleIds = visibleRecords.map((record) => record.submissionId);
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  }

  if (!account || account.role !== 'finance') return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>FINANCE · SQL ENTRY TRACKER</p>
          <h1>SQL Entry Tracker</h1>
          <p>Confirm which completed payments have been recorded in the SQL System.</p>
        </div>
        <div className={styles.accessNote}>
          <span>Finance access</span>
          <strong>{account.name}</strong>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Payment types">
        {paymentTypes.map((item) => {
          const count = records.filter((record) => record.paymentType === item.value).length;
          return (
            <button
              className={activeType === item.value ? styles.activeTab : ''}
              key={item.value}
              onClick={() => {
                setActiveType(item.value);
                setStatusFilter('ALL');
                setSelectedIds([]);
              }}
              style={{ '--type-colour': item.colour } as CSSProperties}
              type="button"
            >
              <span className={styles.typeDot} />
              {item.label}
              <small>{count}</small>
            </button>
          );
        })}
      </nav>

      <section className={styles.progressPanel}>
        <div className={styles.progressCopy}>
          <span>{activeDefinition.label}</span>
          <strong>{completion}%</strong>
          <p>{recordedCount} of {requiredRecords.length} payments recorded in SQL System</p>
        </div>
        <div className={styles.statusSummaryCards}>
          <article className={styles.pendingSummary}><span><i className={styles.pendingDot} />Pending SQL entry</span><strong>{pendingCount}</strong></article>
          <article className={styles.recordedSummary}><span><i className={styles.recordedDot} />Recorded</span><strong>{recordedCount}</strong></article>
          <article className={styles.correctionSummary}><span><i className={styles.correctionDot} />Need correction</span><strong>{correctionCount}</strong></article>
        </div>
        <div className={styles.progressTrack}><span style={{ width: `${completion}%`, backgroundColor: activeDefinition.colour === '#ffffff' ? '#07456b' : activeDefinition.colour }} /></div>
      </section>

      <section className={styles.recordsPanel}>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.eyebrow}>ACCOUNTING ENTRY RECORDS</p>
            <h2>{activeDefinition.label}</h2>
          </div>
          <span>{visibleRecords.length} {visibleRecords.length === 1 ? 'record' : 'records'}</span>
        </div>

        <div className={styles.filters}>
          <label className={styles.searchField}>
            <span>Search</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Reference, requester or programme"
              value={search}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | SqlEntryStatus)}
              value={statusFilter}
            >
              <option value="ALL">All statuses</option>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Payment date from</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            <span>Payment date to</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <button className={styles.clearButton} onClick={clearFilters} type="button">Clear filters</button>
        </div>

        {error && <p className={styles.errorMessage}>{error}</p>}
        {isLoading ? (
          <div className={styles.emptyState}><strong>Loading SQL entries</strong><span>Reading completed payment records…</span></div>
        ) : visibleRecords.length === 0 ? (
          <div className={styles.emptyState}><strong>No matching payments</strong><span>Try another payment type, status or date range.</span></div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th className={styles.checkboxCell}><input aria-label="Select all visible records" checked={allVisibleSelected} onChange={toggleVisibleRecords} type="checkbox" /></th>
                  <th>Reference</th>
                  <th>Requester</th>
                  <th>Programme</th>
                  <th>Payment date</th>
                  <th>Amount</th>
                  <th>SQL status</th>
                  <th>SQL reference</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr data-selected={selectedIds.includes(record.submissionId)} key={record.submissionId}>
                    <td className={styles.checkboxCell}><input aria-label={`Select ${record.referenceNumber}`} checked={selectedIds.includes(record.submissionId)} onChange={() => toggleRecord(record.submissionId)} type="checkbox" /></td>
                    <td><Link href={record.detailHref}>{record.referenceNumber}</Link></td>
                    <td>{record.requesterName}</td>
                    <td>{record.programme}</td>
                    <td>{displayDate(record.paymentDate)}</td>
                    <td className={styles.amount}>{currency(record.amount)}</td>
                    <td><span className={`${styles.status} ${styles[record.status]}`}>{statusLabels[record.status]}</span></td>
                    <td>{record.sqlReference || '—'}</td>
                    <td><button className={styles.editButton} onClick={() => setSelected(record)} type="button">Update</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRecords.length > 0 && <div className={styles.bulkBar}>
        <div><strong>{selectedRecords.length} selected</strong><span>{currency(selectedRecords.reduce((sum, record) => sum + record.amount, 0))} total</span></div>
        <div><button onClick={() => setSelectedIds([])} type="button">Clear</button><button className={styles.bulkButton} onClick={() => setBulkOpen(true)} type="button">Update {selectedRecords.length} selected →</button></div>
      </div>}

      {selected && (
        <SqlEntryModal
          account={account}
          onClose={() => setSelected(null)}
          onSaved={(items) => {
            setRecords((current) => current.map((record) =>
              record.submissionId === items.submissionId ? items : record,
            ));
            const trackingItem: SqlEntryTrackingEntry = items;
            setTrackingEntries((current) => [
              ...current.filter((entry) => entry.submissionId !== items.submissionId),
              trackingItem,
            ]);
            setSelected(null);
          }}
          record={selected}
        />
      )}
      {bulkOpen && selectedRecords.length > 0 && account && <BulkSqlEntryModal
        account={account}
        onClose={() => setBulkOpen(false)}
        onSaved={(savedEntries) => {
          const savedById = new Map(savedEntries.map((entry) => [entry.submissionId, entry]));
          setRecords((current) => current.map((record) => ({
            ...record,
            ...savedById.get(record.submissionId),
          })));
          setTrackingEntries((current) => [
            ...current.filter((entry) => !savedById.has(entry.submissionId)),
            ...savedEntries,
          ]);
          setSelectedIds([]);
          setBulkOpen(false);
        }}
        records={selectedRecords}
      />}
    </div>
  );
}

function SqlEntryModal({
  account,
  record,
  onClose,
  onSaved,
}: {
  account: BetaAccount;
  record: SqlEntryRecord;
  onClose: () => void;
  onSaved: (record: SqlEntryRecord) => void;
}) {
  const [status, setStatus] = useState<SqlEntryStatus>(record.status);
  const [sqlReference, setSqlReference] = useState(record.sqlReference);
  const [recordedDate, setRecordedDate] = useState(
    record.recordedAt || new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(record.notes);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isRecorded = status === 'RECORDED_IN_SQL_SYSTEM';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const saved = await saveSqlEntryTracking({
        userId: account.id,
        submissionId: record.submissionId,
        status,
        sqlReference: isRecorded ? sqlReference : '',
        recordedAt: isRecorded ? recordedDate : '',
        notes,
      });
      onSaved({ ...record, ...saved });
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'The SQL entry could not be updated.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className={styles.modal} onSubmit={submit}>
        <header>
          <div>
            <p className={styles.eyebrow}>UPDATE SQL ENTRY</p>
            <h2>{record.referenceNumber}</h2>
            <span>{record.requesterName} · {currency(record.amount)}</span>
          </div>
          <button aria-label="Close" className={styles.closeButton} onClick={onClose} type="button">×</button>
        </header>

        <label>
          <span>SQL entry status *</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as SqlEntryStatus)} required>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        {isRecorded && (
          <div className={styles.formGrid}>
            <label>
              <span>SQL reference number *</span>
              <input maxLength={100} onChange={(event) => setSqlReference(event.target.value)} required value={sqlReference} />
            </label>
            <label>
              <span>Date recorded *</span>
              <input onChange={(event) => setRecordedDate(event.target.value)} required type="date" value={recordedDate} />
            </label>
          </div>
        )}

        <label>
          <span>Notes</span>
          <textarea maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Optional Finance notes" rows={4} value={notes} />
        </label>

        {error && <p className={styles.errorMessage}>{error}</p>}

        <footer>
          <button className={styles.cancelButton} onClick={onClose} type="button">Cancel</button>
          <button className={styles.saveButton} disabled={isSaving} type="submit">{isSaving ? 'Saving…' : 'Save SQL entry'}</button>
        </footer>
      </form>
    </div>
  );
}

function BulkSqlEntryModal({
  account,
  records,
  onClose,
  onSaved,
}: {
  account: BetaAccount;
  records: SqlEntryRecord[];
  onClose: () => void;
  onSaved: (entries: SqlEntryTrackingEntry[]) => void;
}) {
  const [status, setStatus] = useState<SqlEntryStatus>('RECORDED_IN_SQL_SYSTEM');
  const [recordedDate, setRecordedDate] = useState(new Date().toISOString().slice(0, 10));
  const [references, setReferences] = useState<Record<string, string>>(() => Object.fromEntries(
    records.map((record) => [record.submissionId, record.sqlReference]),
  ));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isRecorded = status === 'RECORDED_IN_SQL_SYSTEM';
  const needsCorrection = status === 'NEEDS_CORRECTION';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (isRecorded && records.some((record) => !references[record.submissionId]?.trim())) {
      setError('Enter an SQL reference for every selected payment.');
      return;
    }
    if (needsCorrection && !notes.trim()) {
      setError('Notes are required when the selected payments need correction.');
      return;
    }
    setIsSaving(true);
    try {
      const saved = await Promise.all(records.map((record) => saveSqlEntryTracking({
        userId: account.id,
        submissionId: record.submissionId,
        status,
        sqlReference: isRecorded ? references[record.submissionId] ?? '' : '',
        recordedAt: isRecorded ? recordedDate : '',
        notes,
      })));
      onSaved(saved);
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'The selected SQL entries could not be updated.');
    } finally {
      setIsSaving(false);
    }
  }

  return <div className={styles.overlay} role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <form className={`${styles.modal} ${styles.bulkModal}`} onSubmit={submit}>
      <header><div><p className={styles.eyebrow}>UPDATE SQL ENTRIES</p><h2>{records.length} selected payments</h2><span>{paymentTypes.find((item) => item.value === records[0]?.paymentType)?.label} · {currency(records.reduce((sum, record) => sum + record.amount, 0))} total</span></div><button aria-label="Close" className={styles.closeButton} onClick={onClose} type="button">×</button></header>

      <fieldset className={styles.statusChoices}><legend>SQL entry status *</legend>{statusOptions.map(([value, label]) => <label data-active={status === value} key={value}><input checked={status === value} name="bulk-status" onChange={() => setStatus(value)} type="radio" /><i className={styles[value]} />{label}</label>)}</fieldset>

      {isRecorded && <label><span>Date recorded *</span><input onChange={(event) => setRecordedDate(event.target.value)} required type="date" value={recordedDate} /></label>}

      {isRecorded && <div className={styles.bulkReferences}><div><strong>SQL reference per payment *</strong><small>Each payment needs its own reference.</small></div>{records.map((record) => <label key={record.submissionId}><span><b>{record.referenceNumber}</b><small>{record.requesterName}</small></span><em>{currency(record.amount)}</em><input aria-label={`SQL reference for ${record.referenceNumber}`} maxLength={100} onChange={(event) => setReferences((current) => ({ ...current, [record.submissionId]: event.target.value }))} placeholder="Enter SQL reference" required value={references[record.submissionId] ?? ''} /></label>)}</div>}

      <label><span>Notes {needsCorrection ? '*' : ''}</span><textarea maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder={needsCorrection ? 'Explain what needs correction' : 'Optional Finance notes'} required={needsCorrection} rows={3} value={notes} /></label>
      {error && <p className={styles.errorMessage}>{error}</p>}
      <footer><button className={styles.cancelButton} onClick={onClose} type="button">Cancel</button><button className={styles.saveButton} disabled={isSaving} type="submit">{isSaving ? 'Saving…' : `Save ${records.length} SQL entries`}</button></footer>
    </form>
  </div>;
}

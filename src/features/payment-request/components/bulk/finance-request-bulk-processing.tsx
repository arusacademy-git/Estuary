'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { fetchCashAdvances, payCashAdvanceByFinance } from '@/data/payment-requests/cash-advance/cash-advance-api';
import { fetchClaimRequests, processClaimByFinance } from '@/data/payment-requests/claims/api';
import {
  fetchInvoicePayments,
  processInvoicePaymentByFinance,
} from '@/data/payment-requests/invoice-payment/api';
import { fetchPettyCashRequests, markPettyCashPaid, verifyPettyCashByFinance } from '@/data/payment-requests/petty-cash/api';
import { completeTravelAllowanceByFinance, fetchTravelAllowances } from '@/data/payment-requests/travel-allowance/api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { requiresTechManagerApproval } from '@/domain/payment-requests/claims/policy';
import { CLAIM_TYPES, claimTypeDetails, type ClaimRecord } from '@/domain/payment-requests/claims/types';
import type { InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import { notifyCashAdvancePaid } from '@/features/payment-request/notifications/cash-advance-notifications';
import { notifyClaimPaid } from '@/features/payment-request/notifications/claim-notifications';
import { notifyPettyCashFinanceVerified, notifyPettyCashPaid } from '@/features/payment-request/notifications/petty-cash-notifications';
import { notifyTravelAllowanceCompleted } from '@/features/payment-request/notifications/travel-allowance-notifications';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import bulkStyles from '@/features/payment-voucher/components/bulk/payment-voucher-bulk.module.css';
import modalStyles from './request-bulk-preview.module.css';
import localStyles from './finance-request-bulk-processing.module.css';
import { RequestRecordDetails, type RequestApprovalRecord } from './request-bulk-approval';

export type FinanceBulkKind = 'invoice-payments' | 'travel-allowances' | 'claims' | 'cash-advance' | 'petty-cash';
type FinanceRecord = InvoicePaymentRequestRecord | TravelAllowanceRecord | ClaimRecord | CashAdvanceRecord | PettyCashRecord;
type PaymentFilter = 'ALL' | 'TO_REVIEW' | 'MISSING_REFERENCE';

const labels: Record<FinanceBulkKind, { singular: string; plural: string }> = {
  'invoice-payments': { singular: 'Invoice Payment', plural: 'Invoice Payments' },
  'travel-allowances': { singular: 'Travel Allowance', plural: 'Travel Allowances' },
  claims: { singular: 'Claim', plural: 'Claims' },
  'cash-advance': { singular: 'Cash Advance', plural: 'Cash Advances' },
  'petty-cash': { singular: 'Petty Cash request', plural: 'Petty Cash requests' },
};

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
function date(value: string) { const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed); }
function isInvoice(record: FinanceRecord): record is InvoicePaymentRequestRecord { return record.requestType === 'INVOICE_PAYMENT'; }
function isTravel(record: FinanceRecord): record is TravelAllowanceRecord { return record.requestType === 'TRAVEL_ALLOWANCE'; }
function isClaim(record: FinanceRecord): record is ClaimRecord { return record.requestType === 'CLAIM_REQUEST'; }
function isCashAdvance(record: FinanceRecord): record is CashAdvanceRecord { return record.requestType === 'CASH_ADVANCE'; }
function isPettyCash(record: FinanceRecord): record is PettyCashRecord { return record.requestType === 'PETTY_CASH_REQUEST'; }
function reference(record: FinanceRecord) { return isClaim(record) ? record.claimNumber : record.requestNumber; }
function requester(record: FinanceRecord) { return isInvoice(record) ? record.staffName : record.requesterName; }
function requestDate(record: FinanceRecord) { return isClaim(record) ? record.claimDate : record.requestDate; }
function context(record: FinanceRecord) {
  if (isInvoice(record) || isCashAdvance(record)) return record.projectName;
  if (isTravel(record)) return [...new Set(record.lines.map((line) => line.projectName))].join(', ') || 'Travel allowance';
  if (isClaim(record)) return claimTypeDetails(record.claimType).label;
  return record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur';
}
function itemCount(record: FinanceRecord) { return isInvoice(record) ? record.supportingDocuments.length : record.lines.length; }
function eligible(record: FinanceRecord) {
  if (isInvoice(record)) return record.status === 'PENDING_FINANCE_REVIEW';
  if (isTravel(record)) return record.status === 'PENDING_FINANCE_VERIFICATION';
  if (isClaim(record)) return !(requiresTechManagerApproval(record) && !record.managerApprovedAt)
    && ['PENDING_MANAGER_APPROVAL', 'PENDING_DIRECTOR_APPROVAL', 'PENDING_FINANCE_PROCESSING'].includes(record.status);
  if (isCashAdvance(record)) return record.status === 'PENDING_FINANCE_PROCESSING';
  return record.status === 'PENDING_FINANCE_PAYMENT' || record.status === 'FINANCE_VERIFIED';
}
async function loadRecords(kind: FinanceBulkKind, account: BetaAccount): Promise<FinanceRecord[]> {
  if (kind === 'invoice-payments') return fetchInvoicePayments({ role: 'finance', userId: account.id });
  if (kind === 'travel-allowances') return fetchTravelAllowances({ role: 'finance', userId: account.id });
  if (kind === 'claims') return fetchClaimRequests({ role: 'finance', userId: account.id });
  if (kind === 'cash-advance') return fetchCashAdvances({ role: 'finance', userId: account.id });
  return fetchPettyCashRequests({ role: 'finance', userId: account.id });
}

export function FinanceRequestBulkProcessing({ kind }: { kind: FinanceBulkKind }) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [checked, setChecked] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(today());
  const [remarks, setRemarks] = useState('');
  const [claimType, setClaimType] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const label = labels[kind];
  const basePath = `/beta/finance/payment-requests/${kind}`;

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      const current = readBetaSession();
      if (cancelled) return;
      setAccount(current);
      if (!current || current.role !== 'finance') { setChecked(true); return; }
      try {
        const data = await loadRecords(kind, current);
        if (!cancelled) setRecords(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Finance records could not be loaded.');
      } finally {
        if (!cancelled) setChecked(true);
      }
    });
    return () => { cancelled = true; };
  }, [kind]);

  const pending = useMemo(() => records.filter((record) => eligible(record) && !processedIds.includes(record.id) && (
    kind !== 'claims' || claimType === 'ALL' || (isClaim(record) && record.claimType === claimType)
  )), [claimType, kind, processedIds, records]);
  const selected = pending.filter((record) => selectedIds.includes(record.id));
  const selectedTotal = selected.reduce((total, record) => total + record.totalAmount, 0);
  const allSelected = pending.length > 0 && selectedIds.length === pending.length;
  const allReviewed = selectedIds.length > 0 && selectedIds.every((id) => reviewedIds.includes(id));
  const reviewRecord = pending.find((record) => record.id === reviewId) ?? null;
  const reviewRecords = reviewId && selectedIds.includes(reviewId) ? selected : pending;
  const needsPaymentDetails = true;
  const reviewedCount = selectedIds.filter((id) => reviewedIds.includes(id)).length;
  const paymentReferenceFor = (record: FinanceRecord) => reference(record);
  const hasPaymentReference = (record: FinanceRecord) => (isPettyCash(record) && record.status === 'FINANCE_VERIFIED')
    || Boolean(paymentReferenceFor(record));
  const referenceCount = selected.filter(hasPaymentReference).length;
  const paymentRows = selected.filter((record) => {
    if (paymentFilter === 'TO_REVIEW') return !reviewedIds.includes(record.id);
    if (paymentFilter === 'MISSING_REFERENCE') return !hasPaymentReference(record);
    return true;
  });
  const allPaymentDetailsReady = selected.every((record) => {
    if (isInvoice(record)) return true;
    if (isPettyCash(record) && record.status === 'FINANCE_VERIFIED') return true;
    const paymentReference = paymentReferenceFor(record);
    if (!paymentDate || !paymentReference) return false;
    return true;
  });

  function resetConfirmation() { setConfirmed(false); setMessage(''); setError(''); }
  function toggle(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); resetConfirmation(); }
  async function processRecord(record: FinanceRecord, current: BetaAccount) {
    if (isInvoice(record)) {
      return processInvoicePaymentByFinance(
        record.id,
        current.id,
        paymentDate,
        paymentReferenceFor(record),
      );
    }
    const paymentReference = paymentReferenceFor(record);
    if (isTravel(record)) {
      const updated = await completeTravelAllowanceByFinance(record.id, current.id, paymentDate, paymentReference, remarks.trim() || undefined);
      notifyTravelAllowanceCompleted(updated, current);
      return updated;
    }
    if (isClaim(record)) {
      const updated = await processClaimByFinance(record.id, current.id, { paymentDate, paymentReference, notes: remarks.trim() || undefined });
      notifyClaimPaid(updated, current);
      return updated;
    }
    if (isCashAdvance(record)) {
      const updated = await payCashAdvanceByFinance(record.id, current.id, paymentDate, paymentReference);
      notifyCashAdvancePaid(updated, current);
      return updated;
    }
    let verified = record;
    if (record.status === 'PENDING_FINANCE_PAYMENT') {
      verified = await verifyPettyCashByFinance(record.id, {
        financeId: current.id,
        paymentDate,
        paymentReference,
        paymentProofLink: '',
        notes: remarks.trim() || undefined,
      });
      notifyPettyCashFinanceVerified(verified, current);
    }
    const updated = await markPettyCashPaid(verified.id, current.id);
    notifyPettyCashPaid(updated, current);
    return updated;
  }

  async function submit() {
    if (!account || !allReviewed || !allPaymentDetailsReady || !confirmed) {
      setError(`Review every selected ${label.singular}, complete the required payment information and confirm the batch.`);
      return;
    }
    setSubmitting(true); setError(''); setMessage('');
    const succeeded: FinanceRecord[] = [];
    const failed: string[] = [];
    const failureMessages: string[] = [];
    const batchSize = 5;
    for (let offset = 0; offset < selected.length; offset += batchSize) {
      const batch = selected.slice(offset, offset + batchSize);
      const results = await Promise.allSettled(batch.map((record) => processRecord(record, account)));
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') succeeded.push(result.value);
        else {
          failed.push(batch[index].id);
          failureMessages.push(result.reason instanceof Error ? result.reason.message : 'The Finance API rejected the request.');
        }
      });
    }
    setRecords((current) => current.map((record) => succeeded.find((item) => item.id === record.id) ?? record));
    setProcessedIds((current) => [...current, ...succeeded.map((record) => record.id)]);
    setSelectedIds(failed);
    setReviewedIds((current) => current.filter((id) => failed.includes(id)));
    setConfirmed(false); setSubmitting(false);
    if (succeeded.length) setMessage(kind === 'cash-advance'
      ? `${succeeded.length} ${succeeded.length === 1 ? 'Cash Advance was' : 'Cash Advances were'} paid and moved to Staff reconciliation.`
      : `${succeeded.length} ${succeeded.length === 1 ? label.singular : label.plural} processed successfully.`);
    if (failed.length) setError(`${failed.length} ${failed.length === 1 ? 'record needs' : 'records need'} attention and remain selected for retry. ${failureMessages[0]}`);
  }

  if (!checked) return <State title="Loading bulk processing" copy={`Preparing ${label.plural} for Finance…`} />;
  if (!account || account.role !== 'finance') return <State title="Finance access required" copy="This bulk-processing workspace is available only to Finance." />;

  return <main className={`${bulkStyles.page} ${bulkStyles.financeBulkPage}`}>
    <header className={bulkStyles.header}><div><p className={bulkStyles.eyebrow}>Finance workspace</p><h1>Bulk {label.singular} processing</h1><p>Review selected records, enter the required payment information and process the batch together.</p></div><Link className={bulkStyles.backButton} href={basePath}>Back to {label.plural}</Link></header>
    {message && <div className={bulkStyles.message} role="status">{message}</div>}
    {error && <div className={bulkStyles.error} role="alert">{error}</div>}
    <section className={bulkStyles.summaryGrid}><article className={bulkStyles.summaryCard}><span>Ready for Finance</span><strong>{pending.length}</strong><p>Eligible records in this workspace.</p></article><article className={bulkStyles.summaryCard}><span>Selected</span><strong>{selectedIds.length}</strong><p>Records in this batch.</p></article><article className={bulkStyles.summaryCard}><span>Reviewed</span><strong>{selectedIds.filter((id) => reviewedIds.includes(id)).length}</strong><p>Selected records reviewed.</p></article><article className={bulkStyles.summaryCard}><span>Selected total</span><strong>{money(selectedTotal)}</strong><p>Combined batch value.</p></article></section>
    <section className={bulkStyles.panel}>
      <div className={bulkStyles.toolbar}><label className={bulkStyles.selectAll}><input checked={allSelected} disabled={!pending.length} onChange={() => { setSelectedIds(allSelected ? [] : pending.map((record) => record.id)); resetConfirmation(); }} type="checkbox" />Select all ready records</label><div className={localStyles.toolbarMeta}>{kind === 'claims' && <label className={localStyles.filterField}>Claim type<select onChange={(event) => { setClaimType(event.target.value); setSelectedIds([]); setReviewedIds([]); }} value={claimType}><option value="ALL">All Claim types</option>{CLAIM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}<span className={localStyles.recordCount}>{pending.length} {pending.length === 1 ? 'record' : 'records'}</span></div></div>
      {!pending.length ? <div className={bulkStyles.empty}><h2>No records ready for bulk processing</h2><p>Eligible {label.plural} will appear here.</p></div> : <div className={bulkStyles.selectionTableWrapper}><table className={bulkStyles.selectionTable}><thead><tr><th aria-label="Select" /><th>Reference</th><th>Requester</th><th>Project / context</th><th>Date</th><th>Items</th><th>Amount</th><th>Review</th><th aria-label="Actions" /></tr></thead><tbody>{pending.map((record) => { const reviewed = reviewedIds.includes(record.id); return <tr data-selected={selectedIds.includes(record.id)} key={record.id}><td className={bulkStyles.checkCell}><input aria-label={`Select ${reference(record)}`} checked={selectedIds.includes(record.id)} onChange={() => toggle(record.id)} type="checkbox" /></td><td><strong className={bulkStyles.voucherNumber}>{reference(record)}</strong></td><td>{requester(record)}</td><td>{context(record)}</td><td>{date(requestDate(record))}</td><td>{itemCount(record)}</td><td className={bulkStyles.amountCell}>{money(record.totalAmount)}</td><td>{reviewed ? <span className={bulkStyles.reviewed}>Reviewed</span> : <span className={bulkStyles.notReviewed}>Not reviewed</span>}</td><td className={bulkStyles.actionCell}><button className={bulkStyles.reviewButton} onClick={() => { setReviewId(record.id); setConfirmed(false); }} type="button">View details</button></td></tr>; })}</tbody></table></div>}
    </section>
    {selectedIds.length > 0 && <section className={localStyles.confirmationCard}>
      <header className={localStyles.confirmationHeader}><div><p>Finance confirmation</p><h2>Process {selectedIds.length} selected {selectedIds.length === 1 ? 'record' : 'records'}</h2></div><div className={localStyles.totalAmount}><span>Total amount</span><strong>{money(selectedTotal)}</strong></div></header>
      {needsPaymentDetails && <section className={localStyles.sharedSection}><div className={localStyles.sectionTitle}><h3>Shared payment details</h3><span>Applies to all selected records</span></div><div className={localStyles.sharedFields}><label><span className={localStyles.fieldLabel}>Payment date <b>*</b></span><input onChange={(event) => { setPaymentDate(event.target.value); resetConfirmation(); }} type="date" value={paymentDate} /></label><label><span className={localStyles.fieldLabel}>Finance remarks <small>(optional)</small></span><textarea onChange={(event) => { setRemarks(event.target.value); resetConfirmation(); }} placeholder="Note applied to this batch" value={remarks} /></label></div></section>}
      <section className={localStyles.paymentSection}>
        <div className={localStyles.paymentHeading}><div className={localStyles.sectionTitle}><h3>{needsPaymentDetails ? 'Payment information' : 'Processing review'}</h3><span>Payment references follow each request number automatically</span></div><div className={localStyles.paymentFilters}><button data-active={paymentFilter === 'ALL'} onClick={() => setPaymentFilter('ALL')} type="button">All {selected.length}</button><button data-active={paymentFilter === 'TO_REVIEW'} onClick={() => setPaymentFilter('TO_REVIEW')} type="button">To review {selected.length - reviewedCount}</button></div></div>
        <div className={localStyles.progressGrid}><div><span>Reviewed <b>{reviewedCount} of {selected.length}</b></span><i><em style={{ width: `${selected.length ? reviewedCount / selected.length * 100 : 0}%` }} /></i></div>{needsPaymentDetails && <div><span>References added <b>{referenceCount} of {selected.length}</b></span><i><em style={{ width: `${selected.length ? referenceCount / selected.length * 100 : 0}%` }} /></i></div>}</div>
        <div className={localStyles.paymentTable}>
          <div className={`${localStyles.paymentRow} ${!needsPaymentDetails ? localStyles.reviewOnlyRow : ''} ${localStyles.paymentTableHeader}`}><span>Record</span><span>Amount</span>{needsPaymentDetails && <span>Payment reference</span>}<span>Review</span></div>
          <div className={localStyles.paymentTableBody}>{paymentRows.map((record) => {
            const alreadyVerified = isPettyCash(record) && record.status === 'FINANCE_VERIFIED';
            const reviewed = reviewedIds.includes(record.id);
            return <div className={`${localStyles.paymentRow} ${!needsPaymentDetails ? localStyles.reviewOnlyRow : ''}`} key={record.id}><div className={localStyles.recordCell}><strong>{reference(record)}</strong><small>{requester(record)} · {context(record)}</small></div><strong className={localStyles.rowAmount}>{money(record.totalAmount)}</strong>{needsPaymentDetails && <div className={localStyles.referenceCell}>{alreadyVerified ? <span className={localStyles.verifiedPayment}>{reference(record)}</span> : <input aria-label={`Automatic payment reference for ${reference(record)}`} readOnly value={paymentReferenceFor(record)} />}</div>}<button className={localStyles.reviewStatus} data-reviewed={reviewed} onClick={() => setReviewId(record.id)} type="button">{reviewed ? 'Reviewed' : 'Not reviewed'}</button></div>;
          })}{paymentRows.length === 0 && <p className={localStyles.noRows}>No selected records match this view.</p>}</div>
        </div>
        <p className={localStyles.scrollHint}>Review every selected record{needsPaymentDetails ? ' and add all required payment information' : ''} to continue.</p>
        <div className={localStyles.requirements}><span data-complete={allReviewed}><i aria-hidden="true" />Review every selected record</span>{needsPaymentDetails && <span data-complete={allPaymentDetailsReady}><i aria-hidden="true" />Confirm automatic references</span>}</div>
      </section>
      {kind === 'cash-advance' && <div className={localStyles.processingNote}><strong>Cash Advance workflow</strong>Bulk processing records payment and moves each request to Staff reconciliation. It does not close the Cash Advance until Finance verifies the later reconciliation.</div>}
      {kind === 'petty-cash' && <div className={localStyles.processingNote}><strong>Petty Cash workflow</strong>Bulk processing releases the money and moves each request to reconciliation. Purchase receipts and any unused balance are recorded afterward.</div>}
      <footer className={localStyles.confirmationFooter}><label><input checked={confirmed} disabled={!allReviewed || !allPaymentDetailsReady} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />I confirm the selected records and payment information are correct.</label><button disabled={!confirmed || !allReviewed || !allPaymentDetailsReady || submitting} onClick={submit} type="button">{submitting ? 'Processing records…' : `Process ${selectedIds.length} selected`}</button></footer>
    </section>}
    {reviewRecord && <FinanceReviewModal accountId={account.id} currentRecords={reviewRecords} record={reviewRecord} reviewed={reviewedIds.includes(reviewRecord.id)} onChangeRecord={setReviewId} onClose={() => setReviewId(null)} onReviewed={() => setReviewedIds((current) => current.includes(reviewRecord.id) ? current : [...current, reviewRecord.id])} />}
  </main>;
}

function FinanceReviewModal({ accountId, currentRecords, record, reviewed, onChangeRecord, onClose, onReviewed }: { accountId: string; currentRecords: FinanceRecord[]; record: FinanceRecord; reviewed: boolean; onChangeRecord: (id: string) => void; onClose: () => void; onReviewed: () => void }) {
  const currentIndex = currentRecords.findIndex((item) => item.id === record.id);
  const previousRecord = currentIndex > 0 ? currentRecords[currentIndex - 1] : null;
  const nextRecord = currentIndex >= 0 && currentIndex < currentRecords.length - 1 ? currentRecords[currentIndex + 1] : null;
  return <div className={modalStyles.backdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} role="presentation"><section aria-label={`${reference(record)} Finance review`} aria-modal="true" className={modalStyles.modal} role="dialog"><header className={modalStyles.modalHeader}><div className={modalStyles.receiptHeading}><div><p>Finance review</p><h2>{isClaim(record) ? 'Claim' : labels[isInvoice(record) ? 'invoice-payments' : isTravel(record) ? 'travel-allowances' : isCashAdvance(record) ? 'cash-advance' : 'petty-cash'].singular} details</h2></div><span>Reference: {reference(record)}</span></div><button aria-label="Close review" onClick={onClose} type="button">×</button></header><div className={modalStyles.modalBody}><FinanceRecordDetails accountId={accountId} record={record} /></div><footer className={modalStyles.modalFooter}><div className={modalStyles.modalNavigationButtons}><button disabled={!previousRecord} onClick={() => previousRecord && onChangeRecord(previousRecord.id)} type="button">Previous</button><button disabled={!nextRecord} onClick={() => nextRecord && onChangeRecord(nextRecord.id)} type="button">Next</button></div><div className={modalStyles.modalDecisionButtons}><button className={modalStyles.modalCancelButton} onClick={onClose} type="button">Close</button><button className={modalStyles.markReviewedButton} disabled={reviewed} onClick={onReviewed} type="button">{reviewed ? 'Reviewed' : 'Mark as reviewed'}</button></div></footer></section></div>;
}

function FinanceRecordDetails({ accountId, record }: { accountId: string; record: FinanceRecord }) {
  if (!isClaim(record) && !isPettyCash(record)) return <RequestRecordDetails record={record as RequestApprovalRecord} />;
  if (isClaim(record)) return <div className={modalStyles.fullDetails}><DetailSection title="Request overview"><DetailGrid values={[['Status', record.status.replaceAll('_', ' ')], ['Claimant', record.requesterName], ['Position', record.requesterPosition], ['Claim type', claimTypeDetails(record.claimType).label], ['Claim date', date(record.claimDate)], ['Contact', record.requesterContact], ['Items', String(record.lines.length)], ['Total', money(record.totalAmount)]]} /></DetailSection><DetailSection title={`Expense breakdown (${record.lines.length})`}><div className={modalStyles.lineTableWrapper}><table className={modalStyles.lineTable}><thead><tr><th>Date</th><th>Supplier</th><th>Details</th><th>Division</th><th>Receipt</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line) => <tr key={line.id}><td>{date(line.expenseDate)}</td><td>{line.supplier}</td><td>{line.details}</td><td>{line.division}</td><td>{line.receiptLink ? <a href={line.receiptLink} rel="noreferrer" target="_blank">Open ↗</a> : line.receiptDocumentId ? <a href={`/api/v1/payment-requests/claims/documents/${encodeURIComponent(line.receiptDocumentId)}?userId=${encodeURIComponent(accountId)}`} rel="noreferrer" target="_blank">Open ↗</a> : '—'}</td><td>{money(line.amount)}</td></tr>)}</tbody></table></div></DetailSection>{record.notes && <DetailSection title="Notes"><div className={modalStyles.longText}><p>{record.notes}</p></div></DetailSection>}</div>;
  return <div className={modalStyles.fullDetails}><DetailSection title="Request overview"><DetailGrid values={[['Status', record.status.replaceAll('_', ' ')], ['Requester', record.requesterName], ['Position', record.requesterPosition], ['Location', record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur'], ['Request date', date(record.requestDate)], ['Contact', record.requesterContact], ['Items', String(record.lines.length)], ['Total', money(record.totalAmount)]]} /></DetailSection><DetailSection title={`Expense breakdown (${record.lines.length})`}><div className={modalStyles.lineTableWrapper}><table className={modalStyles.lineTable}><thead><tr><th>Date</th><th>Supplier</th><th>Details</th><th>Account</th><th>Proof</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line) => <tr key={line.id}><td>{date(line.expenseDate)}</td><td>{line.supplier}</td><td>{line.details}</td><td>{line.accountType}</td><td>{line.proofLink ? <a href={line.proofLink} rel="noreferrer" target="_blank">Open ↗</a> : '—'}</td><td>{money(line.amount)}</td></tr>)}</tbody></table></div></DetailSection>{record.notes && <DetailSection title="Notes"><div className={modalStyles.longText}><p>{record.notes}</p></div></DetailSection>}</div>;
}
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className={modalStyles.detailSection}><h3>{title}</h3>{children}</section>; }
function DetailGrid({ values }: { values: Array<[string, string]> }) { return <dl className={modalStyles.detailGrid}>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>; }
function State({ title, copy }: { title: string; copy: string }) { return <main className={modalStyles.state}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>; }

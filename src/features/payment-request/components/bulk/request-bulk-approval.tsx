'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  approveCashAdvanceByDirector,
  approveCashAdvanceByManager,
  fetchCashAdvances,
} from '@/data/payment-requests/cash-advance/cash-advance-api';
import {
  fetchInvoicePayments,
  reviewInvoicePaymentByDirector,
  reviewInvoicePaymentByManager,
} from '@/data/payment-requests/invoice-payment/api';
import {
  approveTravelAllowanceByDirector,
  fetchTravelAllowances,
  reviewTravelAllowanceByManager,
} from '@/data/payment-requests/travel-allowance/api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import type { InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';
import { travelLineTotal, type TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import {
  notifyCashAdvanceDirectorApproved,
  notifyCashAdvanceManagerApproved,
} from '@/features/payment-request/notifications/cash-advance-notifications';
import {
  notifyDirectorInvoicePaymentApprovedByManager,
  notifyFinanceInvoicePaymentApprovedByDirector,
} from '@/features/payment-request/notifications/invoice-payment-notifications';
import {
  notifyTravelAllowanceDirectorApproved,
  notifyTravelAllowanceManagerApproved,
} from '@/features/payment-request/notifications/travel-allowance-notifications';
import { useUserSignature } from '@/features/signatures/hooks/use-user-signature';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from '@/features/payment-voucher/components/bulk/payment-voucher-bulk.module.css';
import modalStyles from './request-bulk-preview.module.css';

type ApprovalRole = 'manager' | 'director';
type ApprovalKind = 'travel-allowances' | 'invoice-payments' | 'cash-advance';
type ApprovalRecord = TravelAllowanceRecord | InvoicePaymentRequestRecord | CashAdvanceRecord;

type Props = {
  role: ApprovalRole;
  kind: ApprovalKind;
};

const kindLabels: Record<ApprovalKind, { singular: string; plural: string }> = {
  'travel-allowances': { singular: 'Travel Allowance', plural: 'Travel Allowances' },
  'invoice-payments': { singular: 'Invoice Payment', plural: 'Invoice Payments' },
  'cash-advance': { singular: 'Cash Advance', plural: 'Cash Advances' },
};

function money(value: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}

function date(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(parsed);
}

function fileSize(value: number) {
  return value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(value: string) {
  return value.toLowerCase().split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

function isTravel(record: ApprovalRecord): record is TravelAllowanceRecord {
  return record.requestType === 'TRAVEL_ALLOWANCE';
}

function isInvoice(record: ApprovalRecord): record is InvoicePaymentRequestRecord {
  return record.requestType === 'INVOICE_PAYMENT';
}

function requester(record: ApprovalRecord) {
  return isInvoice(record) ? record.staffName : record.requesterName;
}

function context(record: ApprovalRecord) {
  if (isTravel(record)) return [...new Set(record.lines.map((line) => line.projectName))].join(', ') || 'Travel allowance';
  return record.projectName;
}

function itemCount(record: ApprovalRecord) {
  return isInvoice(record) ? record.supportingDocuments.length : record.lines.length;
}

function recordTypeLabel(record: ApprovalRecord) {
  if (isInvoice(record)) return 'Invoice Payment';
  if (isTravel(record)) return 'Travel Allowance';
  return 'Cash Advance';
}

function recordSummary(record: ApprovalRecord) {
  if (isInvoice(record)) return record.title;
  if (isTravel(record)) return record.remarks || 'No additional notes';
  return record.remarks || record.purpose || 'No additional notes';
}

function isEligible(record: ApprovalRecord, role: ApprovalRole, accountId: string) {
  if (isTravel(record)) {
    return role === 'manager'
      ? record.status === 'PENDING_MANAGER_REVIEW' && record.managerApproverId === accountId
      : record.status === 'PENDING_DIRECTOR_APPROVAL' && record.projectDirectorId === accountId;
  }
  if (isInvoice(record)) {
    return role === 'manager'
      ? record.status === 'PENDING_MANAGER_REVIEW' && record.managerApproverId === accountId
      : record.status === 'PENDING_DIRECTOR_REVIEW' && record.directorApproverId === accountId;
  }
  return role === 'manager'
    ? record.status === 'PENDING_MANAGER_APPROVAL' && record.managerApproverId === accountId
    : record.status === 'PENDING_DIRECTOR_APPROVAL' && record.directorApproverId === accountId;
}

export function RequestBulkApproval({ role, kind }: Props) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [checked, setChecked] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { signature, isLoading: signatureLoading } = useUserSignature(
    kind === 'cash-advance' ? account?.id : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      const current = readBetaSession();
      if (cancelled) return;
      setAccount(current);
      if (!current || current.role !== role) {
        setChecked(true);
        return;
      }

      try {
        const data = kind === 'travel-allowances'
          ? await fetchTravelAllowances({ role, userId: current.id, approvalOnly: true })
          : kind === 'invoice-payments'
            ? await fetchInvoicePayments({ role, userId: current.id, approvalOnly: true })
            : await fetchCashAdvances({ role, userId: current.id, approvalOnly: true });
        if (!cancelled) setRecords(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Approval records could not be loaded.');
      } finally {
        if (!cancelled) setChecked(true);
      }
    });
    return () => { cancelled = true; };
  }, [kind, role]);

  const pending = useMemo(
    () => account ? records.filter((record) => isEligible(record, role, account.id) && !completedIds.includes(record.id)) : [],
    [account, completedIds, records, role],
  );
  const selected = pending.filter((record) => selectedIds.includes(record.id));
  const selectedTotal = selected.reduce((total, record) => total + record.totalAmount, 0);
  const allSelected = pending.length > 0 && selectedIds.length === pending.length;
  const allReviewed = selectedIds.length > 0 && selectedIds.every((id) => reviewedIds.includes(id));
  const reviewRecord = pending.find((record) => record.id === reviewId) ?? null;
  const labels = kindLabels[kind];
  const needsSignature = kind === 'cash-advance';
  const signatureReady = !needsSignature || (!signatureLoading && Boolean(signature));
  const basePath = `/beta/${role === 'manager' ? 'project-manager' : 'director'}/payment-requests/${kind}`;

  function resetConfirmation() {
    setConfirmed(false);
    setMessage('');
    setError('');
  }

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    resetConfirmation();
  }

  async function approve(record: ApprovalRecord, current: BetaAccount) {
    if (isTravel(record)) {
      if (role === 'manager') {
        const updated = await reviewTravelAllowanceByManager(record.id, current.id);
        notifyTravelAllowanceManagerApproved(updated, current);
        return updated;
      }
      const updated = await approveTravelAllowanceByDirector(record.id, current.id);
      notifyTravelAllowanceDirectorApproved(updated, current);
      return updated;
    }

    if (isInvoice(record)) {
      if (role === 'manager') {
        const updated = await reviewInvoicePaymentByManager(record.id, current.id);
        notifyDirectorInvoicePaymentApprovedByManager(updated, current);
        return updated;
      }
      const updated = await reviewInvoicePaymentByDirector(record.id, current.id);
      notifyFinanceInvoicePaymentApprovedByDirector(updated, current);
      return updated;
    }

    if (!signature) throw new Error('Upload your signature in Settings before approving Cash Advances.');
    if (role === 'manager') {
      const updated = await approveCashAdvanceByManager(record.id, current.id, signature.id);
      notifyCashAdvanceManagerApproved(updated, current);
      return updated;
    }
    const updated = await approveCashAdvanceByDirector(record.id, current.id, signature.id);
    notifyCashAdvanceDirectorApproved(updated, current);
    return updated;
  }

  async function submit() {
    if (!account || !allReviewed || !confirmed || !signatureReady) {
      setError(needsSignature && !signatureReady
        ? 'Upload your signature in Settings before approving Cash Advances.'
        : `Review every selected ${labels.singular} and confirm the approvals first.`);
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');
    const succeeded: string[] = [];
    const failed: string[] = [];
    const updatedRecords: ApprovalRecord[] = [];

    for (const record of selected) {
      try {
        updatedRecords.push(await approve(record, account));
        succeeded.push(record.id);
      } catch {
        failed.push(record.id);
      }
    }

    setRecords((current) => current.map((record) => updatedRecords.find((item) => item.id === record.id) ?? record));
    setCompletedIds((current) => [...current, ...succeeded]);
    setSelectedIds(failed);
    setReviewedIds((current) => current.filter((id) => failed.includes(id)));
    setConfirmed(false);
    setSubmitting(false);
    if (succeeded.length) setMessage(`${succeeded.length} ${succeeded.length === 1 ? labels.singular : labels.plural} approved and forwarded.`);
    if (failed.length) setError(`${failed.length} selected ${failed.length === 1 ? 'record could' : 'records could'} not be approved. Please review the remaining selection and retry.`);
  }

  if (!checked) return <State title="Loading bulk approvals" copy={`Preparing assigned ${labels.plural}…`} />;
  if (!account || account.role !== role) return <State title={`${role === 'manager' ? 'Manager' : 'Director'} access required`} copy="This bulk-approval workspace is not available for the signed-in role." />;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{role === 'manager' ? 'Manager' : 'Director'} workspace</p><h1>Bulk {labels.singular} approval</h1><p>Review every selected record, then approve and forward the batch to the next workflow stage.</p></div>
      <Link className={styles.backButton} href={basePath}>Back to {labels.plural}</Link>
    </header>

    {message && <div className={styles.message} role="status">{message}</div>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    {needsSignature && !signatureLoading && !signature && <div className={styles.error}>A saved signature is required for Cash Advance approval. <Link href="/beta/settings/signature">Upload signature</Link></div>}

    <section className={styles.summaryGrid}>
      <article className={styles.summaryCard}><span>Pending approval</span><strong>{pending.length}</strong><p>Eligible records at your workflow stage.</p></article>
      <article className={styles.summaryCard}><span>Selected</span><strong>{selectedIds.length}</strong><p>Records selected in this batch.</p></article>
      <article className={styles.summaryCard}><span>Reviewed</span><strong>{selectedIds.filter((id) => reviewedIds.includes(id)).length}</strong><p>Selected records fully reviewed.</p></article>
      <article className={styles.summaryCard}><span>Selected total</span><strong>{money(selectedTotal)}</strong><p>Combined value advancing in this batch.</p></article>
    </section>

    <section className={styles.panel}>
      <div className={styles.toolbar}><label className={styles.selectAll}><input type="checkbox" checked={allSelected} disabled={!pending.length} onChange={() => { setSelectedIds(allSelected ? [] : pending.map((record) => record.id)); resetConfirmation(); }} />Select all pending approvals</label><span>{pending.length} {pending.length === 1 ? 'record' : 'records'}</span></div>
      {!pending.length ? <div className={styles.empty}><h2>No pending approvals</h2><p>There are no eligible {labels.plural} at your current stage.</p></div> : <div className={styles.selectionTableWrapper}>
        <table className={`${styles.selectionTable} ${modalStyles.previewTable}`}><thead><tr><th aria-label="Select" /><th>Reference</th><th>Requester</th><th>Project / context</th><th>Date</th><th>Items</th><th>Amount</th><th>Review</th><th aria-label="Actions" /></tr></thead><tbody>{pending.map((record) => {
          const reviewed = reviewedIds.includes(record.id);
          return <tr data-selected={selectedIds.includes(record.id)} key={record.id}><td className={styles.checkCell}><input aria-label={`Select ${record.requestNumber}`} checked={selectedIds.includes(record.id)} onChange={() => toggle(record.id)} type="checkbox" /></td><td><strong className={styles.voucherNumber}>{record.requestNumber}</strong><span className={styles.tableSubtext}>{recordSummary(record)}</span></td><td>{requester(record)}</td><td>{context(record)}</td><td>{date(record.requestDate)}</td><td>{itemCount(record)}</td><td className={styles.amountCell}>{money(record.totalAmount)}</td><td>{reviewed ? <span className={styles.reviewed}>Reviewed</span> : <span className={styles.notReviewed}>Not reviewed</span>}</td><td className={styles.actionCell}><button className={styles.reviewButton} onClick={() => { setReviewId(record.id); setConfirmed(false); }} type="button">View details</button></td></tr>;
        })}</tbody></table>
      </div>}
    </section>

    {selectedIds.length > 0 && <section className={styles.confirmationPanel}>
      <div><p className={styles.eyebrow}>Approval confirmation</p><h2>Approve {selectedIds.length} selected {selectedIds.length === 1 ? 'record' : 'records'}</h2><p>This action advances every successful record to its next workflow stage and sends the normal notifications.</p></div>
      {!allReviewed && <p className={styles.notice}>Open and mark every selected record as reviewed before continuing.</p>}
      <label className={styles.confirmationCheck}><input checked={confirmed} disabled={!allReviewed || !signatureReady} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />I confirm that I reviewed and approve the selected {labels.plural}.</label>
      <button className={`${styles.primaryButton} ${styles.fullWidthButton}`} disabled={!allReviewed || !confirmed || !signatureReady || submitting} onClick={submit} type="button">{submitting ? 'Approving records…' : `Approve and forward ${selectedIds.length} selected`}</button>
    </section>}

    {reviewRecord && <ApprovalReviewModal record={reviewRecord} onClose={() => setReviewId(null)} onReviewed={() => { setReviewedIds((current) => current.includes(reviewRecord.id) ? current : [...current, reviewRecord.id]); setReviewId(null); }} />}
  </main>;
}

function ApprovalReviewModal({ record, onClose, onReviewed }: { record: ApprovalRecord; onClose: () => void; onReviewed: () => void }) {
  return <div className={modalStyles.backdrop} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} role="presentation"><section aria-label={`${record.requestNumber} review`} aria-modal="true" className={modalStyles.modal} role="dialog">
    <header className={modalStyles.modalHeader}><div className={modalStyles.receiptHeading}><div><p>Approval review</p><h2>{recordTypeLabel(record)} details</h2></div><span>Reference: {record.requestNumber}</span></div><button aria-label="Close review" onClick={onClose} type="button">×</button></header>
    <div className={modalStyles.modalBody}>
      <RecordDetails record={record} />
    </div>
    <footer className={modalStyles.modalFooter}><p>Marking this record as reviewed unlocks it for the final batch approval.</p><button onClick={onReviewed} type="button">Mark reviewed and close</button></footer>
  </section></div>;
}

function RecordDetails({ record }: { record: ApprovalRecord }) {
  if (isInvoice(record)) {
    const portion = record.paymentPortion === 'UPFRONT_50'
      ? '50% upfront payment'
      : record.paymentPortion === 'BALANCE_50'
        ? '50% balance payment'
        : record.paymentPortion === 'FULL'
          ? 'Full payment'
          : record.paymentPortionOther ?? 'Other';
    return <div className={modalStyles.fullDetails}>
      <DetailSection title="Request overview"><DetailGrid values={[
        ['Status', statusLabel(record.status)], ['Staff', record.staffName], ['Project', record.projectName], ['Request title', record.title],
      ]} /></DetailSection>
      <DetailSection title="Invoice and payment details"><DetailGrid values={[
        ['Vendor', record.vendorName], ['Transfer type', record.transferType], ['Payment portion', portion], ['Currency', record.currency],
        ['Invoice total', money(record.invoiceTotal)], ['Tax / SST', money(record.taxAmount)], ['Amount requested', money(record.requestedAmount)], ['E-invoice', record.eInvoiceLink],
      ]} linkIndexes={[7]} /></DetailSection>
      <DetailSection title="Purpose and remarks"><div className={modalStyles.longText}><strong>Purpose</strong><p>{record.purpose}</p>{record.remarks && <><strong>Additional remarks</strong><p>{record.remarks}</p></>}</div></DetailSection>
      <DetailSection title={`Supporting documents (${record.supportingDocuments.length})`}><Documents documents={record.supportingDocuments} /></DetailSection>
    </div>;
  }

  if (isTravel(record)) return <div className={modalStyles.fullDetails}>
    <DetailSection title="Request overview"><DetailGrid values={[
      ['Status', statusLabel(record.status)], ['Requester', record.requesterName], ['Position', record.requesterPosition], ['Requester role', record.requesterRole],
      ['Contact', record.contact], ['Request date', date(record.requestDate)], ['Payment target', date(record.paymentDueDate)], ['Total allowance', money(record.totalAmount)],
    ]} /></DetailSection>
    <DetailSection title={`Travel entries (${record.lines.length})`}><div className={modalStyles.lineTableWrapper}><table className={modalStyles.lineTable}><thead><tr><th>#</th><th>Employee</th><th>Travel date</th><th>Project</th><th>Reason</th><th>Meals</th><th>Special allowance</th><th>Total</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.employeeName}</td><td>{date(line.travelDate)}</td><td>{line.projectName}</td><td>{line.reason}</td><td>{line.meals.length ? line.meals.map((meal) => meal.toLowerCase()).join(', ') : '—'}</td><td>{money(line.specialAllowance)}{line.specialAllowanceReason && <small>{line.specialAllowanceReason}</small>}</td><td>{money(travelLineTotal(line))}</td></tr>)}</tbody></table></div></DetailSection>
    {record.remarks && <DetailSection title="Remarks"><div className={modalStyles.longText}><p>{record.remarks}</p></div></DetailSection>}
    <DetailSection title="Supporting information"><Documents documents={record.supportingDocuments} links={record.supportingDocumentLinks} /></DetailSection>
  </div>;

  return <div className={modalStyles.fullDetails}>
    <DetailSection title="Request overview"><DetailGrid values={[
      ['Status', statusLabel(record.status)], ['Requester', record.requesterName], ['Position', record.requesterPosition], ['Department', record.requesterDepartment],
      ['Contact', record.requesterContact], ['Request date', date(record.requestDate)], ['Project', record.projectName], ['Total advance', money(record.totalAmount)],
    ]} /></DetailSection>
    <DetailSection title="Purpose"><div className={modalStyles.longText}><p>{record.purpose}</p>{record.remarks && <><strong>Additional remarks</strong><p>{record.remarks}</p></>}</div></DetailSection>
    <DetailSection title="Bank details"><DetailGrid values={[
      ['Account holder', record.accountHolderName], ['Bank', record.bankName], ['Account number', record.bankAccountNumber], ['Currency', record.currency],
    ]} /></DetailSection>
    <DetailSection title={`Advance lines (${record.lines.length})`}><div className={modalStyles.lineTableWrapper}><table className={modalStyles.lineTable}><thead><tr><th>#</th><th>Description</th><th>Purpose</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.description}</td><td>{line.purpose}</td><td>{money(line.amount)}</td></tr>)}</tbody></table></div></DetailSection>
    <DetailSection title="Signature progress"><DetailGrid values={[
      ['Staff signature', record.staffSignatureKey ? 'Available' : 'Missing'], ['Staff signed', date(record.staffSignedAt)], ['Manager signature', record.managerSignatureKey ? 'Available' : 'Pending'], ['Director signature', record.directorSignatureKey ? 'Available' : 'Pending'],
    ]} /></DetailSection>
    <DetailSection title={`Supporting documents (${record.supportingDocuments.length})`}><Documents documents={record.supportingDocuments} /></DetailSection>
  </div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={modalStyles.detailSection}><h3>{title}</h3>{children}</section>;
}

function DetailGrid({ values, linkIndexes = [] }: { values: Array<[string, string]>; linkIndexes?: number[] }) {
  return <dl className={modalStyles.detailGrid}>{values.map(([label, value], index) => <div key={label}><dt>{label}</dt><dd>{linkIndexes.includes(index) ? <a href={value} rel="noreferrer" target="_blank">Open link ↗</a> : value || '—'}</dd></div>)}</dl>;
}

function Documents({ documents, links = [] }: {
  documents: Array<{ id: string; fileName: string; mimeType: string; size: number; dataUrl: string }>;
  links?: string[];
}) {
  if (!documents.length && !links.length) return <p className={modalStyles.emptyDetails}>No supporting documents or links were provided.</p>;
  return <div className={modalStyles.documents}>
    {documents.map((document) => <a download={document.fileName} href={document.dataUrl} key={document.id}><span aria-hidden="true" className={modalStyles.documentIcon}>▧</span><div className={modalStyles.documentInfo}><strong>{document.fileName}</strong><small>{document.mimeType} · {fileSize(document.size)}</small></div><b>Download</b></a>)}
    {links.map((link) => <a href={link} key={link} rel="noreferrer" target="_blank"><span aria-hidden="true" className={modalStyles.documentIcon}>↗</span><div className={modalStyles.documentInfo}><strong>Supporting link</strong><small>{link}</small></div><b>Open</b></a>)}
  </div>;
}

function State({ title, copy }: { title: string; copy: string }) {
  return <main className={modalStyles.state}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>;
}

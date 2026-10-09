'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  approveClaimByManager,
  fetchClaimRequests,
  forwardClaimByDirector,
} from '@/data/payment-requests/claims/api';
import {
  approvePettyCashByDirector,
  approvePettyCashByManager,
  fetchPettyCashRequests,
} from '@/data/payment-requests/petty-cash/api';
import { CLAIM_TYPES, claimTypeDetails, type ClaimRecord, type ClaimType } from '@/domain/payment-requests/claims/types';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import {
  notifyClaimDirectorForwarded,
  notifyClaimManagerApproved,
} from '@/features/payment-request/notifications/claim-notifications';
import {
  notifyPettyCashDirectorApproved,
  notifyPettyCashManagerApproved,
} from '@/features/payment-request/notifications/petty-cash-notifications';
import { claimLineAmount } from '@/domain/payment-requests/claims/policy';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import styles from '@/features/payment-voucher/components/bulk/payment-voucher-bulk.module.css';
import modalStyles from './request-bulk-preview.module.css';

type PreviewRole = 'manager' | 'director';
type PreviewKind = 'petty-cash' | 'claims';
type BulkRecord = PettyCashRecord | ClaimRecord;

type Props = {
  role: PreviewRole;
  kind: PreviewKind;
};

function money(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(value);
}

function date(value: string) {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
}

function fileSize(value: number) {
  if (!value) return 'Saved receipt';
  return value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isClaim(record: BulkRecord): record is ClaimRecord {
  return record.requestType === 'CLAIM_REQUEST';
}

function reference(record: BulkRecord) {
  return isClaim(record) ? record.claimNumber : record.requestNumber;
}

function isPending(record: BulkRecord, role: PreviewRole, accountId: string) {
  if (isClaim(record)) {
    const assigned = role === 'manager'
      ? record.managerApproverId === accountId
      : record.directorApproverId === accountId;
    const previewed = role === 'manager'
      ? Boolean(record.managerApprovedAt)
      : Boolean(record.directorReviewedAt);
    return assigned && !previewed && !['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(record.status);
  }

  const assigned = role === 'manager'
    ? record.managerApproverId === accountId || record.financeReviewerId === accountId
    : (record.directorApproverId === accountId || record.financeReviewerId === accountId)
      && record.requesterRole !== 'director';
  const previewed = role === 'manager'
    ? Boolean(record.managerApprovedAt)
    : Boolean(record.directorApprovedAt);
  return assigned && !previewed && record.status !== 'RETURNED_TO_STAFF';
}

export function RequestBulkPreview({ role, kind }: Props) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [records, setRecords] = useState<BulkRecord[]>([]);
  const [checked, setChecked] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [claimTypeFilter, setClaimTypeFilter] = useState<ClaimType | 'ALL'>('ALL');

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
        const data = kind === 'claims'
          ? await fetchClaimRequests({ role, userId: current.id })
          : await fetchPettyCashRequests({ role, userId: current.id });
        if (!cancelled) setRecords(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Preview records could not be loaded.');
      } finally {
        if (!cancelled) setChecked(true);
      }
    });

    return () => { cancelled = true; };
  }, [kind, role]);

  const pending = useMemo(
    () => account
      ? records.filter((record) => isPending(record, role, account.id) && !completedIds.includes(record.id))
      : [],
    [account, completedIds, records, role],
  );
  const visiblePending = useMemo(
    () => kind === 'claims' && claimTypeFilter !== 'ALL'
      ? pending.filter((record) => isClaim(record) && record.claimType === claimTypeFilter)
      : pending,
    [claimTypeFilter, kind, pending],
  );
  const selected = pending.filter((record) => selectedIds.includes(record.id));
  const selectedTotal = selected.reduce((total, record) => total + record.totalAmount, 0);
  const allSelected = visiblePending.length > 0 && visiblePending.every((record) => selectedIds.includes(record.id));
  const allReviewed = selectedIds.length > 0 && selectedIds.every((id) => reviewedIds.includes(id));
  const reviewRecord = pending.find((record) => record.id === reviewId) ?? null;
  const label = kind === 'claims' ? 'Claim' : 'Petty Cash request';
  const pluralLabel = kind === 'claims' ? 'Claims' : 'Petty Cash requests';
  const basePath = `/beta/${role === 'manager' ? 'project-manager' : 'director'}/payment-requests/${kind}`;

  function resetConfirmation() {
    setConfirmed(false);
    setMessage('');
    setError('');
  }

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id]);
    resetConfirmation();
  }

  function openReview(id: string) {
    setReviewId(id);
    setConfirmed(false);
  }

  async function recordPreview(record: BulkRecord, current: BetaAccount) {
    if (isClaim(record)) {
      if (role === 'manager') {
        const updated = await approveClaimByManager(record.id, current.id);
        notifyClaimManagerApproved(updated, current);
        return updated;
      }
      const updated = await forwardClaimByDirector(record.id, current.id);
      notifyClaimDirectorForwarded(updated, current);
      return updated;
    }

    if (role === 'manager') {
      const updated = await approvePettyCashByManager(record.id, current.id);
      notifyPettyCashManagerApproved(updated, current);
      return updated;
    }
    const updated = await approvePettyCashByDirector(record.id, current.id);
    notifyPettyCashDirectorApproved(updated, current);
    return updated;
  }

  async function submit() {
    if (!account || !allReviewed || !confirmed) {
      setError(`Review every selected ${label} and confirm the previews first.`);
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');
    const succeeded: string[] = [];
    const failed: string[] = [];
    const updatedRecords: BulkRecord[] = [];

    for (const record of selected) {
      try {
        updatedRecords.push(await recordPreview(record, account));
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

    if (succeeded.length) setMessage(`${succeeded.length} ${succeeded.length === 1 ? label : pluralLabel} marked as previewed.`);
    if (failed.length) setError(`${failed.length} selected ${failed.length === 1 ? 'record could' : 'records could'} not be updated. Please retry.`);
  }

  if (!checked) return <State title="Loading bulk previews" copy={`Preparing assigned ${pluralLabel}…`} />;
  if (!account || account.role !== role) return <State title={`${role === 'manager' ? 'Manager' : 'Director'} access required`} copy="This bulk-preview workspace is not available for the signed-in role." />;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{role === 'manager' ? 'Manager' : 'Director'} workspace</p>
          <h1>Bulk {label} preview</h1>
          <p>Review assigned {pluralLabel}, then acknowledge the previews together. This records visibility only and does not delay Finance processing.</p>
        </div>
        <Link className={styles.backButton} href={basePath}>Back to {pluralLabel}</Link>
      </header>

      {message && <div className={styles.message} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}><span>Pending preview</span><strong>{pending.length}</strong><p>Assigned records not previewed yet.</p></article>
        <article className={styles.summaryCard}><span>Selected</span><strong>{selectedIds.length}</strong><p>Records selected in this batch.</p></article>
        <article className={styles.summaryCard}><span>Reviewed</span><strong>{selectedIds.filter((id) => reviewedIds.includes(id)).length}</strong><p>Selected records fully reviewed.</p></article>
        <article className={styles.summaryCard}><span>Selected total</span><strong>{money(selectedTotal)}</strong><p>Combined value of this batch.</p></article>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.selectAll}>
            <input type="checkbox" checked={allSelected} disabled={!visiblePending.length} onChange={() => {
              const visibleIds = new Set(visiblePending.map((record) => record.id));
              setSelectedIds((current) => allSelected
                ? current.filter((id) => !visibleIds.has(id))
                : [...new Set([...current, ...visibleIds])]);
              resetConfirmation();
            }} />
            Select all {kind === 'claims' && claimTypeFilter !== 'ALL' ? 'matching' : 'pending'} previews
          </label>
          {kind === 'claims' ? <div className={modalStyles.bulkFilterControls}>
            <label className={modalStyles.claimTypeFilter}><span>Claim type</span><select value={claimTypeFilter} onChange={(event) => setClaimTypeFilter(event.target.value as ClaimType | 'ALL')}><option value="ALL">All Claim types</option>{CLAIM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <span>{visiblePending.length} of {pending.length} records</span>
          </div> : <span>{pending.length} {pending.length === 1 ? 'record' : 'records'}</span>}
        </div>

        {!pending.length ? (
          <div className={styles.empty}><h2>No pending previews</h2><p>All assigned {pluralLabel} have been previewed.</p></div>
        ) : !visiblePending.length ? (
          <div className={styles.empty}><h2>No matching Claims</h2><p>No pending previews match the selected Claim type.</p></div>
        ) : (
          <div className={styles.selectionTableWrapper}>
            <table className={`${styles.selectionTable} ${modalStyles.previewTable}`}>
              <thead><tr><th aria-label="Select" /><th>Reference</th><th>Requester</th><th>{kind === 'claims' ? 'Claim type' : 'Location'}</th><th>Date</th><th>Entries</th><th>Amount</th><th>Review</th><th aria-label="Actions" /></tr></thead>
              <tbody>{visiblePending.map((record) => {
                const reviewed = reviewedIds.includes(record.id);
                return <tr data-selected={selectedIds.includes(record.id)} key={record.id}>
                  <td className={styles.checkCell}><input aria-label={`Select ${reference(record)}`} type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggle(record.id)} /></td>
                  <td><strong className={styles.voucherNumber}>{reference(record)}</strong><span className={styles.tableSubtext}>{record.notes || 'No additional notes'}</span></td>
                  <td>{record.requesterName}<span className={styles.tableSubtext}>{record.requesterPosition}</span></td>
                  <td>{isClaim(record) ? claimTypeDetails(record.claimType).label : record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur'}</td>
                  <td>{date(isClaim(record) ? record.claimDate : record.requestDate)}</td>
                  <td>{record.lines.length}</td>
                  <td className={styles.amountCell}>{money(record.totalAmount)}</td>
                  <td>{reviewed ? <span className={styles.reviewed}>Reviewed</span> : <span className={styles.notReviewed}>Not reviewed</span>}</td>
                  <td className={styles.actionCell}><button className={styles.reviewButton} type="button" onClick={() => openReview(record.id)}>View details</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      {selectedIds.length > 0 && (
        <section className={styles.confirmationPanel}>
          <div><p className={styles.eyebrow}>Preview confirmation</p><h2>Confirm {selectedIds.length} selected {selectedIds.length === 1 ? 'preview' : 'previews'}</h2><p>Every selected record must be reviewed. This records only that the {role === 'manager' ? 'Manager' : 'Director'} viewed it.</p></div>
          {!allReviewed && <p className={styles.notice}>Review every selected record before continuing.</p>}
          <label className={styles.confirmationCheck}><input type="checkbox" checked={confirmed} disabled={!allReviewed} onChange={(event) => setConfirmed(event.target.checked)} />I confirm that I reviewed the selected {pluralLabel}.</label>
          <button className={`${styles.primaryButton} ${styles.fullWidthButton}`} type="button" disabled={!allReviewed || !confirmed || submitting} onClick={submit}>{submitting ? 'Saving previews…' : `Confirm ${selectedIds.length} selected`}</button>
        </section>
      )}

      {reviewRecord && <RequestPreviewModal
        record={reviewRecord}
        viewerId={account.id}
        onClose={() => setReviewId(null)}
        onReviewed={() => {
          setReviewedIds((current) => current.includes(reviewRecord.id) ? current : [...current, reviewRecord.id]);
          setReviewId(null);
        }}
      />}
    </main>
  );
}

function RequestPreviewModal({ record, viewerId, onClose, onReviewed }: { record: BulkRecord; viewerId: string; onClose: () => void; onReviewed: () => void }) {
  const evidenceCount = isClaim(record)
    ? record.lines.filter((line) => Boolean(line.receiptDocumentId || line.receiptLink)).length
    : record.lines.filter((line) => Boolean(line.proofLink)).length;
  return <div className={modalStyles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section aria-label={`${reference(record)} preview`} aria-modal="true" className={modalStyles.modal} role="dialog">
      <header className={modalStyles.modalHeader}>
        <div className={modalStyles.receiptHeading}><div><p>Preview details</p><h2>{isClaim(record) ? 'Claim details' : 'Petty Cash details'}</h2></div><span>Reference: {reference(record)}</span></div>
        <button aria-label="Close preview" type="button" onClick={onClose}>×</button>
      </header>
      <div className={modalStyles.modalBody}>
        <div className={modalStyles.fullDetails}>
          <section className={modalStyles.detailSection}>
            <h3>Request overview</h3>
            <dl className={modalStyles.detailGrid}>
              <div><dt>Requester</dt><dd>{record.requesterName}</dd></div>
              <div><dt>Position</dt><dd>{record.requesterPosition}</dd></div>
              <div><dt>Date</dt><dd>{date(isClaim(record) ? record.claimDate : record.requestDate)}</dd></div>
              <div><dt>Type / location</dt><dd>{isClaim(record) ? claimTypeDetails(record.claimType).label : record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur'}</dd></div>
              <div><dt>Entries</dt><dd>{record.lines.length}</dd></div>
              <div><dt>Total</dt><dd>{money(record.totalAmount)}</dd></div>
            </dl>
          </section>
          {record.notes && <section className={modalStyles.detailSection}><h3>Notes</h3><div className={modalStyles.longText}><p>{record.notes}</p></div></section>}
          <section className={modalStyles.detailSection}>
            <h3>Expense breakdown ({record.lines.length})</h3>
            <div className={modalStyles.lineTableWrapper}>{isClaim(record) ? <table className={modalStyles.lineTable}><thead><tr><th>#</th><th>Date</th><th>Supplier / route</th><th>Details</th><th>Account</th><th>Division</th><th>Receipt</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{date(line.expenseDate)}</td><td>{record.claimType === 'MILEAGE' ? `${line.from} → ${line.to}` : line.supplier || '—'}</td><td>{line.details}</td><td>{line.accountType || '—'}</td><td>{line.division || '—'}</td><td>{line.receiptDocumentId ? <a href={`/api/v1/payment-requests/claims/documents/${encodeURIComponent(line.receiptDocumentId)}?userId=${encodeURIComponent(viewerId)}`} rel="noreferrer" target="_blank">Preview ↗</a> : line.receiptLink ? <a href={line.receiptLink} rel="noreferrer" target="_blank">Open link ↗</a> : '—'}</td><td>{money(claimLineAmount(record.claimType, line))}</td></tr>)}</tbody></table> : <table className={modalStyles.lineTable}><thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Details</th><th>Account</th><th>Division</th><th>Proof</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{date(line.expenseDate)}</td><td>{line.supplier}</td><td>{line.details}</td><td>{line.accountType}</td><td>{line.division}</td><td>{line.proofLink ? <a href={line.proofLink} rel="noreferrer" target="_blank">Open proof ↗</a> : '—'}</td><td>{money(line.amount)}</td></tr>)}</tbody></table>}</div>
          </section>
          {evidenceCount > 0 && <section className={modalStyles.detailSection}>
            <h3>Receipts and supporting documents ({evidenceCount})</h3>
            <div className={modalStyles.documents}>{isClaim(record) ? record.lines.map((line, index) => {
              const href = line.receiptDocumentId
                ? `/api/v1/payment-requests/claims/documents/${encodeURIComponent(line.receiptDocumentId)}?userId=${encodeURIComponent(viewerId)}`
                : line.receiptLink;
              if (!href) return null;
              return <a href={href} key={line.id} rel="noreferrer" target="_blank"><span aria-hidden="true" className={modalStyles.documentIcon}>▧</span><div className={modalStyles.documentInfo}><strong>{line.receiptFileName || `Receipt ${index + 1}`}</strong><small>{line.receiptDocumentId ? `${line.receiptMimeType || 'Receipt'} · ${fileSize(line.receiptFileSize)}` : 'External receipt link'}</small></div><b>Open</b></a>;
            }) : record.lines.map((line, index) => line.proofLink ? <a href={line.proofLink} key={line.id} rel="noreferrer" target="_blank"><span aria-hidden="true" className={modalStyles.documentIcon}>↗</span><div className={modalStyles.documentInfo}><strong>Expense proof {index + 1}</strong><small>{line.supplier || line.proofLink}</small></div><b>Open</b></a> : null)}</div>
          </section>}
        </div>
      </div>
      <footer className={`${modalStyles.modalFooter} ${modalStyles.modalFooterEnd}`}><button type="button" onClick={onReviewed}>Mark reviewed and close</button></footer>
    </section>
  </div>;
}

function State({ title, copy }: { title: string; copy: string }) {
  return <main className={modalStyles.state}><h1>{title}</h1><p>{copy}</p><Link href="/beta/dashboard">Back to dashboard</Link></main>;
}

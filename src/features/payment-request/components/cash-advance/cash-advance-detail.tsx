'use client';

import { useState } from 'react';
import type { CashAdvanceDocument, CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import Link from 'next/link';
import { CashAdvanceProgress } from './cash-advance-progress';
import { CashAdvancePdfForms } from './cash-advance-pdf-forms';
import { CashAdvanceStatusBadge } from './cash-advance-status-badge';
import styles from './cash-advance.module.css';

const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
const date = (value?: string) => value ? new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';

export function CashAdvanceDetail({ record, actions, backHref = '/beta/payment-records' }: { record: CashAdvanceRecord; actions?: React.ReactNode; backHref?: string }) {
  const [documentError, setDocumentError] = useState('');

  async function previewDocument(document: CashAdvanceDocument) {
    setDocumentError('');
    const previewWindow = window.open('about:blank', '_blank');

    if (!previewWindow) {
      setDocumentError('Allow pop-ups to preview the supporting document.');
      return;
    }

    try {
      const response = await fetch(document.dataUrl);
      const blob = await response.blob();
      const previewUrl = URL.createObjectURL(blob);
      previewWindow.location.href = previewUrl;
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    } catch {
      previewWindow.close();
      setDocumentError('The supporting document could not be previewed.');
    }
  }

  function downloadDocument(document: CashAdvanceDocument) {
    setDocumentError('');
    const link = window.document.createElement('a');
    link.href = document.dataUrl;
    link.download = document.fileName;
    link.style.display = 'none';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className={styles.detailPage}>
      <Link className={styles.backLink} href={backHref}>← Back to Cash Advances</Link>
      <div className={styles.layout}>
        <main className={styles.receipt}>
          <header className={styles.receiptHeader}>
            <div><p className={styles.eyebrow}>Cash Advance record</p><h1>{record.requestNumber}</h1><p className={styles.muted}>Submitted by {record.requesterName} · {date(record.createdAt)}</p></div>
            <div className={styles.receiptAmount}><span>Amount requested</span><strong>{money(record.totalAmount)}</strong><CashAdvanceStatusBadge status={record.status} /></div>
          </header>
          <section className={styles.receiptSection}>
            <div className={styles.receiptSectionTitle}><h2>Request overview</h2></div>
            <dl className={styles.detailGrid}>
              <div><dt>Request date</dt><dd>{date(record.requestDate)}</dd></div><div><dt>Staff</dt><dd>{record.requesterName}</dd></div><div><dt>Department</dt><dd>{record.requesterDepartment}</dd></div>
              <div><dt>Position</dt><dd>{record.requesterPosition}</dd></div><div><dt>Project</dt><dd>{record.projectName}</dd></div><div><dt>Contact</dt><dd>{record.requesterContact}</dd></div>
              <div className={styles.detailWide}><dt>Purpose</dt><dd>{record.purpose}</dd></div>{record.remarks && <div className={styles.detailWide}><dt>Additional remarks</dt><dd>{record.remarks}</dd></div>}
            </dl>
          </section>
          <section className={styles.receiptSection}><div className={styles.receiptSectionTitle}><h2>Payment account</h2></div><dl className={styles.detailGrid}><div><dt>Account holder</dt><dd>{record.accountHolderName || '—'}</dd></div><div><dt>Bank</dt><dd>{record.bankName || '—'}</dd></div><div><dt>Account number</dt><dd>{record.bankAccountNumber || '—'}</dd></div></dl></section>
          <section className={styles.receiptSection}>
            <div className={styles.receiptSectionTitle}><h2>Breakdown of request</h2><span>{record.lines.length} {record.lines.length === 1 ? 'entry' : 'entries'}</span></div>
            <div className={styles.tableShell}><table className={styles.lineTable}><thead><tr><th>#</th><th>Description</th><th>Purpose</th><th>Amount</th></tr></thead><tbody>{record.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.description}</td><td>{line.purpose}</td><td className={styles.amount}>{money(line.amount)}</td></tr>)}</tbody></table></div>
            <div className={styles.receiptTotal}><span>Total requested</span><strong>{money(record.totalAmount)}</strong></div>
          </section>
          {['PENDING_FINANCE_PROCESSING', 'PENDING_RECONCILIATION', 'PENDING_FINANCE_RECONCILIATION', 'COMPLETED'].includes(record.status) && <CashAdvancePdfForms record={record} />}
          <section className={styles.receiptSection}>
            <div className={styles.receiptSectionTitle}><h2>Supporting documents</h2></div>
            {documentError && <div className={styles.error} role="alert">{documentError}</div>}
            {record.supportingDocuments.length ? <div className={styles.documentList}>{record.supportingDocuments.map((document) => <div className={styles.documentRow} key={document.id}><span aria-hidden="true" className={styles.documentIcon}><svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M14 2.75H6.75A1.75 1.75 0 0 0 5 4.5v15A1.75 1.75 0 0 0 6.75 21h10.5A1.75 1.75 0 0 0 19 19.5V7.75L14 2.75Z" /><path d="M14 2.75v5h5M8.5 13h7M8.5 16.5h7" /></svg></span><div className={styles.documentCopy}><strong>{document.fileName}</strong><small>{Math.max(1, Math.round(document.size / 1024))} KB · {document.mimeType || 'Supporting document'}</small></div><div className={styles.documentActions}><button onClick={() => previewDocument(document)} type="button">Preview document</button><button onClick={() => downloadDocument(document)} type="button">Download</button></div></div>)}</div> : <div className={styles.noDocuments}>No supporting documents attached.</div>}
          </section>
          {record.reconciliation && <section className={`${styles.receiptSection} ${styles.reconciliationSection}`}><div className={styles.receiptSectionTitle}><h2>Cash Advance reconciliation</h2><span>{record.reconciliation.expenses.length} expenses</span></div><dl className={styles.detailGrid}><div><dt>Total spent</dt><dd>{money(record.reconciliation.totalSpent)}</dd></div><div><dt>Balance</dt><dd>{money(record.reconciliation.balance)}</dd></div><div><dt>Outcome</dt><dd>{record.reconciliation.outcome}</dd></div></dl><div className={styles.tableShell}><table className={`${styles.lineTable} ${styles.reconciliationTable}`}><thead><tr><th>Date</th><th>Supplier</th><th>Description</th><th>Type of account</th><th>Division</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>{record.reconciliation.expenses.map((expense) => <tr key={expense.id}><td>{expense.expenseDate}</td><td>{expense.supplier || '—'}</td><td>{expense.description}</td><td>{expense.accountType || '—'}</td><td>{expense.division || '—'}</td><td className={styles.amount}>{money(expense.amount)}</td><td>{expense.receiptLink || expense.receipt?.fileName || '—'}</td></tr>)}</tbody></table></div>{(record.reconciliation.participantProof || record.reconciliation.participantProofLink || record.reconciliation.balanceReturnProof) && <div className={styles.reconciliationDocuments}>{record.reconciliation.participantProofLink && <div className={styles.documentRow}><span aria-hidden="true" className={styles.documentIcon}>↗</span><div className={styles.documentCopy}><strong>Participant Allowance Google Sheet</strong><small>Shared participant allowance evidence</small></div><div className={styles.documentActions}><a href={record.reconciliation.participantProofLink} rel="noreferrer" target="_blank">Open sheet</a></div></div>}{record.reconciliation.participantProof && <div className={styles.documentRow}><span aria-hidden="true" className={styles.documentIcon}>↑</span><div className={styles.documentCopy}><strong>{record.reconciliation.participantProof.fileName}</strong><small>Completed participant-signed form</small></div><div className={styles.documentActions}><button onClick={() => previewDocument(record.reconciliation!.participantProof!)} type="button">Preview</button><button onClick={() => downloadDocument(record.reconciliation!.participantProof!)} type="button">Download</button></div></div>}{record.reconciliation.balanceReturnProof && <div className={styles.documentRow}><span aria-hidden="true" className={styles.documentIcon}>↑</span><div className={styles.documentCopy}><strong>{record.reconciliation.balanceReturnProof.fileName}</strong><small>Balance-return payment proof</small></div><div className={styles.documentActions}><button onClick={() => previewDocument(record.reconciliation!.balanceReturnProof!)} type="button">Preview</button><button onClick={() => downloadDocument(record.reconciliation!.balanceReturnProof!)} type="button">Download</button></div></div>}</div>}</section>}
        </main>
        <aside className={styles.rail}>{record.status === 'RETURNED_TO_STAFF' ? <section className={styles.returnBlock}><div><strong>Action required</strong><span>Returned {date(record.returnedAt)}</span></div><small>Reviewer&apos;s remarks</small><p>{record.returnRemarks || 'Please review the request and submit the required corrections.'}</p><span className={styles.returnGuidance}>Correct the request or reconciliation details and resubmit to resume processing.</span>{actions}</section> : actions}<CashAdvanceProgress record={record} /></aside>
      </div>
    </div>
  );
}

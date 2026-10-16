import type { CashAdvanceRequestLine } from '@/domain/payment-requests/cash-advance/types';
import type { UserSignatureRecord } from '@/domain/signatures/types';
import styles from '../cash-advance.module.css';

const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);

export function CashAdvanceReview({
  requesterName, requestDate, projectName, purpose, managerName, directorName, lines, total,
  accountHolderName, bankName, bankAccountNumber,
  signature, confirmed, saving, error, amendment, onConfirmedChange, onBack, onSubmit,
}: {
  requesterName: string; requestDate: string; projectName: string; purpose: string; managerName?: string; directorName: string;
  accountHolderName: string; bankName: string; bankAccountNumber: string;
  lines: CashAdvanceRequestLine[]; total: number; signature: UserSignatureRecord | null; confirmed: boolean;
  saving: boolean; error: string; amendment: boolean; onConfirmedChange: (value: boolean) => void; onBack: () => void; onSubmit: () => void;
}) {
  return (
    <div className={styles.page}>
      {error && <div className={styles.error}>{error}</div>}
      <div className={`${styles.formReceipt} ${styles.reviewReceipt}`}>
        <header className={styles.reviewReceiptHeader}>
          <div>
            <span className={styles.eyebrow}>Cash Advance request</span>
            <h1>Request overview</h1>
          </div>
          <div className={styles.reviewAmount}>
            <span>Total amount requested</span>
            <strong>{money(total)}</strong>
          </div>
        </header>

        <section className={styles.reviewOverviewSection}>
          <dl className={styles.reviewGrid}>
            <div><dt>Request date</dt><dd>{requestDate}</dd></div>
            <div><dt>Project</dt><dd>{projectName}</dd></div>
            <div><dt>Purpose</dt><dd>{purpose}</dd></div>
          </dl>
          <div className={styles.reviewApproval}>
            <h2>Approval</h2>
            <dl className={styles.reviewGrid}>
              <div><dt>Requester</dt><dd>{requesterName}</dd></div>
              {managerName && <div><dt>Manager preview · Informational</dt><dd>{managerName}</dd></div>}
              <div><dt>Approving Director</dt><dd>{directorName}</dd></div>
            </dl>
          </div>
        </section>

        <section className={styles.reviewSection}>
          <div className={styles.reviewInlineHeading}>
            <h2>Payment account</h2>
            <p>Bank account receiving the Cash Advance</p>
          </div>
          <dl className={styles.reviewGrid}>
            <div><dt>Account holder</dt><dd>{accountHolderName}</dd></div>
            <div><dt>Bank</dt><dd>{bankName}</dd></div>
            <div><dt>Account number</dt><dd>{bankAccountNumber}</dd></div>
          </dl>
        </section>

        <section className={styles.reviewSection}>
          <div className={styles.reviewInlineHeading}>
            <h2>Expense entries</h2>
            <p>{lines.length} {lines.length === 1 ? 'entry' : 'entries'}</p>
          </div>
          <div className={styles.tableShell}>
            <table className={styles.lineTable}>
              <thead><tr><th>#</th><th>Account</th><th>Description</th><th>Purpose</th><th>Amount</th></tr></thead>
              <tbody>{lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.accountType || '—'}</td><td>{line.description || '—'}</td><td>{line.purpose || '—'}</td><td className={styles.amount}>{money(line.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <div className={styles.reviewTotal}><span>Total amount requested</span><strong>{money(total)}</strong></div>

        <section className={styles.reviewSection}>
          <div className={styles.reviewInlineHeading}>
            <h2>Requester declaration</h2>
            <p>Your saved signature will be attached to this submission.</p>
          </div>
          {signature ? <div className={styles.savedSignature}><div><span>Active signature</span><strong>{signature.fileName}</strong></div><img alt={`${requesterName} signature`} src={signature.imageUrl} /></div> : <div className={styles.error}>No active signature found. <a href="/beta/settings/signature">Upload your signature in Settings</a>.</div>}
          <label className={styles.declaration}><input checked={confirmed} onChange={(event) => onConfirmedChange(event.target.checked)} type="checkbox" /><span>I confirm this request is for approved work-related expenses and all information is accurate.</span></label>
          <div className={styles.footerActions}><button className={styles.secondary} onClick={onBack} type="button">← Back to edit</button><button className={styles.primary} disabled={saving || !signature || !confirmed} onClick={onSubmit} type="button">{saving ? 'Submitting…' : amendment ? 'Sign and resubmit' : 'Sign and submit to Director →'}</button></div>
        </section>
      </div>
    </div>
  );
}

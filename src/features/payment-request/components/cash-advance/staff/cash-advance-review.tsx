import type { CashAdvanceRequestLine } from '@/domain/payment-requests/cash-advance/types';
import type { UserSignatureRecord } from '@/domain/signatures/types';
import styles from '../cash-advance.module.css';

const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);

export function CashAdvanceReview({
  staffName, requestDate, projectName, purpose, managerName, directorName, lines, total,
  accountHolderName, bankName, bankAccountNumber,
  signature, confirmed, saving, error, amendment, onConfirmedChange, onBack, onSubmit,
}: {
  staffName: string; requestDate: string; projectName: string; purpose: string; managerName: string; directorName: string;
  accountHolderName: string; bankName: string; bankAccountNumber: string;
  lines: CashAdvanceRequestLine[]; total: number; signature: UserSignatureRecord | null; confirmed: boolean;
  saving: boolean; error: string; amendment: boolean; onConfirmedChange: (value: boolean) => void; onBack: () => void; onSubmit: () => void;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.formHero}><div className={styles.formHeroTop}><div><span className={styles.eyebrow}>Cash Advance · Review</span><h1>Review and sign your request</h1><p>Confirm the entries before forwarding the request to the Manager.</p></div><div className={styles.heroAmount}><span>Amount requested</span><strong>{money(total)}</strong></div></div></header>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.formReceipt}>
      <section className={styles.receiptSection}><div className={styles.sectionHeading}><div><div><h2>Request overview</h2><p>Staff and approval assignment</p></div></div></div><div className={styles.summaryGrid}><p><span>Staff</span><strong>{staffName}</strong></p><p><span>Request date</span><strong>{requestDate}</strong></p><p><span>Project</span><strong>{projectName}</strong></p><p><span>Manager</span><strong>{managerName}</strong></p><p><span>Director</span><strong>{directorName}</strong></p><p><span>Purpose</span><strong>{purpose}</strong></p></div></section>
      <section className={styles.receiptSection}><div className={styles.sectionHeading}><div><div><h2>Payment account</h2><p>Staff bank account receiving the Cash Advance</p></div></div></div><dl className={styles.detailGrid}><div><dt>Account holder</dt><dd>{accountHolderName}</dd></div><div><dt>Bank</dt><dd>{bankName}</dd></div><div><dt>Account number</dt><dd>{bankAccountNumber}</dd></div></dl></section>
      <section className={styles.receiptSection}><div className={styles.sectionHeading}><div><div><h2>Expense entries</h2><p>{lines.length} {lines.length === 1 ? 'entry' : 'entries'}</p></div></div></div><div className={styles.tableShell}><table className={styles.lineTable}><thead><tr><th>#</th><th>Description</th><th>Purpose</th><th>Amount</th></tr></thead><tbody>{lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.description}</td><td>{line.purpose}</td><td className={styles.amount}>{money(line.amount)}</td></tr>)}</tbody></table></div><div className={styles.total}><span>Total amount requested</span><span>{money(total)}</span></div></section>
      <section className={styles.receiptSection}><div className={styles.sectionHeading}><div><div><h2>Staff declaration</h2><p>Your saved signature will be attached to this submission.</p></div></div></div>{signature ? <div className={styles.savedSignature}><div><span>Active signature</span><strong>{signature.fileName}</strong></div><img alt={`${staffName} signature`} src={signature.imageUrl} /></div> : <div className={styles.error}>No active signature found. <a href="/beta/settings/signature">Upload your signature in Settings</a>.</div>}<label className={styles.declaration}><input checked={confirmed} onChange={(event) => onConfirmedChange(event.target.checked)} type="checkbox" /><span>I confirm this request is for approved work-related expenses and all information is accurate.</span></label><div className={styles.footerActions}><button className={styles.secondary} onClick={onBack} type="button">← Back to edit</button><button className={styles.primary} disabled={saving || !signature || !confirmed} onClick={onSubmit} type="button">{saving ? 'Submitting…' : amendment ? 'Sign and resubmit' : 'Sign and submit to Manager →'}</button></div></section>
      </div>
    </div>
  );
}

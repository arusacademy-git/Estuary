import type { CashAdvanceDocument, CashAdvanceExpense } from '@/domain/payment-requests/cash-advance/types';
import styles from '../../cash-advance.module.css';

type ReconciliationReviewProps = {
  requestNumber: string;
  advance: number;
  expenses: CashAdvanceExpense[];
  totalSpent: number;
  balance: number;
  outcome: 'EXACT' | 'UNDERSPEND' | 'OVERSPEND';
  includesParticipants: boolean;
  participantProof?: CashAdvanceDocument;
  participantProofLink?: string;
  balanceReturnDate?: string;
  balanceReturnReference?: string;
  balanceReturnProof?: CashAdvanceDocument;
  remarks: string;
  saving: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

export function ReconciliationReview(props: ReconciliationReviewProps) {
  return <div className={styles.formReceipt}>
    <section className={styles.receiptSection}>
      <div className={styles.sectionHeading}><div><span>✓</span><div><h2>Review reconciliation</h2><p>Confirm all values and evidence before sending them to Finance.</p></div></div></div>
      <dl className={styles.detailGrid}><div><dt>Cash Advance</dt><dd>{props.requestNumber}</dd></div><div><dt>Advance received</dt><dd>RM {props.advance.toFixed(2)}</dd></div><div><dt>Total spent</dt><dd>RM {props.totalSpent.toFixed(2)}</dd></div><div><dt>Outcome</dt><dd>{props.outcome === 'EXACT' ? 'Fully spent' : props.outcome === 'UNDERSPEND' ? 'Balance returned' : 'Overspent'}</dd></div><div><dt>{props.outcome === 'OVERSPEND' ? 'Excess' : 'Balance'}</dt><dd>RM {Math.abs(props.balance).toFixed(2)}</dd></div><div><dt>Expense entries</dt><dd>{props.expenses.length}</dd></div></dl>
    </section>
    <section className={styles.receiptSection}>
      <div className={styles.receiptSectionTitle}><h2>Cash Spent Summary</h2><span>{props.expenses.length} entries</span></div>
      <div className={styles.tableShell}><table className={`${styles.lineTable} ${styles.reconciliationTable}`}><thead><tr><th>Date</th><th>Supplier</th><th>Description</th><th>Type of account</th><th>Division</th><th>Receipt link</th><th>Amount</th></tr></thead><tbody>{props.expenses.map((expense) => <tr key={expense.id}><td>{expense.expenseDate}</td><td>{expense.supplier}</td><td>{expense.description}</td><td>{expense.accountType}</td><td>{expense.division || '—'}</td><td>{expense.receiptLink || '—'}</td><td className={styles.amount}>RM {expense.amount.toFixed(2)}</td></tr>)}</tbody></table></div>
    </section>
    {props.includesParticipants && <section className={styles.receiptSection}><div className={styles.receiptSectionTitle}><h2>Participant Allowance</h2><span>Evidence attached</span></div>{props.participantProofLink ? <a className={styles.secondary} href={props.participantProofLink} rel="noreferrer" target="_blank">Open Participant Allowance Google Sheet ↗</a> : <div className={styles.documentRow}><span className={styles.documentIcon}>↥</span><div className={styles.documentCopy}><strong>{props.participantProof?.fileName}</strong><small>Participant-signed form for Finance review</small></div></div>}</section>}
    {props.outcome === 'UNDERSPEND' && <section className={styles.receiptSection}><div className={styles.receiptSectionTitle}><h2>Balance Return</h2></div><dl className={styles.detailGrid}><div><dt>Return date</dt><dd>{props.balanceReturnDate}</dd></div><div><dt>Bank reference</dt><dd>{props.balanceReturnReference}</dd></div><div><dt>Proof</dt><dd>{props.balanceReturnProof?.fileName}</dd></div></dl></section>}
    <section className={styles.receiptSection}><div className={styles.field}><label>Reconciliation remarks</label><p>{props.remarks || 'No additional remarks.'}</p></div><div className={styles.footerActions}><button className={styles.secondary} disabled={props.saving} onClick={props.onBack} type="button">Back to edit</button><button className={styles.primary} disabled={props.saving} onClick={props.onSubmit} type="button">{props.saving ? 'Submitting…' : 'Submit reconciliation to Finance →'}</button></div></section>
  </div>;
}
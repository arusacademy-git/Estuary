import type { CashAdvanceExpense } from '@/domain/payment-requests/cash-advance/types';
import { PAYMENT_VOUCHER_ACCOUNT_OPTIONS } from '@/shared/constants/payment-options';
import { parsePaymentAmountInput } from '@/shared/utils/payment-amount';
import styles from '../../cash-advance.module.css';

const newExpense = (): CashAdvanceExpense => ({
  id: crypto.randomUUID(),
  expenseDate: '',
  supplier: '',
  description: '',
  accountType: '',
  amount: 0,
});

type CashSpentSummaryProps = {
  expenses: CashAdvanceExpense[];
  onChange: (expenses: CashAdvanceExpense[]) => void;
  totalSpent: number;
};

export function CashSpentSummary({ expenses, onChange, totalSpent }: CashSpentSummaryProps) {
  const update = (id: string, patch: Partial<CashAdvanceExpense>) =>
    onChange(expenses.map((expense) => expense.id === id ? { ...expense, ...patch } : expense));

  return <section className={styles.receiptSection}>
    <div className={styles.sectionHeading}><div><span>1</span><div><h2>Summary of Cash Spent &amp; Receipts</h2><p>Record every actual expense and paste a shareable Google Drive link for its receipt or proof.</p></div></div><button className={styles.secondary} onClick={() => onChange([...expenses, newExpense()])} type="button">+ Add expense</button></div>
    <div className={`${styles.tableShell} ${styles.cashSpentTableWrap}`}><table className={`${styles.lineTable} ${styles.reconciliationTable} ${styles.cashSpentTable}`}><thead><tr><th>Date</th><th>Supplier</th><th>Description</th><th>Type of account</th><th>Division</th><th>Amount (RM)</th><th>Receipt / proof Google Drive link</th><th /></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td><input aria-label="Expense date" onChange={(event) => update(expense.id, { expenseDate: event.target.value })} type="date" value={expense.expenseDate} /></td><td><input aria-label="Supplier" onChange={(event) => update(expense.id, { supplier: event.target.value })} placeholder="Supplier name" value={expense.supplier ?? ''} /></td><td><input aria-label="Expense description" onChange={(event) => update(expense.id, { description: event.target.value })} placeholder="What was purchased" value={expense.description} /></td><td><select aria-label="Type of account" onChange={(event) => update(expense.id, { accountType: event.target.value })} value={expense.accountType ?? ''}><option value="">Choose account</option>{PAYMENT_VOUCHER_ACCOUNT_OPTIONS.map((accountType) => <option key={accountType.value} value={accountType.value}>{accountType.label}</option>)}</select></td><td><input aria-label="Division" onChange={(event) => update(expense.id, { division: event.target.value })} placeholder="Division" value={expense.division ?? ''} /></td><td><input aria-label="Expense amount" inputMode="decimal" onChange={(event) => update(expense.id, { amount: parsePaymentAmountInput(event.target.value) })} placeholder="0.00" type="text" value={expense.amount || ''} /></td><td><input aria-label="Google Drive receipt or proof link" onChange={(event) => update(expense.id, { receiptLink: event.target.value })} placeholder="Paste shareable Google Drive link" type="url" value={expense.receiptLink ?? ''} /></td><td><button aria-label="Remove expense" className={styles.iconButton} disabled={expenses.length === 1} onClick={() => onChange(expenses.filter((row) => row.id !== expense.id))} type="button">×</button></td></tr>)}</tbody></table></div>
    <p className={styles.tableScrollHint}>Scroll horizontally to complete every column, including the Google Drive receipt link.</p>
    <div className={styles.total}><span>Total spent</span><span>RM {totalSpent.toFixed(2)}</span></div>
  </section>;
}

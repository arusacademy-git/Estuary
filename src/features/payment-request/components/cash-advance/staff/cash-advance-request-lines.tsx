import type { CashAdvanceRequestLine } from '@/domain/payment-requests/cash-advance/types';
import { PAYMENT_VOUCHER_ACCOUNT_OPTIONS } from '@/shared/constants/payment-options';
import { PaymentAmountInput } from '@/shared/payment-amount-input';
import styles from '../cash-advance.module.css';

const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);

export function CashAdvanceRequestLines({
  lines,
  total,
  onAdd,
  onChange,
  onRemove,
}: {
  lines: CashAdvanceRequestLine[];
  total: number;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<CashAdvanceRequestLine>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className={styles.receiptSection}>
      <div className={styles.sectionHeading}>
        <div><div><h2>Breakdown of request</h2><p>Add each expected expense as a separate entry.</p></div></div>
        <button className={styles.secondary} onClick={onAdd} type="button">+ Add expense</button>
      </div>
      <div className={styles.tableShell}>
        <table className={styles.lineTable}>
          <thead><tr><th>#</th><th>Account</th><th>Description</th><th>Purpose</th><th>Amount (RM)</th><th /></tr></thead>
          <tbody>{lines.map((line, index) => (
            <tr key={line.id}>
              <td>{index + 1}</td>
              <td>
                <select aria-label={`Expense ${index + 1} account`} required value={line.accountType ?? ''} onChange={(event) => onChange(line.id, { accountType: event.target.value })}>
                  <option value="">Choose account</option>
                  {line.accountType && !PAYMENT_VOUCHER_ACCOUNT_OPTIONS.some((option) => option.value === line.accountType) && <option value={line.accountType}>{line.accountType} (saved value)</option>}
                  {PAYMENT_VOUCHER_ACCOUNT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </td>
              <td><input aria-label={`Expense ${index + 1} description`} placeholder="e.g. Workshop materials" value={line.description} onChange={(event) => onChange(line.id, { description: event.target.value })} /></td>
              <td><input aria-label={`Expense ${index + 1} purpose`} placeholder="Why this expense is needed" value={line.purpose} onChange={(event) => onChange(line.id, { purpose: event.target.value })} /></td>
              <td><PaymentAmountInput aria-label={`Expense ${index + 1} amount`} value={line.amount} onValueChange={(amount) => onChange(line.id, { amount })} /></td>
              <td><button aria-label={`Remove expense ${index + 1}`} className={styles.iconButton} disabled={lines.length === 1} onClick={() => onRemove(line.id)} type="button">×</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className={styles.total}><span>Total amount requested</span><span>{money(total)}</span></div>
    </section>
  );
}

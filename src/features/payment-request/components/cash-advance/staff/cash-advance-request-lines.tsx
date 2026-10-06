import type { CashAdvanceRequestLine } from '@/domain/payment-requests/cash-advance/types';
import { parsePaymentAmountInput } from '@/shared/utils/payment-amount';
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
          <thead><tr><th>#</th><th>Description</th><th>Purpose</th><th>Amount (RM)</th><th /></tr></thead>
          <tbody>{lines.map((line, index) => (
            <tr key={line.id}>
              <td>{index + 1}</td>
              <td><input aria-label={`Expense ${index + 1} description`} placeholder="e.g. Workshop materials" value={line.description} onChange={(event) => onChange(line.id, { description: event.target.value })} /></td>
              <td><input aria-label={`Expense ${index + 1} purpose`} placeholder="Why this expense is needed" value={line.purpose} onChange={(event) => onChange(line.id, { purpose: event.target.value })} /></td>
              <td><input aria-label={`Expense ${index + 1} amount`} inputMode="decimal" placeholder="0.00" type="text" value={line.amount || ''} onChange={(event) => onChange(line.id, { amount: parsePaymentAmountInput(event.target.value) })} /></td>
              <td><button aria-label={`Remove expense ${index + 1}`} className={styles.iconButton} disabled={lines.length === 1} onClick={() => onRemove(line.id)} type="button">×</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className={styles.minimumNote}><span>Minimum request</span><strong>RM 300.00</strong></div>
      <div className={styles.total}><span>Total amount requested</span><span>{money(total)}</span></div>
    </section>
  );
}

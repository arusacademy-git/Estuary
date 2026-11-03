import { useState } from 'react';
import type { CashAdvanceRequestLine } from '@/domain/payment-requests/cash-advance/types';
import styles from '../cash-advance.module.css';

const money = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);

function AmountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (amount: number) => void;
}) {
  const [text, setText] = useState(value ? value.toFixed(2) : '');

  return (
    <input
      aria-label={label}
      inputMode="decimal"
      placeholder="0.00"
      type="text"
      value={text}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d.]/g, '');
        // only digits, one dot, max 2 decimals
        if (!/^\d*\.?\d{0,2}$/.test(next)) return;
        setText(next);
        onChange(next === '' || next === '.' ? 0 : Number(next));
      }}
      onBlur={() => setText(value ? value.toFixed(2) : '')}
    />
  );
}

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
              <td>
                <AmountInput
                  label={`Expense ${index + 1} amount`}
                  value={line.amount}
                  onChange={(amount) => onChange(line.id, { amount })}
                />
              </td>
              <td><button aria-label={`Remove expense ${index + 1}`} className={styles.iconButton} disabled={lines.length === 1} onClick={() => onRemove(line.id)} type="button">×</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
           <div
        className={`${styles.total} ${total < 300 ? styles.totalBelowMinimum : ''}`}
      >
        <div className={styles.totalLabel}>
          <span>Total amount requested</span>
          <small className={styles.minimumNote}>Minimum request: RM 300.00</small>
        </div>
        <span>{money(total)}</span>
      </div>
    </section>
  );
}
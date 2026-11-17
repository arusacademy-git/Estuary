import type { CashAdvanceRequestLine } from "@/domain/payment-requests/cash-advance/types";
import styles from "../cash-advance.module.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);

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
        <span className={styles.sectionNumber}>3</span>
        <div>
          <div>
            <h2>Breakdown of request</h2>
            <p>Add each expected expense as a separate entry.</p>
          </div>
        </div>
        <button className={styles.secondary} onClick={onAdd} type="button">
          + Add expense
        </button>
      </div>
      <div className={styles.cashEntryList}>
        {lines.map((line, index) => (
          <article className={styles.cashEntryCard} key={line.id}>
            <header>
              <strong>Expense {index + 1}</strong>
              <button
                aria-label={`Remove expense ${index + 1}`}
                className={styles.iconButton}
                disabled={lines.length === 1}
                onClick={() => onRemove(line.id)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className={styles.cashEntryGrid}>
              <label>
                <span>
                  Description <em className={styles.requiredMark}>*</em>
                </span>
                <input
                  aria-label={`Expense ${index + 1} description`}
                  placeholder="e.g. Workshop materials"
                  required
                  value={line.description}
                  onChange={(event) =>
                    onChange(line.id, { description: event.target.value })
                  }
                />
              </label>
              <label>
                <span>
                  Purpose <em className={styles.requiredMark}>*</em>
                </span>
                <input
                  aria-label={`Expense ${index + 1} purpose`}
                  placeholder="Why this expense is needed"
                  required
                  value={line.purpose}
                  onChange={(event) =>
                    onChange(line.id, { purpose: event.target.value })
                  }
                />
              </label>
              <label>
                <span>
                  Amount (RM) <em className={styles.requiredMark}>*</em>
                </span>
                <input
                  aria-label={`Expense ${index + 1} amount`}
                  min="0.01"
                  placeholder="0.00"
                  required
                  step="0.01"
                  type="number"
                  value={line.amount || ""}
                  onChange={(event) =>
                    onChange(line.id, { amount: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </article>
        ))}
      </div>
      <div
        className={`${styles.total} ${total < 300 ? styles.totalBelowMinimum : ""}`}
      >
        <span>
          Total amount requested
          <small>Minimum request: RM 300.00</small>
        </span>
        <strong>{money(total)}</strong>
      </div>
    </section>
  );
}

import type { CashAdvanceRequestLine } from "@/domain/payment-requests/cash-advance/types";
import type { CashAdvanceLineValidationErrors } from "@/domain/payment-requests/cash-advance/validation";
import {
  FieldError,
  invalidFieldProps,
} from "@/features/validation/field-error";
import { PaymentAmountInput } from "@/shared/payment-amount-input";
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
  fieldErrors = {},
  totalError,
}: {
  lines: CashAdvanceRequestLine[];
  total: number;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<CashAdvanceRequestLine>) => void;
  onRemove: (id: string) => void;
  fieldErrors?: Record<string, CashAdvanceLineValidationErrors>;
  totalError?: string;
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
                  {...invalidFieldProps(
                    `${line.id}-cash-description-error`,
                    fieldErrors[line.id]?.description,
                  )}
                  placeholder="e.g. Workshop materials"
                  required
                  value={line.description}
                  onChange={(event) =>
                    onChange(line.id, { description: event.target.value })
                  }
                />
                <FieldError id={`${line.id}-cash-description-error`}>
                  {fieldErrors[line.id]?.description}
                </FieldError>
              </label>
              <label>
                <span>
                  Purpose <em className={styles.requiredMark}>*</em>
                </span>
                <input
                  aria-label={`Expense ${index + 1} purpose`}
                  {...invalidFieldProps(
                    `${line.id}-cash-purpose-error`,
                    fieldErrors[line.id]?.purpose,
                  )}
                  placeholder="Why this expense is needed"
                  required
                  value={line.purpose}
                  onChange={(event) =>
                    onChange(line.id, { purpose: event.target.value })
                  }
                />
                <FieldError id={`${line.id}-cash-purpose-error`}>
                  {fieldErrors[line.id]?.purpose}
                </FieldError>
              </label>
              <label>
                <span>
                  Amount (RM) <em className={styles.requiredMark}>*</em>
                </span>
                <PaymentAmountInput
                  aria-label={`Expense ${index + 1} amount`}
                  {...invalidFieldProps(
                    `${line.id}-cash-amount-error`,
                    fieldErrors[line.id]?.amount,
                  )}
                  placeholder="0.00"
                  required
                  value={line.amount}
                  onValueChange={(amount) => onChange(line.id, { amount })}
                />
                <FieldError id={`${line.id}-cash-amount-error`}>
                  {fieldErrors[line.id]?.amount}
                </FieldError>
              </label>
            </div>
          </article>
        ))}
      </div>
      <div
        {...invalidFieldProps("cash-advance-total-error", totalError)}
        className={`${styles.total} ${total < 300 ? styles.totalBelowMinimum : ""}`}
        tabIndex={totalError ? -1 : undefined}
      >
        <span>
          Total amount requested
          <small>Minimum request: RM 300.00</small>
        </span>
        <strong>{money(total)}</strong>
      </div>
      <FieldError id="cash-advance-total-error">{totalError}</FieldError>
    </section>
  );
}

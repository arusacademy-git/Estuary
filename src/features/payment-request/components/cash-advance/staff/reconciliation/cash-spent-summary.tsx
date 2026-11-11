import { createRuntimeId } from '@/lib/ids/runtime-id';
import { useState } from 'react';
import { CASH_ADVANCE_ACCOUNT_TYPES, type CashAdvanceDocument, type CashAdvanceExpense } from '@/domain/payment-requests/cash-advance/types';
import { DIVISION_SELECT_OPTIONS } from '@/shared/constants/payment-options';
import styles from '../../cash-advance.module.css';

const MAX_RECEIPT_SIZE = 2.5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

function readReceipt(file: File): Promise<CashAdvanceDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve({
          id: createRuntimeId(),
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl: reader.result,
        });
      } else {
        reject(new Error('The receipt could not be read.'));
      }
    };

    reader.onerror = () => reject(new Error('The receipt could not be read.'));
    reader.readAsDataURL(file);
  });
}

const createNewExpense = (): CashAdvanceExpense => ({
  id: createRuntimeId(),
  expenseDate: '',
  supplier: '',
  description: '',
  accountType: '',
  amount: 0,
});

interface ExpenseAmountInputProps {
  value: number;
  onChange: (value: number) => void;
}

function ExpenseAmountInput({ value, onChange }: ExpenseAmountInputProps) {
  const [text, setText] = useState(value ? String(value) : '');

  const handleBlur = () => {
    if (!text.trim()) return;
    const amount = Number(text);
    if (Number.isFinite(amount)) {
      setText(amount.toFixed(2));
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
    
    setText(next);
    const amount = Number(next);
    onChange(Number.isFinite(amount) ? amount : 0);
  };

  return (
    <input
      aria-label="Expense amount"
      inputMode="decimal"
      onBlur={handleBlur}
      onChange={handleChange}
      placeholder="0.00"
      type="text"
      value={text}
    />
  );
}

interface CashSpentSummaryProps {
  expenses: CashAdvanceExpense[];
  onChange: (expenses: CashAdvanceExpense[]) => void;
  onError: (message: string) => void;
  totalSpent: number;
}

export function CashSpentSummary({
  expenses,
  onChange,
  onError,
  totalSpent,
}: CashSpentSummaryProps) {
  const updateExpense = (id: string, patch: Partial<CashAdvanceExpense>) => {
    onChange(
      expenses.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense))
    );
  };

  const handleRemoveExpense = (id: string) => {
    onChange(expenses.filter((row) => row.id !== id));
  };

  const handleAddExpense = () => {
    onChange([...expenses, createNewExpense()]);
  };

  async function handleSelectReceipt(id: string, file?: File) {
    if (!file) return;

    if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
      onError('Upload the receipt as a PDF, JPG or PNG file.');
      return;
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      onError('Each receipt must not exceed 2.5 MB.');
      return;
    }

    try {
      const receipt = await readReceipt(file);
      updateExpense(id, { receipt, receiptLink: undefined, receiptLabel: undefined });
      onError('');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'The receipt could not be read.');
    }
  }

  return (
    <section className={styles.receiptSection}>
      <div className={styles.sectionHeading}>
        <div>
          <span>1</span>
          <div>
            <h2>Summary of Cash Spent &amp; Receipts</h2>
            <p>Record every actual expense and upload its receipt or proof.</p>
          </div>
        </div>
        <button
          className={styles.secondary}
          onClick={handleAddExpense}
          type="button"
        >
          + Add expense
        </button>
      </div>

      <div className={styles.reconciliationExpenseList}>
        {expenses.map((expense, index) => (
          <article className={styles.reconciliationExpenseCard} key={expense.id}>
            <div className={styles.reconciliationExpenseHeader}>
              <strong>Expense {index + 1}</strong>
              <button
                aria-label={`Remove expense ${index + 1}`}
                className={styles.iconButton}
                disabled={expenses.length === 1}
                onClick={() => handleRemoveExpense(expense.id)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className={styles.reconciliationExpenseGrid}>
              <label>
                <span>Date</span>
                <input
                  aria-label="Expense date"
                  onChange={(event) => updateExpense(expense.id, { expenseDate: event.target.value })}
                  type="date"
                  value={expense.expenseDate}
                />
              </label>

              <label>
                <span>Supplier</span>
                <input
                  aria-label="Supplier"
                  onChange={(event) => updateExpense(expense.id, { supplier: event.target.value })}
                  placeholder="Supplier name"
                  value={expense.supplier ?? ''}
                />
              </label>

              <label>
                <span>Description</span>
                <input
                  aria-label="Expense description"
                  onChange={(event) => updateExpense(expense.id, { description: event.target.value })}
                  placeholder="What was purchased"
                  value={expense.description}
                />
              </label>

              <label>
                <span>Type of account</span>
                <select
                  aria-label="Type of account"
                  onChange={(event) => updateExpense(expense.id, { accountType: event.target.value })}
                  value={expense.accountType ?? ''}
                >
                  <option value="">Choose account</option>
                  {CASH_ADVANCE_ACCOUNT_TYPES.map((accountType) => (
                    <option key={accountType} value={accountType}>
                      {accountType}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Division</span>
                <select
                  aria-label="Division"
                  onChange={(event) => updateExpense(expense.id, { division: event.target.value })}
                  value={expense.division ?? ''}
                >
                  <option value="">Choose division</option>
                  {DIVISION_SELECT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Amount (RM)</span>
                <ExpenseAmountInput
                  onChange={(amount) => updateExpense(expense.id, { amount })}
                  value={expense.amount}
                />
              </label>

              <label className={styles.reconciliationReceiptUpload}>
                <span>Receipt / proof <b>*</b></span>
                <span className={styles.reconciliationFileControl}>
                  <strong>Choose file</strong>
                  <small>{expense.receipt?.fileName ?? 'No file chosen'}</small>
                </span>
                <input
                  accept="application/pdf,image/jpeg,image/png"
                  aria-label={`Upload receipt for expense ${index + 1}`}
                  onChange={(event) => void handleSelectReceipt(expense.id, event.target.files?.[0])}
                  type="file"
                />
                <em>PDF, JPG or PNG · maximum 2.5 MB</em>
              </label>
            </div>
          </article>
        ))}
      </div>

      <p className={styles.appendixAHint}>
        Have Appendix A in Google Sheets? Switch to “Retrieve from Appendix A” to import the summary instead.
      </p>

      <div className={styles.total}>
        <span>Total spent</span>
        <span>RM {totalSpent.toFixed(2)}</span>
      </div>
    </section>
  );
}
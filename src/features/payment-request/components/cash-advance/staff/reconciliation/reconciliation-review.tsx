import type { CashAdvanceDocument, CashAdvanceExpense } from '@/domain/payment-requests/cash-advance/types';
import { DocumentReferenceChip } from '@/shared/document-reference-chip';
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

export function ReconciliationReview({
  requestNumber,
  advance,
  expenses,
  totalSpent,
  balance,
  outcome,
  includesParticipants,
  participantProof,
  participantProofLink,
  balanceReturnDate,
  balanceReturnReference,
  balanceReturnProof,
  remarks,
  saving,
  onBack,
  onSubmit,
}: ReconciliationReviewProps) {
  const getOutcomeLabel = () => {
    switch (outcome) {
      case 'EXACT':
        return 'Fully spent';
      case 'UNDERSPEND':
        return 'Balance returned';
      case 'OVERSPEND':
        return 'Overspent';
    }
  };

  return (
    <div className={styles.formReceipt}>
      <section className={styles.receiptSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>✓</span>
            <div>
              <h2>Review reconciliation</h2>
              <p>Confirm all values and evidence before sending them to Finance.</p>
            </div>
          </div>
        </div>

        <dl className={styles.detailGrid}>
          <div>
            <dt>Cash Advance</dt>
            <dd>{requestNumber}</dd>
          </div>
          <div>
            <dt>Advance received</dt>
            <dd>RM {advance.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Total spent</dt>
            <dd>RM {totalSpent.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>{getOutcomeLabel()}</dd>
          </div>
          <div>
            <dt>{outcome === 'OVERSPEND' ? 'Excess' : 'Balance'}</dt>
            <dd>RM {Math.abs(balance).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Expense entries</dt>
            <dd>{expenses.length}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.receiptSection}>
        <div className={styles.receiptSectionTitle}>
          <h2>Cash Spent Summary</h2>
          <span>{expenses.length} entries</span>
        </div>

        <div className={styles.tableShell}>
          <table className={`${styles.lineTable} ${styles.reconciliationTable}`}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Description</th>
                <th>Type of account</th>
                <th>Division</th>
                <th>Receipt</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{expense.expenseDate}</td>
                  <td>{expense.supplier}</td>
                  <td>{expense.description}</td>
                  <td>{expense.accountType}</td>
                  <td>{expense.division || '—'}</td>
                  <td>
                    {expense.receipt ? (
                      expense.receipt.fileName
                    ) : expense.receiptLink ? (
                      <DocumentReferenceChip
                        href={expense.receiptLink}
                        value={expense.receiptLabel || expense.receiptLink}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={styles.amount}>RM {expense.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {includesParticipants && (
        <section className={styles.receiptSection}>
          <div className={styles.receiptSectionTitle}>
            <h2>Participant Allowance</h2>
            <span>Evidence attached</span>
          </div>
          {participantProofLink ? (
            <a
              className={styles.secondary}
              href={participantProofLink}
              rel="noreferrer"
              target="_blank"
            >
              Open Participant Allowance Google Sheet ↗
            </a>
          ) : (
            <div className={styles.documentRow}>
              <span className={styles.documentIcon}>↥</span>
              <div className={styles.documentCopy}>
                <strong>{participantProof?.fileName}</strong>
                <small>Participant-signed form for Finance review</small>
              </div>
            </div>
          )}
        </section>
      )}

      {outcome === 'UNDERSPEND' && (
        <section className={styles.receiptSection}>
          <div className={styles.receiptSectionTitle}>
            <h2>Balance Return</h2>
          </div>
          <dl className={styles.detailGrid}>
            <div>
              <dt>Return date</dt>
              <dd>{balanceReturnDate}</dd>
            </div>
            <div>
              <dt>Bank reference</dt>
              <dd>{balanceReturnReference}</dd>
            </div>
            <div>
              <dt>Proof</dt>
              <dd>{balanceReturnProof?.fileName}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className={styles.receiptSection}>
        <div className={styles.field}>
          <label>Reconciliation remarks</label>
          <p>{remarks || 'No additional remarks.'}</p>
        </div>

        <div className={styles.footerActions}>
          <button
            className={styles.secondary}
            disabled={saving}
            onClick={onBack}
            type="button"
          >
            Back to edit
          </button>
          <button
            className={styles.primary}
            disabled={saving}
            onClick={onSubmit}
            type="button"
          >
            {saving ? 'Submitting…' : 'Submit reconciliation to Finance →'}
          </button>
        </div>
      </section>
    </div>
  );
}
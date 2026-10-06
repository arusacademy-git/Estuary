import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import styles from '../cash-advance.module.css';

type CashAdvanceReconciliationReviewProps = {
    record: CashAdvanceRecord;
    error: string;
    reason: string;
    saving: boolean;
    onReasonChange: (value: string) => void;
    onComplete: () => void;
    onReturn: () => void;
};

export function CashAdvanceReconciliationReview({ record, error, reason, saving, onReasonChange, onComplete, onReturn }: CashAdvanceReconciliationReviewProps) {
    const reconciliation = record.reconciliation;
    if (!reconciliation) return <section className={styles.sideCard}><h3>Verify reconciliation</h3><div className={styles.error}>The reconciliation information is unavailable.</div></section>;

    return <section className={styles.sideCard}>
        <h3>Verify reconciliation</h3>
        {error && <div className={styles.error}>{error}</div>}
        <dl className={styles.detailGrid}><div><dt>Total spent</dt><dd>RM {reconciliation.totalSpent.toFixed(2)}</dd></div><div><dt>{reconciliation.outcome === 'OVERSPEND' ? 'Excess' : 'Balance'}</dt><dd>RM {Math.abs(reconciliation.balance).toFixed(2)}</dd></div><div><dt>Outcome</dt><dd>{reconciliation.outcome}</dd></div></dl>
        <button className={styles.primary} disabled={saving} onClick={onComplete} type="button">Verify and complete</button>
        <div className={styles.field}><label>Correction remarks</label><textarea onChange={(event) => onReasonChange(event.target.value)} placeholder="Explain what Staff must correct" value={reason} /></div>
        <button className={styles.danger} disabled={saving || reason.trim().length < 5} onClick={onReturn} type="button">Return reconciliation</button>
    </section>;
}
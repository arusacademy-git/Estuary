import type { ChangeEvent } from 'react';
import type { CashAdvanceDocument } from '@/domain/payment-requests/cash-advance/types';
import styles from '../../cash-advance.module.css';

function readFile(file: File): Promise<CashAdvanceDocument> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
            ? resolve({ id: `${file.name}-${file.size}-${file.lastModified}`, fileName: file.name, mimeType: file.type, size: file.size, dataUrl: reader.result })
            : reject(new Error('Balance-return proof could not be read.'));
        reader.onerror = () => reject(new Error('Balance-return proof could not be read.'));
        reader.readAsDataURL(file);
    });
}

type BalanceReturnProofProps = {
    advance: number;
    totalSpent: number;
    balance: number;
    outcome: 'EXACT' | 'UNDERSPEND' | 'OVERSPEND';
    returnDate: string;
    returnReference: string;
    proof?: CashAdvanceDocument;
    onReturnDateChange: (value: string) => void;
    onReturnReferenceChange: (value: string) => void;
    onProofChange: (proof?: CashAdvanceDocument) => void;
    onError: (message: string) => void;
};

export function BalanceReturnProof({ advance, totalSpent, balance, outcome, returnDate, returnReference, proof, onReturnDateChange, onReturnReferenceChange, onProofChange, onError }: BalanceReturnProofProps) {
    const hasRecordedSpending = totalSpent > 0;

    async function selectProof(event: ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        try { onProofChange(await readFile(file)); } catch (caught) { onError(caught instanceof Error ? caught.message : 'Balance-return proof could not be read.'); }
    }

    return <section className={styles.receiptSection}>
        <div className={styles.sectionHeading}><div><span>3</span><div><h2>Payment Proof of Balance</h2><p>Required only when part of the Cash Advance must be returned.</p></div></div></div>
        <div className={styles.grid3}><p><span className={styles.label}>Advance</span><br />RM {advance.toFixed(2)}</p><p><span className={styles.label}>Total spent</span><br />RM {totalSpent.toFixed(2)}</p><p><span className={styles.label}>{outcome === 'OVERSPEND' ? 'Overspent' : 'Balance'}</span><br />RM {Math.abs(balance).toFixed(2)}</p></div>
        {!hasRecordedSpending && <div className={styles.notice}>Complete the Cash Spent Summary first. Balance-return fields will appear only when there is money to return.</div>}
        {hasRecordedSpending && outcome === 'UNDERSPEND' && <div className={styles.grid}><div className={styles.field}><label>Balance return date</label><input onChange={(event) => onReturnDateChange(event.target.value)} type="date" value={returnDate} /></div><div className={styles.field}><label>Bank reference</label><input onChange={(event) => onReturnReferenceChange(event.target.value)} placeholder="Include the CA reference" value={returnReference} /></div><label className={`${styles.uploadWell} ${styles.full}`}><strong>{proof ? 'Replace balance-return proof' : 'Upload balance-return proof'}</strong><span>Bank transfer screenshot or PDF</span><input accept="application/pdf,image/*" onChange={selectProof} type="file" /><small>{proof?.fileName ?? 'No file selected'}</small></label></div>}
        {hasRecordedSpending && outcome === 'EXACT' && <div className={styles.notice}>The advance was fully spent. Payment proof of balance is not required.</div>}
        {hasRecordedSpending && outcome === 'OVERSPEND' && <div className={styles.notice}>No balance remains to return. The expenses exceed the advance by RM {Math.abs(balance).toFixed(2)} and Finance will review the excess separately.</div>}
    </section>;
}

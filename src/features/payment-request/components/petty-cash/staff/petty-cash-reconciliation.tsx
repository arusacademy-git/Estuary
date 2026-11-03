'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';

import { submitPettyCashReconciliation } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashReconciliationReceipt, PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { parsePaymentAmountInput } from '@/shared/utils/payment-amount';

import styles from '../petty-cash.module.css';

const MAX_FILE_SIZE = 2.5 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

function money(value: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}

function documentFromFile(file: File): Promise<PettyCashReconciliationReceipt> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve({
      id: crypto.randomUUID(),
      fileName: file.name,
      mimeType: file.type as PettyCashReconciliationReceipt['mimeType'],
      size: file.size,
      dataUrl: String(reader.result ?? ''),
    });
    reader.readAsDataURL(file);
  });
}

export function PettyCashReconciliationForm({ record, requesterId, onSubmitted }: {
  record: PettyCashRecord;
  requesterId: string;
  onSubmitted: (record: PettyCashRecord) => void;
}) {
  const [actualSpentInput, setActualSpentInput] = useState('');
  const [receipts, setReceipts] = useState<PettyCashReconciliationReceipt[]>([]);
  const [returnDate, setReturnDate] = useState('');
  const [returnReference, setReturnReference] = useState('');
  const [returnProof, setReturnProof] = useState<PettyCashReconciliationReceipt | null>(null);
  const [noBalanceRemark, setNoBalanceRemark] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const actualSpent = useMemo(
    () => parsePaymentAmountInput(actualSpentInput),
    [actualSpentInput],
  );
  const hasActualSpent = actualSpentInput.trim().length > 0;
  const balance = Math.max(0, record.totalAmount - actualSpent);

  async function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    setError('');
    if (receipts.length + files.length > 5) {
      setError('Upload a maximum of 5 purchase receipts.');
      return;
    }
    if (files.some((file) => !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE)) {
      setError('Each receipt must be a PDF, JPG or PNG file no larger than 2.5 MB.');
      return;
    }
    try {
      const uploadedReceipts = await Promise.all(files.map(documentFromFile));
      setReceipts((current) => [...current, ...uploadedReceipts]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The receipts could not be read.');
    }
    event.target.value = '';
  }

  async function selectReturnProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError('');
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) {
      setError('The return proof must be a PDF, JPG or PNG file no larger than 2.5 MB.');
      return;
    }
    try {
      setReturnProof(await documentFromFile(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The return proof could not be read.');
    }
  }

  async function submit() {
    if (!actualSpentInput.trim() || actualSpent < 0 || actualSpent > record.totalAmount) {
      setError('Actual spending must be between RM0.00 and the amount released.');
      return;
    }
    if (!receipts.length) {
      setError('Upload at least one purchase receipt.');
      return;
    }
    if (balance > 0 && (!returnDate || !returnReference.trim() || !returnProof)) {
      setError('Record the return date, reference and proof for the unused balance.');
      return;
    }
    if (balance === 0 && noBalanceRemark.trim().length < 3) {
      setError('Provide a short declaration confirming there is no balance remaining.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      onSubmitted(await submitPettyCashReconciliation(record.id, {
        requesterId,
        actualSpent,
        receipts,
        returnedBalance: balance,
        balanceReturnDate: balance > 0 ? returnDate : undefined,
        balanceReturnReference: balance > 0 ? returnReference.trim() : undefined,
        balanceReturnProof: balance > 0 ? returnProof ?? undefined : undefined,
        noBalanceRemark: balance === 0 ? noBalanceRemark.trim() : undefined,
        remarks: remarks.trim() || undefined,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The reconciliation could not be submitted.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.reconciliationFormCard}>
      <header className={styles.reconciliationFormHeader}>
        <p>Submit reconciliation</p>
        <h2>Reconcile this Petty Cash</h2>
        <span>Upload purchase receipts and account for the full amount released by Finance.</span>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.reconciliationEquation}>
        <label><span>Amount released</span><strong>{money(record.totalAmount)}</strong></label>
        <i>−</i>
        <label>
          <span>Actual amount spent *</span>
          <input inputMode="decimal" onChange={(event) => setActualSpentInput(event.target.value)} placeholder="0.00" type="text" value={actualSpentInput} />
        </label>
        <i>=</i>
        <label><span>Calculated balance</span><strong>{money(balance)}</strong></label>
      </div>

      <label className={styles.reconciliationField}>
        <span>Purchase receipts *</span>
        <span className={styles.reconciliationUpload}>
          <input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple onChange={selectFiles} type="file" />
        </span>
        <small>Upload 1–5 PDF, JPG or PNG files · maximum 2.5 MB each</small>
      </label>

      {receipts.length > 0 && (
        <ul className={styles.reconciliationFiles}>
          {receipts.map((item) => (
            <li key={item.id}>
              <span>{item.fileName}</span>
              <button onClick={() => setReceipts((current) => current.filter((value) => value.id !== item.id))} type="button">Remove</button>
            </li>
          ))}
        </ul>
      )}

      {hasActualSpent && balance > 0 ? (
        <div className={styles.balancePanel}>
          <div className={styles.balancePanelHeading}>
            <h3>Return unused balance</h3>
            <p>Return {money(balance)} to Finance and provide the transaction evidence.</p>
          </div>
          <label><span>Return date *</span><input onChange={(event) => setReturnDate(event.target.value)} type="date" value={returnDate} /></label>
          <label><span>Return reference *</span><input onChange={(event) => setReturnReference(event.target.value)} placeholder="Bank or cash return reference" value={returnReference} /></label>
          <label className={styles.balanceProofField}>
            <span>Return transaction proof *</span>
            <span className={styles.reconciliationUpload}>
              <input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={selectReturnProof} type="file" />
            </span>
            {returnProof && <small>{returnProof.fileName}</small>}
          </label>
        </div>
      ) : hasActualSpent ? (
        <label className={styles.reconciliationField}>
          <span>No balance declaration *</span>
          <textarea onChange={(event) => setNoBalanceRemark(event.target.value)} placeholder="Confirm that the full amount was spent and no balance remains" rows={3} value={noBalanceRemark} />
        </label>
      ) : null}

      <label className={styles.reconciliationField}>
        <span>Additional remarks <small>(optional)</small></span>
        <textarea onChange={(event) => setRemarks(event.target.value)} rows={3} value={remarks} />
      </label>

      <button className={`${styles.primaryButton} ${styles.reconciliationSubmit}`} disabled={saving} onClick={submit} type="button">
        {saving ? 'Submitting…' : 'Submit reconciliation to Finance'}
      </button>
    </section>
  );
}

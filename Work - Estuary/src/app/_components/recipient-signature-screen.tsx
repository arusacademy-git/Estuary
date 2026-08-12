'use client';

import { useState } from 'react';

import type { PrototypeVoucherRecord } from '@/domain/prototype/types';

import styles from './prototype-screens.module.css';

export function RecipientSignatureScreen({
  voucher,
}: {
  voucher: PrototypeVoucherRecord;
}): React.JSX.Element {
  const [recipientName, setRecipientName] = useState(
    voucher.recipientSignature.recipientName
  );
  const [signatureText, setSignatureText] = useState(
    voucher.recipientSignature.signatureText ?? voucher.recipientSignature.recipientName
  );
  const [note, setNote] = useState(voucher.recipientSignature.note ?? '');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signVoucher(): Promise<void> {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/v1/prototype/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'recipient_sign',
          token: voucher.recipientSignature.token,
          recipientName,
          signatureText,
          note,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Could not sign voucher.');
      }

      setStatusMessage('Signature recorded. Staff has been notified to verify the voucher.');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Could not sign voucher.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.recipientPage}>
      <section className={styles.recipientPanel}>
        <span className={styles.eyebrow}>Recipient signature</span>
        <h1 className={styles.sectionTitle}>{voucher.voucherNumber}</h1>
        <p className={styles.copy}>
          Review the payment-voucher summary, then confirm your signature so the
          staff submitter can verify the completed document.
        </p>

        <div className={styles.previewMeta}>
          <div>
            <span>Payee</span>
            <strong>{voucher.payeeName}</strong>
          </div>
          <div>
            <span>Amount</span>
            <strong>{voucher.amount}</strong>
          </div>
          <div>
            <span>Payment date</span>
            <strong>{voucher.financeProcessing?.paidAt ?? 'Pending'}</strong>
          </div>
          <div>
            <span>Receipt</span>
            <strong>{voucher.financeProcessing?.receiptLink ?? 'Not linked'}</strong>
          </div>
        </div>

        <div className={styles.sectionStack}>
          <label className={styles.fieldWide}>
            <span>Recipient name</span>
            <input
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Signature text</span>
            <input
              value={signatureText}
              onChange={(event) => setSignatureText(event.target.value)}
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Note</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        <div className={styles.previewActions}>
          <button
            className={styles.primaryAction}
            disabled={isSubmitting}
            type='button'
            onClick={() => {
              void signVoucher();
            }}
          >
            {isSubmitting ? 'Signing...' : 'Sign voucher'}
          </button>
          {statusMessage ? (
            <p className={styles.helperStatus}>{statusMessage}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

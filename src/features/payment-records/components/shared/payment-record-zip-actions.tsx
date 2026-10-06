'use client';

import { type ReactNode, useState } from 'react';
import { downloadPaymentRecordFormsZip, type PaymentRecordZipEntry } from './download-payment-record-forms-zip';
import styles from './payment-record-zip-actions.module.css';

type Props = {
  archiveName: string;
  children: ReactNode;
  entries: PaymentRecordZipEntry[];
  recordCount: number;
};

export function PaymentRecordZipActions({ archiveName, children, entries, recordCount }: Props) {
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function download() {
    setPreparing(true); setMessage(''); setError('');
    try {
      await downloadPaymentRecordFormsZip(entries, archiveName);
      setMessage(`${recordCount} completed ${recordCount === 1 ? 'record was' : 'records were'} added to the ZIP file.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The ZIP file could not be prepared.');
    } finally { setPreparing(false); }
  }

  return <div className={styles.resultActions}>
    <div className={styles.downloadGroup}>
      <button className={styles.bulkDownloadButton} disabled={!entries.length || preparing} onClick={download} type="button">
        {preparing ? 'Preparing ZIP…' : `↓ Download forms (${recordCount})`}
      </button>
      {message && <span className={styles.downloadSuccess} role="status">{message}</span>}
      {error && <span className={styles.downloadError} role="alert">{error}</span>}
    </div>
    {children}
  </div>;
}
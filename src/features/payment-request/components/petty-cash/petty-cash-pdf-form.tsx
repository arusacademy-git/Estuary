import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';

import styles from './petty-cash.module.css';

export function PettyCashPdfForm({
  record,
}: {
  record: PettyCashRecord;
}) {
  const formHref = `/api/v1/payment-requests/petty-cash/${encodeURIComponent(record.id)}/form`;

  return <div className={styles.pdfFormCard}>
    <span className={styles.pdfFormIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M14 2.75H6.75A1.75 1.75 0 0 0 5 4.5v15A1.75 1.75 0 0 0 6.75 21h10.5A1.75 1.75 0 0 0 19 19.5V7.75L14 2.75Z" />
        <path d="M14 2.75v5h5M8.5 13h7M8.5 16.5h7" />
      </svg>
    </span>
    <div className={styles.pdfFormCopy}>
      <strong>Petty Cash Form (PDF)</strong>
      <span>Generated automatically from the latest request details</span>
    </div>
    <div className={styles.pdfFormActions}>
      <a href={formHref} target="_blank" rel="noreferrer">Preview Petty Cash Form</a>
      <a href={`${formHref}?download=1`}>Download Petty Cash Form (PDF)</a>
    </div>
  </div>;
}

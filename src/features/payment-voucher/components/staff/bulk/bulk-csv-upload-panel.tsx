'use client';

import { useMemo, useState } from 'react';

import {
  normalizeBulkPaymentVoucherRow,
  validateBulkPaymentVoucherRows,
} from '@/domain/payment-vouchers/bulk-upload';
import type {
  BulkPaymentVoucherField,
  BulkPaymentVoucherRow,
} from '@/domain/payment-vouchers/bulk-upload';

import styles from './bulk-payment-voucher.module.css';

type Props = {
  onContinue: (rows: BulkPaymentVoucherRow[]) => void;
};

const requiredFields: BulkPaymentVoucherField[] = [
  'pvDate', 'division', 'directorEmail', 'recipientName',
  'recipientEmail', 'recipientIsMalaysian', 'paymentMethod',
  'purpose', 'accountCode', 'lineDescription', 'quantity', 'unitAmount',
];

const headerAliases: Record<string, BulkPaymentVoucherField> = {
  'pv date': 'pvDate', division: 'division',
  'director email': 'directorEmail', 'approve by': 'directorEmail',
  'approved by': 'directorEmail', 'project manager email': 'projectManagerEmail',
  'recipient name': 'recipientName', 'recipient email': 'recipientEmail',
  'recipient ic number': 'recipientIc', 'recipient ic': 'recipientIc',
  'ic number': 'recipientIc', 'recipient is malaysian': 'recipientIsMalaysian',
  'malaysia or not': 'recipientIsMalaysian', 'payment method': 'paymentMethod',
  'bank name': 'bankName', 'bank account number': 'bankAccountNumber',
  'purpose of payment': 'purpose', purpose: 'purpose',
  'account code': 'accountCode', 'line description': 'lineDescription',
  description: 'lineDescription', quantity: 'quantity',
  'unit amount': 'unitAmount', 'unit price': 'unitAmount',
  'tax amount': 'taxAmount', tax: 'taxAmount',
};

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseCsv(csvText: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const next = csvText[index + 1];
    if (character === '"') {
      if (quoted && next === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value); value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = []; value = '';
    } else value += character;
  }

  if (quoted) throw new Error('The Google Sheet contains an unclosed quoted value.');
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function createRowsFromCsv(csvText: string) {
  const parsed = parseCsv(csvText);
  if (parsed.length < 2) {
    throw new Error('The Google Sheet must contain a header row and at least one Payment Voucher row.');
  }

  const [headers, ...dataRows] = parsed;
  const indexes = new Map<BulkPaymentVoucherField, number>();
  headers.forEach((header, index) => {
    const field = headerAliases[normalizeHeader(header)];
    if (field) indexes.set(field, index);
  });
  const missing = requiredFields.filter((field) => !indexes.has(field));
  if (missing.length) {
    throw new Error(`The Google Sheet is missing required columns: ${missing.join(', ')}.`);
  }

  const importStatusIndex = headers.findIndex(
    (header) => normalizeHeader(header) === 'import status',
  );
  const rows = dataRows
    .filter((values) => {
      if (!values.some((cell) => cell.trim())) return false;
      return importStatusIndex < 0 ||
        String(values[importStatusIndex] ?? '').trim().toUpperCase() !== 'IMPORTED';
    })
    .map((values) => {
      const fields: Partial<Record<BulkPaymentVoucherField, unknown>> = {};
      indexes.forEach((column, field) => { fields[field] = values[column] ?? ''; });
      return normalizeBulkPaymentVoucherRow(fields);
    });

  if (!rows.length) {
    throw new Error('No unimported Payment Voucher rows were found in the Google Sheet.');
  }
  return rows;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency', currency: 'MYR',
  }).format(amount);
}

export function BulkCsvUploadPanel({ onContinue }: Props) {
  const [sheetUrl, setSheetUrl] = useState('');
  const [parsedRows, setParsedRows] = useState<BulkPaymentVoucherRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const validations = useMemo(
    () => validateBulkPaymentVoucherRows(parsedRows), [parsedRows],
  );
  const validationById = useMemo(
    () => new Map(validations.map((validation) => [validation.rowId, validation])),
    [validations],
  );
  const validCount = validations.filter((validation) => validation.isValid).length;
  const invalidCount = validations.length - validCount;

  async function loadSheet() {
    setErrorMessage(''); setParsedRows([]); setLoadedUrl('');
    if (!sheetUrl.trim()) { setErrorMessage('Paste a Google Sheets link first.'); return; }
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/payment-vouchers/bulk/google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl.trim() }),
      });
      const body = await response.json() as {
        data?: { csv: string; sourceUrl: string };
        error?: { message?: string };
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message ?? 'Unable to read the Google Sheet.');
      }
      setParsedRows(createRowsFromCsv(body.data.csv));
      setLoadedUrl(body.data.sourceUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to read the Google Sheet.');
    } finally { setIsLoading(false); }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.pageHeading}><div>
        <p className={styles.status}>Multiple Payment Vouchers</p>
        <h1>Import from Google Sheets</h1>
        <p className={styles.copy}>Paste a shared Google Sheets link. Estuary will read the rows and show them below before any draft Payment Vouchers are created.</p>
      </div></div>

      {errorMessage && <div className={styles.notice} role="alert">{errorMessage}</div>}

      <section className={styles.formSection}>
        <div className={styles.sectionHeading}>
          <p>Step 1</p><h2>Attach the Google Sheet link</h2>
          <span>The sheet must be shared as “Anyone with the link can view” and use the standard Estuary column headings.</span>
        </div>
        <div className={styles.googleSheetForm}>
          <label className={styles.googleSheetField}>
            <span>Google Sheets link</span>
            <input type="url" value={sheetUrl} disabled={isLoading}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=0"
              onChange={(event) => {
                setSheetUrl(event.target.value); setParsedRows([]);
                setLoadedUrl(''); setErrorMessage('');
              }} />
            <small>Paste the sharing link for the worksheet containing the Payment Voucher rows.</small>
          </label>
          <button className={styles.loadSheetButton} type="button"
            disabled={isLoading || !sheetUrl.trim()} onClick={loadSheet}>
            {isLoading ? 'Loading sheet…' : 'Load Google Sheet'}
          </button>
        </div>
      </section>

      {parsedRows.length > 0 && (
        <section className={styles.formSection}>
          <div className={styles.sectionHeading}>
            <p>Step 2</p>
            <h2>{parsedRows.length} {parsedRows.length === 1 ? 'row' : 'rows'} loaded</h2>
            <span>Review the linked rows before continuing to the complete bulk preview.</span>
          </div>
          <div className={styles.summaryStats}>
            <div className={styles.summaryStat}><span>Total rows</span><strong>{parsedRows.length}</strong></div>
            <div className={styles.summaryStat}><span>Valid</span><strong>{validCount}</strong></div>
            <div className={styles.summaryStat}><span>Need attention</span><strong>{invalidCount}</strong></div>
          </div>
          <div className={styles.sheetPreviewWrapper}>
            <table className={styles.sheetPreviewTable}>
              <thead><tr><th>#</th><th>PV date</th><th>Recipient</th><th>Director</th><th>Purpose</th><th>Amount</th><th>Validation</th></tr></thead>
              <tbody>{parsedRows.map((row, index) => {
                const validation = validationById.get(row.rowId);
                return <tr key={row.rowId}>
                  <td>{index + 1}</td><td>{row.pvDate || '—'}</td>
                  <td><strong>{row.recipientName || '—'}</strong><small>{row.recipientEmail}</small></td>
                  <td>{row.directorEmail || '—'}</td><td>{row.purpose || '—'}</td>
                  <td>{formatCurrency(validation?.amount ?? 0)}</td>
                  <td><span className={validation?.isValid ? styles.sheetValidBadge : styles.sheetInvalidBadge}>{validation?.isValid ? 'Valid' : `${validation?.errors.length ?? 0} issues`}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <p className={styles.sheetSource}>Source: <a href={loadedUrl} target="_blank" rel="noreferrer">Open linked Google Sheet ↗</a></p>
          <p className={styles.copy}>Rows needing attention remain visible but cannot be selected when creating drafts.</p>
        </section>
      )}

      <footer className={styles.formActions}>
        <button className={styles.primary} disabled={!parsedRows.length || isLoading}
          type="button" onClick={() => onContinue(parsedRows)}>Continue to preview</button>
      </footer>
    </section>
  );
}

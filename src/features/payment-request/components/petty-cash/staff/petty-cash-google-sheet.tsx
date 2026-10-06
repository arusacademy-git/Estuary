'use client';

import { type ReactNode, useState } from 'react';

import {
  DIVISION_TYPES,
  type PettyCashRequestLine,
} from '@/domain/payment-requests/petty-cash/types';
import { resolvePaymentVoucherAccountCode } from '@/shared/constants/payment-options';
import styles from '../petty-cash.module.css';

export type PettyCashSheetData = {
  requesterName: string;
  requesterPosition: string;
  requestDate: string;
  contact: string;
  lines: PettyCashRequestLine[];
};

type Props = {
  completionFields: ReactNode;
  disabled?: boolean;
  routingCopy?: string;
  submitLabel?: string;
  onCancel: () => void;
  onApply: (data: PettyCashSheetData) => void;
  onRetrieved?: (data: PettyCashSheetData) => void;
};

type SheetField =
  | 'rowNumber'
  | 'expenseDate'
  | 'supplier'
  | 'details'
  | 'proofLink'
  | 'accountType'
  | 'division'
  | 'amount';

function normalized(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\?\s*$/, '')
    .trim()
    .toLowerCase();
}

function headerField(value: string): SheetField | undefined {
  const heading = normalized(value);
  if (heading === '#' || heading === 'no' || heading === 'no.') return 'rowNumber';
  if (heading === 'date' || heading.startsWith('expense date')) return 'expenseDate';
  if (heading.startsWith('supplier')) return 'supplier';
  if (heading.startsWith('details') || heading.includes('expense & for what')) return 'details';
  if (heading.includes('link to e-invoice') || heading.includes('receipt link')) return 'proofLink';
  if (heading.startsWith('type of account') || heading === 'account type') return 'accountType';
  if (heading.startsWith('division')) return 'division';
  if (heading.startsWith('total') || heading.startsWith('amount')) return 'amount';
  return undefined;
}

const metadataLabels = {
  name: 'requesterName',
  position: 'requesterPosition',
  date: 'requestDate',
  contact: 'contact',
} as const;

function readMetadata(rows: string[][]) {
  const result = { requesterName: '', requesterPosition: '', requestDate: '', contact: '' };
  rows.forEach((row, rowIndex) => row.forEach((rawCell, columnIndex) => {
    const match = rawCell.trim().match(/^\s*(name|position|date|contact)\s*:\s*(.*)$/i);
    if (!match) return;
    const field = metadataLabels[match[1].toLowerCase() as keyof typeof metadataLabels];
    let value = match[2].trim();
    if (!value) {
      for (let next = columnIndex + 1; next < row.length; next += 1) {
        const candidate = String(row[next] ?? '').trim();
        if (/^(name|position|date|contact)\s*:/i.test(candidate)) break;
        if (candidate) { value = candidate; break; }
      }
    }
    if (!value) value = String(rows[rowIndex + 1]?.[columnIndex] ?? '').trim();
    if (value) result[field] = value;
  }));
  return result;
}

function parseCsv(text: string) {
  const output: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"') {
      if (quoted && next === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value); value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) output.push(row);
      row = []; value = '';
    } else value += character;
  }
  if (quoted) throw new Error('The Google Sheet contains an unclosed quoted value.');
  row.push(value);
  if (row.some((cell) => cell.trim())) output.push(row);
  return output;
}

function dateToIso(value: string, fallbackYear?: number) {
  const clean = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const numeric = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return `${year}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`;
  }
  const dayMonth = clean.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})$/);
  const candidate = dayMonth ? `${dayMonth[1]} ${dayMonth[2]} ${fallbackYear ?? new Date().getFullYear()}` : clean;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date in the Petty Cash sheet: ${value}`);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function moneyValue(value: string) {
  const clean = value.replace(/rm/gi, '').replace(/,/g, '').trim();
  if (!clean || clean === '-') return 0;
  return Number(clean);
}

function isWebLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function canonicalChoice(value: string, options: readonly string[]) {
  const clean = normalized(value);
  const exact = options.find((option) => normalized(option) === clean);
  if (exact) return exact;
  const code = value.trim().match(/^\d{3}-\d{3}[A-Za-z]?/i)?.[0]?.toLowerCase();
  if (code) return options.find((option) => option.toLowerCase().startsWith(code)) ?? value.trim();
  return value.trim();
}

function sheetData(csv: string): PettyCashSheetData {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error('The sheet does not contain a Petty Cash form.');
  const headingRowIndex = rows.findIndex((row) => {
    const fields = row.map(headerField);
    return fields.includes('expenseDate') && fields.includes('supplier') && fields.includes('details') && fields.includes('amount');
  });
  if (headingRowIndex < 0) throw new Error('The Petty Cash table headings could not be found. Use the official Petty Cash template.');

  const metadata = readMetadata(rows.slice(0, headingRowIndex));
  const indexes = new Map<SheetField, number>();
  rows[headingRowIndex].forEach((heading, index) => {
    const field = headerField(heading);
    if (field) indexes.set(field, index);
  });
  const required: SheetField[] = ['expenseDate', 'supplier', 'details', 'proofLink', 'accountType', 'division', 'amount'];
  const missing = required.filter((field) => !indexes.has(field));
  if (missing.length) throw new Error(`The Petty Cash sheet is missing columns: ${missing.join(', ')}.`);

  const valuesFor = (row: string[]) => {
    const values = {} as Record<SheetField, string>;
    indexes.forEach((index, field) => { values[field] = String(row[index] ?? '').trim(); });
    return values;
  };
  const populated = rows.slice(headingRowIndex + 1).map(valuesFor).filter((values) => {
    const marker = normalized(values.rowNumber ?? '');
    const detailMarker = normalized(values.details ?? '');
    return marker !== 'eg' && marker !== 'e.g' && marker !== 'example' && !detailMarker.startsWith('what is the expense') &&
      Boolean(values.expenseDate || values.supplier || values.details || values.proofLink || values.accountType || values.division || values.amount);
  });
  if (!populated.length) throw new Error('No Petty Cash expense rows were found in the Google Sheet.');

  const requestDate = metadata.requestDate ? dateToIso(metadata.requestDate) : '';
  const fallbackYear = requestDate ? Number(requestDate.slice(0, 4)) : new Date().getFullYear();
  const lines = populated.map((values, index): PettyCashRequestLine => {
    const rowNumber = index + 1;
    if (!values.expenseDate || !values.supplier || !values.details) {
      throw new Error(`Petty Cash row ${rowNumber} is missing its date, supplier or details.`);
    }
    if (!isWebLink(values.proofLink)) {
      throw new Error(`Petty Cash row ${rowNumber} needs the full receipt URL. Do not use display text such as {link}.`);
    }
    const accountType = resolvePaymentVoucherAccountCode(values.accountType);
    if (!accountType) throw new Error(`Petty Cash row ${rowNumber} is missing its account type.`);
    const division = canonicalChoice(values.division, DIVISION_TYPES);
    if (!division) throw new Error(`Petty Cash row ${rowNumber} is missing its division.`);
    const amount = moneyValue(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Petty Cash row ${rowNumber} needs an amount greater than RM0.00.`);
    return {
      id: crypto.randomUUID(),
      expenseDate: dateToIso(values.expenseDate, fallbackYear),
      supplier: values.supplier,
      details: values.details,
      proofLink: values.proofLink,
      accountType,
      division,
      amount,
    };
  });
  return { ...metadata, requestDate, lines };
}

export function PettyCashGoogleSheet({ completionFields, disabled = false, routingCopy = 'Complete the request routing details below.', submitLabel = 'Submit request', onCancel, onApply, onRetrieved }: Props) {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<PettyCashSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setError(''); setData(null);
    if (!url.trim()) { setError('Paste a Google Sheets link first.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/v1/payment-requests/google-sheet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await response.json() as { data?: { csv: string }; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? 'Unable to read the Google Sheet.');
      const retrieved = sheetData(body.data.csv);
      setData(retrieved);
      onRetrieved?.(retrieved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read the Google Sheet.');
    } finally { setLoading(false); }
  }

  return <section className={styles.sheetCard}>
    <div className={styles.sheetHeader}><div><p>Petty Cash</p><h2>Retrieve from Google Sheets</h2><span>Use one copy of the official Petty Cash template for each request.</span></div><button type="button" onClick={onCancel}>Back to manual form</button></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={styles.sheetLinkRow}><label><span>Google Sheets link</span><input type="url" value={url} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..." onChange={(event) => { setUrl(event.target.value); setData(null); setError(''); }} /></label><button type="button" disabled={loading || !url.trim()} onClick={load}>{loading ? 'Retrieving…' : 'Retrieve sheet'}</button></div>
    <p className={styles.sheetHint}>Share the sheet as “Anyone with the link can view”. Receipt cells must contain the full Google Drive or web URL, not only linked display text such as “{'{link}'}”. Location and Manager approver remain selected in Estuary.</p>
    {data && <><div className={styles.sheetSummary}><div><span>Expense rows</span><strong>{data.lines.length}</strong></div><div><span>Name</span><strong>{data.requesterName || 'Signed-in user'}</strong></div><div><span>Position</span><strong>{data.requesterPosition || 'From user profile'}</strong></div><div><span>Request date</span><strong>{data.requestDate || 'Choose below'}</strong></div></div><div className={styles.sheetTableWrap}><table><thead><tr><th>#</th><th>Date</th><th>Supplier</th><th>Details / purpose</th><th>Account</th><th>Division</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>{data.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.expenseDate}</td><td>{line.supplier}</td><td>{line.details}</td><td>{line.accountType}</td><td>{line.division}</td><td>RM {line.amount.toFixed(2)}</td><td><a href={line.proofLink} target="_blank" rel="noreferrer">Open link</a></td></tr>)}</tbody></table></div><section className={styles.sheetCompletion}><div><h3>Complete request routing</h3><p>{routingCopy}</p></div><div className={styles.sheetCompletionGrid}>{completionFields}</div></section><button className={styles.applySheetButton} disabled={disabled} type="button" onClick={() => onApply(data)}>{disabled ? 'Submitting…' : submitLabel}</button></>}
  </section>;
}

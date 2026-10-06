'use client';

import { type ReactNode, useState } from 'react';
import type { TravelMealType } from '@/domain/payment-requests/travel-allowance/types';
import styles from './travel-allowance.module.css';

export type TravelAllowanceSheetEntry = {
  employeeName: string;
  travelDate: string;
  projectName: string;
  reason: string;
  meals: TravelMealType[];
  specialAllowance: number;
  specialAllowanceReason: string;
};

export type TravelAllowanceSheetData = {
  requesterName: string;
  requesterPosition: string;
  requestDate: string;
  contact: string;
  entries: TravelAllowanceSheetEntry[];
};

type Props = {
  completionFields: ReactNode;
  disabled?: boolean;
  onCancel: () => void;
  onApply: (data: TravelAllowanceSheetData) => void;
  onRetrieved?: (data: TravelAllowanceSheetData) => void;
};

const aliases: Record<string, string> = {
  'employee name': 'employeeName', 'staff name': 'employeeName',
  'travel date': 'travelDate', project: 'projectName',
  'project name': 'projectName', 'under which division': 'projectName',
  'under which division?': 'projectName', reason: 'reason',
  'reason for meal allowance': 'reason', breakfast: 'breakfast',
  lunch: 'lunch', dinner: 'dinner', meals: 'meals', 'meal type': 'meals',
  'special allowance': 'specialAllowance',
  'special allowance (rm)': 'specialAllowance',
  'special allowance reason': 'specialAllowanceReason',
  'reason for special allowance': 'specialAllowanceReason',
};

function normalized(value: string) {
  return value.replace(/^\uFEFF/, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function headerField(value: string) {
  const heading = normalized(value).replace(/\s*\?\s*$/, '');
  if (heading === '#' || heading === 'no' || heading === 'no.') return 'rowNumber';
  if (heading.startsWith('travel date')) return 'travelDate';
  if (heading.startsWith('employee name')) return 'employeeName';
  if (heading.startsWith('under which division')) return 'projectName';
  if (heading.startsWith('reason for meal allowance')) return 'reason';
  if (heading.startsWith('meal type')) return 'meals';
  if (heading.startsWith('special allowance')) return 'specialAllowance';
  if (heading.startsWith('reason for special allowance')) return 'specialAllowanceReason';
  return aliases[heading];
}

const metadataLabels: Record<string, keyof Pick<TravelAllowanceSheetData, 'requesterName' | 'requesterPosition' | 'requestDate' | 'contact'>> = {
  name: 'requesterName', position: 'requesterPosition', date: 'requestDate', contact: 'contact',
};

function readMetadata(rows: string[][]) {
  const result = { requesterName: '', requesterPosition: '', requestDate: '', contact: '' };
  rows.forEach((row, rowIndex) => row.forEach((rawCell, columnIndex) => {
    const cell = rawCell.trim();
    const match = cell.match(/^\s*(name|position|date|contact)\s*:\s*(.*)$/i);
    if (!match) return;
    const field = metadataLabels[match[1].toLowerCase()];
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
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date in the Travel Allowance sheet: ${value}`);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function moneyValue(value: string) {
  const clean = value.replace(/rm/gi, '').replace(/,/g, '').trim();
  if (!clean || clean === '-') return 0;
  return Number(clean);
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

function truthy(value: string) {
  return ['yes', 'y', 'true', '1', 'x', 'selected'].includes(normalized(value));
}

function mealsFrom(values: Record<string, string>): TravelMealType[] {
  const selected: TravelMealType[] = [];
  const combined = normalized(values.meals ?? '');
  if (truthy(values.breakfast ?? '') || combined.includes('breakfast')) selected.push('BREAKFAST');
  if (truthy(values.lunch ?? '') || combined.includes('lunch')) selected.push('LUNCH');
  if (truthy(values.dinner ?? '') || combined.includes('dinner')) selected.push('DINNER');
  return selected;
}

function sheetData(csv: string): TravelAllowanceSheetData {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error('The sheet does not contain a Travel Allowance form.');
  const headingRowIndex = rows.findIndex((row) => {
    const fields = row.map(headerField);
    return fields.includes('travelDate') && fields.includes('employeeName') && fields.includes('projectName');
  });
  if (headingRowIndex < 0) throw new Error('The Travel Allowance table headings could not be found.');
  const metadata = readMetadata(rows.slice(0, headingRowIndex));
  const headings = rows[headingRowIndex];
  const dataRows = rows.slice(headingRowIndex + 1);
  const indexes = new Map<string, number>();
  headings.forEach((heading, index) => {
    const field = headerField(heading);
    if (field) indexes.set(field, index);
  });
  const required = ['travelDate', 'employeeName', 'projectName', 'reason', 'meals', 'specialAllowance', 'specialAllowanceReason'];
  const missing = required.filter((field) => !indexes.has(field));
  if (missing.length) throw new Error(`The Travel Allowance sheet is missing columns: ${missing.join(', ')}.`);

  const valuesFor = (row: string[]) => {
    const values: Record<string, string> = {};
    indexes.forEach((index, field) => { values[field] = String(row[index] ?? '').trim(); });
    return values;
  };
  const populated = dataRows.map(valuesFor).filter((values) => {
    const employeeMarker = normalized(values.employeeName ?? '');
    const rowMarker = normalized(values.rowNumber ?? '');
    return employeeMarker !== 'employee name' && rowMarker !== 'eg' && (values.travelDate || values.projectName || values.reason || values.meals || values.specialAllowance);
  });
  if (!populated.length) throw new Error('No travel entries were found in the Google Sheet.');
  const requestDate = metadata.requestDate ? dateToIso(metadata.requestDate) : '';
  const fallbackYear = requestDate ? Number(requestDate.slice(0, 4)) : new Date().getFullYear();
  const entries = populated.map((values, index) => {
    const specialAllowance = moneyValue(values.specialAllowance || '');
    if (!values.travelDate || !values.projectName || !values.reason) {
      throw new Error(`Travel entry ${index + 1} is missing its travel date, project or reason.`);
    }
    if (!Number.isFinite(specialAllowance) || specialAllowance < 0) {
      throw new Error(`Travel entry ${index + 1} has an invalid special allowance.`);
    }
    const meals = mealsFrom(values);
    if (!meals.length && specialAllowance <= 0) {
      throw new Error(`Travel entry ${index + 1} must contain at least one meal or a special allowance.`);
    }
    if (specialAllowance > 0 && !values.specialAllowanceReason) {
      throw new Error(`Travel entry ${index + 1} needs a special allowance reason.`);
    }
    return {
      employeeName: values.employeeName || metadata.requesterName,
      travelDate: dateToIso(values.travelDate, fallbackYear),
      projectName: values.projectName,
      reason: values.reason,
      meals,
      specialAllowance,
      specialAllowanceReason: values.specialAllowanceReason ?? '',
    };
  });
  return {
    requesterName: metadata.requesterName,
    requesterPosition: metadata.requesterPosition,
    requestDate,
    contact: metadata.contact,
    entries,
  };
}

export function TravelAllowanceGoogleSheet({ completionFields, disabled = false, onCancel, onApply, onRetrieved }: Props) {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<TravelAllowanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setError(''); setData(null);
    if (!url.trim()) { setError('Paste a Google Sheets link first.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/v1/payment-requests/google-sheet', {
        method: 'POST', headers: { 'content-type': 'application/json' },
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
    <div className={styles.sheetHeader}><div><p>Travel Allowance</p><h2>Retrieve from Google Sheets</h2><span>One shared sheet creates one Travel Allowance request. Each populated row becomes a travel entry.</span></div><button type="button" onClick={onCancel}>Back to manual form</button></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={styles.sheetLinkRow}><label><span>Google Sheets link</span><input type="url" value={url} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..." onChange={(event) => { setUrl(event.target.value); setData(null); setError(''); }} /></label><button type="button" disabled={loading || !url.trim()} onClick={load}>{loading ? 'Retrieving…' : 'Retrieve sheet'}</button></div>
    <p className={styles.sheetHint}>The sheet must use the official Travel Allowance template and be shared as “Anyone with the link can view”. The Manager and Project Director are selected in Estuary after retrieval.</p>
    {data && <><div className={styles.sheetSummary}><div><span>Travel entries</span><strong>{data.entries.length}</strong></div><div><span>Name</span><strong>{data.requesterName || 'Signed-in user'}</strong></div><div><span>Position</span><strong>{data.requesterPosition || 'From user profile'}</strong></div><div><span>Request date</span><strong>{data.requestDate || 'Choose below'}</strong></div></div><div className={styles.sheetTableWrap}><table><thead><tr><th>#</th><th>Employee</th><th>Travel date</th><th>Division</th><th>Reason</th><th>Meals</th><th>Special</th></tr></thead><tbody>{data.entries.map((entry, index) => <tr key={`${entry.travelDate}-${index}`}><td>{index + 1}</td><td>{entry.employeeName || 'Signed-in Staff'}</td><td>{entry.travelDate}</td><td>{entry.projectName}</td><td>{entry.reason}</td><td>{entry.meals.join(', ') || '—'}</td><td>RM {entry.specialAllowance.toFixed(2)}</td></tr>)}</tbody></table></div><section className={styles.sheetCompletion}><div><h3>Complete request routing</h3><p>Choose the request details and approvers here before continuing.</p></div><div className={styles.sheetCompletionGrid}>{completionFields}</div></section><button className={styles.applySheetButton} disabled={disabled} type="button" onClick={() => onApply(data)}>Continue to review</button></>}
  </section>;
}

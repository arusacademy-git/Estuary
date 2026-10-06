'use client';

import { type ReactNode, useState } from 'react';
import { CLAIM_ACCOUNT_TYPES, CLAIM_DIVISION_TYPES, CLAIM_TYPES, type ClaimLine, type ClaimType } from '@/domain/payment-requests/claims/types';
import styles from './claims.module.css';

export type ClaimSheetData = { claimType: ClaimType; claimantName: string; claimantPosition: string; claimDate: string; contact: string; lines: ClaimLine[] };

const normalize = (value: string) => value.replace(/^\uFEFF/, '').trim().replace(/\s+/g, ' ').toLowerCase();
const newId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

function parseCsv(text: string) {
    const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
    for (let index = 0; index < text.length; index += 1) { const character = text[index]; const next = text[index + 1]; if (character === '"') { if (quoted && next === '"') { value += '"'; index += 1; } else quoted = !quoted; } else if (character === ',' && !quoted) { row.push(value); value = ''; } else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && next === '\n') index += 1; row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); row = []; value = ''; } else value += character; }
    if (quoted) throw new Error('The Google Sheet contains an unclosed quoted value.'); row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); return rows;
}

function dateToIso(value: string, fallbackYear = new Date().getFullYear()) {
    const clean = value.trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    const numeric = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/); if (numeric) { const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]); return `${year}-${numeric[2].padStart(2, '0')}-${numeric[1].padStart(2, '0')}`; }
    const dayMonth = clean.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})$/); const parsed = new Date(dayMonth ? `${dayMonth[1]} ${dayMonth[2]} ${fallbackYear}` : clean); if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid claim date: ${value}`); return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function optionalDateToIso(value: string) {
    try { return dateToIso(value); } catch { return ''; }
}

function usableMetadataValue(key: string, value: string) {
    if (!value || heading(value)) return false;
    if (key === 'date') return Boolean(optionalDateToIso(value));
    if (key === 'contact') return /\d|@/.test(value);
    return true;
}

function money(value: string) { const clean = value.replace(/rm/gi, '').replace(/,/g, '').trim(); return !clean || clean === '-' ? 0 : Number(clean); }

function metadata(rows: string[][], end: number) {
    const result: Record<string, string> = {}; const labels = ['name', 'position', 'date', 'contact'];
    rows.slice(0, end).forEach((row, rowIndex) => row.forEach((raw, columnIndex) => {
        const cell = raw.trim(); const match = cell.match(/^\s*(name|position|date|contact)\s*:\s*(.*)$/i); if (!match) return;
        const key = match[1].toLowerCase(); let value = match[2].trim();
        if (!usableMetadataValue(key, value)) value = '';
        if (!value) {
            for (let next = columnIndex + 1; next < row.length; next += 1) {
                const candidate = String(row[next] ?? '').trim();
                if (labels.some((label) => normalize(candidate).startsWith(`${label}:`))) break;
                if (usableMetadataValue(key, candidate)) { value = candidate; break; }
            }
        }
        if (!value) {
            const candidate = String(rows[rowIndex + 1]?.[columnIndex] ?? '').trim();
            if (usableMetadataValue(key, candidate)) value = candidate;
        }
        if (value) result[key] = value;
    }));
    return result;
}

function sheetTitleType(rows: string[][]): ClaimType | null {
    const text = rows.slice(0, 15).flat().map(normalize).join(' | ');
    if (text.includes('internet/commute claim form') || text.includes('internet / commute claim form')) return 'INTERNET_COMMUTE';
    if (text.includes('expense claim form')) return 'EXPENSE';
    if (text.includes('mileage claim form')) return 'MILEAGE';
    if (text.includes('medical claim form')) return 'MEDICAL';
    if (text.includes('tech claim form')) return 'TECH';
    if (text.includes('pd claim form')) return 'PD';
    return null;
}

function heading(value: string) {
    const cell = normalize(value);
    if (cell === '#' || cell === 'no' || cell === 'no.') return 'number';
    if (cell === 'date') return 'expenseDate';
    if (cell.startsWith('supplier')) return 'supplier';
    if (cell.startsWith('details')) return 'details';
    if (cell.includes('link to e-invoice') || cell.includes('receipts')) return 'receiptLink';
    if (cell.startsWith('type of account')) return 'accountType';
    if (cell.startsWith('division')) return 'division';
    if (cell === 'from') return 'from';
    if (cell === 'to') return 'to';
    if (cell.startsWith('total kilometers')) return 'kilometers';
    if (cell.startsWith('rate/km')) return 'rate';
    if (cell.startsWith('total')) return 'amount';
    return '';
}

function parseClaimSheet(csv: string, selectedType: ClaimType): ClaimSheetData {
    const rows = parseCsv(csv); const detected = sheetTitleType(rows);
    if (detected && detected !== selectedType) throw new Error(`This sheet is ${CLAIM_TYPES.find((item) => item.value === detected)?.label}, but you selected ${CLAIM_TYPES.find((item) => item.value === selectedType)?.label}.`);
    const headerIndex = rows.findIndex((row) => { const fields = row.map(heading); return fields.includes('expenseDate') && fields.includes('details') && fields.includes('amount') && (selectedType === 'MILEAGE' ? fields.includes('kilometers') : fields.includes('supplier')); });
    if (headerIndex < 0) throw new Error(`The selected ${CLAIM_TYPES.find((item) => item.value === selectedType)?.label} headings could not be found.`);
    const indexes = new Map<string, number>(); rows[headerIndex].forEach((cell, index) => { const field = heading(cell); if (field) indexes.set(field, index); });
    const required = selectedType === 'MILEAGE' ? ['expenseDate', 'details', 'division', 'from', 'to', 'kilometers'] : selectedType === 'EXPENSE' ? ['expenseDate', 'supplier', 'details', 'receiptLink', 'accountType', 'division', 'amount'] : ['expenseDate', 'supplier', 'details', 'receiptLink', 'amount'];
    const missing = required.filter((field) => !indexes.has(field)); if (missing.length) throw new Error(`This sheet is missing columns required for the selected claim type: ${missing.join(', ')}.`);
    const value = (row: string[], field: string) => String(row[indexes.get(field) ?? -1] ?? '').trim();
    const info = metadata(rows, headerIndex); const claimDate = info.date ? optionalDateToIso(info.date) : ''; const year = claimDate ? Number(claimDate.slice(0, 4)) : new Date().getFullYear();
    const populated = rows.slice(headerIndex + 1).filter((row) => {
        const marker = normalize(value(row, 'number'));
        const expenseDate = value(row, 'expenseDate');
        const misplacedHeading = heading(expenseDate);

        // Some Claim templates wrap the long receipt heading onto a second CSV row.
        // It can then appear under the Date column and must not be parsed as a claim.
        if (marker === 'eg' || marker === 'e.g' || !expenseDate || (misplacedHeading && misplacedHeading !== 'expenseDate')) return false;

        return Boolean(value(row, 'details') || value(row, 'amount') || value(row, 'kilometers'));
    });
    const lines = populated.map((row, index) => {
        const expenseDate = dateToIso(value(row, 'expenseDate'), year); const details = value(row, 'details'); const division = value(row, 'division');
        if (!details) throw new Error(`Claim row ${index + 1} is missing its details or purpose.`);
        if (selectedType === 'MILEAGE') { const kilometers = money(value(row, 'kilometers')); if (!division || !value(row, 'from') || !value(row, 'to') || !Number.isFinite(kilometers) || kilometers <= 0) throw new Error(`Mileage row ${index + 1} is incomplete.`); return { id: newId(), expenseDate, supplier: '', details, receiptFileName: '', receiptMimeType: '', receiptFileSize: 0, accountType: '', division, amount: 0, from: value(row, 'from'), to: value(row, 'to'), kilometers }; }
        const amount = money(value(row, 'amount')); const receiptLink = value(row, 'receiptLink'); const supplier = value(row, 'supplier'); if (!supplier || !receiptLink || !Number.isFinite(amount) || amount <= 0) throw new Error(`Claim row ${index + 1} must contain a supplier, receipt link and positive total.`);
        try { const url = new URL(receiptLink); if (url.protocol !== 'https:') throw new Error(); } catch { throw new Error(`Claim row ${index + 1} has an invalid receipt link.`); }
        const accountType = value(row, 'accountType'); if (selectedType === 'EXPENSE' && !CLAIM_ACCOUNT_TYPES.includes(accountType as (typeof CLAIM_ACCOUNT_TYPES)[number])) throw new Error(`Expense row ${index + 1} has an unknown Type of Account.`);
        if (selectedType === 'EXPENSE' && !CLAIM_DIVISION_TYPES.includes(division as (typeof CLAIM_DIVISION_TYPES)[number])) throw new Error(`Expense row ${index + 1} has an unknown Division.`);
        return { id: newId(), expenseDate, supplier, details, receiptLink, receiptFileName: '', receiptMimeType: '', receiptFileSize: 0, accountType, division, amount, from: '', to: '', kilometers: 0 };
    });
    if (!lines.length) throw new Error('No completed claim rows were found.');
    return { claimType: selectedType, claimantName: info.name ?? '', claimantPosition: info.position ?? '', claimDate, contact: info.contact ?? '', lines };
}

export function ClaimGoogleSheet({ completionFields, disabled = false, onApply, onCancel, onRetrieved }: { completionFields: ReactNode; disabled?: boolean; onApply: (data: ClaimSheetData) => void; onCancel: () => void; onRetrieved?: (data: ClaimSheetData) => void }) {
    const [claimType, setClaimType] = useState<ClaimType>('EXPENSE'); const [url, setUrl] = useState(''); const [data, setData] = useState<ClaimSheetData | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
    async function retrieve() { setLoading(true); setError(''); setData(null); try { const response = await fetch('/api/v1/payment-requests/google-sheet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: url.trim() }) }); const body = await response.json() as { data?: { csv: string }; error?: { message?: string } }; if (!response.ok || !body.data) throw new Error(body.error?.message ?? 'Unable to read the Google Sheet.'); const retrieved = parseClaimSheet(body.data.csv, claimType); setData(retrieved); onRetrieved?.(retrieved); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to read the Claim sheet.'); } finally { setLoading(false); } }
    return <section className={styles.googleSheetCard}><div className={styles.googleSheetHeader}><div><span>Claims · Google Sheets</span><h2>Retrieve a completed Claim form</h2><p>Select the Claim Type, then paste the link to its completed worksheet.</p></div><button className={styles.secondaryButton} onClick={onCancel} type="button">Back to manual form</button></div>{error && <div className={styles.error}>{error}</div>}<div className={styles.googleSheetFields}><label><span>Claim Type *</span><select value={claimType} onChange={(event) => { setClaimType(event.target.value as ClaimType); setData(null); setError(''); }}>{CLAIM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>Google Sheets Link *</span><input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setData(null); }} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..." /></label><button className={styles.primaryButton} disabled={loading || !url.trim()} onClick={retrieve} type="button">{loading ? 'Retrieving…' : 'Retrieve sheet'}</button></div>{data && <><div className={styles.googleSheetSummary}><div><span>Claim type</span><strong>{CLAIM_TYPES.find((item) => item.value === data.claimType)?.label}</strong></div><div><span>Claimant</span><strong>{data.claimantName || 'Signed-in user'}</strong></div><div><span>Items</span><strong>{data.lines.length}</strong></div></div><div className={styles.tableWrap}><table className={styles.claimTable}><thead><tr><th>#</th><th>Date</th><th>{data.claimType === 'MILEAGE' ? 'Route' : 'Supplier'}</th><th>Details</th><th>{data.claimType === 'MILEAGE' ? 'Kilometres' : 'Amount'}</th></tr></thead><tbody>{data.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.expenseDate}</td><td>{data.claimType === 'MILEAGE' ? `${line.from} → ${line.to}` : line.supplier}</td><td>{line.details}</td><td>{data.claimType === 'MILEAGE' ? line.kilometers : `RM ${line.amount.toFixed(2)}`}</td></tr>)}</tbody></table></div><section className={styles.sheetCompletion}><div><h3>Complete claim routing</h3><p>Choose the reviewers and confirm the retrieved claim here.</p></div><div className={styles.sheetCompletionGrid}>{completionFields}</div></section><button className={styles.applySheetButton} disabled={disabled} onClick={() => onApply(data)} type="button">{disabled ? 'Submitting…' : 'Submit claim'}</button></>}</section>;
}

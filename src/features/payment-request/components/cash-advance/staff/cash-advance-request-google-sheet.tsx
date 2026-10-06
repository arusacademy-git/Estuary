'use client';

import { type ReactNode, useState } from 'react';
import type { CashAdvanceRequestLine } from '@/domain/payment-requests/cash-advance/types';
import { normalizeSheetCell, parseSheetCsv, retrieveSheetCsv, sheetDate, sheetMetadata, sheetMoney } from './cash-advance-google-sheet-utils';
import styles from '../cash-advance.module.css';

export type CashAdvanceRequestSheetData = {
    requesterName: string; requesterPosition: string; requestDate: string; contact: string;
    accountHolderName: string; bankName: string; bankAccountNumber: string;
    lines: CashAdvanceRequestLine[];
};

function heading(value: string) {
    const cell = normalizeSheetCell(value);
    if (cell === 'no' || cell === 'no.') return 'number';
    if (cell.startsWith('breakdown of request')) return 'description';
    if (cell.startsWith('purpose')) return 'purpose';
    if (cell.startsWith('amount')) return 'amount';
    return '';
}

function parseRequestSheet(csv: string): CashAdvanceRequestSheetData {
    const rows = parseSheetCsv(csv);
    const headerIndex = rows.findIndex((row) => {
        const fields = row.map(heading);
        return fields.includes('description') && fields.includes('purpose') && fields.includes('amount');
    });
    if (headerIndex < 0) throw new Error('Cash Advance Request Form headings could not be found. Open Tab 1 before copying the link.');
    const indexes = new Map<string, number>();
    rows[headerIndex].forEach((cell, index) => { const field = heading(cell); if (field) indexes.set(field, index); });
    const values = (row: string[], field: string) => String(row[indexes.get(field) ?? -1] ?? '').trim();
    const lines = rows.slice(headerIndex + 1).filter((row) => {
        const marker = normalizeSheetCell(values(row, 'number'));
        return marker !== 'eg' && (values(row, 'description') || values(row, 'purpose') || values(row, 'amount'));
    }).map((row, index) => {
        const amount = sheetMoney(values(row, 'amount'));
        if (!values(row, 'description') || !values(row, 'purpose') || !Number.isFinite(amount) || amount <= 0) {
            throw new Error(`Request row ${index + 1} must contain its expense breakdown, purpose and a valid amount.`);
        }
        return { id: crypto.randomUUID(), description: values(row, 'description'), purpose: values(row, 'purpose'), amount };
    });
    if (!lines.length) throw new Error('No completed Cash Advance request rows were found.');
    const meta = sheetMetadata(rows, rows.length);
    return {
        requesterName: meta.name ?? '', requesterPosition: meta.position ?? '',
        requestDate: meta.date ? sheetDate(meta.date) : '', contact: meta.contact ?? '',
        accountHolderName: meta['account holder name'] ?? '', bankName: meta['bank name'] ?? '',
        bankAccountNumber: meta['account number'] ?? '', lines,
    };
}

export function CashAdvanceRequestGoogleSheet({ completionFields, disabled = false, onApply, onCancel, onRetrieved }: { completionFields: ReactNode; disabled?: boolean; onApply: (data: CashAdvanceRequestSheetData) => void; onCancel: () => void; onRetrieved?: (data: CashAdvanceRequestSheetData) => void }) {
    const [url, setUrl] = useState(''); const [data, setData] = useState<CashAdvanceRequestSheetData | null>(null);
    const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
    async function load() { setLoading(true); setError(''); setData(null); try { const retrieved = parseRequestSheet(await retrieveSheetCsv(url)); setData(retrieved); onRetrieved?.(retrieved); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to read the Cash Advance sheet.'); } finally { setLoading(false); } }
    return <section className={styles.sheetPanel}><div className={styles.sheetPanelHeader}><div><span>Cash Advance · Tab 1</span><h2>Retrieve request from Google Sheets</h2><p>Paste the link while the Cash Advance Form tab is selected.</p></div><button className={styles.secondary} onClick={onCancel} type="button">Back to manual form</button></div>{error && <div className={styles.error}>{error}</div>}<div className={styles.sheetLinkRow}><label className={styles.field}><span>Google Sheets link</span><input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setData(null); }} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..." /></label><button className={styles.primary} disabled={loading || !url.trim()} onClick={load} type="button">{loading ? 'Retrieving…' : 'Retrieve Sheet'}</button></div>{data && <><div className={styles.sheetSummary}><div><span>Request rows</span><strong>{data.lines.length}</strong></div><div><span>Name</span><strong>{data.requesterName || 'Signed-in Staff'}</strong></div><div><span>Date</span><strong>{data.requestDate || 'Choose below'}</strong></div></div><div className={styles.tableShell}><table className={styles.lineTable}><thead><tr><th>#</th><th>Breakdown</th><th>Purpose</th><th>Amount</th></tr></thead><tbody>{data.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.description}</td><td>{line.purpose}</td><td>RM {line.amount.toFixed(2)}</td></tr>)}</tbody></table></div><section className={styles.sheetCompletion}><div><h3>Complete request routing</h3><p>Select the project, approvers and payment details before review.</p></div><div className={styles.sheetCompletionGrid}>{completionFields}</div></section><button className={styles.applySheet} disabled={disabled} onClick={() => onApply(data)} type="button">Continue to review</button></>}</section>;
}

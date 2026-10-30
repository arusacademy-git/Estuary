'use client';

import { type ReactNode, useState } from 'react';
import type { CashAdvanceRequestLine } from '@/domain/payment-requests/cash-advance/types';
import { OfficialTemplateCallout } from '@/features/payment-request/components/google-sheet/official-template-callout';
import { normalizeSheetCell, parseSheetCsv, retrieveSheetCsv, sheetDate, sheetMetadata, sheetMoney } from './cash-advance-google-sheet-utils';
import styles from '../cash-advance.module.css';

export type CashAdvanceRequestSheetData = {
    requesterName: string; requesterPosition: string; requestDate: string; contact: string;
    accountHolderName: string; bankName: string; bankAccountNumber: string;
    lines: CashAdvanceRequestLine[];
};

const cashAdvanceTemplateUrl = process.env.NEXT_PUBLIC_CASH_ADVANCE_TEMPLATE_SHEET_URL?.trim() ?? '';

function heading(value: string) {
    const cell = normalizeSheetCell(value);
    if (cell === 'no' || cell === 'no.') return 'number';
    if (cell.startsWith('breakdown of request')) return 'description';
    if (cell.startsWith('purpose')) return 'purpose';
    if (cell.startsWith('amount')) return 'amount';
    return '';
}

export function parseRequestSheet(csv: string): CashAdvanceRequestSheetData {
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
        const amount = sheetMoney(values(row, 'amount'));
        const content = normalizeSheetCell(row.join(' '));
        const excluded = content.includes('for finance use only') || content.includes('verified by') || content.includes('signature of requester') || content.includes('account holder name') || content.includes('bank name') || content.includes('account number') || marker === 'totals' || normalizeSheetCell(values(row, 'purpose')) === 'totals';
        return !excluded && marker !== 'eg' && Number.isFinite(amount) && amount > 0 && Boolean(values(row, 'description') || values(row, 'purpose'));
    }).map((row, index) => {
        const amount = sheetMoney(values(row, 'amount'));
        if (!Number.isFinite(amount) || amount < 0) {
            throw new Error(`Request row ${index + 1} has an invalid amount.`);
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
    const total = data?.lines.reduce((sum, line) => sum + line.amount, 0) ?? 0;
    return <section className={styles.sheetPanel}><div className={styles.sheetPanelHeader}><div><span>Cash Advance · Tab 1</span><h2>Retrieve request from Google Sheets</h2><p>Paste the link while the Cash Advance Form tab is selected.</p></div><button className={styles.secondary} onClick={onCancel} type="button">Back to manual form</button></div><OfficialTemplateCallout actionLabel="Open CA template sheet ↗" description="Open the standard Cash Advance Google Sheet in a new tab, make your own copy and complete the request rows on Tab 1." title="Cash Advance master sheet" unavailableLabel="CA template link not configured" url={cashAdvanceTemplateUrl} />{error && <div className={styles.error}>{error}</div>}<div className={styles.sheetLinkRow}><label className={styles.field}><span>Google Sheets link</span><input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setData(null); }} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..." /></label><button className={styles.primary} disabled={loading || !url.trim()} onClick={load} type="button">{loading ? 'Retrieving…' : 'Retrieve Sheet'}</button></div>{data && <><div className={styles.tableShell}><table className={styles.lineTable}><thead><tr><th>#</th><th>Breakdown request</th><th>Purpose</th><th>Amount</th></tr></thead><tbody>{data.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.description || '—'}</td><td>{line.purpose || '—'}</td><td>RM {line.amount.toFixed(2)}</td></tr>)}</tbody></table></div><div className={styles.sheetTotal}><span>Total amount requested</span><strong>RM {total.toFixed(2)}</strong></div><section className={styles.sheetCompletion}><div><h3>Complete request routing</h3><p>Confirm the request details extracted from the sheet and select its approvers.</p></div><div className={styles.sheetCompletionGrid}>{completionFields}</div></section><button className={styles.applySheet} disabled={disabled} onClick={() => onApply(data)} type="button">Continue to review</button></>}</section>;
}

'use client';

import { useState } from 'react';
import type { CashAdvanceExpense } from '@/domain/payment-requests/cash-advance/types';
import { resolvePaymentVoucherAccountCode } from '@/shared/constants/payment-options';
import { normalizeSheetCell, parseSheetCsv, retrieveSheetCsv, sheetDate, sheetMoney } from '../cash-advance-google-sheet-utils';
import styles from '../../cash-advance.module.css';

function heading(value: string) {
    const cell = normalizeSheetCell(value);
    if (cell === 'no' || cell === 'no.') return 'number';
    if (cell === 'date') return 'expenseDate';
    if (cell.startsWith('supplier')) return 'supplier';
    if (cell.includes('list of expenses')) return 'description';
    if (cell.startsWith('type of account')) return 'accountType';
    if (cell.startsWith('division')) return 'division';
    if (cell.includes('link to e-invoice') || cell.includes('receipts')) return 'receiptLink';
    if (cell.startsWith('amount')) return 'amount';
    return '';
}

function parseSummary(csv: string) {
    const rows = parseSheetCsv(csv);
    const headerIndex = rows.findIndex((row) => { const fields = row.map(heading); return fields.includes('expenseDate') && fields.includes('supplier') && fields.includes('description') && fields.includes('amount'); });
    if (headerIndex < 0) throw new Error('Summary of Cash Advance Spent headings could not be found. Open Appendix A before copying the link.');
    const indexes = new Map<string, number>(); rows[headerIndex].forEach((cell, index) => { const field = heading(cell); if (field) indexes.set(field, index); });
    const value = (row: string[], field: string) => String(row[indexes.get(field) ?? -1] ?? '').trim();
    const expenses = rows.slice(headerIndex + 1).filter((row) => normalizeSheetCell(value(row, 'number')) !== 'e.g' && normalizeSheetCell(value(row, 'number')) !== 'eg' && (value(row, 'expenseDate') || value(row, 'supplier') || value(row, 'description') || value(row, 'amount'))).map((row, index) => {
        const amount = sheetMoney(value(row, 'amount')); const receiptLink = value(row, 'receiptLink'); const rawAccountType = value(row, 'accountType'); const accountType = resolvePaymentVoucherAccountCode(rawAccountType);
        if (!value(row, 'expenseDate') || !value(row, 'supplier') || !value(row, 'description') || !rawAccountType || !Number.isFinite(amount) || amount <= 0) throw new Error(`Appendix A row ${index + 1} is incomplete.`);
        if (!accountType) throw new Error(`Appendix A row ${index + 1} has an unknown Type of Account: ${rawAccountType}`);
        if (receiptLink) { try { const parsed = new URL(receiptLink); if (parsed.protocol !== 'https:') throw new Error(); } catch { throw new Error(`Appendix A row ${index + 1} has an invalid receipt link.`); } }
        return { id: crypto.randomUUID(), expenseDate: sheetDate(value(row, 'expenseDate')), supplier: value(row, 'supplier'), description: value(row, 'description'), accountType, division: value(row, 'division'), receiptLink: receiptLink || undefined, amount } satisfies CashAdvanceExpense;
    });
    if (!expenses.length) throw new Error('No completed expenses were found in Appendix A.');
    return expenses;
}

export function CashSpentGoogleSheet({ onApply }: { onApply: (expenses: CashAdvanceExpense[]) => void }) {
    const [url, setUrl] = useState(''); const [expenses, setExpenses] = useState<CashAdvanceExpense[] | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
    async function load() { setLoading(true); setError(''); setExpenses(null); try { setExpenses(parseSummary(await retrieveSheetCsv(url))); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to read Appendix A.'); } finally { setLoading(false); } }
    return <div className={styles.inlineSheet}><div><strong>Retrieve Appendix A from Google Sheets</strong><p>Open the “Summary of Cash Advance Spent” tab, then copy its link including the tab’s gid.</p></div>{error && <div className={styles.error}>{error}</div>}<div className={styles.sheetLinkRow}><label className={styles.field}><span>Appendix A Google Sheets link</span><input type="url" value={url} onChange={(event) => { setUrl(event.target.value); setExpenses(null); }} placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=..." /></label><button className={styles.secondary} disabled={loading || !url.trim()} onClick={load} type="button">{loading ? 'Retrieving…' : 'Retrieve summary'}</button></div>{expenses && <div className={styles.sheetApplyRow}><span>{expenses.length} expense {expenses.length === 1 ? 'row' : 'rows'} found</span><button className={styles.primary} onClick={() => onApply(expenses)} type="button">Use retrieved expenses</button></div>}</div>;
}

import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import styles from './cash-advance.module.css';

type FormRow = { key: 'request' | 'summary' | 'participant'; title: string; note: string };

function formHref(requestNumber: string, form: FormRow['key'], download = false) {
    return `/api/v1/payment-requests/cash-advance/${encodeURIComponent(requestNumber)}/forms?form=${form}${download ? '&download=1' : ''}`;
}

export function CashAdvancePdfForms({ record }: { record: CashAdvanceRecord }) {
    const rows: FormRow[] = [{ key: 'request', title: 'Cash Advance Request Form', note: 'Signed Staff, Manager and Director request' }];
    if (record.reconciliation) rows.push({ key: 'summary', title: 'Summary of Cash Advance Spent', note: 'Generated from the submitted reconciliation' });
    if (record.reconciliation?.includesParticipantAllowance) rows.push({ key: 'participant', title: 'Participant Allowance', note: 'Included because participant allowances were recorded' });
    const packHref = `/api/v1/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}/forms?form=pack`;

    return <section className={styles.receiptSection}>
        <div className={styles.pdfSectionHeading}><div><h2>Cash Advance forms</h2><p>{rows.length} {rows.length === 1 ? 'form' : 'forms'} available for this record</p></div><div className={styles.pdfPackActions}><a href={packHref} rel="noreferrer" target="_blank">Preview form pack</a><a href={`${packHref}&download=1`}>Download form pack</a></div></div>
        <div className={styles.pdfFormList}>{rows.map((row) => <div className={styles.pdfFormRow} key={row.key}><span aria-hidden="true" className={styles.documentIcon}><svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M14 2.75H6.75A1.75 1.75 0 0 0 5 4.5v15A1.75 1.75 0 0 0 6.75 21h10.5A1.75 1.75 0 0 0 19 19.5V7.75L14 2.75Z" /><path d="M14 2.75v5h5M8.5 13h7M8.5 16.5h7" /></svg></span><div className={styles.documentCopy}><strong>{row.title} (PDF)</strong><small>{row.note}</small></div><div className={styles.documentActions}><a href={formHref(record.requestNumber, row.key)} rel="noreferrer" target="_blank">Preview</a><a href={formHref(record.requestNumber, row.key, true)}>Download</a></div></div>)}</div>
    </section>;
}

'use client';

import { useEffect, useState } from 'react';

import { fetchInvoicePayment } from '@/data/payment-requests/invoice-payment/api';
import type { InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { PaymentPageState } from '@/shared/payment-page-state';

import { InvoicePaymentForm } from './invoice-payment-form';

export function InvoicePaymentEdit({ requestId }: { requestId: string }) {
    const [account] = useState<ReturnType<typeof readBetaSession>>(() => readBetaSession());
    const [record, setRecord] = useState<InvoicePaymentRequestRecord | null>(null);
    const [checked, setChecked] = useState(() => !account || account.role !== 'staff');
    const [error, setError] = useState(() => !account || account.role !== 'staff'
        ? 'Sign in using the Staff account that submitted this request.'
        : '');

    useEffect(() => {
        if (!account || account.role !== 'staff') return;
        let cancelled = false;
        fetchInvoicePayment(requestId)
            .then((item) => {
                if (item.staffId !== account.id) throw new Error('Only the original Staff requester can edit this Invoice Payment.');
                if (item.status !== 'RETURNED_TO_STAFF') throw new Error('This Invoice Payment is not currently returned for correction.');
                if (!cancelled) setRecord(item);
            })
            .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'The Invoice Payment could not be loaded.'); })
            .finally(() => { if (!cancelled) setChecked(true); });
        return () => { cancelled = true; };
    }, [account, requestId]);

    const detailHref = `/beta/payment-records/invoice-payments/${encodeURIComponent(requestId)}`;
    if (!checked) return <PaymentPageState title="Loading Invoice Payment correction" copy="Reading the returned Invoice Payment…" backHref={detailHref} backLabel="Back to Invoice Payment details" />;
    if (!record) return <PaymentPageState title="Invoice Payment correction unavailable" copy={error} backHref={detailHref} backLabel="Back to Invoice Payment details" />;
    return <InvoicePaymentForm initialRecord={record} />;
}

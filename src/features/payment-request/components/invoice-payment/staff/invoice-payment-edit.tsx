'use client';

import { useEffect, useState } from 'react';

import { fetchInvoicePayment } from '@/data/payment-requests/invoice-payment/api';
import type { InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { PaymentPageState } from '@/shared/payment-page-state';

import { InvoicePaymentForm } from './invoice-payment-form';

export function InvoicePaymentEdit({ requestId }: { requestId: string }) {
    const [record, setRecord] = useState<InvoicePaymentRequestRecord | null>(null);
    const [checked, setChecked] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const account = readBetaSession();
        if (!account || account.role !== 'staff') {
            setError('Sign in using the Staff account that submitted this request.');
            setChecked(true);
            return;
        }
        fetchInvoicePayment(requestId)
            .then((item) => {
                if (item.staffId !== account.id) throw new Error('Only the original Staff requester can edit this Invoice Payment.');
                if (item.status !== 'RETURNED_TO_STAFF') throw new Error('This Invoice Payment is not currently returned for correction.');
                setRecord(item);
            })
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'The Invoice Payment could not be loaded.'))
            .finally(() => setChecked(true));
    }, [requestId]);

    const detailHref = `/beta/payment-records/invoice-payments/${encodeURIComponent(requestId)}`;
    if (!checked) return <PaymentPageState title="Loading Invoice Payment correction" copy="Reading the returned Invoice Payment…" backHref={detailHref} backLabel="Back to Invoice Payment details" />;
    if (!record) return <PaymentPageState title="Invoice Payment correction unavailable" copy={error} backHref={detailHref} backLabel="Back to Invoice Payment details" />;
    return <InvoicePaymentForm initialRecord={record} />;
}

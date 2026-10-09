'use client';

import { useEffect, useState } from 'react';

import { fetchInvoicePayment } from '@/data/payment-requests/invoice-payment/api';
import type { InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { PaymentPageState } from '@/shared/payment-page-state';

import { InvoicePaymentForm } from './invoice-payment-form';

type Session = ReturnType<typeof readBetaSession>;

export function InvoicePaymentEdit({ requestId }: { requestId: string }) {
    const [record, setRecord] = useState<InvoicePaymentRequestRecord | null>(null);
    // undefined = session not read yet, null = no session found
    const [account, setAccount] = useState<Session | undefined>(undefined);
    const [checked, setChecked] = useState(false);
    const [fetchError, setFetchError] = useState('');

    useEffect(() => {
        let cancelled = false;

        // Session lives in the browser, so it is read after mount, inside a callback
        Promise.resolve().then(async () => {
            const session = readBetaSession();
            if (cancelled) return;
            setAccount(session);
            if (!session || session.role !== 'staff') {
                setChecked(true);
                return;
            }

            try {
                const item = await fetchInvoicePayment(requestId);
                if (item.staffId !== session.id) throw new Error('Only the original Staff requester can edit this Invoice Payment.');
                if (item.status !== 'RETURNED_TO_STAFF') throw new Error('This Invoice Payment is not currently returned for correction.');
                if (!cancelled) setRecord(item);
            } catch (caught: unknown) {
                if (!cancelled) setFetchError(caught instanceof Error ? caught.message : 'The Invoice Payment could not be loaded.');
            } finally {
                if (!cancelled) setChecked(true);
            }
        });

        return () => { cancelled = true; };
    }, [requestId]);

    // Derived: no setError needed for the sign-in message
    const signInError = account !== undefined && (!account || account.role !== 'staff')
        ? 'Sign in using the Staff account that submitted this request.'
        : '';
    const error = signInError || fetchError;

    const detailHref = `/beta/payment-records/invoice-payments/${encodeURIComponent(requestId)}`;
    if (!checked) return <PaymentPageState title="Loading Invoice Payment correction" copy="Reading the returned Invoice Payment…" backHref={detailHref} backLabel="Back to Invoice Payment details" />;
    if (!record) return <PaymentPageState title="Invoice Payment correction unavailable" copy={error} backHref={detailHref} backLabel="Back to Invoice Payment details" />;
    return <InvoicePaymentForm initialRecord={record} />;
}
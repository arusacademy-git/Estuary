'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { fetchPettyCashRequest } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { PettyCashForm } from '@/features/payment-request/components/petty-cash/staff/petty-cash-form';
import { PaymentPageState } from '@/shared/payment-page-state';

export default function NewPettyCashPage() {
  const query = useSearchParams();
  const amendmentId = query.get('amend');
  const [record, setRecord] = useState<PettyCashRecord | undefined>();
  const [loading, setLoading] = useState(Boolean(amendmentId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!amendmentId) return;
    fetchPettyCashRequest(amendmentId)
      .then((next) => {
        if (next.status !== 'RETURNED_TO_STAFF') throw new Error('Only a returned request can be amended.');
        setRecord(next);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'The request could not be loaded.'))
      .finally(() => setLoading(false));
  }, [amendmentId]);

  const detailHref = amendmentId ? `/beta/payment-records/petty-cash/${encodeURIComponent(amendmentId)}` : '/beta/payment-records/petty-cash';
  if (loading) return <PaymentPageState title="Loading Petty Cash correction" copy="Reading the returned Petty Cash request…" backHref={detailHref} backLabel="Back to Petty Cash details" />;
  if (error) return <PaymentPageState title="Petty Cash correction unavailable" copy={error} backHref={detailHref} backLabel="Back to Petty Cash details" />;
  return <PettyCashForm initialRecord={record} />;
}

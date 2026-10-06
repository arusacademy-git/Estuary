'use client';

import { useEffect, useState } from 'react';

import { fetchTravelAllowance } from '@/data/payment-requests/travel-allowance/api';
import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { PaymentPageState } from '@/shared/payment-page-state';

import { TravelAllowanceForm } from './travel-allowance-form';

export function TravelAllowanceEdit({ requestId }: { requestId: string }) {
  const [record, setRecord] = useState<TravelAllowanceRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const account = readBetaSession();
    if (!account || !['staff', 'manager'].includes(account.role)) {
      setError('Sign in using the account that submitted this request.');
      setChecked(true);
      return;
    }
    fetchTravelAllowance(requestId)
      .then((item) => {
        if (item.requesterId !== account.id) throw new Error('Only the original requester can edit this Travel Allowance.');
        if (item.status !== 'RETURNED_TO_STAFF') throw new Error('This Travel Allowance is not currently returned for correction.');
        setRecord(item);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'The Travel Allowance could not be loaded.'))
      .finally(() => setChecked(true));
  }, [requestId]);

  const detailHref = `/beta/payment-records/travel-allowances/${encodeURIComponent(requestId)}`;
  if (!checked) return <PaymentPageState title="Loading Travel Allowance correction" copy="Reading the returned Travel Allowance…" backHref={detailHref} backLabel="Back to Travel Allowance details" />;
  if (!record) return <PaymentPageState title="Travel Allowance correction unavailable" copy={error} backHref={detailHref} backLabel="Back to Travel Allowance details" />;
  return <TravelAllowanceForm initialRecord={record} mode={record.requesterRole} />;
}

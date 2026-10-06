'use client';

import { useEffect, useState } from 'react';

import { fetchClaimRequest } from '@/data/payment-requests/claims/api';
import type { ClaimRecord } from '@/domain/payment-requests/claims/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { PaymentPageState } from '@/shared/payment-page-state';

import { ClaimForm } from './claim-form';

export function ClaimDraftEditor({ requestId }: { requestId: string }) {
  const [record, setRecord] = useState<ClaimRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const account = readBetaSession();
    fetchClaimRequest(requestId)
      .then((value) => {
        if (!account || value.requesterId !== account.id) throw new Error('Only the claimant who created this request can edit it.');
        if (!['DRAFT', 'RETURNED_TO_CLAIMANT'].includes(value.status)) throw new Error('Only a Draft or returned Claim can be opened in the Claim form.');
        setRecord(value);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'The Claim could not be loaded.'))
      .finally(() => setChecked(true));
  }, [requestId]);

  const detailHref = `/beta/payment-records/claims/${encodeURIComponent(requestId)}`;
  if (!checked) return <PaymentPageState title="Loading Claim correction" copy="Reading the saved Claim…" backHref={detailHref} backLabel="Back to Claim details" />;
  if (!record) return <PaymentPageState title="Claim correction unavailable" copy={error} backHref={detailHref} backLabel="Back to Claim details" />;
  return <ClaimForm initialRecord={record} />;
}

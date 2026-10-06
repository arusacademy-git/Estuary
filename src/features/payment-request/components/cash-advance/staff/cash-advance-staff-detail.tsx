'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { fetchCashAdvance } from '@/data/payment-requests/cash-advance/cash-advance-api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { PaymentPageState } from '@/shared/payment-page-state';

import { CashAdvanceDetail } from '../cash-advance-detail';
import { CashAdvanceForm } from './cash-advance-form';
import { CashAdvanceReconciliation } from './reconciliation/cash-advance-reconciliation';

type StaffRecordView = 'view' | 'reconciliation';

export function CashAdvanceStaffDetail({
  id,
  initialView = 'view',
}: {
  id: string;
  initialView?: StaffRecordView;
}) {
  const searchParams = useSearchParams();
  const [record, setRecord] = useState<CashAdvanceRecord | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCashAdvance(id)
      .then(setRecord)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Cash Advance could not be loaded.'));
  }, [id]);

  if (error) return <PaymentPageState title="Cash Advance unavailable" copy={error} backHref={`/beta/payment-records/cash-advances/${encodeURIComponent(id)}`} backLabel="Back to Cash Advance details" />;
  if (!record) return <PaymentPageState title="Loading Cash Advance correction" copy="Reading the returned Cash Advance…" backHref={`/beta/payment-records/cash-advances/${encodeURIComponent(id)}`} backLabel="Back to Cash Advance details" />;
  if (record.status === 'RETURNED_TO_STAFF' && record.returnedStage === 'REQUEST') {
    return <CashAdvanceForm initialRecord={record} />;
  }

  const needsReconciliation = record.status === 'PENDING_RECONCILIATION' || (
    record.status === 'RETURNED_TO_STAFF' && record.returnedStage === 'RECONCILIATION'
  );
  const requestedView = searchParams.get('view') === 'reconciliation' ? 'reconciliation' : initialView;

  if (requestedView === 'reconciliation' && needsReconciliation) {
    return <CashAdvanceReconciliation record={record} />;
  }

  return <CashAdvanceDetail record={record} />;
}

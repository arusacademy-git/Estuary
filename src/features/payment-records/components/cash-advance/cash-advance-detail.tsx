'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { fetchCashAdvance } from '@/data/payment-requests/cash-advance/cash-advance-api';
import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { CashAdvanceDetail as CashAdvanceReceipt } from '@/features/payment-request/components/cash-advance/cash-advance-detail';
import receiptStyles from '@/features/payment-request/components/cash-advance/cash-advance.module.css';
import { PaymentRecordActionCard } from '../shared/payment-record-action-card';

import styles from './cash-advance-records.module.css';

function canView(record: CashAdvanceRecord, account: BetaAccount) {
  if (record.requesterId === account.id) return true;
  if (account.role === 'staff') return record.requesterId === account.id;
  if (account.role === 'manager') return record.managerApproverId === account.id;
  if (account.role === 'director') return record.directorApproverId === account.id;
  return account.role === 'finance';
}

export function CashAdvancePaymentRecordDetail({ requestId }: { requestId: string }) {
  const [record, setRecord] = useState<CashAdvanceRecord | null>(null);
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [error, setError] = useState(() => account ? '' : 'Sign in to view this Cash Advance record.');

  useEffect(() => {
    if (!account) return;
    let cancelled = false;

    fetchCashAdvance(requestId)
      .then((result) => {
        if (!canView(result, account)) throw new Error('This Cash Advance is not available to your account.');
        if (!cancelled) setRecord(result);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Cash Advance could not be loaded.');
      });

    return () => { cancelled = true; };
  }, [account, requestId]);

  if (error) return <main className={styles.statePage}><h1>Cash Advance unavailable</h1><p>{error}</p><Link href="/beta/payment-records/cash-advances">Back to Cash Advances</Link></main>;
  if (!account) return <main className={styles.statePage}><h1>Sign in required</h1><p>Sign in to view this Cash Advance record.</p></main>;
  if (!record) return <main className={styles.statePage}><h1>Loading Cash Advance</h1><p>Reading the payment record…</p></main>;

  const needsReconciliation = record.status === 'PENDING_RECONCILIATION' || (
    record.status === 'RETURNED_TO_STAFF' && record.returnedStage === 'RECONCILIATION'
  );
  const needsRequestCorrection = record.status === 'RETURNED_TO_STAFF' && record.returnedStage === 'REQUEST';
  const needsRequesterAction = account?.id === record.requesterId && (
    needsReconciliation || (account.role === 'staff' && needsRequestCorrection)
  );
  const requesterActionHref = `/beta/payment-requests/cash-advance/${encodeURIComponent(record.requestNumber)}${needsReconciliation ? '?view=reconciliation' : ''}`;
  const actionDescription = needsReconciliation
    ? 'Complete the Cash Spent Summary and submit the reconciliation to Finance.'
    : 'Review the return remarks, correct the required information and resubmit.';
  const actionLabel = needsReconciliation
    ? record.status === 'RETURNED_TO_STAFF' ? 'Continue reconciliation →' : 'Start reconciliation →'
    : 'Start corrections →';
  const actions = <>
    <PaymentRecordActionCard account={account} directorApproverId={record.directorApproverId} managerApproverId={record.managerApproverId} paymentType="CA" reference={record.requestNumber} requestId={record.id} status={record.status} />
    {needsRequesterAction && (record.status === 'RETURNED_TO_STAFF'
      ? <Link className={receiptStyles.returnCorrectionButton} href={requesterActionHref}>{actionLabel}</Link>
      : <section className={`${receiptStyles.sideCard} ${receiptStyles.reconciliationActionCard}`}><h3>Action required</h3><p className={receiptStyles.muted}>{actionDescription}</p><Link className={receiptStyles.actionLink} href={requesterActionHref}>{actionLabel}</Link></section>)}
  </>;

  return <CashAdvanceReceipt actions={actions} backHref="/beta/payment-records/cash-advances" record={record} />;
}

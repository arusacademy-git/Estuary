'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  readBetaSession,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';
import { usePaymentVouchers } from '@/features/payment-voucher/hooks/use-payment-vouchers';
import { StaffBulkSignatureFollowUp } from '@/features/payment-voucher/components/staff/staff-bulk-signature-follow-up';
import { PaymentPageState } from '@/shared/payment-page-state';

export default function StaffBulkSignatureFollowUpPage() {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const { records, isLoading } = usePaymentVouchers();

  if (isLoading) {
    return (
      <PaymentPageState
        backHref="/beta/payment-vouchers"
        backLabel="Back to Payment Vouchers"
        copy="Preparing your Payment Vouchers awaiting recipient signatures…"
        title="Loading signature follow-ups"
      />
    );
  }

  if (!account || account.role !== 'staff') {
    return (
      <main style={{ padding: 32 }}>
        <h1>Staff access required</h1>
        <p>Only the original Staff requester can prepare recipient signature follow-ups.</p>
        <Link href="/beta/dashboard">Back to dashboard</Link>
      </main>
    );
  }

  return <StaffBulkSignatureFollowUp staff={account} vouchers={records} />;
}

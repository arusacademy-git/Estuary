'use client';

import Link from 'next/link';
import { useState } from 'react';

import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { usePaymentVouchers } from '@/features/payment-voucher/hooks/use-payment-vouchers';
import { DirectorBulkApproval } from '@/features/payment-voucher/components/director/director-bulk-approval';
import { PaymentPageState } from '@/shared/payment-page-state';

export default function DirectorBulkApprovalPage() {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const { records, isLoading } = usePaymentVouchers();

  if (isLoading) {
    return <PaymentPageState title="Loading bulk approvals" copy="Preparing your assigned Payment Vouchers and saved review progress…" backHref="/beta/approvals" backLabel="Back to approvals" />;
  }

  if (!account || account.role !== 'director') {
    return <main style={{ padding: 32 }}><h1>Director access required</h1><p>Only Directors can use bulk Payment Voucher approval.</p><Link href="/beta/dashboard">Back to dashboard</Link></main>;
  }

  return <DirectorBulkApproval director={account} vouchers={records} />;
}

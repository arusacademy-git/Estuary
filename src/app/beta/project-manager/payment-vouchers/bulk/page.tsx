'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { usePaymentVouchers } from '@/features/payment-voucher/hooks/use-payment-vouchers';
import { ManagerBulkPreview } from '@/features/payment-voucher/components/project_manager/manager-bulk-preview';
import { PaymentPageState } from '@/shared/payment-page-state';

export default function ManagerBulkPaymentVoucherPage() {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const { records, isLoading } = usePaymentVouchers();

  useEffect(() => {
    setAccount(readBetaSession());
    setChecked(true);
  }, []);

  if (!checked || isLoading) return <PaymentPageState title="Loading bulk previews" copy="Preparing your assigned Payment Vouchers and review progress…" backHref="/beta/project-manager/payment-vouchers" backLabel="Back to Payment Vouchers" />;

  if (!account || account.role !== 'manager') {
    return <main style={{ padding: 32 }}><h1>Manager access required</h1><p>Only Managers can use bulk Payment Voucher preview.</p><Link href="/beta/dashboard">Back to dashboard</Link></main>;
  }

  return <ManagerBulkPreview manager={account} vouchers={records} />;
}

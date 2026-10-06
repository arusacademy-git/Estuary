'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { usePaymentVouchers } from '@/features/payment-voucher/hooks/use-payment-vouchers';
import { FinanceBulkProcessing } from '@/features/payment-voucher/components/finance/finance-bulk-processing';
import { PaymentPageState } from '@/shared/payment-page-state';

export default function FinanceBulkPaymentVoucherPage() {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const { records, isLoading } = usePaymentVouchers();

  useEffect(() => {
    setAccount(readBetaSession());
    setChecked(true);
  }, []);

  if (!checked || isLoading) return <PaymentPageState title="Loading bulk processing" copy="Preparing the Director-approved Payment Vouchers for Finance…" backHref="/beta/finance" backLabel="Back to Finance" />;

  if (!account || account.role !== 'finance') {
    return <main style={{ padding: 32 }}><h1>Finance access required</h1><p>Only Finance can use bulk Payment Voucher processing.</p><Link href="/beta/dashboard">Back to dashboard</Link></main>;
  }

  return <FinanceBulkProcessing finance={account} vouchers={records} />;
}

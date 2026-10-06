'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  fetchPaymentVouchers,
} from '@/data/payment-vouchers/payment-voucher-api';

import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';

export function usePaymentVouchers() {
  const [records, setRecords] = useState<PaymentVoucherRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      setRecords(await fetchPaymentVouchers());
    } catch (loadError) {
      setRecords([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Payment Vouchers could not be loaded.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(async () => {
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    records,
    isLoading,
    error,
    refresh,
    reset,
  };
}

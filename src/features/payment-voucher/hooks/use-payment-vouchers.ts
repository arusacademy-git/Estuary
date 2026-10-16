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

const PAYMENT_VOUCHER_CACHE_TTL_MS = 60_000;

let cachedRecords: PaymentVoucherRecord[] | null = null;
let cachedAt = 0;
let pendingRequest: Promise<PaymentVoucherRecord[]> | null = null;

function readFreshCache() {
  if (
    !cachedRecords ||
    Date.now() - cachedAt > PAYMENT_VOUCHER_CACHE_TTL_MS
  ) {
    return null;
  }

  return cachedRecords;
}

async function loadPaymentVouchers(force = false) {
  const freshRecords = readFreshCache();

  if (!force && freshRecords) {
    return freshRecords;
  }

  if (!force && pendingRequest) {
    return pendingRequest;
  }

  const request = fetchPaymentVouchers()
    .then((records) => {
      cachedRecords = records;
      cachedAt = Date.now();
      return records;
    })
    .finally(() => {
      if (pendingRequest === request) {
        pendingRequest = null;
      }
    });

  pendingRequest = request;
  return request;
}

export function usePaymentVouchers() {
  const initialRecords = readFreshCache();
  const [records, setRecords] = useState<PaymentVoucherRecord[]>(
    initialRecords ?? [],
  );
  const [isLoading, setIsLoading] = useState(!initialRecords);
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    setIsLoading(true);
    setError('');

    try {
      setRecords(await loadPaymentVouchers(force));
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

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const reset = useCallback(async () => {
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    records,
    isLoading,
    error,
    refresh,
    reset,
  };
}

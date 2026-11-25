'use client';

import { useEffect, useState } from 'react';
import { PAYMENT_VOUCHER_ACCOUNT_OPTIONS } from '@/shared/constants/payment-options';
import { ADMIN_SETTINGS_EVENT, readAdminSettings } from './admin-settings';

export function useAdminAccountingOptions() {
  const defaults = PAYMENT_VOUCHER_ACCOUNT_OPTIONS;
  const [options, setOptions] = useState(defaults);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      setOptions(readAdminSettings().accountingCodes.filter((item) => item.active).map((item) => ({ value: item.code, label: `${item.code} – ${item.name}` })));
    };
    queueMicrotask(refresh);
    window.addEventListener(ADMIN_SETTINGS_EVENT, refresh);
    return () => { active = false; window.removeEventListener(ADMIN_SETTINGS_EVENT, refresh); };
  }, [defaults]);
  return options;
}

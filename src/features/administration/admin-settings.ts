import { DIVISION_OPTIONS, PAYMENT_VOUCHER_ACCOUNT_OPTIONS } from '@/shared/constants/payment-options';
import { useEffect, useState } from 'react';
import { betaAccounts } from '@/lib/auth/beta-accounts';

export const ADMIN_SETTINGS_KEY = 'estuary-beta-admin-settings-v1';
export const ADMIN_SETTINGS_EVENT = 'estuary:admin-settings-changed';

export type AdminProgramme = { id: string; code: string; name: string; managerId: string; active: boolean };
export type AdminAccountingCode = { id: string; code: string; name: string; description: string; active: boolean };
export type AdminEmployee = { id: string; name: string; email: string; role: 'staff' | 'manager' | 'director' | 'finance'; programmeId: string; joinedAt: string; active: boolean };
export type AdminClaimPolicy = { medicalAnnualLimit: number; pdAnnualLimit: number; prorateByEmploymentDate: boolean };
export type AdminSettings = { programmes: AdminProgramme[]; accountingCodes: AdminAccountingCode[]; employees: AdminEmployee[]; claimPolicy: AdminClaimPolicy };

export function canAccessAdministration(role: string | undefined) {
  // Replace this temporary role fallback with ADMIN_ACCESS when Admin and IT identities are introduced.
  return role === 'director';
}

export function createDefaultAdminSettings(): AdminSettings {
  return {
    programmes: DIVISION_OPTIONS.map((code) => ({ id: `programme-${code}`, code, name: code, managerId: '', active: true })),
    accountingCodes: PAYMENT_VOUCHER_ACCOUNT_OPTIONS.map((option) => ({
      id: `account-${option.value}`,
      code: option.value,
      name: option.label.replace(`${option.value} – `, ''),
      description: '',
      active: true,
    })),
    employees: betaAccounts.map((account) => ({ id: account.id, name: account.name, email: account.email, role: account.role, programmeId: '', joinedAt: '2026-01-01', active: true })),
    claimPolicy: { medicalAnnualLimit: 500, pdAnnualLimit: 500, prorateByEmploymentDate: true },
  };
}

export function readAdminSettings(): AdminSettings {
  const defaults = createDefaultAdminSettings();
  if (typeof window === 'undefined') return defaults;
  try {
    const saved = window.localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Partial<AdminSettings>;
    return {
      programmes: Array.isArray(parsed.programmes) ? parsed.programmes : defaults.programmes,
      accountingCodes: Array.isArray(parsed.accountingCodes) ? parsed.accountingCodes : defaults.accountingCodes,
      employees: Array.isArray(parsed.employees) ? parsed.employees : defaults.employees,
      claimPolicy: parsed.claimPolicy && typeof parsed.claimPolicy === 'object' ? { ...defaults.claimPolicy, ...parsed.claimPolicy } : defaults.claimPolicy,
    };
  } catch {
    return defaults;
  }
}

export function saveAdminSettings(settings: AdminSettings) {
  window.localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(ADMIN_SETTINGS_EVENT));
}

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

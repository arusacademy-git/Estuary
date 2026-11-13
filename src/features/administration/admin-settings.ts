import { DIVISION_OPTIONS, PAYMENT_VOUCHER_ACCOUNT_OPTIONS } from '@/shared/constants/payment-options';
import { useEffect, useState } from 'react';
import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';
import {
  INTERNET_COMMUTE_LIMIT,
  MEDICAL_ANNUAL_LIMIT,
  PD_LIMIT,
  TECH_EXTENDED_LIMIT,
  TECH_EXTENDED_LOCK_YEARS,
  TECH_STANDARD_LIMIT,
} from '@/domain/payment-requests/claims/policy';

export const ADMIN_SETTINGS_KEY = 'estuary-beta-admin-settings-v1';
export const ADMIN_SETTINGS_EVENT = 'estuary:admin-settings-changed';

export type AdminProgramme = { id: string; code: string; name: string; managerId: string; active: boolean };
export type AdminAccountingCode = { id: string; code: string; name: string; description: string; active: boolean };
export type AdminEmployee = { id: string; name: string; email: string; role: 'staff' | 'director' | 'finance'; programmeId: string; joinedAt: string; active: boolean };
export type AdminClaimPolicy = {
  medicalAnnualLimit: number;
  pdAnnualLimit: number;
  prorateByEmploymentDate: boolean;
  internetCommuteLimit: number;
  techStandardLimit: number;
  techExtendedLimit: number;
  techExtendedLockYears: number;
};
export type AdminSettings = { programmes: AdminProgramme[]; accountingCodes: AdminAccountingCode[]; employees: AdminEmployee[]; claimPolicy: AdminClaimPolicy };

export function canAccessAdministration(account: BetaAccount | null | undefined) {
  return account?.isAdministrator === true;
}

export function createDefaultAdminSettings(): AdminSettings {
  return {
    programmes: DIVISION_OPTIONS.map((code) => ({ id: `programme-${code}`, code, name: code, managerId: 'nadia-hassan', active: true })),
    accountingCodes: PAYMENT_VOUCHER_ACCOUNT_OPTIONS.map((option) => ({
      id: `account-${option.value}`,
      code: option.value,
      name: option.label.replace(`${option.value} – `, ''),
      description: '',
      active: true,
    })),
    employees: betaAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role === 'manager' ? 'staff' as const : account.role,
      programmeId: '',
      joinedAt: '2026-01-01',
      active: true,
    })),
    claimPolicy: {
      medicalAnnualLimit: MEDICAL_ANNUAL_LIMIT,
      pdAnnualLimit: PD_LIMIT,
      prorateByEmploymentDate: true,
      internetCommuteLimit: INTERNET_COMMUTE_LIMIT,
      techStandardLimit: TECH_STANDARD_LIMIT,
      techExtendedLimit: TECH_EXTENDED_LIMIT,
      techExtendedLockYears: TECH_EXTENDED_LOCK_YEARS,
    },
  };
}

export function readAdminSettings(): AdminSettings {
  const defaults = createDefaultAdminSettings();
  if (typeof window === 'undefined') return defaults;
  try {
    const saved = window.localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Omit<Partial<AdminSettings>, 'employees'> & {
      employees?: Array<Omit<AdminEmployee, 'role'> & { role: AdminEmployee['role'] | 'manager' }>;
    };
    const employees: AdminEmployee[] = Array.isArray(parsed.employees)
      ? parsed.employees.map((employee) => ({
          ...employee,
          role: employee.role === 'manager' ? 'staff' : employee.role,
        }))
      : defaults.employees;
    return {
      programmes: Array.isArray(parsed.programmes) ? parsed.programmes : defaults.programmes,
      accountingCodes: Array.isArray(parsed.accountingCodes) ? parsed.accountingCodes : defaults.accountingCodes,
      employees,
      claimPolicy: parsed.claimPolicy && typeof parsed.claimPolicy === 'object' ? { ...defaults.claimPolicy, ...parsed.claimPolicy } : defaults.claimPolicy,
    };
  } catch {
    return defaults;
  }
}

export function managedProgrammesFor(accountId: string, settings = readAdminSettings()) {
  return settings.programmes.filter(
    (programme) => programme.active && programme.managerId === accountId,
  );
}

export function travelProjectCodesFor(
  account: BetaAccount | null | undefined,
  settings = readAdminSettings(),
) {
  if (!account) return [];
  const programmes = account.role === 'director'
    ? settings.programmes.filter((programme) => programme.active)
    : managedProgrammesFor(account.id, settings);
  return programmes.map((programme) => programme.code);
}

export function isProjectManagerAccount(
  account: BetaAccount | null | undefined,
  settings = readAdminSettings(),
) {
  return Boolean(account && managedProgrammesFor(account.id, settings).length);
}

export function projectManagerFor(
  projectCodeOrName: string,
  settings = readAdminSettings(),
) {
  const key = projectCodeOrName.trim().toLocaleLowerCase();
  const programme = settings.programmes.find(
    (item) => item.active &&
      (item.code.trim().toLocaleLowerCase() === key ||
        item.name.trim().toLocaleLowerCase() === key),
  );
  return programme?.managerId || undefined;
}

export function activeProjectManagerAccounts(settings = readAdminSettings()) {
  const ids = new Set(
    settings.programmes
      .filter((programme) => programme.active && programme.managerId)
      .map((programme) => programme.managerId),
  );
  return betaAccounts.filter((account) => ids.has(account.id));
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

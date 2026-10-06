export type BetaRole = 'staff' | 'manager' | 'director' | 'finance';

export type BetaAccount = {
  id: string;
  name: string;
  email: string;
  position: string;
  department: string;
  role: BetaRole;
};

export const BETA_SESSION_KEY = 'estuary-beta-account';

export const betaAccounts: BetaAccount[] = [
  {
    id: 'afiq-rahman',
    name: 'Afiq Rahman',
    email: 'afiq@arus.example',
    position: 'Programme Staff',
    department: 'Programme Staff',
    role: 'staff',
  },
  {
    id: 'siti-farhana',
    name: 'Siti Farhana',
    email: 'farhana@arus.example',
    position: 'Finance Administrator',
    department: 'Finance',
    role: 'finance',
  },
  {
    id: 'nadia-hassan',
    name: 'Nadia Hassan',
    email: 'nadia@arus.example',
    position: 'Operations Manager',
    department: 'Operations',
    role: 'manager',
  },
  {
    id: 'amir-iskandar',
    name: 'Amir Iskandar',
    email: 'amir@arus.example',
    position: 'School Director',
    department: 'School Management',
    role: 'director',
  },
  {
    id: 'farid-hakim',
    name: 'Farid Hakim',
    email: 'farid@arus.example',
    position: 'Group Director',
    department: 'Group Management',
    role: 'director',
  },
  {
    id: 'maryam-iskandar',
    name: 'Maryam Iskandar',
    email: 'maryam@arus.example',
    position: 'Director',
    department: 'Management',
    role: 'director',
  },
  {
    id: 'daniel-lee',
    name: 'Daniel Lee',
    email: 'daniel@arus.example',
    position: 'Director',
    department: 'Management',
    role: 'director',
  },
];

export function getBetaAccount(accountId: string | null) {
  if (!accountId) {
    return null;
  }

  return betaAccounts.find((account) => account.id === accountId) ?? null;
}

export function readBetaSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const accountId = window.localStorage.getItem(BETA_SESSION_KEY);

  return getBetaAccount(accountId);
}
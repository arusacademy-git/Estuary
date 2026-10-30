const BANK_ACCOUNT_LENGTHS: Record<string, readonly number[]> = {
  AFFIN: [12],
  ALLIANCE: [15],
  AMBANK: [13],
  ALRAJHI: [15, 16],
  'BANK ISLAM': [14],
  MUAMALAT: [14],
  'BANK RAKYAT': [12],
  BSN: [16],
  CIMB: [10, 14],
  'HONG LEONG': [11, 13],
  HSBC: [12, 13, 14, 15, 16, 17],
  MAYBANK: [12],
  OCBC: [9, 10, 11, 12, 13, 14, 15, 16, 17],
  'PUBLIC BANK': [10],
  RHB: [14],
  UOB: [7, 8, 9, 10, 11, 12, 13, 14, 17],
  AGRO: [16],
};

export function normalizeNumericIdentifier(value: string) {
  return value.replace(/[\s-]/g, '');
}

export function identificationNumberError(value: string) {
  const digits = normalizeNumericIdentifier(value);
  if (!/^\d+$/.test(digits)) return 'Identification number must contain digits only.';
  if (digits.length !== 12) return 'Identification number must contain exactly 12 digits.';
  return '';
}

export function bankAccountNumberError(bankName: string, value: string) {
  const digits = normalizeNumericIdentifier(value);
  if (!/^\d+$/.test(digits)) return 'Bank account number must contain digits only.';

  const allowed = BANK_ACCOUNT_LENGTHS[bankName.trim().toUpperCase()];
  if (!allowed) {
    return digits.length >= 7 && digits.length <= 17
      ? ''
      : 'Bank account number must contain between 7 and 17 digits.';
  }
  if (allowed.includes(digits.length)) return '';

  const lengths = allowed.length === 1
    ? `${allowed[0]} digits`
    : `${allowed.slice(0, -1).join(', ')} or ${allowed.at(-1)} digits`;
  return `${bankName} account number must contain ${lengths}.`;
}

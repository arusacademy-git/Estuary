export type PaymentSelectOption = {
  value: string;
  label: string;
};

export const DIVISION_OPTIONS = [
  'N-AOC-UNDP',
  'N-MARCOMMS-ARUS',
  'O-BMOFFICE-ARUS',
  'O-BD-ARUS',
  'O-HR-ARUS',
  'O-KLOFFICE-ARUS',
  'O-L&D-ARUS',
  'O-MAKERSPACE-ARUS',
  'O-MANAGEMENT-ARUS',
  'O-WELFARE-ARUS',
  'P-BJCK-ARUS',
  'P-MAKERPROG-ARUS',
  'P-PWCDTT-UNICEF',
  'V-BAITBAIK-DAP',
  'V-BAITBAIK-SERI',
  'V-BESMART-CIMB',
  'V-FFL-FWDT',
  'V-FFLU-FWDI',
  'V-FS4A-GOOGLE',
  'V-FS4A-MISC',
  'V-FS4A-UNICEF',
  'V-IDENTIFAKE-USEMB',
  'V-KARISMA-YH',
  'V-MAKMUR-JICA',
  'V-ME4A-USEMB',
  'V-PJCC-MBPJ',
  'V-SEL-MISC',
  'V-STEAM-MISC',
  'V-VIA-TEF',
] as const;

export const DIVISION_LABELS = Object.fromEntries(
  DIVISION_OPTIONS.map((division) => [division, division]),
) as Record<string, string>;

export const DIVISION_SELECT_OPTIONS: PaymentSelectOption[] =
  DIVISION_OPTIONS.map((division) => ({
    value: division,
    label: division,
  }));

export const PAYMENT_METHOD_OPTIONS = [
  'Bank Transfer',
  'Cash',
  'Cheque',
] as const;

export const PAYMENT_METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((method) => [method, method]),
) as Record<string, string>;

export const PAYMENT_METHOD_SELECT_OPTIONS: PaymentSelectOption[] =
  PAYMENT_METHOD_OPTIONS.map((method) => ({
    value: method,
    label: method,
  }));

export const BANK_NAME_OPTIONS = [
  'Affin Bank',
  'Alliance Bank',
  'AmBank',
  'Bank Islam',
  'Bank Muamalat',
  'Bank Rakyat',
  'BSN',
  'CIMB',
  'Citibank',
  'Hong Leong Bank',
  'HSBC',
  'Maybank',
  'OCBC',
  'Public Bank',
  'RHB',
  'Standard Chartered Bank',
  'UOB',
  'Agro Bank',
] as const;

export const BANK_NAME_SELECT_OPTIONS: PaymentSelectOption[] =
  BANK_NAME_OPTIONS.map((bankName) => ({
    value: bankName,
    label: bankName,
  }));

export const PAYMENT_VOUCHER_ACCOUNT_OPTIONS: PaymentSelectOption[] = [
  {
    value: '600-001',
    label: '600-001 – PROJECT ACCOMODATION',
  },
  {
    value: '600-002',
    label: '600-002 – PROJECT TRANSPORTATION',
  },
  {
    value: '600-002A',
    label: '600-002A – RENTAL OF MOTOR VEHICLE',
  },
  {
    value: '600-002B',
    label: '600-002B – PROJECT MILEAGE CLAIM',
  },
  {
    value: '600-002C',
    label: '600-002C – PROJECT TOLL & PARKING',
  },
  {
    value: '600-003',
    label: "600-003 – FACILITATOR AND TRAINER'S FEE",
  },
  {
    value: '600-004',
    label: '600-004 – PROJECT FOOD & BEVERAGE',
  },
  {
    value: '600-005',
    label: '600-005 – PROJECT CONSUMABLES',
  },
  {
    value: '600-006',
    label: '600-006 – PROJECT PR & MARKETING',
  },
  {
    value: '600-008',
    label: '600-008 – PARTICIPANT ALLOWANCE',
  },
  {
    value: '600-009',
    label: '600-009 – PROJECT DEVELOPMENT SOFTWARE',
  },
  {
    value: '600-010',
    label: '600-010 – PROJECT PRINTING & STATIONERY',
  },
  {
    value: '600-012',
    label: '600-012 – PROJECT VENUE/SPACE RENTAL',
  },
  {
    value: '901-000',
    label: '901-000 – ADVERTISEMENT',
  },
  {
    value: '906-000',
    label: '906-000 – STAFF BENEFITS',
  },
  {
    value: '910-000',
    label: '910-000 – OPERATING EXPENSES',
  },
  {
    value: '916-000',
    label: '916-000 – TOLL & PARKING',
  },
  {
    value: '917-000',
    label: '917-000 – TRAVEL & ACCOMODATION',
  },
  {
    value: '920-000',
    label: '920-000 – PRINTING & STATIONERIES',
  },
  {
    value: '921-001',
    label: '921-001 – STAFF GIFT',
  },
  {
    value: '922-000',
    label: '922-000 – OFFICE REFRESHMENT',
  },
  {
    value: '924-000',
    label: '924-000 – REPAIRS AND MAINTENANCE',
  },
  {
    value: '929-000',
    label: '929-000 – UPKEEP OF OFFICE',
  },
  {
    value: '929-001',
    label: '929-001 – UPKEEP OF AIRCOND',
  },
  {
    value: '932-000',
    label: '932-000 – POSTAGE & COURIER',
  },
  {
    value: '933-000',
    label: '933-000 – ENTERTAINMENT',
  },
  {
    value: '934-000',
    label: '934-000 – SUBSCRIPTIONS',
  },
  {
    value: '935-000',
    label: '935-000 – STAMPING',
  },
  {
    value: '937-000',
    label: '937-000 – FOOD / REFRESHMENT',
  },
  {
    value: '940-000',
    label: '940-000 – SEMINAR/TRAINING - STAFF',
  },
  {
    value: '941-000',
    label: '941-000 – REGISTRATION FEES',
  },
  {
    value: '946-000',
    label: '946-000 – OFFICE EXPENSES',
  },
  {
    value: '949-001',
    label: '949-001 – PROFESSIONAL FEES',
  },
];

export const PAYMENT_VOUCHER_ACCOUNT_CODES: string[] =
  PAYMENT_VOUCHER_ACCOUNT_OPTIONS.map((option) => option.value);

export const DEFAULT_PAYMENT_VOUCHER_ACCOUNT_CODE =
  PAYMENT_VOUCHER_ACCOUNT_OPTIONS[0].value;

export function resolvePaymentVoucherAccountCode(
  value: string,
) {
  const normalizedValue = value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  if (!normalizedValue) {
    return '';
  }

  const matchingOption =
    PAYMENT_VOUCHER_ACCOUNT_OPTIONS.find((option) => {
      return (
        option.value.toLowerCase() === normalizedValue ||
        option.label.toLowerCase() === normalizedValue
      );
    });

  return matchingOption?.value ?? '';
}

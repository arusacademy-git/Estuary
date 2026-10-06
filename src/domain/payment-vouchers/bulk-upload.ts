import {
  betaAccounts,
} from '@/lib/auth/beta-accounts';

import type {
  CreatePaymentVoucherInput,
} from './types';

export type BulkMalaysianValue =
  | ''
  | 'yes'
  | 'no';

export type BulkPaymentVoucherRow = {
  /*
   * Temporary browser-only identifier.
   * This is not the official PV number.
   */
  rowId: string;

  pvDate: string;
  division: string;

  directorEmail: string;
  projectManagerEmail: string;

  recipientName: string;
  recipientEmail: string;
  recipientIc: string;
  recipientIsMalaysian:
    BulkMalaysianValue;

  paymentMethod: string;
  bankName: string;
  bankAccountNumber: string;

  purpose: string;

  supportingDocumentNames: string[];

  accountCode: string;
  lineDescription: string;

  quantity: string;
  unitAmount: string;
  taxAmount: string;
};

export type BulkPaymentVoucherField =
  keyof Omit<
    BulkPaymentVoucherRow,
    | 'rowId'
    | 'supportingDocumentNames'
  >;

export type BulkValidationError = {
  field: BulkPaymentVoucherField;
  message: string;
};

export type BulkRowValidationResult = {
  rowId: string;
  isValid: boolean;
  amount: number;
  errors: BulkValidationError[];
};

export const BULK_PAYMENT_VOUCHER_CSV_HEADERS =
  [
    'PV Date',
    'Division',
    'Director Email',
    'Project Manager Email',
    'Recipient Name',
    'Recipient Email',
    'Recipient IC Number',
    'Recipient Is Malaysian',
    'Payment Method',
    'Bank Name',
    'Bank Account Number',
    'Purpose of Payment',
    'Account Code',
    'Line Description',
    'Quantity',
    'Unit Amount',
    'Tax Amount',
  ] as const;

export type BulkPaymentVoucherCsvHeader =
  (typeof BULK_PAYMENT_VOUCHER_CSV_HEADERS)[number];

export const BULK_CSV_HEADER_TO_FIELD: Record<
  BulkPaymentVoucherCsvHeader,
  BulkPaymentVoucherField
> = {
  'PV Date': 'pvDate',
  Division: 'division',

  'Director Email':
    'directorEmail',

  'Project Manager Email':
    'projectManagerEmail',

  'Recipient Name':
    'recipientName',

  'Recipient Email':
    'recipientEmail',

  'Recipient IC Number':
    'recipientIc',

  'Recipient Is Malaysian':
    'recipientIsMalaysian',

  'Payment Method':
    'paymentMethod',

  'Bank Name': 'bankName',

  'Bank Account Number':
    'bankAccountNumber',

  'Purpose of Payment':
    'purpose',

  'Account Code':
    'accountCode',

  'Line Description':
    'lineDescription',

  Quantity: 'quantity',

  'Unit Amount':
    'unitAmount',

  'Tax Amount':
    'taxAmount',
};

function createRowId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID();
  }

  return [
    'bulk-row',
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2),
  ].join('-');
}

export function createEmptyBulkPaymentVoucherRow():
  BulkPaymentVoucherRow {
  return {
    rowId: createRowId(),

    pvDate: '',
    division: '',

    directorEmail: '',
    projectManagerEmail: '',

    recipientName: '',
    recipientEmail: '',
    recipientIc: '',
    recipientIsMalaysian: 'yes',

    paymentMethod: 'Bank Transfer',
    bankName: '',
    bankAccountNumber: '',

    purpose: '',

    supportingDocumentNames:[],

    accountCode: '5100',
    lineDescription: '',

    quantity: '1',
    unitAmount: '',
    taxAmount: '0',
  };
}

function normalizeText(
  value: unknown,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value).trim();
}

function normalizeMalaysianValue(
  value: unknown,
): BulkMalaysianValue {
  const normalizedValue =
    normalizeText(value).toLowerCase();

  if (
    normalizedValue === 'yes' ||
    normalizedValue === 'y' ||
    normalizedValue === 'true' ||
    normalizedValue === 'malaysian'
  ) {
    return 'yes';
  }

  if (
    normalizedValue === 'no' ||
    normalizedValue === 'n' ||
    normalizedValue === 'false' ||
    normalizedValue ===
      'non-malaysian'
  ) {
    return 'no';
  }

  return '';
}

export function normalizeBulkPaymentVoucherRow(
  values: Partial<
    Record<
      BulkPaymentVoucherField,
      unknown
    >
  >,
): BulkPaymentVoucherRow {
  return {
    rowId: createRowId(),

    pvDate:
      normalizeText(values.pvDate),

    division:
      normalizeText(values.division),

    directorEmail:
      normalizeText(
        values.directorEmail,
      ).toLowerCase(),

    projectManagerEmail:
      normalizeText(
        values.projectManagerEmail,
      ).toLowerCase(),

    recipientName:
      normalizeText(
        values.recipientName,
      ),

    recipientEmail:
      normalizeText(
        values.recipientEmail,
      ).toLowerCase(),

    recipientIc:
      normalizeText(
        values.recipientIc,
      ),

    recipientIsMalaysian:
      normalizeMalaysianValue(
        values.recipientIsMalaysian,
      ),

    paymentMethod:
      normalizeText(
        values.paymentMethod,
      ),

    bankName:
      normalizeText(values.bankName),

    bankAccountNumber:
      normalizeText(
        values.bankAccountNumber,
      ),

    purpose:
      normalizeText(values.purpose),
    
    supportingDocumentNames: [],

    accountCode:
      normalizeText(
        values.accountCode,
      ),

    lineDescription:
      normalizeText(
        values.lineDescription,
      ),

    quantity:
      normalizeText(values.quantity),

    unitAmount:
      normalizeText(
        values.unitAmount,
      ),

    taxAmount:
      normalizeText(
        values.taxAmount,
      ) || '0',
  };
}

function parseNumber(
  value: string,
) {
  const normalizedValue = value
    .replace(/,/g, '')
    .replace(/^RM\s*/i, '')
    .trim();

  if (!normalizedValue) {
    return Number.NaN;
  }

  return Number(normalizedValue);
}

function roundCurrency(
  value: number,
) {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
}

export function calculateBulkPaymentVoucherAmount(
  row: BulkPaymentVoucherRow,
) {
  const quantity =
    parseNumber(row.quantity);

  const unitAmount =
    parseNumber(row.unitAmount);

  const parsedTax =
    parseNumber(row.taxAmount);

  const taxAmount =
    Number.isFinite(parsedTax)
      ? parsedTax
      : 0;

  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(unitAmount)
  ) {
    return 0;
  }

  return roundCurrency(
    quantity * unitAmount +
      taxAmount,
  );
}

function isValidEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function isValidDate(
  value: string,
) {
  if (!value.trim()) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00`,
  );

  return !Number.isNaN(
    date.getTime(),
  );
}

function requiresBankInformation(
  paymentMethod: string,
) {
  const normalizedMethod =
    paymentMethod
      .trim()
      .toLowerCase();

  return [
    'bank transfer',
    'online transfer',
    'ibg',
    'duitnow',
  ].includes(normalizedMethod);
}

function addRequiredError(
  errors: BulkValidationError[],
  field: BulkPaymentVoucherField,
  value: string,
  message: string,
) {
  if (!value.trim()) {
    errors.push({
      field,
      message,
    });
  }
}

export function validateBulkPaymentVoucherRow(
  row: BulkPaymentVoucherRow,
): BulkRowValidationResult {
  const errors:
    BulkValidationError[] = [];

  addRequiredError(
    errors,
    'pvDate',
    row.pvDate,
    'PV date is required.',
  );

  if (
    row.pvDate &&
    !isValidDate(row.pvDate)
  ) {
    errors.push({
      field: 'pvDate',
      message:
        'PV date must use a valid YYYY-MM-DD date.',
    });
  }

  addRequiredError(
    errors,
    'division',
    row.division,
    'Division is required.',
  );

  addRequiredError(
    errors,
    'directorEmail',
    row.directorEmail,
    'Director is required.',
  );

  if (
    row.directorEmail &&
    !isValidEmail(
      row.directorEmail,
    )
  ) {
    errors.push({
      field: 'directorEmail',
      message:
        'Director email is not valid.',
    });
  }

  const director =
    betaAccounts.find(
      (account) =>
        account.role === 'director' &&
        account.email.toLowerCase() ===
          row.directorEmail
            .trim()
            .toLowerCase(),
    );

  if (
    row.directorEmail &&
    !director
  ) {
    errors.push({
      field: 'directorEmail',
      message:
        'Director email does not match a Director account.',
    });
  }

  if (
    row.projectManagerEmail &&
    !isValidEmail(
      row.projectManagerEmail,
    )
  ) {
    errors.push({
      field:
        'projectManagerEmail',

      message:
        'Project Manager email is not valid.',
    });
  }

  const projectManager =
    row.projectManagerEmail
      ? betaAccounts.find(
          (account) =>
            account.role ===
              'manager' &&
            account.email.toLowerCase() ===
              row.projectManagerEmail
                .trim()
                .toLowerCase(),
        )
      : undefined;

  if (
    row.projectManagerEmail &&
    !projectManager
  ) {
    errors.push({
      field:
        'projectManagerEmail',

      message:
        'Project Manager email does not match a Manager account.',
    });
  }

  addRequiredError(
    errors,
    'recipientName',
    row.recipientName,
    'Recipient name is required.',
  );

  addRequiredError(
    errors,
    'recipientEmail',
    row.recipientEmail,
    'Recipient email is required.',
  );

  if (
    row.recipientEmail &&
    !isValidEmail(
      row.recipientEmail,
    )
  ) {
    errors.push({
      field: 'recipientEmail',
      message:
        'Recipient email is not valid.',
    });
  }

  if (
    !row.recipientIsMalaysian
  ) {
    errors.push({
      field:
        'recipientIsMalaysian',

      message:
        'Select whether the recipient is Malaysian.',
    });
  }

  addRequiredError(
    errors,
    'paymentMethod',
    row.paymentMethod,
    'Payment method is required.',
  );

  if (
    requiresBankInformation(
      row.paymentMethod,
    )
  ) {
    addRequiredError(
      errors,
      'bankName',
      row.bankName,
      'Bank name is required for this payment method.',
    );

    addRequiredError(
      errors,
      'bankAccountNumber',
      row.bankAccountNumber,
      'Bank account number is required for this payment method.',
    );
  }

  addRequiredError(
    errors,
    'purpose',
    row.purpose,
    'Purpose of payment is required.',
  );

  addRequiredError(
    errors,
    'accountCode',
    row.accountCode,
    'Account code is required.',
  );

  addRequiredError(
    errors,
    'lineDescription',
    row.lineDescription,
    'Line description is required.',
  );

  const quantity =
    parseNumber(row.quantity);

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    errors.push({
      field: 'quantity',
      message:
        'Quantity must be greater than zero.',
    });
  }

  const unitAmount =
    parseNumber(row.unitAmount);

  if (
    !Number.isFinite(unitAmount) ||
    unitAmount < 0
  ) {
    errors.push({
      field: 'unitAmount',
      message:
        'Unit amount must be zero or greater.',
    });
  }

  const taxAmount =
    parseNumber(row.taxAmount);

  if (
    !Number.isFinite(taxAmount) ||
    taxAmount < 0
  ) {
    errors.push({
      field: 'taxAmount',
      message:
        'Tax amount must be zero or greater.',
    });
  }

  const amount =
    calculateBulkPaymentVoucherAmount(
      row,
    );

  if (amount <= 0) {
    errors.push({
      field: 'unitAmount',
      message:
        'The total amount must be greater than RM 0.00.',
    });
  }

  return {
    rowId: row.rowId,
    isValid:
      errors.length === 0,
    amount,
    errors,
  };
}

export function validateBulkPaymentVoucherRows(
  rows: BulkPaymentVoucherRow[],
) {
  return rows.map(
    validateBulkPaymentVoucherRow,
  );
}

export function convertBulkRowToCreatePaymentVoucherInput(
  row: BulkPaymentVoucherRow,
  submitterId: string,
): CreatePaymentVoucherInput {
  const validation =
    validateBulkPaymentVoucherRow(
      row,
    );

  if (!validation.isValid) {
    throw new Error(
      validation.errors
        .map(
          (error) => error.message,
        )
        .join(' '),
    );
  }

  const director =
    betaAccounts.find(
      (account) =>
        account.role === 'director' &&
        account.email.toLowerCase() ===
          row.directorEmail
            .trim()
            .toLowerCase(),
    );

  if (!director) {
    throw new Error(
      'The selected Director account could not be found.',
    );
  }

  const projectManager =
    row.projectManagerEmail
      ? betaAccounts.find(
          (account) =>
            account.role ===
              'manager' &&
            account.email.toLowerCase() ===
              row.projectManagerEmail
                .trim()
                .toLowerCase(),
        )
      : undefined;

  const quantity =
    parseNumber(row.quantity);

  const unitAmount =
    parseNumber(row.unitAmount);

  const taxAmount =
    parseNumber(row.taxAmount);

  return {
    organizationId:
      'beta-arus-org',

    submitterId,
    directorId: director.id,

    projectManagerId:
      projectManager?.id,

    pvDate: row.pvDate.trim(),
    division: row.division.trim(),

    recipientName:
      row.recipientName.trim(),

    recipientEmail:
      row.recipientEmail
        .trim()
        .toLowerCase(),

    recipientIc:
      row.recipientIc.trim() ||
      undefined,

    recipientIsMalaysian:
      row.recipientIsMalaysian ===
      'yes',

    paymentMethod:
      row.paymentMethod.trim(),

    bankName:
      row.bankName.trim() ||
      undefined,

    bankAccountNumber:
      row.bankAccountNumber.trim() ||
      undefined,

    purpose: row.purpose.trim(),

    lines: [
      {
        accountCode:
          row.accountCode.trim(),

        description:
          row.lineDescription.trim(),

        quantity,
        unitAmount,
        taxAmount,
      },
    ],
  };
}
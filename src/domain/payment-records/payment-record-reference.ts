export type PaymentRecordType =
  | 'INVOICE_PAYMENT'
  | 'EXPENSE_CLAIM'
  | 'CASH_ADVANCE'
  | 'TRAVEL_ALLOWANCE'
  | 'PETTY_CASH';

export const PAYMENT_RECORD_PREFIX: Record<PaymentRecordType, string> = {
  INVOICE_PAYMENT: 'INV',
  EXPENSE_CLAIM: 'EC',
  CASH_ADVANCE: 'CA',
  TRAVEL_ALLOWANCE: 'TA',
  PETTY_CASH: 'PC',
};

const paymentReferenceCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
});

/** Sorts references in ascending natural order: 0001, 0002, 0010. */
export function comparePaymentRecordReferences(
  firstReference: string,
  secondReference: string,
) {
  return paymentReferenceCollator.compare(firstReference, secondReference);
}

/**
 * Creates a stable reference such as INV-2026-0001.
 *
 * Each payment type and calendar year has its own sequence. The next value is
 * based on the largest stored sequence rather than the number of records, so a
 * deleted record cannot cause an old reference to be reused.
 */
export function createNextPaymentRecordReference(
  type: PaymentRecordType,
  existingReferences: readonly string[],
  date = new Date(),
) {
  const prefix = PAYMENT_RECORD_PREFIX[type];
  const year = date.getFullYear();
  const expectedStart = `${prefix}-${year}-`;

  const largestSequence = existingReferences.reduce((largest, reference) => {
    if (!reference.startsWith(expectedStart)) return largest;

    const sequenceText = reference.slice(expectedStart.length);
    // Accept an older variable-width sequence while all newly generated
    // Payment Request references use at least four digits.
    if (!/^\d+$/.test(sequenceText)) return largest;

    return Math.max(largest, Number(sequenceText));
  }, 0);

  return `${expectedStart}${String(largestSequence + 1).padStart(4, '0')}`;
}

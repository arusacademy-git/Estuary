export const PAYMENT_VOUCHER_STATUSES = [
  /*
   * Current token-based workflow.
   */
  'DRAFT',
  'PENDING_DIRECTOR_APPROVAL',
  'REJECTED',
  'APPROVED_FOR_PAYMENT',
  'FINANCE_PROCESSING',
  'AWAITING_RECIPIENT_SIGNATURE',
  'AWAITING_STAFF_CONFIRMATION',
  'PENDING_FINANCE_VERIFICATION',
  'COMPLETED',
  'INACTIVE',

  /*
   * Temporary legacy statuses.
   *
   * Keep these until older components and
   * dummy records have been migrated.
   */
  'AWAITING_SIGNED_PV_UPLOAD',
  'AWAITING_STAFF_VERIFICATION',
  'AWAITING_SIGNATURE',
] as const;

export type PaymentVoucherStatus =
  (typeof PAYMENT_VOUCHER_STATUSES)[number];

export type PaymentVoucherStatusTone =
  | 'draft'
  | 'pending'
  | 'rejected'
  | 'approved'
  | 'processing';

export const PAYMENT_VOUCHER_STATUS_LABELS:
  Record<
    PaymentVoucherStatus,
    string
  > = {
  DRAFT:
    'Draft',

  PENDING_DIRECTOR_APPROVAL:
    'Pending Director Approval',

  REJECTED:
    'Rejected',

  APPROVED_FOR_PAYMENT:
    'Approved for Payment',

  FINANCE_PROCESSING:
    'Finance Processing',

  AWAITING_RECIPIENT_SIGNATURE:
    'Awaiting Recipient Signature',

  AWAITING_STAFF_CONFIRMATION:
    'Awaiting Staff Confirmation',

  PENDING_FINANCE_VERIFICATION:
    'Pending Finance Verification',

  COMPLETED:
    'Completed',

  INACTIVE:
    'Inactive',

  /*
   * Temporary legacy labels.
   */
  AWAITING_SIGNED_PV_UPLOAD:
    'Awaiting Signed PV Upload',

  AWAITING_STAFF_VERIFICATION:
    'Awaiting Staff Verification',

  AWAITING_SIGNATURE:
    'Awaiting Signature',
};

export const PAYMENT_VOUCHER_STATUS_TONES:
  Record<
    PaymentVoucherStatus,
    PaymentVoucherStatusTone
  > = {
  DRAFT:
    'draft',

  PENDING_DIRECTOR_APPROVAL:
    'pending',

  REJECTED:
    'rejected',

  APPROVED_FOR_PAYMENT:
    'approved',

  FINANCE_PROCESSING:
    'processing',

  AWAITING_RECIPIENT_SIGNATURE:
    'pending',

  AWAITING_STAFF_CONFIRMATION:
    'pending',

  PENDING_FINANCE_VERIFICATION:
    'processing',

  COMPLETED:
    'approved',

  INACTIVE:
    'draft',

  /*
   * Temporary legacy tones.
   */
  AWAITING_SIGNED_PV_UPLOAD:
    'pending',

  AWAITING_STAFF_VERIFICATION:
    'pending',

  AWAITING_SIGNATURE:
    'pending',
};

export function getPaymentVoucherStatusLabel(
  status: PaymentVoucherStatus,
) {
  return (
    PAYMENT_VOUCHER_STATUS_LABELS[
      status
    ]
  );
}

export function getPaymentVoucherStatusTone(
  status: PaymentVoucherStatus,
) {
  return (
    PAYMENT_VOUCHER_STATUS_TONES[
      status
    ]
  );
}
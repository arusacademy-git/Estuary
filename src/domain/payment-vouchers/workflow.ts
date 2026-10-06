import type {
  PaymentVoucherStatus,
} from './status';

const allowedTransitions: Record<
  PaymentVoucherStatus,
  PaymentVoucherStatus[]
> = {
  /*
   * Staff creates and submits the
   * Payment Voucher.
   */
  DRAFT: [
    'PENDING_DIRECTOR_APPROVAL',
  ],

  /*
   * The assigned Director reviews the PV.
   */
  PENDING_DIRECTOR_APPROVAL: [
    'REJECTED',
    'APPROVED_FOR_PAYMENT',
  ],

  /*
   * Staff amends and resubmits a
   * Director-rejected PV.
   */
  REJECTED: [
    'PENDING_DIRECTOR_APPROVAL',
  ],

  /*
   * Finance receives the
   * Director-approved PV.
   */
  APPROVED_FOR_PAYMENT: [
    'FINANCE_PROCESSING',
    'INACTIVE',
  ],

  /*
   * Finance records the payment date,
   * payment reference and payment proof.
   *
   * Finance then generates the completed
   * Payment Voucher PDF.
   */
  FINANCE_PROCESSING: [
    'AWAITING_RECIPIENT_SIGNATURE',
    'INACTIVE',

    /*
     * Temporary legacy transitions.
     */
    'AWAITING_SIGNED_PV_UPLOAD',
    'AWAITING_STAFF_VERIFICATION',
  ],

  /*
   * Finance has generated the completed
   * Payment Voucher PDF.
   *
   * The system notifies Staff.
   * Staff sends the secure recipient link.
   * The recipient reviews and signs the PV.
   */
  AWAITING_RECIPIENT_SIGNATURE: [
    'AWAITING_STAFF_CONFIRMATION',
    'INACTIVE',
  ],

  /*
   * The recipient has confirmed and signed
   * the Payment Voucher.
   *
   * Staff reviews the returned signed PV
   * and confirms that it was received.
   */
  AWAITING_STAFF_CONFIRMATION: [
    'PENDING_FINANCE_VERIFICATION',
    'AWAITING_RECIPIENT_SIGNATURE',
    'INACTIVE',
  ],

  /*
   * Staff confirmed receipt of the signed PV.
   *
   * Finance performs the final archive
   * verification.
   */
  PENDING_FINANCE_VERIFICATION: [
    'COMPLETED',

    /*
     * Finance can return an incorrect signed
     * PV for another recipient signature.
     */
    'AWAITING_RECIPIENT_SIGNATURE',

    'INACTIVE',
  ],

  /*
   * Final archived and locked status.
   */
  COMPLETED: [],

  /*
   * Failed, rejected-by-bank or invalid
   * Payment Voucher.
   */
  INACTIVE: [],

  /*
   * Temporary legacy workflow.
   *
   * Keep these transitions until older
   * components and dummy records have
   * been migrated to the new workflow.
   */
  AWAITING_SIGNED_PV_UPLOAD: [
    'PENDING_FINANCE_VERIFICATION',
    'AWAITING_STAFF_CONFIRMATION',
    'INACTIVE',
  ],

  AWAITING_STAFF_VERIFICATION: [
    'AWAITING_SIGNATURE',
    'INACTIVE',
  ],

  AWAITING_SIGNATURE: [
    'COMPLETED',
    'INACTIVE',
  ],
};

export function canTransitionPaymentVoucher(
  currentStatus: PaymentVoucherStatus,
  nextStatus: PaymentVoucherStatus,
) {
  return allowedTransitions[
    currentStatus
  ].includes(nextStatus);
}

export function assertPaymentVoucherTransition(
  currentStatus: PaymentVoucherStatus,
  nextStatus: PaymentVoucherStatus,
) {
  if (
    !canTransitionPaymentVoucher(
      currentStatus,
      nextStatus,
    )
  ) {
    throw new Error(
      `Payment Voucher cannot move from ${currentStatus} to ${nextStatus}.`,
    );
  }
}

export function requireRejectionRemarks(
  nextStatus: PaymentVoucherStatus,
  remarks: string | undefined,
) {
  if (
    nextStatus === 'REJECTED' &&
    !remarks?.trim()
  ) {
    throw new Error(
      'Rejection remarks are required.',
    );
  }
}

export function requireInactiveRemarks(
  nextStatus: PaymentVoucherStatus,
  remarks: string | undefined,
) {
  if (
    nextStatus === 'INACTIVE' &&
    !remarks?.trim()
  ) {
    throw new Error(
      'A reason is required before marking this Payment Voucher as inactive.',
    );
  }
}
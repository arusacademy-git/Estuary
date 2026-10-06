import type {
  PaymentVoucherStatus,
} from '@/domain/payment-vouchers/status';

import styles from './payment-voucher.module.css';

type PaymentVoucherStatusBadgeProps = {
  status: PaymentVoucherStatus;
};

type StatusTone =
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'gray';

type StatusConfiguration = {
  label: string;
  tone: StatusTone;
};

const statusConfigurations: Record<
  PaymentVoucherStatus,
  StatusConfiguration
> = {
  DRAFT: {
    label: 'Draft',
    tone: 'gray',
  },

  PENDING_DIRECTOR_APPROVAL: {
    label:
      'Pending Director Approval',

    tone: 'amber',
  },

  REJECTED: {
    label: 'Rejected',
    tone: 'red',
  },

  APPROVED_FOR_PAYMENT: {
    label:
      'Approved for Payment',

    tone: 'blue',
  },

  FINANCE_PROCESSING: {
    label:
      'Finance Processing',

    tone: 'blue',
  },

  /*
   * Finance generated the completed PV.
   * Staff must send the unique secure link
   * to the recipient.
   */
  AWAITING_RECIPIENT_SIGNATURE: {
    label:
      'Awaiting Recipient Signature',

    tone: 'amber',
  },

  /*
   * The recipient signed and confirmed the PV.
   * Staff must confirm that the signed PV was
   * received.
   */
  AWAITING_STAFF_CONFIRMATION: {
    label:
      'Awaiting Staff Confirmation',

    tone: 'amber',
  },

  /*
   * Staff confirmed receipt of the signed PV.
   * Finance must perform final verification.
   */
  PENDING_FINANCE_VERIFICATION: {
    label:
      'Pending Finance Verification',

    tone: 'blue',
  },

  COMPLETED: {
    label: 'Completed',
    tone: 'green',
  },

  INACTIVE: {
    label: 'Inactive',
    tone: 'red',
  },

  /*
   * Temporary legacy statuses.
   *
   * Keep these while older dummy records and
   * components may still contain these values.
   */
  AWAITING_SIGNED_PV_UPLOAD: {
    label:
      'Awaiting Signed PV Upload',

    tone: 'amber',
  },

  AWAITING_STAFF_VERIFICATION: {
    label:
      'Awaiting Staff Verification',

    tone: 'amber',
  },

  AWAITING_SIGNATURE: {
    label:
      'Awaiting Recipient Signature',

    tone: 'amber',
  },
};

const fallbackConfiguration:
  StatusConfiguration = {
  label: 'Status unavailable',
  tone: 'gray',
};

export function getPaymentVoucherStatusLabel(
  status: PaymentVoucherStatus,
) {
  return (
    statusConfigurations[status] ??
    fallbackConfiguration
  ).label;
}

export function PaymentVoucherStatusBadge({
  status,
}: PaymentVoucherStatusBadgeProps) {
  /*
   * The fallback prevents the UI from
   * crashing if localStorage contains an
   * older or unexpected status value.
   */
  const configuration =
    statusConfigurations[status] ??
    fallbackConfiguration;

  return (
    <span
      className={
        styles.voucherStatusBadge
      }
      data-tone={
        configuration.tone
      }
      title={
        configuration.label
      }
    >
      <span
        aria-hidden="true"
        className={
          styles.voucherStatusDot
        }
      />

      {configuration.label}
    </span>
  );
}
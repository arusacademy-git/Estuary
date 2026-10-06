import {
  betaAccounts,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import type {
  CreateNotificationInput,
} from '@/domain/notifications/types';

import {
  createLocalNotification,
} from '@/data/notifications/local-notification-store';

function createNotificationSafely(
  input: CreateNotificationInput,
) {
  try {
    createLocalNotification(input);
  } catch (error) {
    console.error(
      'The Payment Voucher was updated, but a notification could not be created.',
      error,
    );
  }
}

export function notifyStaffPdfReady(
  voucher: PaymentVoucherRecord,
  finance: BetaAccount,
) {
  createNotificationSafely({
    recipientId:
      voucher.submitterId,

    actorId:
      finance.id,

    type:
      'PAYMENT_VOUCHER_PDF_READY',

    entityType:
      'PAYMENT_VOUCHER',

    entityId:
      voucher.id,

    referenceNumber:
      voucher.voucherNumber,

    title:
      'Payment Voucher PDF ready',

    message:
      `${voucher.voucherNumber} has been paid and prepared by Finance. Download the PV, obtain the recipient signature and upload the signed copy.`,

    href:
      `/beta/payment-vouchers/${voucher.id}`,
  });
}

export function notifyFinanceSignedPvUploaded(
  voucher: PaymentVoucherRecord,
  staff: BetaAccount,
) {
  betaAccounts
    .filter(
      (account) =>
        account.role === 'finance',
    )
    .forEach((financeAccount) => {
      createNotificationSafely({
        recipientId:
          financeAccount.id,

        actorId:
          staff.id,

        type:
          'SIGNED_PAYMENT_VOUCHER_UPLOADED',

        entityType:
          'PAYMENT_VOUCHER',

        entityId:
          voucher.id,

        referenceNumber:
          voucher.voucherNumber,

        title:
          'Signed Payment Voucher uploaded',

        message:
          `${staff.name} uploaded the signed copy of ${voucher.voucherNumber}. Finance verification is required.`,

        href:
          `/beta/payment-vouchers/${voucher.id}`,
      });
    });
}

export function notifyStaffSignedPvReturned(
  voucher: PaymentVoucherRecord,
  finance: BetaAccount,
) {
  createNotificationSafely({
    recipientId:
      voucher.submitterId,

    actorId:
      finance.id,

    type:
      'SIGNED_PAYMENT_VOUCHER_RETURNED',

    entityType:
      'PAYMENT_VOUCHER',

    entityId:
      voucher.id,

    referenceNumber:
      voucher.voucherNumber,

    title:
      'Signed Payment Voucher returned',

    message:
      `Finance returned ${voucher.voucherNumber}. Review the Finance remarks and upload another signed copy.`,

    href:
      `/beta/payment-vouchers/${voucher.id}`,
  });
}

export function notifyStaffPvCompleted(
  voucher: PaymentVoucherRecord,
  finance: BetaAccount,
) {
  createNotificationSafely({
    recipientId:
      voucher.submitterId,

    actorId:
      finance.id,

    type:
      'PAYMENT_VOUCHER_COMPLETED',

    entityType:
      'PAYMENT_VOUCHER',

    entityId:
      voucher.id,

    referenceNumber:
      voucher.voucherNumber,

    title:
      'Payment Voucher completed',

    message:
      `${voucher.voucherNumber} was verified by Finance and marked as completed.`,

    href:
      `/beta/payment-vouchers/${voucher.id}`,
  });
}

export function notifyStaffPvInactive(
  voucher: PaymentVoucherRecord,
  finance: BetaAccount,
) {
  createNotificationSafely({
    recipientId:
      voucher.submitterId,

    actorId:
      finance.id,

    type:
      'PAYMENT_VOUCHER_INACTIVE',

    entityType:
      'PAYMENT_VOUCHER',

    entityId:
      voucher.id,

    referenceNumber:
      voucher.voucherNumber,

    title:
      'Payment Voucher marked inactive',

    message:
      `${voucher.voucherNumber} was marked inactive by Finance. Review the remarks and create a new PV if required.`,

    href:
      `/beta/payment-vouchers/${voucher.id}`,
  });
}
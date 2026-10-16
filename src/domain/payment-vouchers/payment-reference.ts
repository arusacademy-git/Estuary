import type { PaymentVoucherRecord } from './types';

export function paymentVoucherReference(
  voucher: Pick<PaymentVoucherRecord, 'paymentReference' | 'voucherNumber'>,
) {
  return voucher.paymentReference?.trim() || voucher.voucherNumber.trim();
}

export function paymentVoucherRecipientReference(voucherNumber: string) {
  return voucherNumber.trim();
}

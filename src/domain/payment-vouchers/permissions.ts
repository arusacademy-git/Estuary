import type { PaymentVoucherActorRole, PaymentVoucherRecord } from './types';

export function canCreatePaymentVoucher(role: PaymentVoucherActorRole): boolean {
  return role === 'STAFF';
}

export function canEditPaymentVoucher(
  voucher: PaymentVoucherRecord,
  userId: string
): boolean {
  return (
    voucher.submitterId === userId &&
    (voucher.status === 'DRAFT' || voucher.status === 'REJECTED')
  );
}

export function canApprovePaymentVoucher(
  voucher: PaymentVoucherRecord,
  userId: string,
  role: PaymentVoucherActorRole
): boolean {
  return (
    role === 'DIRECTOR' &&
    voucher.directorId === userId &&
    voucher.status === 'PENDING_DIRECTOR_APPROVAL'
  );
}

export function canProcessPaymentVoucher(
  voucher: PaymentVoucherRecord,
  role: PaymentVoucherActorRole
): boolean {
  return role === 'FINANCE_ADMIN' && voucher.status === 'APPROVED_FOR_PAYMENT';
}

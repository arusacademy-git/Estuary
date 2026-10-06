import { createLocalNotification } from '@/data/notifications/local-notification-store';
import type { CreateNotificationInput } from '@/domain/notifications/types';
import type { InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';
import { betaAccounts, type BetaAccount } from '@/lib/auth/beta-accounts';

function createNotificationSafely(input: CreateNotificationInput) {
  try {
    createLocalNotification(input);
  } catch (error) {
    console.error(
      'The Invoice Payment was updated, but its notification could not be created.',
      error,
    );
  }
}

export function notifyManagerInvoicePaymentSubmitted(
  request: InvoicePaymentRequestRecord,
  staff: BetaAccount,
) {
  createNotificationSafely({
    recipientId: request.managerApproverId,
    actorId: staff.id,
    type: 'INVOICE_PAYMENT_SUBMITTED',
    entityType: 'INVOICE_PAYMENT',
    entityId: request.id,
    referenceNumber: request.requestNumber,
    title: 'Invoice Payment requires review',
    message: `${staff.name} submitted ${request.requestNumber}. Manager review is required.`,
    href: `/beta/project-manager/payment-requests/invoice-payments/${request.id}`,
  });
}

export function notifyDirectorInvoicePaymentApprovedByManager(
  request: InvoicePaymentRequestRecord,
  manager: BetaAccount,
) {
  createNotificationSafely({
    recipientId: request.directorApproverId,
    actorId: manager.id,
    type: 'INVOICE_PAYMENT_MANAGER_APPROVED',
    entityType: 'INVOICE_PAYMENT',
    entityId: request.id,
    referenceNumber: request.requestNumber,
    title: 'Invoice Payment requires Director approval',
    message: `${manager.name} reviewed ${request.requestNumber}. Director approval is required.`,
    href: `/beta/director/payment-requests/invoice-payments/${request.id}`,
  });
}

export function notifyFinanceInvoicePaymentApprovedByDirector(
  request: InvoicePaymentRequestRecord,
  director: BetaAccount,
) {
  betaAccounts
    .filter((account) => account.role === 'finance')
    .forEach((financeAccount) => {
      createNotificationSafely({
        recipientId: financeAccount.id,
        actorId: director.id,
        type: 'INVOICE_PAYMENT_DIRECTOR_APPROVED',
        entityType: 'INVOICE_PAYMENT',
        entityId: request.id,
        referenceNumber: request.requestNumber,
        title: 'Invoice Payment requires Finance verification',
        message: `${director.name} approved ${request.requestNumber}. Finance verification is required.`,
        href: `/beta/finance/payment-requests/invoice-payments/${request.id}`,
      });
    });
}

export function notifyStaffInvoicePaymentReturned(
  request: InvoicePaymentRequestRecord,
  actor: BetaAccount,
  stage: 'Manager' | 'Director' | 'Finance',
) {
  createNotificationSafely({
    recipientId: request.staffId,
    actorId: actor.id,
    type: 'INVOICE_PAYMENT_RETURNED',
    entityType: 'INVOICE_PAYMENT',
    entityId: request.id,
    referenceNumber: request.requestNumber,
    title: 'Invoice Payment returned for correction',
    message: `${stage} returned ${request.requestNumber}. Review the correction notes before resubmitting.`,
    href: `/beta/payment-records/invoice-payments/${request.id}`,
  });
}

export function notifyStaffInvoicePaymentCompleted(
  request: InvoicePaymentRequestRecord,
  finance: BetaAccount,
) {
  createNotificationSafely({
    recipientId: request.staffId,
    actorId: finance.id,
    type: 'INVOICE_PAYMENT_COMPLETED',
    entityType: 'INVOICE_PAYMENT',
    entityId: request.id,
    referenceNumber: request.requestNumber,
    title: 'Invoice Payment completed',
    message: `${request.requestNumber} was verified by Finance and marked as completed.`,
    href: `/beta/payment-records/invoice-payments/${request.id}`,
  });
}

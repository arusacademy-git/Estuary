'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { betaAccounts } from '@/lib/auth/beta-accounts';
import { createLocalNotification } from '@/data/notifications/local-notification-store';
import {
  createPaymentVoucher,
  resubmitPaymentVoucher,
} from '@/data/payment-vouchers/payment-voucher-api';

import type {
  CreatePaymentVoucherInput,
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import { PaymentVoucherForm } from '@/features/payment-voucher/components/staff/payment-voucher-form';
import { PaymentVoucherReview } from '@/features/payment-voucher/components/staff/payment-voucher-review';

import styles from '@/features/payment-voucher/components/payment-voucher.module.css';

type CreateStep = 'form' | 'review';

type PaymentVoucherCreateFlowProps = {
  initialVoucher?: PaymentVoucherRecord;
  onStepChange?: (step: CreateStep) => void;
};

export function PaymentVoucherCreateFlow({
  initialVoucher,
  onStepChange,
}: PaymentVoucherCreateFlowProps) {
  const router = useRouter();
  const isAmendment = initialVoucher?.status === 'REJECTED';
  const [currentStep, setCurrentStep] = useState<CreateStep>('form');
  const [voucherDraft, setVoucherDraft] =
    useState<CreatePaymentVoucherInput | null>(null);
  const [supportingDocumentNames, setSupportingDocumentNames] =
    useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  function handleContinueToReview(
    voucher: CreatePaymentVoucherInput,
    documentNames: string[],
  ) {
    setVoucherDraft(voucher);
    setSupportingDocumentNames(documentNames);
    setSubmissionError('');
    setCurrentStep('review');
    onStepChange?.('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleBackToEdit() {
    setSubmissionError('');
    setCurrentStep('form');
    onStepChange?.('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmitToDirector() {
    if (!voucherDraft) {
      setSubmissionError(
        'Payment Voucher information could not be found. Please return to the form.',
      );
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmissionError('');

    try {
      const submittedVoucher =
        isAmendment && initialVoucher
          ? await resubmitPaymentVoucher(
              initialVoucher.id,
              voucherDraft,
            )
          : await createPaymentVoucher(
              voucherDraft,
              true,
            );
      const submitterAccount = betaAccounts.find(
        (account) => account.id === submittedVoucher.submitterId,
      );
      const submitterName = submitterAccount?.name ?? submittedVoucher.submitterId;

      try {
        createLocalNotification({
          recipientId: submittedVoucher.directorId,
          actorId: submittedVoucher.submitterId,
          type: 'PAYMENT_VOUCHER_SUBMITTED',
          entityType: 'PAYMENT_VOUCHER',
          entityId: submittedVoucher.id,
          referenceNumber: submittedVoucher.voucherNumber,
          title: 'Payment Voucher requires approval',
          message: `${submittedVoucher.voucherNumber} was submitted by ${submitterName} and requires your approval.`,
          href: `/beta/payment-vouchers/${submittedVoucher.id}`,
        });
      } catch (notificationError) {
        console.error(
          'Payment Voucher was stored, but its Beta notification could not be created.',
          notificationError,
        );
      }

      router.push(
        `/beta/payment-vouchers/${submittedVoucher.id}?submitted=true`,
      );
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'Unable to store and submit the Payment Voucher.',
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.createFlow}>
      {submissionError && (
        <div className={styles.notice} role="alert">
          {submissionError}
        </div>
      )}

      <div hidden={currentStep !== 'form'}>
        <PaymentVoucherForm
          initialVoucher={initialVoucher}
          onContinue={handleContinueToReview}
        />
      </div>

      {currentStep === 'review' && voucherDraft && (
        <PaymentVoucherReview
          voucher={voucherDraft}
          supportingDocumentNames={supportingDocumentNames}
          isAmendment={isAmendment}
          isSubmitting={isSubmitting}
          onBack={handleBackToEdit}
          onSubmit={handleSubmitToDirector}
        />
      )}
    </div>
  );
}

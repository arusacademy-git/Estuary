'use client';

import {
  useEffect,
  useState,
} from 'react';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  confirmRecipientSignedPaymentVoucher,
} from '@/data/payment-vouchers/payment-voucher-api';

import {
  createLocalNotification,
} from '@/data/notifications/local-notification-store';

import {
  betaAccounts,
} from '@/lib/auth/beta-accounts';

import {
  downloadPaymentVoucherPdf,
} from '@/features/payment-voucher/pdf/download-payment-voucher-pdf';

import styles from '@/features/payment-voucher/components/staff/staff-signed-pv-confirmation-panel.module.css';

type StaffSignedPvConfirmationPanelProps = {
  voucher: PaymentVoucherRecord;
  requesterUserId: string;

  onUpdated?: (
    voucher: PaymentVoucherRecord,
  ) => void;
};

function formatDateTime(
  value?: string,
) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'en-MY',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}

function getFinanceAccount() {
  return betaAccounts.find(
    (account) =>
      account.role === 'finance',
  );
}

export function StaffSignedPvConfirmationPanel({
  voucher,
  requesterUserId,
  onUpdated,
}: StaffSignedPvConfirmationPanelProps) {
  const [
    currentVoucher,
    setCurrentVoucher,
  ] = useState(voucher);

  const [
    isConfirmed,
    setIsConfirmed,
  ] = useState(false);

  const [
    isDownloading,
    setIsDownloading,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  useEffect(() => {
    setCurrentVoucher(voucher);
  }, [voucher]);

  const isOriginalSubmitter =
    currentVoucher.submitterId ===
    requesterUserId;

  const canConfirmSignedPv =
    currentVoucher.status ===
    'AWAITING_STAFF_CONFIRMATION' &&
    isOriginalSubmitter;

  function clearMessages() {
    setSuccessMessage('');
    setErrorMessage('');
  }

  function publishUpdate(
    updatedVoucher: PaymentVoucherRecord,
  ) {
    setCurrentVoucher(
      updatedVoucher,
    );

    onUpdated?.(
      updatedVoucher,
    );
  }

  async function handleDownloadSignedPv() {
    clearMessages();
    setIsDownloading(true);

    try {
      if (
        currentVoucher.signedPvDataUrl &&
        currentVoucher.signedPvFileName
      ) {
        const link = document.createElement('a');
        link.href = currentVoucher.signedPvDataUrl;
        link.download = currentVoucher.signedPvFileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();

        setSuccessMessage(
          'The manually signed Payment Voucher was downloaded.',
        );
        return;
      }

      /*
       * The PDF builder receives the recipient
       * signature stored in the voucher and
       * places it inside the PV template.
       */
      await downloadPaymentVoucherPdf(
        currentVoucher,
      );

      setSuccessMessage(
        'The recipient-signed Payment Voucher was downloaded.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to download the signed Payment Voucher.',
      );
    } finally {
      setIsDownloading(false);
    }
  }

  function notifyFinance(
    updatedVoucher: PaymentVoucherRecord,
  ) {
    const financeAccount =
      getFinanceAccount();

    if (!financeAccount) {
      return;
    }

    try {
      createLocalNotification({
        recipientId:
          financeAccount.id,

        actorId:
          requesterUserId,

        type:
          'SIGNED_PAYMENT_VOUCHER_UPLOADED',

        entityType:
          'PAYMENT_VOUCHER',

        entityId:
          updatedVoucher.id,

        referenceNumber:
          updatedVoucher.voucherNumber,

        title:
          'Signed Payment Voucher ready for verification',

        message:
          `${updatedVoucher.voucherNumber} was signed by ${updatedVoucher.recipientName} and confirmed by the original requester. Finance can now perform the final verification.`,

        href:
          `/beta/payment-vouchers/${updatedVoucher.id}`,
      });
    } catch (notificationError) {
      console.error(
        'The Payment Voucher was updated, but the Finance notification could not be created.',
        notificationError,
      );
    }
  }

  async function handleConfirmSignedPv() {
    clearMessages();

    if (!isConfirmed) {
      setErrorMessage(
        'Confirm that you reviewed and received the recipient-signed Payment Voucher.',
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const updatedVoucher =
        await confirmRecipientSignedPaymentVoucher(
          currentVoucher.id,
          requesterUserId,
        );

      notifyFinance(
        updatedVoucher,
      );

      publishUpdate(
        updatedVoucher,
      );

      setSuccessMessage(
        'The signed Payment Voucher was confirmed and sent to Finance for final verification.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to confirm the signed Payment Voucher.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canConfirmSignedPv) {
    return null;
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Requester action required
          </p>

          <h2>
            Confirm recipient-signed PV
          </h2>

          <p className={styles.description}>
            {currentVoucher.recipientSignatureMethod === 'MANUAL'
              ? 'The recipient uploaded a manually signed Payment Voucher. Review the PDF before sending it to Finance.'
              : 'The recipient confirmed the payment and submitted their digital signature. Review the signed Payment Voucher before sending it to Finance.'}
          </p>
        </div>

        <span className={styles.statusBadge}>
          Ready for requester confirmation
        </span>
      </header>

      <div className={styles.summaryGrid}>
        <div>
          <span>Payment Voucher</span>

          <strong>
            {currentVoucher.voucherNumber}
          </strong>
        </div>

        <div>
          <span>Recipient</span>

          <strong>
            {currentVoucher.recipientName}
          </strong>
        </div>

        <div>
          <span>Recipient signed</span>

          <strong>
            {formatDateTime(
              currentVoucher
                .recipientSignedAt,
            )}
          </strong>
        </div>

        <div>
          <span>Signed PDF</span>

          <strong>
            {currentVoucher.signedPvFileName ??
              `${currentVoucher.voucherNumber}-signed.pdf`}
          </strong>
        </div>

        <div>
          <span>Signing method</span>
          <strong>
            {currentVoucher.recipientSignatureMethod === 'MANUAL'
              ? 'Manual signature'
              : 'Digital signature'}
          </strong>
        </div>
      </div>

      <div className={styles.reviewGrid}>
        <article className={styles.signatureCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.cardEyebrow}>
                Recipient signature
              </p>

              <h3>
                {currentVoucher.recipientName}
              </h3>
            </div>

            <span className={styles.signedBadge}>
              Signed
            </span>
          </div>

          <div className={styles.signaturePreview}>
            {currentVoucher
              .recipientSignatureDataUrl ? (
              /*
               * A regular image is used because
               * this is a local data URL stored
               * by the beta prototype.
               */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`Signature submitted by ${currentVoucher.recipientName}`}
                src={
                  currentVoucher
                    .recipientSignatureDataUrl
                }
              />
            ) : currentVoucher.signedPvDataUrl ? (
              <p>
                A manually signed PDF was uploaded. Download the document to review the recipient’s signature.
              </p>
            ) : (
              <p>
                The recipient signature image
                could not be found.
              </p>
            )}
          </div>

          <dl className={styles.signatureDetails}>
            <div>
              <dt>Payment confirmed</dt>
              <dd>
                {currentVoucher
                  .recipientConfirmedAt
                  ? 'Yes'
                  : 'Not recorded'}
              </dd>
            </div>

            <div>
              <dt>Signed date</dt>
              <dd>
                {formatDateTime(
                  currentVoucher
                    .recipientSignedAt,
                )}
              </dd>
            </div>
          </dl>
        </article>

        <article className={styles.actionCard}>
          <p className={styles.cardEyebrow}>
            Review and confirm
          </p>

          <h3>
            Check the completed document
          </h3>

          <p className={styles.actionDescription}>
            {currentVoucher.recipientSignatureMethod === 'MANUAL'
              ? 'Download the uploaded PDF and confirm that it is complete and contains the recipient’s manual signature.'
              : 'Download the updated PDF and make sure the recipient signature appears correctly in the “Received by” section.'}
          </p>

          <button
            className={
              styles.secondaryButton
            }
            disabled={isDownloading}
            onClick={
              handleDownloadSignedPv
            }
            type="button"
          >
            {isDownloading
              ? 'Preparing signed PDF…'
              : 'Download signed PV'}
          </button>

          <label
            className={
              styles.confirmationField
            }
          >
            <input
              checked={isConfirmed}
              onChange={(event) =>
                setIsConfirmed(
                  event.target.checked,
                )
              }
              type="checkbox"
            />

            <span>
              I have reviewed the signed Payment Voucher and confirm that it was received from the recipient.
            </span>
          </label>

          <button
            className={styles.primaryButton}
            disabled={
              !isConfirmed ||
              isSubmitting
            }
            onClick={
              handleConfirmSignedPv
            }
            type="button"
          >
            {isSubmitting
              ? 'Confirming…'
              : 'Confirm and send to Finance'}
          </button>
        </article>
      </div>

      {successMessage && (
        <div
          className={styles.success}
          role="status"
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          className={styles.error}
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <aside className={styles.notice}>
        After confirmation, the verification
        stage is locked for the requester and the
        Payment Voucher moves to Finance for
        final archive verification.
      </aside>
    </section>
  );
}

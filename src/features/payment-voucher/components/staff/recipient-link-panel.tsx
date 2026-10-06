'use client';

import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  issuePaymentVoucherRecipientLink,
  uploadManualSignedPaymentVoucherByStaff,
} from '@/data/payment-vouchers/payment-voucher-api';

import {
  downloadPaymentVoucherPdf,
} from '@/features/payment-voucher/pdf/download-payment-voucher-pdf';

import styles from './recipient-link-panel.module.css';

type RecipientLinkPanelProps = {
  voucher: PaymentVoucherRecord;
  requesterUserId: string;

  onUpdated?: (
    voucher: PaymentVoucherRecord,
  ) => void;
};

const MAX_MANUAL_SIGNED_PV_SIZE = 2.5 * 1024 * 1024;

function formatDateTime(
  value?: string,
) {
  if (!value) {
    return 'Not sent yet';
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

function createAbsoluteRecipientUrl(
  token?: string,
) {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return null;
  }

  const securePath = `/beta/recipient/${encodeURIComponent(normalizedToken)}`;

  if (typeof window === 'undefined') {
    return securePath;
  }

  return new URL(
    securePath,
    window.location.origin,
  ).toString();
}

async function copyText(
  value: string,
) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      value,
    );

    return;
  }

  /*
   * Fallback for development environments
   * where Clipboard API access is blocked.
   */
  const textArea =
    document.createElement('textarea');

  textArea.value = value;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';

  document.body.appendChild(
    textArea,
  );

  textArea.focus();
  textArea.select();

  const copied =
    document.execCommand('copy');

  textArea.remove();

  if (!copied) {
    throw new Error(
      'The secure link could not be copied.',
    );
  }
}

export function RecipientLinkPanel({
  voucher,
  requesterUserId,
  onUpdated,
}: RecipientLinkPanelProps) {
  const manualFileInputRef = useRef<HTMLInputElement | null>(null);
  const [
    currentVoucher,
    setCurrentVoucher,
  ] = useState(voucher);

  const [
    isDownloading,
    setIsDownloading,
  ] = useState(false);

  const [
    isSending,
    setIsSending,
  ] = useState(false);

  const [
    isCopying,
    setIsCopying,
  ] = useState(false);

  const [
    issuedRecipientToken,
    setIssuedRecipientToken,
  ] = useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualFileName, setManualFileName] = useState('');
  const [manualDataUrl, setManualDataUrl] = useState('');
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [isUploadingManual, setIsUploadingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  useEffect(() => {
    setCurrentVoucher(voucher);
  }, [voucher]);

  const isOriginalSubmitter =
    currentVoucher.submitterId ===
    requesterUserId;

  const canSendRecipientLink =
    currentVoucher.status ===
      'AWAITING_RECIPIENT_SIGNATURE' &&
    isOriginalSubmitter;

  const linkHasBeenSent =
    Boolean(
      currentVoucher.recipientLinkSentAt,
    );

  const secureRecipientUrl =
    createAbsoluteRecipientUrl(
      issuedRecipientToken,
    );

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

  async function handleDownloadPdf() {
    clearMessages();
    setIsDownloading(true);

    try {
      await downloadPaymentVoucherPdf(
        currentVoucher,
      );

      setSuccessMessage(
        'The generated Payment Voucher PDF was downloaded.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to download the Payment Voucher PDF.',
      );
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleCopySecureLink() {
    clearMessages();
    setIsCopying(true);

    try {
      const issuedLink =
        await issuePaymentVoucherRecipientLink(
          currentVoucher.id,
          requesterUserId,
        );

      publishUpdate(issuedLink.voucher);
      setIssuedRecipientToken(issuedLink.token);

      const recipientUrl =
        createAbsoluteRecipientUrl(
          issuedLink.token,
        );

      if (!recipientUrl) {
        throw new Error(
          'The recipient secure link could not be generated.',
        );
      }

      await copyText(recipientUrl);

      setSuccessMessage(
        'The secure recipient link was copied.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to copy the secure recipient link.',
      );
    } finally {
      setIsCopying(false);
    }
  }

  async function handleSendRecipientEmail() {
    clearMessages();
    setIsSending(true);

    try {
      /*
       * This records that the requester sent the
       * secure link. It also generates a new
       * token when the previous token expired.
       */
      const issuedLink =
        await issuePaymentVoucherRecipientLink(
          currentVoucher.id,
          requesterUserId,
        );

      const updatedVoucher = issuedLink.voucher;

      publishUpdate(
        updatedVoucher,
      );
      setIssuedRecipientToken(issuedLink.token);

      const recipientUrl =
        createAbsoluteRecipientUrl(
          issuedLink.token,
        );

      if (!recipientUrl) {
        throw new Error(
          'The recipient secure link could not be generated.',
        );
      }

      const recipientEmail =
        updatedVoucher.recipientEmail.trim();

      if (!recipientEmail) {
        throw new Error(
          'The recipient email address is missing.',
        );
      }

      const subject =
        `Payment Voucher ${updatedVoucher.voucherNumber} requires your confirmation`;

      const emailBody = [
        `Hello ${updatedVoucher.recipientName},`,
        '',
        `Payment Voucher ${updatedVoucher.voucherNumber} is ready for your review and signature.`,
        '',
        `Amount: RM ${updatedVoucher.amount.toFixed(
          2,
        )}`,
        `Payment reference: ${
          updatedVoucher.paymentReference ??
          'Not provided'
        }`,
        '',
        'To sign digitally, open the secure link below:',
        recipientUrl,
        '',
        'The secure link is valid for 7 days.',
        '',
        'To sign manually, print the attached Payment Voucher PDF, sign it and return the completed PDF to the requester by email.',
        '',
        'Thank you.',
        'Estuary',
      ].join('\n');

      const mailtoUrl =
        `mailto:${encodeURIComponent(
          recipientEmail,
        )}` +
        `?subject=${encodeURIComponent(
          subject,
        )}` +
        `&body=${encodeURIComponent(
          emailBody,
        )}`;

      /*
       * Beta behaviour:
       * Open the user's email application
       * with the recipient, subject and secure
       * link already prepared.
       */
      window.location.href =
        mailtoUrl;

      setSuccessMessage(
        `The recipient email was prepared for ${recipientEmail}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to prepare the recipient email.',
      );
    } finally {
      setIsSending(false);
    }
  }

  function handlePreviewRecipientPage() {
    clearMessages();

    if (!secureRecipientUrl) {
      setErrorMessage(
        'The recipient secure link is not available.',
      );

      return;
    }

    window.open(
      secureRecipientUrl,
      '_blank',
      'noopener,noreferrer',
    );
  }

  function resetManualUpload() {
    setManualFileName('');
    setManualDataUrl('');
    setManualConfirmed(false);
    setManualError('');
    if (manualFileInputRef.current) manualFileInputRef.current.value = '';
  }

  function closeManualModal() {
    if (isUploadingManual) return;
    resetManualUpload();
    setIsManualModalOpen(false);
  }

  function handleManualFile(event: ChangeEvent<HTMLInputElement>) {
    setManualError('');
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setManualError('Select the signed Payment Voucher as a PDF file.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_MANUAL_SIGNED_PV_SIZE) {
      setManualError('The signed PDF must be smaller than 2.5 MB for this beta.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setManualError('The signed PDF could not be read.');
        return;
      }
      setManualFileName(file.name);
      setManualDataUrl(reader.result);
    };
    reader.onerror = () => setManualError('The signed PDF could not be read.');
    reader.readAsDataURL(file);
  }

  async function handleManualUpload() {
    setManualError('');
    if (!manualFileName || !manualDataUrl) {
      setManualError('Select the manually signed Payment Voucher PDF.');
      return;
    }
    if (!manualConfirmed) {
      setManualError('Confirm that this is the complete signed PV received from the recipient.');
      return;
    }

    setIsUploadingManual(true);
    try {
      const updatedVoucher = await uploadManualSignedPaymentVoucherByStaff(
        currentVoucher.id,
        requesterUserId,
        {
          fileName: manualFileName,
          dataUrl: manualDataUrl,
          confirmedPaymentReceived: manualConfirmed,
        },
      );
      publishUpdate(updatedVoucher);
      resetManualUpload();
      setIsManualModalOpen(false);
      setSuccessMessage('The manually signed PV was uploaded and sent to Finance verification.');
    } catch (error) {
      setManualError(
        error instanceof Error
          ? error.message
          : 'Unable to upload the manually signed Payment Voucher.',
      );
    } finally {
      setIsUploadingManual(false);
    }
  }

  if (!canSendRecipientLink) {
    return null;
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Requester action
          </p>

          <h2>
            Send Payment Voucher to recipient
          </h2>

          <p className={styles.description}>
            Finance has generated the completed
            Payment Voucher. Send the secure link
            to the recipient so they can review,
            confirm and sign it.
          </p>
        </div>

        <span
          className={
            linkHasBeenSent
              ? styles.waitingBadge
              : styles.readyBadge
          }
        >
          {linkHasBeenSent
            ? 'Waiting for recipient'
            : 'Ready to send'}
        </span>
      </header>

      {currentVoucher.paymentRemarks && (
        <aside className={styles.remarks}>
          <strong>
            Finance remarks
          </strong>

          <p>
            {
              currentVoucher.paymentRemarks
            }
          </p>
        </aside>
      )}

      <div className={styles.recipientSummary}>
        <div>
          <span>Recipient</span>

          <strong>
            {currentVoucher.recipientName}
          </strong>
        </div>

        <div>
          <span>Recipient email</span>

          <strong>
            {currentVoucher.recipientEmail}
          </strong>
        </div>

        <div>
          <span>Generated PDF</span>

          <strong>
            {currentVoucher.pvPdfFileName ??
              'Not generated'}
          </strong>
        </div>

        <div>
          <span>Last email prepared</span>

          <strong>
            {formatDateTime(
              currentVoucher
                .recipientLinkSentAt,
            )}
          </strong>
        </div>
      </div>

      <div className={styles.steps}>
        <article className={styles.stepCard}>
          <span className={styles.stepNumber}>
            1
          </span>

          <div className={styles.stepContent}>
            <h3>
              Download generated PV
            </h3>

            <p>
              Download and review the completed
              Payment Voucher generated by
              Finance.
            </p>

            <button
              className={
                styles.secondaryButton
              }
              disabled={isDownloading}
              onClick={handleDownloadPdf}
              type="button"
            >
              {isDownloading
                ? 'Preparing PDF…'
                : 'Download PV PDF'}
            </button>
          </div>
        </article>

        <article className={styles.stepCard}>
          <span className={styles.stepNumber}>
            2
          </span>

          <div className={styles.stepContent}>
            <h3>
              Send secure link
            </h3>

            <p>
              Prepare an email containing the
              recipient’s unique seven-day
              access link.
            </p>

            <button
              className={
                styles.primaryButton
              }
              disabled={isSending}
              onClick={
                handleSendRecipientEmail
              }
              type="button"
            >
              {isSending
                ? 'Preparing email…'
                : linkHasBeenSent
                  ? 'Resend recipient email'
                  : 'Send recipient email'}
            </button>
          </div>
        </article>

        <article className={styles.stepCard}>
          <span className={styles.stepNumber}>
            3
          </span>

          <div className={styles.stepContent}>
            <h3>
              Track recipient action
            </h3>

            <p>
              The recipient opens the secure
              page, confirms payment and submits
              their digital signature.
            </p>

            <div className={styles.buttonGroup}>
              <button
                className={
                  styles.secondaryButton
                }
                disabled={isCopying}
                onClick={
                  handleCopySecureLink
                }
                type="button"
              >
                {isCopying
                  ? 'Copying…'
                  : 'Copy secure link'}
              </button>

              <button
                className={
                  styles.secondaryButton
                }
                disabled={!secureRecipientUrl}
                onClick={
                  handlePreviewRecipientPage
                }
                type="button"
              >
                Preview recipient page
              </button>
            </div>
          </div>
        </article>
      </div>

      {linkHasBeenSent && (
        <div className={styles.sentInformation}>
          <div>
            <span>Link sent</span>

            <strong>
              {formatDateTime(
                currentVoucher
                  .recipientLinkSentAt,
              )}
            </strong>
          </div>

          <div>
            <span>Total sends</span>

            <strong>
              {currentVoucher
                .recipientLinkSendCount ?? 1}
            </strong>
          </div>

          <div>
            <span>Link expires</span>

            <strong>
              {formatDateTime(
                currentVoucher
                  .recipientAccessExpiresAt,
              )}
            </strong>
          </div>
        </div>
      )}

      <div className={styles.manualActionBar}>
        <div>
          <strong>Received a manually signed copy?</strong>
          <p>
            If the recipient returned the signed PV by email, upload it here for Finance verification.
          </p>
        </div>

        <button
          className={styles.secondaryButton}
          type="button"
          onClick={() => {
            clearMessages();
            setIsManualModalOpen(true);
          }}
        >
          Upload manually signed PV
        </button>
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

      <aside className={styles.betaNotice}>
        <strong>Beta behaviour:</strong>{' '}
        Estuary opens a prepared email in your
        default email application. Production
        can send this email automatically through
        the configured email service.
      </aside>

      {isManualModalOpen && (
        <div
          aria-labelledby="manual-upload-title"
          aria-modal="true"
          className={styles.modalOverlay}
          role="dialog"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeManualModal();
          }}
        >
          <div className={styles.modalCard}>
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Manual signature</p>
                <h2 id="manual-upload-title">Upload manually signed Payment Voucher</h2>
                <p>
                  Upload the complete PDF returned by {currentVoucher.recipientName}.
                </p>
              </div>
              <button
                aria-label="Close manual upload"
                disabled={isUploadingManual}
                type="button"
                onClick={closeManualModal}
              >
                ×
              </button>
            </header>

            <input
              ref={manualFileInputRef}
              accept="application/pdf,.pdf"
              className={styles.hiddenInput}
              type="file"
              onChange={handleManualFile}
            />

            {!manualFileName ? (
              <button
                className={styles.manualFilePicker}
                disabled={isUploadingManual}
                type="button"
                onClick={() => manualFileInputRef.current?.click()}
              >
                <strong>Select signed PV PDF</strong>
                <span>PDF only · Maximum size 2.5 MB</span>
              </button>
            ) : (
              <div className={styles.manualFileReady}>
                <div>
                  <strong>Signed PDF selected</strong>
                  <span>{manualFileName}</span>
                </div>
                <button type="button" onClick={resetManualUpload}>Remove</button>
              </div>
            )}

            <label className={styles.manualConfirmation}>
              <input
                checked={manualConfirmed}
                disabled={isUploadingManual}
                type="checkbox"
                onChange={(event) => setManualConfirmed(event.target.checked)}
              />
              <span>
                I confirm this is the complete manually signed Payment Voucher received from the recipient.
              </span>
            </label>

            {manualError && (
              <div className={styles.error} role="alert">{manualError}</div>
            )}

            <footer className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                disabled={isUploadingManual}
                type="button"
                onClick={closeManualModal}
              >
                Cancel
              </button>
              <button
                className={styles.primaryButton}
                disabled={
                  isUploadingManual ||
                  !manualFileName ||
                  !manualDataUrl ||
                  !manualConfirmed
                }
                type="button"
                onClick={handleManualUpload}
              >
                {isUploadingManual ? 'Uploading…' : 'Upload and send to Finance'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}

'use client';

import {
  useEffect,
  useState,
} from 'react';

import type {
  ChangeEvent,
} from 'react';

import Link from 'next/link';

import {
  betaAccounts,
} from '@/lib/auth/beta-accounts';

import type {
  BetaAccount,
} from '@/lib/auth/beta-accounts';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  completePaymentVoucher,
  markPaymentVoucherInactive,
  recordPaymentVoucherPdfGenerated,
  returnPaymentVoucherForNewSignature,
  savePaymentVoucherFinanceInformation,
  startPaymentVoucherFinanceProcessing,
} from '@/data/payment-vouchers/payment-voucher-api';

import {
  downloadPaymentVoucherPdf,
} from '@/features/payment-voucher/pdf/download-payment-voucher-pdf';

import {
  notifyStaffPdfReady,
  notifyStaffPvCompleted,
  notifyStaffPvInactive,
  notifyStaffSignedPvReturned,
} from '@/features/payment-voucher/notifications/payment-voucher-notifications';

import {
  PaymentVoucherStatusBadge,
} from '@/features/payment-voucher/components/payment-voucher-status-badge';

import styles from '@/features/payment-voucher/components/finance/finance-payment.module.css';

type FinancePaymentPanelProps = {
  finance: BetaAccount;
  voucher: PaymentVoucherRecord;
  onUpdated?: () => void | Promise<void>;
  onProcessingStarted?: (voucherId: string) => void;
};

const MAX_PROOF_FILE_SIZE =
  10 * 1024 * 1024;

const ALLOWED_PROOF_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
];

function formatCurrency(
  amount: number,
) {
  return new Intl.NumberFormat(
    'en-MY',
    {
      style: 'currency',
      currency: 'MYR',
    },
  ).format(amount);
}

function formatDate(
  value?: string,
) {
  if (!value) {
    return 'Not available';
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

function getAccountName(
  accountId?: string,
) {
  if (!accountId) {
    return 'Not available';
  }

  const account =
    betaAccounts.find(
      (candidate) =>
        candidate.id === accountId,
    );

  return account?.name ?? accountId;
}

function getTodayValue() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

export function FinancePaymentPanel({
  finance,
  voucher,
  onUpdated,
  onProcessingStarted,
}: FinancePaymentPanelProps) {
  const [
    paymentDate,
    setPaymentDate,
  ] = useState(
    voucher.paymentDate ??
      getTodayValue(),
  );

  const [
    paymentReference,
    setPaymentReference,
  ] = useState(
    voucher.paymentReference ?? '',
  );

  const [
    paymentRemarks,
    setPaymentRemarks,
  ] = useState(
    voucher.paymentRemarks ?? '',
  );

  const [
    paymentProofFile,
    setPaymentProofFile,
  ] = useState<File | null>(null);

  const [
    inactiveRemarks,
    setInactiveRemarks,
  ] = useState('');

  const [
    verificationRemarks,
    setVerificationRemarks,
  ] = useState('');

  const [
    showInactiveForm,
    setShowInactiveForm,
  ] = useState(false);

  const [
    showReturnForm,
    setShowReturnForm,
  ] = useState(false);

  const [
    isProcessing,
    setIsProcessing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  useEffect(() => {
    setPaymentDate(
      voucher.paymentDate ??
        getTodayValue(),
    );

    setPaymentReference(
      voucher.paymentReference ?? '',
    );

    setPaymentRemarks(
      voucher.paymentRemarks ?? '',
    );

    setPaymentProofFile(null);
  }, [
    voucher.id,
    voucher.paymentDate,
    voucher.paymentReference,
    voucher.paymentRemarks,
  ]);

  const canMarkInactive =
    voucher.status ===
      'APPROVED_FOR_PAYMENT' ||
    voucher.status ===
      'FINANCE_PROCESSING' ||
    voucher.status ===
      'AWAITING_RECIPIENT_SIGNATURE' ||
    voucher.status ===
      'AWAITING_STAFF_CONFIRMATION' ||
    voucher.status ===
      'PENDING_FINANCE_VERIFICATION' ||

    /*
     * Temporary legacy status.
     */
    voucher.status ===
      'AWAITING_SIGNED_PV_UPLOAD';

  const paymentInformationIsSaved =
    Boolean(
      voucher.paymentDate &&
      voucher.paymentReference &&
      voucher.paymentMadeById,
    );

  const canDownloadGeneratedPdf =
    Boolean(
      voucher.pvPdfGeneratedAt &&
      voucher.pvPdfFileName,
    ) &&
    (
      voucher.status ===
        'AWAITING_RECIPIENT_SIGNATURE' ||
      voucher.status ===
        'AWAITING_STAFF_CONFIRMATION' ||
      voucher.status ===
        'PENDING_FINANCE_VERIFICATION' ||
      voucher.status ===
        'COMPLETED' ||

      /*
       * Temporary legacy status.
       */
      voucher.status ===
        'AWAITING_SIGNED_PV_UPLOAD'
    );

  const pdfContainsRecipientSignature =
    Boolean(
      voucher.recipientSignedAt &&
      (
        voucher.recipientSignatureDataUrl ||
        voucher.signedPvDataUrl
      ),
    );

  function clearMessages() {
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handlePaymentProofChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    clearMessages();

    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      setPaymentProofFile(null);
      return;
    }

    if (
      !ALLOWED_PROOF_TYPES.includes(
        selectedFile.type,
      )
    ) {
      event.target.value = '';

      setPaymentProofFile(null);

      setErrorMessage(
        'Payment proof must be a PDF, PNG or JPG file.',
      );

      return;
    }

    if (
      selectedFile.size >
      MAX_PROOF_FILE_SIZE
    ) {
      event.target.value = '';

      setPaymentProofFile(null);

      setErrorMessage(
        'Payment proof must be 10 MB or smaller.',
      );

      return;
    }

    setPaymentProofFile(
      selectedFile,
    );
  }

  async function handleStartProcessing() {
    clearMessages();
    setIsProcessing(true);

    try {
      await startPaymentVoucherFinanceProcessing(
        voucher.id,
        finance.id,
      );

      await onUpdated?.();

      onProcessingStarted?.(
        voucher.id,
      );

      setSuccessMessage(
        'Finance processing has started. Continue with the payment information below.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start Finance processing.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSavePaymentInformation() {
    clearMessages();
    setIsProcessing(true);

    try {
      await savePaymentVoucherFinanceInformation(
        voucher.id,
        {
          financeId: finance.id,
          paymentDate,
          paymentReference,

          paymentProofFileName:
            paymentProofFile?.name,

          paymentRemarks,

        },
      );

      await onUpdated?.();

      setSuccessMessage(
        paymentProofFile
          ? 'Payment information has been saved. The selected proof filename is recorded; secure file storage will be connected with the PDF/document step.'
          : 'Payment information has been saved.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save payment information.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleGeneratePdf() {
    clearMessages();
    setIsProcessing(true);

    try {
      /*
       * Download the completed Finance PDF.
       * The PDF helper retrieves the saved
       * Director signature automatically.
       */
      await downloadPaymentVoucherPdf(
        voucher,
      );

      /*
       * Move the workflow to the recipient
       * signature stage and generate the
       * secure seven-day token.
       */
      const updatedVoucher =
        await recordPaymentVoucherPdfGenerated(
          voucher.id,
          finance.id,
        );

      await onUpdated?.();

      /*
       * Notify the original Staff submitter
       * that the PDF is ready.
       */
      notifyStaffPdfReady(
        updatedVoucher,
        finance,
      );

      setSuccessMessage(
        'The Payment Voucher PDF was generated. Staff has been notified to send the secure recipient link.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to generate the Payment Voucher PDF.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDownloadGeneratedPdf() {
    clearMessages();
    setIsProcessing(true);

    try {
      /*
       * A manually signed PV is already a
       * complete PDF uploaded by Staff. Download
       * that exact file so the handwritten
       * signature is preserved.
       */
      if (
        voucher.signedPvDataUrl &&
        voucher.signedPvFileName
      ) {
        const downloadLink =
          document.createElement('a');

        downloadLink.href =
          voucher.signedPvDataUrl;
        downloadLink.download =
          voucher.signedPvFileName;
        downloadLink.style.display =
          'none';

        document.body.appendChild(
          downloadLink,
        );
        downloadLink.click();
        downloadLink.remove();

        setSuccessMessage(
          'The manually signed Payment Voucher was downloaded.',
        );

        return;
      }

      /*
       * The same PDF builder is used again.
       * When the recipient has signed, their
       * signature is included automatically.
       */
      await downloadPaymentVoucherPdf(
        voucher,
      );

      setSuccessMessage(
        pdfContainsRecipientSignature
          ? 'The recipient-signed Payment Voucher was downloaded.'
          : 'The generated Payment Voucher was downloaded.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to download the Payment Voucher PDF.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleReturnSignedPv() {
    clearMessages();

    const cleanedRemarks =
      verificationRemarks.trim();

    if (!cleanedRemarks) {
      setErrorMessage(
        'Enter Finance remarks before returning the signed PV.',
      );

      return;
    }

    setIsProcessing(true);

    try {
      const updatedVoucher =
        await returnPaymentVoucherForNewSignature(
          voucher.id,
          finance.id,
          cleanedRemarks,
        );

      notifyStaffSignedPvReturned(
        updatedVoucher,
        finance,
      );

      await onUpdated?.();

      setVerificationRemarks('');
      setShowReturnForm(false);

      setSuccessMessage(
        'The signed PV was returned. Staff has been notified to send a new secure link to the recipient.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to return the signed Payment Voucher.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCompletePaymentVoucher() {
    clearMessages();
    setIsProcessing(true);

    try {
      const updatedVoucher =
        await completePaymentVoucher(
          voucher.id,
          finance.id,
        );

      notifyStaffPvCompleted(
        updatedVoucher,
        finance,
      );

      await onUpdated?.();

      setSuccessMessage(
        'The signed Payment Voucher was verified, completed and archived. Staff has been notified.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to complete the Payment Voucher.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleMarkInactive() {
    clearMessages();

    const cleanedRemarks =
      inactiveRemarks.trim();

    if (!cleanedRemarks) {
      setErrorMessage(
        'Enter the reason for marking this Payment Voucher as inactive.',
      );

      return;
    }

    setIsProcessing(true);

    try {
      const updatedVoucher =
        await markPaymentVoucherInactive(
          voucher.id,
          finance.id,
          cleanedRemarks,
        );

      notifyStaffPvInactive(
        updatedVoucher,
        finance,
      );

      setInactiveRemarks('');
      setShowInactiveForm(false);

      setSuccessMessage(
        'The Payment Voucher has been marked as inactive. Staff has been notified to create a new PV.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to mark the Payment Voucher as inactive.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <article className={styles.panel}>
      <header
        className={styles.panelHeader}
      >
        <div>
          <Link
            className={
              styles.voucherNumber
            }
            href={`/beta/payment-vouchers/${voucher.id}`}
          >
            {voucher.voucherNumber}
          </Link>

          <h2>
            {voucher.recipientName}
          </h2>

          <p>{voucher.purpose}</p>
        </div>

        <div
          className={styles.headerStatus}
        >
          <PaymentVoucherStatusBadge
            status={voucher.status}
          />

          <strong>
            {formatCurrency(
              voucher.amount,
            )}
          </strong>
        </div>
      </header>

      {voucher.status !== 'FINANCE_PROCESSING' && (
      <dl className={styles.summaryGrid}>
        <div>
          <dt>Division</dt>
          <dd>{voucher.division}</dd>
        </div>

        <div>
          <dt>PV date</dt>
          <dd>
            {formatDate(
              voucher.pvDate,
            )}
          </dd>
        </div>

        <div>
          <dt>Payment method</dt>
          <dd>
            {voucher.paymentMethod}
          </dd>
        </div>

        <div>
          <dt>Bank</dt>
          <dd>
            {voucher.bankName ||
              'Not applicable'}
          </dd>
        </div>

        <div>
          <dt>Bank account</dt>
          <dd>
            {voucher.bankAccountNumber ||
              'Not applicable'}
          </dd>
        </div>

        <div>
          <dt>Recipient reference</dt>
          <dd>
            {voucher.recipientReference}
          </dd>
        </div>
      </dl>
      )}

      {errorMessage && (
        <div
          className={
            styles.errorMessage
          }
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          className={
            styles.successMessage
          }
          role="status"
        >
          {successMessage}
        </div>
      )}

      {voucher.status ===
        'APPROVED_FOR_PAYMENT' && (
        <section
          className={
            styles.actionSection
          }
        >
          <div>
            <p className={styles.eyebrow}>
              Finance action
            </p>

            <h3>
              Ready for payment processing
            </h3>

            <p>
              Review the complete Payment
              Voucher before beginning the
              payment process.
            </p>
          </div>

          <div className={styles.actions}>
            <Link
              className={
                styles.secondaryButton
              }
              href={`/beta/payment-vouchers/${voucher.id}`}
            >
              Review full PV
            </Link>

            <button
              className={
                styles.primaryButton
              }
              disabled={isProcessing}
              onClick={
                handleStartProcessing
              }
              type="button"
            >
              {isProcessing
                ? 'Starting…'
                : 'Start payment processing'}
            </button>
          </div>
        </section>
      )}

      {voucher.status ===
        'FINANCE_PROCESSING' && (
        <section
          className={
            styles.processingWorkspace
          }
        >
          <aside className={styles.processingReference}>
            <section>
              <p className={styles.eyebrow}>Pay to</p>
              <dl className={styles.referenceList}>
                <div><dt>Bank</dt><dd>{voucher.bankName || 'Not applicable'}</dd></div>
                <div><dt>Bank account</dt><dd>{voucher.bankAccountNumber || 'Not applicable'}</dd></div>
                <div><dt>Recipient reference</dt><dd>{voucher.recipientReference}</dd></div>
              </dl>
            </section>

            <section>
              <p className={styles.eyebrow}>Voucher details</p>
              <dl className={styles.referenceList}>
                <div><dt>Division</dt><dd>{voucher.division}</dd></div>
                <div><dt>PV date</dt><dd>{formatDate(voucher.pvDate)}</dd></div>
                <div><dt>Payment method</dt><dd>{voucher.paymentMethod}</dd></div>
              </dl>
            </section>
          </aside>

          <div className={styles.processingEditor}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Payment information</p>
                <h3>Record the completed payment</h3>
                <p>Enter the payment details, attach proof when available, then generate the Payment Voucher.</p>
              </div>
              <span className={styles.editableBadge}>Editable</span>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Payment date</span>
                <input onChange={(event) => setPaymentDate(event.target.value)} required type="date" value={paymentDate} />
              </label>

              <label className={styles.field}>
                <span>Payment reference</span>
                <input onChange={(event) => setPaymentReference(event.target.value)} placeholder="Bank transaction ID" required type="text" value={paymentReference} />
              </label>

              <label className={styles.fileField}>
                <span>Payment proof <small>Optional</small></span>
                <input accept=".pdf,.png,.jpg,.jpeg" onChange={handlePaymentProofChange} type="file" />
                <small>PDF, PNG or JPG · maximum 10 MB</small>
              </label>

              <div className={styles.proofSummary}>
                <span>Current payment proof</span>
                <strong>{paymentProofFile?.name || voucher.paymentProofFileName || voucher.receiptFileName || 'No payment proof uploaded yet'}</strong>
              </div>

              <label className={styles.fullWidthField}>
                <span>Payment remarks <small>(optional)</small></span>
                <textarea maxLength={500} onChange={(event) => setPaymentRemarks(event.target.value)} placeholder="Anything Finance should note" rows={4} value={paymentRemarks} />
              </label>
            </div>

            <div className={styles.lockNotice}>Payment information will be locked after the PV PDF is generated.</div>

            <div className={styles.actions}>
              <button className={styles.secondaryButton} disabled={isProcessing} onClick={handleSavePaymentInformation} type="button">
                {isProcessing ? 'Saving…' : 'Save payment information'}
              </button>
              <button className={styles.primaryButton} disabled={isProcessing || !paymentInformationIsSaved} onClick={handleGeneratePdf} type="button">
                {isProcessing ? 'Generating PDF…' : 'Generate and download PV PDF'}
              </button>
            </div>
          </div>
        </section>
      )}

      {canDownloadGeneratedPdf && (
        <section
          className={
            styles.actionSection
          }
        >
          <div>
            <p className={styles.eyebrow}>
              Generated document
            </p>

            <h3>
              {pdfContainsRecipientSignature
                ? 'Recipient-signed Payment Voucher'
                : 'Payment Voucher PDF'}
            </h3>

            <p>
              {pdfContainsRecipientSignature
                ? voucher.signedPvFileName ||
                  `${voucher.voucherNumber}-signed.pdf`
                : voucher.pvPdfFileName}
            </p>

            <small>
              Generated on{' '}
              {formatDate(
                voucher.pvPdfGeneratedAt,
              )}
            </small>
          </div>

          <div className={styles.actions}>
            <button
              className={
                styles.secondaryButton
              }
              disabled={isProcessing}
              onClick={
                handleDownloadGeneratedPdf
              }
              type="button"
            >
              {isProcessing
                ? 'Preparing PDF…'
                : pdfContainsRecipientSignature
                  ? 'Download signed PV'
                  : 'Download generated PV'}
            </button>
          </div>
        </section>
      )}

      {voucher.status ===
        'AWAITING_RECIPIENT_SIGNATURE' && (
        <section
          className={
            styles.lockedSection
          }
        >
          <div
            className={styles.lockIcon}
          >
            ✓
          </div>

          <div>
            <p className={styles.eyebrow}>
              Finance payment completed
            </p>

            <h3>
              Waiting for recipient signature
            </h3>

            <p>
              The payment information and
              Finance-generated PDF are locked.
              Staff must send the secure link to
              the recipient.
            </p>

            <dl
              className={
                styles.processingInformation
              }
            >
              <div>
                <dt>Payment date</dt>

                <dd>
                  {formatDate(
                    voucher.paymentDate,
                  )}
                </dd>
              </div>

              <div>
                <dt>Payment reference</dt>

                <dd>
                  {voucher.paymentReference}
                </dd>
              </div>

              <div>
                <dt>Payment made by</dt>

                <dd>
                  {getAccountName(
                    voucher.paymentMadeById,
                  )}
                </dd>
              </div>

              <div>
                <dt>Generated PDF</dt>

                <dd>
                  {voucher.pvPdfFileName ||
                    'Not available'}
                </dd>
              </div>

              <div>
                <dt>Recipient link sent</dt>

                <dd>
                  {formatDate(
                    voucher.recipientLinkSentAt,
                  )}
                </dd>
              </div>

              <div>
                <dt>Recipient</dt>

                <dd>
                  {voucher.recipientName}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {voucher.status ===
        'AWAITING_STAFF_CONFIRMATION' && (
        <section
          className={
            styles.lockedSection
          }
        >
          <div
            className={styles.lockIcon}
          >
            ✓
          </div>

          <div>
            <p className={styles.eyebrow}>
              Recipient signed
            </p>

            <h3>
              Waiting for Staff confirmation
            </h3>

            <p>
              The recipient confirmed payment
              and signed the Payment Voucher.
              Staff must review the signed PV and
              confirm receipt before Finance can
              archive it.
            </p>

            <dl
              className={
                styles.processingInformation
              }
            >
              <div>
                <dt>Recipient</dt>

                <dd>
                  {voucher.recipientName}
                </dd>
              </div>

              <div>
                <dt>Recipient signed</dt>

                <dd>
                  {formatDate(
                    voucher.recipientSignedAt,
                  )}
                </dd>
              </div>

              <div>
                <dt>Signed PV</dt>

                <dd>
                  {voucher.signedPvFileName ||
                    `${voucher.voucherNumber}-signed.pdf`}
                </dd>
              </div>

              <div>
                <dt>Staff confirmation</dt>

                <dd>Pending</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {voucher.status ===
        'PENDING_FINANCE_VERIFICATION' && (
        <section
          className={
            styles.verificationSection
          }
        >
          <div
            className={
              styles.sectionHeading
            }
          >
            <div>
              <p
                className={
                  styles.eyebrow
                }
              >
                Archive verification
              </p>

              <h3>
                Verify the signed PV
              </h3>

              <p>
                The recipient signed the
                Payment Voucher and Staff
                confirmed receipt. Perform the
                final verification before
                completing the record.
              </p>
            </div>

            <span
              className={
                styles.processingBadge
              }
            >
              Action required
            </span>
          </div>

          <dl
            className={
              styles.processingInformation
            }
          >
            <div>
              <dt>Signed PV</dt>

              <dd>
                {voucher.signedPvFileName ||
                  'Not available'}
              </dd>
            </div>

            <div>
              <dt>Recipient signed</dt>

              <dd>
                {formatDate(
                  voucher.recipientSignedAt,
                )}
              </dd>
            </div>

            <div>
              <dt>Recipient</dt>

              <dd>
                {voucher.recipientName}
              </dd>
            </div>

            <div>
              <dt>Staff confirmed</dt>

              <dd>
                {formatDate(
                  voucher.staffConfirmedSignedPvAt ??
                    voucher.staffVerifiedAt,
                )}
              </dd>
            </div>
          </dl>

          {voucher
            .recipientSignatureDataUrl && (
            <div
              className={
                styles.recipientSignatureReview
              }
            >
              <div>
                <p className={styles.eyebrow}>
                  Recipient signature
                </p>

                <h4>
                  {voucher.recipientName}
                </h4>
              </div>

              <div
                className={
                  styles.recipientSignatureImage
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`Signature submitted by ${voucher.recipientName}`}
                  src={
                    voucher
                      .recipientSignatureDataUrl
                  }
                />
              </div>
            </div>
          )}

          {showReturnForm && (
            <label
              className={
                styles.fullWidthField
              }
            >
              <span>
                Reason for returning
              </span>

              <textarea
                maxLength={500}
                onChange={(event) =>
                  setVerificationRemarks(
                    event.target.value,
                  )
                }
                placeholder="Explain what the recipient needs to correct"
                rows={4}
                value={verificationRemarks}
              />
            </label>
          )}

          <div className={styles.actions}>
            <button
              className={
                styles.secondaryButton
              }
              disabled={isProcessing}
              onClick={
                handleDownloadGeneratedPdf
              }
              type="button"
            >
              {isProcessing
                ? 'Preparing PDF…'
                : 'Download signed PV'}
            </button>

            <button
              className={
                styles.secondaryButton
              }
              disabled={isProcessing}
              onClick={() => {
                if (showReturnForm) {
                  handleReturnSignedPv();
                } else {
                  setShowReturnForm(true);
                }
              }}
              type="button"
            >
              {showReturnForm
                ? 'Confirm return'
                : 'Return for new signature'}
            </button>

            {showReturnForm && (
              <button
                className={
                  styles.cancelButton
                }
                disabled={isProcessing}
                onClick={() => {
                  setShowReturnForm(false);
                  setVerificationRemarks('');
                }}
                type="button"
              >
                Cancel
              </button>
            )}

            <button
              className={
                styles.completeButton
              }
              disabled={isProcessing}
              onClick={
                handleCompletePaymentVoucher
              }
              type="button"
            >
              {isProcessing
                ? 'Completing…'
                : 'Verify and complete'}
            </button>
          </div>
        </section>
      )}

      {voucher.status ===
        'COMPLETED' && (
        <section
          className={
            styles.completedSection
          }
        >
          <div
            className={styles.lockIcon}
          >
            ✓
          </div>

          <div>
            <p className={styles.eyebrow}>
              Archived
            </p>

            <h3>
              Payment Voucher completed
            </h3>

            <p>
              Finance verified the signed
              Payment Voucher. This record is
              completed, archived and locked.
            </p>

            <dl
              className={
                styles.processingInformation
              }
            >
              <div>
                <dt>Recipient signed</dt>

                <dd>
                  {formatDate(
                    voucher.recipientSignedAt,
                  )}
                </dd>
              </div>

              <div>
                <dt>Staff confirmed</dt>

                <dd>
                  {formatDate(
                    voucher.staffVerifiedAt,
                  )}
                </dd>
              </div>

              <div>
                <dt>Finance verified</dt>

                <dd>
                  {formatDate(
                    voucher.financeVerifiedAt,
                  )}
                </dd>
              </div>

              <div>
                <dt>Completed by</dt>

                <dd>
                  {getAccountName(
                    voucher.financeCompletedById,
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {voucher.status ===
        'INACTIVE' && (
        <section
          className={
            styles.inactiveSection
          }
        >
          <div>
            <p className={styles.eyebrow}>
              Inactive record
            </p>

            <h3>
              This Payment Voucher cannot
              continue
            </h3>

            <p>
              {voucher.inactiveRemarks ||
                'No Finance remarks were recorded.'}
            </p>

            <dl
              className={
                styles.processingInformation
              }
            >
              <div>
                <dt>Marked inactive</dt>

                <dd>
                  {formatDate(
                    voucher.inactiveAt,
                  )}
                </dd>
              </div>

              <div>
                <dt>Marked by</dt>

                <dd>
                  {getAccountName(
                    voucher.inactiveById,
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {canMarkInactive &&
        voucher.status !== 'INACTIVE' && (
        <section
          className={
            styles.inactiveActionSection
          }
        >
          <button
            className={
              styles.dangerLink
            }
            onClick={() =>
              setShowInactiveForm(
                (current) => !current,
              )
            }
            type="button"
          >
            {showInactiveForm
              ? 'Cancel inactive action'
              : 'Bank rejected payment or incorrect information'}
          </button>

          {showInactiveForm && (
            <div
              className={
                styles.inactiveForm
              }
            >
              <label
                className={
                  styles.fullWidthField
                }
              >
                <span>
                  Reason for marking
                  inactive
                </span>

                <textarea
                  maxLength={500}
                  onChange={(event) =>
                    setInactiveRemarks(
                      event.target.value,
                    )
                  }
                  placeholder="Explain the bank rejection or incorrect payment information"
                  rows={4}
                  value={inactiveRemarks}
                />
              </label>

              <p>
                This action locks the
                original PV. Staff must
                create a new Payment
                Voucher.
              </p>

              <button
                className={
                  styles.dangerButton
                }
                disabled={
                  isProcessing ||
                  !inactiveRemarks.trim()
                }
                onClick={
                  handleMarkInactive
                }
                type="button"
              >
                Mark Payment Voucher
                inactive
              </button>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

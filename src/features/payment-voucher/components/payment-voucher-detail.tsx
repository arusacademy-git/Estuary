'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PaymentPageState } from '@/shared/payment-page-state';

import {
  betaAccounts,
  readBetaSession,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';

import {
  amountToMalayWords,
} from '@/lib/currency/amount-words';

import type {
  CreateNotificationInput,
} from '@/domain/notifications/types';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  approvePaymentVoucher,
  rejectPaymentVoucher,
  submitDraftPaymentVoucher,
} from '@/data/payment-vouchers/payment-voucher-api';

import {
  useUserSignature,
} from '@/features/signatures/hooks/use-user-signature';

import {
  createLocalNotification,
} from '@/data/notifications/local-notification-store';

import {
  usePaymentVouchers,
} from '@/features/payment-voucher/hooks/use-payment-vouchers';

import {
  PaymentVoucherCorrectionCard,
} from '@/features/payment-voucher/components/payment-voucher-correction-card';

import {
  downloadPaymentVoucherPdf,
} from '@/features/payment-voucher/pdf/download-payment-voucher-pdf';

import {
  PaymentVoucherApprovalPanel,
} from '@/features/payment-voucher/components/director/director-approval-panel';

import {
  PaymentVoucherStatusBadge,
} from '@/features/payment-voucher/components/payment-voucher-status-badge';

import {
  PaymentVoucherTracker,
} from '@/features/payment-voucher/components/payment-voucher-tracker';

import {
  RecipientLinkPanel,
} from '@/features/payment-voucher/components/staff/recipient-link-panel';

import {
  StaffSignedPvConfirmationPanel,
} from '@/features/payment-voucher/components/staff/staff-signed-pv-confirmation-panel';

import styles from '@/features/payment-voucher/components/payment-voucher.module.css';
import detailOverrides from './payment-voucher-detail-overrides.module.css';

type PaymentVoucherDetailProps = {
  voucherId: string;
};

type NextAction = {
  title: string;
  description: string;
};


function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getAccountName(accountId?: string) {
  if (!accountId) {
    return 'Not assigned';
  }

  const account = betaAccounts.find(
    (item) => item.id === accountId,
  );

  return account?.name ?? accountId;
}

function getNextAction(
  voucher: PaymentVoucherRecord,
  directorName: string,
): NextAction {
  switch (voucher.status) {
    case 'DRAFT':
      return {
        title: 'Complete the Payment Voucher',
        description:
          'Review the information and submit it to the assigned Director.',
      };

    case 'PENDING_DIRECTOR_APPROVAL':
      return {
        title: `Waiting for ${directorName}`,
        description:
          'The assigned Director needs to review, approve or reject this Payment Voucher.',
      };

    case 'REJECTED':
      return {
        title: 'Amendment required',
        description:
          'Review the Director’s remarks, amend the Payment Voucher and resubmit it.',
      };

    case 'APPROVED_FOR_PAYMENT':
      return {
        title: 'Ready for Finance',
        description:
          'The Director approved this Payment Voucher. Finance can begin processing the payment.',
      };

    case 'FINANCE_PROCESSING':
      return {
        title: 'Finance is processing payment',
        description:
          'Finance is recording the payment information, uploading payment proof and preparing the completed PDF.',
      };

    case 'AWAITING_RECIPIENT_SIGNATURE':
      if (
        voucher.recipientSignatureMethod ===
        'MANUAL'
      ) {
        return {
          title:
            'Waiting for manually signed PV',
          description:
            `${voucher.recipientName} selected manual signing. The recipient can upload the signed PDF through the secure link, or the original requester can upload a copy received by email.`,
        };
      }

      if (voucher.recipientLinkSentAt) {
        return {
          title: 'Waiting for recipient signature',
          description:
            `The secure link was sent to ${voucher.recipientName}. Waiting for the recipient to confirm and sign the Payment Voucher.`,
        };
      }

      return {
        title: 'Send secure link to recipient',
        description:
          `Finance generated the completed PV. The original requester must send the secure link to ${voucher.recipientName}.`,
      };

    case 'AWAITING_STAFF_CONFIRMATION':
      return {
        title: 'Requester confirmation required',
        description:
          voucher.recipientSignatureMethod ===
            'MANUAL'
            ? `${voucher.recipientName} uploaded a manually signed Payment Voucher. The original requester must review the PDF and confirm receipt.`
            : `${voucher.recipientName} signed the Payment Voucher digitally. The original requester must review it and confirm receipt.`,
      };

    case 'PENDING_FINANCE_VERIFICATION':
      return {
        title: 'Waiting for Finance verification',
        description:
          'The original requester confirmed receipt of the recipient-signed Payment Voucher. Finance must perform the final archive verification.',
      };

    case 'COMPLETED':
      return {
        title: 'Payment Voucher completed',
        description:
          'Finance verified the signed Payment Voucher. The workflow is complete and the record is locked.',
      };

    case 'INACTIVE':
      return {
        title: 'Payment Voucher inactive',
        description:
          voucher.inactiveRemarks ||
          'This Payment Voucher is inactive. Create a new Payment Voucher if another payment attempt is required.',
      };

    /*
     * Temporary legacy statuses.
     */
    case 'AWAITING_SIGNED_PV_UPLOAD':
      return {
        title: 'Recipient signature required',
        description:
          'This older record is waiting for a recipient-signed Payment Voucher.',
      };

    case 'AWAITING_STAFF_VERIFICATION':
      return {
        title: 'Staff verification required',
        description:
          'This record is using the previous Staff verification workflow.',
      };

    case 'AWAITING_SIGNATURE':
      return {
        title: 'Waiting for recipient signature',
        description:
          'This record is using the previous recipient-signature workflow.',
      };

    default:
      return {
        title: 'Check current progress',
        description:
          'Review the Payment Progress tracker for the current workflow stage.',
      };
  }
}

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

export function PaymentVoucherDetail({
  voucherId,
}: PaymentVoucherDetailProps) {
  const searchParams = useSearchParams();

  const [account, setAccount] =
    useState<BetaAccount | null>(null);

  const {
    signature: activeDirectorSignature,
    isLoading: isDirectorSignatureLoading,
  } = useUserSignature(
    account?.role === 'director'
      ? account.id
      : undefined,
  );

  const [
    downloadingDocument,
    setDownloadingDocument,
  ] = useState<
    'generated' | 'signed' | null
  >(null);

  const [
    isSubmittingDraft,
    setIsSubmittingDraft,
  ] = useState(false);

  const [
    draftSubmissionError,
    setDraftSubmissionError,
  ] = useState('');

  const [
    draftSubmissionSuccess,
    setDraftSubmissionSuccess,
  ] = useState('');

  const {
    records,
    isLoading,
    refresh,
  } = usePaymentVouchers();

  useEffect(() => {
    setAccount(readBetaSession());
  }, []);

  const wasSubmitted =
    searchParams.get('submitted') === 'true';

  const matchedVoucher = records.find(
    (record) =>
      record.id === voucherId ||
      record.voucherNumber === voucherId,
  );

  if (isLoading) {
    return <PaymentPageState title="Loading Payment Voucher" copy="Reading the payment record…" backHref="/beta/payment-records" backLabel="Back to Payment Records" />;
  }

  if (!matchedVoucher) {
    return (
      <section
        className={styles.pvDetailState}
      >
        <h1>Payment Voucher not found</h1>

        <p>
          This Payment Voucher does not
          exist in the current dummy
          records.
        </p>

        <Link
          className={
            styles.pvDetailSecondaryButton
          }
          href="/beta/payment-vouchers"
        >
          Back to payment records
        </Link>
      </section>
    );
  }

  /*
   * After the check above, TypeScript now
   * knows that this is a complete record.
   */
  const voucher: PaymentVoucherRecord =
    matchedVoucher;

  const directorName = getAccountName(
    voucher.directorId,
  );

  const submitterName = getAccountName(
    voucher.submitterId,
  );

  const projectManagerName =
    getAccountName(
      voucher.projectManagerId,
    );

  const nextAction = getNextAction(
    voucher,
    directorName,
  );

  const amountInWords =
    amountToMalayWords(voucher.amount);

  const totalTaxAmount =
    voucher.lines.reduce(
      (total, line) =>
        total + line.taxAmount,
      0,
    );

  const subtotalAmount =
    voucher.amount - totalTaxAmount;

  const canSubmitDraft =
    account?.id ===
    voucher.submitterId &&
    voucher.status === 'DRAFT';

  const canAmend =
    account?.id === voucher.submitterId &&
    voucher.status === 'REJECTED';


  const canCurrentDirectorApprove =
    account?.role === 'director' &&
    account.id === voucher.directorId &&
    voucher.status ===
    'PENDING_DIRECTOR_APPROVAL';

  const viewingOwnSubmission =
    account?.id === voucher.submitterId;

  const backHref =
    viewingOwnSubmission
      ? '/beta/payment-vouchers?scope=mine'
      : '/beta/payment-vouchers';

  const backLabel =
    viewingOwnSubmission
      ? 'Back to my Payment Vouchers'
      : 'Back to Payment Vouchers';

  async function handleSubmitDraft() {
    setDraftSubmissionError('');
    setDraftSubmissionSuccess('');

    if (
      !account
    ) {
      setDraftSubmissionError(
        'Sign in before submitting this Payment Voucher.',
      );

      return;
    }

    if (
      voucher.submitterId !==
      account.id
    ) {
      setDraftSubmissionError(
        'Only the person who created this Payment Voucher can submit it.',
      );

      return;
    }

    if (
      voucher.status !== 'DRAFT'
    ) {
      setDraftSubmissionError(
        'Only a draft Payment Voucher can be submitted.',
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Submit ${voucher.voucherNumber} to ${directorName} for approval?`,
      );

    if (!confirmed) {
      return;
    }

    setIsSubmittingDraft(true);

    try {
      const submittedVoucher =
        await submitDraftPaymentVoucher(
          voucher.id,
          account.id,
        );

      createNotificationSafely({
        recipientId:
          submittedVoucher.directorId,

        actorId: account.id,

        type:
          'PAYMENT_VOUCHER_SUBMITTED',

        entityType:
          'PAYMENT_VOUCHER',

        entityId:
          submittedVoucher.id,

        referenceNumber:
          submittedVoucher.voucherNumber,

        title:
          'Payment Voucher requires approval',

        message:
          `${submittedVoucher.voucherNumber} was submitted by ${account.name} and requires your approval.`,

        href:
          `/beta/payment-vouchers/${submittedVoucher.id}`,
      });

      setDraftSubmissionSuccess(
        `Payment Voucher submitted to ${directorName}.`,
      );

      refresh();
    } catch (error) {
      setDraftSubmissionError(
        error instanceof Error
          ? error.message
          : 'Unable to submit the Payment Voucher.',
      );
    } finally {
      setIsSubmittingDraft(false);
    }
  }

  async function handleDirectorApprove(
    selectedVoucher:
      PaymentVoucherRecord,
  ) {
    if (
      !account ||
      account.role !== 'director'
    ) {
      throw new Error(
        'Only a Director can approve this Payment Voucher.',
      );
    }

    if (
      selectedVoucher.directorId !==
      account.id
    ) {
      throw new Error(
        'This Payment Voucher is assigned to another Director.',
      );
    }

    const currentSignature =
      activeDirectorSignature;

    if (!currentSignature) {
      throw new Error(
        'Upload your Director signature in Settings before approving this Payment Voucher.',
      );
    }

    const approvedVoucher =
      await approvePaymentVoucher(
        selectedVoucher.id,
        account.id,
        currentSignature.id,
      );

    createNotificationSafely({
      recipientId:
        approvedVoucher.submitterId,
      actorId: account.id,
      type: 'PAYMENT_VOUCHER_APPROVED',
      entityType: 'PAYMENT_VOUCHER',
      entityId: approvedVoucher.id,
      referenceNumber:
        approvedVoucher.voucherNumber,
      title:
        'Payment Voucher approved',
      message:
        `${approvedVoucher.voucherNumber} was approved by ${account.name} and is ready for Finance.`,
      href:
        `/beta/payment-vouchers/${approvedVoucher.id}`,
    });

    if (
      approvedVoucher.projectManagerId
    ) {
      createNotificationSafely({
        recipientId:
          approvedVoucher.projectManagerId,
        actorId: account.id,
        type:
          'PAYMENT_VOUCHER_APPROVED',
        entityType: 'PAYMENT_VOUCHER',
        entityId: approvedVoucher.id,
        referenceNumber:
          approvedVoucher.voucherNumber,
        title:
          'Payment Voucher ready for preview',
        message:
          `${approvedVoucher.voucherNumber} was approved by ${account.name}. Please preview the Payment Voucher information.`,
        href:
          '/beta/project-manager/payment-vouchers',
      });
    }

    betaAccounts
      .filter(
        (candidate) =>
          candidate.role === 'finance',
      )
      .forEach((financeAccount) => {
        createNotificationSafely({
          recipientId:
            financeAccount.id,
          actorId: account.id,
          type:
            'PAYMENT_VOUCHER_APPROVED',
          entityType:
            'PAYMENT_VOUCHER',
          entityId:
            approvedVoucher.id,
          referenceNumber:
            approvedVoucher.voucherNumber,
          title:
            'Payment Voucher ready for Finance',
          message:
            `${approvedVoucher.voucherNumber} was approved by ${account.name} and is ready for processing.`,
          href:
            `/beta/payment-vouchers/${approvedVoucher.id}`,
        });
      });

    refresh();
  }

  async function handleDirectorReject(
    selectedVoucher:
      PaymentVoucherRecord,
    remarks: string,
  ) {
    if (
      !account ||
      account.role !== 'director'
    ) {
      throw new Error(
        'Only a Director can reject this Payment Voucher.',
      );
    }

    if (
      selectedVoucher.directorId !==
      account.id
    ) {
      throw new Error(
        'This Payment Voucher is assigned to another Director.',
      );
    }

    const rejectedVoucher =
      await rejectPaymentVoucher(
        selectedVoucher.id,
        account.id,
        remarks,
      );

    createNotificationSafely({
      recipientId:
        rejectedVoucher.submitterId,
      actorId: account.id,
      type: 'PAYMENT_VOUCHER_REJECTED',
      entityType: 'PAYMENT_VOUCHER',
      entityId: rejectedVoucher.id,
      referenceNumber:
        rejectedVoucher.voucherNumber,
      title:
        'Payment Voucher requires amendment',
      message:
        `${rejectedVoucher.voucherNumber} was rejected by ${account.name}. Remarks: ${remarks.trim()}`,
      href:
        `/beta/payment-vouchers/${rejectedVoucher.id}`,
    });

    refresh();
  }

  async function handleDownloadGeneratedPv() {
    setDownloadingDocument('generated');

    try {
      /*
       * Remove the recipient signature from
       * the temporary copy. This downloads
       * the original Finance-generated PV.
       */
      const generatedVoucher:
        PaymentVoucherRecord = {
        ...voucher,
        recipientSignatureDataUrl:
          undefined,
        recipientSignedAt:
          undefined,
        signedPvFileName:
          undefined,
        signedPvDataUrl:
          undefined,
        signedPvUploadSource:
          undefined,
      };

      await downloadPaymentVoucherPdf(
        generatedVoucher,
        {
          recipientSignatureDataUrl:
            null,
        },
      );
    } catch (error) {
      console.error(
        'Unable to download the generated Payment Voucher.',
        error,
      );

      window.alert(
        'Unable to download the generated Payment Voucher.',
      );
    } finally {
      setDownloadingDocument(null);
    }
  }

  async function handleDownloadSignedPv() {
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
      downloadLink.style.display = 'none';

      document.body.appendChild(
        downloadLink,
      );
      downloadLink.click();
      downloadLink.remove();
      return;
    }

    if (
      !voucher.recipientSignatureDataUrl
    ) {
      window.alert(
        'The recipient signature is not available yet.',
      );

      return;
    }

    setDownloadingDocument('signed');

    try {
      await downloadPaymentVoucherPdf(
        voucher,
      );
    } catch (error) {
      console.error(
        'Unable to download the signed Payment Voucher.',
        error,
      );

      window.alert(
        'Unable to download the signed Payment Voucher.',
      );
    } finally {
      setDownloadingDocument(null);
    }
  }

  return (
    <div className={styles.pvDetailPage}>
      <Link className={detailOverrides.recordBackLink} href={backHref}>
        ← {backLabel}
      </Link>

      {wasSubmitted && (
        <div
          className={
            styles.pvDetailSuccess
          }
          role="status"
        >
          <span
            aria-hidden="true"
            className={
              styles.pvDetailSuccessIcon
            }
          >
            ✓
          </span>

          <div>
            <strong>
              Payment Voucher submitted.
            </strong>

            <p>
              It has been sent to{' '}
              {directorName} for approval.
            </p>
          </div>
        </div>
      )}

      <header
        className={
          styles.pvDetailHeader
        }
      >
        <div>
          <p
            className={
              styles.pvDetailEyebrow
            }
          >
            Payment Voucher
          </p>

          <div
            className={
              styles.pvDetailTitleRow
            }
          >
            <h1>
              {voucher.voucherNumber}
            </h1>

            <PaymentVoucherStatusBadge
              status={voucher.status}
            />
          </div>

        </div>

      </header>

      {voucher.status !== 'REJECTED' && <section className={styles.pvNextAction}>
        <span
          aria-hidden="true"
          className={
            styles.pvNextActionIcon
          }
        >
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </span>

        <div
          className={
            styles.pvNextActionCopy
          }
        >
          <p className={styles.pvDetailEyebrow}>Current next action</p>
          <h2>{nextAction.title}</h2>
          <p>{nextAction.description}</p>
        </div>

        <div
          className={
            styles.pvNextActionDocumentActions
          }
        >
          {voucher.signedPvFileName &&
            (voucher.recipientSignatureDataUrl ||
              voucher.signedPvDataUrl) ? (
            <button
              className={
                styles.pvDetailPrimaryButton
              }
              disabled={
                downloadingDocument !== null
              }
              onClick={
                handleDownloadSignedPv
              }
              type="button"
            >
              {downloadingDocument === 'signed'
                ? 'Preparing PDF…'
                : (
                  <>
                    <svg
                      aria-hidden="true"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                    Download Signed PV
                  </>
                )}
            </button>
          ) : voucher.pvPdfFileName ? (
            <button
              className={
                styles.pvDetailPrimaryButton
              }
              disabled={
                downloadingDocument !== null
              }
              onClick={
                handleDownloadGeneratedPv
              }
              type="button"
            >
              {downloadingDocument === 'generated'
                ? 'Preparing PDF…'
                : (
                  <>
                    <svg
                      aria-hidden="true"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                    Download PV
                  </>
                )}
            </button>
          ) : null}
        </div>

      </section>}

      <div
        className={styles.pvDetailLayout}
      >
        <main
          className={styles.pvDetailMain}
        >

          {account?.id === voucher.submitterId &&
            voucher.status ===
            'AWAITING_RECIPIENT_SIGNATURE' && (
              <RecipientLinkPanel
                voucher={voucher}
                requesterUserId={account.id}
                onUpdated={refresh}
              />
            )}

          {account?.id === voucher.submitterId &&
            voucher.status ===
            'AWAITING_STAFF_CONFIRMATION' && (
              <StaffSignedPvConfirmationPanel
                voucher={voucher}
                requesterUserId={account.id}
                onUpdated={refresh}
              />
            )}

          <div
            className={
              styles.pvDetailContentCard
            }
          >
            <section
              className={
                styles.pvDetailSection
              }
            >
              <div
                className={
                  styles.pvSectionHeading
                }
              >
                <h2>Payment Details</h2>

                <span>
                  Reference:{' '}
                  {voucher.voucherNumber}
                </span>
              </div>

              <dl
                className={
                  styles.pvInformationGrid
                }
              >
                <div>
                  <dt>PV date</dt>
                  <dd>
                    {formatDate(
                      voucher.pvDate,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Submitter</dt>
                  <dd>{submitterName}</dd>
                </div>

                <div>
                  <dt>Organization</dt>
                  <dd>
                    {voucher.organizationId}
                  </dd>
                </div>

                <div>
                  <dt>Created</dt>
                  <dd>
                    {formatDate(
                      voucher.createdAt,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    Assigned Director
                  </dt>
                  <dd>{directorName}</dd>
                </div>

                <div>
                  <dt>Division</dt>
                  <dd>{voucher.division}</dd>
                </div>

                <div>
                  <dt>Last updated</dt>
                  <dd>
                    {formatDate(
                      voucher.updatedAt,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Project Manager</dt>
                  <dd>
                    {projectManagerName}
                  </dd>
                </div>

                <div>
                  <dt>
                    Director approval date
                  </dt>
                  <dd>
                    {formatDate(
                      voucher.directorApprovedAt,
                    )}
                  </dd>
                </div>
              </dl>

              <div
                className={
                  styles.pvPurposeSummary
                }
              >
                <div>
                  <span>
                    Purpose of payment
                  </span>
                  <p>{voucher.purpose}</p>
                </div>

                <div>
                  <span>
                    Amount in words
                  </span>
                  <p>{amountInWords}</p>
                </div>
              </div>
            </section>

            <section
              className={
                styles.pvDetailSection
              }
            >
              <div
                className={
                  styles.pvSectionHeading
                }
              >
                <h2>
                  Recipient Details
                </h2>

                {(voucher.recipientSignedAt ||
                  voucher.status === 'COMPLETED') && (
                    <span
                      className={
                        styles.pvVerifiedBadge
                      }
                    >
                      Verified Payee
                    </span>
                  )}
              </div>

              <dl
                className={
                  styles.pvInformationGrid
                }
              >
                <div>
                  <dt>Recipient name</dt>
                  <dd>
                    {voucher.recipientName}
                  </dd>
                </div>

                <div>
                  <dt>Recipient email</dt>
                  <dd>
                    {voucher.recipientEmail}
                  </dd>
                </div>

                <div>
                  <dt>Payment method</dt>
                  <dd>
                    {voucher.paymentMethod}
                  </dd>
                </div>

                <div>
                  <dt>
                    IC / identity number
                  </dt>
                  <dd>
                    {voucher.recipientIc ||
                      'Not provided'}
                  </dd>
                </div>

                <div>
                  <dt>Bank name</dt>
                  <dd>
                    {voucher.bankName ||
                      'Not applicable'}
                  </dd>
                </div>

                <div>
                  <dt>
                    Recipient reference
                  </dt>
                  <dd>
                    {
                      voucher.recipientReference
                    }
                  </dd>
                </div>

                <div>
                  <dt>Malaysian</dt>
                  <dd>
                    {voucher.recipientIsMalaysian
                      ? 'Yes'
                      : 'No'}
                  </dd>
                </div>

                <div>
                  <dt>
                    Bank account number
                  </dt>
                  <dd>
                    {voucher.bankAccountNumber ||
                      'Not applicable'}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              className={
                styles.pvBreakdownCard
              }
            >
              <div
                className={
                  styles.pvBreakdownHeader
                }
              >
                <h2>
                  Payment Breakdown
                </h2>

                <span>
                  Itemized accounting receipt •{' '}
                  {voucher.lines.length}{' '}
                  {voucher.lines.length === 1
                    ? 'line item'
                    : 'line items'}
                </span>
              </div>

              <div
                className={
                  styles.pvTableWrapper
                }
              >
                <table
                  className={
                    styles.pvBreakdownTable
                  }
                >
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>Unit amount</th>
                      <th>Tax</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {voucher.lines.map(
                      (line, index) => {
                        const lineTotal =
                          line.quantity *
                          line.unitAmount +
                          line.taxAmount;

                        return (
                          <tr
                            key={`${line.accountCode}-${index}`}
                          >
                            <td>
                              <strong>
                                {
                                  line.accountCode
                                }
                              </strong>
                            </td>

                            <td>
                              {line.description}
                            </td>

                            <td>
                              {line.quantity}
                            </td>

                            <td>
                              {formatCurrency(
                                line.unitAmount,
                              )}
                            </td>

                            <td>
                              {formatCurrency(
                                line.taxAmount,
                              )}
                            </td>

                            <td>
                              <strong>
                                {formatCurrency(
                                  lineTotal,
                                )}
                              </strong>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>

                </table>
              </div>

              <div
                className={
                  styles.pvBreakdownSummary
                }
              >
                <dl>
                  <div>
                    <dt>Subtotal</dt>
                    <dd>
                      {formatCurrency(
                        subtotalAmount,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Tax</dt>
                    <dd>
                      {formatCurrency(
                        totalTaxAmount,
                      )}
                    </dd>
                  </div>
                </dl>

                <div>
                  <span>Amount in words</span>
                  <p>{amountInWords}</p>
                </div>

                <div>
                  <span>Grand total</span>
                  <strong>
                    {formatCurrency(
                      voucher.amount,
                    )}
                  </strong>
                </div>
              </div>
            </section>

            {(voucher.financeReviewedAt ||
              voucher.paymentReference ||
              voucher.paymentProofFileName ||
              voucher.receiptFileName ||
              voucher.pvPdfFileName ||
              voucher.recipientLinkSentAt ||
              voucher.recipientSignatureMethod ||
              voucher.recipientSignedAt ||
              voucher.signedPvFileName ||
              voucher.staffConfirmedSignedPvAt ||
              voucher.staffVerifiedAt ||
              voucher.financeVerifiedAt) && (
                <section
                  className={
                    styles.pvDetailSection
                  }
                >
                  <div
                    className={
                      styles.pvSectionHeading
                    }
                  >
                    <h2>
                      Finance &amp; Document
                      Processing Audit
                    </h2>

                    {(voucher.financeVerifiedAt ||
                      voucher.status === 'COMPLETED') && (
                        <span
                          className={
                            styles.pvAuditBadge
                          }
                        >
                          Signed &amp; Verified
                        </span>
                      )}
                  </div>

                  <dl
                    className={
                      styles.pvInformationGrid
                    }
                  >
                    <div>
                      <dt>
                        Finance reviewed
                      </dt>
                      <dd>
                        {formatDate(
                          voucher.financeReviewedAt,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Payment date</dt>
                      <dd>
                        {formatDate(
                          voucher.paymentDate,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Payment reference
                      </dt>
                      <dd>
                        {voucher.paymentReference ||
                          'Not available'}
                      </dd>
                    </div>

                    <div>
                      <dt>Payment proof</dt>
                      <dd>
                        {voucher.paymentProofFileName ||
                          voucher.receiptFileName ||
                          'Not uploaded'}
                      </dd>
                    </div>

                    <div>
                      <dt>Generated PV</dt>

                      <dd>
                        {voucher.pvPdfFileName ? (
                          <button
                            className={
                              styles.pvFileLink
                            }
                            disabled={
                              downloadingDocument !==
                              null
                            }
                            onClick={
                              handleDownloadGeneratedPv
                            }
                            type="button"
                          >
                            {downloadingDocument ===
                              'generated'
                              ? 'Preparing PDF…'
                              : voucher.pvPdfFileName}
                          </button>
                        ) : (
                          'Not generated'
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Recipient link sent
                      </dt>
                      <dd>
                        {formatDate(
                          voucher.recipientLinkSentAt,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Recipient signed
                      </dt>
                      <dd>
                        {formatDate(
                          voucher.recipientSignedAt,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>Signing method</dt>
                      <dd>
                        {voucher.recipientSignatureMethod === 'DIGITAL'
                          ? 'Digital signature'
                          : voucher.recipientSignatureMethod === 'MANUAL'
                            ? 'Manual signature'
                            : 'Not selected'}
                      </dd>
                    </div>

                    <div>
                      <dt>Signed PV uploaded by</dt>
                      <dd>
                        {voucher.signedPvUploadSource === 'RECIPIENT'
                          ? 'Recipient'
                          : voucher.signedPvUploadSource === 'STAFF'
                            ? 'Requester'
                            : 'Not available'}
                      </dd>
                    </div>

                    <div>
                      <dt>Signed PV</dt>

                      <dd>
                        {voucher.signedPvFileName &&
                          (voucher.recipientSignatureDataUrl ||
                            voucher.signedPvDataUrl) ? (
                          <button
                            className={
                              styles.pvFileLink
                            }
                            disabled={
                              downloadingDocument !==
                              null
                            }
                            onClick={
                              handleDownloadSignedPv
                            }
                            type="button"
                          >
                            {downloadingDocument ===
                              'signed'
                              ? 'Preparing PDF…'
                              : voucher.signedPvFileName}
                          </button>
                        ) : (
                          'Not generated'
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Requester confirmed
                      </dt>
                      <dd>
                        {formatDate(
                          voucher.staffConfirmedSignedPvAt ??
                          voucher.staffVerifiedAt,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        Finance verified
                      </dt>
                      <dd>
                        {formatDate(
                          voucher.financeVerifiedAt,
                        )}
                      </dd>
                    </div>
                  </dl>
                </section>
              )}
          </div>
        </main>

        <aside
          className={
            styles.pvTrackerColumn
          }
        >
          {canSubmitDraft && (
            <section className={styles.pvSubmitterActionCard}>
              <p className={styles.pvDetailEyebrow}>Submitter action</p>
              <h2>Submit Payment Voucher</h2>
              <p>Send this completed voucher to the assigned Director for approval.</p>

              {draftSubmissionError && (
                <div className={styles.pvActionError} role="alert">
                  {draftSubmissionError}
                </div>
              )}

              {draftSubmissionSuccess && (
                <div className={styles.pvActionSuccess} role="status">
                  {draftSubmissionSuccess}
                </div>
              )}

              <button
                className={`${styles.pvDetailPrimaryButton} ${styles.pvSubmitDraftButton}`}
                disabled={isSubmittingDraft}
                onClick={handleSubmitDraft}
                type="button"
              >
                {isSubmittingDraft ? 'Submitting…' : 'Submit to Director'}
              </button>
            </section>
          )}

          <PaymentVoucherCorrectionCard
            canAmend={canAmend}
            directorName={directorName}
            voucher={voucher}
          />

          {canCurrentDirectorApprove &&
            account && (
              <div
                className={
                  styles.pvDirectorActionStack
                }
              >
                {!isDirectorSignatureLoading &&
                  !activeDirectorSignature && (
                    <div
                      className={
                        styles.directorSignatureRequired
                      }
                    >
                      <strong>
                        Director signature
                        required
                      </strong>

                      <p>
                        Upload your signature
                        before approving this
                        Payment Voucher.
                      </p>

                      <Link href="/beta/settings/signature">
                        Set up signature
                      </Link>
                    </div>
                  )}

                <PaymentVoucherApprovalPanel
                  voucher={voucher}
                  directorName={
                    account.name
                  }
                  onApprove={
                    handleDirectorApprove
                  }
                  onReject={
                    handleDirectorReject
                  }
                />
              </div>
            )}

          <div
            className={
              styles.pvTrackerSpacing
            }
          >
            <div
              className={
                styles.pvTrackerSticky
              }
            >
              <PaymentVoucherTracker
                voucher={voucher}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

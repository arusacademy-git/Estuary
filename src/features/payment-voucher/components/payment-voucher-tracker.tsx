import {
  betaAccounts,
} from '@/lib/auth/beta-accounts';

import type {
  PaymentVoucherStatus,
} from '@/domain/payment-vouchers/status';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import styles from './payment-voucher.module.css';

type TrackerStepState =
  | 'completed'
  | 'current'
  | 'pending'
  | 'rejected';

type TrackerStep = {
  id: string;
  title: string;
  description: string;
  state: TrackerStepState;
  informational?: boolean;
};

type TrackerGuidance = {
  title: string;
  description: string;
};

/*
 * These statuses mean Director approval
 * has already been completed.
 */
const AFTER_DIRECTOR_APPROVAL_STATUSES =
  new Set<PaymentVoucherStatus>([
    'APPROVED_FOR_PAYMENT',
    'FINANCE_PROCESSING',
    'AWAITING_RECIPIENT_SIGNATURE',
    'AWAITING_STAFF_CONFIRMATION',
    'PENDING_FINANCE_VERIFICATION',
    'COMPLETED',
    'INACTIVE',

    /*
     * Legacy statuses retained for old
     * localStorage records.
     */
    'AWAITING_SIGNED_PV_UPLOAD',
    'AWAITING_STAFF_VERIFICATION',
    'AWAITING_SIGNATURE',
  ]);

/*
 * These statuses mean Finance has already
 * processed the payment and generated the PDF.
 */
const AFTER_FINANCE_PROCESSING_STATUSES =
  new Set<PaymentVoucherStatus>([
    'AWAITING_RECIPIENT_SIGNATURE',
    'AWAITING_STAFF_CONFIRMATION',
    'PENDING_FINANCE_VERIFICATION',
    'COMPLETED',

    /*
     * Legacy statuses.
     */
    'AWAITING_SIGNED_PV_UPLOAD',
    'AWAITING_STAFF_VERIFICATION',
    'AWAITING_SIGNATURE',
  ]);

/*
 * These statuses mean the recipient has
 * already signed and confirmed the PV.
 */
const AFTER_RECIPIENT_SIGNATURE_STATUSES =
  new Set<PaymentVoucherStatus>([
    'AWAITING_STAFF_CONFIRMATION',
    'PENDING_FINANCE_VERIFICATION',
    'COMPLETED',
  ]);

/*
 * These statuses mean Staff has already
 * confirmed receiving the signed PV.
 */
const AFTER_STAFF_CONFIRMATION_STATUSES =
  new Set<PaymentVoucherStatus>([
    'PENDING_FINANCE_VERIFICATION',
    'COMPLETED',
  ]);

function getStepStateClass(
  state: TrackerStepState,
) {
  const stateClasses: Record<
    TrackerStepState,
    string
  > = {
    completed: styles.trackerStepCompleted,
    current: styles.trackerStepCurrent,
    pending: styles.trackerStepPending,
    rejected: styles.trackerStepRejected,
  };

  return stateClasses[state];
}

function getMarkerContent(
  state: TrackerStepState,
  stepNumber: number,
) {
  if (state === 'completed') {
    return '✓';
  }

  if (state === 'rejected') {
    return '×';
  }

  return String(stepNumber);
}

function createTrackerSteps(
  voucher: PaymentVoucherRecord,
  directorName: string,
): TrackerStep[] {
  const directorApproved =
    Boolean(voucher.directorApprovedAt) ||
    AFTER_DIRECTOR_APPROVAL_STATUSES.has(
      voucher.status,
    );

  const financeProcessingCompleted =
    Boolean(voucher.pvPdfGeneratedAt) ||
    AFTER_FINANCE_PROCESSING_STATUSES.has(
      voucher.status,
    );

  const recipientSigned =
    Boolean(voucher.recipientSignedAt) ||
    Boolean(
      voucher.recipientSignatureDataUrl,
    ) ||
    AFTER_RECIPIENT_SIGNATURE_STATUSES.has(
      voucher.status,
    );

  const staffConfirmed =
    AFTER_STAFF_CONFIRMATION_STATUSES.has(
      voucher.status,
    ) ||
    Boolean(voucher.staffVerifiedAt);

  /*
   * Step 1: Staff submission.
   */
  const submissionState: TrackerStepState =
    voucher.status === 'DRAFT'
      ? 'current'
      : 'completed';

  /*
   * Step 2: Director approval.
   */
  let directorState: TrackerStepState =
    'pending';

  if (
    voucher.status ===
    'PENDING_DIRECTOR_APPROVAL'
  ) {
    directorState = 'current';
  } else if (voucher.status === 'REJECTED') {
    directorState = 'rejected';
  } else if (directorApproved) {
    directorState = 'completed';
  }

  /*
   * Step 3: Project Manager preview.
   *
   * This step is informational and does not
   * block Finance processing.
   */
  let projectManagerState:
    TrackerStepState = 'pending';

  if (voucher.projectManagerViewedAt) {
    projectManagerState = 'completed';
  } else if (directorApproved) {
    /*
     * Manager preview is informational.
     * It remains available even when the
     * voucher has moved to a later stage.
     */
    projectManagerState = 'current';
  }

  /*
   * Step 4: Finance records payment details
   * and generates the completed PV PDF.
   */
  let financeState: TrackerStepState =
    'pending';

  if (
    voucher.status ===
    'APPROVED_FOR_PAYMENT' ||
    voucher.status ===
    'FINANCE_PROCESSING'
  ) {
    financeState = 'current';
  } else if (financeProcessingCompleted) {
    financeState = 'completed';
  } else if (voucher.status === 'INACTIVE') {
    financeState = 'rejected';
  }

  /*
   * Step 5: Staff sends the secure link and
   * the recipient reviews and signs the PV.
   */
  let recipientSignatureState:
    TrackerStepState = 'pending';

  if (
    voucher.status ===
    'AWAITING_RECIPIENT_SIGNATURE' ||
    voucher.status ===
    'AWAITING_SIGNED_PV_UPLOAD' ||
    voucher.status ===
    'AWAITING_STAFF_VERIFICATION' ||
    voucher.status ===
    'AWAITING_SIGNATURE'
  ) {
    recipientSignatureState = 'current';
  } else if (recipientSigned) {
    recipientSignatureState = 'completed';
  }

  /*
   * Step 6: Staff confirms that the signed
   * PV was received successfully.
   */
  let staffConfirmationState:
    TrackerStepState = 'pending';

  if (
    voucher.status ===
    'AWAITING_STAFF_CONFIRMATION'
  ) {
    staffConfirmationState = 'current';
  } else if (staffConfirmed) {
    staffConfirmationState = 'completed';
  }

  /*
   * Step 7: Finance performs the final
   * archive verification.
   */
  let financeVerificationState:
    TrackerStepState = 'pending';

  if (
    voucher.status ===
    'PENDING_FINANCE_VERIFICATION'
  ) {
    financeVerificationState = 'current';
  } else if (
    voucher.status === 'COMPLETED'
  ) {
    financeVerificationState = 'completed';
  }

  /*
   * Step 8: Final completed state.
   */
  const completedState: TrackerStepState =
    voucher.status === 'COMPLETED'
      ? 'completed'
      : 'pending';

  return [
    {
      id: 'submission',
      title: 'Payment Voucher submitted',

      description:
        submissionState === 'completed'
          ? 'Staff submitted the Payment Voucher successfully.'
          : 'Complete the Payment Voucher and submit it for Director approval.',

      state: submissionState,
    },

    {
      id: 'director-approval',
      title: 'Director approval and signature',

      description:
        directorState === 'rejected'
          ? `${directorName} rejected the Payment Voucher. Staff must review the remarks and amend it.`
          : directorState === 'completed'
            ? `${directorName} approved and signed the Payment Voucher.`
            : directorState === 'current'
              ? `Waiting for ${directorName} to review, approve and sign the Payment Voucher.`
              : 'Director review begins after Staff submits the Payment Voucher.',

      state: directorState,
    },

    {
      id: 'project-manager-preview',
      title: 'Manager preview',

      description:
        projectManagerState === 'completed'
          ? 'The Manager has viewed the approved Payment Voucher.'
          : projectManagerState === 'current'
            ? 'The approved Payment Voucher is available for the Manager to preview.'
            : 'The Manager can preview the Payment Voucher after Director approval.',

      state: projectManagerState,
      informational: true,
    },

    {
      id: 'finance-processing',
      title: 'Finance payment processing',

      description:
        financeState === 'rejected'
          ? 'Finance marked this Payment Voucher as inactive. Review the remarks and create a new PV if required.'
          : financeState === 'completed'
            ? 'Finance recorded the payment information and generated the completed PV PDF.'
            : voucher.status ===
              'FINANCE_PROCESSING'
              ? 'Finance is recording the payment date, reference and payment proof before generating the PV PDF.'
              : voucher.status ===
                'APPROVED_FOR_PAYMENT'
                ? 'The approved Payment Voucher is ready for Finance processing.'
                : 'Finance processing begins after Director approval.',

      state: financeState,
    },

    {
      id: 'recipient-signature',
      title: 'Recipient verification and signature',

      description:
        recipientSignatureState ===
          'completed'
          ? `${voucher.recipientName} verified and signed the Payment Voucher.`
          : recipientSignatureState ===
            'current'
            ? voucher.recipientLinkSentAt
              ? `The secure link was sent to ${voucher.recipientName}. Waiting for the recipient to verify and sign the Payment Voucher.`
              : `Staff must send the secure Payment Voucher link to ${voucher.recipientName}.`
            : 'The recipient can review and sign after Finance generates the completed PV PDF.',

      state: recipientSignatureState,
    },

    {
      id: 'staff-confirmation',
      title: 'Staff confirms signed PV',

      description:
        staffConfirmationState ===
          'completed'
          ? 'Staff confirmed that the signed Payment Voucher was received.'
          : staffConfirmationState ===
            'current'
            ? 'The recipient has signed the Payment Voucher. Staff must review it and confirm receipt.'
            : 'Staff confirmation becomes available after the recipient submits their signature.',

      state: staffConfirmationState,
    },

    {
      id: 'finance-verification',
      title: 'Finance archive verification',

      description:
        financeVerificationState ===
          'completed'
          ? 'Finance verified the completed signed Payment Voucher.'
          : financeVerificationState ===
            'current'
            ? 'Finance must verify the signed Payment Voucher before completing and archiving it.'
            : 'Final Finance verification begins after Staff confirms receipt of the signed PV.',

      state: financeVerificationState,
    },

    {
      id: 'completed',
      title: 'Payment Voucher completed',

      description:
        completedState === 'completed'
          ? 'The Payment Voucher is complete, archived and locked.'
          : voucher.status === 'INACTIVE'
            ? 'This Payment Voucher is inactive and cannot continue.'
            : 'The Payment Voucher will be completed after final Finance verification.',

      state: completedState,
    },
  ];
}

function getTrackerGuidance(
  voucher: PaymentVoucherRecord,
  directorName: string,
): TrackerGuidance {
  switch (voucher.status) {
    case 'DRAFT':
      return {
        title: 'Complete this draft',
        description:
          'Finish the Payment Voucher information and submit it for Director approval.',
      };

    case 'PENDING_DIRECTOR_APPROVAL':
      return {
        title: `Waiting for ${directorName}`,
        description:
          'The Payment Voucher has been submitted. The assigned Director must review, approve and sign it.',
      };

    case 'REJECTED':
      return {
        title: 'Amendment required',
        description:
          voucher.rejectionRemarks
            ? `Director remarks: ${voucher.rejectionRemarks}`
            : 'Review the Director remarks, amend the Payment Voucher and submit it again.',
      };

    case 'APPROVED_FOR_PAYMENT':
      return {
        title: 'Approved for payment',
        description:
          'The Project Manager can preview this Payment Voucher while Finance prepares to process the payment.',
      };

    case 'FINANCE_PROCESSING':
      return {
        title: 'Finance is processing payment',
        description:
          'Finance is entering the payment date, payment reference and payment proof before generating the completed PV PDF.',
      };

    case 'AWAITING_RECIPIENT_SIGNATURE':
      if (!voucher.recipientLinkSentAt) {
        return {
          title: 'Send secure link to recipient',
          description:
            `Finance has generated the PV PDF. Staff must send the secure link to ${voucher.recipientName} at ${voucher.recipientEmail}.`,
        };
      }

      return {
        title: 'Waiting for recipient signature',
        description:
          `The secure link was sent to ${voucher.recipientName}. Waiting for the recipient to verify and sign the Payment Voucher.`,
      };

    case 'AWAITING_STAFF_CONFIRMATION':
      return {
        title: 'Staff confirmation required',
        description:
          `${voucher.recipientName} has signed the Payment Voucher. Staff must review the signed PV and confirm that it was received.`,
      };

    case 'PENDING_FINANCE_VERIFICATION':
      return {
        title: 'Waiting for Finance verification',
        description:
          'Staff confirmed receipt of the signed Payment Voucher. Finance must perform the final verification before completing the record.',
      };

    case 'COMPLETED':
      return {
        title: 'Payment Voucher completed',
        description:
          'Finance verified the signed Payment Voucher. The record is complete, archived and locked.',
      };

    case 'INACTIVE':
      return {
        title: 'Payment Voucher inactive',
        description:
          voucher.inactiveRemarks
            ? `Finance remarks: ${voucher.inactiveRemarks}`
            : 'Finance marked this Payment Voucher as inactive. Create a new PV if payment is still required.',
      };

    /*
     * Legacy statuses.
     */
    case 'AWAITING_SIGNED_PV_UPLOAD':
      return {
        title: 'Recipient action required',
        description:
          'This record uses the previous signed-PV workflow. Send the Payment Voucher to the recipient for verification and signature.',
      };

    case 'AWAITING_STAFF_VERIFICATION':
      return {
        title: 'Staff action required',
        description:
          'This record uses the previous Staff verification workflow. Review the available payment information.',
      };

    case 'AWAITING_SIGNATURE':
      return {
        title: 'Waiting for recipient signature',
        description:
          'This record uses the previous signature workflow. Waiting for the recipient to sign the Payment Voucher.',
      };

    /*
     * This prevents old or unexpected data
     * in localStorage from crashing the page.
     */
    default:
      return {
        title: 'Status update unavailable',
        description:
          `The status "${String(
            voucher.status,
          )}" is not recognised. Reset the dummy Payment Voucher data if this is an old record.`,
      };
  }
}

export function PaymentVoucherTracker({
  voucher,
}: {
  voucher: PaymentVoucherRecord;
}) {
  const director = betaAccounts.find(
    (account) =>
      account.id === voucher.directorId,
  );

  const directorName =
    director?.name ??
    'the assigned Director';

  const trackerSteps =
    createTrackerSteps(
      voucher,
      directorName,
    );

  const guidance =
    getTrackerGuidance(
      voucher,
      directorName,
    );

  return (
    <section className={styles.tracker}>
      <header
        className={styles.trackerHeader}
      >
        <div>
          <p
            className={
              styles.trackerEyebrow
            }
          >
            Payment progress
          </p>

          <h2>
            Track this Payment Voucher
          </h2>

          <p>
            Follow every stage from
            submission until completion.
          </p>
        </div>
      </header>

      <ol className={styles.trackerList}>
        {trackerSteps.map(
          (step, index) => (
            <li
              className={`${styles.trackerStep} ${getStepStateClass(
                step.state,
              )}`}
              key={step.id}
            >
              <div
                aria-hidden="true"
                className={
                  styles.trackerMarker
                }
              >
                {getMarkerContent(
                  step.state,
                  index + 1,
                )}
              </div>

              <div
                className={
                  styles.trackerStepContent
                }
              >
                <div
                  className={
                    styles.trackerStepTitle
                  }
                >
                  <h3>{step.title}</h3>

                  {step.informational && (
                    <span>
                      Informational
                    </span>
                  )}
                </div>

                <p>{step.description}</p>
              </div>
            </li>
          ),
        )}
      </ol>

      <aside
        className={
          styles.trackerGuidance
        }
      >
        <span>Current update</span>

        <strong>{guidance.title}</strong>

        <p>{guidance.description}</p>
      </aside>
    </section>
  );
}
'use client';

import {
  useState,
} from 'react';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import styles from '../payment-voucher.module.css';

type PaymentVoucherApprovalPanelProps = {
  voucher: PaymentVoucherRecord;
  directorName: string;

  onApprove: (
    voucher: PaymentVoucherRecord,
  ) => void | Promise<void>;

  onReject: (
    voucher: PaymentVoucherRecord,
    remarks: string,
  ) => void | Promise<void>;
};

type DecisionMode =
  | 'idle'
  | 'approve'
  | 'reject';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(amount);
}

export function PaymentVoucherApprovalPanel({
  voucher,
  directorName,
  onApprove,
  onReject,
}: PaymentVoucherApprovalPanelProps) {
  const [decisionMode, setDecisionMode] =
    useState<DecisionMode>('idle');

  const [reviewConfirmed, setReviewConfirmed] =
    useState(false);

  const [rejectionRemarks, setRejectionRemarks] =
    useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [actionError, setActionError] =
    useState('');

  async function handleApprove() {
    if (!reviewConfirmed) {
      setActionError(
        'Please confirm that you reviewed the Payment Voucher.',
      );

      return;
    }

    setIsSubmitting(true);
    setActionError('');

    try {
      await onApprove(voucher);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to approve this Payment Voucher.',
      );

      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    const normalizedRemarks =
      rejectionRemarks.trim();

    if (normalizedRemarks.length < 5) {
      setActionError(
        'Please provide a clear reason for rejecting this Payment Voucher.',
      );

      return;
    }

    setIsSubmitting(true);
    setActionError('');

    try {
      await onReject(
        voucher,
        normalizedRemarks,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to reject this Payment Voucher.',
      );

      setIsSubmitting(false);
    }
  }

  function openApprovalConfirmation() {
    setActionError('');
    setDecisionMode('approve');
  }

  function openRejectionForm() {
    setActionError('');
    setReviewConfirmed(false);
    setDecisionMode('reject');
  }

  function cancelDecision() {
    setActionError('');
    setReviewConfirmed(false);
    setRejectionRemarks('');
    setDecisionMode('idle');
  }

  return (
    <section
      className={styles.directorApprovalPanel}
    >
      <header
        className={styles.directorApprovalHeader}
      >
        <div>
          <p
            className={
              styles.directorApprovalEyebrow
            }
          >
            Director action
          </p>

          <h2>Review and decide</h2>

          <p>
            This Payment Voucher is assigned to{' '}
            <strong>{directorName}</strong>.
          </p>
        </div>

        <span
          className={
            styles.directorApprovalPending
          }
        >
          Action required
        </span>
      </header>

      <div
        className={styles.directorApprovalSummary}
      >
        <div>
          <span>PV number</span>
          <strong>{voucher.voucherNumber}</strong>
        </div>

        <div>
          <span>Recipient</span>
          <strong>{voucher.recipientName}</strong>
        </div>

        <div>
          <span>Amount</span>
          <strong>
            {formatCurrency(voucher.amount)}
          </strong>
        </div>
      </div>

      <div
        className={
          styles.directorReviewChecklist
        }
      >
        <p>Before making a decision, review:</p>

        <ul>
          <li>Recipient and bank information</li>
          <li>Purpose of payment</li>
          <li>Voucher lines and total amount</li>
          <li>Supporting documents, when provided</li>
        </ul>
      </div>

      {actionError && (
        <div
          className={
            styles.directorApprovalError
          }
          role="alert"
        >
          {actionError}
        </div>
      )}

      {decisionMode === 'idle' && (
        <div
          className={
            styles.directorDecisionActions
          }
        >
          <button
            className={
              styles.directorApproveButton
            }
            type="button"
            onClick={
              openApprovalConfirmation
            }
          >
            Approve Payment Voucher
          </button>

          <button
            className={
              styles.directorRejectButton
            }
            type="button"
            onClick={openRejectionForm}
          >
            Reject
          </button>
        </div>
      )}

      {decisionMode === 'approve' && (
        <div
          className={
            styles.directorDecisionForm
          }
        >
          <div
            className={
              styles.directorDecisionHeading
            }
          >
            <div>
              <h3>Confirm approval</h3>

              <p>
                Approval will send this Payment
                Voucher to Finance.
              </p>
            </div>
          </div>

          <label
            className={
              styles.directorConfirmation
            }
          >
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(event) =>
                setReviewConfirmed(
                  event.target.checked,
                )
              }
            />

            <span>
              I confirm that I reviewed the Payment
              Voucher details and supporting
              information.
            </span>
          </label>

          <div
            className={
              styles.directorFormActions
            }
          >
            <button
              className={
                styles.directorSecondaryButton
              }
              type="button"
              disabled={isSubmitting}
              onClick={cancelDecision}
            >
              Cancel
            </button>

            <button
              className={
                styles.directorApproveButton
              }
              type="button"
              disabled={
                isSubmitting ||
                !reviewConfirmed
              }
              onClick={handleApprove}
            >
              {isSubmitting
                ? 'Approving…'
                : 'Confirm approval'}
            </button>
          </div>
        </div>
      )}

      {decisionMode === 'reject' && (
        <div
          className={
            styles.directorDecisionForm
          }
        >
          <div
            className={
              styles.directorDecisionHeading
            }
          >
            <div>
              <h3>Reject Payment Voucher</h3>

              <p>
                Explain what Staff must amend before
                resubmitting.
              </p>
            </div>
          </div>

          <label
            className={
              styles.directorRemarksField
            }
          >
            <span>
              Rejection remarks
              <strong aria-hidden="true"> *</strong>
            </span>

            <textarea
              rows={5}
              value={rejectionRemarks}
              placeholder="For example: Please correct the recipient bank account number and attach the supporting invoice."
              maxLength={500}
              onChange={(event) => {
                setRejectionRemarks(
                  event.target.value,
                );

                if (actionError) {
                  setActionError('');
                }
              }}
            />

            <small>
              {rejectionRemarks.length}/500 characters
            </small>
          </label>

          <div
            className={
              styles.directorFormActions
            }
          >
            <button
              className={
                styles.directorSecondaryButton
              }
              type="button"
              disabled={isSubmitting}
              onClick={cancelDecision}
            >
              Cancel
            </button>

            <button
              className={
                styles.directorRejectConfirmButton
              }
              type="button"
              disabled={
                isSubmitting ||
                rejectionRemarks.trim().length < 5
              }
              onClick={handleReject}
            >
              {isSubmitting
                ? 'Rejecting…'
                : 'Confirm rejection'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
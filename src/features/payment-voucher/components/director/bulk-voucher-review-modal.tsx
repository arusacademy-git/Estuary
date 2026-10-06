'use client';

import {
  useEffect,
  useMemo,
} from 'react';

import {
  amountToMalayWords,
} from '@/lib/currency/amount-words';

import {
  betaAccounts,
} from '@/lib/auth/beta-accounts';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  PaymentVoucherStatusBadge,
} from '../payment-voucher-status-badge';

import styles from './director-bulk-approval.module.css';

type BulkVoucherReviewModalProps = {
  vouchers: PaymentVoucherRecord[];
  currentVoucherId: string;
  reviewedVoucherIds: string[];

  onClose: () => void;

  onChangeVoucher: (
    voucherId: string,
  ) => void;

  onMarkReviewed: (
    voucherId: string,
  ) => void;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(amount);
}

function formatDate(value: string) {
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

function getAccountName(accountId: string) {
  const account = betaAccounts.find(
    (candidate) =>
      candidate.id === accountId,
  );

  return account?.name ?? accountId;
}

export function BulkVoucherReviewModal({
  vouchers,
  currentVoucherId,
  reviewedVoucherIds,
  onClose,
  onChangeVoucher,
  onMarkReviewed,
}: BulkVoucherReviewModalProps) {
  const currentIndex = useMemo(
    () =>
      vouchers.findIndex(
        (voucher) =>
          voucher.id === currentVoucherId,
      ),
    [currentVoucherId, vouchers],
  );

  const voucher =
    currentIndex >= 0
      ? vouchers[currentIndex]
      : undefined;

  const previousVoucher =
    currentIndex > 0
      ? vouchers[currentIndex - 1]
      : undefined;

  const nextVoucher =
    currentIndex >= 0 &&
    currentIndex < vouchers.length - 1
      ? vouchers[currentIndex + 1]
      : undefined;

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [onClose]);

  if (!voucher) {
    return null;
  }

  const hasBeenReviewed =
    reviewedVoucherIds.includes(
      voucher.id,
    );

  const amountInWords =
    amountToMalayWords(voucher.amount);

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-labelledby="bulk-review-title"
        aria-modal="true"
        className={styles.reviewModal}
        role="dialog"
      >
        <header
          className={styles.reviewModalHeader}
        >
          <div>
            <p className={styles.eyebrow}>
              Review selected voucher
            </p>

            <div
              className={
                styles.reviewModalTitleRow
              }
            >
              <h1 id="bulk-review-title">
                {voucher.voucherNumber}
              </h1>

              <PaymentVoucherStatusBadge
                status={voucher.status}
              />

              {hasBeenReviewed && (
                <span
                  className={
                    styles.reviewedBadge
                  }
                >
                  Reviewed
                </span>
              )}
            </div>

            <p>
              Voucher {currentIndex + 1} of{' '}
              {vouchers.length}
            </p>
          </div>

          <button
            aria-label="Close voucher review"
            className={
              styles.modalCloseButton
            }
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className={styles.reviewModalBody}>
          <section
            className={
              styles.modalInformationSection
            }
          >
            <h2>Payment details</h2>

            <dl
              className={
                styles.modalInformationGrid
              }
            >
              <div>
                <dt>PV date</dt>
                <dd>
                  {formatDate(voucher.pvDate)}
                </dd>
              </div>

              <div>
                <dt>Submitter</dt>
                <dd>
                  {getAccountName(
                    voucher.submitterId,
                  )}
                </dd>
              </div>

              <div>
                <dt>Assigned Director</dt>
                <dd>
                  {getAccountName(
                    voucher.directorId,
                  )}
                </dd>
              </div>

              <div>
                <dt>Division</dt>
                <dd>{voucher.division}</dd>
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
            </dl>

            <div
              className={
                styles.modalPurposeSummary
              }
            >
              <div>
                <span>
                  Purpose of payment
                </span>

                <p>{voucher.purpose}</p>
              </div>

              <div>
                <span>Amount in words</span>

                <p>{amountInWords}</p>
              </div>
            </div>
          </section>

          <section
            className={
              styles.modalInformationSection
            }
          >
            <h2>Recipient information</h2>

            <dl
              className={
                styles.modalInformationGrid
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
                <dt>
                  IC / identity number
                </dt>

                <dd>
                  {voucher.recipientIc ||
                    'Not provided'}
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
                <dt>Payment method</dt>
                <dd>
                  {voucher.paymentMethod}
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
                  Bank account number
                </dt>

                <dd>
                  {voucher.bankAccountNumber ||
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
            </dl>
          </section>

          <section
            className={
              styles.modalBreakdownSection
            }
          >
            <div
              className={
                styles.modalSectionHeading
              }
            >
              <h2>Payment breakdown</h2>

              <span>
                {voucher.lines.length}{' '}
                {voucher.lines.length === 1
                  ? 'line'
                  : 'lines'}
              </span>
            </div>

            <div
              className={
                styles.modalTableWrapper
              }
            >
              <table
                className={
                  styles.modalBreakdownTable
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
                            {
                              line.accountCode
                            }
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

                <tfoot>
                  <tr>
                    <td colSpan={5}>
                      Grand total
                    </td>

                    <td>
                      <strong>
                        {formatCurrency(
                          voucher.amount,
                        )}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>

        <footer
          className={styles.reviewModalFooter}
        >
          <div
            className={
              styles.modalNavigationButtons
            }
          >
            <button
              disabled={!previousVoucher}
              onClick={() => {
                if (previousVoucher) {
                  onChangeVoucher(
                    previousVoucher.id,
                  );
                }
              }}
              type="button"
            >
              Previous
            </button>

            <button
              disabled={!nextVoucher}
              onClick={() => {
                if (nextVoucher) {
                  onChangeVoucher(
                    nextVoucher.id,
                  );
                }
              }}
              type="button"
            >
              Next
            </button>
          </div>

          <div
            className={
              styles.modalDecisionButtons
            }
          >
            <button
              className={
                styles.modalCancelButton
              }
              onClick={onClose}
              type="button"
            >
              Close
            </button>

            <button
              className={
                styles.markReviewedButton
              }
              disabled={hasBeenReviewed}
              onClick={() =>
                onMarkReviewed(voucher.id)
              }
              type="button"
            >
              {hasBeenReviewed
                ? 'Reviewed'
                : 'Mark as reviewed'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
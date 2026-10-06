'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  fetchPaymentVoucherByRecipientToken,
} from '@/data/payment-vouchers/payment-voucher-api';

import {
  createLocalNotification,
} from '@/data/notifications/local-notification-store';

import {
  downloadPaymentVoucherPdf,
} from '@/features/payment-voucher/pdf/download-payment-voucher-pdf';

import {
  PaymentVoucherStatusBadge,
} from '@/features/payment-voucher/components/payment-voucher-status-badge';

import {
  RecipientSignaturePanel,
} from './recipient-signature-panel';

import styles from './recipient-payment-voucher.module.css';

type RecipientPaymentVoucherViewProps = {
  token: string;
};

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
    },
  ).format(date);
}

function isRecipientLinkExpired(
  voucher: PaymentVoucherRecord,
) {
  if (!voucher.recipientAccessExpiresAt) {
    return false;
  }

  return new Date(
    voucher.recipientAccessExpiresAt,
  ).getTime() <= Date.now();
}

export function RecipientPaymentVoucherView({
  token,
}: RecipientPaymentVoucherViewProps) {
  const [
    voucher,
    setVoucher,
  ] =
    useState<PaymentVoucherRecord | null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    isDownloading,
    setIsDownloading,
  ] = useState(false);

  const loadVoucher =
    useCallback(async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const matchingVoucher =
          await fetchPaymentVoucherByRecipientToken(
            token,
          );

        /*
         * If the recipient has already signed,
         * allow them to see the successful
         * submission screen even if the link
         * later expires.
         */
        const signatureAlreadySubmitted =
          Boolean(
            matchingVoucher
              .recipientSignedAt,
          );

        if (
          isRecipientLinkExpired(
            matchingVoucher,
          ) &&
          !signatureAlreadySubmitted
        ) {
          setVoucher(
            matchingVoucher,
          );

          setErrorMessage(
            'This secure recipient link has expired. Please contact the Estuary staff member who sent the Payment Voucher.',
          );

          return;
        }

        setVoucher(
          matchingVoucher,
        );
      } catch (error) {
        setVoucher(null);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to open this Payment Voucher.',
        );
      } finally {
        setIsLoading(false);
      }
    }, [token]);

  useEffect(() => {
    loadVoucher();
  }, [loadVoucher]);

  async function handleDownloadPdf() {
    if (!voucher) {
      return;
    }

    setIsDownloading(true);
    setErrorMessage('');

    try {
      await downloadPaymentVoucherPdf(
        voucher,
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

  function notifyStaffSignatureSubmitted(
    updatedVoucher:
      PaymentVoucherRecord,
  ) {
    try {
      createLocalNotification({
        recipientId:
          updatedVoucher.submitterId,

        type:
          'SIGNED_PAYMENT_VOUCHER_UPLOADED',

        entityType:
          'PAYMENT_VOUCHER',

        entityId:
          updatedVoucher.id,

        referenceNumber:
          updatedVoucher.voucherNumber,

        title:
          'Recipient signed the Payment Voucher',

        message:
          `${updatedVoucher.recipientName} confirmed payment and signed ${updatedVoucher.voucherNumber}. Review the signed Payment Voucher and confirm receipt.`,

        href:
          `/beta/payment-vouchers/${updatedVoucher.id}`,
      });
    } catch (notificationError) {
      console.error(
        'The recipient signature was saved, but the Staff notification could not be created.',
        notificationError,
      );
    }
  }

  function handleSignatureSubmitted(
    updatedVoucher:
      PaymentVoucherRecord,
  ) {
    notifyStaffSignatureSubmitted(
      updatedVoucher,
    );

    setVoucher(
      updatedVoucher,
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  if (isLoading) {
    return (
      <main
        className={styles.publicPage}
      >
        <section
          className={styles.stateCard}
        >
          <p className={styles.eyebrow}>
            Estuary secure recipient portal
          </p>

          <h1>
            Opening Payment Voucher…
          </h1>

          <p>
            Please wait while we verify
            your secure link.
          </p>
        </section>
      </main>
    );
  }

  if (!voucher) {
    return (
      <main
        className={styles.publicPage}
      >
        <section
          className={styles.stateCard}
        >
          <div
            className={styles.errorIcon}
          >
            !
          </div>

          <p className={styles.eyebrow}>
            Estuary secure recipient portal
          </p>

          <h1>
            Payment Voucher unavailable
          </h1>

          <p>
            {errorMessage ||
              'The Payment Voucher could not be found.'}
          </p>
        </section>
      </main>
    );
  }

  const linkExpired =
    isRecipientLinkExpired(
      voucher,
    );

  const signatureSubmitted =
    Boolean(
      voucher.recipientSignedAt,
    );

  /*
   * Important:
   * This must use the new token-based
   * recipient status.
   */
  const canSubmitSignature =
    voucher.status ===
      'AWAITING_RECIPIENT_SIGNATURE' &&
    !linkExpired &&
    !signatureSubmitted;

  return (
    <main className={styles.publicPage}>
      <header
        className={styles.publicHeader}
      >
        <div>
          <p className={styles.brand}>
            Estuary
          </p>

          <p
            className={
              styles.brandDescription
            }
          >
            Secure Payment Voucher
            confirmation
          </p>
        </div>

        <span
          className={styles.secureLabel}
        >
          Secure recipient link
        </span>
      </header>

      <div
        className={styles.noticeContainer}
      >
        {signatureSubmitted && (
          <div
            className={
              styles.successNotice
            }
          >
            <span
              aria-hidden="true"
              className={
                styles.successIcon
              }
            >
              ✓
            </span>

            <div>
              <strong>
                Your signature was submitted
                successfully
              </strong>

              <p>
                Your signed Payment Voucher
                has been returned to the
                Estuary Staff submitter for
                review and confirmation.
              </p>
            </div>
          </div>
        )}

        {errorMessage &&
          !signatureSubmitted && (
            <div
              className={
                styles.errorNotice
              }
              role="alert"
            >
              {errorMessage}
            </div>
          )}

      </div>

      <div
        className={styles.pageContainer}
      >

        <section
          className={
            styles.introductionCard
          }
        >
          <div>
            <p className={styles.eyebrow}>
              Payment Voucher
            </p>

            <div
              className={styles.titleRow}
            >
              <h1>
                {voucher.voucherNumber}
              </h1>

              <PaymentVoucherStatusBadge
                status={voucher.status}
              />
            </div>

            <p
              className={
                styles.introductionText
              }
            >
              Please review the payment
              details below. Once verified,
              check the confirmation box and
              provide your digital signature to
              acknowledge receipt.
            </p>
          </div>

          <button
            className={
              styles.downloadButton
            }
            disabled={isDownloading}
            onClick={handleDownloadPdf}
            type="button"
          >
            {isDownloading
              ? 'Preparing PDF…'
              : signatureSubmitted
                ? 'Download signed PDF'
                : 'Download PDF'}
          </button>
        </section>

        <div
          className={styles.contentGrid}
        >
          <div
            className={
              styles.detailsColumn
            }
          >
            <section
              className={styles.card}
            >
              <div
                className={
                  styles.sectionHeader
                }
              >
                <div>
                  <p
                    className={
                      styles.sectionLabel
                    }
                  >
                    Payment information
                  </p>

                  <h2>
                    Payment details
                  </h2>
                </div>

                <div className={styles.amountBlock}>
                  <span>Total amount paid</span>

                  <strong className={styles.amount}>
                    {formatCurrency(voucher.amount)}
                  </strong>
                </div>
              </div>

              <dl
                className={
                  styles.informationGrid
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
                  <dt>Payment date</dt>

                  <dd>
                    {formatDate(
                      voucher.paymentDate,
                    )}
                  </dd>
                </div>

                <div>
                  <dt>Division</dt>

                  <dd>
                    {voucher.division}
                  </dd>
                </div>

                <div>
                  <dt>
                    Payment method
                  </dt>

                  <dd>
                    {voucher.paymentMethod}
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
                  <dt>
                    Purpose of payment
                  </dt>

                  <dd>
                    {voucher.purpose}
                  </dd>
                </div>

                <div>
                  <dt>
                    Payment proof
                  </dt>

                  <dd>
                    {voucher.paymentProofFileName ||
                      'No payment proof attached'}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              className={styles.card}
            >
              <div
                className={
                  styles.sectionHeader
                }
              >
                <div>
                  <p
                    className={
                      styles.sectionLabel
                    }
                  >
                    Recipient
                  </p>

                  <h2>
                    Recipient details
                  </h2>
                </div>
              </div>

              <dl
                className={
                  styles.informationGrid
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
                    {voucher
                      .recipientIsMalaysian
                      ? 'Yes'
                      : 'No'}
                  </dd>
                </div>

                <div>
                  <dt>Bank name</dt>

                  <dd>
                    {voucher.bankName ||
                      'Not provided'}
                  </dd>
                </div>

                <div>
                  <dt>
                    Bank account number
                  </dt>

                  <dd>
                    {voucher.bankAccountNumber ||
                      'Not provided'}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              className={styles.card}
            >
              <div
                className={
                  styles.sectionHeader
                }
              >
                <div>
                  <p
                    className={
                      styles.sectionLabel
                    }
                  >
                    Breakdown
                  </p>

                  <h2>
                    Payment breakdown
                  </h2>
                </div>

                <span
                  className={
                    styles.lineCount
                  }
                >
                  {voucher.lines.length}{' '}
                  {voucher.lines.length ===
                  1
                    ? 'item'
                    : 'items'}
                </span>
              </div>

              <div
                className={
                  styles.tableWrapper
                }
              >
                <table
                  className={
                    styles.linesTable
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
                              {
                                line.description
                              }
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
                  styles.grandTotal
                }
              >
                <span>Grand total</span>

                <strong>
                  {formatCurrency(
                    voucher.amount,
                  )}
                </strong>
              </div>
            </section>
          </div>

          <aside
            className={
              styles.actionColumn
            }
          >
            {signatureSubmitted ? (
              <section
                className={
                  styles.actionCard
                }
              >
                <p
                  className={
                    styles.sectionLabel
                  }
                >
                  Confirmation status
                </p>

                <h2>
                  Signature submitted
                </h2>

                <p>
                  Your signature was submitted
                  on{' '}
                  {formatDate(
                    voucher.recipientSignedAt,
                  )}
                  . The Estuary Staff submitter
                  will now review and confirm it.
                </p>

                {voucher
                  .recipientSignatureDataUrl && (
                  <div
                    className={
                      styles.signaturePreview
                    }
                  >
                    <div
                      className={
                        styles.signatureImageArea
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={`Digital signature submitted by ${voucher.recipientName}`}
                        src={
                          voucher
                            .recipientSignatureDataUrl
                        }
                      />
                    </div>

                    <div
                      className={
                        styles.signatureFileDetails
                      }
                    >
                      <div>
                        <strong>
                          Signature submitted
                        </strong>

                        <span>
                          {
                            voucher.signedPvFileName
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            ) : linkExpired ? (
              <section
                className={
                  styles.actionCard
                }
              >
                <p
                  className={
                    styles.sectionLabel
                  }
                >
                  Link expired
                </p>

                <h2>
                  Request a new secure link
                </h2>

                <p>
                  This recipient link is no
                  longer valid. Contact the
                  Estuary staff member who sent
                  this Payment Voucher.
                </p>
              </section>
            ) : canSubmitSignature ? (
              <RecipientSignaturePanel
                token={token}
                voucher={voucher}
                onSubmitted={
                  handleSignatureSubmitted
                }
              />
            ) : (
              <section
                className={
                  styles.actionCard
                }
              >
                <p
                  className={
                    styles.sectionLabel
                  }
                >
                  Confirmation status
                </p>

                <h2>
                  No recipient action required
                </h2>

                <p>
                  This Payment Voucher is not
                  currently awaiting a recipient
                  signature.
                </p>
              </section>
            )}

            <section
              className={styles.helpCard}
            >
              <h3>Need help?</h3>

              <p>
                If the payment information is
                incorrect or you did not receive
                the payment, do not submit your
                signature. Contact the Estuary
                staff member who sent this link.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

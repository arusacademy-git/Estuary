'use client';

import {
  useMemo,
  useRef,
  useState,
} from 'react';

import type { FormEvent } from 'react';

import { readBetaSession } from '@/lib/auth/beta-accounts';
import { amountToMalayWords } from '@/lib/currency/amount-words';

import {
  BANK_NAME_OPTIONS as bankNameOptions,
  DEFAULT_PAYMENT_VOUCHER_ACCOUNT_CODE,
  DIVISION_LABELS as divisionLabels,
  DIVISION_OPTIONS as divisionOptions,
  PAYMENT_METHOD_LABELS as paymentMethodLabels,
  PAYMENT_METHOD_OPTIONS as paymentMethodOptions,
  PAYMENT_VOUCHER_ACCOUNT_CODES as knownAccountCodes,
  PAYMENT_VOUCHER_ACCOUNT_OPTIONS,
} from '@/shared/constants/payment-options';
import { parsePaymentAmountInput } from '@/shared/utils/payment-amount';

import type {
  CreatePaymentVoucherInput,
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import styles from '@/features/payment-voucher/components/payment-voucher.module.css';

type PaymentVoucherFormProps = {
  initialVoucher?: PaymentVoucherRecord;

  onContinue: (
    voucher: CreatePaymentVoucherInput,
    supportingDocumentNames: string[],
  ) => void;
};

type TaxCode =
  | 'NONE'
  | 'SST_6'
  | 'MANUAL';

type VoucherLine = {
  id: string;
  account: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxCode: TaxCode;
  taxAmount: number;
};

function calculateSstAmount(
  quantity: number,
  unitPrice: number,
) {
  return Math.round(
    quantity * unitPrice * 0.06 * 100,
  ) / 100;
}

function inferTaxCode(
  quantity: number,
  unitPrice: number,
  taxAmount: number,
): TaxCode {
  if (taxAmount === 0) {
    return 'NONE';
  }

  return Math.abs(
    taxAmount -
    calculateSstAmount(quantity, unitPrice),
  ) < 0.01
    ? 'SST_6'
    : 'MANUAL';
}

const directors = [
  {
    id: 'amir-iskandar',
    name: 'Amir Iskandar',
    position: 'School Director',
  },
  {
    id: 'farid-hakim',
    name: 'Farid Hakim',
    position: 'Group Director',
  },
  {
    id: 'maryam-iskandar',
    name: 'Maryam Iskandar',
    position: 'Director',
  },
  {
    id: 'daniel-lee',
    name: 'Daniel Lee',
    position: 'Director',
  },
];

function createVoucherLine(
  id: string,
): VoucherLine {
  return {
    id,
    account: DEFAULT_PAYMENT_VOUCHER_ACCOUNT_CODE,
    description: '',
    quantity: 1,
    unitPrice: 0,
    taxCode: 'NONE',
    taxAmount: 0,
  };
}

function createInitialVoucherLines(
  initialVoucher?: PaymentVoucherRecord,
): VoucherLine[] {
  if (
    !initialVoucher ||
    initialVoucher.lines.length === 0
  ) {
    return [
      createVoucherLine('line-1'),
    ];
  }

  return initialVoucher.lines.map(
    (line, index) => ({
      id: `line-${index + 1}`,
      account: line.accountCode,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitAmount,
      taxCode: inferTaxCode(
        line.quantity,
        line.unitAmount,
        line.taxAmount,
      ),
      taxAmount: line.taxAmount,
    }),
  );
}

function findOptionValue(
  labels: Record<string, string>,
  storedValue: string | undefined,
  fallback: string,
) {
  if (!storedValue) {
    return fallback;
  }

  const normalizedStoredValue =
    storedValue.trim().toLowerCase();

  const matchingEntry = Object.entries(
    labels,
  ).find(([key, label]) => {
    return (
      key.toLowerCase() ===
      normalizedStoredValue ||
      label.toLowerCase() ===
      normalizedStoredValue
    );
  });

  return matchingEntry?.[0] ?? fallback;
}

export function PaymentVoucherForm({
  initialVoucher,
  onContinue,
}: PaymentVoucherFormProps) {
  const isAmendment =
    initialVoucher?.status === 'REJECTED';

  const initialLines = useMemo(
    () =>
      createInitialVoucherLines(
        initialVoucher,
      ),
    [initialVoucher],
  );

  const nextLineNumber = useRef(
    initialLines.length + 1,
  );

  const [voucherLines, setVoucherLines] =
    useState<VoucherLine[]>(
      () => initialLines,
    );

  const [formError, setFormError] =
    useState('');

  const selectedDivision =
    findOptionValue(
      divisionLabels,
      initialVoucher?.division,
      '',
    );

  const selectedPaymentMethod =
    findOptionValue(
      paymentMethodLabels,
      initialVoucher?.paymentMethod,
      'Bank Transfer',
    );

  const totals = useMemo(() => {
    const subtotal = voucherLines.reduce(
      (total, line) => {
        return (
          total +
          line.quantity * line.unitPrice
        );
      },
      0,
    );

    const tax = voucherLines.reduce(
      (total, line) => {
        return total + line.taxAmount;
      },
      0,
    );

    return {
      subtotal,
      tax,
      grandTotal: subtotal + tax,
    };
  }, [voucherLines]);

  const amountInWords = useMemo(() => {
    return amountToMalayWords(
      totals.grandTotal,
    );
  }, [totals.grandTotal]);

  function addVoucherLine() {
    const lineId =
      `line-${nextLineNumber.current}`;

    nextLineNumber.current += 1;

    setVoucherLines((currentLines) => [
      ...currentLines,
      createVoucherLine(lineId),
    ]);
  }

  function updateVoucherLine(
    lineId: string,
    changes: Partial<VoucherLine>,
  ) {
    setVoucherLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? (() => {
            const updatedLine = {
              ...line,
              ...changes,
            };

            if (
              updatedLine.taxCode ===
              'SST_6'
            ) {
              updatedLine.taxAmount =
                calculateSstAmount(
                  updatedLine.quantity,
                  updatedLine.unitPrice,
                );
            }

            if (
              changes.taxCode === 'NONE' ||
              changes.taxCode === 'MANUAL'
            ) {
              updatedLine.taxAmount = 0;
            }

            return updatedLine;
          })()
          : line,
      ),
    );
  }

  function removeVoucherLine(
    lineId: string,
  ) {
    setVoucherLines((currentLines) => {
      if (currentLines.length === 1) {
        return currentLines;
      }

      return currentLines.filter(
        (line) => line.id !== lineId,
      );
    });
  }

  function handleReview(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setFormError('');

    const account = readBetaSession();

    if (
      !account ||
      !['staff', 'manager', 'finance'].includes(account.role)
    ) {
      setFormError(
        'Only Staff, Manager and Finance accounts can create or amend a Payment Voucher.',
      );

      return;
    }

    if (
      isAmendment &&
      initialVoucher &&
      account.id !==
      initialVoucher.submitterId
    ) {
      setFormError(
        'Only the person who originally submitted this Payment Voucher can amend it.',
      );

      return;
    }

    if (totals.grandTotal <= 0) {
      setFormError(
        'Add at least one voucher line with an amount greater than RM 0.00.',
      );

      return;
    }

    const hasIncompleteLine =
      voucherLines.some((line) => {
        return (
          !line.account.trim() ||
          !line.description.trim() ||
          line.quantity <= 0 ||
          line.unitPrice < 0 ||
          line.taxAmount < 0
        );
      });

    if (hasIncompleteLine) {
      setFormError(
        'Complete every voucher line and make sure all amounts are valid.',
      );

      return;
    }

    const formData = new FormData(
      event.currentTarget,
    );

    const divisionValue = String(
      formData.get('division') ?? '',
    );

    const paymentMethodValue = String(
      formData.get('paymentMethod') ?? '',
    );

    const directorId = String(
      formData.get('assignedDirector') ?? '',
    );

    if (!directorId) {
      setFormError(
        'Please select an assigned Director.',
      );

      return;
    }

    const selectedFiles = formData
      .getAll('supportingDocuments')
      .filter(
        (value): value is File =>
          value instanceof File &&
          value.size > 0,
      );

    const voucher: CreatePaymentVoucherInput =
    {
      organizationId:
        initialVoucher?.organizationId ??
        'beta-arus-org',

      submitterId: account.id,

      /*
       * Rejected vouchers must return to
       * their original assigned Director.
       */
      directorId: isAmendment
        ? initialVoucher.directorId
        : directorId,

      projectManagerId:
        initialVoucher?.projectManagerId ??
        'nadia-hassan',

      pvDate: String(
        formData.get('pvDate') ?? '',
      ).trim(),

      division:
        divisionLabels[
        divisionValue
        ] ?? divisionValue,

      recipientName: String(
        formData.get(
          'recipientName',
        ) ?? '',
      ).trim(),

      recipientEmail: String(
        formData.get(
          'recipientEmail',
        ) ?? '',
      )
        .trim()
        .toLowerCase(),

      recipientIc:
        String(
          formData.get(
            'recipientIdentity',
          ) ?? '',
        ).trim() || undefined,

      recipientIsMalaysian:
        formData.get(
          'isMalaysian',
        ) === 'yes',

      paymentMethod:
        paymentMethodLabels[
        paymentMethodValue
        ] ?? paymentMethodValue,

      bankName:
        String(
          formData.get(
            'bankName',
          ) ?? '',
        ).trim() || undefined,

      bankAccountNumber:
        String(
          formData.get(
            'bankAccountNumber',
          ) ?? '',
        ).trim() || undefined,

      purpose: String(
        formData.get('purpose') ?? '',
      ).trim(),

      lines: voucherLines.map(
        (line) => ({
          accountCode:
            line.account.trim(),

          description:
            line.description.trim(),

          quantity: line.quantity,
          unitAmount: line.unitPrice,
          taxAmount: line.taxAmount,
        }),
      ),
    };

    onContinue(
      voucher,
      selectedFiles.map(
        (file) => file.name,
      ),
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.pageEyebrow}>Payment Vouchers / Single Payment Voucher</p>

          <h1>
            {isAmendment
              ? 'Amend Payment Voucher'
              : 'Create Payment Voucher'}
          </h1>

          <p className={styles.copy}>
            {isAmendment
              ? 'Correct the information requested by the Director, review the changes and resubmit the Payment Voucher.'
              : 'Complete the recipient, payment and voucher line information before sending it for Director approval.'}
          </p>
        </div>

        <span className={styles.status}>
          {isAmendment
            ? 'Amendment required'
            : 'Draft'}
        </span>
      </div>

      {isAmendment &&
        initialVoucher
          ?.rejectionRemarks && (
          <div
            className={styles.notice}
            role="status"
          >
            <strong>
              Director requested amendments
            </strong>

            <p>
              {
                initialVoucher.rejectionRemarks
              }
            </p>
          </div>
        )}

      {formError && (
        <div
          className={styles.notice}
          role="alert"
        >
          {formError}
        </div>
      )}

      <form onSubmit={handleReview}>
        <section
          className={styles.formSection}
        >
          <div
            className={
              styles.sectionHeading
            }
          >
            <p>Payment information</p>
            <h2>Voucher details</h2>
          </div>

          <div className={styles.form}>
            <label className={styles.field}>
              <span>
                PV date{' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <input
                defaultValue={
                  initialVoucher?.pvDate ??
                  ''
                }
                name="pvDate"
                required
                type="date"
              />
            </label>

            <label className={styles.field}>
              <span>Recipient name {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <input
                defaultValue={
                  initialVoucher
                    ?.recipientName ?? ''
                }
                name="recipientName"
                required
                type="text"
              />
            </label>

            <label className={styles.field}>
              <span>Recipient email {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <input
                defaultValue={
                  initialVoucher
                    ?.recipientEmail ?? ''
                }
                name="recipientEmail"
                required
                type="email"
              />
            </label>

            <label className={styles.field}>
              <span>
                IC / identity number {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <input
                defaultValue={
                  initialVoucher
                    ?.recipientIc ?? ''
                }
                name="recipientIdentity"
                type="text"
              />
            </label>

            <label className={styles.field}>
              <span>Malaysian? {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <select
                defaultValue={
                  initialVoucher
                    ? initialVoucher
                      .recipientIsMalaysian
                      ? 'yes'
                      : 'no'
                    : 'yes'
                }
                name="isMalaysian"
              >
                <option value="yes">
                  Yes
                </option>

                <option value="no">
                  No
                </option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Division {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <select
                defaultValue={
                  selectedDivision
                }
                name="division"
                required
              >
                <option disabled value="">
                  Select division
                </option>

                {divisionOptions.map((division) => (
                  <option key={division} value={division}>
                    {division}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Assigned Director {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              {isAmendment &&
                initialVoucher && (
                  <input
                    name="assignedDirector"
                    type="hidden"
                    value={
                      initialVoucher.directorId
                    }
                  />
                )}

              <select
                defaultValue={
                  initialVoucher
                    ?.directorId ?? ''
                }
                disabled={isAmendment}
                name={
                  isAmendment
                    ? undefined
                    : 'assignedDirector'
                }
                required={!isAmendment}
              >
                <option disabled value="">
                  Select Director
                </option>

                {initialVoucher &&
                  !directors.some(
                    (director) =>
                      director.id ===
                      initialVoucher.directorId,
                  ) && (
                    <option
                      value={
                        initialVoucher.directorId
                      }
                    >
                      {
                        initialVoucher.directorId
                      }
                    </option>
                  )}

                {directors.map(
                  (director) => (
                    <option
                      key={director.id}
                      value={director.id}
                    >
                      {director.name} —{' '}
                      {director.position}
                    </option>
                  ),
                )}
              </select>

              {isAmendment && (
                <small>
                  The amended voucher will
                  return to the same Director.
                </small>
              )}
            </label>

            <label className={styles.field}>
              <span>Payment method {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <select
                defaultValue={
                  selectedPaymentMethod
                }
                name="paymentMethod"
              >
                {paymentMethodOptions.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Bank name {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <select
                defaultValue={
                  initialVoucher?.bankName ??
                  ''
                }
                name="bankName"
              >
                <option value="">Select bank</option>

                {bankNameOptions.map((bankName) => (
                  <option key={bankName} value={bankName}>
                    {bankName}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>
                Bank account number {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <input
                defaultValue={
                  initialVoucher
                    ?.bankAccountNumber ?? ''
                }
                name="bankAccountNumber"
                type="text"
              />
            </label>

            <label
              className={`${styles.field} ${styles.wide}`}
            >
              <span>Purpose of payment {' '}
                <em className={styles.requiredMarker}>*</em>
              </span>

              <textarea
                defaultValue={
                  initialVoucher?.purpose ??
                  ''
                }
                name="purpose"
                required
                rows={4}
              />
            </label>

            <label
              className={`${styles.field} ${styles.wide}`}
            >
              <span>
                Supporting documents
              </span>

              <input
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                name="supportingDocuments"
                type="file"
              />

              <small>
                {isAmendment
                  ? 'Upload any replacement or additional supporting documents required for this amendment.'
                  : 'Selected file names will be displayed on the review screen.'}
              </small>
            </label>
          </div>
        </section>

        <section
          className={styles.linesSection}
        >
          <div
            className={styles.linesHeading}
          >
            <div>
              <div className={styles.linesTitleRow}>
                <h2>Voucher lines</h2>

                <span className={styles.lineCountBadge}>
                  {voucherLines.length}{' '}
                  {voucherLines.length === 1
                    ? 'item'
                    : 'items'}
                </span>
              </div>

              <span>
                Use one line for each payment
                purpose or accounting category.
              </span>
            </div>

            <button
              className={
                styles.addLineButton
              }
              type="button"
              onClick={addVoucherLine}
            >
              + Add line
            </button>
          </div>

          <div
            className={styles.lineLabels}
          >
            <span>Account</span>
            <span>Description</span>
            <span>Quantity</span>
            <span>Unit price</span>
            <span>Tax Code</span>
            <span>Total</span>
          </div>

          <div
            className={styles.voucherLines}
          >
            {voucherLines.map((line) => {
              const lineTotal =
                line.quantity *
                line.unitPrice +
                line.taxAmount;

              return (
                <div
                  className={
                    styles.voucherLine
                  }
                  key={line.id}
                >
                  <label
                    className={
                      styles.mobileFieldLabel
                    }
                  >
                    <span>Account</span>

                    <select
                      aria-label="Account"
                      value={line.account}
                      onChange={(event) =>
                        updateVoucherLine(
                          line.id,
                          {
                            account:
                              event.target
                                .value,
                          },
                        )
                      }
                    >
                      {!knownAccountCodes.includes(
                        line.account,
                      ) && (
                          <option
                            value={line.account}
                          >
                            {line.account}
                          </option>
                        )}

                      {PAYMENT_VOUCHER_ACCOUNT_OPTIONS.map(
                        (option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label
                    className={
                      styles.mobileFieldLabel
                    }
                  >
                    <span>Description</span>

                    <input
                      aria-label="Description"
                      placeholder="Payment description"
                      required
                      type="text"
                      value={line.description}
                      onChange={(event) =>
                        updateVoucherLine(
                          line.id,
                          {
                            description:
                              event.target
                                .value,
                          },
                        )
                      }
                    />
                  </label>

                  <label
                    className={
                      styles.mobileFieldLabel
                    }
                  >
                    <span>Quantity</span>

                    <input
                      aria-label="Quantity"
                      inputMode="decimal"
                      placeholder="For example: 1"
                      required
                      type="text"
                      value={line.quantity}
                      onChange={(event) =>
                        updateVoucherLine(
                          line.id,
                          {
                            quantity:
                              parsePaymentAmountInput(
                                event.target
                                  .value,
                              ),
                          },
                        )
                      }
                    />
                  </label>

                  <label
                    className={
                      styles.mobileFieldLabel
                    }
                  >
                    <span>Unit price</span>

                    <input
                      aria-label="Unit price"
                      inputMode="decimal"
                      placeholder="0.00"
                      required
                      type="text"
                      value={
                        line.unitPrice === 0
                          ? ''
                          : line.unitPrice
                      }
                      onChange={(event) =>
                        updateVoucherLine(
                          line.id,
                          {
                            unitPrice:
                              parsePaymentAmountInput(
                                event.target
                                  .value,
                              ),
                          },
                        )
                      }
                    />
                  </label>

                  <label
                    className={
                      styles.mobileFieldLabel
                    }
                  >
                    <span>Tax Code</span>

                    <select
                      aria-label="Tax code"
                      value={line.taxCode}
                      onChange={(event) =>
                        updateVoucherLine(
                          line.id,
                          {
                            taxCode:
                              event.target
                                .value as TaxCode,
                          },
                        )
                      }
                    >
                      <option value="NONE">No tax</option>
                      <option value="SST_6">SST 6%</option>
                      <option value="MANUAL">Manual tax</option>
                    </select>

                    {line.taxCode === 'MANUAL' && (
                      <input
                        aria-label="Manual tax amount"
                        inputMode="decimal"
                        placeholder="Enter tax amount"
                        type="text"
                        value={
                          line.taxAmount === 0
                            ? ''
                            : line.taxAmount
                        }
                        onChange={(event) =>
                          updateVoucherLine(
                            line.id,
                            {
                              taxAmount:
                                parsePaymentAmountInput(
                                  event.target.value,
                                ),
                            },
                          )
                        }
                      />
                    )}

                    {line.taxCode === 'SST_6' && (
                      <small>
                        Tax: RM {line.taxAmount.toFixed(2)}
                      </small>
                    )}
                  </label>

                  <div
                    className={
                      styles.lineTotal
                    }
                  >
                    <span
                      className={
                        styles.mobileTotalLabel
                      }
                    >
                      Total
                    </span>

                    <strong>
                      RM{' '}
                      {lineTotal.toFixed(2)}
                    </strong>

                    {voucherLines.length >
                      1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeVoucherLine(
                              line.id,
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={styles.voucherSummary}
          >
            <div
              className={styles.summaryStats}
            >
              <div
                className={
                  styles.summaryStat
                }
              >
                <span>Lines</span>

                <strong>
                  {voucherLines.length}
                </strong>
              </div>

              <div
                className={
                  styles.summaryStat
                }
              >
                <span>Subtotal</span>

                <strong>
                  RM{' '}
                  {totals.subtotal.toFixed(
                    2,
                  )}
                </strong>
              </div>

              <div
                className={
                  styles.summaryStat
                }
              >
                <span>Tax</span>

                <strong>
                  RM {totals.tax.toFixed(2)}
                </strong>
              </div>
            </div>

            <div
              className={
                styles.amountInWords
              }
            >
              <div
                className={
                  styles.amountInWordsHeading
                }
              >
                <span>Amount in words</span>

                <small>
                  Automatically generated
                </small>
              </div>

              <output
                aria-label="Amount in words"
                className={
                  styles.amountInWordsOutput
                }
              >
                {amountInWords}
              </output>
            </div>

            <div
              className={
                styles.grandTotalBar
              }
            >
              <span>Grand total</span>

              <strong>
                RM{' '}
                {totals.grandTotal.toFixed(
                  2,
                )}
              </strong>
            </div>
          </div>
        </section>

        <footer
          className={styles.formActions}
        >
          <button
            className={styles.primary}
            type="submit"
          >
            {isAmendment
              ? 'Continue to review amendment'
              : 'Continue to review'}
          </button>
        </footer>
      </form>
    </section>
  );
}

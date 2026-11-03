'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  betaAccounts,
  readBetaSession,
} from '@/lib/auth/beta-accounts';

import { ManualDraftConfirmation } from '../../../../payment-request/components/shared/manual-draft-confirmation';
import { ManualDraftStatus } from '../../../../payment-request/components/shared/manual-draft-status';
import { useManualFormDraft } from '@/features/payment-request/components/shared/use-manual-form-draft';

import {
  amountToMalayWords,
} from '@/lib/currency/amount-words';

import {
  BANK_NAME_SELECT_OPTIONS,
  DEFAULT_PAYMENT_VOUCHER_ACCOUNT_CODE,
  DIVISION_SELECT_OPTIONS,
  PAYMENT_METHOD_SELECT_OPTIONS,
  PAYMENT_VOUCHER_ACCOUNT_OPTIONS,
} from '@/shared/constants/payment-options';

import {
  calculateBulkPaymentVoucherAmount,
  createEmptyBulkPaymentVoucherRow,
  validateBulkPaymentVoucherRows,
} from '@/domain/payment-vouchers/bulk-upload';

import type {
  BulkPaymentVoucherField,
  BulkPaymentVoucherRow,
} from '@/domain/payment-vouchers/bulk-upload';

import styles from './bulk-payment-voucher.module.css';

type BulkManualEntryPanelProps = {
  rows: BulkPaymentVoucherRow[];

  onChange: (
    rows: BulkPaymentVoucherRow[],
  ) => void;

  onContinue: (
    rows: BulkPaymentVoucherRow[],
  ) => void;
};

type RowUpdateFunction = (
  field: BulkPaymentVoucherField,
  value: string,
) => void;

type Option = {
  value: string;
  label: string;
};

type InputFieldProps = {
  field: BulkPaymentVoucherField;
  label: string;
  value: string;
  onUpdate: RowUpdateFunction;
  fullWidth?: boolean;
  required?: boolean;

  type?:
  | 'text'
  | 'email'
  | 'date';

  inputMode?:
  | 'numeric'
  | 'decimal';

  errorMessage?: string;
};

type SelectFieldProps = {
  field: BulkPaymentVoucherField;
  label: string;
  value: string;
  options: Option[];
  onUpdate: RowUpdateFunction;
  required?: boolean;
};

const divisions: Option[] =
  DIVISION_SELECT_OPTIONS;

const bankNames: Option[] =
  BANK_NAME_SELECT_OPTIONS;

const paymentMethods: Option[] =
  PAYMENT_METHOD_SELECT_OPTIONS;

const accountCodes: Option[] =
  PAYMENT_VOUCHER_ACCOUNT_OPTIONS;

const legacyAccountCodes = new Set([
  '5100',
  '5200',
  '5300',
]);

const directors: Option[] =
  betaAccounts
    .filter(
      (account) =>
        account.role === 'director',
    )
    .map((account) => ({
      value: account.email,
      label:
        `${account.name} — ${account.position}`,
    }));

const projectManagers: Option[] = [
  {
    value: '',
    label: 'No Project Manager',
  },

  ...betaAccounts
    .filter(
      (account) =>
        account.role === 'manager',
    )
    .map((account) => ({
      value: account.email,
      label:
        `${account.name} — ${account.position}`,
    })),
];

const malaysianOptions: Option[] = [
  {
    value: '',
    label: 'Select',
  },
  {
    value: 'yes',
    label: 'Yes',
  },
  {
    value: 'no',
    label: 'No',
  },
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

function InputField({
  field,
  label,
  value,
  onUpdate,
  fullWidth = false,
  required = false,
  type = 'text',
  inputMode,
  errorMessage,
}: InputFieldProps) {
  return (
    <label className={`${styles.field} ${fullWidth ? styles.fullWidth : ''}`}>
      <span>
        {label}
        {required && (
          <em className={styles.requiredMarker}>
            {' '}*
          </em>
        )}
      </span>

      <input
        aria-invalid={Boolean(errorMessage)}
        inputMode={inputMode}
        required={required}
        type={type}
        value={value}
        onChange={(event) =>
          onUpdate(
            field,
            event.target.value,
          )
        }
      />

      {errorMessage && (
        <small className={styles.fieldError} role="alert">
          {errorMessage}
        </small>
      )}
    </label>
  );
}

function SelectField({
  field,
  label,
  value,
  options,
  onUpdate,
  required = false,
}: SelectFieldProps) {
  return (
    <label className={styles.field}>
      <span>
        {label}
        {required && (
          <em className={styles.requiredMarker}>
            {' '}*
          </em>
        )}
      </span>

      <select
        required={required}
        value={value}
        onChange={(event) =>
          onUpdate(
            field,
            event.target.value,
          )
        }
      >
        {options.map((option) => (
          <option
            key={`${field}-${option.value}`}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function VoucherEditor({
  row,
  onUpdate,
  onSupportingDocumentsChange,
  fieldErrors = {},
}: {
  row: BulkPaymentVoucherRow;
  onUpdate: RowUpdateFunction;

  onSupportingDocumentsChange: (
    fileNames: string[],
  ) => void;

  fieldErrors?: Partial<Record<BulkPaymentVoucherField, string>>;
}) {
  const amount =
    calculateBulkPaymentVoucherAmount(
      {
        ...row,
        taxAmount: '0',
      },
    );

  const amountInWords =
    amountToMalayWords(amount);

  const supportingDocumentNames =
    row.supportingDocumentNames ?? [];

  const bankDetailsRequired =
    row.paymentMethod.trim().toLowerCase() ===
    'bank transfer';

  return (
    <div className={styles.voucherBody}>
      <div className={styles.formGrid}>
        <InputField
          field="pvDate"
          label="PV date"
          onUpdate={onUpdate}
          required
          type="date"
          value={row.pvDate}
        />

        <SelectField
          field="division"
          label="Division"
          onUpdate={onUpdate}
          options={[
            {
              value: '',
              label: 'Select division',
            },
            ...divisions,
          ]}
          required
          value={row.division}
        />

        <SelectField
          field="directorEmail"
          label="Assigned Director"
          onUpdate={onUpdate}
          options={[
            {
              value: '',
              label: 'Select Director',
            },
            ...directors,
          ]}
          required
          value={row.directorEmail}
        />

        <SelectField
          field="projectManagerEmail"
          label="Project Manager"
          onUpdate={onUpdate}
          options={projectManagers}
          value={
            row.projectManagerEmail
          }
        />
      </div>

      <div
        className={
          styles.sectionDivider
        }
      >
        Recipient information
      </div>

      <div className={styles.formGrid}>
        <InputField
          field="recipientName"
          label="Recipient name"
          onUpdate={onUpdate}
          required
          value={row.recipientName}
        />

        <InputField
          field="recipientEmail"
          label="Recipient email"
          onUpdate={onUpdate}
          required
          type="email"
          value={row.recipientEmail}
        />

        <InputField
          errorMessage={fieldErrors.recipientIc}
          field="recipientIc"
          label="IC / identity number"
          onUpdate={onUpdate}
          required
          value={row.recipientIc}
        />

        <SelectField
          field="recipientIsMalaysian"
          label="Malaysian?"
          onUpdate={onUpdate}
          options={malaysianOptions}
          required
          value={
            row.recipientIsMalaysian
          }
        />
      </div>

      <div
        className={
          styles.sectionDivider
        }
      >
        Payment information
      </div>

      <div className={styles.formGrid}>
        <SelectField
          field="paymentMethod"
          label="Payment method"
          onUpdate={onUpdate}
          options={paymentMethods}
          required
          value={row.paymentMethod}
        />

        <SelectField
          field="bankName"
          label="Bank name"
          onUpdate={onUpdate}
          options={[
            {
              value: '',
              label: 'Select bank',
            },
            ...bankNames,
          ]}
          required={bankDetailsRequired}
          value={row.bankName}
        />

        <InputField
          errorMessage={fieldErrors.bankAccountNumber}
          field="bankAccountNumber"
          fullWidth
          inputMode="numeric"
          label="Bank account number"
          onUpdate={onUpdate}
          required={bankDetailsRequired}
          value={
            row.bankAccountNumber
          }
        />

        <label
          className={`${styles.field} ${styles.fullWidth}`}
        >
          <span>
            Purpose of payment
            <em className={styles.requiredMarker}>
              {' '}*
            </em>
          </span>

          <textarea
            required
            rows={3}
            value={row.purpose}
            onChange={(event) =>
              onUpdate(
                'purpose',
                event.target.value,
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullWidth}`}
        >
          <span>
            Supporting documents
          </span>

          <input
            accept=".pdf,.png,.jpg,.jpeg"
            multiple
            type="file"
            onChange={(event) => {
              const fileNames =
                Array.from(
                  event.target.files ??
                  [],
                ).map(
                  (file) =>
                    file.name,
                );

              onSupportingDocumentsChange(
                fileNames,
              );
            }}
          />

          <small>
            Accepted formats: PDF, PNG,
            JPG and JPEG.
          </small>

          {supportingDocumentNames
            .length > 0 && (
              <ul
                className={
                  styles.selectedDocumentList
                }
              >
                {supportingDocumentNames.map(
                  (
                    fileName,
                    index,
                  ) => (
                    <li
                      key={`${fileName}-${index}`}
                    >
                      {fileName}
                    </li>
                  ),
                )}
              </ul>
            )}
        </label>
      </div>

      <section className={styles.manualLinesSection}>
        <div className={styles.manualLinesHeading}>
          <div>
            <h3>Voucher lines</h3>
            <p>Use the same payment breakdown structure as a Single Payment Voucher.</p>
          </div>
          <span>1 item</span>
        </div>

        <div className={styles.manualLinesTableWrap}>
          <table className={styles.manualLinesTable}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <select aria-label="Account" value={row.accountCode} onChange={(event) => onUpdate('accountCode', event.target.value)}>
                    {accountCodes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </td>
                <td><input aria-label="Description" placeholder="Payment description" type="text" value={row.lineDescription} onChange={(event) => onUpdate('lineDescription', event.target.value)} /></td>
                <td><input aria-label="Quantity" inputMode="decimal" type="text" value={row.quantity} onChange={(event) => onUpdate('quantity', event.target.value)} /></td>
                <td><input aria-label="Unit price" inputMode="decimal" placeholder="Enter amount" type="text" value={row.unitAmount === '0' ? '' : row.unitAmount} onChange={(event) => onUpdate('unitAmount', event.target.value)} /></td>
                <td><strong>{formatCurrency(amount)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.manualLinesSummary}>
          <div className={styles.amountInWordsBox}>
            <div className={styles.amountInWordsHeading}>
              <span>Amount in words</span>
              <small>Automatically generated</small>
            </div>
            <output aria-label="Amount in words" className={styles.amountInWordsOutput}>{amountInWords}</output>
          </div>
          <dl>
            <div><dt>Subtotal</dt><dd>{formatCurrency(amount)}</dd></div>
            <div><dt>Grand total</dt><dd>{formatCurrency(amount)}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  );
}

export function BulkManualEntryPanel({
  rows,
  onChange,
  onContinue,
}: BulkManualEntryPanelProps) {
  const [account] = useState(() => readBetaSession());
  const [draftSaved, setDraftSaved] = useState(false);
  const [
    expandedRowId,
    setExpandedRowId,
  ] = useState<string | null>(
    rows[0]?.rowId ?? null,
  );

  const [
    validationAttempted,
    setValidationAttempted,
  ] = useState(false);

  const [
    formMessage,
    setFormMessage,
  ] = useState('');

  const draft = useManualFormDraft<{
    creationMode: 'multiple';
    manualRows: BulkPaymentVoucherRow[];
  }>({
    paymentType: 'PAYMENT_VOUCHER',
    requesterId: account?.id,
    getSnapshot: () => ({
      creationMode: 'multiple',
      manualRows: rows,
    }),
    restoreSnapshot: (snapshot) => {
      if (
        snapshot.creationMode === 'multiple' &&
        Array.isArray(snapshot.manualRows) &&
        snapshot.manualRows.length > 0
      ) {
        onChange(snapshot.manualRows);
      }
    },
  });

  const activeExpandedRowId =
    expandedRowId === null ||
    rows.some((row) => row.rowId === expandedRowId)
      ? expandedRowId
      : rows[0]?.rowId ?? null;

  const normalizedRows = useMemo(
    () => rows.map((row) => ({ ...row, taxAmount: '0' })),
    [rows],
  );

  const validations = useMemo(
    () =>
      validateBulkPaymentVoucherRows(
        normalizedRows,
      ),
    [normalizedRows],
  );

  const validationByRowId =
    useMemo(
      () =>
        new Map(
          validations.map(
            (validation) => [
              validation.rowId,
              validation,
            ],
          ),
        ),
      [validations],
    );

  const validCount =
    validations.filter(
      (validation) =>
        validation.isValid,
    ).length;

  const invalidCount =
    validations.length -
    validCount;

  const totalAmount = useMemo(
    () =>
      normalizedRows.reduce(
        (total, row) =>
          total +
          calculateBulkPaymentVoucherAmount(
            row,
          ),
        0,
      ),
    [normalizedRows],
  );

  useEffect(() => {
    if (
      !rows.some((row) =>
        legacyAccountCodes.has(row.accountCode),
      )
    ) {
      return;
    }

    onChange(
      rows.map((row) => {
        if (!legacyAccountCodes.has(row.accountCode)) {
          return row;
        }

        return {
          ...row,
          accountCode:
            DEFAULT_PAYMENT_VOUCHER_ACCOUNT_CODE,
        };
      }),
    );
  }, [onChange, rows]);

  function updateRow(
    rowId: string,
    field:
      BulkPaymentVoucherField,
    value: string,
  ) {
    onChange(
      rows.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }

        return {
          ...row,
          [field]: value,
        } as BulkPaymentVoucherRow;
      }),
    );

    setFormMessage('');
  }

  function updateSupportingDocuments(
    rowId: string,
    fileNames: string[],
  ) {
    onChange(
      rows.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }

        return {
          ...row,

          supportingDocumentNames:
            fileNames,
        };
      }),
    );

    setFormMessage('');
  }

  function toggleRow(
    rowId: string,
  ) {
    setExpandedRowId(
      (currentRowId) =>
        currentRowId === rowId
          ? null
          : rowId,
    );
  }

  function addRow() {
    const newRow =
      createEmptyBulkPaymentVoucherRow();

    onChange([
      ...rows,
      newRow,
    ]);

    setExpandedRowId(
      newRow.rowId,
    );

    setFormMessage('');

    window.setTimeout(() => {
      document
        .getElementById(
          `bulk-voucher-${newRow.rowId}`,
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 0);
  }

  function duplicateRow(
    sourceRow:
      BulkPaymentVoucherRow,
  ) {
    const emptyRow =
      createEmptyBulkPaymentVoucherRow();

    const duplicatedRow:
      BulkPaymentVoucherRow = {
      ...sourceRow,

      rowId: emptyRow.rowId,

      recipientName: '',
      recipientEmail: '',
      recipientIc: '',

      supportingDocumentNames: [],
    };

    onChange([
      ...rows,
      duplicatedRow,
    ]);

    setExpandedRowId(
      duplicatedRow.rowId,
    );

    setFormMessage('');

    window.setTimeout(() => {
      document
        .getElementById(
          `bulk-voucher-${duplicatedRow.rowId}`,
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 0);
  }

  function removeRow(
    rowId: string,
  ) {
    if (rows.length === 1) {
      const emptyRow =
        createEmptyBulkPaymentVoucherRow();

      onChange([emptyRow]);

      setExpandedRowId(
        emptyRow.rowId,
      );

      setValidationAttempted(
        false,
      );

      setFormMessage('');

      return;
    }

    const remainingRows =
      rows.filter(
        (row) =>
          row.rowId !== rowId,
      );

    onChange(remainingRows);

    if (
      expandedRowId === rowId
    ) {
      setExpandedRowId(
        remainingRows[0]?.rowId ??
        null,
      );
    }

    setFormMessage('');
  }

  function discardEntries() {
    const hasEnteredInformation =
      rows.some((row) => {
        return Boolean(
          row.pvDate ||
          row.division ||
          row.recipientName ||
          row.recipientEmail ||
          row.purpose ||
          row.unitAmount ||
          row.supportingDocumentNames
            ?.length,
        );
      });

    if (
      hasEnteredInformation &&
      !window.confirm(
        'Discard all manually entered Payment Vouchers?',
      )
    ) {
      return;
    }

    const emptyRow =
      createEmptyBulkPaymentVoucherRow();

    onChange([emptyRow]);

    setExpandedRowId(
      emptyRow.rowId,
    );

    setValidationAttempted(false);
    setFormMessage('');
  }

  function handleContinue() {
    setValidationAttempted(true);
    setFormMessage('');

    const firstInvalid =
      validations.find(
        (validation) =>
          !validation.isValid,
      );

    if (firstInvalid) {
      setFormMessage(
        `${invalidCount} ${invalidCount === 1
          ? 'voucher needs'
          : 'vouchers need'
        } attention. Correct the highlighted issues before continuing.`,
      );

      setExpandedRowId(
        firstInvalid.rowId,
      );

      window.setTimeout(() => {
        document
          .getElementById(
            `bulk-voucher-${firstInvalid.rowId}`,
          )
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
      }, 0);

      return;
    }

    onContinue(normalizedRows);
  }

  if (draftSaved) {
    return (
      <ManualDraftConfirmation
        createHref="/beta/payment-vouchers/new?mode=multiple"
        paymentType="PAYMENT_VOUCHER"
        recordsHref="/beta/payment-vouchers?scope=mine"
      />
    );
  }

  return (
    <div className={styles.bulkFlow}>
      {formMessage && (
        <div
          className={
            styles.validationNotice
          }
          role="alert"
        >
          {formMessage}
        </div>
      )}

      <section
        className={styles.overviewBar}
      >
        <div
          className={
            styles.overviewTitle
          }
        >
          <p>Bulk overview</p>

          <strong>
            {rows.length}{' '}
            {rows.length === 1
              ? 'voucher'
              : 'vouchers'}
          </strong>
        </div>

        <div
          className={
            styles.overviewMetrics
          }
        >
          <div
            className={
              styles.overviewMetric
            }
          >
            <span>Total amount</span>

            <strong>
              {formatCurrency(
                totalAmount,
              )}
            </strong>
          </div>

          <div
            className={
              styles.overviewMetric
            }
            data-tone="success"
          >
            <span>Ready</span>

            <strong>
              {validCount}
            </strong>
          </div>

          <div
            className={
              styles.overviewMetric
            }
            data-tone="danger"
          >
            <span>
              Need attention
            </span>

            <strong>
              {invalidCount}
            </strong>
          </div>
        </div>

        <div
          className={
            styles.overviewActions
          }
        >
          <button
            className={
              styles.secondaryButton
            }
            disabled={
              activeExpandedRowId === null
            }
            onClick={() =>
              setExpandedRowId(null)
            }
            type="button"
          >
            Collapse all
          </button>
        </div>
      </section>

      <div
        className={styles.voucherList}
      >
        {rows.map(
          (row, index) => {
            const validation =
              validationByRowId.get(
                row.rowId,
              );

            const amount =
              calculateBulkPaymentVoucherAmount(
                row,
              );

            const isExpanded =
              activeExpandedRowId ===
              row.rowId;

            const isValid =
              validation?.isValid ===
              true;

            const recipientLabel =
              row.recipientName.trim() ||
              'Recipient not entered';

            const identityFieldNames = new Set<BulkPaymentVoucherField>([
              'recipientIc',
              'bankAccountNumber',
            ]);

            const inlineFieldErrors =
              validationAttempted && validation
                ? Object.fromEntries(
                    validation.errors
                      .filter((error) => identityFieldNames.has(error.field))
                      .map((error) => [error.field, error.message]),
                  ) as Partial<Record<BulkPaymentVoucherField, string>>
                : {};

            const remainingErrors =
              validation?.errors.filter(
                (error) => !identityFieldNames.has(error.field),
              ) ?? [];

            return (
              <article
                className={
                  styles.voucherCard
                }
                data-expanded={
                  isExpanded
                }
                id={`bulk-voucher-${row.rowId}`}
                key={row.rowId}
              >
                <header
                  className={
                    styles.voucherCardHeader
                  }
                >
                  <button
                    aria-controls={`bulk-voucher-content-${row.rowId}`}
                    aria-expanded={
                      isExpanded
                    }
                    className={
                      styles.accordionToggle
                    }
                    onClick={() =>
                      toggleRow(
                        row.rowId,
                      )
                    }
                    type="button"
                  >
                    <div
                      className={
                        styles.accordionIdentity
                      }
                    >
                      <span>
                        Payment Voucher
                      </span>

                      <strong>
                        Voucher {index + 1}
                      </strong>

                      <small>
                        {recipientLabel}
                      </small>
                    </div>

                    <div
                      className={
                        styles.accordionAmount
                      }
                    >
                      <span>Amount</span>

                      <strong>
                        {formatCurrency(
                          amount,
                        )}
                      </strong>
                    </div>

                    <span
                      className={
                        styles.statusPill
                      }
                      data-tone={
                        isValid
                          ? 'success'
                          : 'danger'
                      }
                    >
                      {isValid
                        ? 'Ready'
                        : 'Needs attention'}
                    </span>
                  </button>

                  <div
                    className={
                      styles.voucherCardActions
                    }
                  >
                    <button
                      className={
                        styles.secondaryButton
                      }
                      onClick={() =>
                        duplicateRow(row)
                      }
                      type="button"
                    >
                      Duplicate
                    </button>

                    <button
                      className={
                        styles.dangerButton
                      }
                      onClick={() =>
                        removeRow(
                          row.rowId,
                        )
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </header>

                {isExpanded && (
                  <div
                    id={`bulk-voucher-content-${row.rowId}`}
                  >
                    <VoucherEditor
                      fieldErrors={inlineFieldErrors}
                      row={row}
                      onUpdate={(
                        field,
                        value,
                      ) =>
                        updateRow(
                          row.rowId,
                          field,
                          value,
                        )
                      }
                      onSupportingDocumentsChange={(
                        fileNames,
                      ) =>
                        updateSupportingDocuments(
                          row.rowId,
                          fileNames,
                        )
                      }
                    />

                    {validationAttempted &&
                      validation &&
                      remainingErrors.length > 0 && (
                        <div
                          className={
                            styles.cardValidationNotice
                          }
                          role="alert"
                        >
                          <strong>
                            Please correct:
                          </strong>

                          <ul>
                            {remainingErrors.map(
                              (
                                error,
                                errorIndex,
                              ) => (
                                <li
                                  key={`${error.field}-${errorIndex}`}
                                >
                                  {
                                    error.message
                                  }
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </article>
            );
          },
        )}
      </div>

      <footer className={styles.pageActions}>
        <button
          className={`${styles.dangerButton} ${styles.discardButton}`}
          onClick={discardEntries}
          type="button"
        >
          Discard all entries
        </button>

        <ManualDraftStatus message={draft.draftMessage} />

        <div
          className={
            styles.pageActionGroup
          }
        >
          <button
            className={styles.secondaryButton}
            disabled={draft.isSavingDraft}
            onClick={() => {
              setFormMessage('');
              draft
                .saveDraft()
                .then(() => setDraftSaved(true))
                .catch((error) =>
                  setFormMessage(
                    error instanceof Error
                      ? error.message
                      : 'The Payment Voucher draft could not be saved.',
                  ),
                );
            }}
            type="button"
          >
            {draft.isSavingDraft ? 'Saving draft…' : 'Save as draft'}
          </button>

          <button
            className={
              styles.secondaryButton
            }
            onClick={addRow}
            type="button"
          >
            Add another voucher
          </button>

          <button
            className={
              styles.primaryButton
            }
            onClick={handleContinue}
            type="button"
          >
            Continue to preview
          </button>
        </div>
      </footer>
    </div>
  );
}



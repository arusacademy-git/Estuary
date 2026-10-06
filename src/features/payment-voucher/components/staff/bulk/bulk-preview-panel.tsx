'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  calculateBulkPaymentVoucherAmount,
  validateBulkPaymentVoucherRows,
} from '@/domain/payment-vouchers/bulk-upload';

import type {
  BulkPaymentVoucherRow,
} from '@/domain/payment-vouchers/bulk-upload';

import styles from './bulk-payment-voucher.module.css';

type BulkPreviewPanelProps = {
  rows: BulkPaymentVoucherRow[];

  source:
    | 'spreadsheet'
    | 'manual';

  onBack: () => void;

  onConfirm: (
    selectedRows:
      BulkPaymentVoucherRow[],
  ) => void | Promise<void>;
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

export function BulkPreviewPanel({
  rows,
  source,
  onBack,
  onConfirm,
}: BulkPreviewPanelProps) {
  const [
    selectedRowIds,
    setSelectedRowIds,
  ] = useState<Set<string>>(
    new Set(),
  );

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const validations = useMemo(
    () =>
      validateBulkPaymentVoucherRows(
        rows,
      ),
    [rows],
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

  const validRows = useMemo(
    () =>
      rows.filter((row) => {
        return (
          validationByRowId.get(
            row.rowId,
          )?.isValid === true
        );
      }),
    [rows, validationByRowId],
  );

  const invalidRows = useMemo(
    () =>
      rows.filter((row) => {
        return (
          validationByRowId.get(
            row.rowId,
          )?.isValid !== true
        );
      }),
    [rows, validationByRowId],
  );

  /*
   * Select all valid rows when the preview
   * is first opened. Invalid rows remain
   * unselected and disabled.
   */
  useEffect(() => {
    setSelectedRowIds(
      new Set(
        validRows.map(
          (row) => row.rowId,
        ),
      ),
    );
  }, [validRows]);

  const selectedRows =
    useMemo(
      () =>
        rows.filter((row) =>
          selectedRowIds.has(
            row.rowId,
          ),
        ),
      [rows, selectedRowIds],
    );

  const selectedAmount =
    useMemo(
      () =>
        selectedRows.reduce(
          (total, row) =>
            total +
            calculateBulkPaymentVoucherAmount(
              row,
            ),
          0,
        ),
      [selectedRows],
    );

  const allValidSelected =
    validRows.length > 0 &&
    validRows.every((row) =>
      selectedRowIds.has(
        row.rowId,
      ),
    );

  function toggleRow(
    rowId: string,
  ) {
    const validation =
      validationByRowId.get(rowId);

    if (!validation?.isValid) {
      return;
    }

    setSelectedRowIds(
      (currentSelection) => {
        const nextSelection =
          new Set(
            currentSelection,
          );

        if (
          nextSelection.has(rowId)
        ) {
          nextSelection.delete(rowId);
        } else {
          nextSelection.add(rowId);
        }

        return nextSelection;
      },
    );

    setErrorMessage('');
  }

  function toggleAllValidRows() {
    if (allValidSelected) {
      setSelectedRowIds(
        new Set(),
      );

      return;
    }

    setSelectedRowIds(
      new Set(
        validRows.map(
          (row) => row.rowId,
        ),
      ),
    );
  }

  async function handleConfirm() {
    setErrorMessage('');

    if (
      selectedRows.length === 0
    ) {
      setErrorMessage(
        'Select at least one valid Payment Voucher.',
      );

      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm(
        selectedRows,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create the draft Payment Vouchers.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={styles.panel}>
      <div
        className={styles.pageHeading}
      >
        <div>
          <p className={styles.status}>
            Bulk preview
          </p>

          <h1>
            Review Payment Vouchers
          </h1>

          <p className={styles.copy}>
            Review the{' '}
            {source ===
            'spreadsheet'
              ? 'spreadsheet rows'
              : 'manually entered vouchers'}{' '}
            before creating separate draft
            Payment Vouchers.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          className={styles.notice}
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <section
        className={styles.bulkReviewSummary}
      >
        <div
          className={
            styles.summaryStats
          }
        >
          <div
            className={
              styles.summaryStat
            }
          >
            <span>Total rows</span>
            <strong>{rows.length}</strong>
          </div>

          <div
            className={
              styles.summaryStat
            }
          >
            <span>Valid</span>
            <strong>
              {validRows.length}
            </strong>
          </div>

          <div
            className={
              styles.summaryStat
            }
          >
            <span>Invalid</span>
            <strong>
              {invalidRows.length}
            </strong>
          </div>

          <div
            className={
              styles.summaryStat
            }
          >
            <span>Selected</span>
            <strong>
              {selectedRows.length}
            </strong>
          </div>

          <div
            className={
              styles.summaryStat
            }
          >
            <span>Selected amount</span>

            <strong>
              {formatCurrency(
                selectedAmount,
              )}
            </strong>
          </div>
        </div>
      </section>

      <section
        className={
          styles.bulkReviewCard
        }
      >
        <div
          className={
            styles.bulkReviewHeader
          }
        >
          <div>
            <h2>
              Voucher preview
            </h2>

            <p className={styles.copy}>
              Invalid rows cannot be
              selected.
            </p>
          </div>

          <button
            className={
              styles.secondaryButton
            }
            disabled={
              validRows.length === 0
            }
            onClick={
              toggleAllValidRows
            }
            type="button"
          >
            {allValidSelected
              ? 'Clear selection'
              : 'Select all valid'}
          </button>
        </div>

        <div
          className={
            styles.previewTableWrapper
          }
        >
          <table
            className={
              styles.previewTable
            }
          >
            <thead>
              <tr>
                <th>Select</th>
                <th>Row</th>
                <th>Recipient</th>
                <th>PV date</th>
                <th>Division</th>
                <th>Director</th>
                <th>Purpose</th>
                <th>Amount</th>
                <th>Validation</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(
                (row, index) => {
                  const validation =
                    validationByRowId.get(
                      row.rowId,
                    );

                  const isValid =
                    validation?.isValid ===
                    true;

                  const isSelected =
                    selectedRowIds.has(
                      row.rowId,
                    );

                  return (
                    <tr key={row.rowId}>
                      <td>
                        <input
                          aria-label={`Select voucher row ${
                            index + 1
                          }`}
                          checked={
                            isSelected
                          }
                          disabled={
                            !isValid ||
                            isSubmitting
                          }
                          onChange={() =>
                            toggleRow(
                              row.rowId,
                            )
                          }
                          type="checkbox"
                        />
                      </td>

                      <td>
                        {index + 1}
                      </td>

                      <td>
                        <strong>
                          {row.recipientName ||
                            'Missing recipient'}
                        </strong>

                        <br />

                        <small>
                          {row.recipientEmail ||
                            'No email'}
                        </small>
                      </td>

                      <td>
                        {row.pvDate ||
                          'Not provided'}
                      </td>

                      <td>
                        {row.division ||
                          'Not provided'}
                      </td>

                      <td>
                        {row.directorEmail ||
                          'Not provided'}
                      </td>

                      <td>
                        {row.purpose ||
                          'Not provided'}
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(
                            calculateBulkPaymentVoucherAmount(
                              row,
                            ),
                          )}
                        </strong>
                      </td>

                      <td>
                        {isValid ? (
                          <strong>
                            Valid
                          </strong>
                        ) : (
                          <div>
                            <strong>
                              Needs attention
                            </strong>

                            <ul>
                              {validation?.errors.map(
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
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer
        className={styles.formActions}
      >
        <button
          className={
            styles.secondaryButton
          }
          disabled={isSubmitting}
          onClick={onBack}
          type="button"
        >
          Back
        </button>

        <button
          className={styles.primary}
          disabled={
            selectedRows.length === 0 ||
            isSubmitting
          }
          onClick={handleConfirm}
          type="button"
        >
          {isSubmitting
            ? 'Creating drafts…'
            : `Create ${
                selectedRows.length
              } ${
                selectedRows.length ===
                1
                  ? 'draft'
                  : 'drafts'
              }`}
        </button>
      </footer>
    </section>
  );
}

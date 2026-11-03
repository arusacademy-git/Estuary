'use client';

import {
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  betaAccounts,
  readBetaSession,
} from '@/lib/auth/beta-accounts';

import {
  createLocalNotification,
} from '@/data/notifications/local-notification-store';

import {
  createPaymentVoucher,
  submitDraftPaymentVoucher,
} from '@/data/payment-vouchers/payment-voucher-api';
import {
  deleteManualFormDraft,
  fetchManualFormDraft,
  saveManualFormDraft,
} from '@/data/payment-requests/manual-drafts/api';

import {
  convertBulkRowToCreatePaymentVoucherInput,
  createEmptyBulkPaymentVoucherRow,
} from '@/domain/payment-vouchers/bulk-upload';

import type {
  BulkPaymentVoucherRow,
} from '@/domain/payment-vouchers/bulk-upload';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  BulkCsvUploadPanel,
} from './bulk-csv-upload-panel';

import {
  BulkManualEntryPanel,
} from './bulk-manual-entry-panel';

import {
  BulkPreviewPanel,
} from './bulk-preview-panel';

import styles from './bulk-payment-voucher.module.css';

type BulkEntryMode =
  | 'manual'
  | 'spreadsheet';

type BulkStep =
  | 'entry'
  | 'preview'
  | 'success';

type BulkPaymentVoucherDraftSnapshot = {
  creationMode: 'multiple';
  entryMode: BulkEntryMode;
  manualRows?: BulkPaymentVoucherRow[];
  rows?: BulkPaymentVoucherRow[];
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

export function BulkPaymentVoucherCreateFlow() {
  const router = useRouter();
  const [account] = useState(() => readBetaSession());

  useEffect(() => {
    if (!account) return;
    const parameters = new URLSearchParams(window.location.search);
    if (parameters.get('draft') !== '1') return;
    let cancelled = false;
    fetchManualFormDraft<BulkPaymentVoucherDraftSnapshot>(
      'PAYMENT_VOUCHER',
      'beta-arus-org',
      account.id,
    ).then((savedDraft) => {
      if (cancelled || !savedDraft) return;
      const savedRows = savedDraft.snapshot.manualRows ?? savedDraft.snapshot.rows;
      if (savedRows?.length) setManualRows(savedRows.map((row) => ({ ...row })));
      setEntryMode(savedDraft.snapshot.entryMode ?? 'manual');
      setCurrentStep('entry');
    }).catch(() => {
      // The entry form remains available when a saved draft cannot be restored.
    });
    return () => {
      cancelled = true;
    };
  }, [account]);

  const [
    entryMode,
    setEntryMode,
  ] = useState<BulkEntryMode>(
    'manual',
  );

  const [
    currentStep,
    setCurrentStep,
  ] = useState<BulkStep>(
    'entry',
  );

  const [
    manualRows,
    setManualRows,
  ] = useState<
    BulkPaymentVoucherRow[]
  >([
    createEmptyBulkPaymentVoucherRow(),
  ]);

  const [
    previewRows,
    setPreviewRows,
  ] = useState<
    BulkPaymentVoucherRow[]
  >([]);

  const [
    previewSource,
    setPreviewSource,
  ] = useState<
    'spreadsheet' | 'manual'
  >('manual');

  const [
    createdVouchers,
    setCreatedVouchers,
  ] = useState<
    PaymentVoucherRecord[]
  >([]);

  const [
    selectedDraftIds,
    setSelectedDraftIds,
  ] = useState<string[]>([]);

  const [
    isSubmittingDrafts,
    setIsSubmittingDrafts,
  ] = useState(false);

  const [
    submissionMessage,
    setSubmissionMessage,
  ] = useState('');

  const [
    submissionError,
    setSubmissionError,
  ] = useState('');

  function openPreview(
    rows: BulkPaymentVoucherRow[],
    source: 'spreadsheet' | 'manual',
  ) {
    setPreviewRows(rows);
    setPreviewSource(source);
    setCurrentStep('preview');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function handleBackFromPreview() {
    setCurrentStep('entry');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function handleCreateDrafts(
    selectedRows:
      BulkPaymentVoucherRow[],
  ) {
    if (
      !account ||
      !['staff', 'manager', 'finance'].includes(account.role)
    ) {
      throw new Error(
        'Only Staff, Manager and Finance accounts can create Payment Vouchers.',
      );
    }

    if (
      selectedRows.length === 0
    ) {
      throw new Error(
        'Select at least one valid Payment Voucher.',
      );
    }

    /*
     * Validate and convert all selected rows
     * before saving anything.
     */
    const voucherInputs =
      selectedRows.map((row) =>
        convertBulkRowToCreatePaymentVoucherInput(
          row,
          account.id,
        ),
      );

    const newVouchers:
      PaymentVoucherRecord[] = [];

    for (
      const voucherInput
      of voucherInputs
    ) {
      /*
       * Bulk preview confirmation is a real submission.
       * Draft batches are stored separately in PaymentRequestDraft.
       */
      const createdVoucher =
        await createPaymentVoucher(
          voucherInput,
          true,
        );

      newVouchers.push(
        createdVoucher,
      );

      try {
        createLocalNotification({
          recipientId: createdVoucher.directorId,
          actorId: account.id,
          type: 'PAYMENT_VOUCHER_SUBMITTED',
          entityType: 'PAYMENT_VOUCHER',
          entityId: createdVoucher.id,
          referenceNumber: createdVoucher.voucherNumber,
          title: 'Payment Voucher requires approval',
          message: `${createdVoucher.voucherNumber} was submitted by ${account.name} and requires your approval.`,
          href: `/beta/payment-vouchers/${createdVoucher.id}`,
        });
      } catch (notificationError) {
        console.error(
          'The Payment Voucher was submitted, but the Director notification could not be created.',
          notificationError,
        );
      }
    }

    try {
      const savedDraft = await fetchManualFormDraft(
        'PAYMENT_VOUCHER',
        'beta-arus-org',
        account.id,
      );
      if (savedDraft) {
        await deleteManualFormDraft(
          savedDraft.id,
          'beta-arus-org',
          account.id,
        );
        window.dispatchEvent(new Event('estuary:action-counts-changed'));
      }
    } catch (draftCleanupError) {
      console.error(
        'The vouchers were submitted, but the saved batch draft could not be removed.',
        draftCleanupError,
      );
    }

    setCreatedVouchers(
      newVouchers,
    );

    /*
     * Submitted vouchers are no longer represented as drafts.
     */
    setSelectedDraftIds(
      [],
    );

    setSubmissionMessage('');
    setSubmissionError('');
    setCurrentStep('success');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function handleSaveBatchDraft(selectedRows: BulkPaymentVoucherRow[]) {
    if (!account || !['staff', 'manager', 'finance'].includes(account.role)) {
      throw new Error('Only Staff, Manager and Finance accounts can save Payment Voucher drafts.');
    }
    await saveManualFormDraft({
      organizationId: 'beta-arus-org',
      requesterId: account.id,
      paymentType: 'PAYMENT_VOUCHER',
      snapshot: {
        creationMode: 'multiple',
        entryMode: previewSource,
        manualRows: selectedRows.map((row) => ({ ...row })),
        rows: selectedRows.map((row) => ({ ...row })),
      },
    });
    window.dispatchEvent(new Event('estuary:action-counts-changed'));
    router.push('/beta/payment-vouchers?scope=mine');
  }

  function toggleDraftSelection(
    voucherId: string,
  ) {
    setSelectedDraftIds(
      (currentIds) => {
        if (
          currentIds.includes(
            voucherId,
          )
        ) {
          return currentIds.filter(
            (id) =>
              id !== voucherId,
          );
        }

        return [
          ...currentIds,
          voucherId,
        ];
      },
    );
  }

  function selectAllDrafts() {
    const draftIds =
      createdVouchers
        .filter(
          (voucher) =>
            voucher.status ===
            'DRAFT',
        )
        .map(
          (voucher) =>
            voucher.id,
        );

    const allDraftsSelected =
      draftIds.length > 0 &&
      draftIds.every((id) =>
        selectedDraftIds.includes(id),
      );

    setSelectedDraftIds(
      allDraftsSelected
        ? []
        : draftIds,
    );
  }

  async function handleSubmitSelectedDrafts() {
    const account =
      readBetaSession();

    if (
      !account ||
      !['staff', 'manager', 'finance'].includes(account.role)
    ) {
      setSubmissionError(
        'Only Staff, Manager and Finance accounts can submit Payment Vouchers.',
      );

      return;
    }

    const selectedVouchers =
      createdVouchers.filter(
        (voucher) =>
          voucher.status ===
            'DRAFT' &&
          selectedDraftIds.includes(
            voucher.id,
          ),
      );

    if (
      selectedVouchers.length === 0
    ) {
      setSubmissionError(
        'Select at least one draft before submitting.',
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Submit ${selectedVouchers.length} ${
          selectedVouchers.length === 1
            ? 'Payment Voucher'
            : 'Payment Vouchers'
        } to the assigned ${
          selectedVouchers.length === 1
            ? 'Director'
            : 'Directors'
        }?`,
      );

    if (!confirmed) {
      return;
    }

    setIsSubmittingDrafts(true);
    setSubmissionMessage('');
    setSubmissionError('');

    try {
      const submittedById =
        new Map<
          string,
          PaymentVoucherRecord
        >();

      for (
        const voucher
        of selectedVouchers
      ) {
        const submittedVoucher =
          await submitDraftPaymentVoucher(
            voucher.id,
            account.id,
          );

        submittedById.set(
          submittedVoucher.id,
          submittedVoucher,
        );

        /*
         * Notify each assigned Director.
         * Notification failure does not undo
         * a successful voucher submission.
         */
        try {
          createLocalNotification({
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
        } catch (
          notificationError
        ) {
          console.error(
            'The Payment Voucher was submitted, but the Director notification could not be created.',
            notificationError,
          );
        }
      }

      setCreatedVouchers(
        (currentVouchers) =>
          currentVouchers.map(
            (voucher) =>
              submittedById.get(
                voucher.id,
              ) ?? voucher,
          ),
      );

      setSelectedDraftIds([]);

      setSubmissionMessage(
        `${selectedVouchers.length} ${
          selectedVouchers.length === 1
            ? 'Payment Voucher was'
            : 'Payment Vouchers were'
        } submitted to the assigned ${
          selectedVouchers.length === 1
            ? 'Director'
            : 'Directors'
        }.`,
      );
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : 'Unable to submit the selected Payment Vouchers.',
      );
    } finally {
      setIsSubmittingDrafts(
        false,
      );
    }
  }

  function resetBulkFlow() {
    setEntryMode('manual');
    setCurrentStep('entry');

    setPreviewRows([]);
    setPreviewSource('manual');

    setCreatedVouchers([]);
    setSelectedDraftIds([]);

    setSubmissionMessage('');
    setSubmissionError('');

    setManualRows([
      createEmptyBulkPaymentVoucherRow(),
    ]);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  if (
    currentStep === 'preview'
  ) {
    return (
      <div className={styles.bulkFlow}>
        <BulkPreviewPanel
          rows={previewRows}
          source={previewSource}
          onBack={
            handleBackFromPreview
          }
          onConfirm={
            handleCreateDrafts
          }
          onSaveDraft={handleSaveBatchDraft}
        />
      </div>
    );
  }

  if (
    currentStep === 'success'
  ) {
    const remainingDrafts =
      createdVouchers.filter(
        (voucher) =>
          voucher.status ===
          'DRAFT',
      );

    const allDraftsSelected =
      remainingDrafts.length > 0 &&
      remainingDrafts.every(
        (voucher) =>
          selectedDraftIds.includes(
            voucher.id,
          ),
      );

    return (
      <div className={styles.bulkFlow}>
        <section
          className={
            styles.bulkHeader
          }
        >
          <p
            className={styles.eyebrow}
          >
            Bulk creation completed
          </p>

          <h1>
            {createdVouchers.length}{' '}
            {createdVouchers.length === 1
              ? 'voucher was created'
              : 'vouchers were created'}
          </h1>

          <p>
            Review the created drafts
            below. When everything is
            correct, select the drafts and
            submit them to their assigned
            Directors.
          </p>
        </section>

        {submissionMessage && (
          <div
            className={
              styles.successNotice
            }
            role="status"
          >
            {submissionMessage}
          </div>
        )}

        {submissionError && (
          <div
            className={
              styles.validationNotice
            }
            role="alert"
          >
            {submissionError}
          </div>
        )}

        <section
          className={
            styles.summaryCard
          }
        >
          <div
            className={
              styles.summaryHeader
            }
          >
            <div
              className={
                styles.summaryHeaderText
              }
            >
              <p
                className={
                  styles.summaryLabel
                }
              >
                Created vouchers
              </p>

              <h2>
                Review and submit
              </h2>

              <span
                className={
                  styles.summaryDescription
                }
              >
                Open an individual draft
                if it needs checking or
                editing.
              </span>
            </div>

            <span
              className={
                styles.summaryBadge
              }
            >
              {remainingDrafts.length}{' '}
              {remainingDrafts.length === 1
                ? 'draft remaining'
                : 'drafts remaining'}
            </span>
          </div>

          <div
            className={
              styles.draftSelectionBar
            }
          >
            <label
              className={
                styles.selectAllControl
              }
            >
              <input
                checked={
                  allDraftsSelected
                }
                disabled={
                  remainingDrafts.length ===
                  0
                }
                onChange={
                  selectAllDrafts
                }
                type="checkbox"
              />

              <span>
                Select all drafts
              </span>
            </label>

            <span>
              {selectedDraftIds.length}{' '}
              selected
            </span>
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
                  <th
                    aria-label="Select"
                  />

                  <th>PV number</th>
                  <th>Recipient</th>
                  <th>Division</th>
                  <th>Director</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {createdVouchers.map(
                  (voucher) => {
                    const isDraft =
                      voucher.status ===
                      'DRAFT';

                    const director =
                      betaAccounts.find(
                        (account) =>
                          account.id ===
                          voucher.directorId,
                      );

                    return (
                      <tr
                        key={
                          voucher.id
                        }
                      >
                        <td>
                          <input
                            aria-label={`Select ${voucher.voucherNumber}`}
                            checked={
                              isDraft &&
                              selectedDraftIds.includes(
                                voucher.id,
                              )
                            }
                            disabled={
                              !isDraft ||
                              isSubmittingDrafts
                            }
                            onChange={() =>
                              toggleDraftSelection(
                                voucher.id,
                              )
                            }
                            type="checkbox"
                          />
                        </td>

                        <td>
                          <strong>
                            {
                              voucher.voucherNumber
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            voucher.recipientName
                          }
                        </td>

                        <td>
                          {
                            voucher.division
                          }
                        </td>

                        <td>
                          {director?.name ??
                            'Assigned Director'}
                        </td>

                        <td>
                          {formatCurrency(
                            voucher.amount,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              isDraft
                                ? styles.draftBadge
                                : styles.submittedBadge
                            }
                          >
                            {isDraft
                              ? 'Draft'
                              : 'Pending Director Approval'}
                          </span>
                        </td>

                        <td>
                          <Link
                            className={
                              styles.tableActionLink
                            }
                            href={`/beta/payment-vouchers/${voucher.id}`}
                          >
                            View draft
                          </Link>
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
          className={
            styles.pageActions
          }
        >
          <button
            className={
              styles.secondaryButton
            }
            onClick={
              resetBulkFlow
            }
            type="button"
          >
            Create more vouchers
          </button>

          <div
            className={
              styles.pageActionGroup
            }
          >
            <button
              className={
                styles.secondaryButton
              }
              onClick={() =>
                router.push(
                  '/beta/payment-vouchers',
                )
              }
              type="button"
            >
              View payment records
            </button>

            <button
              className={
                styles.primaryButton
              }
              disabled={
                selectedDraftIds.length ===
                  0 ||
                isSubmittingDrafts
              }
              onClick={
                handleSubmitSelectedDrafts
              }
              type="button"
            >
              {isSubmittingDrafts
                ? 'Submitting…'
                : remainingDrafts.length ===
                    0
                  ? 'All vouchers submitted'
                  : `Submit selected (${selectedDraftIds.length})`}
            </button>
          </div>
        </footer>
      </div>
    );
  }

  const heading =
    entryMode === 'manual'
      ? 'Enter vouchers manually'
      : 'Import from Google Sheets';

  const description =
    entryMode === 'manual'
      ? 'Add several Payment Vouchers, validate them together and continue to the bulk preview. Each valid entry will become a separate draft.'
      : 'Paste a shared Google Sheets link. Estuary will display and validate the linked rows before creating any draft Payment Vouchers.';

  return (
    <div className={styles.bulkFlow}>
      <section
        className={styles.bulkHeader}
      >
        <p
          className={styles.eyebrow}
        >
          Multiple Payment Vouchers
        </p>

        <h1>{heading}</h1>

        <p>{description}</p>
      </section>

      <div
        aria-label="Bulk entry method"
        className={styles.methodTabs}
        role="tablist"
      >
        <button
          aria-controls="manual-entry-panel"
          aria-selected={
            entryMode === 'manual'
          }
          className={
            styles.methodTab
          }
          data-active={
            entryMode === 'manual'
          }
          id="manual-entry-tab"
          onClick={() =>
            setEntryMode('manual')
          }
          role="tab"
          type="button"
        >
          Manual Entry
        </button>

        <button
          aria-controls="spreadsheet-upload-panel"
          aria-selected={
            entryMode ===
            'spreadsheet'
          }
          className={
            styles.methodTab
          }
          data-active={
            entryMode ===
            'spreadsheet'
          }
          id="spreadsheet-upload-tab"
          onClick={() =>
            setEntryMode(
              'spreadsheet',
            )
          }
          role="tab"
          type="button"
        >
          Google Sheet Link
        </button>
      </div>

      <div
        aria-labelledby="manual-entry-tab"
        hidden={
          entryMode !== 'manual'
        }
        id="manual-entry-panel"
        role="tabpanel"
      >
        <BulkManualEntryPanel
          rows={manualRows}
          onChange={setManualRows}
          onContinue={(rows) =>
            openPreview(
              rows,
              'manual',
            )
          }
        />
      </div>

      <div
        aria-labelledby="spreadsheet-upload-tab"
        hidden={
          entryMode !==
          'spreadsheet'
        }
        id="spreadsheet-upload-panel"
        role="tabpanel"
      >
        <BulkCsvUploadPanel
          onContinue={(rows) =>
            openPreview(
              rows,
              'spreadsheet',
            )
          }
        />
      </div>
    </div>
  );
}

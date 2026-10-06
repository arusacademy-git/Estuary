'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  readBetaSession,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';

import {
  PAYMENT_RECORD_SORT_OPTIONS,
  sortPaymentRecords,
  type PaymentRecordSort,
} from '@/domain/payment-records/payment-record-sort';

import { usePaymentVouchers } from '@/features/payment-voucher/hooks/use-payment-vouchers';

import { PaymentVoucherRecordList } from '@/features/payment-voucher/components/payment-voucher-record-list';

import {
  canDownloadSignedPaymentVoucher,
  downloadSignedPaymentVouchersZip,
} from '@/features/payment-voucher/pdf/download-signed-payment-vouchers-zip';

import styles from '@/features/payment-voucher/components/payment-voucher.module.css';
import overrides from './payment-voucher-records-overrides.module.css';

const statusOptions = [
  {
    value: 'ALL',
    label: 'All statuses',
  },
  {
    value: 'DRAFT',
    label: 'Draft',
  },
  {
    value: 'PENDING_DIRECTOR_APPROVAL',
    label: 'Pending Director Approval',
  },
  {
    value: 'REJECTED',
    label: 'Rejected',
  },
  {
    value: 'APPROVED_FOR_PAYMENT',
    label: 'Approved for Payment',
  },
  {
    value: 'FINANCE_PROCESSING',
    label: 'Finance Processing',
  },
  {
    value: 'AWAITING_RECIPIENT_SIGNATURE',
    label: 'Awaiting Recipient Signature',
  },
  {
    value: 'AWAITING_STAFF_CONFIRMATION',
    label: 'Awaiting Staff Confirmation',
  },
  {
    value: 'PENDING_FINANCE_VERIFICATION',
    label: 'Pending Finance Verification',
  },
  {
    value: 'AWAITING_STAFF_VERIFICATION',
    label: 'Awaiting Staff Verification',
  },
  {
    value: 'AWAITING_SIGNATURE',
    label: 'Awaiting Recipient Signature',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
  },
  {
    value: 'INACTIVE',
    label: 'Inactive',
  },
];

type RecordsViewMode =
  | 'grid'
  | 'list';

function getAccountPermissions(account: BetaAccount) {
  const compatibleAccount = account as BetaAccount & {
    role?: string;
    roles?: string[];
    permissions?: string[];
    position?: string;
  };

  return [
    compatibleAccount.role,
    ...(compatibleAccount.roles ?? []),
    ...(compatibleAccount.permissions ?? []),
    compatibleAccount.position,
  ]
    .filter(
      (value): value is string =>
        typeof value === 'string',
    )
    .map((value) => value.toLowerCase());
}

function accountHasPermission(
  permissions: string[],
  expectedPermission: string,
) {
  const expected =
    expectedPermission.toLowerCase();

  return permissions.some((permission) =>
    permission.includes(expected),
  );
}

export default function PaymentVoucherRecordsPage() {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const personalOnly = searchParameters.get('scope') === 'mine';

  const {
    records,
    isLoading,
  } = usePaymentVouchers();

  const [account, setAccount] =
    useState<BetaAccount | null>(null);

  const [sessionChecked, setSessionChecked] =
    useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [month, setMonth] = useState('');
  const [specificDate, setSpecificDate] =
    useState('');
  const [sort, setSort] =
    useState<PaymentRecordSort>('UPDATED_DESC');

  const [viewMode, setViewMode] =
    useState<RecordsViewMode>('grid');

  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [bulkDownloadMessage, setBulkDownloadMessage] = useState('');
  const [bulkDownloadError, setBulkDownloadError] = useState('');

  useEffect(() => {
    const currentAccount = readBetaSession();

    setAccount(currentAccount);
    setSessionChecked(true);

    if (!currentAccount) {
      router.replace('/beta');
    }
  }, [router]);

  const permissions = useMemo(() => {
    if (!account) {
      return [];
    }

    return getAccountPermissions(account);
  }, [account]);

  const visibleRecords = useMemo(() => {
    if (!account) {
      return [];
    }

    const isDirector = accountHasPermission(
      permissions,
      'director',
    );

    const isManager =
      accountHasPermission(
        permissions,
        'manager',
      ) ||
      accountHasPermission(
        permissions,
        'project manager',
      );

    const isFinance = accountHasPermission(
      permissions,
      'finance',
    );

    return records.filter((voucher) => {
      const belongsToSubmitter =
        voucher.submitterId === account.id;

      if (personalOnly) {
        return belongsToSubmitter;
      }

      const belongsToDirector =
        isDirector &&
        voucher.directorId === account.id;

      const belongsToManager =
        isManager &&
        voucher.projectManagerId === account.id;

      const visibleToFinance = isFinance;

      return (
        belongsToSubmitter ||
        belongsToDirector ||
        belongsToManager ||
        visibleToFinance
      );
    });
  }, [account, permissions, personalOnly, records]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    const matchingRecords = visibleRecords
      .filter((voucher) => {
        if (
          status !== 'ALL' &&
          voucher.status !== status
        ) {
          return false;
        }

        if (
          month &&
          !voucher.pvDate.startsWith(month)
        ) {
          return false;
        }

        if (
          specificDate &&
          voucher.pvDate !== specificDate
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchableValues = [
          voucher.voucherNumber,
          voucher.recipientName,
          voucher.recipientEmail,
          voucher.recipientReference,
          voucher.purpose,
          voucher.division,
          voucher.paymentReference ?? '',
        ];

        return searchableValues.some((value) =>
          value
            .toLowerCase()
            .includes(normalizedSearch),
        );
      });

    return sortPaymentRecords(
      matchingRecords,
      sort,
      (voucher) => ({
        reference: voucher.voucherNumber,
        updatedAt: voucher.updatedAt,
        amount: voucher.amount,
      }),
    );
  }, [
    visibleRecords,
    search,
    status,
    month,
    specificDate,
    sort,
  ]);

  const downloadableSignedRecords = useMemo(
    () => filteredRecords.filter(canDownloadSignedPaymentVoucher),
    [filteredRecords],
  );

  async function handleBulkSignedDownload() {
    setBulkDownloadMessage('');
    setBulkDownloadError('');
    setIsBulkDownloading(true);

    try {
      await downloadSignedPaymentVouchersZip(downloadableSignedRecords);
      setBulkDownloadMessage(
        `${downloadableSignedRecords.length} signed Payment ${downloadableSignedRecords.length === 1 ? 'Voucher was' : 'Vouchers were'} added to one ZIP file.`,
      );
    } catch (downloadError) {
      setBulkDownloadError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Unable to download the signed Payment Vouchers.',
      );
    } finally {
      setIsBulkDownloading(false);
    }
  }

  function handleMonthChange(
    selectedMonth: string,
  ) {
    setMonth(selectedMonth);

    if (
      specificDate &&
      !specificDate.startsWith(selectedMonth)
    ) {
      setSpecificDate('');
    }
  }

  function clearFilters() {
    setSearch('');
    setStatus('ALL');
    setMonth('');
    setSpecificDate('');
    setSort('UPDATED_DESC');
  }

  if (!sessionChecked || isLoading) {
    return (
      <section className={styles.recordsStateCard}>
        <h1>Loading payment records</h1>

        <p>
          Please wait while your Payment Vouchers are
          being loaded.
        </p>
      </section>
    );
  }

  if (!account) {
    return null;
  }

  return (
    <div className={styles.recordsPage}>
      <Link className={styles.recordsBackLink} href="/beta/payment-records">
        ← Back to Payment Records
      </Link>
      <header className={styles.recordsHeader}>
        <div>
          <p className={styles.eyebrow}>
            Payment Vouchers
          </p>

          <h1>Payment records</h1>

          <p>
            View and track Payment Vouchers that are
            relevant to your account.
          </p>
        </div>

      </header>

      <section className={styles.recordsOverview}>
        <article>
          <span>All visible records</span>
          <strong>{visibleRecords.length}</strong>
        </article>

        <article>
          <span>In progress</span>

          <strong>
            {
              visibleRecords.filter(
                (voucher) =>
                  voucher.status !== 'COMPLETED' &&
                  voucher.status !== 'REJECTED' &&
                  voucher.status !== 'DRAFT',
              ).length
            }
          </strong>
        </article>

        <article>
          <span>Require attention</span>

          <strong>
            {
              visibleRecords.filter(
                (voucher) =>
                  voucher.status === 'REJECTED' ||
                  voucher.status ===
                  'AWAITING_STAFF_VERIFICATION',
              ).length
            }
          </strong>
        </article>

        <article>
          <span>Completed</span>

          <strong>
            {
              visibleRecords.filter(
                (voucher) =>
                  voucher.status === 'COMPLETED',
              ).length
            }
          </strong>
        </article>
      </section>

      <section className={styles.recordsFilterCard}>
        <div className={styles.recordsFilterHeading}>
          <div>
            <h2>Find a Payment Voucher</h2>

            <p>
              Search, filter and sort your payment records.
            </p>
          </div>

          <button
            className={styles.clearFiltersButton}
            type="button"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>

        <div className={`${styles.recordsFilters} ${overrides.sortableFilters}`}>
          <label
            className={styles.recordsSearchField}
          >
            <span>Search</span>

            <input
              type="search"
              value={search}
              placeholder="PV number, recipient or purpose"
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>

          <label>
            <span>Status</span>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
            >
              {statusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Month</span>

            <input
              type="month"
              value={month}
              onChange={(event) =>
                handleMonthChange(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Exact date</span>

            <input
              type="date"
              value={specificDate}
              min={
                month
                  ? `${month}-01`
                  : undefined
              }
              max={
                month
                  ? `${month}-31`
                  : undefined
              }
              onChange={(event) =>
                setSpecificDate(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>Sort by</span>

            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as PaymentRecordSort)
              }
            >
              {PAYMENT_RECORD_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.recordsResults}>
        <div className={styles.recordsResultsHeader}>
          <div>
            <h2>Payment Vouchers</h2>

            <p>
              Showing {filteredRecords.length} of{' '}
              {visibleRecords.length} visible records
            </p>
          </div>

          <div className={overrides.resultActions}>
            <button
              className={overrides.bulkDownloadButton}
              disabled={!downloadableSignedRecords.length || isBulkDownloading}
              onClick={handleBulkSignedDownload}
              type="button"
            >
              {isBulkDownloading
                ? 'Preparing ZIP…'
                : `↓ Download signed PVs (${downloadableSignedRecords.length})`}
            </button>

            <div
              aria-label="Choose Payment Voucher view"
              className={styles.recordsViewToggle}
              role="group"
            >
              <span>View</span>

            <button
              aria-pressed={
                viewMode === 'grid'
              }
              data-active={
                viewMode === 'grid'
              }
              onClick={() =>
                setViewMode('grid')
              }
              type="button"
            >
              <span aria-hidden="true">
                ▦
              </span>
              Grid
            </button>

            <button
              aria-pressed={
                viewMode === 'list'
              }
              data-active={
                viewMode === 'list'
              }
              onClick={() =>
                setViewMode('list')
              }
              type="button"
            >
              <span aria-hidden="true">
                ☷
              </span>
              List
            </button>
            </div>
          </div>
        </div>

        {bulkDownloadMessage && <p className={overrides.downloadSuccess} role="status">{bulkDownloadMessage}</p>}
        {bulkDownloadError && <p className={overrides.downloadError} role="alert">{bulkDownloadError}</p>}

        {filteredRecords.length > 0 ? (
          <PaymentVoucherRecordList
            vouchers={filteredRecords}
            viewMode={viewMode}
            emptyTitle="No matching Payment Vouchers"
            emptyDescription="Try changing or clearing the selected filters."
          />
        ) : (
          <div className={styles.recordsEmptyState}>
            <h3>No Payment Vouchers found</h3>

            <p>
              No records match the selected filters.
              Try clearing the filters.
            </p>

            <button
              className={styles.clearFiltersButton}
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

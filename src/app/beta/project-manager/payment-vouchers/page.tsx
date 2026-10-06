'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  readBetaSession,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';

import {
  usePaymentVouchers,
} from '@/features/payment-voucher/hooks/use-payment-vouchers';

import {
  ProjectManagerPreviewPanel,
} from '@/features/payment-voucher/components/project_manager/project-manager-preview-panel';

import {
  PaymentVoucherStatusBadge,
} from '@/features/payment-voucher/components/payment-voucher-status-badge';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';

import styles from '@/features/payment-voucher/components/project_manager/project-manager-preview.module.css';

const visibleStatuses = new Set([
  /*
   * Director approved—the Manager may
   * preview at any later workflow stage.
   */
  'APPROVED_FOR_PAYMENT',
  'FINANCE_PROCESSING',
  'AWAITING_RECIPIENT_SIGNATURE',
  'AWAITING_STAFF_CONFIRMATION',
  'PENDING_FINANCE_VERIFICATION',
  'COMPLETED',
  'INACTIVE',

  /*
   * Temporary legacy statuses.
   */
  'AWAITING_SIGNED_PV_UPLOAD',
  'AWAITING_STAFF_VERIFICATION',
  'AWAITING_SIGNATURE',
]);

type ManagerViewMode = 'grid' | 'list';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(amount);
}

export default function ProjectManagerPaymentVouchersPage() {
  const router = useRouter();

  const [account, setAccount] =
    useState<BetaAccount | null>(null);

  const [sessionChecked, setSessionChecked] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [viewMode, setViewMode] =
    useState<ManagerViewMode>('list');

  const [selectedVoucherId, setSelectedVoucherId] =
    useState<string | null>(null);

  const [viewFilter, setViewFilter] =
    useState<
      'REQUIRES_PREVIEW' | 'VIEWED' | 'ALL'
    >('REQUIRES_PREVIEW');

  const {
    records,
    isLoading,
    refresh,
  } = usePaymentVouchers();

  useEffect(() => {
    const currentAccount =
      readBetaSession();

    setAccount(currentAccount);
    setSessionChecked(true);

    if (!currentAccount) {
      router.replace('/beta');
    }
  }, [router]);

  const assignedRecords = useMemo(() => {
    if (!account) {
      return [];
    }

    return records
      .filter(
        (voucher) =>
          voucher.projectManagerId ===
            account.id &&
          visibleStatuses.has(
            voucher.status,
          ),
      )
      .sort(
        (firstVoucher, secondVoucher) =>
          new Date(
            secondVoucher.updatedAt,
          ).getTime() -
          new Date(
            firstVoucher.updatedAt,
          ).getTime(),
      );
  }, [account, records]);

  const requiresPreviewRecords =
    useMemo(
      () =>
        assignedRecords.filter(
          (voucher) =>
            !voucher.projectManagerViewedAt,
        ),
      [assignedRecords],
    );

  const viewedRecords = useMemo(
    () =>
      assignedRecords.filter(
        (voucher) =>
          Boolean(
            voucher.projectManagerViewedAt,
          ),
      ),
    [assignedRecords],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return assignedRecords.filter(
      (voucher) => {
        if (
          viewFilter ===
            'REQUIRES_PREVIEW' &&
          voucher.projectManagerViewedAt
        ) {
          return false;
        }

        if (
          viewFilter === 'VIEWED' &&
          !voucher.projectManagerViewedAt
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
        ];

        return searchableValues.some(
          (value) =>
            value
              .toLowerCase()
              .includes(normalizedSearch),
        );
      },
    );
  }, [
    assignedRecords,
    search,
    viewFilter,
  ]);

  const selectedVoucher = useMemo(
    () =>
      assignedRecords.find(
        (voucher) => voucher.id === selectedVoucherId,
      ) ?? null,
    [assignedRecords, selectedVoucherId],
  );

  const pagination = useListPagination(filteredRecords);

  useEffect(() => {
    if (!selectedVoucherId) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedVoucherId(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedVoucherId]);

  if (!sessionChecked || isLoading) {
    return (
      <main className={styles.statePage}>
        <h1>
          Loading Manager previews
        </h1>

        <p>
          Please wait while your assigned
          Payment Vouchers are loaded.
        </p>
      </main>
    );
  }

  if (!account) {
    return null;
  }

  if (account.role !== 'manager') {
    return (
      <main className={styles.statePage}>
        <h1>
          Manager access required
        </h1>

        <p>
          This page is only available to the
          assigned Manager.
        </p>

        <Link href="/beta/dashboard">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>
             Manager workspace
          </p>

          <h1>Payment Voucher previews</h1>

          <p>
            Review Payment Vouchers after
            Director approval and confirm that
            you have received the information.
          </p>

          {requiresPreviewRecords.length > 0 && (
            <Link
              className={styles.bulkActionButton}
              href="/beta/project-manager/payment-vouchers/bulk"
            >
              Bulk preview Payment Vouchers
            </Link>
          )}
        </div>

        <div className={styles.managerSummary}>
          <span>Signed in as</span>

          <strong>{account.name}</strong>

          <small>{account.position}</small>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article>
          <span>Requires preview</span>

          <strong>
            {requiresPreviewRecords.length}
          </strong>

          <small>
            Waiting for your confirmation
          </small>
        </article>

        <article>
          <span>Already viewed</span>

          <strong>
            {viewedRecords.length}
          </strong>

          <small>
            Information already received
          </small>
        </article>

        <article>
          <span>All assigned</span>

          <strong>
            {assignedRecords.length}
          </strong>

          <small>
            Director-approved vouchers
          </small>
        </article>
      </section>

      <section className={styles.queuePanel}>
        <div className={styles.queueHeader}>
          <div>
            <h2>
              Assigned Payment Vouchers
            </h2>

            <p>
              Open a voucher to check its full
              payment information.
            </p>
          </div>

          <label className={styles.searchField}>
            <span>Search</span>

            <input
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="PV number or recipient"
              type="search"
              value={search}
            />
          </label>
        </div>

        <div
          className={styles.filterTabs}
          role="group"
          aria-label="Preview filters"
        >
          <button
            data-active={
              viewFilter ===
              'REQUIRES_PREVIEW'
            }
            onClick={() =>
              setViewFilter(
                'REQUIRES_PREVIEW',
              )
            }
            type="button"
          >
            Requires preview
            <span>
              {
                requiresPreviewRecords.length
              }
            </span>
          </button>

          <button
            data-active={
              viewFilter === 'VIEWED'
            }
            onClick={() =>
              setViewFilter('VIEWED')
            }
            type="button"
          >
            Viewed
            <span>
              {viewedRecords.length}
            </span>
          </button>

          <button
            data-active={
              viewFilter === 'ALL'
            }
            onClick={() =>
              setViewFilter('ALL')
            }
            type="button"
          >
            All
            <span>
              {assignedRecords.length}
            </span>
          </button>
        </div>

        <div className={styles.queueDisplayBar}>
          <div className={styles.resultCount}>
            Showing {filteredRecords.length}{' '}
            {filteredRecords.length === 1
              ? 'Payment Voucher'
              : 'Payment Vouchers'}
          </div>

          <div
            aria-label="Choose Manager queue view"
            className={styles.viewToggle}
            role="group"
          >
            <span>View</span>

            <button
              aria-pressed={viewMode === 'grid'}
              data-active={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              type="button"
            >
              <span aria-hidden="true">▦</span>
              Grid
            </button>

            <button
              aria-pressed={viewMode === 'list'}
              data-active={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              type="button"
            >
              <span aria-hidden="true">☷</span>
              List
            </button>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>
              No Payment Vouchers found
            </h2>

            <p>
              There are no assigned Payment
              Vouchers matching the current
              filter.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles.previewGrid}>
            {pagination.pageRecords.map(
              (voucher) => (
                <ProjectManagerPreviewPanel
                  key={voucher.id}
                  manager={account}
                  onUpdated={refresh}
                  voucher={voucher}
                />
              ),
            )}
          </div>
        ) : (
          <div className={styles.previewTableWrapper}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th scope="col">PV number</th>
                  <th scope="col">Recipient</th>
                  <th scope="col">Division</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Preview</th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>Action</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {pagination.pageRecords.map((voucher) => (
                  <tr key={voucher.id}>
                    <td>
                      <Link
                        className={styles.tableVoucherLink}
                        href={`/beta/payment-vouchers/${voucher.id}`}
                      >
                        {voucher.voucherNumber}
                      </Link>
                    </td>

                    <td>
                      <strong>{voucher.recipientName}</strong>
                      <small>{voucher.recipientEmail}</small>
                    </td>

                    <td>{voucher.division}</td>

                    <td className={styles.tableAmount}>
                      {formatCurrency(voucher.amount)}
                    </td>

                    <td>
                      <PaymentVoucherStatusBadge status={voucher.status} />
                    </td>

                    <td>
                      <span
                        className={
                          voucher.projectManagerViewedAt
                            ? styles.viewedBadge
                            : styles.notViewedBadge
                        }
                      >
                        {voucher.projectManagerViewedAt
                          ? 'Viewed'
                          : 'Required'}
                      </span>
                    </td>

                    <td className={styles.tableActionCell}>
                      <button
                        className={styles.tableViewButton}
                        onClick={() => setSelectedVoucherId(voucher.id)}
                        type="button"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ListPagination
          currentPage={pagination.currentPage}
          firstRecord={pagination.firstRecord}
          lastRecord={pagination.lastRecord}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalRecords={pagination.totalRecords}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>

      {selectedVoucher && (
        <div
          aria-labelledby="manager-voucher-dialog-title"
          aria-modal="true"
          className={styles.previewModalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedVoucherId(null);
            }
          }}
          role="dialog"
        >
          <div className={styles.previewModal}>
            <header className={styles.previewModalHeader}>
              <div>
                <p className={styles.eyebrow}>Manager preview</p>
                <h2 id="manager-voucher-dialog-title">
                  {selectedVoucher.voucherNumber}
                </h2>
                <p>
                  Review the assigned voucher and confirm that you have
                  received its information.
                </p>
              </div>

              <button
                aria-label="Close Payment Voucher popup"
                className={styles.previewModalClose}
                onClick={() => setSelectedVoucherId(null)}
                type="button"
              >
                ×
              </button>
            </header>

            <div className={styles.previewModalBody}>
              <ProjectManagerPreviewPanel
                key={`${selectedVoucher.id}-${selectedVoucher.projectManagerViewedAt ?? 'pending'}`}
                manager={account}
                onUpdated={refresh}
                voucher={selectedVoucher}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

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
  betaAccounts,
  readBetaSession,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';

import {
  usePaymentVouchers,
} from '@/features/payment-voucher/hooks/use-payment-vouchers';

import {
  FinancePaymentPanel,
} from '@/features/payment-voucher/components/finance/finance-payment-panel';

import {
  PaymentVoucherStatusBadge,
} from '@/features/payment-voucher/components/payment-voucher-status-badge';

import { ListPagination } from '@/components/ui/list-pagination/list-pagination';
import { useListPagination } from '@/components/ui/list-pagination/use-list-pagination';

import styles from '@/features/payment-voucher/components/finance/finance-payment.module.css';

type FinanceQueueFilter =
  | 'ACTION_REQUIRED'
  | 'PROCESSING'
  | 'AWAITING_STAFF'
  | 'COMPLETED'
  | 'INACTIVE'
  | 'ALL';

type FinanceViewMode =
  | 'grid'
  | 'list';

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

function formatDate(value: string) {
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

function getAccountName(
  accountId: string,
) {
  return (
    betaAccounts.find(
      (candidate) =>
        candidate.id === accountId,
    )?.name ?? accountId
  );
}

const financeVisibleStatuses =
  new Set([
    'APPROVED_FOR_PAYMENT',
    'FINANCE_PROCESSING',
    'AWAITING_RECIPIENT_SIGNATURE',
    'AWAITING_STAFF_CONFIRMATION',
    'AWAITING_SIGNED_PV_UPLOAD',
    'PENDING_FINANCE_VERIFICATION',
    'COMPLETED',
    'INACTIVE',

    /*
     * Temporary legacy statuses.
     */
    'AWAITING_STAFF_VERIFICATION',
    'AWAITING_SIGNATURE',
  ]);

export default function FinancePage() {
  const router = useRouter();

  const [account, setAccount] =
    useState<BetaAccount | null>(null);

  const [
    sessionChecked,
    setSessionChecked,
  ] = useState(false);

  const [search, setSearch] =
    useState('');

  const [viewMode, setViewMode] =
    useState<FinanceViewMode>('list');

  const [transitionMessage, setTransitionMessage] =
    useState('');

  const [
    selectedVoucherId,
    setSelectedVoucherId,
  ] = useState<string | null>(null);

  const [
    activeFilter,
    setActiveFilter,
  ] = useState<FinanceQueueFilter>(
    'ACTION_REQUIRED',
  );

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

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);

    if (parameters.get('queue') !== 'processing') {
      return;
    }

    setActiveFilter('PROCESSING');

    const voucherId = parameters.get('voucher');
    const batchSize = Number(parameters.get('batch') ?? '0');

    if (voucherId) {
      setSelectedVoucherId(voucherId);
    }

    if (batchSize > 0) {
      setTransitionMessage(
        `${batchSize} ${batchSize === 1 ? 'voucher is' : 'vouchers are'} now in processing. The first processing detail is open; continue with each remaining voucher from this queue.`,
      );
    }

    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  function showProcessingDetail(voucherId: string) {
    setActiveFilter('PROCESSING');
    setSelectedVoucherId(voucherId);
    setTransitionMessage('Finance processing has started. Continue with this voucher below.');
  }

  const financeRecords = useMemo(
    () =>
      records
        .filter((voucher) =>
          financeVisibleStatuses.has(
            voucher.status,
          ),
        )
        .sort(
          (
            firstVoucher,
            secondVoucher,
          ) =>
            new Date(
              secondVoucher.updatedAt,
            ).getTime() -
            new Date(
              firstVoucher.updatedAt,
            ).getTime(),
        ),
    [records],
  );

  const actionRequiredRecords =
    useMemo(
      () =>
        financeRecords.filter(
          (voucher) =>
            voucher.status ===
              'APPROVED_FOR_PAYMENT' ||
            voucher.status ===
              'PENDING_FINANCE_VERIFICATION',
        ),
      [financeRecords],
    );

  const processingRecords = useMemo(
    () =>
      financeRecords.filter(
        (voucher) =>
          voucher.status ===
          'FINANCE_PROCESSING',
      ),
    [financeRecords],
  );

  const awaitingStaffRecords =
    useMemo(
      () =>
        financeRecords.filter(
          (voucher) =>
            voucher.status ===
              'AWAITING_RECIPIENT_SIGNATURE' ||
            voucher.status ===
              'AWAITING_STAFF_CONFIRMATION' ||
            voucher.status ===
              'AWAITING_SIGNED_PV_UPLOAD' ||
            voucher.status ===
              'AWAITING_STAFF_VERIFICATION' ||
            voucher.status ===
              'AWAITING_SIGNATURE',
        ),
      [financeRecords],
    );

  const completedRecords = useMemo(
    () =>
      financeRecords.filter(
        (voucher) =>
          voucher.status ===
          'COMPLETED',
      ),
    [financeRecords],
  );

  const inactiveRecords = useMemo(
    () =>
      financeRecords.filter(
        (voucher) =>
          voucher.status ===
          'INACTIVE',
      ),
    [financeRecords],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return financeRecords.filter(
      (voucher) => {
        if (
          activeFilter ===
            'ACTION_REQUIRED' &&
          voucher.status !==
            'APPROVED_FOR_PAYMENT' &&
          voucher.status !==
            'PENDING_FINANCE_VERIFICATION'
        ) {
          return false;
        }

        if (
          activeFilter ===
            'PROCESSING' &&
          voucher.status !==
            'FINANCE_PROCESSING'
        ) {
          return false;
        }

        if (
          activeFilter ===
            'AWAITING_STAFF' &&
          voucher.status !==
            'AWAITING_RECIPIENT_SIGNATURE' &&
          voucher.status !==
            'AWAITING_STAFF_CONFIRMATION' &&
          voucher.status !==
            'AWAITING_SIGNED_PV_UPLOAD' &&
          voucher.status !==
            'AWAITING_STAFF_VERIFICATION' &&
          voucher.status !==
            'AWAITING_SIGNATURE'
        ) {
          return false;
        }

        if (
          activeFilter ===
            'COMPLETED' &&
          voucher.status !== 'COMPLETED'
        ) {
          return false;
        }

        if (
          activeFilter ===
            'INACTIVE' &&
          voucher.status !== 'INACTIVE'
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
          voucher.paymentReference,
          voucher.purpose,
          voucher.division,
        ];

        return searchableValues.some(
          (value) =>
            value
              ?.toLowerCase()
              .includes(normalizedSearch),
        );
      },
    );
  }, [
    activeFilter,
    financeRecords,
    search,
  ]);

  const selectedVoucher = useMemo(
    () =>
      selectedVoucherId
        ? financeRecords.find(
          (voucher) =>
            voucher.id ===
            selectedVoucherId,
        ) ?? null
        : null,
    [financeRecords, selectedVoucherId],
  );

  const pagination = useListPagination(filteredRecords);

  useEffect(() => {
    if (!selectedVoucherId) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        setSelectedVoucherId(null);
      }
    }

    document.body.style.overflow =
      'hidden';

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
  }, [selectedVoucherId]);

  if (
    !sessionChecked ||
    isLoading
  ) {
    return (
      <main className={styles.statePage}>
        <h1>Loading Finance queue</h1>

        <p>
          Please wait while the Payment
          Vouchers are loaded.
        </p>
      </main>
    );
  }

  if (!account) {
    return null;
  }

  if (account.role !== 'finance') {
    return (
      <main className={styles.statePage}>
        <h1>Finance access required</h1>

        <p>
          This workspace is only available
          to Finance accounts.
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
            Finance workspace
          </p>

          <h1>Payment processing</h1>

          <p>
            Review Director-approved Payment
            Vouchers, process payments,
            generate PV documents and verify
            returned signed copies.
          </p>

          {actionRequiredRecords.some(
            (voucher) =>
              voucher.status ===
              'APPROVED_FOR_PAYMENT',
          ) && (
            <Link
              className={styles.bulkActionButton}
              href="/beta/finance/bulk"
            >
              Bulk process Payment Vouchers
            </Link>
          )}
        </div>

        <div
          className={styles.financeSummary}
        >
          <span>Signed in as</span>

          <strong>{account.name}</strong>

          <small>{account.position}</small>
        </div>
      </header>

      {transitionMessage && (
        <div className={styles.successMessage} role="status">
          {transitionMessage}
        </div>
      )}

      <section
        className={styles.queueSummaryGrid}
      >
        <article>
          <span>Finance actions</span>

          <strong>
            {actionRequiredRecords.length}
          </strong>

          <small>
            New payments or signed PVs
          </small>
        </article>

        <article>
          <span>Finance processing</span>

          <strong>
            {processingRecords.length}
          </strong>

          <small>
            Payment information editable
          </small>
        </article>

        <article>
          <span>
            Waiting for signed PV
          </span>

          <strong>
            {awaitingStaffRecords.length}
          </strong>

          <small>
            Staff obtaining recipient signature
          </small>
        </article>

        <article>
          <span>Completed</span>

          <strong>
            {completedRecords.length}
          </strong>

          <small>
            Verified and archived
          </small>
        </article>
      </section>

      <section
        className={styles.queueContainer}
      >
        <div className={styles.queueToolbar}>
          <div>
            <h2>
              Finance Payment Vouchers
            </h2>

            <p>
              Select a queue to view its
              Payment Voucher records.
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
              placeholder="PV number, recipient or reference"
              type="search"
              value={search}
            />
          </label>
        </div>

        <div
          aria-label="Finance queue filters"
          className={styles.filterTabs}
          role="group"
        >
          <button
            data-active={
              activeFilter ===
              'ACTION_REQUIRED'
            }
            onClick={() =>
              setActiveFilter(
                'ACTION_REQUIRED',
              )
            }
            type="button"
          >
            Finance action
            <span>
              {
                actionRequiredRecords.length
              }
            </span>
          </button>

          <button
            data-active={
              activeFilter ===
              'PROCESSING'
            }
            onClick={() =>
              setActiveFilter(
                'PROCESSING',
              )
            }
            type="button"
          >
            In processing
            <span>
              {processingRecords.length}
            </span>
          </button>

          <button
            data-active={
              activeFilter ===
              'AWAITING_STAFF'
            }
            onClick={() =>
              setActiveFilter(
                'AWAITING_STAFF',
              )
            }
            type="button"
          >
            Signature in progress
            <span>
              {
                awaitingStaffRecords.length
              }
            </span>
          </button>

          <button
            data-active={
              activeFilter ===
              'COMPLETED'
            }
            onClick={() =>
              setActiveFilter(
                'COMPLETED',
              )
            }
            type="button"
          >
            Completed
            <span>
              {completedRecords.length}
            </span>
          </button>

          <button
            data-active={
              activeFilter ===
              'INACTIVE'
            }
            onClick={() =>
              setActiveFilter(
                'INACTIVE',
              )
            }
            type="button"
          >
            Inactive
            <span>
              {inactiveRecords.length}
            </span>
          </button>

          <button
            data-active={
              activeFilter === 'ALL'
            }
            onClick={() =>
              setActiveFilter('ALL')
            }
            type="button"
          >
            All
            <span>
              {financeRecords.length}
            </span>
          </button>
        </div>

        <div
          className={styles.queueDisplayBar}
        >
          <div className={styles.resultCount}>
            Showing {filteredRecords.length}{' '}
            {filteredRecords.length === 1
              ? 'Payment Voucher'
              : 'Payment Vouchers'}
          </div>

          <div
            aria-label="Choose Finance queue view"
            className={styles.viewToggle}
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

        {filteredRecords.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>
              No Payment Vouchers found
            </h2>

            <p>
              There are no Finance records
              matching the selected filter
              and search.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles.financeGrid}>
            {pagination.pageRecords.map(
              (voucher) => (
                <article className={styles.financeCard} key={voucher.id}>
                  <div className={styles.financeCardTop}>
                    <strong>{voucher.voucherNumber}</strong>
                    <PaymentVoucherStatusBadge status={voucher.status} />
                  </div>
                  <h3>{voucher.recipientName}</h3>
                  <p>{voucher.purpose}</p>
                  <dl className={styles.financeCardDetails}>
                    <div><dt>Submitted by</dt><dd>{getAccountName(voucher.submitterId)}</dd></div>
                    <div><dt>Amount</dt><dd>{formatCurrency(voucher.amount)}</dd></div>
                    <div><dt>Division</dt><dd>{voucher.division}</dd></div>
                    <div><dt>Payment reference</dt><dd>{voucher.paymentReference || 'Not recorded'}</dd></div>
                  </dl>
                  <div className={styles.financeCardFooter}>
                    <button onClick={() => setSelectedVoucherId(voucher.id)} type="button">View details</button>
                  </div>
                </article>
              ),
            )}
          </div>
        ) : (
          <div
            className={
              styles.financeTableWrapper
            }
          >
            <table
              className={styles.financeTable}
            >
              <thead>
                <tr>
                  <th scope="col">PV number</th>
                  <th scope="col">Staff</th>
                  <th scope="col">Recipient</th>
                  <th scope="col">Division</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span
                      className={
                        styles.visuallyHidden
                      }
                    >
                      Action
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {pagination.pageRecords.map(
                  (voucher) => (
                    <tr key={voucher.id}>
                      <td>
                        <Link
                          className={
                            styles.tableVoucherLink
                          }
                          href={`/beta/payment-vouchers/${voucher.id}`}
                        >
                          {
                            voucher.voucherNumber
                          }
                        </Link>
                      </td>

                      <td>
                        {getAccountName(
                          voucher.submitterId,
                        )}
                      </td>

                      <td>
                        <strong>
                          {
                            voucher.recipientName
                          }
                        </strong>

                        <small>
                          {
                            voucher.recipientEmail
                          }
                        </small>
                      </td>

                      <td>
                        {voucher.division}
                      </td>

                      <td
                        className={
                          styles.tableAmount
                        }
                      >
                        {formatCurrency(
                          voucher.amount,
                        )}
                      </td>

                      <td>
                        <PaymentVoucherStatusBadge
                          status={
                            voucher.status
                          }
                        />
                      </td>

                      <td
                        className={
                          styles.tableActionCell
                        }
                      >
                        <button
                          className={
                            styles.tableViewButton
                          }
                          onClick={() =>
                            setSelectedVoucherId(
                              voucher.id,
                            )
                          }
                          type="button"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ),
                )}
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
          aria-labelledby="finance-voucher-dialog-title"
          aria-modal="true"
          className={styles.financeModalBackdrop}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedVoucherId(null);
            }
          }}
          role="dialog"
        >
          <div
            className={styles.financeModal}
          >
            <header
              className={
                styles.financeModalHeader
              }
            >
              <div>
                <p
                  className={
                    styles.eyebrow
                  }
                >
                  Finance Payment Voucher
                </p>

                <h2
                  id="finance-voucher-dialog-title"
                >
                  {
                    selectedVoucher.voucherNumber
                  }
                </h2>

                <p>
                  Review the voucher and complete
                  the currently available Finance
                  action.
                </p>
              </div>

              <button
                aria-label="Close Payment Voucher popup"
                className={
                  styles.financeModalClose
                }
                onClick={() =>
                  setSelectedVoucherId(null)
                }
                type="button"
              >
                ×
              </button>
            </header>

            <div
              className={
                styles.financeModalBody
              }
            >
              <FinancePaymentPanel
                finance={account}
                key={`${selectedVoucher.id}-${selectedVoucher.status}-${selectedVoucher.updatedAt}`}
                onUpdated={refresh}
                onProcessingStarted={showProcessingDetail}
                voucher={selectedVoucher}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

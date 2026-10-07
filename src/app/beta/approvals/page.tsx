'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  readBetaSession,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';

import { usePaymentVouchers } from '@/features/payment-voucher/hooks/use-payment-vouchers';

import { PaymentVoucherDetail } from '@/features/payment-voucher/components/payment-voucher-detail';

import { PaginatedPaymentVoucherRecordList } from '@/features/payment-voucher/components/paginated-payment-voucher-record-list';

import styles from '@/features/payment-voucher/components/payment-voucher.module.css';

type DirectorWorkspaceTab =
  | 'PENDING'
  | 'HISTORY';

type ApprovalHistoryFilter =
  | 'ALL'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';

type ApprovalViewMode =
  | 'grid'
  | 'list';

const approvedStatuses = new Set([
  'APPROVED_FOR_PAYMENT',
  'FINANCE_PROCESSING',
  'AWAITING_RECIPIENT_SIGNATURE',
  'AWAITING_STAFF_CONFIRMATION',
  'PENDING_FINANCE_VERIFICATION',
  'COMPLETED',
  'INACTIVE',

  /* Temporary legacy statuses. */
  'AWAITING_SIGNED_PV_UPLOAD',
  'AWAITING_STAFF_VERIFICATION',
  'AWAITING_SIGNATURE',
]);

function getAccountPermissions(
  account: BetaAccount,
) {
  const compatibleAccount =
    account as BetaAccount & {
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

function isDirectorAccount(
  account: BetaAccount,
) {
  return getAccountPermissions(account).some(
    (permission) =>
      permission.includes('director'),
  );
}

export default function ApprovalsPage() {
  const router = useRouter();

  const {
    records,
    isLoading,
  } = usePaymentVouchers();

  const [account] = useState<BetaAccount | null>(
    () => readBetaSession(),
  );

  const [activeTab, setActiveTab] =
    useState<DirectorWorkspaceTab>(
      'PENDING',
    );

  const [historyFilter, setHistoryFilter] =
    useState<ApprovalHistoryFilter>('ALL');

  const [viewMode, setViewMode] =
    useState<ApprovalViewMode>('list');

  const [search, setSearch] =
    useState('');

  const [
    selectedVoucherId,
    setSelectedVoucherId,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      router.replace('/beta');
    }
  }, [account, router]);

  const assignedRecords = useMemo(() => {
    if (!account) {
      return [];
    }

    return records.filter(
      (voucher) =>
        voucher.directorId === account.id,
    );
  }, [records, account]);

  const pendingRecords = useMemo(
    () =>
      assignedRecords.filter(
        (voucher) =>
          voucher.status ===
          'PENDING_DIRECTOR_APPROVAL',
      ),
    [assignedRecords],
  );

  /*
   * Until the immutable approval-event store is
   * added, this page derives history from the
   * current voucher record. The future store will
   * also retain older rejection/resubmission events.
   */
  const historyRecords = useMemo(
    () =>
      assignedRecords.filter(
        (voucher) =>
          voucher.status === 'REJECTED' ||
          Boolean(
            voucher.directorApprovedAt,
          ) ||
          approvedStatuses.has(
            voucher.status,
          ),
      ),
    [assignedRecords],
  );

  const approvedRecords = useMemo(
    () =>
      historyRecords.filter(
        (voucher) =>
          voucher.status !== 'REJECTED',
      ),
    [historyRecords],
  );

  const rejectedRecords = useMemo(
    () =>
      historyRecords.filter(
        (voucher) =>
          voucher.status === 'REJECTED',
      ),
    [historyRecords],
  );

  const completedRecords = useMemo(
    () =>
      historyRecords.filter(
        (voucher) =>
          voucher.status === 'COMPLETED',
      ),
    [historyRecords],
  );

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    const sourceRecords =
      activeTab === 'PENDING'
        ? pendingRecords
        : historyRecords;

    return sourceRecords
      .filter((voucher) => {
        if (
          activeTab === 'HISTORY' &&
          historyFilter === 'APPROVED' &&
          voucher.status === 'REJECTED'
        ) {
          return false;
        }

        if (
          activeTab === 'HISTORY' &&
          historyFilter === 'REJECTED' &&
          voucher.status !== 'REJECTED'
        ) {
          return false;
        }

        if (
          activeTab === 'HISTORY' &&
          historyFilter === 'COMPLETED' &&
          voucher.status !== 'COMPLETED'
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
      })
      .sort(
        (firstVoucher, secondVoucher) =>
          new Date(
            secondVoucher.updatedAt,
          ).getTime() -
          new Date(
            firstVoucher.updatedAt,
          ).getTime(),
      );
  }, [
    activeTab,
    historyFilter,
    historyRecords,
    pendingRecords,
    search,
  ]);

  const selectedVoucher = useMemo(
    () =>
      selectedVoucherId
        ? assignedRecords.find(
          (voucher) =>
            voucher.id ===
            selectedVoucherId,
        ) ?? null
        : null,
    [assignedRecords, selectedVoucherId],
  );

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

  function selectTab(
    tab: DirectorWorkspaceTab,
  ) {
    setActiveTab(tab);
    setSearch('');

    if (tab === 'PENDING') {
      setHistoryFilter('ALL');
    }
  }

  if (isLoading) {
    return (
      <section
        className={styles.approvalQueueState}
      >
        <h1>Loading approvals</h1>

        <p>
          Please wait while your assigned Payment
          Vouchers are loaded.
        </p>
      </section>
    );
  }

  if (!account) {
    return null;
  }

  if (!isDirectorAccount(account)) {
    return (
      <section
        className={styles.approvalAccessDenied}
      >
        <span aria-hidden="true">!</span>
        <h1>Director access required</h1>

        <p>
          This approval workspace is only available
          to Director accounts.
        </p>
      </section>
    );
  }

  return (
    <div className={styles.approvalQueuePage}>
      <header
        className={styles.approvalQueueHeader}
      >
        <div>
          <p
            className={
              styles.approvalQueueEyebrow
            }
          >
            Director workspace
          </p>

          <h1>Payment Voucher Approvals</h1>

          <p
            className={
              styles.approvalQueueDescription
            }
          >
            Review pending Payment Vouchers and
            track your previous decisions.
          </p>

          {pendingRecords.length > 0 && (
            <Link
              className={
                styles.bulkApprovalButton
              }
              href="/beta/approvals/bulk"
            >
              Bulk approve Payment Vouchers
            </Link>
          )}
        </div>

        <div
          className={
            styles.approvalDirectorSummary
          }
        >
          <span>Signed in as</span>
          <strong>{account.name}</strong>
          <small>{account.position}</small>
        </div>
      </header>

      <section
        className={styles.approvalQueueSummary}
      >
        <article>
          <span>Pending my approval</span>
          <strong>{pendingRecords.length}</strong>
          <small>Require your decision</small>
        </article>

        <article>
          <span>Previously approved</span>
          <strong>{approvedRecords.length}</strong>
          <small>Sent forward in the workflow</small>
        </article>

        <article>
          <span>Rejected</span>
          <strong>{rejectedRecords.length}</strong>
          <small>Returned for amendment</small>
        </article>

        <article>
          <span>Completed</span>
          <strong>{completedRecords.length}</strong>
          <small>Workflow completed</small>
        </article>
      </section>

      <section
        className={styles.approvalQueuePanel}
      >
        <div
          aria-label="Director approval workspace"
          className={styles.approvalWorkspaceTabs}
          role="tablist"
        >
          <button
            aria-selected={
              activeTab === 'PENDING'
            }
            data-active={
              activeTab === 'PENDING'
            }
            onClick={() =>
              selectTab('PENDING')
            }
            role="tab"
            type="button"
          >
            Pending approvals
            <span>{pendingRecords.length}</span>
          </button>

          <button
            aria-selected={
              activeTab === 'HISTORY'
            }
            data-active={
              activeTab === 'HISTORY'
            }
            onClick={() =>
              selectTab('HISTORY')
            }
            role="tab"
            type="button"
          >
            Approval history
            <span>{historyRecords.length}</span>
          </button>
        </div>

        <div
          className={styles.approvalQueueTools}
        >
          <div>
            <h2>
              {activeTab === 'PENDING'
                ? 'Pending approvals'
                : 'Approval history'}
            </h2>

            <p>
              {activeTab === 'PENDING'
                ? 'Open a voucher to review its complete information and make your decision.'
                : 'Review Payment Vouchers that you previously approved or rejected.'}
            </p>
          </div>

          <label
            className={styles.approvalSearch}
          >
            <span className="sr-only">
              Search Payment Vouchers
            </span>

            <input
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search PV number or recipient"
              type="search"
              value={search}
            />
          </label>
        </div>

        {activeTab === 'HISTORY' && (
          <div
            aria-label="Approval history filters"
            className={
              styles.approvalFilterTabs
            }
            role="group"
          >
            {(
              [
                ['ALL', 'All decisions', historyRecords.length],
                ['APPROVED', 'Approved', approvedRecords.length],
                ['REJECTED', 'Rejected', rejectedRecords.length],
                ['COMPLETED', 'Completed', completedRecords.length],
              ] as const
            ).map(
              ([value, label, count]) => (
                <button
                  data-active={
                    historyFilter === value
                  }
                  key={value}
                  onClick={() =>
                    setHistoryFilter(value)
                  }
                  type="button"
                >
                  {label}
                  <span>{count}</span>
                </button>
              ),
            )}
          </div>
        )}

        <div
          className={
            styles.approvalQueueResults
          }
        >
          <div
            className={
              styles.approvalResultsToolbar
            }
          >
            <span>
              {filteredRecords.length}{' '}
              {filteredRecords.length === 1
                ? 'record'
                : 'records'}
            </span>

            <div
              aria-label="Choose approval view"
              className={
                styles.approvalViewToggle
              }
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
                <span aria-hidden="true">▦</span>
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
                <span aria-hidden="true">☷</span>
                List
              </button>
            </div>
          </div>

          <PaginatedPaymentVoucherRecordList
            emptyDescription={
              activeTab === 'PENDING'
                ? 'New vouchers assigned to you will appear here.'
                : 'No previous decisions match the selected filter or search.'
            }
            emptyTitle={
              activeTab === 'PENDING'
                ? 'No Payment Vouchers require your approval'
                : 'No approval history found'
            }
            onViewDetails={(voucher) =>
              setSelectedVoucherId(
                voucher.id,
              )
            }
            viewActionLabel={
              activeTab === 'PENDING'
                ? 'Review'
                : 'View details'
            }
            viewMode={viewMode}
            vouchers={filteredRecords}
          />
        </div>
      </section>

      {selectedVoucher && (
        <div
          aria-labelledby="director-review-dialog-title"
          aria-modal="true"
          className={
            styles.directorReviewModalBackdrop
          }
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
            className={
              styles.directorReviewModal
            }
          >
            <header
              className={
                styles.directorReviewModalHeader
              }
            >
              <div>
                <p
                  className={
                    styles.approvalQueueEyebrow
                  }
                >
                  {selectedVoucher.status ===
                  'PENDING_DIRECTOR_APPROVAL'
                    ? 'Director decision required'
                    : 'Approval history'}
                </p>

                <h2
                  id="director-review-dialog-title"
                >
                  {selectedVoucher.voucherNumber}
                </h2>
              </div>

              <button
                aria-label="Close Payment Voucher review"
                className={
                  styles.directorReviewModalClose
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
                styles.directorReviewModalBody
              }
            >
              <PaymentVoucherDetail
                key={`${selectedVoucher.id}-${selectedVoucher.status}-${selectedVoucher.updatedAt}`}
                voucherId={selectedVoucher.id}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

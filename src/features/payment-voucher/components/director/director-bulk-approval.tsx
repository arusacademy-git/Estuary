'use client';

import {
    useEffect,
    useMemo,
    useState,
} from 'react';

import Link from 'next/link';

import {
    betaAccounts,
    type BetaAccount,
} from '@/lib/auth/beta-accounts';

import type {
    PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import type {
    CreateNotificationInput,
} from '@/domain/notifications/types';

import {
    approvePaymentVoucher,
} from '@/data/payment-vouchers/payment-voucher-api';

import {
    useUserSignature,
} from '@/features/signatures/hooks/use-user-signature';

import {
    createLocalNotification,
} from '@/data/notifications/local-notification-store';

import {
    BulkVoucherReviewModal,
} from './bulk-voucher-review-modal';

import styles from './director-bulk-approval.module.css';

type DirectorBulkApprovalProps = {
    director: BetaAccount;
    vouchers: PaymentVoucherRecord[];
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

function createNotificationSafely(
    input: CreateNotificationInput,
) {
    try {
        createLocalNotification(input);
    } catch (error) {
        console.error(
            'The bulk approval succeeded, but a notification could not be created.',
            error,
        );
    }
}

export function DirectorBulkApproval({
    director,
    vouchers,
}: DirectorBulkApprovalProps) {
    const {
        signature: activeSignature,
        isLoading: isSignatureLoading,
    } = useUserSignature(director.id);

    const [
        selectedVoucherIds,
        setSelectedVoucherIds,
    ] = useState<string[]>([]);

    const [
        reviewedVoucherIds,
        setReviewedVoucherIds,
    ] = useState<string[]>([]);

    const [
        approvedVoucherIds,
        setApprovedVoucherIds,
    ] = useState<string[]>([]);

    const [
        reviewVoucherId,
        setReviewVoucherId,
    ] = useState<string | null>(null);

    const [
        hasConfirmed,
        setHasConfirmed,
    ] = useState(false);

    const [
        isSubmitting,
        setIsSubmitting,
    ] = useState(false);

    const [
        errorMessage,
        setErrorMessage,
    ] = useState('');

    const [
        successMessage,
        setSuccessMessage,
    ] = useState('');

    const pendingVouchers = useMemo(
        () =>
            vouchers.filter(
                (voucher) =>
                    voucher.directorId ===
                    director.id &&
                    voucher.status ===
                    'PENDING_DIRECTOR_APPROVAL' &&
                    !approvedVoucherIds.includes(
                        voucher.id,
                    ),
            ),
        [
            approvedVoucherIds,
            director.id,
            vouchers,
        ],
    );

    const selectedVouchers = useMemo(
        () =>
            pendingVouchers.filter(
                (voucher) =>
                    selectedVoucherIds.includes(
                        voucher.id,
                    ),
            ),
        [
            pendingVouchers,
            selectedVoucherIds,
        ],
    );

    const selectedTotal =
        selectedVouchers.reduce(
            (total, voucher) =>
                total + voucher.amount,
            0,
        );

    const allSelected =
        pendingVouchers.length > 0 &&
        selectedVoucherIds.length ===
        pendingVouchers.length;

    const allSelectedVouchersReviewed =
        selectedVoucherIds.length > 0 &&
        selectedVoucherIds.every(
            (voucherId) =>
                reviewedVoucherIds.includes(
                    voucherId,
                ),
        );

    useEffect(() => {
        const pendingIds = new Set(
            pendingVouchers.map(
                (voucher) => voucher.id,
            ),
        );

        setSelectedVoucherIds(
            (currentIds) =>
                currentIds.filter(
                    (voucherId) =>
                        pendingIds.has(voucherId),
                ),
        );

        setReviewedVoucherIds(
            (currentIds) =>
                currentIds.filter(
                    (voucherId) =>
                        pendingIds.has(voucherId),
                ),
        );

        setReviewVoucherId(
            (currentVoucherId) => {
                if (
                    currentVoucherId &&
                    !pendingIds.has(
                        currentVoucherId,
                    )
                ) {
                    return null;
                }

                return currentVoucherId;
            },
        );
    }, [pendingVouchers]);

    function toggleVoucher(
        voucherId: string,
    ) {
        setSelectedVoucherIds(
            (currentIds) => {
                if (
                    currentIds.includes(voucherId)
                ) {
                    return currentIds.filter(
                        (currentId) =>
                            currentId !== voucherId,
                    );
                }

                return [
                    ...currentIds,
                    voucherId,
                ];
            },
        );

        setHasConfirmed(false);
        setErrorMessage('');
        setSuccessMessage('');
    }

    function toggleAll() {
        if (allSelected) {
            setSelectedVoucherIds([]);
        } else {
            setSelectedVoucherIds(
                pendingVouchers.map(
                    (voucher) => voucher.id,
                ),
            );
        }

        setHasConfirmed(false);
        setErrorMessage('');
        setSuccessMessage('');
    }

    function handleMarkReviewed(
        voucherId: string,
    ) {
        setReviewedVoucherIds(
            (currentIds) => {
                if (
                    currentIds.includes(voucherId)
                ) {
                    return currentIds;
                }

                return [
                    ...currentIds,
                    voucherId,
                ];
            },
        );

        setErrorMessage('');
    }

    async function handleBulkApproval() {
        setErrorMessage('');
        setSuccessMessage('');

        if (
            selectedVoucherIds.length === 0
        ) {
            setErrorMessage(
                'Select at least one Payment Voucher.',
            );

            return;
        }

        if (!allSelectedVouchersReviewed) {
            setErrorMessage(
                'Review every selected Payment Voucher before approving.',
            );

            return;
        }

        if (!activeSignature) {
            setErrorMessage(
                'Upload your Director signature before using bulk approval.',
            );

            return;
        }

        if (!hasConfirmed) {
            setErrorMessage(
                'Confirm that you approve the selected Payment Vouchers.',
            );

            return;
        }

        setIsSubmitting(true);

        try {
            const approvedVouchers =
                await Promise.all(
                    selectedVoucherIds.map(
                        (voucherId) =>
                            approvePaymentVoucher(
                                voucherId,
                                director.id,
                                activeSignature.id,
                            ),
                    ),
                );

            approvedVouchers.forEach(
                (approvedVoucher) => {
                    /*
                     * 1. Notify the Staff submitter.
                     */
                    createNotificationSafely({
                        recipientId:
                            approvedVoucher.submitterId,

                        actorId:
                            director.id,

                        type:
                            'PAYMENT_VOUCHER_APPROVED',

                        entityType:
                            'PAYMENT_VOUCHER',

                        entityId:
                            approvedVoucher.id,

                        referenceNumber:
                            approvedVoucher.voucherNumber,

                        title:
                            'Payment Voucher approved',

                        message:
                            `${approvedVoucher.voucherNumber} was approved by ${director.name} and is ready for Finance.`,

                        href:
                            `/beta/payment-vouchers/${approvedVoucher.id}`,
                    });

                    /*
                     * 2. Notify the assigned
                     * Project Manager.
                     */
                    if (
                        approvedVoucher.projectManagerId
                    ) {
                        createNotificationSafely({
                            recipientId:
                                approvedVoucher.projectManagerId,

                            actorId:
                                director.id,

                            type:
                                'PAYMENT_VOUCHER_APPROVED',

                            entityType:
                                'PAYMENT_VOUCHER',

                            entityId:
                                approvedVoucher.id,

                            referenceNumber:
                                approvedVoucher.voucherNumber,

                            title:
                                'Payment Voucher ready for preview',

                            message:
                                `${approvedVoucher.voucherNumber} was approved by ${director.name}. Please preview the Payment Voucher information.`,

                            href:
                                '/beta/project-manager/payment-vouchers',
                        });
                    }

                    /*
                     * 3. Notify every Finance account.
                     */
                    betaAccounts
                        .filter(
                            (candidate) =>
                                candidate.role ===
                                'finance',
                        )
                        .forEach(
                            (financeAccount) => {
                                createNotificationSafely({
                                    recipientId:
                                        financeAccount.id,

                                    actorId:
                                        director.id,

                                    type:
                                        'PAYMENT_VOUCHER_APPROVED',

                                    entityType:
                                        'PAYMENT_VOUCHER',

                                    entityId:
                                        approvedVoucher.id,

                                    referenceNumber:
                                        approvedVoucher.voucherNumber,

                                    title:
                                        'Payment Voucher ready for Finance',

                                    message:
                                        `${approvedVoucher.voucherNumber} was approved by ${director.name} and is ready for payment processing.`,

                                    href:
                                        `/beta/payment-vouchers/${approvedVoucher.id}`,
                                });
                            },
                        );
                },
            );

            const approvedCount =
                approvedVouchers.length;

            setApprovedVoucherIds(
                (currentIds) => [
                    ...currentIds,
                    ...approvedVouchers.map(
                        (voucher) => voucher.id,
                    ),
                ],
            );

            setSelectedVoucherIds([]);
            setReviewedVoucherIds([]);
            setReviewVoucherId(null);
            setHasConfirmed(false);

            setSuccessMessage(
                `${approvedCount} Payment ${approvedCount === 1
                    ? 'Voucher was'
                    : 'Vouchers were'
                } approved successfully.`,
            );
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to approve the selected Payment Vouchers.',
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <section className={styles.page}>
            <header className={styles.pageHeader}>
                <div>
                    <p className={styles.eyebrow}>
                        Director workspace
                    </p>

                    <h1>
                        Bulk Payment Voucher approval
                    </h1>

                    <p>
                        Select your assigned Payment
                        Vouchers, review their details and
                        approve them using your saved
                        signature.
                    </p>
                </div>

                <Link
                    className={styles.backButton}
                    href="/beta/approvals"
                >
                    Back to approvals
                </Link>
            </header>

            {!isSignatureLoading &&
                !activeSignature && (
                <div
                    className={
                        styles.signatureWarning
                    }
                >
                    <div>
                        <strong>
                            Director signature required
                        </strong>

                        <p>
                            Upload your signature before
                            approving Payment Vouchers.
                        </p>
                    </div>

                    <Link href="/beta/settings/signature">
                        Set up signature
                    </Link>
                </div>
            )}

            {errorMessage && (
                <div
                    className={styles.errorMessage}
                    role="alert"
                >
                    {errorMessage}
                </div>
            )}

            {successMessage && (
                <div
                    className={styles.successMessage}
                    role="status"
                >
                    {successMessage}
                </div>
            )}

            <div className={styles.summaryGrid}>
                <article
                    className={styles.summaryCard}
                >
                    <span>Pending approval</span>

                    <strong>
                        {pendingVouchers.length}
                    </strong>

                    <p>
                        Payment Vouchers assigned to you.
                    </p>
                </article>

                <article
                    className={styles.summaryCard}
                >
                    <span>Selected</span>

                    <strong>
                        {selectedVoucherIds.length}
                    </strong>

                    <p>
                        Payment Vouchers selected for
                        approval.
                    </p>
                </article>

                <article
                    className={styles.summaryCard}
                >
                    <span>Reviewed</span>

                    <strong>
                        {
                            selectedVoucherIds.filter(
                                (voucherId) =>
                                    reviewedVoucherIds.includes(
                                        voucherId,
                                    ),
                            ).length
                        }
                    </strong>

                    <p>
                        Selected vouchers already reviewed.
                    </p>
                </article>

                <article
                    className={styles.summaryCard}
                >
                    <span>Selected total</span>

                    <strong>
                        {formatCurrency(selectedTotal)}
                    </strong>

                    <p>
                        Combined value of selected vouchers.
                    </p>
                </article>
            </div>

            <div className={styles.approvalPanel}>
                <div className={styles.toolbar}>
                    <label className={styles.selectAll}>
                        <input
                            checked={allSelected}
                            disabled={
                                pendingVouchers.length === 0
                            }
                            onChange={toggleAll}
                            type="checkbox"
                        />

                        <span>
                            Select all pending vouchers
                        </span>
                    </label>

                    <span
                        className={styles.recordCount}
                    >
                        {pendingVouchers.length}{' '}
                        {pendingVouchers.length === 1
                            ? 'record'
                            : 'records'}
                    </span>
                </div>

                {pendingVouchers.length === 0 ? (
                    <div className={styles.emptyState}>
                        <h2>
                            No pending Payment Vouchers
                        </h2>

                        <p>
                            There are currently no Payment
                            Vouchers waiting for your
                            approval.
                        </p>
                    </div>
                ) : (
                    <div className={`${styles.selectionTableWrapper} ${styles.voucherTableWrapper}`}>
                        <table className={`${styles.selectionTable} ${styles.voucherFitTable}`}>
                            <thead>
                                <tr><th aria-label="Select" /><th>Payment Voucher</th><th>Recipient</th><th>Submitter</th><th>PV date</th><th>Division</th><th>Amount</th><th>Review</th><th aria-label="Actions" /></tr>
                            </thead>
                            <tbody>
                                {pendingVouchers.map((voucher) => {
                                    const isSelected = selectedVoucherIds.includes(voucher.id);
                                    const isReviewed = reviewedVoucherIds.includes(voucher.id);
                                    return (
                                        <tr data-selected={isSelected} key={voucher.id}>
                                            <td className={styles.checkCell}><input aria-label={`Select ${voucher.voucherNumber}`} checked={isSelected} onChange={() => toggleVoucher(voucher.id)} type="checkbox" /></td>
                                            <td><strong className={styles.voucherNumber}>{voucher.voucherNumber}</strong></td>
                                            <td>{voucher.recipientName}</td>
                                            <td>{getAccountName(voucher.submitterId)}</td>
                                            <td>{formatDate(voucher.pvDate)}</td>
                                            <td>{voucher.division}</td>
                                            <td className={styles.amountCell}>{formatCurrency(voucher.amount)}</td>
                                            <td>{isReviewed ? <span className={styles.reviewedBadge}>Reviewed</span> : <span className={styles.notReviewedBadge}>Not reviewed</span>}</td>
                                            <td className={styles.actionCell}><button className={styles.reviewButton} onClick={() => setReviewVoucherId(voucher.id)} type="button">View details</button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedVoucherIds.length > 0 && (
                <section
                    className={
                        styles.confirmationPanel
                    }
                >
                    <div>
                        <p className={styles.eyebrow}>
                            Approval confirmation
                        </p>

                        <h2>
                            Approve{' '}
                            {selectedVoucherIds.length}{' '}
                            selected{' '}
                            {selectedVoucherIds.length === 1
                                ? 'voucher'
                                : 'vouchers'}
                        </h2>

                        <p>
                            Every selected voucher must be
                            reviewed. Your saved signature
                            and approval date will be applied
                            to each approved voucher.
                        </p>
                    </div>

                    {!allSelectedVouchersReviewed && (
                        <div
                            className={
                                styles.reviewRequiredMessage
                            }
                        >
                            Review all selected Payment
                            Vouchers before approving them.
                        </div>
                    )}

                    <label
                        className={
                            styles.confirmationCheck
                        }
                    >
                        <input
                            checked={hasConfirmed}
                            disabled={
                                !allSelectedVouchersReviewed
                            }
                            onChange={(event) =>
                                setHasConfirmed(
                                    event.target.checked,
                                )
                            }
                            type="checkbox"
                        />

                        <span>
                            I confirm that I reviewed the
                            selected Payment Vouchers and
                            approve them for Finance
                            processing.
                        </span>
                    </label>

                    <button
                        className={
                            styles.approveButton
                        }
                        disabled={
                            !activeSignature ||
                            !hasConfirmed ||
                            !allSelectedVouchersReviewed ||
                            isSubmitting
                        }
                        onClick={handleBulkApproval}
                        type="button"
                    >
                        {isSubmitting
                            ? 'Approving…'
                            : `Approve ${selectedVoucherIds.length} selected`}
                    </button>

                    <p
                        className={
                            styles.rejectionNotice
                        }
                    >
                        Rejections must be completed
                        individually because a rejection
                        remark is required for each
                        Payment Voucher.
                    </p>
                </section>
            )}

            {reviewVoucherId && (
                <BulkVoucherReviewModal
                    currentVoucherId={
                        reviewVoucherId
                    }
                    onChangeVoucher={
                        setReviewVoucherId
                    }
                    onClose={() =>
                        setReviewVoucherId(null)
                    }
                    onMarkReviewed={
                        handleMarkReviewed
                    }
                    reviewedVoucherIds={
                        reviewedVoucherIds
                    }
                    vouchers={pendingVouchers}
                />
            )}
        </section>
    );
}

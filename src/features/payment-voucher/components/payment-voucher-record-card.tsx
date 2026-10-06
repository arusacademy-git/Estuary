import Link from 'next/link';

import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';
import { betaAccounts } from '@/lib/auth/beta-accounts';
import { PaymentVoucherStatusBadge } from './payment-voucher-status-badge';

import styles from './payment-voucher.module.css';

type PaymentVoucherRecordCardProps = {
    voucher: PaymentVoucherRecord;
    onViewDetails?: (
        voucher: PaymentVoucherRecord,
    ) => void;
    viewActionLabel?: string;
};

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-MY', {
        style: 'currency',
        currency: 'MYR',
    }).format(amount);
}

function formatDate(value?: string | null) {
    if (!value) {
        return 'Not available';
    }

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
        (item) => item.id === accountId,
    );

    return account?.name ?? accountId;
}

function getNextAction(status: string) {
    const actions: Record<string, string> = {
        DRAFT:
            'Complete and submit this voucher.',

        PENDING_DIRECTOR_APPROVAL:
            'Waiting for Director approval.',

        REJECTED:
            'Amend the voucher using the Director’s remarks.',

        APPROVED_FOR_PAYMENT:
            'Approved and ready for Finance.',

        FINANCE_PROCESSING:
            'Finance is processing the payment.',

        AWAITING_STAFF_VERIFICATION:
            'Review and verify the uploaded receipt.',

        AWAITING_SIGNATURE:
            'Waiting for recipient confirmation.',

        COMPLETED:
            'The payment workflow is complete.',
    };

    return (
        actions[status] ??
        'Open the voucher to view its progress.'
    );
}

export function PaymentVoucherRecordCard({
    voucher,
    onViewDetails,
    viewActionLabel = 'View details',
}: PaymentVoucherRecordCardProps) {
    const directorName = getAccountName(
        voucher.directorId,
    );

    return (
        <article className={styles.recordCard}>
            <div className={styles.recordCardHeader}>
                <div>
                    <p className={styles.recordCardReference}>
                        {voucher.voucherNumber}
                    </p>

                    <h2 className={styles.recordCardTitle}>
                        {voucher.recipientName}
                    </h2>
                </div>

                <PaymentVoucherStatusBadge
                    status={voucher.status}
                />
            </div>

            <p className={styles.recordCardPurpose}>
                {voucher.purpose}
            </p>

            <div className={styles.recordCardAmount}>
                {formatCurrency(voucher.amount)}
            </div>

            <dl className={styles.recordCardInformation}>
                <div>
                    <dt>PV date</dt>
                    <dd>{formatDate(voucher.pvDate)}</dd>
                </div>

                <div>
                    <dt>Division</dt>
                    <dd>{voucher.division}</dd>
                </div>

                <div>
                    <dt>Assigned Director</dt>
                    <dd>{directorName}</dd>
                </div>

                <div>
                    <dt>Last updated</dt>
                    <dd>{formatDate(voucher.updatedAt)}</dd>
                </div>
            </dl>

            {voucher.status !== 'REJECTED' && (
                <div className={styles.recordNextAction}>
                    <span>Next action</span>

                    <p>{getNextAction(voucher.status)}</p>
                </div>
            )}

            {voucher.status === 'REJECTED' &&
                voucher.rejectionRemarks && (
                    <div className={styles.recordRejection}>
                        <strong>Director’s remarks</strong>

                        <p>{voucher.rejectionRemarks}</p>
                    </div>
                )}

            <div className={styles.recordCardFooter}>
                <span>
                    Created {formatDate(voucher.createdAt)}
                </span>

                {onViewDetails ? (
                    <button
                        className={styles.recordViewButton}
                        onClick={() =>
                            onViewDetails(voucher)
                        }
                        type="button"
                    >
                        {viewActionLabel}
                    </button>
                ) : (
                    <Link
                        className={styles.recordViewButton}
                        href={`/beta/payment-vouchers/${voucher.id}`}
                    >
                        {viewActionLabel}
                    </Link>
                )}
            </div>
        </article>
    );
}
import type { PettyCashStatus } from '@/domain/payment-requests/petty-cash/types';
import styles from './petty-cash.module.css';

const labels: Record<PettyCashStatus, string> = {
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  PENDING_DIRECTOR_APPROVAL: 'Pending Director Preview',
  PENDING_FINANCE_REVIEW: 'Pending Independent Review',
  PENDING_FINANCE_PAYMENT: 'Pending Finance Payment',
  FINANCE_VERIFIED: 'Finance Verified',
  RETURNED_TO_STAFF: 'Returned to Requester',
  PAID: 'Paid',
};

export function PettyCashStatusBadge({ status }: { status: PettyCashStatus }) {
  return <span className={`${styles.status} ${styles[`status${status}`]}`}>{labels[status]}</span>;
}

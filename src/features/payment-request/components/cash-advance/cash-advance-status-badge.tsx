import type { CashAdvanceStatus } from '@/domain/payment-requests/cash-advance/types';
import styles from './cash-advance.module.css';

const labels: Record<CashAdvanceStatus, string> = {
  PENDING_MANAGER_APPROVAL: 'Pending Manager Approval',
  PENDING_DIRECTOR_APPROVAL: 'Pending Director Approval',
  PENDING_FINANCE_PROCESSING: 'Pending Finance Processing',
  PENDING_RECONCILIATION: 'Reconciliation Required',
  PENDING_FINANCE_RECONCILIATION: 'Pending Finance Reconciliation',
  RETURNED_TO_STAFF: 'Returned to Requester',
  COMPLETED: 'Completed',
};

export function CashAdvanceStatusBadge({ status }: { status: CashAdvanceStatus }) {
  return <span className={styles.badge} data-status={status}>{labels[status]}</span>;
}

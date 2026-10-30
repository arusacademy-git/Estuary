import type { CashAdvanceStatus } from '@/domain/payment-requests/cash-advance/types';
import { standardPaymentStatusLabel } from '@/domain/payment-requests/standard-payment-status';
import styles from './cash-advance.module.css';

export function CashAdvanceStatusBadge({ status }: { status: CashAdvanceStatus }) {
  return <span className={styles.badge} data-status={status}>{standardPaymentStatusLabel(status)}</span>;
}

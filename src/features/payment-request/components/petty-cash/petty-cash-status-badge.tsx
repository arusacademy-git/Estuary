import type { PettyCashStatus } from '@/domain/payment-requests/petty-cash/types';
import { standardPaymentStatusLabel } from '@/domain/payment-requests/standard-payment-status';
import styles from './petty-cash.module.css';

export function PettyCashStatusBadge({ status }: { status: PettyCashStatus }) {
  return <span className={`${styles.status} ${styles[`status${status}`]}`}>{standardPaymentStatusLabel(status)}</span>;
}

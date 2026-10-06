import type { Route } from 'next';
import Link from 'next/link';

import styles from './payment-records.module.css';

type PaymentTypeCardProps = {
  title: string;
  description: string;
  shortCode: string;
  totalRecords: number;
  attentionCount?: number;
  href?: Route;
  available?: boolean;
};

export function PaymentTypeCard({
  title,
  description,
  shortCode,
  totalRecords,
  attentionCount = 0,
  href,
  available = false,
}: PaymentTypeCardProps) {
  const hasAttention = attentionCount > 0;

  return (
    <article className={styles.paymentTypeCard}>
      <div className={styles.paymentTypeCardHeader}>
        <span
          className={styles.paymentTypeIcon}
          aria-hidden="true"
        >
          {shortCode}
        </span>

        <span
          className={
            available
              ? styles.availableBadge
              : styles.comingSoonBadge
          }
        >
          {available ? 'Available' : 'Coming next'}
        </span>
      </div>

      <div className={styles.paymentTypeContent}>
        <h2>{title}</h2>

        <p>{description}</p>
      </div>

      <div className={styles.paymentTypeStatistics}>
        <div>
          <span>Total records</span>
          <strong>{totalRecords}</strong>
        </div>

        <div>
          <span>Require attention</span>

          <strong
            className={
              hasAttention
                ? styles.attentionNumber
                : undefined
            }
          >
            {attentionCount}
          </strong>
        </div>
      </div>

      <div className={styles.paymentTypeCardFooter}>
        {available && href ? (
          <Link
            className={styles.viewRecordsButton}
            href={href}
          >
            View records
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span
            className={styles.disabledRecordsButton}
            aria-disabled="true"
          >
            Not available yet
          </span>
        )}
      </div>
    </article>
  );
}
import Link from 'next/link';

import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';
import { standardPaymentStatusLabel } from '@/domain/payment-requests/standard-payment-status';

import styles from './travel-allowance-workflow.module.css';

type TravelAllowanceQueueCardProps = {
  actionLabel: string;
  href: string;
  record: TravelAllowanceRecord;
};

function money(value: number) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
}

export function TravelAllowanceQueueCard({ actionLabel, href, record }: TravelAllowanceQueueCardProps) {
  const employees = [...new Set(record.lines.map((line) => line.employeeName))].filter(Boolean);
  const projects = [...new Set(record.lines.map((line) => line.projectName))].filter(Boolean);
  const firstTravelDate = [...record.lines]
    .sort((left, right) => left.travelDate.localeCompare(right.travelDate))[0]?.travelDate;

  return (
    <article className={styles.requestCard}>
      <div className={styles.cardTop}>
        <span>{record.requestNumber}</span>
        <span className={styles.status} data-status={record.status}>{standardPaymentStatusLabel(record.status)}</span>
      </div>
      <h2>{employees.join(', ') || record.requesterName}</h2>
      <p>{record.lines.length} travel {record.lines.length === 1 ? 'entry' : 'entries'}</p>
      <dl>
        <div><dt>First travel date</dt><dd>{firstTravelDate || '—'}</dd></div>
        <div><dt>Amount</dt><dd>{money(record.totalAmount)}</dd></div>
        <div><dt>Requested by</dt><dd>{record.requesterName}</dd></div>
        <div><dt>Projects</dt><dd>{projects.join(', ') || '—'}</dd></div>
      </dl>
      <Link href={href}>{actionLabel}</Link>
    </article>
  );
}

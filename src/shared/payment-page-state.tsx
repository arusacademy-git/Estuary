import Link from 'next/link';

import styles from './payment-page-state.module.css';

export function PaymentPageState({
  title,
  copy,
  backHref = '/beta/payment-records',
  backLabel = 'Back to Payment Records',
}: {
  title: string;
  copy: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className={styles.statePage} aria-live="polite">
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href={backHref}>{backLabel}</Link>
    </main>
  );
}

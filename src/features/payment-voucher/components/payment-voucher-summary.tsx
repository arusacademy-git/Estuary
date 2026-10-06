import Link from 'next/link';

import styles from './payment-voucher.module.css';

export function PaymentVoucherSummary({ voucherId }: { voucherId: string }) {
  return (
    <section className={styles.panel}>
      <p className={styles.status}>Draft</p>
      <h1>{voucherId}</h1>
      <p className={styles.copy}>Replace this sample with a repository lookup and permission check. The same record page should render the action panel allowed for the signed-in role.</p>
      <div className={styles.actions}>
        <Link className={styles.secondary} href='/beta/payment-vouchers'>Back to Payment Vouchers</Link>
      </div>
    </section>
  );
}

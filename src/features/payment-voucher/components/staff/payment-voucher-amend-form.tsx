import styles from '../payment-voucher.module.css';

export function PaymentVoucherAmendForm({ remarks }: { remarks: string }) {
  return (
    <section className={styles.panel}>
      <div className={styles.notice}>
        <strong>Director requested amendments</strong>
        <p>{remarks}</p>
      </div>
      <h2>Amend Payment Voucher</h2>
      <p className={styles.copy}>Load the existing values into the editable Staff form, preserve the audit trail, then resubmit to the same assigned Director.</p>
    </section>
  );
}

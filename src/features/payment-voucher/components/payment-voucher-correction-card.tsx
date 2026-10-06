import Link from 'next/link';

import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';
import styles from './payment-voucher-correction-card.module.css';

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PaymentVoucherCorrectionCard({
  canAmend,
  directorName,
  voucher,
}: {
  canAmend: boolean;
  directorName: string;
  voucher: PaymentVoucherRecord;
}) {
  if (voucher.status !== 'REJECTED') return null;

  return <section className={styles.card}>
    <header><strong>Rejected</strong><span>Action required</span></header>
    <div className={styles.meta}>Rejected by Director · {directorName} · {date(voucher.updatedAt)}</div>
    <p className={styles.remark}><strong>Director&apos;s remark:</strong> {voucher.rejectionRemarks || 'Please review the rejected Payment Voucher and make the requested corrections.'}</p>
    <p>Amend the Payment Voucher and resubmit it for Director approval.</p>
    {canAmend && <Link href={`/beta/payment-vouchers/new?amend=${encodeURIComponent(voucher.id)}`}>Amend Payment Voucher →</Link>}
  </section>;
}

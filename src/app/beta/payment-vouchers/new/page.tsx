import {
  Suspense,
} from 'react';

import {
  PaymentVoucherCreateWorkspace,
} from '@/features/payment-voucher/components/staff/payment-voucher-create-workspace';

function PaymentVoucherWorkspaceLoading() {
  return (
    <section
      aria-live="polite"
      style={{
        background: '#ffffff',
        border: '1px solid #d8e1ee',
        borderRadius: '16px',
        color: '#0f2f57',
        padding: '32px',
      }}
    >
      <p
        style={{
          margin: 0,
        }}
      >
        Loading Payment Voucher…
      </p>
    </section>
  );
}

export default function NewPaymentVoucherPage() {
  return (
    <Suspense
      fallback={
        <PaymentVoucherWorkspaceLoading />
      }
    >
      <PaymentVoucherCreateWorkspace />
    </Suspense>
  );
}
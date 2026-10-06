import { InvoicePaymentEdit } from '@/features/payment-request/components/invoice-payment/staff/invoice-payment-edit';

export default async function InvoicePaymentEditPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return <InvoicePaymentEdit requestId={decodeURIComponent(requestId)} />;
}

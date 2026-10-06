import { InvoicePaymentRecordDetail } from '@/features/payment-records/components/invoice-payment/invoice-payment-record-detail';

type PageProps = { params: Promise<{ requestId: string }> };

export default async function InvoicePaymentRecordPage({ params }: PageProps) {
  const { requestId } = await params;
  return <InvoicePaymentRecordDetail requestId={decodeURIComponent(requestId)} />;
}

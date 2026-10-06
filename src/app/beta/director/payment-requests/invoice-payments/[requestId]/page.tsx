import { InvoicePaymentDirectorReview } from '@/features/payment-request/components/invoice-payment/director/invoice-payment-director-review';

type PageProps = { params: Promise<{ requestId: string }> };

export default async function DirectorInvoicePaymentPage({ params }: PageProps) {
  const { requestId } = await params;
  return <InvoicePaymentDirectorReview requestId={decodeURIComponent(requestId)} />;
}

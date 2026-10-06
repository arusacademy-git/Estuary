import { InvoicePaymentFinanceReview } from '@/features/payment-request/components/invoice-payment/finance/invoice-payment-finance-review';

type PageProps = { params: Promise<{ requestId: string }> };

export default async function FinanceInvoicePaymentPage({ params }: PageProps) {
  const { requestId } = await params;
  return <InvoicePaymentFinanceReview requestId={decodeURIComponent(requestId)} />;
}

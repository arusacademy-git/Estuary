import {
  InvoicePaymentManagerReview,
} from '@/features/payment-request/components/invoice-payment/project-manager/invoice-payment-manager-review';

type PageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function ManagerInvoicePaymentPage({ params }: PageProps) {
  const { requestId } = await params;
  return <InvoicePaymentManagerReview requestId={decodeURIComponent(requestId)} />;
}

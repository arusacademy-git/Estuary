import { PaymentRequestDetailScreen } from '@/app/_components/payment-request-screens';

export default async function PaymentRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PaymentRequestDetailScreen requestId={id} />;
}

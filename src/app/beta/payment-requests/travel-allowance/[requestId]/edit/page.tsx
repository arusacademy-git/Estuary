import { TravelAllowanceEdit } from '@/features/payment-request/components/travel-allowance/staff/travel-allowance-edit';

export default async function TravelAllowanceEditPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return <TravelAllowanceEdit requestId={decodeURIComponent(requestId)} />;
}

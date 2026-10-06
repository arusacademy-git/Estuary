import { TravelAllowanceManagerReview } from '@/features/payment-request/components/travel-allowance/project-manager/travel-allowance-manager-review';

type PageProps = { params: Promise<{ requestId: string }> };

export default async function ManagerTravelAllowancePage({ params }: PageProps) {
  const { requestId } = await params;
  return <TravelAllowanceManagerReview requestId={decodeURIComponent(requestId)} />;
}
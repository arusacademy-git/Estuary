import { TravelAllowanceDirectorReview } from '@/features/payment-request/components/travel-allowance/director/travel-allowance-director-review';

type PageProps = { params: Promise<{ requestId: string }> };

export default async function DirectorTravelAllowancePage({ params }: PageProps) {
  const { requestId } = await params;
  return <TravelAllowanceDirectorReview requestId={decodeURIComponent(requestId)} />;
}
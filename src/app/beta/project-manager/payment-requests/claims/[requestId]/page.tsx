import { ClaimManagerReview } from '@/features/payment-request/components/claims/project-manager/claim-manager-review';

export default async function ClaimManagerReviewPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return <ClaimManagerReview requestId={decodeURIComponent(requestId)} />;
}

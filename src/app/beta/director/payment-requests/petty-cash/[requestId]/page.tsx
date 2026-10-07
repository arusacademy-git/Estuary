import { PettyCashDirectorReview } from '@/features/payment-request/components/petty-cash/director/petty-cash-director-review';

export default async function PettyCashDirectorReviewPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <PettyCashDirectorReview requestId={decodeURIComponent(requestId)} />;
}

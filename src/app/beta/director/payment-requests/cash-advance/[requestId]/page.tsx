import { CashAdvanceDirectorReview } from '@/features/payment-request/components/cash-advance/director/cash-advance-director-review';

export default async function DirectorCashAdvanceReviewPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <CashAdvanceDirectorReview id={decodeURIComponent(requestId)} />;
}

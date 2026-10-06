import { CashAdvanceManagerReview } from '@/features/payment-request/components/cash-advance/project-manager/cash-advance-manager-review';

export default async function ManagerCashAdvanceReviewPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <CashAdvanceManagerReview id={decodeURIComponent(requestId)} />;
}

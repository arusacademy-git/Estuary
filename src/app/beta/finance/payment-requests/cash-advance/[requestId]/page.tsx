import { CashAdvanceFinanceReview } from '@/features/payment-request/components/cash-advance/finance/cash-advance-finance-review';

export default async function FinanceCashAdvanceReviewPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <CashAdvanceFinanceReview id={decodeURIComponent(requestId)} />;
}

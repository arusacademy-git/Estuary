import { TravelAllowanceFinanceReview } from '@/features/payment-request/components/travel-allowance/finance/travel-allowance-finance-review';

type PageProps = { params: Promise<{ requestId: string }> };

export default async function FinanceTravelAllowancePage({ params }: PageProps) {
  const { requestId } = await params;
  return <TravelAllowanceFinanceReview requestId={decodeURIComponent(requestId)} />;
}
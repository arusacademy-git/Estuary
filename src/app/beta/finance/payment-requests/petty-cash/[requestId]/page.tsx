import { PettyCashFinanceReview } from '@/features/payment-request/components/petty-cash/finance/petty-cash-finance-review';

type PageProps = {
  params: Promise<{ requestId: string }>;
};

export default async function PettyCashFinanceReviewPage({ params }: PageProps) {
  const { requestId } = await params;

  return (
    <PettyCashFinanceReview
      requestId={decodeURIComponent(requestId)}
    />
  );
}

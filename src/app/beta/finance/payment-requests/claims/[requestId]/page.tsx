import { ClaimFinanceReview } from '@/features/payment-request/components/claims/finance/claim-finance-review';
export default async function FinanceClaimReviewPage({ params }: { params: Promise<{ requestId: string }> }) { const { requestId } = await params; return <ClaimFinanceReview requestId={decodeURIComponent(requestId)} />; }

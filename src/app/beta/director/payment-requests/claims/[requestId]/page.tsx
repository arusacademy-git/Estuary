import { ClaimDirectorReview } from '@/features/payment-request/components/claims/director/claim-director-review';
export default async function DirectorClaimReviewPage({ params }: { params: Promise<{ requestId: string }> }) { const { requestId } = await params; return <ClaimDirectorReview requestId={decodeURIComponent(requestId)} />; }

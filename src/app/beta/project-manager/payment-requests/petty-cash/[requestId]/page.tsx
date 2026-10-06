import { PettyCashManagerReview } from '@/features/payment-request/components/petty-cash/project-manager/petty-cash-manager-review';
export default async function PettyCashManagerReviewPage({ params }: { params: Promise<{ requestId: string }> }) { const { requestId } = await params; return <PettyCashManagerReview requestId={decodeURIComponent(requestId)} />; }

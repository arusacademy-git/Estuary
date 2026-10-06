import { PettyCashDetail } from '@/features/payment-request/components/petty-cash/staff/petty-cash-detail';
export default async function PettyCashDetailPage({ params }: { params: Promise<{ requestId: string }> }) { const { requestId } = await params; return <PettyCashDetail requestId={decodeURIComponent(requestId)} />; }

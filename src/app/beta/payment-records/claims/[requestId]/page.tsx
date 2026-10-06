import { ClaimRecordDetail } from '@/features/payment-records/components/claims/claim-record-detail';
export default async function ClaimRecordDetailPage({ params }: 
    { params: Promise<{ requestId: string }> }) { 
        const { requestId } = await params; return <ClaimRecordDetail 
        requestId={decodeURIComponent(requestId)} />; 
    }

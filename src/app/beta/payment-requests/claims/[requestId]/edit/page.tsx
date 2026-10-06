import { ClaimDraftEditor } from '@/features/payment-request/components/claims/claim-draft-editor';
export default async function ClaimDraftEditPage({ params }: { params: Promise<{ requestId: string }> }) { 
    const { requestId } = await params; 
    return <ClaimDraftEditor requestId={decodeURIComponent(requestId)} />; 
}

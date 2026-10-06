import {
  PettyCashDetail,
} from '@/features/payment-request/components/petty-cash/staff/petty-cash-detail';

type PettyCashRecordDetailPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function PettyCashRecordDetailPage({
  params,
}: PettyCashRecordDetailPageProps) {
  const { requestId } = await params;

  return (
    <PettyCashDetail
      requestId={decodeURIComponent(
        requestId,
      )}
    />
  );
}
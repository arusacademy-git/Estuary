import { TravelAllowanceRecordDetail } from '@/features/payment-records/components/travel-allowance/travel-allowance-record-detail';

type PageProps = { params: Promise<{ requestId: string }> };

export default async function TravelAllowanceRecordPage({ params }: PageProps) {
  const { requestId } = await params;
  return <TravelAllowanceRecordDetail requestId={decodeURIComponent(requestId)} />;
}

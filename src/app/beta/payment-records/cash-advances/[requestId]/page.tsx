import { CashAdvancePaymentRecordDetail } from '@/features/payment-records/components/cash-advance/cash-advance-detail';

type PageProps = { params: Promise<{ requestId: string }> };

export default async function CashAdvancePaymentRecordPage({ params }: PageProps) {
  const { requestId } = await params;
  return <CashAdvancePaymentRecordDetail requestId={decodeURIComponent(requestId)} />;
}

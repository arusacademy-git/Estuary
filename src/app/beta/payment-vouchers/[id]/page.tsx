import { PaymentVoucherDetail } from '@/features/payment-voucher/components/payment-voucher-detail';

type PaymentVoucherDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PaymentVoucherDetailPage({
  params,
}: PaymentVoucherDetailPageProps) {
  const { id } = await params;

  return <PaymentVoucherDetail voucherId={id} />;
}
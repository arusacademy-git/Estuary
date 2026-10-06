import {
  RecipientPaymentVoucherView,
} from '@/features/payment-voucher/components/recipient/recipient-payment-voucher-view';

type RecipientPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function RecipientPage({
  params,
}: RecipientPageProps) {
  const { token } = await params;

  return (
    <RecipientPaymentVoucherView
      token={token}
    />
  );
}
import { notFound } from 'next/navigation';

import { RecipientSignatureScreen } from '@/app/_components/recipient-signature-screen';
import { getVoucherByRecipientToken } from '@/data/prototype/prototype-state-repository';

export const dynamic = 'force-dynamic';

export default async function RecipientSignaturePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const voucher = await getVoucherByRecipientToken(token);

  if (!voucher) {
    notFound();
  }

  return <RecipientSignatureScreen voucher={voucher} />;
}

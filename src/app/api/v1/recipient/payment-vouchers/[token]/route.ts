import {
  getPaymentVoucherByRecipientTokenFromDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const voucher = await getPaymentVoucherByRecipientTokenFromDatabase(
      decodeURIComponent(token),
    );

    return dataResponse(voucher);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'The Payment Voucher could not be opened.';

    const status = message.includes('expired') ? 410 : 404;

    return Response.json(
      {
        error: 'RECIPIENT_PAYMENT_VOUCHER_UNAVAILABLE',
        message,
      },
      { status },
    );
  }
}

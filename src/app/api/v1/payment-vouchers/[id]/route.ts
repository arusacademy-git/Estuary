import {
  getPaymentVoucherFromDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const voucher = await getPaymentVoucherFromDatabase(
      decodeURIComponent(id),
    );

    if (!voucher) {
      return Response.json(
        {
          error: 'PAYMENT_VOUCHER_NOT_FOUND',
          message: 'The Payment Voucher could not be found.',
        },
        { status: 404 },
      );
    }

    return dataResponse(voucher);
  } catch (error) {
    console.error('Unable to read Payment Voucher from PostgreSQL.', error);

    return Response.json(
      {
        error: 'PAYMENT_VOUCHER_DATABASE_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'The Payment Voucher could not be loaded.',
      },
      { status: 500 },
    );
  }
}

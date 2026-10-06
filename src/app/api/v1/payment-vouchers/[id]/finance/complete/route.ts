import { z } from 'zod';

import {
  completePaymentVoucherInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const completePaymentVoucherSchema = z.object({
  financeId: z.string().trim().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = completePaymentVoucherSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_FINANCE_USER',
        message: 'Finance user information is required.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const voucher = await completePaymentVoucherInDatabase(
      decodeURIComponent(id),
      parsed.data.financeId,
    );

    return dataResponse(voucher);
  } catch (error) {
    console.error('Unable to complete the Payment Voucher.', error);

    const message =
      error instanceof Error
        ? error.message
        : 'The Payment Voucher could not be completed.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('not an active Finance')
        ? 403
        : message.includes('must be collected')
          ? 400
          : 409;

    return Response.json(
      {
        error: 'COMPLETE_PAYMENT_VOUCHER_FAILED',
        message,
      },
      { status },
    );
  }
}

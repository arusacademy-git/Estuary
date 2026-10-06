import { z } from 'zod';

import {
  returnPaymentVoucherForNewSignatureInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const returnSignatureSchema = z.object({
  financeId: z.string().trim().min(1),
  remarks: z.string().trim().min(5).max(500),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = returnSignatureSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_RETURN_INFORMATION',
        message: 'Finance user and clear return remarks are required.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const voucher =
      await returnPaymentVoucherForNewSignatureInDatabase(
        decodeURIComponent(id),
        parsed.data.financeId,
        parsed.data.remarks,
      );

    return dataResponse(voucher);
  } catch (error) {
    console.error('Unable to return the signed Payment Voucher.', error);

    const message =
      error instanceof Error
        ? error.message
        : 'The signed Payment Voucher could not be returned.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('not an active Finance')
        ? 403
        : message.includes('clear reason')
          ? 400
          : 409;

    return Response.json(
      {
        error: 'RETURN_SIGNED_PAYMENT_VOUCHER_FAILED',
        message,
      },
      { status },
    );
  }
}

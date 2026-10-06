import { z } from 'zod';

import {
  submitDraftPaymentVoucherInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const submitSchema = z.object({
  staffId: z.string().trim().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = submitSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_SUBMISSION',
        message: 'The Staff account is required to submit this draft.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const voucher = await submitDraftPaymentVoucherInDatabase(
      decodeURIComponent(id),
      parsed.data.staffId,
    );

    return dataResponse(voucher);
  } catch (error) {
    console.error('Unable to submit Payment Voucher draft in PostgreSQL.', error);

    const message =
      error instanceof Error
        ? error.message
        : 'The Payment Voucher draft could not be submitted.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('belongs to another Staff') ||
          message.includes('not an active Director')
        ? 403
        : 409;

    return Response.json(
      {
        error: 'PAYMENT_VOUCHER_SUBMISSION_FAILED',
        message,
      },
      { status },
    );
  }
}

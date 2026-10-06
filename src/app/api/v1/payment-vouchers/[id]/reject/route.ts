import { z } from 'zod';

import {
  rejectPaymentVoucherInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const rejectSchema = z.object({
  directorId: z.string().trim().min(1),
  remarks: z.string().trim().min(5).max(500),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = rejectSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_REJECTION',
        message: 'Provide clear Director remarks of at least 5 characters.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const voucher = await rejectPaymentVoucherInDatabase(
      decodeURIComponent(id),
      parsed.data.directorId,
      parsed.data.remarks,
    );

    return dataResponse(voucher);
  } catch (error) {
    console.error('Unable to reject Payment Voucher in PostgreSQL.', error);

    const message =
      error instanceof Error
        ? error.message
        : 'The Payment Voucher could not be rejected.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('assigned to another Director') ||
          message.includes('not an active Director')
        ? 403
        : 409;

    return Response.json(
      {
        error: 'PAYMENT_VOUCHER_REJECTION_FAILED',
        message,
      },
      { status },
    );
  }
}


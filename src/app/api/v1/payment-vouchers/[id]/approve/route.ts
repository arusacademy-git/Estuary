import { z } from 'zod';

import {
  approvePaymentVoucherInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const approveSchema = z.object({
  directorId: z.string().trim().min(1),
  signatureKey: z.string().trim().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = approveSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_APPROVAL',
        message: 'Director and signature information are required.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const voucher = await approvePaymentVoucherInDatabase(
      decodeURIComponent(id),
      parsed.data.directorId,
      parsed.data.signatureKey,
    );

    return dataResponse(voucher);
  } catch (error) {
    console.error('Unable to approve Payment Voucher in PostgreSQL.', error);

    const message =
      error instanceof Error
        ? error.message
        : 'The Payment Voucher could not be approved.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('assigned to another Director') ||
          message.includes('not an active Director')
        ? 403
        : 409;

    return Response.json(
      {
        error: 'PAYMENT_VOUCHER_APPROVAL_FAILED',
        message,
      },
      { status },
    );
  }
}
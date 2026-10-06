import { z } from 'zod';

import {
  confirmRecipientSignedPaymentVoucherInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const requesterConfirmationSchema = z.object({
  requesterId: z.string().trim().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = requesterConfirmationSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_REQUESTER',
        message: 'Requester information is required.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const voucher =
      await confirmRecipientSignedPaymentVoucherInDatabase(
        decodeURIComponent(id),
        parsed.data.requesterId,
      );

    return dataResponse(voucher);
  } catch (error) {
    console.error(
      'Unable to confirm the recipient-signed Payment Voucher.',
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : 'The signed Payment Voucher could not be confirmed.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('not an active member') ||
          message.includes('Only the original submitter')
        ? 403
        : message.includes('has not been recorded')
          ? 400
          : 409;

    return Response.json(
      {
        error: 'CONFIRM_SIGNED_PAYMENT_VOUCHER_FAILED',
        message,
      },
      { status },
    );
  }
}

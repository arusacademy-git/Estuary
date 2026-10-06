import { z } from 'zod';

import {
  savePaymentVoucherFinanceInformationInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const paymentInformationSchema = z.object({
  financeId: z.string().trim().min(1),
  paymentDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentReference: z.string().trim().min(1).max(200),
  paymentRemarks: z.string().trim().max(2000).optional(),
  paymentProofFileName: z.string().trim().max(255).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = paymentInformationSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_PAYMENT_INFORMATION',
        message: 'Enter a valid payment date and payment reference.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const voucher =
      await savePaymentVoucherFinanceInformationInDatabase(
        decodeURIComponent(id),
        parsed.data,
      );

    return dataResponse(voucher);
  } catch (error) {
    console.error(
      'Unable to save Payment Voucher Finance information in PostgreSQL.',
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Payment information could not be saved.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('not an active Finance')
        ? 403
        : message.includes('valid payment date') ||
            message.includes('reference is required')
          ? 400
          : 409;

    return Response.json(
      {
        error: 'SAVE_PAYMENT_INFORMATION_FAILED',
        message,
      },
      { status },
    );
  }
}

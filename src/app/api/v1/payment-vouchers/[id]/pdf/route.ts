import { z } from 'zod';

import {
  recordPaymentVoucherPdfGeneratedInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const generatePdfSchema = z.object({
  financeId: z.string().trim().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = generatePdfSchema.safeParse(
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
    const voucher = await recordPaymentVoucherPdfGeneratedInDatabase(
      decodeURIComponent(id),
      parsed.data.financeId,
    );

    return dataResponse(voucher);
  } catch (error) {
    console.error(
      'Unable to record Payment Voucher PDF generation in PostgreSQL.',
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : 'The Payment Voucher PDF generation could not be recorded.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('not an active Finance')
        ? 403
        : message.includes('Save the payment')
          ? 400
          : 409;

    return Response.json(
      {
        error: 'GENERATE_PAYMENT_VOUCHER_PDF_FAILED',
        message,
      },
      { status },
    );
  }
}
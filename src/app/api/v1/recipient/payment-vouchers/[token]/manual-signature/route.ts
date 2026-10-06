import { z } from 'zod';

import {
  submitManualSignedPaymentVoucherByRecipientInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

const manualSignatureSchema = z.object({
  fileName: z.string().trim().min(1).max(255).refine(
    (value) => value.toLowerCase().endsWith('.pdf'),
    'Please upload the manually signed Payment Voucher as a PDF file.',
  ),
  dataUrl: z
    .string()
    .trim()
    .min(1)
    .max(3_600_000)
    .refine(
      (value) => /^data:application\/pdf;base64,/i.test(value),
      'Please upload a valid PDF file.',
    ),
  confirmedPaymentReceived: z.literal(true),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = manualSignatureSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_MANUAL_SIGNATURE',
        message:
          parsed.error.issues[0]?.message ??
          'The manually signed Payment Voucher information is incomplete.',
      },
      { status: 400 },
    );
  }

  try {
    const { token } = await context.params;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const voucher =
      await submitManualSignedPaymentVoucherByRecipientInDatabase(
        decodeURIComponent(token),
        {
          ...parsed.data,
          requestIp: forwardedFor?.split(',')[0]?.trim(),
          requestUserAgent: request.headers.get('user-agent') ?? undefined,
        },
      );

    return dataResponse(voucher);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'The manually signed Payment Voucher could not be submitted.';

    const status = message.includes('expired')
      ? 410
      : message.includes('invalid') || message.includes('already been used')
        ? 404
        : message.includes('valid PDF') || message.includes('smaller than')
          ? 400
          : 409;

    return Response.json(
      {
        error: 'SUBMIT_MANUAL_SIGNATURE_FAILED',
        message,
      },
      { status },
    );
  }
}

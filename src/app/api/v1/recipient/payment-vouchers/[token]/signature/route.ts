import { z } from 'zod';

import {
  submitPaymentVoucherRecipientSignatureInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

const recipientSignatureSchema = z.object({
  signatureFileName: z.string().trim().min(1).max(255),
  signatureDataUrl: z
    .string()
    .trim()
    .min(1)
    .max(2_800_000)
    .refine(
      (value) => /^data:image\/(png|jpeg);base64,/i.test(value),
      'Please upload a valid PNG or JPG signature image.',
    ),
  confirmedPaymentReceived: z.literal(true),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = recipientSignatureSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_RECIPIENT_SIGNATURE',
        message:
          parsed.error.issues[0]?.message ??
          'The recipient signature information is incomplete.',
      },
      { status: 400 },
    );
  }

  try {
    const { token } = await context.params;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const voucher =
      await submitPaymentVoucherRecipientSignatureInDatabase(
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
        : 'The recipient signature could not be submitted.';

    const status = message.includes('expired')
      ? 410
      : message.includes('invalid') || message.includes('already been used')
        ? 404
        : message.includes('valid PNG') || message.includes('smaller than')
          ? 400
          : 409;

    return Response.json(
      {
        error: 'SUBMIT_RECIPIENT_SIGNATURE_FAILED',
        message,
      },
      { status },
    );
  }
}

import { z } from 'zod';

import {
  uploadManualSignedPaymentVoucherByStaffInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const requesterManualUploadSchema = z.object({
  requesterId: z.string().trim().min(1),
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
  const parsed = requesterManualUploadSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_STAFF_MANUAL_UPLOAD',
        message:
          parsed.error.issues[0]?.message ??
          'The manually signed Payment Voucher information is incomplete.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const { requesterId, ...input } = parsed.data;
    const voucher =
      await uploadManualSignedPaymentVoucherByStaffInDatabase(
        decodeURIComponent(id),
        requesterId,
        input,
      );

    return dataResponse(voucher);
  } catch (error) {
    console.error('Unable to upload the manually signed Payment Voucher.', error);

    const message =
      error instanceof Error
        ? error.message
        : 'The manually signed Payment Voucher could not be uploaded.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('not an active member') ||
          message.includes('Only the original submitter')
        ? 403
        : message.includes('valid PDF') || message.includes('smaller than')
          ? 400
          : 409;

    return Response.json(
      {
        error: 'UPLOAD_MANUAL_SIGNED_PAYMENT_VOUCHER_FAILED',
        message,
      },
      { status },
    );
  }
}

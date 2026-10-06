import { z } from 'zod';

import {
  resubmitPaymentVoucherInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const lineSchema = z.object({
  accountCode: z.string().trim().min(1),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unitAmount: z.coerce.number().nonnegative(),
  taxAmount: z.coerce.number().nonnegative(),
});

const resubmitPaymentVoucherSchema = z.object({
  organizationId: z.string().trim().min(1),
  submitterId: z.string().trim().min(1),
  directorId: z.string().trim().min(1),
  projectManagerId: z.string().trim().min(1).optional(),
  pvDate: z.string().trim().min(1),
  division: z.string().trim().min(1),
  recipientName: z.string().trim().min(1),
  recipientEmail: z.string().trim().email(),
  recipientReference: z.string().trim().optional(),
  recipientIc: z.string().trim().optional(),
  recipientIsMalaysian: z.boolean(),
  paymentMethod: z.string().trim().min(1),
  bankName: z.string().trim().optional(),
  bankAccountNumber: z.string().trim().optional(),
  purpose: z.string().trim().min(1),
  lines: z.array(lineSchema).min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = resubmitPaymentVoucherSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_PAYMENT_VOUCHER_AMENDMENT',
        message: 'Complete all required Payment Voucher fields before resubmitting.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const voucher = await resubmitPaymentVoucherInDatabase(
      decodeURIComponent(id),
      parsed.data,
    );

    return dataResponse(voucher);
  } catch (error) {
    console.error('Unable to resubmit Payment Voucher in PostgreSQL.', error);

    const message =
      error instanceof Error
        ? error.message
        : 'The Payment Voucher could not be resubmitted.';
    const status = message.includes('could not be found')
      ? 404
      : message.includes('Only the person who created') ||
        message.includes('not an active member')
        ? 403
        : 409;

    return Response.json(
      {
        error: 'PAYMENT_VOUCHER_RESUBMISSION_FAILED',
        message,
      },
      { status },
    );
  }
}

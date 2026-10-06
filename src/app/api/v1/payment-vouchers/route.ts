import { z } from 'zod';

import {
  createPaymentVoucherInDatabase,
  listPaymentVouchersFromDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const lineSchema = z.object({
  accountCode: z.string().trim().min(1),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unitAmount: z.coerce.number().nonnegative(),
  taxAmount: z.coerce.number().nonnegative(),
});

const createPaymentVoucherSchema = z.object({
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
  submitForApproval: z.boolean().default(true),
});

function databaseError(error: unknown) {
  console.error('Payment Voucher database operation failed.', error);

  return Response.json(
    {
      error: 'PAYMENT_VOUCHER_DATABASE_ERROR',
      message:
        error instanceof Error
          ? error.message
          : 'The Payment Voucher database operation failed.',
    },
    { status: 500 },
  );
}

export async function GET() {
  try {
    return dataResponse(await listPaymentVouchersFromDatabase());
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  const parsed = createPaymentVoucherSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_PAYMENT_VOUCHER',
        message: 'Complete all required Payment Voucher fields.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { submitForApproval, ...input } = parsed.data;

  try {
    return dataResponse(
      await createPaymentVoucherInDatabase(input, submitForApproval),
      { status: 201 },
    );
  } catch (error) {
    return databaseError(error);
  }
}

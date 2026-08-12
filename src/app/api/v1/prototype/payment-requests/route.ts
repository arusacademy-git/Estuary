import { z } from 'zod';

import {
  createPaymentRequest,
  getPaymentRequestState,
} from '@/data/prototype/payment-request-repository';
import { dataResponse } from '@/lib/api/response';

const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(2),
  accountCode: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitAmount: z.coerce.number().nonnegative(),
  taxAmount: z.coerce.number().nonnegative().optional(),
});

const createSchema = z.object({
  actorId: z.string(),
  type: z.enum([
    'INVOICE_PAYMENT',
    'EXPENSE_CLAIM',
    'TRAVEL_ALLOWANCE',
    'CASH_ADVANCE',
  ]),
  title: z.string().min(2),
  payeeName: z.string().min(2),
  currency: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
  notes: z.string().optional(),
  managerApproverId: z.string().optional(),
  directorApproverId: z.string().optional(),
  parentRequestId: z.string().optional(),
  childRequestIds: z.array(z.string()).optional(),
});

export async function GET(): Promise<Response> {
  return dataResponse(await getPaymentRequestState());
}

export async function POST(request: Request): Promise<Response> {
  const json = await request.json();
  const parsed = createSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      {
        error: 'Invalid payment request payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    return dataResponse(await createPaymentRequest(parsed.data));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create payment request.',
      },
      { status: 400 }
    );
  }
}

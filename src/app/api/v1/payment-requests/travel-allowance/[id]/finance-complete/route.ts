import { z } from 'zod';

import { completeTravelAllowanceByFinanceInDatabase } from '@/data/payment-requests/travel-allowance/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type RouteContext = { params: Promise<{ id: string }> };
const bodySchema = z.object({
  financeId: z.string().min(1),
  paymentDate: z.string().min(1),
  paymentReference: z.string().trim().min(1),
  transactionProof: z.object({ id: z.string().min(1), fileName: z.string().min(1), mimeType: z.string().min(1), size: z.number().int().positive().max(2.5 * 1024 * 1024), dataUrl: z.string().min(1) }).optional(),
  remarks: z.string().trim().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'INVALID_FINANCE_COMPLETION', message: 'Payment date and reference are required.' }, { status: 400 });
  try {
    const { id } = await context.params;
    return dataResponse(await completeTravelAllowanceByFinanceInDatabase(decodeURIComponent(id), parsed.data.financeId, parsed.data.paymentDate, parsed.data.paymentReference, parsed.data.transactionProof, parsed.data.remarks));
  } catch (error) {
    return Response.json({ error: 'FINANCE_COMPLETION_FAILED', message: error instanceof Error ? error.message : 'Finance verification failed.' }, { status: 409 });
  }
}

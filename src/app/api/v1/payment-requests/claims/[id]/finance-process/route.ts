import { z } from 'zod';
import { processClaimByFinanceInDatabase } from '@/data/payment-requests/claims/prisma-repository';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const parsed = z.object({ financeId: z.string().min(1), paymentDate: z.string().min(1), paymentReference: z.string().trim().min(1), notes: z.string().trim().optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Finance user, payment date and reference are required.' }, { status: 400 });
  try { const { id } = await context.params; const { financeId, ...input } = parsed.data; return dataResponse(await processClaimByFinanceInDatabase(decodeURIComponent(id), financeId, input)); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : 'The Claim could not be processed.' }, { status: 500 }); }
}
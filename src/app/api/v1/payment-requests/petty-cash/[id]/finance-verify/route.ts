import { z } from 'zod';
import { verifyPettyCashByFinanceInDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const parsed = z.object({
    financeId: z.string().min(1), paymentDate: z.string().min(1),
    paymentReference: z.string().trim().min(1),
    paymentProofLink: z.string().trim().optional(), notes: z.string().trim().optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Complete the Finance payment information.' }, { status: 400 });
  try { const { id } = await context.params; return dataResponse(await verifyPettyCashByFinanceInDatabase(decodeURIComponent(id), parsed.data)); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : 'The payment could not be verified.' }, { status: 500 }); }
}

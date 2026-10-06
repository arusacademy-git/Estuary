import { z } from 'zod';
import { verifyPettyCashByFinanceInDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
const paymentReceipt = z.string().trim().min(1).max(4_000_000).refine(
  (value) => /^data:(application\/pdf|image\/png|image\/jpeg);base64,/.test(value) || z.string().url().safeParse(value).success,
  'Upload a valid PDF, JPG or PNG payment receipt.',
);
export async function POST(request: Request, context: Context) {
  const parsed = z.object({
    financeId: z.string().min(1), paymentDate: z.string().min(1), paymentReference: z.string().trim().min(1),
    paymentProofLink: paymentReceipt, notes: z.string().trim().optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Complete the Finance payment information and upload the payment receipt.' }, { status: 400 });
  try { const { id } = await context.params; return dataResponse(await verifyPettyCashByFinanceInDatabase(decodeURIComponent(id), parsed.data)); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : 'The payment could not be verified.' }, { status: 500 }); }
}

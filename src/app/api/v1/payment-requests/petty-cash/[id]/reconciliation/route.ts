import { z } from 'zod';
import { submitPettyCashReconciliationInDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type Context = { params: Promise<{ id: string }> };
const receipt = z.object({ id: z.string().min(1), fileName: z.string().min(1), mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']), size: z.number().positive().max(2.5 * 1024 * 1024), dataUrl: z.string().max(4_000_000) });
const schema = z.object({ requesterId: z.string().min(1), actualSpent: z.number().nonnegative(), receipts: z.array(receipt).min(1).max(5), returnedBalance: z.number().nonnegative(), balanceReturnDate: z.string().optional(), balanceReturnReference: z.string().trim().optional(), balanceReturnProof: receipt.optional(), noBalanceRemark: z.string().trim().optional(), remarks: z.string().trim().optional() });

export async function POST(request: Request, context: Context) {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Complete the reconciliation and upload valid purchase receipts.' }, { status: 400 });
    try { const { id } = await context.params; return dataResponse(await submitPettyCashReconciliationInDatabase(decodeURIComponent(id), parsed.data)); }
    catch (error) { return Response.json({ message: error instanceof Error ? error.message : 'The reconciliation could not be submitted.' }, { status: 500 }); }
}

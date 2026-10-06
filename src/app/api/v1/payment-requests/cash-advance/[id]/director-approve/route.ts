import { z } from 'zod';
import { approveCashAdvanceByDirectorInDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import { cashAdvanceError } from '@/data/payment-requests/cash-advance/cash-advance-validation';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ directorId: z.string().min(1), signatureKey: z.string().trim().min(1) });
export async function POST(request: Request, context: Context) {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Director and signature are required.' }, { status: 400 });
    try { const { id } = await context.params; return dataResponse(await approveCashAdvanceByDirectorInDatabase(decodeURIComponent(id), parsed.data.directorId, parsed.data.signatureKey)); }
    catch (error) { return cashAdvanceError(error, 'The Director approval could not be saved.'); }
}

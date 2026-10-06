import { z } from 'zod';
import { approveCashAdvanceByManagerInDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import { cashAdvanceError } from '@/data/payment-requests/cash-advance/cash-advance-validation';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ managerId: z.string().min(1), signatureKey: z.string().trim().min(1) });
export async function POST(request: Request, context: Context) {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Manager and signature are required.' }, { status: 400 });
    try { const { id } = await context.params; return dataResponse(await approveCashAdvanceByManagerInDatabase(decodeURIComponent(id), parsed.data.managerId, parsed.data.signatureKey)); }
    catch (error) { return cashAdvanceError(error, 'The Manager approval could not be saved.'); }
}

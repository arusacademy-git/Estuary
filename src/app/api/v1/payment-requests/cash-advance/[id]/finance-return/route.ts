import { z } from 'zod';
import { returnCashAdvanceByFinanceInDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import { cashAdvanceError } from '@/data/payment-requests/cash-advance/cash-advance-validation';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ financeId: z.string().min(1), reason: z.string().trim().min(5).max(500) });
export async function POST(request: Request, context: Context) {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Provide clear Finance return remarks.' }, { status: 400 });
    try { const { id } = await context.params; return dataResponse(await returnCashAdvanceByFinanceInDatabase(decodeURIComponent(id), parsed.data.financeId, parsed.data.reason)); }
    catch (error) { return cashAdvanceError(error, 'The request could not be returned.'); }
}

import { z } from 'zod';
import { completeCashAdvanceInDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import { cashAdvanceError } from '@/data/payment-requests/cash-advance/cash-advance-validation';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ financeId: z.string().min(1) });
export async function POST(request: Request, context: Context) {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Finance user is required.' }, { status: 400 });
    try { const { id } = await context.params; return dataResponse(await completeCashAdvanceInDatabase(decodeURIComponent(id), parsed.data.financeId)); }
    catch (error) { return cashAdvanceError(error, 'The Cash Advance could not be completed.'); }
}

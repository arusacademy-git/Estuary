import { z } from 'zod';
import { payCashAdvanceByFinanceInDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import { cashAdvanceError } from '@/data/payment-requests/cash-advance/cash-advance-validation';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ financeId: z.string().min(1), paymentDate: z.string().min(1), paymentReference: z.string().trim().min(1) });
export async function POST(request: Request, context: Context) {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Payment date and reference are required.' }, { status: 400 });
    try { const { id } = await context.params; return dataResponse(await payCashAdvanceByFinanceInDatabase(decodeURIComponent(id), parsed.data.financeId, parsed.data.paymentDate, parsed.data.paymentReference)); }
    catch (error) { return cashAdvanceError(error, 'The Finance payment could not be saved.'); }
}

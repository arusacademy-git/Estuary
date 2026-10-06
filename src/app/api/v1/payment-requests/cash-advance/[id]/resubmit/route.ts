import { createCashAdvanceSchema, cashAdvanceError } from '@/data/payment-requests/cash-advance/cash-advance-validation';
import { resubmitCashAdvanceInDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
    const parsed = createCashAdvanceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Complete all required Cash Advance fields.', details: parsed.error.flatten() }, { status: 400 });
    try { const { id } = await context.params; return dataResponse(await resubmitCashAdvanceInDatabase(decodeURIComponent(id), parsed.data)); }
    catch (error) { return cashAdvanceError(error, 'The corrected Cash Advance could not be resubmitted.'); }
}

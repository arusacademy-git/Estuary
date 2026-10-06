import { getCashAdvanceFromDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import { cashAdvanceError } from '@/data/payment-requests/cash-advance/cash-advance-validation';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
    try {
        const { id } = await context.params;
        const record = await getCashAdvanceFromDatabase(decodeURIComponent(id));
        if (!record) return Response.json({ error: 'CASH_ADVANCE_NOT_FOUND', message: 'Cash Advance could not be found.' }, { status: 404 });
        return dataResponse(record);
    } catch (error) {
        return cashAdvanceError(error, 'The Cash Advance could not be loaded.');
    }
}

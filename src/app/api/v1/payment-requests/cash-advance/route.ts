import { createCashAdvanceSchema, cashAdvanceError } from '@/data/payment-requests/cash-advance/cash-advance-validation';
import { createCashAdvanceInDatabase, listCashAdvancesFromDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const role = url.searchParams.get('role');
        const userId = url.searchParams.get('userId');
        if (!userId || !['staff', 'manager', 'director', 'finance'].includes(role ?? '')) {
            return Response.json({ error: 'INVALID_SCOPE', message: 'A valid role and user are required.' }, { status: 400 });
        }
        return dataResponse(await listCashAdvancesFromDatabase({
            role: role as 'staff' | 'manager' | 'director' | 'finance',
            userId,
            month: url.searchParams.get('month') ?? undefined,
            includeAll: url.searchParams.get('includeAll') === '1',
            approvalOnly: url.searchParams.get('approvalOnly') === '1',
        }));
    } catch (error) {
        return cashAdvanceError(error, 'Cash Advances could not be loaded.');
    }
}

export async function POST(request: Request) {
    const parsed = createCashAdvanceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'INVALID_CASH_ADVANCE', message: 'Complete all required Cash Advance fields.', details: parsed.error.flatten() }, { status: 400 });
    try {
        return dataResponse(await createCashAdvanceInDatabase(parsed.data), { status: 201 });
    } catch (error) {
        return cashAdvanceError(error, 'The Cash Advance could not be created.');
    }
}

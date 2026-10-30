import { z } from 'zod';
import { returnPettyCashReconciliationInDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
    const parsed = z.object({ financeId: z.string().min(1), reason: z.string().trim().min(3) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Finance user information and correction remarks are required.' }, { status: 400 });
    try { const { id } = await context.params; return dataResponse(await returnPettyCashReconciliationInDatabase(decodeURIComponent(id), parsed.data.financeId, parsed.data.reason)); }
    catch (error) { return Response.json({ message: error instanceof Error ? error.message : 'The reconciliation could not be returned.' }, { status: 500 }); }
}

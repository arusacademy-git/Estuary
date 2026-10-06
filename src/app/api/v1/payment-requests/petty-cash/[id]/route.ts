import { getPettyCashFromDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const record = await getPettyCashFromDatabase(decodeURIComponent(id));
    if (!record) return Response.json({ error: 'NOT_FOUND', message: 'Petty Cash request not found.' }, { status: 404 });
    return dataResponse(record);
  } catch (error) {
    return Response.json({ error: 'PETTY_CASH_ERROR', message: error instanceof Error ? error.message : 'Petty Cash request could not be loaded.' }, { status: 500 });
  }
}

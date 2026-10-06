import { z } from 'zod';
import { approvePettyCashByManagerInDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  const parsed = z.object({ managerId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Manager information is required.' }, { status: 400 });
  try { const { id } = await context.params; return dataResponse(await approvePettyCashByManagerInDatabase(decodeURIComponent(id), parsed.data.managerId)); }
  catch (error) { return Response.json({ message: error instanceof Error ? error.message : 'The request could not be approved.' }, { status: 500 }); }
}

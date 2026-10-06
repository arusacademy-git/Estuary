import { z } from 'zod';

import { reviewPettyCashByFinancePeerInDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const parsed = z.object({ reviewerId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Finance reviewer information is required.' }, { status: 400 });
  try {
    const { id } = await context.params;
    return dataResponse(await reviewPettyCashByFinancePeerInDatabase(decodeURIComponent(id), parsed.data.reviewerId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : 'The request could not be reviewed.' }, { status: 500 });
  }
}

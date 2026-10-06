import { z } from 'zod';
import { returnClaimByManagerInDatabase } from '@/data/payment-requests/claims/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const parsed = z.object({ managerId: z.string().min(1), reason: z.string().trim().min(3) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'Manager and correction remarks are required.' }, { status: 400 });
  try {
    const { id } = await context.params;
    return dataResponse(await returnClaimByManagerInDatabase(decodeURIComponent(id), parsed.data.managerId, parsed.data.reason));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : 'The Claim could not be returned.' }, { status: 500 });
  }
}
import { z } from 'zod';

import { reviewTravelAllowanceByManagerInDatabase } from '@/data/payment-requests/travel-allowance/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ managerId: z.string().min(1) });

export async function POST(request: Request, context: RouteContext) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_MANAGER_REVIEW', message: 'Manager identity is required.' }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    return dataResponse(
      await reviewTravelAllowanceByManagerInDatabase(decodeURIComponent(id), parsed.data.managerId),
    );
  } catch (error) {
    return Response.json(
      { error: 'MANAGER_REVIEW_FAILED', message: error instanceof Error ? error.message : 'Manager review failed.' },
      { status: 409 },
    );
  }
}

import { z } from 'zod';

import { returnTravelAllowanceByManagerInDatabase } from '@/data/payment-requests/travel-allowance/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  managerId: z.string().min(1),
  reason: z.string().trim().min(5),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_MANAGER_RETURN', message: 'Enter a reason of at least 5 characters.' }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    return dataResponse(
      await returnTravelAllowanceByManagerInDatabase(
        decodeURIComponent(id),
        parsed.data.managerId,
        parsed.data.reason,
      ),
    );
  } catch (error) {
    return Response.json(
      { error: 'MANAGER_RETURN_FAILED', message: error instanceof Error ? error.message : 'Returning the request failed.' },
      { status: 409 },
    );
  }
}

import { z } from 'zod';

import { approveTravelAllowanceByDirectorInDatabase } from '@/data/payment-requests/travel-allowance/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type RouteContext = { params: Promise<{ id: string }> };
const bodySchema = z.object({ directorId: z.string().min(1) });

export async function POST(request: Request, context: RouteContext) {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return Response.json({ error: 'INVALID_DIRECTOR_APPROVAL', message: 'Director identity is required.' }, { status: 400 });
    }
    try {
        const { id } = await context.params;
        return dataResponse(await approveTravelAllowanceByDirectorInDatabase(decodeURIComponent(id), parsed.data.directorId));
    } catch (error) {
        return Response.json({ error: 'DIRECTOR_APPROVAL_FAILED', message: error instanceof Error ? error.message : 'Director approval failed.' }, { status: 409 });
    }
}

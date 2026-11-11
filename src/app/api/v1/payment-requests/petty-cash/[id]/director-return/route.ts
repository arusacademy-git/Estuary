import { z } from 'zod';

import { returnPettyCashByDirectorInDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { dataResponse } from '@/lib/api/response';

type Context = { params: Promise<{ id: string }> };

const inputSchema = z.object({
  directorId: z.string().trim().min(1),
  reason: z.string().trim().min(3),
});

export async function POST(request: Request, context: Context) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { message: 'Director and correction remarks are required.' },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    return dataResponse(
      await returnPettyCashByDirectorInDatabase(
        decodeURIComponent(id),
        parsed.data.directorId,
        parsed.data.reason,
      ),
    );
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : 'The request could not be returned.' },
      { status: 500 },
    );
  }
}

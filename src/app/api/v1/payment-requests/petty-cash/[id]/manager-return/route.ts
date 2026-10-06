import { z } from 'zod';

import {
  returnPettyCashByManagerInDatabase,
} from '@/data/payment-requests/petty-cash/prisma-repository';
import {
  dataResponse,
} from '@/lib/api/response';

type Context = {
  params: Promise<{
    id: string;
  }>;
};

const inputSchema = z.object({
  managerId:
    z.string().trim().min(1),

  reason:
    z.string().trim().min(3),
});

export async function POST(
  request: Request,
  context: Context,
) {
  const body = await request
    .json()
    .catch(() => null);

  const parsed =
    inputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        message:
          'Manager and correction remarks are required.',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const { id } = await context.params;

    const updated =
      await returnPettyCashByManagerInDatabase(
        decodeURIComponent(id),
        parsed.data.managerId,
        parsed.data.reason,
      );

    return dataResponse(updated);
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'The request could not be returned.',
      },
      {
        status: 500,
      },
    );
  }
}
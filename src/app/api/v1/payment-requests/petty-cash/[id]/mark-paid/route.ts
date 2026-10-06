import { z } from 'zod';

import {
  markPettyCashPaidInDatabase,
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
  financeId:
    z.string().trim().min(1),
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
          'Finance user information is required.',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const { id } = await context.params;

    const updated =
      await markPettyCashPaidInDatabase(
        decodeURIComponent(id),
        parsed.data.financeId,
      );

    return dataResponse(updated);
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'The request could not be marked paid.',
      },
      {
        status: 500,
      },
    );
  }
}
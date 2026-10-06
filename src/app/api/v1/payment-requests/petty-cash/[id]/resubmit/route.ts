import {
  resubmitPettyCashInDatabase,
} from '@/data/payment-requests/petty-cash/prisma-repository';
import type {
  CreatePettyCashInput,
} from '@/domain/payment-requests/petty-cash/types';
import {
  dataResponse,
} from '@/lib/api/response';

import {
  pettyCashInputSchema,
} from '../../route';

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: Context,
) {
  const body = await request
    .json()
    .catch(() => null);

  const parsed =
    pettyCashInputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        message:
          'Complete all required Petty Cash fields.',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const { id } = await context.params;

    const updated =
      await resubmitPettyCashInDatabase(
        decodeURIComponent(id),
        parsed.data as CreatePettyCashInput,
      );

    return dataResponse(updated);
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'The request could not be resubmitted.',
      },
      {
        status: 500,
      },
    );
  }
}
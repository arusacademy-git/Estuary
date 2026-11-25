import {
  createPettyCashInDatabase,
  listPettyCashFromDatabase,
} from '@/data/payment-requests/petty-cash/prisma-repository';
import type {
  CreatePettyCashInput,
  PettyCashRole,
} from '@/domain/payment-requests/petty-cash/types';
import { dataResponse } from '@/lib/api/response';

import { pettyCashInputSchema } from './schema';

export const dynamic = 'force-dynamic';

function failure(error: unknown) {
  return Response.json(
    {
      error: 'PETTY_CASH_ERROR',
      message:
        error instanceof Error
          ? error.message
          : 'The Petty Cash operation failed.',
    },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  try {
    return dataResponse(
      await listPettyCashFromDatabase({
        role: (query.get('role') ?? 'staff') as PettyCashRole,
        userId: query.get('userId') ?? '',
        month: query.get('month') ?? undefined,
        includeAll: query.get('includeAll') === '1',
      })
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const parsed = pettyCashInputSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success)
    return Response.json(
      {
        error: 'INVALID_PETTY_CASH',
        message: 'Complete all required Petty Cash fields.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  try {
    return dataResponse(
      await createPettyCashInDatabase(parsed.data as CreatePettyCashInput),
      { status: 201 }
    );
  } catch (error) {
    return failure(error);
  }
}

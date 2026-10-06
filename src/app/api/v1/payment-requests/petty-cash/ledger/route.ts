import {
  listPettyCashLedgerFromDatabase,
} from '@/data/payment-requests/petty-cash/prisma-repository';
import type {
  PettyCashLocation,
} from '@/domain/payment-requests/petty-cash/types';
import {
  dataResponse,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
) {
  const query = new URL(
    request.url,
  ).searchParams;

  const organizationId =
    query.get('organizationId') ?? '';

  const month =
    query.get('month') ?? '';

  const location = query.get(
    'location',
  ) as PettyCashLocation | null;

  if (!organizationId || !month) {
    return Response.json(
      {
        message:
          'Organization and month are required.',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const summaries =
      await listPettyCashLedgerFromDatabase({
        organizationId,
        month,
        location:
          location ?? undefined,
      });

    return dataResponse(summaries);
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'The Petty Cash ledger could not be loaded.',
      },
      {
        status: 500,
      },
    );
  }
}
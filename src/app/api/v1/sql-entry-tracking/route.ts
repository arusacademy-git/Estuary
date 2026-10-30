import { z } from 'zod';

import {
  listSqlEntryTrackingFromDatabase,
  upsertSqlEntryTrackingInDatabase,
} from '@/data/sql-entry-tracker/prisma-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  userId: z.string().trim().min(1),
  submissionId: z.string().trim().min(1),
  status: z.enum([
    'PENDING_ENTRY',
    'RECORDED_IN_SQL_SYSTEM',
    'NEEDS_CORRECTION',
    'NOT_REQUIRED',
  ]),
  sqlReference: z.string().max(100).optional().default(''),
  recordedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  notes: z.string().max(500).optional().default(''),
});

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'The SQL Entry Tracker operation failed.';
  const status = message.includes('Finance membership') ? 403 : 500;
  return Response.json({ error: 'SQL_ENTRY_TRACKER_ERROR', message }, { status });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const userId = query.get('userId') ?? '';
  if (query.get('role') !== 'finance' || !userId) {
    return Response.json({
      error: 'INVALID_SQL_ENTRY_QUERY',
      message: 'A signed-in Finance user is required.',
    }, { status: 400 });
  }
  try {
    return dataResponse(await listSqlEntryTrackingFromDatabase(userId));
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({
      error: 'INVALID_SQL_ENTRY_UPDATE',
      message: 'Complete the required SQL entry fields.',
      details: parsed.error.flatten(),
    }, { status: 400 });
  }
  try {
    return dataResponse(await upsertSqlEntryTrackingInDatabase(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

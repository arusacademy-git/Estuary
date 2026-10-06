import { z } from 'zod';

import {
  createPettyCashInDatabase,
  listPettyCashFromDatabase,
} from '@/data/payment-requests/petty-cash/prisma-repository';
import type { CreatePettyCashInput, PettyCashRole } from '@/domain/payment-requests/petty-cash/types';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const pettyCashInputSchema = z.object({
  organizationId: z.string().trim().min(1),
  requesterId: z.string().trim().min(1),
  requesterRole: z.enum(['staff', 'manager', 'director', 'finance']),
  requesterName: z.string().trim().min(1),
  requesterPosition: z.string().trim().min(1),
  requesterContact: z.string().trim().min(1),
  requestDate: z.string().trim().min(1),
  location: z.enum(['PENANG', 'KUALA_LUMPUR']),
  managerApproverId: z.string().trim(),
  directorApproverId: z.string().trim(),
  financeReviewerId: z.string().trim().optional(),
  financeReviewerRole: z.enum(['director', 'finance']).optional(),
  lines: z.array(z.object({
    id: z.string().trim().min(1),
    expenseDate: z.string().trim().min(1),
    supplier: z.string().trim().min(1),
    details: z.string().trim().min(1),
    proofLink: z.string().trim(),
    accountType: z.string().trim().min(1),
    division: z.string().trim().min(1),
    amount: z.coerce.number().positive(),
  })).min(1),
  notes: z.string().trim().optional(),
});

function failure(error: unknown) {
  return Response.json({
    error: 'PETTY_CASH_ERROR',
    message: error instanceof Error ? error.message : 'The Petty Cash operation failed.',
  }, { status: 500 });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  try {
    return dataResponse(await listPettyCashFromDatabase({
      role: (query.get('role') ?? 'staff') as PettyCashRole,
      userId: query.get('userId') ?? '',
      month: query.get('month') ?? undefined,
      includeAll: query.get('includeAll') === '1',
    }));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const parsed = pettyCashInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({
    error: 'INVALID_PETTY_CASH', message: 'Complete all required Petty Cash fields.', details: parsed.error.flatten(),
  }, { status: 400 });
  try {
    return dataResponse(await createPettyCashInDatabase(parsed.data as CreatePettyCashInput), { status: 201 });
  } catch (error) { return failure(error); }
}

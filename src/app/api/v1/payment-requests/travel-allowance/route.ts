import { z } from 'zod';

import {
  createTravelAllowanceInDatabase,
  listTravelAllowancesFromDatabase,
} from '@/data/payment-requests/travel-allowance/prisma-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const documentSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  dataUrl: z.string().min(1),
});

const lineSchema = z.object({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  employeeName: z.string().trim().min(1),
  travelDate: z.string().min(1),
  projectName: z.string().trim().min(1),
  isOtherProject: z.boolean(),
  reason: z.string().trim().min(1),
  meals: z.array(z.enum(['BREAKFAST', 'LUNCH', 'DINNER'])),
  specialAllowance: z.number().nonnegative(),
  specialAllowanceReason: z.string().trim().optional(),
});

const createSchema = z.object({
  organizationId: z.string().min(1),
  requestDate: z.string().min(1),
  requesterId: z.string().min(1),
  requesterName: z.string().trim().min(1),
  requesterRole: z.enum(['staff', 'manager']),
  requesterPosition: z.string().trim().min(1),
  contact: z.string().trim().min(1),
  managerApproverId: z.string().min(1).optional(),
  projectDirectorId: z.string().min(1),
  currency: z.literal('MYR'),
  lines: z.array(lineSchema).min(1).max(100),
  supportingDocuments: z.array(documentSchema).max(5),
  supportingDocumentLinks: z
  .array(z.string().url())
  .max(20)
  .optional(),
  remarks: z.string().trim().optional(),
});

function databaseError(error: unknown) {
  console.error('Travel Allowance database operation failed.', error);
  return Response.json(
    {
      error: 'TRAVEL_ALLOWANCE_DATABASE_ERROR',
      message: error instanceof Error ? error.message : 'The Travel Allowance database operation failed.',
    },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const userId = url.searchParams.get('userId');
    const month = url.searchParams.get('month') ?? undefined;
    const includeAll = url.searchParams.get('includeAll') === '1';
    const approvalOnly = url.searchParams.get('approvalOnly') === '1';
    const scope = (role === 'staff' || role === 'manager' || role === 'director' || role === 'finance') && userId
      ? { role, userId, month, includeAll, approvalOnly } as const
      : undefined;
    return dataResponse(await listTravelAllowancesFromDatabase(scope));
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_TRAVEL_ALLOWANCE',
        message: 'Complete all required Travel Allowance fields.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    return dataResponse(
      await createTravelAllowanceInDatabase(parsed.data),
      { status: 201 },
    );
  } catch (error) {
    return databaseError(error);
  }
}

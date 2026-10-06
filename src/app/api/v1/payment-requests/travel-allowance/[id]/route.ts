import { z } from 'zod';
import { getTravelAllowanceFromDatabase, resubmitTravelAllowanceInDatabase } from '@/data/payment-requests/travel-allowance/prisma-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const record = await getTravelAllowanceFromDatabase(decodeURIComponent(id));
    if (!record) {
      return Response.json(
        { error: 'TRAVEL_ALLOWANCE_NOT_FOUND', message: 'Travel Allowance could not be found.' },
        { status: 404 },
      );
    }
    return dataResponse(record);
  } catch (error) {
    console.error('Unable to read Travel Allowance from PostgreSQL.', error);
    return Response.json(
      {
        error: 'TRAVEL_ALLOWANCE_DATABASE_ERROR',
        message: error instanceof Error ? error.message : 'The Travel Allowance could not be loaded.',
      },
      { status: 500 },
    );
  }
}

const documentSchema = z.object({ id: z.string().min(1), fileName: z.string().min(1), mimeType: z.string(), size: z.number().int().nonnegative(), dataUrl: z.string().min(1) });
const lineSchema = z.object({ id: z.string().min(1), employeeId: z.string().min(1), employeeName: z.string().trim().min(1), travelDate: z.string().min(1), projectName: z.string().trim().min(1), isOtherProject: z.boolean(), reason: z.string().trim().min(1), meals: z.array(z.enum(['BREAKFAST', 'LUNCH', 'DINNER'])), specialAllowance: z.number().nonnegative(), specialAllowanceReason: z.string().trim().optional() });
const resubmitSchema = z.object({ organizationId: z.string().min(1), requestDate: z.string().min(1), requesterId: z.string().min(1), requesterName: z.string().trim().min(1), requesterRole: z.enum(['staff', 'manager']), requesterPosition: z.string().trim().min(1), contact: z.string().trim().min(1), managerApproverId: z.string().min(1).optional(), projectDirectorId: z.string().min(1), currency: z.literal('MYR'), lines: z.array(lineSchema).min(1).max(100), supportingDocuments: z.array(documentSchema).max(5), supportingDocumentLinks: z
  .array(z.string().url())
  .max(20)
  .optional(), remarks: z.string().trim().optional() });

export async function PATCH(request: Request, context: RouteContext) {
  const parsed = resubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'INVALID_TRAVEL_ALLOWANCE', message: 'Complete all required Travel Allowance fields.', details: parsed.error.flatten() }, { status: 400 });
  try { const { id } = await context.params; return dataResponse(await resubmitTravelAllowanceInDatabase(decodeURIComponent(id), parsed.data)); }
  catch (error) { return Response.json({ error: 'TRAVEL_ALLOWANCE_DATABASE_ERROR', message: error instanceof Error ? error.message : 'The Travel Allowance could not be resubmitted.' }, { status: 500 }); }
}

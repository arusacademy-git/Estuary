import { z } from 'zod';

import {
  createClaimInDatabase,
  getClaimPolicyContextFromDatabase,
  listClaimsFromDatabase,
  updateClaimDraftInDatabase,
} from '@/data/payment-requests/claims/prisma-repository';
import type { ClaimReceiptUpload, CreateClaimInput } from '@/domain/payment-requests/claims/types';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const lineSchema = z.object({
  id: z.string().trim().min(1),
  expenseDate: z.string(),
  supplier: z.string(),
  details: z.string(),
  receiptFileName: z.string(),
  receiptMimeType: z.string(),
  receiptFileSize: z.coerce.number().nonnegative(),
  receiptDocumentId: z.string().optional(),
  receiptLink: z.string().url().optional(),
  accountType: z.string(),
  division: z.string(),
  amount: z.coerce.number().nonnegative(),
  from: z.string(),
  to: z.string(),
  kilometers: z.coerce.number().nonnegative(),
});

const claimSchema = z.object({
  organizationId: z.string().trim().min(1),
  requesterId: z.string().trim().min(1),
  requesterName: z.string().trim().min(1),
  requesterPosition: z.string().trim().min(1),
  requesterRole: z.enum(['staff', 'manager', 'director', 'finance']),
  managerApproverId: z.string().trim().optional(),
  directorApproverId: z.string().trim().optional(),
  requesterContact: z.string(),
  claimDate: z.string().trim().min(1),
  claimType: z.enum(['EXPENSE', 'INTERNET_COMMUTE', 'MEDICAL', 'MILEAGE', 'PD', 'TECH']),
  techExtended: z.boolean(),
  lines: z.array(lineSchema).min(1),
  notes: z.string().trim().optional(),
});

function failure(error: unknown) {
  return Response.json({
    error: 'CLAIMS_ERROR',
    message: error instanceof Error ? error.message : 'The Claims operation failed.',
  }, { status: 500 });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const role = query.get('role');
  const userId = query.get('userId');
  if (role && userId) {
    try { return dataResponse(await listClaimsFromDatabase({ role, userId })); }
    catch (error) { return failure(error); }
  }
  const organizationId = query.get('organizationId') ?? '';
  const requesterId = query.get('requesterId') ?? '';
  const claimDate = query.get('claimDate') ?? '';
  if (!organizationId || !requesterId || !/^\d{4}-\d{2}-\d{2}$/.test(claimDate)) {
    return Response.json({ error: 'INVALID_CLAIMS_QUERY', message: 'Organization, claimant and claim date are required.' }, { status: 400 });
  }
  try {
    return dataResponse(await getClaimPolicyContextFromDatabase({ organizationId, requesterId, claimDate }));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const payload = form?.get('payload');
  const mode = form?.get('mode') === 'draft' ? 'draft' : 'submit';
  const claimId = typeof form?.get('claimId') === 'string' ? String(form?.get('claimId')) : '';
  let json: unknown = null;
  if (typeof payload === 'string') {
    try { json = JSON.parse(payload); }
    catch { json = null; }
  }
  const parsed = claimSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({
      error: 'INVALID_CLAIM',
      message: 'Complete all required claim fields.',
      details: parsed.error.flatten(),
    }, { status: 400 });
  }
  try {
    const input = parsed.data as CreateClaimInput;
    const uploads: ClaimReceiptUpload[] = [];
    for (const line of input.lines) {
      const value = form?.get(`receipt:${line.id}`);
      if (!(value instanceof File)) continue;
      uploads.push({
        lineId: line.id,
        fileName: value.name,
        mimeType: value.type as ClaimReceiptUpload['mimeType'],
        bytes: new Uint8Array(await value.arrayBuffer()),
      });
    }
    return dataResponse(claimId
      ? await updateClaimDraftInDatabase(claimId, input, uploads, mode)
      : await createClaimInDatabase(input, uploads, mode), { status: claimId ? 200 : 201 });
  } catch (error) { return failure(error); }
}

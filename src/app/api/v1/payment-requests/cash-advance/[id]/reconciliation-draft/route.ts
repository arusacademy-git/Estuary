import { z } from 'zod';

import { saveCashAdvanceReconciliationDraftInDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import type { CashAdvanceReconciliationInput } from '@/domain/payment-requests/cash-advance/types';
import { dataResponse } from '@/lib/api/response';

type Context = { params: Promise<{ id: string }> };

const draftSchema = z.object({
  requesterId: z.string().min(1),
  expenses: z.array(z.unknown()),
  includesParticipantAllowance: z.boolean(),
  participants: z.array(z.unknown()),
  participantProof: z.unknown().optional(),
  participantProofLink: z.string().optional(),
  balanceReturnDate: z.string().optional(),
  balanceReturnReference: z.string().optional(),
  balanceReturnProof: z.unknown().optional(),
  remarks: z.string().optional(),
});

export async function POST(request: Request, context: Context) {
  const parsed = draftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ message: 'The reconciliation draft could not be read.' }, { status: 400 });
  }
  try {
    const { id } = await context.params;
    return dataResponse(await saveCashAdvanceReconciliationDraftInDatabase(
      decodeURIComponent(id),
      parsed.data as unknown as CashAdvanceReconciliationInput,
    ));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : 'The reconciliation draft could not be saved.' }, { status: 409 });
  }
}

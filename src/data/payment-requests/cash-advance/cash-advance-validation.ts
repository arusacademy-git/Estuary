import { z } from 'zod';
import { CASH_ADVANCE_ACCOUNT_TYPES } from '@/domain/payment-requests/cash-advance/types';

const documentSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  dataUrl: z.string().min(1),
});

const requestLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
});

export const createCashAdvanceSchema = z.object({
  organizationId: z.string().min(1),
  requestDate: z.string().min(1),
  requesterId: z.string().min(1),
  requesterName: z.string().trim().min(1),
  requesterPosition: z.string().trim().min(1),
  requesterDepartment: z.string().trim().min(1),
  requesterContact: z.string().trim().min(1),
  accountHolderName: z.string().trim().min(1),
  bankName: z.string().trim().min(1),
  bankAccountNumber: z.string().trim().min(1),
  projectName: z.string().trim().min(1),
  isOtherProject: z.boolean(),
  managerApproverId: z.string().min(1),
  directorApproverId: z.string().min(1),
  purpose: z.string().trim().min(1),
  currency: z.literal('MYR'),
  lines: z.array(requestLineSchema).min(1).max(100),
  supportingDocuments: z.array(documentSchema).max(10),
  remarks: z.string().trim().optional(),
  staffSignatureKey: z.string().trim().min(1),
});

const expenseSchema = z.object({
  id: z.string().min(1),
  expenseDate: z.string().min(1),
  supplier: z.string().trim().min(1),
  description: z.string().trim().min(1),
  accountType: z.enum(CASH_ADVANCE_ACCOUNT_TYPES),
  division: z.string().trim().optional(),
  amount: z.coerce.number().positive(),
  receiptLink: z.string().trim().optional(),
  receipt: documentSchema.optional(),
});

export const reconciliationSchema = z.object({
  requesterId: z.string().min(1),
  expenses: z.array(expenseSchema).min(1).max(500),
  includesParticipantAllowance: z.boolean(),
  participants: z.array(z.object({
    id: z.string().min(1), participantName: z.string(), activity: z.string(), allowanceDate: z.string(), amount: z.coerce.number(),
  })).max(1000),
  participantProof: documentSchema.optional(),
  participantProofLink: z.string().url().optional(),
  balanceReturnDate: z.string().optional(),
  balanceReturnReference: z.string().trim().optional(),
  balanceReturnProof: documentSchema.optional(),
  remarks: z.string().trim().optional(),
});

export function cashAdvanceError(error: unknown, fallback: string) {
  console.error(fallback, error);
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes('could not be found')
    ? 404
    : message.includes('another') || message.includes('original Staff') || message.includes('not an active')
      ? 403
      : 409;
  return Response.json({ error: 'CASH_ADVANCE_OPERATION_FAILED', message }, { status });
}

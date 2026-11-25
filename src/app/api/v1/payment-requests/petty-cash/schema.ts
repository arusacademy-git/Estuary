import { z } from 'zod';

export const pettyCashInputSchema = z.object({
  organizationId: z.string().trim().min(1),
  requesterId: z.string().trim().min(1),
  requesterRole: z.enum(['staff', 'manager', 'director', 'finance']),
  requesterName: z.string().trim().min(1),
  requesterPosition: z.string().trim(),
  requesterContact: z.string().trim().min(1),
  requestDate: z.string().trim().min(1),
  location: z.enum(['PENANG', 'KUALA_LUMPUR']),
  managerApproverId: z.string().trim(),
  managerApproverIds: z.array(z.string().trim().min(1)).optional(),
  directorApproverId: z.string().trim(),
  financeReviewerId: z.string().trim().optional(),
  financeReviewerRole: z.enum(['manager', 'director', 'finance']).optional(),
  lines: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        expenseDate: z.string().trim().min(1),
        supplier: z.string().trim(),
        details: z.string().trim().min(1),
        proofLink: z.string().trim(),
        accountType: z.string().trim().min(1),
        division: z.string().trim().min(1),
        amount: z.coerce.number().positive(),
      })
    )
    .min(1),
  notes: z.string().trim().optional(),
});

import { z } from 'zod';

import {
  approveVoucher,
  exportVoucherBatchToLocalFolder,
  exportVoucherToLocalFolder,
  issueVoucher,
  markVoucherPaid,
  signVoucherByRecipient,
  verifyVoucher,
} from '@/data/prototype/prototype-state-repository';
import { dataResponse } from '@/lib/api/response';

const lineItemSchema = z.object({
  id: z.string(),
  accountCode: z.string(),
  description: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  taxCode: z.string(),
  taxAmount: z.string(),
});

const draftSchema = z.object({
  voucherNumber: z.string(),
  organizationName: z.string(),
  currentUserId: z.string(),
  approverId: z.string(),
  payeeName: z.string(),
  payeeEmail: z.string().email(),
  payeeIdentity: z.string(),
  amountInWords: z.string(),
  paymentDetails: z.string(),
  paymentModeCode: z.string(),
  bankName: z.string(),
  bankAccountNumber: z.string(),
  projectCode: z.string(),
  glCode: z.string(),
  paymentReference: z.string(),
  urgentBypass: z.boolean(),
  selfApprovalMode: z.string(),
  lineItems: z.array(lineItemSchema).min(1),
  amountsTaxInclusive: z.boolean(),
  showDescriptionColumn: z.boolean(),
  showTaxAmountColumn: z.boolean(),
  showFooters: z.boolean(),
});

const payloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('issue_voucher'),
    actorId: z.string(),
    draft: draftSchema,
  }),
  z.object({
    action: z.literal('approve_voucher'),
    actorId: z.string(),
    voucherId: z.string(),
    signatureText: z.string().min(2),
    note: z.string().default(''),
  }),
  z.object({
    action: z.literal('mark_paid'),
    actorId: z.string(),
    voucherId: z.string(),
    paidAt: z.string(),
    paymentReference: z.string().min(2),
    receiptLink: z.string().min(2),
    note: z.string().default(''),
  }),
  z.object({
    action: z.literal('recipient_sign'),
    token: z.string(),
    recipientName: z.string().min(2),
    signatureText: z.string().min(2),
    note: z.string().default(''),
  }),
  z.object({
    action: z.literal('verify_voucher'),
    actorId: z.string(),
    voucherId: z.string(),
    note: z.string().default(''),
  }),
  z.object({
    action: z.literal('export_voucher'),
    actorId: z.string(),
    voucherId: z.string(),
  }),
  z.object({
    action: z.literal('export_voucher_batch'),
    actorId: z.string(),
    voucherIds: z.array(z.string()).min(1),
  }),
]);

export async function POST(request: Request): Promise<Response> {
  const json = await request.json();
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      {
        error: 'Invalid workflow action payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const payload = parsed.data;

    if (payload.action === 'issue_voucher') {
      return dataResponse(await issueVoucher(payload.draft, payload.actorId));
    }

    if (payload.action === 'approve_voucher') {
      return dataResponse(
        await approveVoucher(
          payload.voucherId,
          payload.actorId,
          payload.signatureText,
          payload.note
        )
      );
    }

    if (payload.action === 'mark_paid') {
      return dataResponse(
        await markVoucherPaid(
          payload.voucherId,
          payload.actorId,
          payload.paidAt,
          payload.paymentReference,
          payload.receiptLink,
          payload.note
        )
      );
    }

    if (payload.action === 'recipient_sign') {
      return dataResponse(
        await signVoucherByRecipient(
          payload.token,
          payload.recipientName,
          payload.signatureText,
          payload.note
        )
      );
    }

    if (payload.action === 'verify_voucher') {
      return dataResponse(
        await verifyVoucher(payload.voucherId, payload.actorId, payload.note)
      );
    }

    if (payload.action === 'export_voucher') {
      return dataResponse(
        await exportVoucherToLocalFolder(payload.voucherId, payload.actorId)
      );
    }

    return dataResponse(
      await exportVoucherBatchToLocalFolder(payload.voucherIds, payload.actorId)
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Workflow action failed.',
      },
      { status: 400 }
    );
  }
}

import { z } from 'zod';

import { buildPaymentVoucherPdf } from '@/lib/prototype/payment-voucher-pdf';

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

export async function POST(request: Request): Promise<Response> {
  const json = await request.json();
  const parsedDraft = draftSchema.safeParse(json);

  if (!parsedDraft.success) {
    return Response.json(
      {
        error: 'Invalid payment-voucher draft payload.',
        details: parsedDraft.error.flatten(),
      },
      { status: 400 }
    );
  }

  const draft = parsedDraft.data;
  const pdfBytes = await buildPaymentVoucherPdf(draft);

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${draft.voucherNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

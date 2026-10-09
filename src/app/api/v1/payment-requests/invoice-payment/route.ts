import { z } from 'zod';
import { createInvoicePaymentInDatabase, listInvoicePaymentsFromDatabase } from '@/data/payment-requests/invoice-payment/prisma-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';
const document = z.object({ id: z.string().min(1), fileName: z.string().min(1), mimeType: z.string(), size: z.number().int().nonnegative(), dataUrl: z.string().min(1) });
const createSchema = z.object({ organizationId: z.string().min(1), requestDate: z.string().min(1), staffId: z.string().min(1), staffName: z.string().trim().min(1), projectName: z.string().trim().min(1), title: z.string().trim().min(1), purpose: z.string().trim().min(1), vendorName: z.string().trim().min(1), eInvoiceLink: z.string().url(), transferType: z.enum(['GIRO', 'INSTANT']), paymentPortion: z.enum(['UPFRONT_50', 'BALANCE_50', 'FULL', 'OTHER']), paymentPortionOther: z.string().optional(), managerApproverId: z.string().min(1), directorApproverId: z.string().min(1), currency: z.literal('MYR'), invoiceTotal: z.number().positive(), taxAmount: z.number().nonnegative(), requestedAmount: z.number().positive(), supportingDocuments: z.array(document).min(1).max(5), remarks: z.string().optional() });
const failure = (error: unknown) => Response.json({ error: 'INVOICE_PAYMENT_DATABASE_ERROR', message: error instanceof Error ? error.message : 'Invoice Payment database operation failed.' }, { status: 500 });

export async function GET(request: Request) {
  try { const url = new URL(request.url); const role = url.searchParams.get('role'); const userId = url.searchParams.get('userId'); const includeAll = url.searchParams.get('includeAll') === '1'; const approvalOnly = url.searchParams.get('approvalOnly') === '1'; const scope = (role === 'staff' || role === 'manager' || role === 'director' || role === 'finance') && userId ? { role, userId, includeAll, approvalOnly } as const : undefined; return dataResponse(await listInvoicePaymentsFromDatabase(scope)); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'INVALID_INVOICE_PAYMENT', message: 'Complete all required Invoice Payment fields.', details: parsed.error.flatten() }, { status: 400 });
  try { return dataResponse(await createInvoicePaymentInDatabase(parsed.data), { status: 201 }); } catch (error) { return failure(error); }
}

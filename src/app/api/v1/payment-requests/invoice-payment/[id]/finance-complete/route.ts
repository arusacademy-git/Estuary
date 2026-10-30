import { z } from 'zod';
import { completeInvoicePaymentByFinanceInDatabase, processInvoicePaymentByFinanceInDatabase, uploadInvoicePaymentProofByFinanceInDatabase } from '@/data/payment-requests/invoice-payment/prisma-repository';
import { dataResponse } from '@/lib/api/response';
type Context = { params: Promise<{ id: string }> };
const proof = z.object({ id: z.string().min(1), fileName: z.string().min(1), mimeType: z.string().min(1), size: z.number().int().positive().max(10 * 1024 * 1024), dataUrl: z.string().min(1) });
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('PROCESS_PAYMENT'), financeId: z.string().min(1), paymentDate: z.string().min(1), paymentReference: z.string().trim().min(1) }),
  z.object({ action: z.literal('UPLOAD_PROOF'), financeId: z.string().min(1), transactionProof: proof }),
  z.object({ action: z.literal('COMPLETE'), financeId: z.string().min(1) }),
]);
export async function POST(request: Request, context: Context) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ message: 'Provide the required Finance action details.' }, { status: 400 });
  try {
    const { id } = await context.params;
    const requestId = decodeURIComponent(id);
    if (body.data.action === 'PROCESS_PAYMENT') return dataResponse(await processInvoicePaymentByFinanceInDatabase(requestId, body.data.financeId, body.data.paymentDate, body.data.paymentReference));
    if (body.data.action === 'UPLOAD_PROOF') return dataResponse(await uploadInvoicePaymentProofByFinanceInDatabase(requestId, body.data.financeId, body.data.transactionProof));
    return dataResponse(await completeInvoicePaymentByFinanceInDatabase(requestId, body.data.financeId));
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : 'Finance verification failed.' }, { status: 409 }); }
}

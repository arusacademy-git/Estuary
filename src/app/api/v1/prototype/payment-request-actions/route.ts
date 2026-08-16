import { z } from 'zod';

import {
  approveDirectorPaymentRequest,
  approveManagerPaymentRequest,
  completePaymentRequest,
  processPaymentRequest,
  reconcileCashAdvance,
  resolveCashAdvanceChildren,
  submitPaymentRequest,
} from '@/data/prototype/payment-request-repository';
import { dataResponse } from '@/lib/api/response';

const payloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('submit_request'),
    requestId: z.string(),
    actorId: z.string(),
  }),
  z.object({
    action: z.literal('approve_manager'),
    requestId: z.string(),
    actorId: z.string(),
    note: z.string().default(''),
  }),
  z.object({
    action: z.literal('approve_director'),
    requestId: z.string(),
    actorId: z.string(),
    note: z.string().default(''),
  }),
  z.object({
    action: z.literal('process_payment'),
    requestId: z.string(),
    actorId: z.string(),
    paymentDate: z.string().min(4),
    paymentReference: z.string().min(2),
    receiptLink: z.string().min(2),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal('complete_request'),
    requestId: z.string(),
    actorId: z.string(),
    note: z.string().default(''),
  }),
  z.object({
    action: z.literal('reconcile_cash_advance'),
    requestId: z.string(),
    actorId: z.string(),
    note: z.string().min(2),
    childRequestIds: z.array(z.string()).optional(),
    pendingChildRequestIds: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal('resolve_cash_advance_children'),
    requestId: z.string(),
    actorId: z.string(),
    note: z.string().min(2),
    resolvedChildRequestIds: z.array(z.string()).min(1),
  }),
]);

export async function POST(request: Request): Promise<Response> {
  const json = await request.json();
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      {
        error: 'Invalid payment request action payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const payload = parsed.data;

    if (payload.action === 'submit_request') {
      return dataResponse(
        await submitPaymentRequest(payload.requestId, payload.actorId)
      );
    }

    if (payload.action === 'approve_manager') {
      return dataResponse(
        await approveManagerPaymentRequest(
          payload.requestId,
          payload.actorId,
          payload.note
        )
      );
    }

    if (payload.action === 'approve_director') {
      return dataResponse(
        await approveDirectorPaymentRequest(
          payload.requestId,
          payload.actorId,
          payload.note
        )
      );
    }

    if (payload.action === 'process_payment') {
      return dataResponse(await processPaymentRequest(payload));
    }

    if (payload.action === 'complete_request') {
      return dataResponse(
        await completePaymentRequest(
          payload.requestId,
          payload.actorId,
          payload.note
        )
      );
    }

    if (payload.action === 'reconcile_cash_advance') {
      return dataResponse(await reconcileCashAdvance(payload));
    }

    return dataResponse(await resolveCashAdvanceChildren(payload));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Payment request action failed.',
      },
      { status: 400 }
    );
  }
}

import { z } from "zod";

import { markPaymentVoucherInactiveInDatabase } from "@/data/payment-vouchers/prisma-payment-voucher-repository";
import { dataResponse } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({
  financeId: z.string().trim().min(1),
  remarks: z.string().trim().min(5).max(500),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_INACTIVE_INFORMATION", message: "Finance user and clear inactive remarks are required." },
      { status: 400 },
    );
  }
  try {
    const { id } = await context.params;
    return dataResponse(
      await markPaymentVoucherInactiveInDatabase(
        decodeURIComponent(id),
        parsed.data.financeId,
        parsed.data.remarks,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Payment Voucher could not be marked as inactive.";
    return Response.json(
      { error: "MARK_PAYMENT_VOUCHER_INACTIVE_FAILED", message },
      { status: message.includes("could not be found") ? 404 : message.includes("not an active Finance") ? 403 : message.includes("clear reason") ? 400 : 409 },
    );
  }
}

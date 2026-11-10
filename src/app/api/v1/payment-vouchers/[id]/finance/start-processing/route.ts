import { z } from "zod";

import { startPaymentVoucherFinanceProcessingInDatabase } from "@/data/payment-vouchers/prisma-payment-voucher-repository";
import { dataResponse } from "@/lib/api/response";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({ financeId: z.string().trim().min(1) });

export async function POST(request: Request, context: RouteContext) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_FINANCE_USER", message: "Finance user information is required." },
      { status: 400 },
    );
  }
  try {
    const { id } = await context.params;
    return dataResponse(
      await startPaymentVoucherFinanceProcessingInDatabase(
        decodeURIComponent(id),
        parsed.data.financeId,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finance processing could not be started.";
    return Response.json(
      { error: "START_FINANCE_PROCESSING_FAILED", message },
      { status: message.includes("could not be found") ? 404 : message.includes("not an active Finance") ? 403 : 409 },
    );
  }
}

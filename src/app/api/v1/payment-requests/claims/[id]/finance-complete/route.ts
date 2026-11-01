import { z } from "zod";
import { completeClaimByFinanceInDatabase } from "@/data/payment-requests/claims/prisma-repository";
import { dataResponse } from "@/lib/api/response";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ financeId: z.string().min(1) });

export async function POST(request: Request, context: Context) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ message: "Finance identity is required." }, { status: 400 });
  try {
    const { id } = await context.params;
    return dataResponse(await completeClaimByFinanceInDatabase(decodeURIComponent(id), body.data.financeId));
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Claim completion failed." }, { status: 409 });
  }
}

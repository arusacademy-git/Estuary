import { z } from "zod";

import { listProjectBudgetPositionsFromDatabase } from "@/data/projects/prisma-project-budget-position-repository";
import { dataResponse } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  organizationId: z.string().trim().min(1),
  actorId: z.string().trim().min(1),
  year: z.coerce.number().int().min(2000).max(2200),
});

function failure(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Project budget positions could not be calculated.";
  const status = message.includes("access is required") ? 403 : 500;
  return Response.json({ message }, { status });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    organizationId: query.get("organizationId"),
    actorId: query.get("actorId"),
    year: query.get("year"),
  });
  if (!parsed.success) {
    return Response.json(
      { message: "Organization, account and budget year are required." },
      { status: 400 },
    );
  }

  try {
    return dataResponse(
      await listProjectBudgetPositionsFromDatabase(
        parsed.data.organizationId,
        parsed.data.actorId,
        parsed.data.year,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

import { z } from "zod";

import { checkProjectBudgetFromDatabase } from "@/data/projects/prisma-project-budget-position-repository";
import { dataResponse } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    organizationId: z.string().trim().min(1),
    actorId: z.string().trim().min(1),
    year: z.number().int().min(2000).max(2200),
    allocations: z
        .array(
            z.object({
                projectReference: z.string().trim().min(1),
                amount: z.number().finite().positive(),
            }),
        )
        .max(200),
});

export async function POST(request: Request) {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return Response.json(
            { message: "Valid project allocations are required." },
            { status: 400 },
        );
    }
    try {
        return dataResponse(await checkProjectBudgetFromDatabase(parsed.data));
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Project budget availability could not be checked.";
        return Response.json(
            { message },
            { status: message.includes("access is required") ? 403 : 500 },
        );
    }
}

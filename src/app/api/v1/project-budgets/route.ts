import { z } from "zod";

import {
    listProjectBudgetsFromDatabase,
    replaceProjectBudgetsInDatabase,
} from "@/data/projects/prisma-project-budget-repository";
import { dataResponse } from "@/lib/api/response";

export const dynamic = "force-dynamic";

const yearSchema = z.coerce.number().int().min(2000).max(2200);
const identitySchema = z.object({
    organizationId: z.string().trim().min(1),
    actorId: z.string().trim().min(1),
    year: yearSchema,
});
const amountSchema = z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), {
        message: "Budget amounts must be non-negative with at most two decimals.",
    });
const replaceSchema = identitySchema.extend({
    budgets: z.array(
        z.object({
            projectId: z.string().trim().min(1),
            amount: amountSchema,
        }),
    ),
});

function failure(error: unknown) {
    const message =
        error instanceof Error ? error.message : "Project budget request failed.";
    const status = message === "Administration access is required." ? 403 : 500;
    return Response.json({ message }, { status });
}

export async function GET(request: Request) {
    const query = new URL(request.url).searchParams;
    const parsed = identitySchema.safeParse({
        organizationId: query.get("organizationId"),
        actorId: query.get("actorId"),
        year: query.get("year"),
    });
    if (!parsed.success) {
        return Response.json(
            { message: "Organization, administrator and budget year are required." },
            { status: 400 },
        );
    }

    try {
        return dataResponse(
            await listProjectBudgetsFromDatabase(
                parsed.data.organizationId,
                parsed.data.actorId,
                parsed.data.year,
            ),
        );
    } catch (error) {
        return failure(error);
    }
}

export async function PUT(request: Request) {
    const parsed = replaceSchema.safeParse(
        await request.json().catch(() => null),
    );
    if (!parsed.success) {
        return Response.json(
            {
                message: "The project budget request is incomplete.",
                details: parsed.error.flatten(),
            },
            { status: 400 },
        );
    }

    try {
        return dataResponse(await replaceProjectBudgetsInDatabase(parsed.data));
    } catch (error) {
        return failure(error);
    }
}

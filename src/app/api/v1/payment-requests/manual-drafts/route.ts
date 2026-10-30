import { z } from "zod";

import {
  deleteManualFormDraftFromDatabase,
  getManualFormDraft,
  listManualFormDrafts,
  saveManualFormDraftInDatabase,
} from "@/data/payment-requests/manual-drafts/prisma-repository";
import { MANUAL_DRAFT_TYPES } from "@/domain/payment-requests/manual-drafts/types";
import { dataResponse } from "@/lib/api/response";

export const dynamic = "force-dynamic";
const paymentType = z.enum(MANUAL_DRAFT_TYPES);
const failure = (error: unknown) =>
  Response.json(
    {
      error: "MANUAL_DRAFT_DATABASE_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Draft database operation failed.",
    },
    { status: 500 },
  );

export async function GET(request: Request) {
  const parsed = z
    .object({
      paymentType: paymentType.optional(),
      organizationId: z.string().min(1),
      requesterId: z.string().min(1),
    })
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return Response.json(
      {
        error: "INVALID_DRAFT_SCOPE",
        message: "Organization and requester are required.",
      },
      { status: 400 },
    );
  try {
    if (!parsed.data.paymentType) {
      return dataResponse(
        await listManualFormDrafts(
          parsed.data.organizationId,
          parsed.data.requesterId,
        ),
      );
    }
    return dataResponse(
      await getManualFormDraft(
        parsed.data.paymentType,
        parsed.data.organizationId,
        parsed.data.requesterId,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      requesterId: z.string().min(1),
      paymentType,
      snapshot: z.unknown(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        error: "INVALID_DRAFT",
        message: "Draft identity and snapshot are required.",
      },
      { status: 400 },
    );
  try {
    return dataResponse(await saveManualFormDraftInDatabase(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  const parsed = z
    .object({
      id: z.string().min(1),
      organizationId: z.string().min(1),
      requesterId: z.string().min(1),
    })
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return Response.json(
      {
        error: "INVALID_DRAFT_DELETE",
        message: "Draft, organization and requester IDs are required.",
      },
      { status: 400 },
    );
  try {
    return dataResponse({
      deleted: await deleteManualFormDraftFromDatabase(
        parsed.data.id,
        parsed.data.organizationId,
        parsed.data.requesterId,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}

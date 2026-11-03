import { Prisma } from "@prisma/client";

import type {
  ManualDraftType,
  ManualFormDraft,
  SaveManualFormDraftInput,
} from "@/domain/payment-requests/manual-drafts/types";
import { prisma } from "@/lib/db/prisma";

type Stored = Prisma.PaymentRequestDraftGetPayload<Record<string, never>>;

function map<T>(record: Stored): ManualFormDraft<T> {
  return {
    id: record.id,
    organizationId: record.organization_id,
    requesterId: record.requester_id,
    paymentType: record.payment_type as ManualDraftType,
    snapshot: record.snapshot_json as T,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}

export async function getManualFormDraft<T>(
  paymentType: ManualDraftType,
  organizationId: string,
  requesterId: string,
  id?: string,
) {
  const record = await prisma.paymentRequestDraft.findFirst({
    where: {
      ...(id ? { id } : {}),
      organization_id: organizationId,
      payment_type: paymentType,
      requester_id: requesterId,
    },
    orderBy: { updated_at: "desc" },
  });
  return record ? map<T>(record) : null;
}

export async function listManualFormDrafts<T>(
  organizationId: string,
  requesterId: string,
) {
  const records = await prisma.paymentRequestDraft.findMany({
    where: {
      organization_id: organizationId,
      requester_id: requesterId,
    },
    orderBy: { updated_at: "desc" },
  });
  return records.map((record) => map<T>(record));
}

export async function saveManualFormDraftInDatabase<T>(
  input: SaveManualFormDraftInput<T>,
) {
  const [organization, requester] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: input.requesterId },
      select: { id: true },
    }),
  ]);
  if (!organization || !requester)
    throw new Error("The organization or requester was not found.");
  if (input.id) {
    const updated = await prisma.paymentRequestDraft.updateMany({
      where: {
        id: input.id,
        organization_id: input.organizationId,
        requester_id: input.requesterId,
        payment_type: input.paymentType,
      },
      data: { snapshot_json: input.snapshot as Prisma.InputJsonValue },
    });
    if (updated.count === 0)
      throw new Error("The selected draft was not found for this requester.");
    const record = await prisma.paymentRequestDraft.findUnique({
      where: { id: input.id },
    });
    if (!record) throw new Error("The updated draft could not be loaded.");
    return map<T>(record);
  }

  const record = await prisma.paymentRequestDraft.create({
    data: {
      organization_id: input.organizationId,
      requester_id: input.requesterId,
      payment_type: input.paymentType,
      snapshot_json: input.snapshot as Prisma.InputJsonValue,
    },
  });
  return map<T>(record);
}

export async function deleteManualFormDraftFromDatabase(
  id: string,
  organizationId: string,
  requesterId: string,
) {
  const result = await prisma.paymentRequestDraft.deleteMany({
    where: { id, organization_id: organizationId, requester_id: requesterId },
  });
  return result.count > 0;
}

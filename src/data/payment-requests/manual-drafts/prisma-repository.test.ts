import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  getManualFormDraft,
  saveManualFormDraftInDatabase,
} from "./prisma-repository";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    paymentRequestDraft: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const input = {
  organizationId: "org-1",
  requesterId: "user-1",
  paymentType: "INVOICE_PAYMENT" as const,
  snapshot: { amount: 10 },
};

function stored(id: string) {
  return {
    id,
    organization_id: input.organizationId,
    requester_id: input.requesterId,
    payment_type: input.paymentType,
    snapshot_json: input.snapshot,
    created_at: new Date("2026-11-03T01:00:00Z"),
    updated_at: new Date("2026-11-03T01:00:00Z"),
  } as never;
}

describe("manual draft identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: input.organizationId } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: input.requesterId } as never);
  });

  it("creates a new draft when no ID is supplied", async () => {
    vi.mocked(prisma.paymentRequestDraft.create).mockResolvedValue(stored("draft-1"));

    await expect(saveManualFormDraftInDatabase(input)).resolves.toMatchObject({ id: "draft-1" });
    expect(prisma.paymentRequestDraft.create).toHaveBeenCalledWith({
      data: {
        organization_id: "org-1",
        requester_id: "user-1",
        payment_type: "INVOICE_PAYMENT",
        snapshot_json: { amount: 10 },
      },
    });
    expect(prisma.paymentRequestDraft.update).not.toHaveBeenCalled();
  });

  it("updates only the selected draft in the same scope", async () => {
    vi.mocked(prisma.paymentRequestDraft.update).mockResolvedValue(stored("draft-2"));

    await expect(saveManualFormDraftInDatabase({ ...input, id: "draft-2" })).resolves.toMatchObject({ id: "draft-2" });
    expect(prisma.paymentRequestDraft.update).toHaveBeenCalledWith({
      where: {
        id: "draft-2",
        organization_id: "org-1",
        requester_id: "user-1",
        payment_type: "INVOICE_PAYMENT",
      },
      data: { snapshot_json: { amount: 10 } },
    });
    expect(prisma.paymentRequestDraft.create).not.toHaveBeenCalled();
  });

  it("loads the selected draft by ID and requester scope", async () => {
    vi.mocked(prisma.paymentRequestDraft.findFirst).mockResolvedValue(stored("draft-2"));

    await expect(getManualFormDraft("INVOICE_PAYMENT", "org-1", "user-1", "draft-2")).resolves.toMatchObject({ id: "draft-2" });
    expect(prisma.paymentRequestDraft.findFirst).toHaveBeenCalledWith({
      where: {
        id: "draft-2",
        organization_id: "org-1",
        requester_id: "user-1",
        payment_type: "INVOICE_PAYMENT",
      },
      orderBy: { updated_at: "desc" },
    });
  });
});

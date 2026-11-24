import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BetaAccount } from "@/lib/auth/beta-accounts";
import {
  fetchDirectorDashboardSummary,
  fetchManagerDashboardSummary,
} from "./api";
import { fetchDirectorDashboard } from "./director-dashboard-api";
import { fetchManagerDashboard } from "./manager-dashboard-api";

vi.mock("./api", () => ({
  fetchDirectorDashboardSummary: vi.fn(),
  fetchManagerDashboardSummary: vi.fn(),
}));

const summary = {
  id: "request-1",
  reference: "INV26-11-01",
  paymentType: "INVOICE_PAYMENT" as const,
  requesterId: "staff-1",
  requesterName: "Staff User",
  status: "PENDING_DIRECTOR_APPROVAL",
  amount: 125,
  submittedAt: "2026-11-23T00:00:00.000Z",
  updatedAt: "2026-11-24T00:00:00.000Z",
  projectCode: "PROGRAMME",
  projectName: "Programme",
  approverIds: [],
  managerViewed: true,
  claimManagerPreviewed: false,
  claimDirectorPreviewed: false,
  recipientLinkIssued: false,
};

const manager: BetaAccount = {
  id: "manager-1",
  name: "Manager User",
  email: "manager@example.com",
  position: "Manager",
  department: "Programme",
  role: "manager",
};

const director: BetaAccount = {
  id: "director-1",
  name: "Director User",
  email: "director@example.com",
  position: "Director",
  department: "Leadership",
  role: "director",
};

describe("role-specific dashboard APIs", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses only the manager summary API and manager record route", async () => {
    vi.mocked(fetchManagerDashboardSummary).mockResolvedValue([summary]);

    const result = await fetchManagerDashboard(manager);

    expect(fetchManagerDashboardSummary).toHaveBeenCalledWith(manager.id);
    expect(fetchDirectorDashboardSummary).not.toHaveBeenCalled();
    expect(result.records[0].href).toBe(
      "/beta/payment-records/invoice-payments/request-1",
    );
  });

  it("uses only the director summary API and director approval route", async () => {
    vi.mocked(fetchDirectorDashboardSummary).mockResolvedValue([summary]);

    const result = await fetchDirectorDashboard(director);

    expect(fetchDirectorDashboardSummary).toHaveBeenCalledWith(director.id);
    expect(fetchManagerDashboardSummary).not.toHaveBeenCalled();
    expect(result.records[0].href).toBe(
      "/beta/director/payment-requests/invoice-payments/request-1",
    );
  });
});

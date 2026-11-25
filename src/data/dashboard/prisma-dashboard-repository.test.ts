import { describe, expect, it } from "vitest";

import { dashboardRoleWhere } from "./prisma-dashboard-repository";

describe("dashboard role visibility", () => {
  it("limits Staff to their own submissions", () => {
    expect(dashboardRoleWhere({ role: "staff", userId: "staff-1" })).toEqual({
      submitted_by_id: "staff-1",
    });
  });

  it("limits a project Manager to assigned and self-submitted records", () => {
    expect(
      dashboardRoleWhere({ role: "manager", userId: "manager-1" }),
    ).toEqual({
      OR: [
        { current_assignee_id: "manager-1" },
        { approval_steps: { some: { assigned_user_id: "manager-1" } } },
        { submitted_by_id: "manager-1" },
      ],
    });
  });

  it("gives a Director organization-wide dashboard visibility", () => {
    expect(
      dashboardRoleWhere({ role: "director", userId: "director-1" }),
    ).toEqual({});
  });
});

import { describe, expect, it } from "vitest";

import { validateTravelAllowance } from "./validation";

const line = {
  id: "line-1",
  employeeId: "employee-1",
  employeeName: "Afiq Rahman",
  travelDate: "2026-11-28",
  projectName: "V-KARISMA-YH",
  isOtherProject: false,
  reason: "Cohort workshop",
  meals: ["LUNCH" as const],
  specialAllowance: 0,
};

const input = {
  requestMode: "staff" as const,
  requestDate: "2026-11-27",
  contact: "0123456789",
  managerApproverId: "manager-1",
  projectDirectorId: "director-1",
  lines: [line],
  availableProjects: ["V-KARISMA-YH"],
  isDirector: false,
  assignedManagerCount: 1,
};

describe("validateTravelAllowance", () => {
  it("accepts a complete request", () => {
    expect(validateTravelAllowance(input)).toEqual({});
  });

  it("requires a new date when a duplicated entry resets its date", () => {
    const errors = validateTravelAllowance({
      ...input,
      lines: [{ ...line, id: "line-2", travelDate: "" }],
    });
    expect(errors.lines?.["line-2"]?.travelDate).toBeTruthy();
  });

  it("allows different projects when they remain available to the requester", () => {
    const errors = validateTravelAllowance({
      ...input,
      lines: [line, { ...line, id: "line-2", projectName: "P-BJCK-ARUS" }],
      availableProjects: ["V-KARISMA-YH", "P-BJCK-ARUS"],
    });
    expect(errors.lines).toBeUndefined();
  });
});

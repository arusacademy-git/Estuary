import {
  hasValidationErrors,
  nonNegativeNumber,
  requiredText,
  validDate,
} from "@/domain/validation/common-validation";
import type { TravelAllowanceLine } from "./types";

export type TravelAllowanceLineValidationErrors = {
  employeeId?: string;
  travelDate?: string;
  projectName?: string;
  reason?: string;
  allowance?: string;
  specialAllowance?: string;
  specialAllowanceReason?: string;
};

export type TravelAllowanceValidationErrors = {
  requestDate?: string;
  contact?: string;
  managerApproverId?: string;
  projectDirectorId?: string;
  lines?: Record<string, TravelAllowanceLineValidationErrors>;
};

export type TravelAllowanceValidationInput = {
  requestMode: "staff" | "manager";
  requestDate: string;
  contact: string;
  managerApproverId: string;
  projectDirectorId: string;
  lines: TravelAllowanceLine[];
  availableProjects: readonly string[];
  isDirector: boolean;
  assignedManagerCount: number;
};

export function validateTravelAllowance(
  input: TravelAllowanceValidationInput,
): TravelAllowanceValidationErrors {
  const errors: TravelAllowanceValidationErrors = {
    requestDate: validDate(input.requestDate, "Request date"),
    contact: requiredText(input.contact, "Contact"),
    projectDirectorId: requiredText(
      input.projectDirectorId,
      "Project Director",
    ),
  };

  if (input.requestMode === "staff") {
    errors.managerApproverId =
      input.assignedManagerCount > 1
        ? "The selected projects have different managers. Submit separate requests per project manager."
        : input.assignedManagerCount === 0
          ? "Assign a manager to the selected project in Settings first."
          : requiredText(input.managerApproverId, "Manager reviewer");
  }

  const lineErrors: Record<string, TravelAllowanceLineValidationErrors> = {};
  input.lines.forEach((line, index) => {
    const projectError = requiredText(
      line.projectName,
      `Entry ${index + 1} project name`,
    );
    const current: TravelAllowanceLineValidationErrors = {
      employeeId: requiredText(
        line.employeeId,
        `Entry ${index + 1} employee name`,
      ),
      travelDate: validDate(line.travelDate, `Entry ${index + 1} travel date`),
      projectName:
        projectError ??
        (!input.isDirector &&
        !input.availableProjects.includes(line.projectName)
          ? "Choose a project assigned to this requester."
          : undefined),
      reason: requiredText(
        line.reason,
        `Entry ${index + 1} reason for meal allowance`,
      ),
      allowance:
        line.meals.length || line.specialAllowance > 0
          ? undefined
          : "Select at least one meal or enter a special allowance.",
      specialAllowance: nonNegativeNumber(
        line.specialAllowance,
        `Entry ${index + 1} special allowance`,
      ),
      specialAllowanceReason:
        line.specialAllowance > 0
          ? requiredText(
              line.specialAllowanceReason,
              `Entry ${index + 1} special allowance reason`,
            )
          : undefined,
    };
    if (hasValidationErrors(current)) lineErrors[line.id] = current;
  });

  if (!input.lines.length) {
    errors.lines = {
      request: { employeeId: "Add at least one travel entry." },
    };
  } else if (Object.keys(lineErrors).length) {
    errors.lines = lineErrors;
  }

  return errors;
}

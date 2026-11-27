import {
  hasValidationErrors,
  positiveNumber,
  requiredText,
  validDate,
} from "@/domain/validation/common-validation";
import { bankAccountNumberError } from "@/shared/payment-identity-validation";
import { cashAdvanceRequestedTotal } from "./policy";
import type { CashAdvanceRequestLine } from "./types";

const CASH_ADVANCE_MINIMUM_AMOUNT = 300;

export type CashAdvanceLineValidationErrors = {
  description?: string;
  purpose?: string;
  amount?: string;
};

export type CashAdvanceValidationErrors = {
  requestDate?: string;
  contact?: string;
  projectName?: string;
  otherProject?: string;
  managerId?: string;
  directorId?: string;
  purpose?: string;
  accountHolderName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  lines?: Record<string, CashAdvanceLineValidationErrors>;
  total?: string;
};

export type CashAdvanceValidationInput = {
  requestDate: string;
  contact: string;
  projectName: string;
  otherProject: string;
  isOtherProject: boolean;
  managerId: string;
  directorId: string;
  purpose: string;
  accountHolderName: string;
  bankName: string;
  bankAccountNumber: string;
  lines: CashAdvanceRequestLine[];
};

export function validateCashAdvance(
  input: CashAdvanceValidationInput,
): CashAdvanceValidationErrors {
  const errors: CashAdvanceValidationErrors = {
    requestDate: validDate(input.requestDate, "Request date"),
    contact: requiredText(input.contact, "Contact"),
    projectName: input.isOtherProject
      ? undefined
      : requiredText(input.projectName, "Project name"),
    otherProject: input.isOtherProject
      ? requiredText(input.otherProject, "Other project name")
      : undefined,
    managerId: requiredText(input.managerId, "Manager approver"),
    directorId: requiredText(input.directorId, "Director approver"),
    purpose: requiredText(input.purpose, "Purpose of Cash Advance"),
    accountHolderName: requiredText(
      input.accountHolderName,
      "Account holder name",
    ),
    bankName: requiredText(input.bankName, "Bank name"),
    bankAccountNumber:
      requiredText(input.bankAccountNumber, "Account number") ??
      (bankAccountNumberError(input.bankName, input.bankAccountNumber) ||
        undefined),
  };

  const lineErrors: Record<string, CashAdvanceLineValidationErrors> = {};
  input.lines.forEach((line, index) => {
    const current: CashAdvanceLineValidationErrors = {
      description: requiredText(
        line.description,
        `Expense ${index + 1} description`,
      ),
      purpose: requiredText(line.purpose, `Expense ${index + 1} purpose`),
      amount: positiveNumber(line.amount, `Expense ${index + 1} amount`),
    };
    if (hasValidationErrors(current)) lineErrors[line.id] = current;
  });
  if (Object.keys(lineErrors).length) errors.lines = lineErrors;

  if (!input.lines.length) {
    errors.total = "Add at least one requested expense.";
  } else {
    const total = cashAdvanceRequestedTotal(input.lines);
    if (total < CASH_ADVANCE_MINIMUM_AMOUNT) {
      errors.total = `Cash Advance requests must be at least RM ${CASH_ADVANCE_MINIMUM_AMOUNT.toFixed(2)}.`;
    }
  }

  return errors;
}

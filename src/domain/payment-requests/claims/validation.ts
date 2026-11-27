import {
  hasValidationErrors,
  positiveNumber,
  requiredText,
  validDate,
  validHttpUrl,
} from "@/domain/validation/common-validation";
import { claimLimit, claimTotal } from "./policy";
import type { ClaimLine, ClaimPolicyContext, ClaimType } from "./types";

export type ClaimLineValidationErrors = {
  expenseDate?: string;
  supplier?: string;
  details?: string;
  receipt?: string;
  accountType?: string;
  division?: string;
  amount?: string;
  from?: string;
  to?: string;
  kilometers?: string;
};

export type ClaimValidationErrors = {
  claimDate?: string;
  contact?: string;
  directorId?: string;
  entries?: string;
  total?: string;
  confirmed?: string;
};

export function validateClaimLine(
  claimType: ClaimType,
  line: ClaimLine,
  hasUploadedReceipt: boolean,
): ClaimLineValidationErrors {
  const errors: ClaimLineValidationErrors = {
    expenseDate: validDate(line.expenseDate, "Date"),
    details: requiredText(line.details, "Description and purpose"),
  };

  if (claimType === "MILEAGE") {
    errors.division = requiredText(line.division, "Project name");
    errors.from = requiredText(line.from, "Starting point");
    errors.to = requiredText(line.to, "Destination");
    errors.kilometers = positiveNumber(line.kilometers, "Total distance");
    return errors;
  }

  errors.supplier = requiredText(line.supplier, "Supplier or merchant");
  errors.amount = positiveNumber(line.amount, "Amount");
  if (claimType === "EXPENSE") {
    errors.accountType = requiredText(line.accountType, "Type of account");
    errors.division = requiredText(line.division, "Project name");
  }

  const hasStoredReceipt = Boolean(
    line.receiptDocumentId ||
    (line.receiptFileName.trim() && line.receiptFileSize > 0),
  );
  if (!hasUploadedReceipt && !hasStoredReceipt && !line.receiptLink?.trim()) {
    errors.receipt = "Receipt or proof is required.";
  } else if (line.receiptLink?.trim()) {
    errors.receipt = validHttpUrl(line.receiptLink, "Receipt link");
  }

  return errors;
}

export function validateClaimRequest(input: {
  claimDate: string;
  contact: string;
  directorId: string;
  requesterId: string;
  claimType: ClaimType;
  techExtended: boolean;
  lines: ClaimLine[];
  context: ClaimPolicyContext;
  confirmed: boolean;
}): ClaimValidationErrors {
  const errors: ClaimValidationErrors = {
    claimDate: validDate(input.claimDate, "Claim date"),
    contact: requiredText(input.contact, "Contact details"),
    directorId:
      requiredText(input.directorId, "Final approving Director") ??
      (input.directorId === input.requesterId
        ? "Choose a Director other than the claimant."
        : undefined),
    entries: input.lines.length ? undefined : "Add at least one claim item.",
    confirmed: input.confirmed
      ? undefined
      : "Confirm that the claim and supporting documents are accurate.",
  };

  if (input.claimType === "TECH" && input.context.techExtendedLockedUntil) {
    errors.total = `Tech claims are unavailable until ${input.context.techExtendedLockedUntil}.`;
  } else if (input.lines.length) {
    const total = claimTotal(input.claimType, input.lines);
    if (total <= 0) {
      errors.total = "The claim total must be greater than RM0.00.";
    } else {
      const limit = claimLimit(input, input.context);
      if (limit !== null && total > limit) {
        errors.total = `The claim exceeds the available RM${limit.toFixed(2)} policy limit.`;
      }
    }
  }

  return errors;
}

export { hasValidationErrors };

import {
    hasValidationErrors,
    positiveNumber,
    requiredText,
    validDate,
} from "@/domain/validation/common-validation";
import { PETTY_CASH_REQUEST_LIMIT, pettyCashTotal } from "./policy";
import type { PettyCashRequestLine, PettyCashRole } from "./types";

export type PettyCashLineValidationErrors = {
    details?: string;
    accountType?: string;
    division?: string;
    amount?: string;
};

export type PettyCashValidationErrors = {
    requestDate?: string;
    contact?: string;
    managerId?: string;
    directorId?: string;
    financeReviewerId?: string;
    lines?: Record<string, PettyCashLineValidationErrors>;
    total?: string;
    confirmed?: string;
};

export type PettyCashValidationInput = {
    requesterRole: PettyCashRole;
    requestDate: string;
    contact: string;
    managerId: string;
    directorId: string;
    financeReviewerId: string;
    lines: PettyCashRequestLine[];
    confirmed: boolean;
};

export function validatePettyCash(
    input: PettyCashValidationInput,
): PettyCashValidationErrors {
    const errors: PettyCashValidationErrors = {
        requestDate: validDate(input.requestDate, "Request date"),
        contact: requiredText(input.contact, "Contact"),
        managerId:
            input.requesterRole === "staff"
                ? requiredText(input.managerId, "Manager reviewer")
                : undefined,
        directorId:
            input.requesterRole === "staff" || input.requesterRole === "manager"
                ? requiredText(input.directorId, "Director previewer")
                : undefined,
        financeReviewerId:
            input.requesterRole === "finance"
                ? requiredText(input.financeReviewerId, "Independent previewer")
                : undefined,
        confirmed: input.confirmed
            ? undefined
            : "Confirm that the planned expenses and estimated amounts are accurate.",
    };

    const lineErrors: Record<string, PettyCashLineValidationErrors> = {};
    input.lines.forEach((line, index) => {
        const current: PettyCashLineValidationErrors = {
            details: requiredText(line.details, `Expense ${index + 1} details`),
            accountType: requiredText(
                line.accountType,
                `Expense ${index + 1} account type`,
            ),
            division: requiredText(line.division, `Expense ${index + 1} project name`),
            amount: positiveNumber(line.amount, `Expense ${index + 1} amount`),
        };
        if (hasValidationErrors(current)) lineErrors[line.id] = current;
    });
    if (Object.keys(lineErrors).length) errors.lines = lineErrors;

    if (!input.lines.length) {
        errors.total = "Add at least one planned expense.";
    } else {
        const total = pettyCashTotal(input.lines);
        if (total >= PETTY_CASH_REQUEST_LIMIT) {
            errors.total = `Petty Cash requests must be below RM ${PETTY_CASH_REQUEST_LIMIT.toFixed(2)}.`;
        }
    }

    return errors;
}

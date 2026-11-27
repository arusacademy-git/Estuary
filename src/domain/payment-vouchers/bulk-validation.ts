import { betaAccounts } from "@/lib/auth/beta-accounts";
import {
    nonNegativeNumber,
    requiredText,
    validDate,
    validEmail,
} from "@/domain/validation/common-validation";
import { validatePaymentVoucher } from "@/domain/payment-vouchers/validation";
import {
    calculateBulkPaymentVoucherAmount,
    type BulkPaymentVoucherField,
    type BulkPaymentVoucherRow,
    type BulkRowValidationResult,
    type BulkValidationError,
} from "@/domain/payment-vouchers/bulk-upload";

function parseNumber(value: string) {
    const normalized = value
        .replace(/,/g, "")
        .replace(/^RM\s*/i, "")
        .trim();
    return normalized ? Number(normalized) : Number.NaN;
}

function addError(
    errors: BulkValidationError[],
    field: BulkPaymentVoucherField,
    message?: string,
) {
    if (message) errors.push({ field, message });
}

function accountEmailError(
    value: string,
    role: "director" | "manager",
    label: string,
) {
    if (!value.trim())
        return role === "director" ? `${label} is required.` : undefined;
    const emailError = validEmail(value, `${label} email`);
    if (emailError) return emailError;
    const exists = betaAccounts.some(
        (account) =>
            account.role === role &&
            account.email.toLowerCase() === value.trim().toLowerCase(),
    );
    return exists
        ? undefined
        : `${label} email does not match a ${label} account.`;
}

export function validateBulkPaymentVoucherRow(
    row: BulkPaymentVoucherRow,
): BulkRowValidationResult {
    const errors: BulkValidationError[] = [];
    const quantity = parseNumber(row.quantity);
    const unitAmount = parseNumber(row.unitAmount);
    const taxAmount = parseNumber(row.taxAmount);

    const sharedErrors = validatePaymentVoucher({
        pvDate: row.pvDate,
        recipientName: row.recipientName,
        recipientEmail: row.recipientEmail,
        recipientIdentity: row.recipientIc,
        project: row.division,
        assignedDirector: row.directorEmail,
        paymentMethod: row.paymentMethod,
        bankName: row.bankName,
        bankAccountNumber: row.bankAccountNumber,
        purpose: row.purpose,
        lines: [
            {
                id: row.rowId,
                account: row.accountCode,
                description: row.lineDescription,
                quantity,
                unitPrice: unitAmount,
            },
        ],
    });

    addError(errors, "pvDate", validDate(row.pvDate, "PV date"));
    addError(errors, "recipientName", sharedErrors.recipientName);
    addError(errors, "recipientEmail", sharedErrors.recipientEmail);
    addError(errors, "recipientIc", sharedErrors.recipientIdentity);
    addError(errors, "division", sharedErrors.project);
    addError(
        errors,
        "directorEmail",
        accountEmailError(row.directorEmail, "director", "Director"),
    );
    addError(
        errors,
        "projectManagerEmail",
        accountEmailError(row.projectManagerEmail, "manager", "Manager"),
    );
    addError(
        errors,
        "recipientIsMalaysian",
        requiredText(row.recipientIsMalaysian, "Recipient nationality"),
    );
    addError(
        errors,
        "paymentMethod",
        requiredText(row.paymentMethod, "Payment method"),
    );
    addError(errors, "bankName", sharedErrors.bankName);
    addError(errors, "bankAccountNumber", sharedErrors.bankAccountNumber);
    addError(errors, "purpose", sharedErrors.purpose);

    const lineErrors = sharedErrors.lines?.[row.rowId];
    addError(errors, "accountCode", lineErrors?.account);
    addError(errors, "lineDescription", lineErrors?.description);
    addError(errors, "quantity", lineErrors?.quantity);
    addError(errors, "unitAmount", lineErrors?.unitPrice);
    addError(errors, "taxAmount", nonNegativeNumber(taxAmount, "Tax amount"));

    const amount = calculateBulkPaymentVoucherAmount(row);
    return {
        rowId: row.rowId,
        isValid: errors.length === 0,
        amount,
        errors,
    };
}

export function validateBulkPaymentVoucherRows(rows: BulkPaymentVoucherRow[]) {
    return rows.map(validateBulkPaymentVoucherRow);
}

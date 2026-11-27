import {
    hasValidationErrors,
    positiveNumber,
    requiredText,
    validEmail,
} from "@/domain/validation/common-validation";
import {
    bankAccountNumberError,
    identificationNumberError,
} from "@/shared/payment-identity-validation";

export type PaymentVoucherLineValidationErrors = {
    account?: string;
    description?: string;
    quantity?: string;
    unitPrice?: string;
};

export type PaymentVoucherValidationErrors = {
    pvDate?: string;
    recipientName?: string;
    recipientEmail?: string;
    recipientIdentity?: string;
    project?: string;
    assignedDirector?: string;
    bankName?: string;
    bankAccountNumber?: string;
    purpose?: string;
    lines?: Record<string, PaymentVoucherLineValidationErrors>;
};

export type PaymentVoucherValidationInput = {
    pvDate: string;
    recipientName: string;
    recipientEmail: string;
    recipientIdentity: string;
    project: string;
    assignedDirector: string;
    paymentMethod: string;
    bankName: string;
    bankAccountNumber: string;
    purpose: string;
    lines: Array<{
        id: string;
        account: string;
        description: string;
        quantity: number;
        unitPrice: number;
    }>;
};

export function validatePaymentVoucher(
    input: PaymentVoucherValidationInput,
): PaymentVoucherValidationErrors {
    const errors: PaymentVoucherValidationErrors = {
        pvDate: requiredText(input.pvDate, "PV date"),
        recipientName: requiredText(input.recipientName, "Recipient name"),
        recipientEmail: validEmail(input.recipientEmail, "Recipient email"),
        recipientIdentity:
            requiredText(input.recipientIdentity, "IC / identity number") ??
            (identificationNumberError(input.recipientIdentity) || undefined),
        project: requiredText(input.project, "Project Name"),
        assignedDirector: requiredText(input.assignedDirector, "Assigned Director"),
        purpose: requiredText(input.purpose, "Purpose of payment"),
    };

    if (input.paymentMethod === "Bank Transfer") {
        errors.bankName = requiredText(input.bankName, "Bank name");
        errors.bankAccountNumber =
            requiredText(input.bankAccountNumber, "Bank account number") ??
            (bankAccountNumberError(input.bankName, input.bankAccountNumber) ||
                undefined);
    }

    const lineErrors: Record<string, PaymentVoucherLineValidationErrors> = {};
    input.lines.forEach((line, index) => {
        const current: PaymentVoucherLineValidationErrors = {
            account: requiredText(line.account, `Line ${index + 1} account`),
            description: requiredText(
                line.description,
                `Line ${index + 1} description`,
            ),
            quantity: positiveNumber(line.quantity, `Line ${index + 1} quantity`),
            unitPrice: positiveNumber(line.unitPrice, `Line ${index + 1} unit price`),
        };
        if (hasValidationErrors(current)) lineErrors[line.id] = current;
    });
    if (Object.keys(lineErrors).length) errors.lines = lineErrors;
    return errors;
}

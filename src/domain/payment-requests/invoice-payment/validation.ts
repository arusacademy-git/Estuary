import {
  positiveNumber,
  requiredText,
  validDate,
  validHttpUrl,
} from "@/domain/validation/common-validation";

export type InvoicePaymentValidationErrors = {
  requestDate?: string;
  projectName?: string;
  otherProjectName?: string;
  purpose?: string;
  vendorName?: string;
  eInvoiceLink?: string;
  transferType?: string;
  paymentPortion?: string;
  paymentPortionOther?: string;
  managerApproverId?: string;
  directorApproverId?: string;
  invoiceTotal?: string;
  requestedAmount?: string;
};

export type InvoicePaymentValidationInput = {
  requestDate: string;
  projectSelection: string;
  projectName: string;
  otherProjectName: string;
  purpose: string;
  vendorName: string;
  eInvoiceLink: string;
  transferType: string;
  paymentPortion: string;
  paymentPortionOther: string;
  managerApproverId: string;
  directorApproverId: string;
  invoiceTotal: number;
  requestedAmount: number;
};

export function validateInvoicePayment(
  input: InvoicePaymentValidationInput,
): InvoicePaymentValidationErrors {
  const errors: InvoicePaymentValidationErrors = {
    requestDate: validDate(input.requestDate, "Request date"),
    projectName: requiredText(input.projectSelection, "Project name"),
    purpose: requiredText(input.purpose, "Purpose of payment"),
    vendorName: requiredText(input.vendorName, "Contractor / Vendor name"),
    eInvoiceLink: validHttpUrl(input.eInvoiceLink, "E-invoice link"),
    transferType: requiredText(input.transferType, "Transfer type"),
    paymentPortion: requiredText(input.paymentPortion, "Payment portion"),
    managerApproverId: requiredText(input.managerApproverId, "Project manager"),
    directorApproverId: requiredText(
      input.directorApproverId,
      "Director reviewer",
    ),
    invoiceTotal: positiveNumber(input.invoiceTotal, "Invoice total"),
  };

  if (input.projectSelection === "OTHER") {
    errors.otherProjectName = requiredText(
      input.otherProjectName,
      "Other project name",
    );
  } else if (input.projectSelection && !input.projectName.trim()) {
    errors.projectName = "Project name is required.";
  }

  if (input.paymentPortion === "OTHER") {
    errors.paymentPortionOther = requiredText(
      input.paymentPortionOther,
      "Other payment portion",
    );
    errors.requestedAmount = positiveNumber(
      input.requestedAmount,
      "Amount requested",
    );
    if (
      !errors.requestedAmount &&
      Number.isFinite(input.invoiceTotal) &&
      input.requestedAmount > input.invoiceTotal
    ) {
      errors.requestedAmount =
        "Amount requested cannot exceed the invoice total.";
    }
  }

  return errors;
}

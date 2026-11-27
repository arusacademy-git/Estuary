"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { FormEvent } from "react";

import { readBetaSession } from "@/lib/auth/beta-accounts";
import { amountToMalayWords } from "@/lib/currency/amount-words";

import {
  BANK_NAME_OPTIONS as bankNameOptions,
  DEFAULT_PAYMENT_VOUCHER_ACCOUNT_CODE,
  DIVISION_LABELS as divisionLabels,
  DIVISION_OPTIONS as divisionOptions,
  PAYMENT_METHOD_LABELS as paymentMethodLabels,
  PAYMENT_METHOD_OPTIONS as paymentMethodOptions,
  PAYMENT_VOUCHER_ACCOUNT_CODES as knownAccountCodes,
} from "@/shared/constants/payment-options";
import { useAdminAccountingOptions } from "@/features/administration/use-admin-accounting-options";
import { parsePaymentAmountInput } from "@/shared/utils/payment-amount";
import { PaymentAmountInput } from "@/shared/payment-amount-input";
import { normalizeNumericIdentifier } from "@/shared/payment-identity-validation";
import { hasValidationErrors } from "@/domain/validation/common-validation";
import {
  type PaymentVoucherValidationErrors,
  validatePaymentVoucher,
} from "@/domain/payment-vouchers/validation";
import {
  FieldError,
  invalidFieldProps,
} from "@/features/validation/field-error";
import { useManualFormDraft } from "@/features/payment-request/components/shared/use-manual-form-draft";
import { ManualDraftConfirmation } from "../../../payment-request/components/shared/manual-draft-confirmation";
import { ManualDraftStatus } from "../../../payment-request/components/shared/manual-draft-status";
import { ProjectBudgetWarning } from "../../../payment-request/components/shared/project-budget-warning";

import type {
  CreatePaymentVoucherInput,
  PaymentVoucherRecord,
} from "@/domain/payment-vouchers/types";

import styles from "@/features/payment-voucher/components/payment-voucher.module.css";

type PaymentVoucherFormProps = {
  initialVoucher?: PaymentVoucherRecord;

  onContinue: (
    voucher: CreatePaymentVoucherInput,
    supportingDocumentNames: string[],
  ) => void;
};

type VoucherLine = {
  id: string;
  account: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

type PaymentVoucherDraftSnapshot = {
  fields: Record<string, string>;
  voucherLines: VoucherLine[];
};

const draftFieldNames = [
  "pvDate",
  "recipientName",
  "recipientEmail",
  "recipientIdentity",
  "isMalaysian",
  "division",
  "assignedDirector",
  "paymentMethod",
  "bankName",
  "bankAccountNumber",
  "purpose",
] as const;

const directors = [
  {
    id: "amir-iskandar",
    name: "Amir Iskandar",
    position: "School Director",
  },
  {
    id: "farid-hakim",
    name: "Farid Hakim",
    position: "Group Director",
  },
  {
    id: "maryam-iskandar",
    name: "Maryam Iskandar",
    position: "Director",
  },
  {
    id: "daniel-lee",
    name: "Daniel Lee",
    position: "Director",
  },
];

function createVoucherLine(id: string): VoucherLine {
  return {
    id,
    account: DEFAULT_PAYMENT_VOUCHER_ACCOUNT_CODE,
    description: "",
    quantity: 1,
    unitPrice: 0,
  };
}

function createInitialVoucherLines(
  initialVoucher?: PaymentVoucherRecord,
): VoucherLine[] {
  if (!initialVoucher || initialVoucher.lines.length === 0) {
    return [createVoucherLine("line-1")];
  }

  return initialVoucher.lines.map((line, index) => ({
    id: `line-${index + 1}`,
    account: line.accountCode,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitAmount,
  }));
}

function findOptionValue(
  labels: Record<string, string>,
  storedValue: string | undefined,
  fallback: string,
) {
  if (!storedValue) {
    return fallback;
  }

  const normalizedStoredValue = storedValue.trim().toLowerCase();

  const matchingEntry = Object.entries(labels).find(([key, label]) => {
    return (
      key.toLowerCase() === normalizedStoredValue ||
      label.toLowerCase() === normalizedStoredValue
    );
  });

  return matchingEntry?.[0] ?? fallback;
}

export function PaymentVoucherForm({
  initialVoucher,
  onContinue,
}: PaymentVoucherFormProps) {
  const paymentVoucherAccountOptions = useAdminAccountingOptions();
  const [account] = useState(() => readBetaSession());
  const [division, setDivision] = useState(initialVoucher?.division ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const isAmendment = initialVoucher?.status === "REJECTED";

  const initialLines = useMemo(
    () => createInitialVoucherLines(initialVoucher),
    [initialVoucher],
  );

  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>(
    () => initialLines,
  );

  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] =
    useState<PaymentVoucherValidationErrors>({});
  const [draftSaved, setDraftSaved] = useState(false);

  const draft = useManualFormDraft<PaymentVoucherDraftSnapshot>({
    paymentType: "PAYMENT_VOUCHER",
    requesterId: account?.id,
    disabled: Boolean(initialVoucher),
    getSnapshot: () => {
      const fields: Record<string, string> = {};
      const form = formRef.current;
      if (form) {
        const formData = new FormData(form);
        draftFieldNames.forEach((name) => {
          fields[name] = String(formData.get(name) ?? "");
        });
      }
      return {
        fields,
        voucherLines: voucherLines.map((line) => ({ ...line })),
      };
    },
    restoreSnapshot: (snapshot) => {
      if (snapshot.voucherLines?.length) {
        setVoucherLines(snapshot.voucherLines.map((line) => ({ ...line })));
      }
      const form = formRef.current;
      if (!form) return;
      Object.entries(snapshot.fields ?? {}).forEach(([name, value]) => {
        const control = form.elements.namedItem(name);
        if (
          control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement ||
          control instanceof HTMLTextAreaElement
        ) {
          control.value = value;
        }
      });
    },
  });

  const selectedDivision = findOptionValue(
    divisionLabels,
    initialVoucher?.division,
    "",
  );

  const selectedPaymentMethod = findOptionValue(
    paymentMethodLabels,
    initialVoucher?.paymentMethod,
    "Bank Transfer",
  );

  const totals = useMemo(() => {
    const subtotal = voucherLines.reduce((total, line) => {
      return total + line.quantity * line.unitPrice;
    }, 0);

    return {
      subtotal,
      grandTotal: subtotal,
    };
  }, [voucherLines]);

  const amountInWords = useMemo(() => {
    return amountToMalayWords(totals.grandTotal);
  }, [totals.grandTotal]);

  const assignedDirectorName = useMemo(() => {
    if (!initialVoucher) return "";
    return (
      directors.find((director) => director.id === initialVoucher.directorId)
        ?.name ?? initialVoucher.directorId
    );
  }, [initialVoucher]);

  function updateVoucherLine(lineId: string, changes: Partial<VoucherLine>) {
    setVoucherLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, ...changes } : line,
      ),
    );
  }

  function clearFieldError(field: keyof PaymentVoucherValidationErrors) {
    if (!fieldErrors[field]) return;
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function clearLineError(
    lineId: string,
    field: "account" | "description" | "quantity" | "unitPrice",
  ) {
    if (!fieldErrors.lines?.[lineId]?.[field]) return;
    setFieldErrors((current) => ({
      ...current,
      lines: {
        ...current.lines,
        [lineId]: { ...current.lines?.[lineId], [field]: undefined },
      },
    }));
  }

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});

    const account = readBetaSession();

    if (!account || !["staff", "manager", "finance"].includes(account.role)) {
      setFormError(
        "Only Staff, Manager and Finance accounts can create or amend a Payment Voucher.",
      );

      return;
    }

    if (
      isAmendment &&
      initialVoucher &&
      account.id !== initialVoucher.submitterId
    ) {
      setFormError(
        "Only the person who originally submitted this Payment Voucher can amend it.",
      );

      return;
    }

    const formData = new FormData(event.currentTarget);

    const divisionValue = String(formData.get("division") ?? "");

    const paymentMethodValue = String(formData.get("paymentMethod") ?? "");

    const directorId = String(formData.get("assignedDirector") ?? "");

    const recipientIdentity = String(
      formData.get("recipientIdentity") ?? "",
    ).trim();
    const bankName = String(formData.get("bankName") ?? "").trim();
    const bankAccountNumber = String(
      formData.get("bankAccountNumber") ?? "",
    ).trim();
    const nextFieldErrors = validatePaymentVoucher({
      pvDate: String(formData.get("pvDate") ?? ""),
      recipientName: String(formData.get("recipientName") ?? ""),
      recipientEmail: String(formData.get("recipientEmail") ?? ""),
      recipientIdentity,
      project: divisionValue,
      assignedDirector: directorId,
      paymentMethod:
        paymentMethodLabels[paymentMethodValue] ?? paymentMethodValue,
      bankName,
      bankAccountNumber,
      purpose: String(formData.get("purpose") ?? ""),
      lines: voucherLines,
    });
    if (hasValidationErrors(nextFieldErrors)) {
      setFieldErrors(nextFieldErrors);
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
      });
      return;
    }

    const selectedFiles = formData
      .getAll("supportingDocuments")
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      );

    const voucher: CreatePaymentVoucherInput = {
      organizationId: initialVoucher?.organizationId ?? "beta-arus-org",

      submitterId: account.id,

      /*
       * Rejected vouchers must return to
       * their original assigned Director.
       */
      directorId: isAmendment ? initialVoucher.directorId : directorId,

      projectManagerId: initialVoucher?.projectManagerId ?? "nadia-hassan",

      pvDate: String(formData.get("pvDate") ?? "").trim(),

      division: divisionLabels[divisionValue] ?? divisionValue,

      recipientName: String(formData.get("recipientName") ?? "").trim(),

      recipientEmail: String(formData.get("recipientEmail") ?? "")
        .trim()
        .toLowerCase(),

      recipientIc: normalizeNumericIdentifier(recipientIdentity) || undefined,

      recipientIsMalaysian: formData.get("isMalaysian") === "yes",

      paymentMethod:
        paymentMethodLabels[paymentMethodValue] ?? paymentMethodValue,

      bankName: bankName || undefined,

      bankAccountNumber:
        normalizeNumericIdentifier(bankAccountNumber) || undefined,

      purpose: String(formData.get("purpose") ?? "").trim(),

      lines: voucherLines.map((line) => ({
        accountCode: line.account.trim(),

        description: line.description.trim(),

        quantity: line.quantity,
        unitAmount: line.unitPrice,
        taxAmount: 0,
      })),
    };

    onContinue(
      voucher,
      selectedFiles.map((file) => file.name),
    );
  }

  if (draftSaved) {
    return (
      <ManualDraftConfirmation
        createHref="/beta/payment-vouchers/new?mode=single"
        paymentType="PAYMENT_VOUCHER"
        recordsHref="/beta/payment-vouchers?scope=mine"
      />
    );
  }

  return (
    <section
      className={`${styles.panel} ${isAmendment ? styles.amendmentPanel : ""}`}
    >
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.pageEyebrow}>
            <b>PV</b> Payment Voucher
          </p>

          <h1>
            {isAmendment ? "Amend Payment Voucher" : "Create Payment Voucher"}
          </h1>

          <p className={styles.copy}>
            {isAmendment
              ? "Correct the information requested by the Director, review the changes and resubmit the Payment Voucher."
              : "Complete the recipient, payment and voucher line information before sending it for Director approval."}
          </p>
        </div>

        <span className={styles.status}>
          {isAmendment ? "Amendment required" : "Draft"}
        </span>
      </div>

      {formError && (
        <div className={styles.notice} role="alert">
          {formError}
        </div>
      )}

      <form
        className={`${styles.pvFormLayout} ${isAmendment ? styles.amendmentForm : ""}`}
        ref={formRef}
        noValidate
        onSubmit={handleReview}
      >
        <ProjectBudgetWarning
          accountId={account?.id}
          allocations={[
            { projectReference: division, amount: totals.grandTotal },
          ]}
        />
        {isAmendment && initialVoucher && (
          <aside className={styles.amendmentAside}>
            <section className={styles.amendmentRequestCard} role="status">
              <span>Director requested amendments</span>
              <strong>
                “
                {initialVoucher.rejectionRemarks ||
                  "Please amend this voucher."}
                ”
              </strong>
              <small>From {assignedDirectorName} · Director</small>
            </section>
            <section className={styles.amendmentTotalCard}>
              <span>Voucher total</span>
              <strong>RM {totals.grandTotal.toFixed(2)}</strong>
              <small>{amountInWords}</small>
            </section>
            <div className={styles.amendmentAsideActions}>
              <button className={styles.amendmentContinueButton} type="submit">
                Continue to review amendment →
              </button>
              <Link
                className={styles.amendmentCancelButton}
                href={`/beta/payment-vouchers/${initialVoucher.id}`}
              >
                Cancel amendment
              </Link>
            </div>
          </aside>
        )}
        <div className={styles.pvFormMain}>
          <section className={styles.formSection}>
            <div className={styles.sectionHeading}>
              <span className={styles.pvSectionNumber}>1</span>
              <div>
                <p>Recipient and payment</p>
                <h2>Voucher details</h2>
              </div>
            </div>

            <div className={styles.form}>
              <label className={styles.field}>
                <span>
                  PV date <em className={styles.requiredMarker}>*</em>
                </span>

                <input
                  {...invalidFieldProps("pv-date-error", fieldErrors.pvDate)}
                  defaultValue={initialVoucher?.pvDate ?? ""}
                  name="pvDate"
                  onChange={() => clearFieldError("pvDate")}
                  required
                  type="date"
                />
                <FieldError id="pv-date-error">{fieldErrors.pvDate}</FieldError>
              </label>

              <label className={styles.field}>
                <span>
                  Recipient name <em className={styles.requiredMarker}>*</em>
                </span>

                <input
                  {...invalidFieldProps(
                    "recipient-name-error",
                    fieldErrors.recipientName,
                  )}
                  defaultValue={initialVoucher?.recipientName ?? ""}
                  name="recipientName"
                  onInput={() => clearFieldError("recipientName")}
                  required
                  type="text"
                />
                <FieldError id="recipient-name-error">
                  {fieldErrors.recipientName}
                </FieldError>
              </label>

              <label className={styles.field}>
                <span>
                  Recipient email <em className={styles.requiredMarker}>*</em>
                </span>

                <input
                  {...invalidFieldProps(
                    "recipient-email-error",
                    fieldErrors.recipientEmail,
                  )}
                  defaultValue={initialVoucher?.recipientEmail ?? ""}
                  name="recipientEmail"
                  onInput={() => clearFieldError("recipientEmail")}
                  required
                  type="email"
                />
                <FieldError id="recipient-email-error">
                  {fieldErrors.recipientEmail}
                </FieldError>
              </label>

              <label className={styles.field}>
                <span>
                  IC / identity number{" "}
                  <em className={styles.requiredMarker}>*</em>
                </span>

                <input
                  {...invalidFieldProps(
                    "recipient-identity-error",
                    fieldErrors.recipientIdentity,
                  )}
                  defaultValue={initialVoucher?.recipientIc ?? ""}
                  name="recipientIdentity"
                  inputMode="numeric"
                  maxLength={12}
                  required
                  type="text"
                  onInput={(event) => {
                    event.currentTarget.value = event.currentTarget.value
                      .replace(/\D/g, "")
                      .slice(0, 12);
                    if (fieldErrors.recipientIdentity) {
                      setFieldErrors((current) => ({
                        ...current,
                        recipientIdentity: undefined,
                      }));
                    }
                  }}
                />
                <FieldError id="recipient-identity-error">
                  {fieldErrors.recipientIdentity}
                </FieldError>
              </label>

              <label className={styles.field}>
                <span>
                  Malaysian? <em className={styles.requiredMarker}>*</em>
                </span>

                <select
                  defaultValue={
                    initialVoucher
                      ? initialVoucher.recipientIsMalaysian
                        ? "yes"
                        : "no"
                      : "yes"
                  }
                  name="isMalaysian"
                >
                  <option value="yes">Yes</option>

                  <option value="no">No</option>
                </select>
              </label>

              <label className={styles.field}>
                <span>
                  Project Name <em className={styles.requiredMarker}>*</em>
                </span>

                <select
                  {...invalidFieldProps("project-error", fieldErrors.project)}
                  defaultValue={selectedDivision}
                  name="division"
                  onChange={(event) => {
                    setDivision(event.target.value);
                    clearFieldError("project");
                  }}
                  required
                >
                  <option disabled value="">
                    Select project
                  </option>

                  {divisionOptions.map((division) => (
                    <option key={division} value={division}>
                      {division}
                    </option>
                  ))}
                </select>
                <FieldError id="project-error">
                  {fieldErrors.project}
                </FieldError>
              </label>

              <label className={styles.field}>
                <span>
                  Assigned Director <em className={styles.requiredMarker}>*</em>
                </span>

                {isAmendment && initialVoucher && (
                  <input
                    name="assignedDirector"
                    type="hidden"
                    value={initialVoucher.directorId}
                  />
                )}

                <select
                  {...invalidFieldProps(
                    "assigned-director-error",
                    fieldErrors.assignedDirector,
                  )}
                  defaultValue={initialVoucher?.directorId ?? ""}
                  disabled={isAmendment}
                  name={isAmendment ? undefined : "assignedDirector"}
                  onChange={() => clearFieldError("assignedDirector")}
                  required={!isAmendment}
                >
                  <option disabled value="">
                    Select Director
                  </option>

                  {initialVoucher &&
                    !directors.some(
                      (director) => director.id === initialVoucher.directorId,
                    ) && (
                      <option value={initialVoucher.directorId}>
                        {initialVoucher.directorId}
                      </option>
                    )}

                  {directors.map((director) => (
                    <option key={director.id} value={director.id}>
                      {director.name} — {director.position}
                    </option>
                  ))}
                </select>
                <FieldError id="assigned-director-error">
                  {fieldErrors.assignedDirector}
                </FieldError>

                {isAmendment && (
                  <small>
                    The amended voucher will return to the same Director.
                  </small>
                )}
              </label>

              <label className={styles.field}>
                <span>
                  Payment method <em className={styles.requiredMarker}>*</em>
                </span>

                <select
                  defaultValue={selectedPaymentMethod}
                  name="paymentMethod"
                  onChange={() => {
                    clearFieldError("bankName");
                    clearFieldError("bankAccountNumber");
                  }}
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>
                  Bank name <em className={styles.requiredMarker}>*</em>
                </span>

                <select
                  {...invalidFieldProps(
                    "bank-name-error",
                    fieldErrors.bankName,
                  )}
                  defaultValue={initialVoucher?.bankName ?? ""}
                  name="bankName"
                  onChange={() => {
                    clearFieldError("bankName");
                    clearFieldError("bankAccountNumber");
                  }}
                >
                  <option value="">Select bank</option>

                  {bankNameOptions.map((bankName) => (
                    <option key={bankName} value={bankName}>
                      {bankName}
                    </option>
                  ))}
                </select>
                <FieldError id="bank-name-error">
                  {fieldErrors.bankName}
                </FieldError>
              </label>

              <label className={styles.field}>
                <span>
                  Bank account number{" "}
                  <em className={styles.requiredMarker}>*</em>
                </span>

                <input
                  {...invalidFieldProps(
                    "bank-account-number-error",
                    fieldErrors.bankAccountNumber,
                  )}
                  defaultValue={initialVoucher?.bankAccountNumber ?? ""}
                  name="bankAccountNumber"
                  inputMode="numeric"
                  maxLength={19}
                  type="text"
                  onInput={(event) => {
                    event.currentTarget.value =
                      event.currentTarget.value.replace(/\D/g, "");
                    if (fieldErrors.bankAccountNumber) {
                      setFieldErrors((current) => ({
                        ...current,
                        bankAccountNumber: undefined,
                      }));
                    }
                  }}
                />
                <FieldError id="bank-account-number-error">
                  {fieldErrors.bankAccountNumber}
                </FieldError>
              </label>

              <label className={`${styles.field} ${styles.wide}`}>
                <span>
                  Purpose of payment{" "}
                  <em className={styles.requiredMarker}>*</em>
                </span>

                <textarea
                  {...invalidFieldProps("purpose-error", fieldErrors.purpose)}
                  defaultValue={initialVoucher?.purpose ?? ""}
                  name="purpose"
                  onInput={() => clearFieldError("purpose")}
                  required
                  rows={4}
                />
                <FieldError id="purpose-error">
                  {fieldErrors.purpose}
                </FieldError>
              </label>

              <label className={`${styles.field} ${styles.wide}`}>
                <span className={styles.uploadLabel}>
                  Supporting documents
                  <em className={styles.optionalBadge}>Optional</em>
                </span>

                <input
                  accept=".pdf,.png,.jpg,.jpeg"
                  className={styles.pvFileInput}
                  id="single-pv-supporting-documents"
                  multiple
                  name="supportingDocuments"
                  type="file"
                />
                <span className={styles.fileUploadControl}>
                  <strong>Choose files</strong>
                  <small>
                    No file chosen · PDF, PNG or JPG · selected names appear on
                    review
                  </small>
                </span>
              </label>
            </div>
          </section>

          <section className={styles.linesSection}>
            <div className={styles.linesHeading}>
              <span className={styles.pvSectionNumber}>2</span>
              <div>
                <div className={styles.linesTitleRow}>
                  <h2>Voucher lines</h2>

                  <span className={styles.lineCountBadge}>
                    {voucherLines.length}{" "}
                    {voucherLines.length === 1 ? "item" : "items"}
                  </span>
                </div>

                <span>Enter the payment purpose and accounting category.</span>
              </div>
            </div>

            <div className={styles.lineLabels}>
              <span>Account *</span>
              <span>Description *</span>
              <span>Quantity *</span>
              <span>Unit price *</span>
              <span>Total</span>
            </div>

            <div className={styles.voucherLines}>
              {voucherLines.map((line) => {
                const lineTotal = line.quantity * line.unitPrice;

                return (
                  <div className={styles.voucherLine} key={line.id}>
                    <label className={styles.mobileFieldLabel}>
                      <span>
                        Account <em className={styles.requiredMarker}>*</em>
                      </span>

                      <select
                        aria-label="Account"
                        {...invalidFieldProps(
                          `${line.id}-account-error`,
                          fieldErrors.lines?.[line.id]?.account,
                        )}
                        required
                        value={line.account}
                        onChange={(event) => {
                          updateVoucherLine(line.id, {
                            account: event.target.value,
                          });
                          clearLineError(line.id, "account");
                        }}
                      >
                        {!knownAccountCodes.includes(line.account) && (
                          <option value={line.account}>{line.account}</option>
                        )}

                        {paymentVoucherAccountOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <FieldError id={`${line.id}-account-error`}>
                        {fieldErrors.lines?.[line.id]?.account}
                      </FieldError>
                    </label>

                    <label className={styles.mobileFieldLabel}>
                      <span>
                        Description <em className={styles.requiredMarker}>*</em>
                      </span>

                      <input
                        aria-label="Description"
                        {...invalidFieldProps(
                          `${line.id}-description-error`,
                          fieldErrors.lines?.[line.id]?.description,
                        )}
                        placeholder="Payment description"
                        required
                        type="text"
                        value={line.description}
                        onChange={(event) => {
                          updateVoucherLine(line.id, {
                            description: event.target.value,
                          });
                          clearLineError(line.id, "description");
                        }}
                      />
                      <FieldError id={`${line.id}-description-error`}>
                        {fieldErrors.lines?.[line.id]?.description}
                      </FieldError>
                    </label>

                    <label className={styles.mobileFieldLabel}>
                      <span>
                        Quantity <em className={styles.requiredMarker}>*</em>
                      </span>

                      <input
                        aria-label="Quantity"
                        {...invalidFieldProps(
                          `${line.id}-quantity-error`,
                          fieldErrors.lines?.[line.id]?.quantity,
                        )}
                        inputMode="decimal"
                        placeholder="For example: 1"
                        required
                        type="text"
                        value={line.quantity}
                        onChange={(event) => {
                          updateVoucherLine(line.id, {
                            quantity: parsePaymentAmountInput(
                              event.target.value,
                            ),
                          });
                          clearLineError(line.id, "quantity");
                        }}
                      />
                      <FieldError id={`${line.id}-quantity-error`}>
                        {fieldErrors.lines?.[line.id]?.quantity}
                      </FieldError>
                    </label>

                    <label className={styles.mobileFieldLabel}>
                      <span>
                        Unit price <em className={styles.requiredMarker}>*</em>
                      </span>

                      <PaymentAmountInput
                        aria-label="Unit price"
                        {...invalidFieldProps(
                          `${line.id}-unit-price-error`,
                          fieldErrors.lines?.[line.id]?.unitPrice,
                        )}
                        placeholder="0.00"
                        required
                        value={line.unitPrice}
                        onValueChange={(unitPrice) => {
                          updateVoucherLine(line.id, { unitPrice });
                          clearLineError(line.id, "unitPrice");
                        }}
                      />
                      <FieldError id={`${line.id}-unit-price-error`}>
                        {fieldErrors.lines?.[line.id]?.unitPrice}
                      </FieldError>
                    </label>

                    <div className={styles.lineTotal}>
                      <span className={styles.mobileTotalLabel}>Total</span>

                      <strong>RM {lineTotal.toFixed(2)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.voucherSummary}>
              <div className={styles.summaryStats}>
                <div className={styles.summaryStat}>
                  <span>Lines</span>

                  <strong>{voucherLines.length}</strong>
                </div>

                <div className={styles.summaryStat}>
                  <span>Subtotal</span>

                  <strong>RM {totals.subtotal.toFixed(2)}</strong>
                </div>
              </div>

              <div className={styles.amountInWords}>
                <div className={styles.amountInWordsHeading}>
                  <span>Amount in words</span>

                  <small>Automatically generated</small>
                </div>

                <output
                  aria-label="Amount in words"
                  className={styles.amountInWordsOutput}
                >
                  {amountInWords}
                </output>
              </div>

              <div className={styles.grandTotalBar}>
                <span>Grand total</span>

                <strong>RM {totals.grandTotal.toFixed(2)}</strong>
              </div>
            </div>
          </section>
        </div>

        {!isAmendment && (
          <aside className={styles.pvFormSummary}>
            <div className={styles.pvSummaryHeading}>
              <span>Grand total</span>
              <strong>RM {totals.grandTotal.toFixed(2)}</strong>
            </div>
            <dl className={styles.pvSummaryRows}>
              <div>
                <dt>Voucher type</dt>
                <dd>Single PV</dd>
              </div>
              <div>
                <dt>Lines</dt>
                <dd>{voucherLines.length}</dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>RM {totals.subtotal.toFixed(2)}</dd>
              </div>
            </dl>
            <div className={styles.pvChecklist}>
              <h2>Checklist</h2>
              <PvCheck label="Recipient details" />
              <PvCheck label="Director and bank details" />
              <PvCheck
                complete={voucherLines.every(
                  (line) =>
                    Boolean(line.account.trim()) &&
                    Boolean(line.description.trim()),
                )}
                label="Purpose of payment"
              />
              <PvCheck
                complete={totals.grandTotal > 0}
                label="At least one amount"
              />
              <PvCheck label="Documents" optional />
            </div>
            <div className={styles.pvNextNote}>
              <strong>What happens next</strong>
              <p>
                The voucher goes to the assigned Director for approval, then to
                the recipient to sign.
              </p>
            </div>
            <footer className={styles.formActions}>
              <ManualDraftStatus message={draft.draftMessage} />
              <button
                className={styles.secondary}
                disabled={draft.isSavingDraft}
                type="button"
                onClick={async () => {
                  setFormError("");
                  try {
                    await draft.saveDraft();
                    setDraftSaved(true);
                  } catch (error) {
                    setFormError(
                      error instanceof Error
                        ? error.message
                        : "The Payment Voucher draft could not be saved.",
                    );
                  }
                }}
              >
                {draft.isSavingDraft ? "Saving draft…" : "Save as draft"}
              </button>
              <button className={styles.primary} type="submit">
                Continue to review
              </button>
            </footer>
          </aside>
        )}
      </form>
    </section>
  );
}

function PvCheck({
  complete = false,
  label,
  optional = false,
}: {
  complete?: boolean;
  label: string;
  optional?: boolean;
}) {
  return (
    <div className={complete ? styles.pvChecklistComplete : ""}>
      <i aria-hidden="true" />
      <span>{label}</span>
      <small>{optional ? "Optional" : complete ? "Added" : "Required"}</small>
    </div>
  );
}

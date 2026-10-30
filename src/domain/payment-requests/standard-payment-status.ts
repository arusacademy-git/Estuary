export type StandardPaymentStatus =
  | "Draft"
  | "Submitted"
  | "Pending Manager Approval"
  | "Pending Director Approval"
  | "Payment Rejected"
  | "Finance Verifying"
  | "Approved for Payment"
  | "Pending Reconciliation"
  | "Finance payment is processed"
  | "Finance payment transaction proof has been uploaded";

export type StandardPaymentStatusFilter = "ALL" | StandardPaymentStatus;

export const STANDARD_PAYMENT_STATUS_OPTIONS: ReadonlyArray<{
  value: StandardPaymentStatusFilter;
  label: string;
}> = [
  { value: "ALL", label: "All statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Pending Manager Approval", label: "Pending Manager Approval" },
  { value: "Pending Director Approval", label: "Pending Director Approval" },
  { value: "Payment Rejected", label: "Payment Rejected" },
  { value: "Finance Verifying", label: "Finance Verifying" },
  { value: "Approved for Payment", label: "Approved for Payment" },
  { value: "Pending Reconciliation", label: "Pending Reconciliation" },
  {
    value: "Finance payment is processed",
    label: "Finance payment is processed",
  },
  {
    value: "Finance payment transaction proof has been uploaded",
    label: "Finance payment transaction proof has been uploaded",
  },
];

const labels: Record<string, StandardPaymentStatus> = {
  DRAFT: "Draft",
  CLAIM_SUBMITTED: "Submitted",
  SUBMITTED: "Submitted",
  PENDING_MANAGER_REVIEW: "Pending Manager Approval",
  PENDING_MANAGER_APPROVAL: "Pending Manager Approval",
  PENDING_DIRECTOR_REVIEW: "Pending Director Approval",
  PENDING_DIRECTOR_APPROVAL: "Pending Director Approval",
  RETURNED_TO_STAFF: "Payment Rejected",
  RETURNED_TO_CLAIMANT: "Payment Rejected",
  PAYMENT_REJECTED: "Payment Rejected",
  PENDING_FINANCE_REVIEW: "Finance Verifying",
  PENDING_FINANCE_VERIFICATION: "Finance Verifying",
  PENDING_FINANCE_PROCESSING: "Finance Verifying",
  PENDING_FINANCE_PAYMENT: "Finance Verifying",
  APPROVED_FOR_PAYMENT: "Approved for Payment",
  PENDING_FINANCE_RECONCILIATION: "Pending Reconciliation",
  FINANCE_VERIFIED: "Finance payment transaction proof has been uploaded",
  PENDING_RECONCILIATION: "Pending Reconciliation",
  RECONCILED: "Finance payment is processed",
  COMPLETED: "Finance payment is processed",
  PAID: "Finance payment is processed",
  PAYMENT_PROCESSED: "Finance payment is processed",
  TRANSACTION_PROOF_UPLOADED:
    "Finance payment transaction proof has been uploaded",
};

export function standardPaymentStatusLabel(
  status: string,
): StandardPaymentStatus {
  return labels[status] ?? "Submitted";
}

export function matchesStandardPaymentStatus(
  status: string,
  filter: StandardPaymentStatusFilter,
) {
  return filter === "ALL" || standardPaymentStatusLabel(status) === filter;
}

export function paymentRejectionReason(record: {
  returnRemarks?: string;
  managerReturnRemarks?: string;
  directorReturnRemarks?: string;
  financeReturnRemarks?: string;
}) {
  return (
    record.returnRemarks ??
    record.financeReturnRemarks ??
    record.directorReturnRemarks ??
    record.managerReturnRemarks
  );
}

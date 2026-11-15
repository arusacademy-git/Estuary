import type { CashAdvanceRecord } from "@/domain/payment-requests/cash-advance/types";
import {
  businessMinutesBetween,
  formatBusinessDuration,
} from "@/features/payment-records/components/shared/payment-progress-duration";
import { PaymentProgressTimeline } from "@/features/payment-records/components/shared/payment-progress-timeline";
import type {
  PaymentProgressStage,
  PaymentProgressSummary,
} from "@/features/payment-records/components/shared/payment-progress-types";
import { betaAccounts } from "@/lib/auth/beta-accounts";

function accountName(id?: string) {
  if (!id) return undefined;
  return betaAccounts.find((account) => account.id === id)?.name ?? id;
}

function currentRequestReturnStage(record: CashAdvanceRecord) {
  if (record.returnedStage !== "REQUEST") return null;
  if (!record.managerApprovedAt) return "manager-review";
  if (!record.directorApprovedAt) return "director-review";
  return "finance-payment";
}

function createStages(record: CashAdvanceRecord): PaymentProgressStage[] {
  const completed = record.status === "COMPLETED";
  const requestReturnStage = currentRequestReturnStage(record);
  const reconciliationReturned =
    record.status === "RETURNED_TO_STAFF" &&
    record.returnedStage === "RECONCILIATION";
  const proofUploaded =
    Boolean(record.financeTransactionProof) ||
    [
      "TRANSACTION_PROOF_UPLOADED",
      "PENDING_RECONCILIATION",
      "PENDING_FINANCE_RECONCILIATION",
      "COMPLETED",
    ].includes(record.status) ||
    reconciliationReturned;
  const proofUploadedAt =
    proofUploaded && record.status === "TRANSACTION_PROOF_UPLOADED"
      ? record.updatedAt
      : null;
  const reconciliationSubmittedAt =
    record.reconciliation && !record.reconciliation.isDraft
      ? record.reconciliation.submittedAt
      : null;

  const stages: PaymentProgressStage[] = [
    {
      id: "submission",
      kind: "submission",
      title: "Cash Advance submitted",
      description: "The requester signed and submitted the Cash Advance.",
      actorName: record.requesterName,
      actorRole: "Staff",
      state: "complete",
      receivedAt: record.staffSignedAt,
      completedAt: record.staffSignedAt,
    },
    {
      id: "manager-review",
      kind: "approval",
      title: "Manager review and approval",
      description:
        requestReturnStage === "manager-review"
          ? "The Manager returned the request for correction."
          : record.managerApprovedAt
            ? "The Manager approved and forwarded the request to the Director."
            : "Waiting for the assigned Manager to review and approve.",
      actorName: accountName(record.managerApproverId),
      actorRole: "Manager",
      state:
        requestReturnStage === "manager-review"
          ? "returned"
          : record.managerApprovedAt
            ? "complete"
            : record.status === "PENDING_MANAGER_APPROVAL"
              ? "current"
              : "pending",
      receivedAt: record.staffSignedAt,
      completedAt:
        requestReturnStage === "manager-review"
          ? record.returnedAt
          : record.managerApprovedAt,
    },
    {
      id: "director-review",
      kind: "approval",
      title: "Director review and approval",
      description:
        requestReturnStage === "director-review"
          ? "The Director returned the request for correction."
          : record.directorApprovedAt
            ? "The Director approved and forwarded the request to Finance."
            : "Director review begins after Manager approval.",
      actorName: accountName(record.directorApproverId),
      actorRole: "Director",
      state:
        requestReturnStage === "director-review"
          ? "returned"
          : record.directorApprovedAt
            ? "complete"
            : record.status === "PENDING_DIRECTOR_APPROVAL"
              ? "current"
              : "pending",
      receivedAt: record.managerApprovedAt,
      completedAt:
        requestReturnStage === "director-review"
          ? record.returnedAt
          : record.directorApprovedAt,
    },
    {
      id: "finance-payment",
      kind: "payment",
      title: "Finance payment release",
      description:
        requestReturnStage === "finance-payment"
          ? "Finance returned the approved request for correction."
          : record.financePaidAt
            ? "Finance released the advance to the requester."
            : "Finance records and releases payment after Director approval.",
      actorName: accountName(record.financePaidById),
      actorRole: "Finance",
      state:
        requestReturnStage === "finance-payment"
          ? "returned"
          : record.financePaidAt
            ? "complete"
            : record.status === "PENDING_FINANCE_PROCESSING"
              ? "current"
              : "pending",
      receivedAt: record.directorApprovedAt,
      completedAt:
        requestReturnStage === "finance-payment"
          ? record.returnedAt
          : record.financePaidAt,
    },
    {
      id: "transaction-proof",
      kind: "payment",
      title: "Payment transaction proof uploaded",
      description: proofUploaded
        ? "Finance uploaded the payment transaction proof."
        : "Finance uploads transaction proof after releasing the advance.",
      actorName: accountName(record.financePaidById),
      actorRole: "Finance",
      state: proofUploaded
        ? "complete"
        : record.status === "PAYMENT_PROCESSED"
          ? "current"
          : "pending",
      receivedAt: record.financePaidAt,
      completedAt: proofUploadedAt,
    },
    {
      id: "reconciliation-submission",
      kind: "reconciliation",
      title: "Requester reconciliation",
      description: reconciliationSubmittedAt
        ? "The requester submitted actual expenses and balance-return evidence."
        : "The requester must record actual expenses and return any remaining balance.",
      actorName: record.requesterName,
      actorRole: "Staff",
      state: reconciliationSubmittedAt
        ? "complete"
        : record.status === "PENDING_RECONCILIATION" ||
          record.status === "TRANSACTION_PROOF_UPLOADED"
          ? "current"
          : "pending",
      receivedAt: proofUploadedAt ?? record.financePaidAt,
      completedAt: reconciliationSubmittedAt,
    },
    {
      id: "finance-reconciliation",
      kind: "reconciliation",
      title: "Finance reconciliation review",
      description: reconciliationReturned
        ? "Finance returned the reconciliation for correction."
        : completed
          ? "Finance verified the expenses and returned-balance evidence."
          : "Finance reviews the submitted reconciliation and supporting evidence.",
      actorName: accountName(record.completedById ?? record.returnedById),
      actorRole: "Finance",
      state: reconciliationReturned
        ? "returned"
        : completed
          ? "complete"
          : record.status === "PENDING_FINANCE_RECONCILIATION"
            ? "current"
            : "pending",
      receivedAt: reconciliationSubmittedAt,
      completedAt: reconciliationReturned
        ? record.returnedAt
        : record.completedAt,
    },
    {
      id: "completed",
      kind: "completion",
      title: "Reconciled and completed",
      description: completed
        ? "The Cash Advance is reconciled, closed and locked."
        : "The record closes after Finance verifies the reconciliation.",
      actorName: accountName(record.completedById),
      actorRole: "Finance",
      state: completed ? "complete" : "pending",
      receivedAt: record.completedAt,
      completedAt: record.completedAt,
    },
  ];

  if (record.status === "RETURNED_TO_STAFF") {
    const returnedIndex = stages.findIndex(
      (stage) => stage.state === "returned",
    );
    const correctionIndex = returnedIndex >= 0 ? returnedIndex + 1 : 1;
    stages.splice(correctionIndex, 0, {
      id: reconciliationReturned
        ? "reconciliation-correction"
        : "request-correction",
      kind: "correction",
      title: reconciliationReturned
        ? "Correct and resubmit reconciliation"
        : "Correct and resubmit request",
      description:
        record.returnRemarks ||
        "Review the return remarks, make the required corrections and resubmit.",
      actorName: record.requesterName,
      actorRole: "Staff",
      state: "current",
      receivedAt: record.returnedAt,
    });
  }

  return stages;
}

function currentUpdate(record: CashAdvanceRecord) {
  if (record.status === "RETURNED_TO_STAFF")
    return record.returnedStage === "RECONCILIATION"
      ? "Reconciliation correction required"
      : "Request correction required";
  const labels: Record<CashAdvanceRecord["status"], string> = {
    PENDING_MANAGER_APPROVAL: "Waiting for Manager approval",
    PENDING_DIRECTOR_APPROVAL: "Waiting for Director approval",
    PENDING_FINANCE_PROCESSING: "Waiting for Finance payment",
    PAYMENT_PROCESSED: "Waiting for transaction proof",
    TRANSACTION_PROOF_UPLOADED: "Reconciliation required",
    PENDING_RECONCILIATION: "Reconciliation required",
    PENDING_FINANCE_RECONCILIATION: "Finance reviewing reconciliation",
    RETURNED_TO_STAFF: "Correction required",
    COMPLETED: "Cash Advance reconciled",
  };
  return labels[record.status];
}

export function CashAdvanceProgress({ record }: { record: CashAdvanceRecord }) {
  const stages = createStages(record);
  const lifecycleEnd = record.completedAt ?? new Date();
  const summaries: PaymentProgressSummary[] = [
    {
      label: "Current update",
      value: currentUpdate(record),
      tone:
        record.status === "COMPLETED"
          ? "success"
          : record.status === "RETURNED_TO_STAFF"
            ? "warning"
            : "active",
    },
    {
      label:
        record.status === "COMPLETED"
          ? "Total lifecycle time"
          : "Elapsed lifecycle time",
      value: formatBusinessDuration(
        businessMinutesBetween(record.staffSignedAt, lifecycleEnd),
      ),
      tone: record.status === "COMPLETED" ? "success" : "neutral",
    },
  ];

  if (record.financePaidAt) {
    summaries.push({
      label: "Reconciliation period",
      value: formatBusinessDuration(
        businessMinutesBetween(record.financePaidAt, lifecycleEnd),
      ),
      tone:
        record.status === "COMPLETED"
          ? "success"
          : record.status === "RETURNED_TO_STAFF"
            ? "warning"
            : "neutral",
    });
  }

  return <PaymentProgressTimeline stages={stages} summaries={summaries} />;
}

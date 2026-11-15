import { claimLineAmount } from "@/domain/payment-requests/claims/policy";
import {
  claimTypeDetails,
  type ClaimRecord,
} from "@/domain/payment-requests/claims/types";
import { standardPaymentStatusLabel } from "@/domain/payment-requests/standard-payment-status";
import { getBetaAccount } from "@/lib/auth/beta-accounts";
import { DocumentReferenceChip } from "@/shared/document-reference-chip";
import { PaymentProgressTimeline } from "@/features/payment-records/components/shared/payment-progress-timeline";
import {
  businessMinutesBetween,
  formatBusinessDuration,
} from "@/features/payment-records/components/shared/payment-progress-duration";
import type {
  PaymentProgressStage,
  PaymentProgressSummary,
} from "@/features/payment-records/components/shared/payment-progress-types";

import styles from "./claim-workflow.module.css";

export function claimDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
}

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function claimStatusLabel(status: ClaimRecord["status"]) {
  return standardPaymentStatusLabel(status);
}

export function ClaimReviewDetails({
  record,
  userId,
  contextLabel = "Claim record",
}: {
  record: ClaimRecord;
  userId: string;
  contextLabel?: string;
}) {
  const formHref = `/api/v1/payment-requests/claims/${encodeURIComponent(record.claimNumber)}?form=1`;
  return (
    <>
      <header className={styles.hero}>
        <div>
          <p>{contextLabel}</p>
          <h1>{record.claimNumber}</h1>
          <span>
            Submitted by {record.requesterName} · {claimDate(record.claimDate)}
          </span>
        </div>
        <div>
          <small>Request total</small>
          <strong>{money(record.totalAmount)}</strong>
          <span className={styles.status} data-status={record.status}>
            {claimStatusLabel(record.status)}
          </span>
        </div>
      </header>

      <InfoSection title="Request Overview">
        <dl className={styles.infoGrid}>
          <Value label="Claim date" value={claimDate(record.claimDate)} />
          <Value label="Submitted by" value={record.requesterName} />
          <Value
            label="Requester role"
            value={roleLabel(record.requesterRole)}
          />
          <Value
            label="Claim type"
            value={claimTypeDetails(record.claimType).label}
          />
          <Value label="Position" value={record.requesterPosition} />
          <Value label="Contact" value={record.requesterContact} />
        </dl>
      </InfoSection>

      <InfoSection title="Claim Form">
        <div className={styles.formCard}>
          <span className={styles.formIcon} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M14 2.75H6.75A1.75 1.75 0 0 0 5 4.5v15A1.75 1.75 0 0 0 6.75 21h10.5A1.75 1.75 0 0 0 19 19.5V7.75L14 2.75Z" />
              <path d="M14 2.75v5h5M8.5 13h7M8.5 16.5h7" />
            </svg>
          </span>
          <div className={styles.formCopy}>
            <strong>
              {claimTypeDetails(record.claimType).label} Form (PDF)
            </strong>
            <span>Generated automatically from the latest Claim details.</span>
          </div>
          <div className={styles.formActions}>
            <a href={formHref} target="_blank" rel="noreferrer">
              Preview Claim Form
            </a>
            <a href={`${formHref}&download=1`}>Download Claim Form (PDF)</a>
          </div>
        </div>
      </InfoSection>

      <InfoSection
        title={
          record.claimType === "MILEAGE" ? "Trip Details" : "Expense Details"
        }
      >
        <div className={styles.tableWrapper}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Supplier / route</th>
                <th>Purpose</th>
                <th>Account</th>
                <th>Division</th>
                <th>Receipt</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {record.lines.map((line, index) => (
                <tr key={line.id}>
                  <td>{index + 1}</td>
                  <td>{claimDate(line.expenseDate)}</td>
                  <td>
                    {record.claimType === "MILEAGE"
                      ? `${line.from} → ${line.to}`
                      : line.supplier}
                  </td>
                  <td>{line.details}</td>
                  <td>{line.accountType || "—"}</td>
                  <td>{line.division || "—"}</td>
                  <td>
                    {line.receiptDocumentId ? (
                      <DocumentReferenceChip
                        href={`/api/v1/payment-requests/claims/documents/${encodeURIComponent(line.receiptDocumentId)}?userId=${encodeURIComponent(userId)}`}
                        value={line.receiptFileName || "Preview receipt"}
                      />
                    ) : line.receiptLink ? (
                      <DocumentReferenceChip
                        href={line.receiptLink}
                        value={line.receiptFileName || line.receiptLink}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <strong>
                      {money(claimLineAmount(record.claimType, line))}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InfoSection>

      <InfoSection title="Purpose & Justification">
        <p className={styles.longText}>
          {record.notes || "No additional notes were provided."}
        </p>
      </InfoSection>

      {record.financeProcessedAt && (
        <InfoSection title="Finance Payment Record">
          <dl className={styles.infoGrid}>
            <Value label="Payment date" value={claimDate(record.paymentDate)} />
            <Value label="Reference" value={record.paymentReference || "—"} />
            <Value
              label="Processed"
              value={claimDate(record.financeProcessedAt)}
            />
            <Value label="Notes" value={record.paymentNotes || "—"} />
          </dl>
        </InfoSection>
      )}
    </>
  );
}

export function ClaimWorkflow({ record }: { record: ClaimRecord }) {
  const status = String(record.status);
  const returned = record.status === "RETURNED_TO_CLAIMANT";
  const rejected = record.status === "PAYMENT_REJECTED";
  const completed = record.status === "COMPLETED";
  const proofComplete = ["TRANSACTION_PROOF_UPLOADED", "COMPLETED"].includes(
    status,
  );
  const managerName = record.managerApproverId
    ? (getBetaAccount(record.managerApproverId)?.name ??
      record.managerApproverId)
    : "Manager";
  const directorName =
    getBetaAccount(
      record.directorReviewedById ?? record.directorApproverId ?? null,
    )?.name ?? "the assigned Director";
  const financeName =
    getBetaAccount(record.financeProcessedById ?? null)?.name ?? "Finance";
  const returnedStage = returned
    ? record.returnedFromStage === "DIRECTOR"
      ? "director"
      : record.returnedFromStage === "MANAGER"
        ? "manager"
        : "finance-review"
    : null;
  const stages: PaymentProgressStage[] = [
    {
      id: "submission",
      kind: "submission",
      title: `Claim submitted by ${roleLabel(record.requesterRole)}`,
      description: "The claimant submitted the Claim and supporting receipts.",
      actorName: record.requesterName,
      actorRole: roleLabel(record.requesterRole),
      state: record.status === "DRAFT" ? "current" : "complete",
      receivedAt: record.createdAt,
      completedAt: record.status === "DRAFT" ? null : record.createdAt,
    },
  ];

  if (record.managerApproverId) {
    stages.push({
      id: "manager",
      kind: "approval",
      title: "Manager review",
      description:
        returnedStage === "manager"
          ? "The Manager returned the Claim for correction."
          : record.managerApprovedAt
            ? "The Manager reviewed the Claim."
            : "Manager review is available while Finance verifies the Claim.",
      actorName: managerName,
      actorRole: "Manager",
      informational: true,
      state:
        returnedStage === "manager"
          ? "returned"
          : record.managerApprovedAt
            ? "complete"
            : status === "PENDING_MANAGER_APPROVAL"
              ? "current"
              : "pending",
      receivedAt: record.createdAt,
      completedAt:
        returnedStage === "manager"
          ? record.returnedAt
          : record.managerApprovedAt,
    });
  }

  const afterFinanceReview = [
    "PENDING_DIRECTOR_APPROVAL",
    "APPROVED_FOR_PAYMENT",
    "PAYMENT_PROCESSED",
    "TRANSACTION_PROOF_UPLOADED",
    "COMPLETED",
    "PAYMENT_REJECTED",
  ].includes(status);
  stages.push(
    {
      id: "finance-review",
      kind: "processing",
      title: "Finance verification",
      description:
        returnedStage === "finance-review"
          ? "Finance returned the Claim for correction."
          : afterFinanceReview
            ? "Finance verified the Claim and supporting receipts."
            : "Finance verifies the Claim, receipts and policy eligibility.",
      actorRole: "Finance",
      state:
        returnedStage === "finance-review"
          ? "returned"
          : afterFinanceReview
            ? "complete"
            : [
                  "CLAIM_SUBMITTED",
                  "PENDING_FINANCE_VERIFICATION",
                  "PENDING_MANAGER_APPROVAL",
                ].includes(status)
              ? "current"
              : "pending",
      receivedAt: record.createdAt,
    },
    {
      id: "director",
      kind: "approval",
      title: "Director decision",
      description:
        returnedStage === "director"
          ? "The Director returned the Claim for correction."
          : rejected
            ? "The Director rejected the Claim."
            : record.directorReviewedAt
              ? "The Director approved the Claim for payment."
              : "The Director makes the final approval decision.",
      actorName: directorName,
      actorRole: "Director",
      state: rejected
        ? "rejected"
        : returnedStage === "director"
          ? "returned"
          : record.directorReviewedAt
            ? "complete"
            : record.status === "PENDING_DIRECTOR_APPROVAL"
              ? "current"
              : "pending",
      completedAt:
        returnedStage === "director" || rejected
          ? (record.returnedAt ?? record.updatedAt)
          : record.directorReviewedAt,
    },
    {
      id: "finance-payment",
      kind: "payment",
      title: "Finance payment",
      description: record.financeProcessedAt
        ? "Finance recorded and processed the Claim payment."
        : "Finance records the payment after Director approval.",
      actorName: financeName,
      actorRole: "Finance",
      state: record.financeProcessedAt
        ? "complete"
        : ["APPROVED_FOR_PAYMENT", "PAYMENT_PROCESSED"].includes(status)
          ? "current"
          : "pending",
      receivedAt: record.directorReviewedAt,
      completedAt: record.financeProcessedAt,
    },
    {
      id: "transaction-proof",
      kind: "payment",
      title: "Payment transaction proof uploaded",
      description: proofComplete
        ? "Finance uploaded the payment transaction proof."
        : "Finance uploads transaction proof after processing payment.",
      actorName: financeName,
      actorRole: "Finance",
      state: proofComplete
        ? "complete"
        : record.status === "PAYMENT_PROCESSED"
          ? "current"
          : "pending",
      receivedAt: record.financeProcessedAt,
      completedAt:
        record.status === "TRANSACTION_PROOF_UPLOADED"
          ? record.updatedAt
          : null,
    },
    {
      id: "completed",
      kind: "completion",
      title: "Claim completed",
      description: completed
        ? record.paymentReference
          ? `Payment completed under reference ${record.paymentReference}.`
          : "Payment completed and the Claim was closed."
        : rejected
          ? "The rejected Claim is retained as a final non-payment record."
          : "The Claim closes after transaction proof is recorded.",
      state: completed ? "complete" : rejected ? "rejected" : "pending",
      receivedAt:
        record.status === "TRANSACTION_PROOF_UPLOADED"
          ? record.updatedAt
          : null,
      completedAt: completed || rejected ? record.updatedAt : null,
    },
  );

  if (returned) {
    const returnedIndex = stages.findIndex(
      (stage) => stage.state === "returned",
    );
    stages.splice(returnedIndex >= 0 ? returnedIndex + 1 : 1, 0, {
      id: "claimant-correction",
      kind: "correction",
      title: "Correct and resubmit Claim",
      description:
        record.returnRemarks ||
        "Review the return remarks, correct the Claim and resubmit it.",
      actorName: record.requesterName,
      actorRole: roleLabel(record.requesterRole),
      state: "current",
      receivedAt: record.returnedAt,
    });
  }

  const summaries: PaymentProgressSummary[] = [
    {
      label: "Current update",
      value: claimStatusLabel(record.status),
      tone: completed
        ? "success"
        : returned
          ? "warning"
          : rejected
            ? "danger"
            : "active",
    },
    {
      label: completed ? "Total processing time" : "Elapsed processing time",
      value: formatBusinessDuration(
        businessMinutesBetween(
          record.createdAt,
          completed || rejected ? record.updatedAt : new Date(),
        ),
      ),
      tone: completed ? "success" : rejected ? "danger" : "neutral",
    },
  ];
  if (record.paymentDate) {
    summaries.push({
      label: "Paid on",
      value: claimDate(record.paymentDate),
      tone: "success",
    });
  }

  return <PaymentProgressTimeline stages={stages} summaries={summaries} />;
}

function roleLabel(role: ClaimRecord["requesterRole"]) {
  return role === "manager"
    ? "Manager"
    : role === "director"
      ? "Director"
      : role === "finance"
        ? "Finance"
        : "Staff";
}

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.infoSection}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

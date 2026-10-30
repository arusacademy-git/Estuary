import { claimLineAmount } from "@/domain/payment-requests/claims/policy";
import {
  claimTypeDetails,
  type ClaimRecord,
} from "@/domain/payment-requests/claims/types";
import { standardPaymentStatusLabel } from "@/domain/payment-requests/standard-payment-status";
import { getBetaAccount } from "@/lib/auth/beta-accounts";
import { DocumentReferenceChip } from "@/shared/document-reference-chip";

import styles from "./claim-workflow.module.css";

type Stage =
  | "submitted"
  | "financeReview"
  | "director"
  | "financePayment"
  | "transactionProof"
  | "completed";

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
  const stages = workflowStages();
  const current = currentStage(record);
  const currentIndex = Math.max(0, stages.indexOf(current));
  return (
    <section className={styles.progress}>
      <header>
        <p>Payment progress</p>
        <span>
          Step {currentIndex + 1} of {stages.length}
        </span>
      </header>
      <ol>
        {stages.map((stage, index) => {
          const returned =
            record.status === "RETURNED_TO_CLAIMANT" && stage === current;
          const explicitlyComplete =
            stage === "director" ? Boolean(record.directorReviewedAt) : false;
          const complete =
            explicitlyComplete ||
            record.status === "COMPLETED" ||
            index < currentIndex;
          const state = returned
            ? "returned"
            : complete
              ? "complete"
              : index === currentIndex
                ? "active"
                : "pending";
          return (
            <li data-state={state} key={stage}>
              <i>
                {state === "complete"
                  ? "✓"
                  : state === "returned"
                    ? "!"
                    : index + 1}
              </i>
              <div>
                <strong>{stageTitle(stage, record)}</strong>
                <small>{stageDescription(stage, state, record)}</small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function workflowStages(): Stage[] {
  return [
    "submitted",
    "financeReview",
    "director",
    "financePayment",
    "transactionProof",
    "completed",
  ];
}

function currentStage(record: ClaimRecord): Stage {
  if (record.status === "PENDING_FINANCE_VERIFICATION") return "financeReview";
  if (record.status === "PENDING_DIRECTOR_APPROVAL") return "director";
  if (["APPROVED_FOR_PAYMENT", "PAYMENT_PROCESSED"].includes(record.status))
    return "financePayment";
  if (record.status === "TRANSACTION_PROOF_UPLOADED") return "transactionProof";
  if (record.status === "COMPLETED") return "completed";
  if (record.status === "RETURNED_TO_CLAIMANT") return "financeReview";
  if (record.status === "PAYMENT_REJECTED") return "director";
  return "submitted";
}

function stageTitle(stage: Stage, record: ClaimRecord) {
  if (stage === "submitted")
    return record.requesterRole === "manager"
      ? "Claim Submitted by Manager"
      : record.requesterRole === "director"
        ? "Claim Submitted by Director"
        : record.requesterRole === "finance"
          ? "Claim Submitted by Finance"
          : "Claim Submitted";
  if (stage === "financeReview") return "Finance Verification";
  if (stage === "director") return "Director Decision";
  if (stage === "financePayment") return "Finance Payment";
  if (stage === "transactionProof")
    return "Payment transaction proof uploaded";
  return "Completed";
}

function stageDescription(
  stage: Stage,
  state: "returned" | "complete" | "active" | "pending" | "informational",
  record: ClaimRecord,
) {
  if (state === "returned") return "Returned to the claimant for correction";

  if (stage === "submitted") {
    return `Submitted by ${record.requesterName} · ${claimDate(record.createdAt)}`;
  }

  if (stage === "director") {
    const name =
      getBetaAccount(
        record.directorReviewedById ?? record.directorApproverId ?? null,
      )?.name ?? "the assigned Director";
    if (state === "complete")
      return `Decision recorded by ${name}${record.directorReviewedAt ? ` · ${claimDate(record.directorReviewedAt)}` : ""}`;
    return state === "active"
      ? `Awaiting final decision by ${name}`
      : "Waiting for Director decision";
  }

  if (stage === "financeReview")
    return state === "active"
      ? "Finance is verifying the Claim and receipts"
      : "Waiting for Finance verification";

  if (stage === "financePayment") {
    const name =
      getBetaAccount(record.financeProcessedById ?? null)?.name ?? "Finance";
    if (state === "complete")
      return `Payment processed by ${name}${record.financeProcessedAt ? ` · ${claimDate(record.financeProcessedAt)}` : ""}`;
    return state === "active"
      ? "Finance is recording and verifying payment"
      : "Waiting for Finance processing";
  }

  if (stage === "transactionProof") {
    return state === "complete"
      ? "Finance uploaded the payment transaction proof"
      : "Waiting for Finance to upload the payment transaction proof";
  }

  if (state === "complete") {
    return record.paymentReference
      ? `Payment completed · Ref ${record.paymentReference}${record.paymentDate ? ` · ${claimDate(record.paymentDate)}` : ""}`
      : "Payment completed and claim closed";
  }

  return state === "active"
    ? "Final payment recorded and claim closed"
    : "Waiting for payment completion";
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

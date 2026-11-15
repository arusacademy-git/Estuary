"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchTravelAllowance } from "@/data/payment-requests/travel-allowance/api";
import {
  TRAVEL_MEAL_RATES,
  travelLineTotal,
} from "@/domain/payment-requests/travel-allowance/types";
import type {
  TravelAllowanceRecord,
  TravelAllowanceStatus,
} from "@/domain/payment-requests/travel-allowance/types";
import { standardPaymentStatusLabel } from "@/domain/payment-requests/standard-payment-status";
import {
  getBetaAccount,
  readBetaSession,
  type BetaAccount,
} from "@/lib/auth/beta-accounts";
import { PaymentRecordActionCard } from "../shared/payment-record-action-card";
import { PaymentProgressTimeline } from "../shared/payment-progress-timeline";
import {
  businessMinutesBetween,
  formatBusinessDuration,
} from "../shared/payment-progress-duration";
import type {
  PaymentProgressStage,
  PaymentProgressSummary,
} from "../shared/payment-progress-types";

import styles from "./travel-allowance-records.module.css";

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}
function date(value?: string) {
  if (!value) return "Not recorded";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-MY");
}
function canView(record: TravelAllowanceRecord, account: BetaAccount) {
  if (account.role === "staff")
    return (
      record.requesterId === account.id ||
      record.lines.some((line) => line.employeeId === account.id)
    );
  if (account.role === "manager")
    return (
      record.managerApproverId === account.id ||
      record.requesterId === account.id
    );
  if (account.role === "director")
    return record.projectDirectorId === account.id;
  return account.role === "finance";
}

export function TravelAllowanceRecordDetail({
  requestId,
}: {
  requestId: string;
}) {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [record, setRecord] = useState<TravelAllowanceRecord | null>(null);
  const [checked, setChecked] = useState(() => !account);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!account) return;

    let cancelled = false;

    fetchTravelAllowance(requestId)
      .then((value) => {
        if (!cancelled) setRecord(value);
      })
      .catch(
        (caught: unknown) =>
          !cancelled &&
          setError(
            caught instanceof Error
              ? caught.message
              : "The record could not be loaded.",
          ),
      )
      .finally(() => {
        if (!cancelled) setChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [account, requestId]);
  if (!checked)
    return (
      <State
        title="Loading Travel Allowance"
        copy="Reading the payment record…"
      />
    );
  if (!account)
    return (
      <State title="Sign in required" copy="Sign in to view this record." />
    );
  if (!record)
    return (
      <State
        title="Travel Allowance not found"
        copy={error || "The record could not be found in the database."}
      />
    );
  if (!canView(record, account))
    return (
      <State
        title="Record access required"
        copy="This Travel Allowance is not available to your account."
      />
    );

  const manager = record.managerApproverId
    ? (getBetaAccount(record.managerApproverId)?.name ??
      record.managerApproverId)
    : "Skipped";
  const director =
    getBetaAccount(record.projectDirectorId)?.name ?? record.projectDirectorId;
  const returnRemarks =
    record.status === "RETURNED_TO_STAFF"
      ? (record.financeReturnRemarks ??
        record.directorReturnRemarks ??
        record.managerReturnRemarks)
      : undefined;
  const returnRole = record.financeReturnRemarks
    ? "Finance"
    : record.directorReturnRemarks
      ? "Director"
      : "Manager";
  const returnActorId =
    record.financeReturnedById ??
    record.directorReturnedById ??
    record.managerReturnedById;
  const returnActor = returnActorId
    ? (getBetaAccount(returnActorId)?.name ?? returnActorId)
    : returnRole;
  const returnedAt =
    record.financeReturnedAt ??
    record.directorReturnedAt ??
    record.managerReturnedAt;
  const canCorrect =
    record.status === "RETURNED_TO_STAFF" && record.requesterId === account.id;
  const formHref = `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(record.id)}/form`;

  return (
    <main className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/beta/payment-records/travel-allowances">
          ← Back to Travel Allowance records
        </Link>
      </div>
      <div className={styles.detailLayout}>
        <section className={styles.detailMain}>
          <header className={styles.detailHero}>
            <div>
              <p>Travel Allowance record</p>
              <h1>{record.requestNumber}</h1>
              <span>
                Submitted by {record.requesterName} · {date(record.createdAt)}
              </span>
            </div>
            <div>
              <small>Total allowance</small>
              <strong>{money(record.totalAmount)}</strong>
              <Status status={record.status} />
            </div>
          </header>
          <Section title="Request Overview">
            <dl className={styles.detailGrid}>
              <Value label="Request date" value={date(record.requestDate)} />
              <Value label="Submitted by" value={record.requesterName} />
              <Value
                label="Request path"
                value={
                  record.requesterRole === "manager"
                    ? "Manager on behalf of Staff"
                    : "Staff self-request"
                }
              />
              <Value label="Manager" value={manager} />
              <Value label="Project Director" value={director} />
              <Value
                label="Payment target"
                value={date(record.paymentDueDate)}
              />
            </dl>
          </Section>
          <Section title="TA Form">
            <div className={styles.taFormCard}>
              <span className={styles.taFormIcon} aria-hidden="true">
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
              <div className={styles.taFormCopy}>
                <strong>Travel Allowance Form (PDF)</strong>
                <span>Generated automatically upon Director approval</span>
              </div>
              <div className={styles.taFormActions}>
                <a href={formHref} target="_blank" rel="noreferrer">
                  Preview TA Form
                </a>
                <a href={`${formHref}?download=1`}>Download TA Form (PDF)</a>
              </div>
            </div>
          </Section>
          <Section title="Travel Entries">
            <div className={styles.tableWrapper}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Reason</th>
                    <th>Meals</th>
                    <th>Special</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {record.lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
                      <td>{line.employeeName}</td>
                      <td>{date(line.travelDate)}</td>
                      <td>{line.projectName}</td>
                      <td>{line.reason}</td>
                      <td>
                        {line.meals
                          .map((meal) => `${meal} RM${TRAVEL_MEAL_RATES[meal]}`)
                          .join(", ") || "—"}
                      </td>
                      <td>
                        {money(line.specialAllowance)}
                        {line.specialAllowanceReason && (
                          <small>{line.specialAllowanceReason}</small>
                        )}
                      </td>
                      <td>
                        <strong>{money(travelLineTotal(line))}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {record.financePaymentReference && (
            <Section title="Finance Payment">
              <dl className={styles.detailGrid}>
                <Value
                  label="Payment date"
                  value={date(record.financePaymentDate)}
                />
                <Value
                  label="Payment reference"
                  value={record.financePaymentReference}
                />
                <Value
                  label="Finance remarks"
                  value={record.financeRemarks ?? "None"}
                />
              </dl>
            </Section>
          )}
          <Section title="Supporting Documents">
            <div className={styles.documents}>
              {record.supportingDocuments.length ? (
                record.supportingDocuments.map((document) => (
                  <a
                    download={document.fileName}
                    href={document.dataUrl}
                    key={document.id}
                  >
                    {document.fileName}
                  </a>
                ))
              ) : (
                <p>No supporting documents.</p>
              )}
            </div>
          </Section>
        </section>
        <aside className={styles.detailRail}>
          <PaymentRecordActionCard
            account={account}
            directorApproverId={record.projectDirectorId}
            managerApproverId={record.managerApproverId}
            paymentType="TA"
            reference={record.requestNumber}
            requestId={record.id}
            status={record.status}
          />
          {returnRemarks && (
            <div className={styles.returnNotice}>
              <div className={styles.returnNoticeHeader}>
                <strong>
                  <i />
                  Action required
                </strong>
                <span>
                  Returned by <b>{returnActor}</b>
                  {returnedAt ? ` · ${date(returnedAt)}` : ""}
                </span>
              </div>
              <small>Changes requested by {returnRole}</small>
              <blockquote>{returnRemarks}</blockquote>
              <p>
                Please review and update the meals, amounts, or justification
                notes before resubmitting.
              </p>
              {canCorrect && (
                <Link
                  className={styles.returnNoticeAction}
                  href={`/beta/payment-requests/travel-allowance/${record.id}/edit`}
                >
                  Start Corrections <b aria-hidden="true">→</b>
                </Link>
              )}
            </div>
          )}
          <Progress record={record} manager={manager} director={director} />
        </aside>
      </div>
    </main>
  );
}

function Progress({
  record,
  manager,
  director,
}: {
  record: TravelAllowanceRecord;
  manager: string;
  director: string;
}) {
  const managerPath = record.requesterRole === "staff";
  const managerReturned =
    record.status === "RETURNED_TO_STAFF" && Boolean(record.managerReturnedAt);
  const directorReturned =
    record.status === "RETURNED_TO_STAFF" && Boolean(record.directorReturnedAt);
  const financeReturned =
    record.status === "RETURNED_TO_STAFF" && Boolean(record.financeReturnedAt);
  const proofUploaded =
    Boolean(record.financeTransactionProof) ||
    ["TRANSACTION_PROOF_UPLOADED", "COMPLETED"].includes(record.status);
  const completed = record.status === "COMPLETED";
  const financeName = record.financeVerifiedById
    ? (getBetaAccount(record.financeVerifiedById)?.name ??
      record.financeVerifiedById)
    : "Finance";
  const stages: PaymentProgressStage[] = [
    {
      id: "submission",
      kind: "submission",
      title: managerPath ? "Request submitted" : "Manager request submitted",
      description: managerPath
        ? "Staff submitted the Travel Allowance for Manager review."
        : "The Manager submitted the Travel Allowance directly for Director review.",
      actorName: record.requesterName,
      actorRole: managerPath ? "Staff" : "Manager",
      state: "complete",
      receivedAt: record.createdAt,
      completedAt: record.createdAt,
    },
  ];

  if (managerPath) {
    stages.push({
      id: "manager-review",
      kind: "approval",
      title: "Manager review",
      description: managerReturned
        ? "The Manager returned this allowance for correction."
        : record.managerReviewedAt
          ? "The Manager reviewed and approved the allowance."
          : "Waiting for Manager review and approval.",
      actorName: manager,
      actorRole: "Manager",
      state: managerReturned
        ? "returned"
        : record.status === "PENDING_MANAGER_REVIEW"
          ? "current"
          : record.managerReviewedAt
            ? "complete"
            : "pending",
      receivedAt: record.createdAt,
      completedAt: record.managerReturnedAt ?? record.managerReviewedAt,
    });
  }

  stages.push(
    {
      id: "director-review",
      kind: "approval",
      title: "Director review",
      description: directorReturned
        ? "The Director returned this allowance for correction."
        : record.directorReviewedAt
          ? "The Director reviewed and approved the allowance."
          : "Director review begins after submission or Manager approval.",
      actorName: director,
      actorRole: "Director",
      state: directorReturned
        ? "returned"
        : record.status === "PENDING_DIRECTOR_APPROVAL"
          ? "current"
          : record.directorReviewedAt
            ? "complete"
            : "pending",
      receivedAt: managerPath ? record.managerReviewedAt : record.createdAt,
      completedAt: record.directorReturnedAt ?? record.directorReviewedAt,
    },
    {
      id: "finance-verification",
      kind: "processing",
      title: "Finance verification and payment",
      description: financeReturned
        ? "Finance returned this allowance for correction."
        : record.financeVerifiedAt
          ? "Finance verified the allowance and recorded its payment."
          : "Finance verifies the allowance and records payment details.",
      actorName: financeName,
      actorRole: "Finance",
      state: financeReturned
        ? "returned"
        : record.status === "PENDING_FINANCE_VERIFICATION"
          ? "current"
          : record.financeVerifiedAt
            ? "complete"
            : "pending",
      receivedAt: record.directorReviewedAt,
      completedAt: record.financeReturnedAt ?? record.financeVerifiedAt,
    },
    {
      id: "transaction-proof",
      kind: "payment",
      title: "Payment transaction proof uploaded",
      description: proofUploaded
        ? "Finance uploaded the payment transaction proof for the requester."
        : "Finance uploads transaction proof after verifying the payment.",
      actorName: financeName,
      actorRole: "Finance",
      state: proofUploaded
        ? "complete"
        : record.status === "PAYMENT_PROCESSED"
          ? "current"
          : "pending",
      receivedAt: record.financeVerifiedAt,
      completedAt:
        record.status === "TRANSACTION_PROOF_UPLOADED"
          ? record.updatedAt
          : null,
    },
    {
      id: "completed",
      kind: "completion",
      title: "Travel Allowance completed",
      description: completed
        ? record.financePaymentReference
          ? `Payment completed under reference ${record.financePaymentReference}.`
          : "Payment completed and the request was closed."
        : "The request closes after Finance records transaction proof.",
      state: completed ? "complete" : "pending",
      receivedAt:
        record.status === "TRANSACTION_PROOF_UPLOADED"
          ? record.updatedAt
          : null,
      completedAt: completed ? record.updatedAt : null,
    },
  );

  if (record.status === "RETURNED_TO_STAFF") {
    const returnedAt =
      record.financeReturnedAt ??
      record.directorReturnedAt ??
      record.managerReturnedAt;
    const returnedIndex = stages.findIndex(
      (stage) => stage.state === "returned",
    );
    stages.splice(returnedIndex >= 0 ? returnedIndex + 1 : 1, 0, {
      id: "requester-correction",
      kind: "correction",
      title: "Correct and resubmit Travel Allowance",
      description:
        record.financeReturnRemarks ??
        record.directorReturnRemarks ??
        record.managerReturnRemarks ??
        "Review the return remarks, correct the allowance and resubmit it.",
      actorName: record.requesterName,
      actorRole: managerPath ? "Staff" : "Manager",
      state: "current",
      receivedAt: returnedAt,
    });
  }

  const summaries: PaymentProgressSummary[] = [
    {
      label: "Current update",
      value: standardPaymentStatusLabel(record.status),
      tone: completed
        ? "success"
        : record.status === "RETURNED_TO_STAFF"
          ? "warning"
          : "active",
    },
    {
      label: completed ? "Total processing time" : "Elapsed processing time",
      value: formatBusinessDuration(
        businessMinutesBetween(
          record.createdAt,
          completed ? record.updatedAt : new Date(),
        ),
      ),
      tone: completed ? "success" : "neutral",
    },
  ];

  if (record.financePaymentDate) {
    summaries.push({
      label: "Paid on",
      value: date(record.financePaymentDate),
      tone: "success",
    });
  }

  return <PaymentProgressTimeline stages={stages} summaries={summaries} />;
}
function Status({ status }: { status: TravelAllowanceStatus }) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      {standardPaymentStatusLabel(status)}
    </span>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.detailSection}>
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
function State({ title, copy }: { title: string; copy: string }) {
  return (
    <main className={styles.statePage}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href="/beta/payment-records">Back to Payment Records</Link>
    </main>
  );
}

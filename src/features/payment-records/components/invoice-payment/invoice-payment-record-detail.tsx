"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchInvoicePayment } from "@/data/payment-requests/invoice-payment/api";
import type {
  InvoicePaymentRequestRecord,
  PaymentRequestDocument,
  PaymentRequestStatus,
} from "@/domain/payment-requests/invoice-payment/types";
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

import styles from "./invoice-payment-records.module.css";

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}
function date(value?: string) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed);
}
function download(document: PaymentRequestDocument) {
  const link = window.document.createElement("a");
  link.href = document.dataUrl;
  link.download = document.fileName;
  link.click();
}
function canView(record: InvoicePaymentRequestRecord, account: BetaAccount) {
  return account.role === "staff"
    ? record.staffId === account.id
    : account.role === "manager"
      ? record.managerApproverId === account.id
      : account.role === "director"
        ? record.directorApproverId === account.id
        : true;
}

export function InvoicePaymentRecordDetail({
  requestId,
}: {
  requestId: string;
}) {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [record, setRecord] = useState<InvoicePaymentRequestRecord | null>(
    null,
  );
  const [checked, setChecked] = useState(() => !account);
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    fetchInvoicePayment(requestId)
      .then((value) => {
        if (!cancelled) setRecord(value);
      })
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
        title="Loading Invoice Payment"
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
        title="Invoice Payment not found"
        copy="The record could not be found in PostgreSQL."
      />
    );
  if (!canView(record, account))
    return (
      <State
        title="Record access required"
        copy="This Invoice Payment is not available to your account."
      />
    );

  const manager =
    getBetaAccount(record.managerApproverId)?.name ?? record.managerApproverId;
  const director =
    getBetaAccount(record.directorApproverId)?.name ??
    record.directorApproverId;
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
    record.status === "RETURNED_TO_STAFF" &&
    account.role === "staff" &&
    record.staffId === account.id;
  return (
    <main className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/beta/payment-records/invoice-payments">
          ← Back to Invoice Payment records
        </Link>
      </div>
      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <header className={styles.detailHero}>
            <div>
              <p>Invoice Payment record</p>
              <h1>{record.requestNumber}</h1>
              <span>
                Submitted by {record.staffName} · {date(record.createdAt)}
              </span>
            </div>
            <div>
              <small>Amount requested</small>
              <strong>{money(record.totalAmount)}</strong>
              <Status status={record.status} />
            </div>
          </header>
          <Section title="Request Overview">
            <dl className={styles.detailGrid}>
              <Value label="Request date" value={date(record.requestDate)} />
              <Value label="Staff" value={record.staffName} />
              <Value label="Project" value={record.projectName} />
              <Value label="Vendor" value={record.vendorName} />
            </dl>
          </Section>
          <Section title="Invoice & Payment">
            <dl className={styles.detailGrid}>
              <Value label="Invoice total" value={money(record.invoiceTotal)} />
              <Value label="Tax / SST" value={money(record.taxAmount)} />
              <Value
                label="Amount requested"
                value={money(record.requestedAmount)}
              />
              <Value
                label="Transfer type"
                value={
                  record.transferType === "GIRO"
                    ? "GIRO transfer"
                    : "Instant transfer"
                }
              />
              <div>
                <dt>E-invoice</dt>
                <dd>
                  <a
                    href={record.eInvoiceLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open e-invoice ↗
                  </a>
                </dd>
              </div>
            </dl>
            <div className={styles.longValue}>
              <span>Purpose</span>
              <p>{record.purpose}</p>
            </div>
          </Section>
          <Section title="Supporting Documents">
            <div className={styles.documents}>
              {record.supportingDocuments.map((document) => (
                <div key={document.id}>
                  <span className={styles.documentIcon}>▧</span>
                  <div>
                    <strong>{document.fileName}</strong>
                    <span>
                      {Math.max(1, Math.round(document.size / 1024))} KB
                    </span>
                  </div>
                  <button type="button" onClick={() => download(document)}>
                    Download
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>
        <aside className={styles.detailRail}>
          <PaymentRecordActionCard
            account={account}
            directorApproverId={record.directorApproverId}
            managerApproverId={record.managerApproverId}
            paymentType="INV"
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
                Please review and update the e-invoice link, amounts, or
                justification notes before resubmitting.
              </p>
              {canCorrect && (
                <Link
                  className={styles.returnNoticeAction}
                  href={`/beta/payment-requests/invoice-payment/${record.id}/edit`}
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
  record: InvoicePaymentRequestRecord;
  manager: string;
  director: string;
}) {
  const managerReturned =
    record.status === "RETURNED_TO_STAFF" && Boolean(record.managerReturnedAt);
  const directorReturned =
    record.status === "RETURNED_TO_STAFF" && Boolean(record.directorReturnedAt);
  const financeReturned =
    record.status === "RETURNED_TO_STAFF" && Boolean(record.financeReturnedAt);
  const managerComplete = Boolean(record.managerReviewedAt);
  const directorComplete = Boolean(record.directorReviewedAt);
  const financeComplete = Boolean(record.financeVerifiedAt);
  const proofComplete = ["TRANSACTION_PROOF_UPLOADED", "COMPLETED"].includes(
    record.status,
  );
  const completed = record.status === "COMPLETED";
  const financeName = record.financeVerifiedById
    ? (getBetaAccount(record.financeVerifiedById)?.name ??
      record.financeVerifiedById)
    : "Finance";

  const stages: PaymentProgressStage[] = [
    {
      id: "submission",
      kind: "submission",
      title: "Request Submitted",
      description: "Invoice Payment submitted for review.",
      actorName: record.staffName,
      actorRole: "Staff",
      state: record.status === "DRAFT" ? "current" : "complete",
      receivedAt: record.createdAt,
      completedAt: record.status === "DRAFT" ? null : record.createdAt,
    },
    {
      id: "manager-review",
      kind: "approval",
      title: "Manager Review",
      description: managerReturned
        ? "The Manager returned this request for correction."
        : managerComplete
          ? "The Manager reviewed and approved this request."
          : "Waiting for Manager review and approval.",
      actorName: manager,
      actorRole: "Manager",
      state: managerReturned
        ? "returned"
        : record.status === "PENDING_MANAGER_REVIEW"
          ? "current"
          : managerComplete
            ? "complete"
            : "pending",
      receivedAt: record.createdAt,
      completedAt: record.managerReturnedAt ?? record.managerReviewedAt,
    },
    {
      id: "director-review",
      kind: "approval",
      title: "Director Review",
      description: directorReturned
        ? "The Director returned this request for correction."
        : directorComplete
          ? "The Director reviewed and approved this request."
          : "Director review begins after Manager approval.",
      actorName: director,
      actorRole: "Director",
      state: directorReturned
        ? "returned"
        : record.status === "PENDING_DIRECTOR_REVIEW"
          ? "current"
          : directorComplete
            ? "complete"
            : "pending",
      receivedAt: record.managerReviewedAt,
      completedAt: record.directorReturnedAt ?? record.directorReviewedAt,
    },
    {
      id: "finance-verification",
      kind: "processing",
      title: "Finance Verification",
      description: financeReturned
        ? "Finance returned this request for correction."
        : financeComplete
          ? "Finance verified the payment details."
          : "Finance verifies the approved invoice and payment details.",
      actorName: financeName,
      actorRole: "Finance",
      state: financeReturned
        ? "returned"
        : record.status === "PENDING_FINANCE_REVIEW"
          ? "current"
          : financeComplete
            ? "complete"
            : "pending",
      receivedAt: record.directorReviewedAt,
      completedAt: record.financeReturnedAt ?? record.financeVerifiedAt,
    },
    {
      id: "transaction-proof",
      kind: "payment",
      title: "Payment transaction proof uploaded",
      description: proofComplete
        ? "Finance uploaded the payment transaction proof for the requester."
        : "Transaction proof is uploaded after Finance verification.",
      actorRole: "Finance",
      state:
        record.status === "PAYMENT_PROCESSED"
          ? "current"
          : proofComplete
            ? "complete"
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
      title: "Completed",
      description: completed
        ? "Payment verified and request successfully closed."
        : "The request closes after transaction proof is recorded.",
      state: completed ? "complete" : "pending",
      receivedAt:
        record.status === "TRANSACTION_PROOF_UPLOADED"
          ? record.updatedAt
          : null,
      completedAt: completed ? record.updatedAt : null,
    },
  ];

  if (record.status === "RETURNED_TO_STAFF") {
    const returnedAt =
      record.financeReturnedAt ??
      record.directorReturnedAt ??
      record.managerReturnedAt;
    const returnedIndex = stages.findIndex(
      (stage) => stage.state === "returned",
    );
    const correctionIndex = returnedIndex >= 0 ? returnedIndex + 1 : 1;
    stages.splice(correctionIndex, 0, {
      id: "requester-correction",
      kind: "correction",
      title: "Requester correction and resubmission",
      description:
        "The requester must amend the returned Invoice Payment and resubmit it.",
      actorName: record.staffName,
      actorRole: "Staff",
      state: "current",
      receivedAt: returnedAt,
    });
  }

  const lifecycleEnd = completed ? record.updatedAt : new Date();
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
        businessMinutesBetween(record.createdAt, lifecycleEnd),
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
function Status({ status }: { status: PaymentRequestStatus }) {
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

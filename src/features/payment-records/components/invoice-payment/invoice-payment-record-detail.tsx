"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchInvoicePayment } from "@/data/payment-requests/invoice-payment/api";
import type {
  InvoicePaymentRequestRecord,
  PaymentRequestDocument,
  PaymentRequestStatus,
} from "@/domain/payment-requests/invoice-payment/types";
import {
  getBetaAccount,
  readBetaSession,
  type BetaAccount,
} from "@/lib/auth/beta-accounts";

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
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<InvoicePaymentRequestRecord | null>(
    null,
  );
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setAccount(readBetaSession());
    fetchInvoicePayment(requestId)
      .then(setRecord)
      .finally(() => setChecked(true));
  }, [requestId]);
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
          {returnRemarks && (
            <div className={styles.returnNotice}>
              <div className={styles.returnNoticeHeader}>
                <strong><i />Action required</strong>
                <span>Returned by <b>{returnActor}</b>{returnedAt ? ` · ${date(returnedAt)}` : ""}</span>
              </div>
              <small>Changes requested by {returnRole}</small>
              <blockquote>{returnRemarks}</blockquote>
              <p>Please review and update the e-invoice link, amounts, or justification notes before resubmitting.</p>
              {canCorrect && <Link className={styles.returnNoticeAction} href={`/beta/payment-requests/invoice-payment/${record.id}/edit`}>Start Corrections <b aria-hidden="true">→</b></Link>}
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
  const active = stageFor(record);
  const steps = [
    {
      title: "Request Submitted",
      copy: `Submitted by ${record.staffName}`,
      date: record.createdAt,
    },
    { title: "Manager Review", copy: `Reviewed and approved by ${manager}`, date: record.managerReviewedAt },
    {
      title: "Director Review",
      copy: `Reviewed and approved by ${director}`,
      date: record.directorReviewedAt,
    },
    {
      title: "Finance Verification",
      copy: `Payment details verified by ${record.financeVerifiedById
        ? (getBetaAccount(record.financeVerifiedById)?.name ??
          record.financeVerifiedById)
        : "Finance"}`,
      date: record.financeVerifiedAt,
    },
    {
      title: "Completed",
      copy: "Payment verified and request successfully closed",
      date: record.financeVerifiedAt,
    },
  ];
  return (
    <section className={styles.progressPanel}>
      <header>
        <p>Payment progress</p>
        <span>Step {active} of 5</span>
      </header>
      <ol>
        {steps.map((step, index) => {
          const number = index + 1;
          const completed =
            number < active || (record.status === "COMPLETED" && number === 5);
          const state = completed
            ? "complete"
            : number === active
              ? record.status === "RETURNED_TO_STAFF"
                ? "returned"
                : "active"
              : "pending";
          return (
            <li
              className={styles.progressStep}
              data-state={state}
              key={step.title}
            >
              <i>{completed ? "✓" : ""}</i>
              <div>
                <strong>
                  {step.title}
                  {state === "returned" && (
                    <em className={styles.returnedTag}>Returned</em>
                  )}
                </strong>
                <small>
                  {step.copy}
                  {step.date ? ` · ${date(step.date)}` : ""}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
function stageFor(record: InvoicePaymentRequestRecord) {
  if (record.status === "PENDING_MANAGER_REVIEW") return 2;
  if (record.status === "PENDING_DIRECTOR_REVIEW") return 3;
  if (record.status === "PENDING_FINANCE_REVIEW") return 4;
  if (record.status === "COMPLETED") return 5;
  if (record.status === "RETURNED_TO_STAFF")
    return record.financeReturnedAt ? 4 : record.directorReturnedAt ? 3 : 2;
  return 1;
}
const labels: Record<PaymentRequestStatus, string> = {
  DRAFT: "Draft",
  PENDING_MANAGER_REVIEW: "Pending Manager Review",
  PENDING_DIRECTOR_REVIEW: "Pending Director Review",
  PENDING_FINANCE_REVIEW: "Pending Finance Verification",
  COMPLETED: "Completed",
  RETURNED_TO_STAFF: "Returned to Staff",
};
function Status({ status }: { status: PaymentRequestStatus }) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      {labels[status]}
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

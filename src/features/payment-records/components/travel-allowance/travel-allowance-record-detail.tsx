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
import {
  getBetaAccount,
  readBetaSession,
  type BetaAccount,
} from "@/lib/auth/beta-accounts";

import styles from "./travel-allowance-records.module.css";

const labels: Record<TravelAllowanceStatus, string> = {
  PENDING_MANAGER_REVIEW: "Pending Manager Review",
  PENDING_DIRECTOR_APPROVAL: "Pending Director Approval",
  PENDING_FINANCE_VERIFICATION: "Pending Finance Verification",
  RETURNED_TO_STAFF: "Returned to requester",
  COMPLETED: "Completed",
};
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
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<TravelAllowanceRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const session = readBetaSession();
    setAccount(session);
    if (!session) {
      setChecked(true);
      return;
    }

    fetchTravelAllowance(requestId)
      .then(setRecord)
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "The record could not be loaded.",
        ),
      )
      .finally(() => setChecked(true));
  }, [requestId]);
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
          {returnRemarks && (
            <div className={styles.returnNotice}>
              <div className={styles.returnNoticeHeader}>
                <strong><i />Action required</strong>
                <span>Returned by <b>{returnActor}</b>{returnedAt ? ` · ${date(returnedAt)}` : ""}</span>
              </div>
              <small>Changes requested by {returnRole}</small>
              <blockquote>{returnRemarks}</blockquote>
              <p>Please review and update the meals, amounts, or justification notes before resubmitting.</p>
              {canCorrect && <Link className={styles.returnNoticeAction} href={`/beta/payment-requests/travel-allowance/${record.id}/edit`}>Start Corrections <b aria-hidden="true">→</b></Link>}
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
  const steps = managerPath
    ? [
        {
          title: "Request Submitted",
          copy: `Submitted by ${record.requesterName}`,
          time: record.createdAt,
        },
        {
          title: "Manager Review",
          copy: `Reviewed and approved by ${manager}`,
          time: record.managerReviewedAt,
        },
        {
          title: "Director Review",
          copy: `Reviewed and approved by ${director}`,
          time: record.directorReviewedAt,
        },
        {
          title: "Finance Verification",
          copy: `Allowance verified by ${record.financeVerifiedById
            ? (getBetaAccount(record.financeVerifiedById)?.name ??
              record.financeVerifiedById)
            : "Finance"}`,
          time: record.financeVerifiedAt,
        },
        {
          title: "Completed",
          copy: record.financePaymentReference
            ? `Payment completed · Ref ${record.financePaymentReference}`
            : "Payment completed and request closed",
          time: record.financeVerifiedAt,
        },
      ]
    : [
        {
          title: "Manager Request Submitted",
          copy: `Submitted by ${record.requesterName}`,
          time: record.createdAt,
        },
        {
          title: "Director Review",
          copy: `Reviewed and approved by ${director}`,
          time: record.directorReviewedAt,
        },
        {
          title: "Finance Verification",
          copy: `Allowance verified by ${record.financeVerifiedById
            ? (getBetaAccount(record.financeVerifiedById)?.name ??
              record.financeVerifiedById)
            : "Finance"}`,
          time: record.financeVerifiedAt,
        },
        {
          title: "Completed",
          copy: record.financePaymentReference
            ? `Payment completed · Ref ${record.financePaymentReference}`
            : "Payment completed and request closed",
          time: record.financeVerifiedAt,
        },
      ];
  const active =
    record.status === "PENDING_MANAGER_REVIEW"
      ? 2
      : record.status === "PENDING_DIRECTOR_APPROVAL"
        ? managerPath
          ? 3
          : 2
        : record.status === "PENDING_FINANCE_VERIFICATION"
          ? managerPath
            ? 4
            : 3
          : record.status === "COMPLETED"
            ? steps.length
            : record.financeReturnedAt
              ? managerPath
                ? 4
                : 3
              : record.directorReturnedAt
                ? managerPath
                  ? 3
                  : 2
                : 2;
  return (
    <section className={styles.progressPanel}>
      <header>
        <p>Payment progress</p>
        <span>
          Step {active} of {steps.length}
        </span>
      </header>
      <ol>
        {steps.map((step, index) => {
          const number = index + 1;
          const complete =
            number < active ||
            (record.status === "COMPLETED" && number === steps.length);
          const state = complete
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
              <i>{complete ? "✓" : ""}</i>
              <div>
                <strong>
                  {step.title}
                  {state === "returned" && (
                    <em className={styles.returnedTag}>Returned</em>
                  )}
                </strong>
                <small>
                  {step.copy}
                  {step.time ? ` · ${date(step.time)}` : ""}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
function Status({ status }: { status: TravelAllowanceStatus }) {
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

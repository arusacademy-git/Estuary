"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPettyCashRequest } from "@/data/payment-requests/petty-cash/api";
import type { PettyCashRecord } from "@/domain/payment-requests/petty-cash/types";
import {
  getBetaAccount,
  readBetaSession,
  type BetaAccount,
} from "@/lib/auth/beta-accounts";
import { PettyCashStatusBadge } from "../petty-cash-status-badge";
import { PettyCashReconciliationForm } from "./petty-cash-reconciliation";
import { PaymentRecordActionCard } from "@/features/payment-records/components/shared/payment-record-action-card";
import { PaymentProgressTimeline } from "@/features/payment-records/components/shared/payment-progress-timeline";
import {
  businessMinutesBetween,
  formatBusinessDuration,
} from "@/features/payment-records/components/shared/payment-progress-duration";
import type {
  PaymentProgressStage,
  PaymentProgressSummary,
} from "@/features/payment-records/components/shared/payment-progress-types";
import styles from "../petty-cash.module.css";

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
function canView(record: PettyCashRecord, account: BetaAccount) {
  if (record.requesterId === account.id) return true;
  if (account.role === "manager")
    return (
      record.managerApproverId === account.id ||
      record.financeReviewerId === account.id
    );
  if (account.role === "director")
    return (
      record.directorApproverId === account.id ||
      record.financeReviewerId === account.id
    );
  return account.role === "finance";
}

export function PettyCashDetail({
  requestId,
  showRoleAction = false,
}: {
  requestId: string;
  showRoleAction?: boolean;
}) {
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [record, setRecord] = useState<PettyCashRecord | null>(null);
  const [checked, setChecked] = useState(() => !account);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    fetchPettyCashRequest(requestId)
      .then((value) => {
        if (!cancelled) setRecord(value);
      })
      .catch((caught) => {
        if (!cancelled)
          setError(
            caught instanceof Error
              ? caught.message
              : "The request could not be loaded.",
          );
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
        title="Loading Petty Cash request"
        copy="Reading the payment record…"
      />
    );
  if (!account)
    return (
      <State
        title="Sign in required"
        copy="Sign in to view this Petty Cash request."
      />
    );
  if (!record)
    return (
      <State
        title="Petty Cash request not found"
        copy={error || "The request could not be found."}
      />
    );
  if (!canView(record, account))
    return (
      <State
        title="Record access required"
        copy="This Petty Cash request is not available to your account."
      />
    );

  const manager =
    getBetaAccount(record.managerApproverId)?.name ?? record.managerApproverId;
  const location = record.location === "PENANG" ? "Penang" : "Kuala Lumpur";
  const canCorrect =
    record.status === "RETURNED_TO_STAFF" && record.requesterId === account.id;
  const isRequesterReconciliation =
    record.status === "PENDING_RECONCILIATION" &&
    record.requesterId === account.id;

  if (isRequesterReconciliation) {
    return (
      <main
        className={`${styles.page} ${styles.detailPage} ${styles.reconciliationPage}`}
      >
        <div className={styles.backRow}>
          <Link href="/beta/payment-records/petty-cash">
            ← Back to Petty Cash records
          </Link>
        </div>
        <header className={`${styles.detailHero} ${styles.reconciliationHero}`}>
          <div>
            <p>Petty Cash record</p>
            <h1>{record.requestNumber}</h1>
            <span>
              Submitted by {record.requesterName} · {date(record.createdAt)}
            </span>
          </div>
          <div>
            <small>Request total</small>
            <strong>{money(record.totalAmount)}</strong>
            <PettyCashStatusBadge status={record.status} />
          </div>
        </header>

        {record.returnRemarks && (
          <div className={styles.detailReturnNotice}>
            <strong>Reconciliation returned for correction</strong>
            <blockquote>{record.returnRemarks}</blockquote>
          </div>
        )}

        <div className={styles.reconciliationLayout}>
          <PettyCashReconciliationForm
            onSubmitted={setRecord}
            record={record}
            requesterId={account.id}
          />
          <aside className={styles.reconciliationContextCard}>
            <section className={styles.reconciliationContextSection}>
              <h2>Request overview</h2>
              <dl className={styles.reconciliationContextGrid}>
                <Value label="Request date" value={date(record.requestDate)} />
                <Value label="Requester" value={record.requesterName} />
                <Value label="Position" value={record.requesterPosition} />
                <Value label="Manager" value={manager} />
                <Value label="Office fund" value={`${location} Petty Cash`} />
                <Value label="Contact" value={record.requesterContact} />
              </dl>
            </section>

            <section className={styles.reconciliationContextSection}>
              <h2>Planned expenses</h2>
              <div className={styles.reconciliationTableWrap}>
                <table className={styles.reconciliationTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Details / purpose</th>
                      <th>Account</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.lines.map((line, index) => (
                      <tr key={line.id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{line.details}</strong>
                          <small>{line.division}</small>
                        </td>
                        <td>{line.accountType}</td>
                        <td>
                          <strong>{money(line.amount)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.reconciliationContextTotal}>
                <span>Total requested</span>
                <strong>{money(record.totalAmount)}</strong>
              </div>
            </section>

            <section className={styles.reconciliationContextSection}>
              <h2>Finance payment</h2>
              <dl className={styles.reconciliationContextGrid}>
                <Value label="Payment date" value={date(record.paymentDate)} />
                <Value
                  label="Reference"
                  value={record.paymentReference || record.requestNumber}
                />
              </dl>
              {record.paymentProofLink && (
                <a
                  className={styles.reconciliationProofLink}
                  href={record.paymentProofLink}
                  rel="noreferrer"
                  target="_blank"
                >
                  Preview payment proof ↗
                </a>
              )}
            </section>

            <Progress record={record} manager={manager} />
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className={`${styles.page} ${styles.detailPage}`}>
      <div className={styles.backRow}>
        <Link href="/beta/payment-records/petty-cash">
          ← Back to Petty Cash records
        </Link>
      </div>
      <div className={styles.detailLayout}>
        <section className={styles.detailMain}>
          <header className={styles.detailHero}>
            <div>
              <p>Petty Cash record</p>
              <h1>{record.requestNumber}</h1>
              <span>
                Submitted by {record.requesterName} · {date(record.createdAt)}
              </span>
            </div>
            <div>
              <small>Request total</small>
              <strong>{money(record.totalAmount)}</strong>
              <PettyCashStatusBadge status={record.status} />
            </div>
          </header>
          <DetailSection title="Request overview">
            <dl className={styles.detailGrid}>
              <Value label="Request date" value={date(record.requestDate)} />
              <Value label="Requester" value={record.requesterName} />
              <Value label="Position" value={record.requesterPosition} />
              <Value label="Office fund" value={`${location} Petty Cash`} />
              <Value label="Manager" value={manager} />
              <Value label="Contact" value={record.requesterContact} />
            </dl>
          </DetailSection>
          <DetailSection title="Planned expenses">
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Details / purpose</th>
                    <th>Account</th>
                    <th>Division</th>
                    <th>Estimated amount</th>
                  </tr>
                </thead>
                <tbody>
                  {record.lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
                      <td>{line.details}</td>
                      <td>{line.accountType}</td>
                      <td>{line.division}</td>
                      <td>
                        <strong>{money(line.amount)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.detailTotal}>
              <span>Total requested</span>
              <strong>{money(record.totalAmount)}</strong>
            </div>
          </DetailSection>
          {record.notes && (
            <DetailSection title="Notes / purpose">
              <p className={styles.detailCopy}>{record.notes}</p>
            </DetailSection>
          )}
          {record.paymentReference && (
            <DetailSection title="Finance payment">
              <dl className={styles.detailGrid}>
                <Value label="Payment date" value={date(record.paymentDate)} />
                <Value label="Reference" value={record.paymentReference} />
                <div>
                  <dt>Payment proof</dt>
                  <dd>
                    {record.paymentProofLink ? (
                      <a
                        href={record.paymentProofLink}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Preview payment proof
                      </a>
                    ) : (
                      "Not recorded"
                    )}
                  </dd>
                </div>
              </dl>
            </DetailSection>
          )}
          {record.status === "PENDING_RECONCILIATION" &&
            record.returnRemarks && (
              <div className={styles.detailReturnNotice}>
                <strong>Reconciliation returned for correction</strong>
                <blockquote>{record.returnRemarks}</blockquote>
              </div>
            )}
          {record.status === "PENDING_RECONCILIATION" &&
            record.requesterId === account.id && (
              <PettyCashReconciliationForm
                onSubmitted={setRecord}
                record={record}
                requesterId={account.id}
              />
            )}
          {record.reconciliation && (
            <DetailSection title="Reconciliation">
              <dl className={styles.detailGrid}>
                <Value
                  label="Actual spent"
                  value={money(record.reconciliation.actualSpent)}
                />
                <Value
                  label="Returned balance"
                  value={money(record.reconciliation.returnedBalance)}
                />
                <Value
                  label="Submitted"
                  value={date(record.reconciliation.submittedAt)}
                />
                <Value
                  label="No balance declaration"
                  value={
                    record.reconciliation.noBalanceRemark || "Not applicable"
                  }
                />
              </dl>
              <div className={styles.reconciliationFiles}>
                {record.reconciliation.receipts.map((receipt) => (
                  <a
                    href={receipt.dataUrl}
                    key={receipt.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {receipt.fileName}
                  </a>
                ))}
              </div>
              {record.reconciliation.balanceReturnProof && (
                <p>
                  <a
                    href={record.reconciliation.balanceReturnProof.dataUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open balance return proof
                  </a>
                </p>
              )}
            </DetailSection>
          )}
        </section>
        <aside className={styles.detailRail}>
          {showRoleAction && (
            <PaymentRecordActionCard
              account={account}
              directorApproverId={record.directorApproverId}
              managerApproverId={record.managerApproverId}
              paymentType="PC"
              reference={record.requestNumber}
              requestId={record.id}
              status={record.status}
            />
          )}
          {record.status === "RETURNED_TO_STAFF" && record.returnRemarks && (
            <div className={styles.detailReturnNotice}>
              <strong>Action required</strong>
              <small>Manager&apos;s remarks</small>
              <blockquote>{record.returnRemarks}</blockquote>
              <p>
                Update the requested information and resubmit it to the Manager.
              </p>
              {canCorrect && (
                <Link
                  href={`/beta/payment-requests/petty-cash/new?amend=${encodeURIComponent(record.id)}`}
                >
                  Start Corrections →
                </Link>
              )}
            </div>
          )}
          <Progress record={record} manager={manager} />
        </aside>
      </div>
    </main>
  );
}

function Progress({
  record,
  manager,
}: {
  record: PettyCashRecord;
  manager: string;
}) {
  const requesterRole = record.requesterRole ?? "staff";
  const director =
    getBetaAccount(record.directorApproverId)?.name ?? "Director";
  const finance = record.financeVerifiedById
    ? (getBetaAccount(record.financeVerifiedById)?.name ??
      record.financeVerifiedById)
    : "Finance";
  const reconciliationSubmittedAt = record.reconciliation?.submittedAt;
  const reconciliationCompletedAt = record.reconciliation?.financeVerifiedAt;
  const reconciled = record.status === "RECONCILED";
  const returned = record.status === "RETURNED_TO_STAFF";
  const returnedStage = !returned
    ? null
    : record.returnedById === record.managerApproverId
      ? "manager-review"
      : record.returnedById === record.directorApproverId
        ? "director-review"
        : reconciliationSubmittedAt || record.paidAt
          ? "finance-reconciliation"
          : "finance-processing";
  const proofComplete =
    Boolean(record.paymentProofLink) ||
    [
      "TRANSACTION_PROOF_UPLOADED",
      "PENDING_RECONCILIATION",
      "PENDING_FINANCE_RECONCILIATION",
      "RECONCILED",
    ].includes(record.status);
  const stages: PaymentProgressStage[] = [
    {
      id: "submission",
      kind: "submission",
      title: "Petty Cash submitted",
      description: "The requester submitted the planned Petty Cash expenses.",
      actorName: record.requesterName,
      actorRole: requesterRole,
      state: "complete",
      receivedAt: record.createdAt,
      completedAt: record.createdAt,
    },
  ];

  if (requesterRole === "staff") {
    stages.push(
      {
        id: "manager-review",
        kind: "approval",
        title: "Manager approval",
        description:
          returnedStage === "manager-review"
            ? "The Manager returned the request for correction."
            : record.managerApprovedAt
              ? "The Manager approved the Petty Cash request."
              : "Waiting for mandatory Manager approval.",
        actorName: manager,
        actorRole: "Manager",
        state:
          returnedStage === "manager-review"
            ? "returned"
            : record.managerApprovedAt
              ? "complete"
              : record.status === "PENDING_MANAGER_APPROVAL"
                ? "current"
                : "pending",
        receivedAt: record.createdAt,
        completedAt:
          returnedStage === "manager-review"
            ? record.returnedAt
            : record.managerApprovedAt,
      },
      {
        id: "director-review",
        kind: "approval",
        title: "Director approval",
        description:
          returnedStage === "director-review"
            ? "The Director returned the request for correction."
            : record.directorApprovedAt
              ? "The Director approved the Petty Cash request."
              : "Director approval begins after Manager approval.",
        actorName: director,
        actorRole: "Director",
        state:
          returnedStage === "director-review"
            ? "returned"
            : record.directorApprovedAt
              ? "complete"
              : record.status === "PENDING_DIRECTOR_APPROVAL"
                ? "current"
                : "pending",
        receivedAt: record.managerApprovedAt,
        completedAt:
          returnedStage === "director-review"
            ? record.returnedAt
            : record.directorApprovedAt,
      },
    );
  } else if (requesterRole === "manager") {
    stages.push({
      id: "director-preview",
      kind: "approval",
      title: "Director preview",
      description: record.directorApprovedAt
        ? "The Director previewed the request."
        : "Informational preview; Finance is not blocked.",
      actorName: director,
      actorRole: "Director",
      informational: true,
      state: record.directorApprovedAt ? "complete" : "pending",
      receivedAt: record.createdAt,
      completedAt: record.directorApprovedAt,
    });
  } else if (requesterRole === "finance") {
    const previewAt =
      record.requesterReviewedAt ??
      (record.financeReviewerRole === "director"
        ? record.directorApprovedAt
        : record.managerApprovedAt);
    stages.push({
      id: "independent-preview",
      kind: "approval",
      title: "Independent preview",
      description: previewAt
        ? "The assigned independent reviewer previewed the request."
        : "Informational independent preview; Finance processing is not blocked.",
      actorName: record.financeReviewerId
        ? getBetaAccount(record.financeReviewerId)?.name
        : undefined,
      actorRole: record.financeReviewerRole,
      informational: true,
      state: previewAt ? "complete" : "pending",
      receivedAt: record.createdAt,
      completedAt: previewAt,
    });
  }

  const approvalEnd =
    requesterRole === "staff" ? record.directorApprovedAt : record.createdAt;
  stages.push(
    {
      id: "finance-processing",
      kind: "payment",
      title: "Finance verification and payment",
      description:
        returnedStage === "finance-processing"
          ? "Finance returned the request for correction."
          : record.paidAt
            ? "Finance verified and released the Petty Cash payment."
            : "Finance verifies the request and releases payment.",
      actorName: finance,
      actorRole: "Finance",
      state:
        returnedStage === "finance-processing"
          ? "returned"
          : record.paidAt
            ? "complete"
            : ["PENDING_FINANCE_REVIEW", "PENDING_FINANCE_PAYMENT"].includes(
              record.status,
            )
              ? "current"
              : "pending",
      receivedAt: approvalEnd,
      actionStartedAt: record.financeVerifiedAt,
      completedAt:
        returnedStage === "finance-processing"
          ? record.returnedAt
          : record.paidAt,
    },
    {
      id: "transaction-proof",
      kind: "payment",
      title: "Payment transaction proof uploaded",
      description: proofComplete
        ? "Finance uploaded the payment transaction proof."
        : "Finance uploads transaction proof after releasing payment.",
      actorName: finance,
      actorRole: "Finance",
      state: proofComplete
        ? "complete"
        : [
          "FINANCE_VERIFIED",
          "TRANSACTION_PROOF_UPLOADED",
          "PAYMENT_PROCESSED",
          "PAID",
        ].includes(record.status)
          ? "current"
          : "pending",
      receivedAt: record.paidAt,
    },
    {
      id: "reconciliation-submission",
      kind: "reconciliation",
      title: "Requester reconciliation",
      description: reconciliationSubmittedAt
        ? "The requester submitted receipts and balance information."
        : "The requester must upload receipts and account for unused balance.",
      actorName: record.requesterName,
      actorRole: requesterRole,
      state: reconciliationSubmittedAt
        ? "complete"
        : record.status === "PENDING_RECONCILIATION"
          ? "current"
          : "pending",
      receivedAt: record.paidAt,
      completedAt: reconciliationSubmittedAt,
    },
    {
      id: "finance-reconciliation",
      kind: "reconciliation",
      title: "Finance reconciliation review",
      description:
        returnedStage === "finance-reconciliation"
          ? "Finance returned the reconciliation for correction."
          : reconciled
            ? "Finance verified the receipts and returned balance."
            : "Finance reviews the submitted reconciliation evidence.",
      actorName: record.reconciliation?.financeVerifiedById
        ? getBetaAccount(record.reconciliation.financeVerifiedById)?.name
        : undefined,
      actorRole: "Finance",
      state:
        returnedStage === "finance-reconciliation"
          ? "returned"
          : reconciled
            ? "complete"
            : record.status === "PENDING_FINANCE_RECONCILIATION"
              ? "current"
              : "pending",
      receivedAt: reconciliationSubmittedAt,
      completedAt:
        returnedStage === "finance-reconciliation"
          ? record.returnedAt
          : reconciliationCompletedAt,
    },
    {
      id: "completed",
      kind: "completion",
      title: "Reconciled and completed",
      description: reconciled
        ? "The Petty Cash request is reconciled, closed and locked."
        : "The record closes after Finance verifies reconciliation.",
      state: reconciled ? "complete" : "pending",
      receivedAt: reconciliationCompletedAt,
      completedAt: reconciled
        ? (reconciliationCompletedAt ?? record.updatedAt)
        : null,
    },
  );

  if (returned) {
    const returnedIndex = stages.findIndex(
      (stage) => stage.state === "returned",
    );
    stages.splice(returnedIndex >= 0 ? returnedIndex + 1 : 1, 0, {
      id:
        returnedStage === "finance-reconciliation"
          ? "reconciliation-correction"
          : "request-correction",
      kind: "correction",
      title:
        returnedStage === "finance-reconciliation"
          ? "Correct and resubmit reconciliation"
          : "Correct and resubmit request",
      description:
        record.returnRemarks ||
        "Review the return remarks, make the required corrections and resubmit.",
      actorName: record.requesterName,
      actorRole: requesterRole,
      state: "current",
      receivedAt: record.returnedAt,
    });
  }

  const lifecycleEnd =
    reconciliationCompletedAt ?? (reconciled ? record.updatedAt : new Date());
  const summaries: PaymentProgressSummary[] = [
    {
      label: "Current update",
      value: reconciled
        ? "Petty Cash reconciled"
        : returned
          ? "Correction required"
          : record.status.replaceAll("_", " ").toLowerCase(),
      tone: reconciled ? "success" : returned ? "warning" : "active",
    },
    {
      label: reconciled ? "Total lifecycle time" : "Elapsed lifecycle time",
      value: formatBusinessDuration(
        businessMinutesBetween(record.createdAt, lifecycleEnd),
      ),
      tone: reconciled ? "success" : "neutral",
    },
  ];
  if (record.paidAt)
    summaries.push({
      label: "Reconciliation period",
      value: formatBusinessDuration(
        businessMinutesBetween(record.paidAt, lifecycleEnd),
      ),
      tone: reconciled ? "success" : returned ? "warning" : "neutral",
    });

  return <PaymentProgressTimeline stages={stages} summaries={summaries} />;
}

function DetailSection({
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

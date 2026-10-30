"use client";

import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";

import {
  fetchPettyCashRequest,
  markPettyCashPaid,
  returnPettyCashByFinance,
  returnPettyCashReconciliation,
  reviewPettyCashByFinancePeer,
  verifyPettyCashByFinance,
  verifyPettyCashReconciliation,
} from "@/data/payment-requests/petty-cash/api";
import {
  notifyPettyCashFinancePeerReviewed,
  notifyPettyCashFinanceVerified,
  notifyPettyCashPaid,
  notifyPettyCashReturned,
} from "@/features/payment-request/notifications/petty-cash-notifications";
import type { PettyCashRecord } from "@/domain/payment-requests/petty-cash/types";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";

import { PettyCashStatusBadge } from "../petty-cash-status-badge";
import styles from "../petty-cash.module.css";
import { FinanceCurrentNextProcess } from "../../finance-pending-processing/finance-current-next-process";

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
const MAX_RECEIPT_SIZE = 2.5 * 1024 * 1024;
const ACCEPTED_RECEIPT_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const money = (value: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    value,
  );
const location = (record: PettyCashRecord) =>
  record.location === "PENANG" ? "Penang" : "Kuala Lumpur";
function date(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(parsed);
}
function readReceipt(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The receipt could not be read."));
    reader.onerror = () => reject(new Error("The receipt could not be read."));
    reader.readAsDataURL(file);
  });
}

export function PettyCashFinanceReview({
  requestId,
  embedded = false,
  initialRecord,
}: {
  requestId: string;
  embedded?: boolean;
  initialRecord?: PettyCashRecord;
}) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<PettyCashRecord | null>(
    initialRecord ?? null,
  );
  const [checked, setChecked] = useState(Boolean(initialRecord));
  const [paymentDate, setPaymentDate] = useState(
    initialRecord?.paymentDate ?? today(),
  );
  const [paymentReference, setPaymentReference] = useState(
    initialRecord?.paymentReference?.trim() ||
      initialRecord?.requestNumber ||
      "",
  );
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [balanceReceived, setBalanceReceived] = useState(false);
  const [paymentProofLink, setPaymentProofLink] = useState(
    initialRecord?.paymentProofLink ?? "",
  );
  const [paymentProofName, setPaymentProofName] = useState("");
  const [notes, setNotes] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccount(readBetaSession());
    if (initialRecord) {
      setRecord(initialRecord);
      setPaymentDate(initialRecord.paymentDate ?? today());
      setPaymentReference(
        initialRecord.paymentReference?.trim() || initialRecord.requestNumber,
      );
      setPaymentProcessed(false);
      setBalanceReceived(false);
      setPaymentProofLink(initialRecord.paymentProofLink ?? "");
      setChecked(true);
      return;
    }
    fetchPettyCashRequest(requestId)
      .then((next) => {
        setRecord(next);
        setPaymentDate(next.paymentDate ?? today());
        setPaymentReference(
          next.paymentReference?.trim() || next.requestNumber,
        );
        setPaymentProcessed(false);
        setBalanceReceived(false);
        setPaymentProofLink(next.paymentProofLink ?? "");
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Request could not be loaded.",
        ),
      )
      .finally(() => setChecked(true));
  }, [initialRecord, requestId]);

  async function verify() {
    if (!account || !record) return;
    if (
      !paymentDate ||
      !paymentReference.trim() ||
      !paymentProofLink.trim() ||
      !paymentProcessed
    ) {
      setError(
        "Attach the payment receipt and confirm that the payment has been processed.",
      );
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await verifyPettyCashByFinance(record.id, {
        financeId: account.id,
        paymentDate,
        paymentReference: paymentReference.trim(),
        paymentProofLink: paymentProofLink.trim(),
        notes: notes.trim(),
      });
      notifyPettyCashFinanceVerified(updated, account);
      setRecord(updated);
      setSuccess(
        "Payment information was verified. Review it once more before marking the request as paid.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Payment could not be verified.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reviewFinanceRequest() {
    if (!account || !record) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await reviewPettyCashByFinancePeer(record.id, account.id);
      notifyPettyCashFinancePeerReviewed(updated, account);
      setRecord(updated);
      setSuccess(
        "Your informational preview was recorded. Finance processing continues independently.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The request could not be reviewed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function selectReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) {
      setError("Upload the payment receipt as a PDF, JPG or PNG file.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      setError("The payment receipt must be 2.5 MB or smaller.");
      event.target.value = "";
      return;
    }
    try {
      setPaymentProofLink(await readReceipt(file));
      setPaymentProofName(file.name);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The receipt could not be uploaded.",
      );
    }
  }

  async function markPaid() {
    if (
      !account ||
      !record ||
      !window.confirm(
        `Mark ${record.requestNumber} as paid and create the Money Out transaction?`,
      )
    )
      return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await markPettyCashPaid(record.id, account.id);
      notifyPettyCashPaid(updated, account);
      setRecord(updated);
      setSuccess(
        "Funds released. The Money Out transaction was created and the request is now waiting for Staff reconciliation.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Request could not be marked paid.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function returnRequest() {
    if (!account || !record) return;
    if (remarks.trim().length < 3) {
      setError("Enter correction remarks before returning the request.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await returnPettyCashByFinance(
        record.id,
        account.id,
        remarks.trim(),
      );
      notifyPettyCashReturned(updated, account, "Finance");
      setRecord(updated);
      setSuccess(
        "The Petty Cash request was returned to Staff for correction.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Request could not be returned.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function reconcile(kind: "verify" | "return") {
    if (!account || !record) return;
    if (
      kind === "verify" &&
      Number(record.reconciliation?.returnedBalance || 0) > 0 &&
      !balanceReceived
    ) {
      setError("Confirm that Finance received the returned balance.");
      return;
    }
    if (kind === "return" && remarks.trim().length < 3) {
      setError("Enter correction remarks before returning the reconciliation.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated =
        kind === "verify"
          ? await verifyPettyCashReconciliation(record.id, account.id)
          : await returnPettyCashReconciliation(
              record.id,
              account.id,
              remarks.trim(),
            );
      setRecord(updated);
      setSuccess(
        kind === "verify"
          ? "Reconciliation verified. The Petty Cash request is complete."
          : "Reconciliation returned to the requester for correction.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The reconciliation action failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!checked)
    return (
      <StatePage
        title="Loading request"
        copy="Reading the Petty Cash payment details…"
      />
    );
  if (!account || account.role !== "finance")
    return (
      <StatePage
        title="Finance access required"
        copy="This page is available only to Finance."
      />
    );
  if (!record)
    return (
      <StatePage
        title="Petty Cash request not found"
        copy={error || "The request could not be found."}
      />
    );

  const canVerify = record.status === "PENDING_FINANCE_PAYMENT";
  const canComplete = record.status === "FINANCE_VERIFIED";
  const canReconcile = record.status === "PENDING_FINANCE_RECONCILIATION";
  const canPeerReview =
    record.requesterRole === "finance" &&
    record.financeReviewerRole === "finance" &&
    record.financeReviewerId === account.id &&
    record.requesterId !== account.id &&
    !record.requesterReviewedAt &&
    record.status !== "RETURNED_TO_STAFF";

  return (
    <main className={styles.managerReviewPage}>
      {!embedded && (
        <div className={styles.managerBackRow}>
          <Link href="/beta/finance/payment-requests/petty-cash">
            ← Back to Petty Cash payments
          </Link>
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className={styles.managerSuccess} role="status">
          {success}
        </div>
      )}
      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <header className={styles.detailHero}>
            <div>
              <div className={styles.managerReviewEyebrow}>
                <p>Finance payment</p>
                <PettyCashStatusBadge status={record.status} />
              </div>
              <h1>{record.requestNumber}</h1>
              <span>
                {record.requesterName} · {location(record)}
              </span>
            </div>
            <div>
              <small>Total requested</small>
              <strong>{money(record.totalAmount)}</strong>
            </div>
          </header>
          {record.status === "RETURNED_TO_STAFF" && record.returnRemarks && (
            <div className={styles.detailReturnNotice}>
              <strong>Returned for correction</strong>
              <blockquote>{record.returnRemarks}</blockquote>
              <p>{date(record.returnedAt)}</p>
            </div>
          )}
          <DetailSection title="Request & approval overview">
            <dl className={styles.managerReviewGrid}>
              <Value label="Request date" value={date(record.requestDate)} />
              <Value label="Staff" value={record.requesterName} />
              <Value label="Position" value={record.requesterPosition} />
              <Value label="Location" value={location(record)} />
              <Value
                label="Manager approved"
                value={date(record.managerApprovedAt)}
              />
              <Value label="Contact" value={record.requesterContact} />
            </dl>
          </DetailSection>
          <DetailSection title="Planned expense breakdown">
            <div className={styles.managerReviewTable}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Details / purpose</th>
                    <th>Account category</th>
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
            <div className={styles.managerReviewTotal}>
              <span>Total requested</span>
              <strong>{money(record.totalAmount)}</strong>
            </div>
          </DetailSection>
          <DetailSection title="Notes / purpose justification">
            <p className={styles.detailCopy}>
              {record.notes?.trim() || "No additional notes were provided."}
            </p>
          </DetailSection>
          {(record.paymentReference || record.paymentProofLink) && (
            <DetailSection title="Payment information">
              <dl className={styles.managerReviewGrid}>
                <Value label="Payment date" value={date(record.paymentDate)} />
                <Value
                  label="Payment reference"
                  value={record.paymentReference || "—"}
                />
                <div>
                  <dt>Payment proof</dt>
                  <dd>
                    {record.paymentProofLink ? (
                      <a
                        href={record.paymentProofLink}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open payment proof ↗
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <Value
                  label="Verified"
                  value={date(record.financeVerifiedAt)}
                />
              </dl>
            </DetailSection>
          )}
          {record.reconciliation && (
            <DetailSection title="Staff reconciliation">
              <dl className={styles.managerReviewGrid}>
                <Value
                  label="Amount released"
                  value={money(record.totalAmount)}
                />
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
                <Value
                  label="Return reference"
                  value={
                    record.reconciliation.balanceReturnReference ||
                    "Not applicable"
                  }
                />
              </dl>
              <h4 className={styles.reconciliationFilesTitle}>
                Purchase receipts ({record.reconciliation.receipts.length})
              </h4>
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
                {record.reconciliation.receipts.length === 0 && (
                  <span>No purchase receipts were attached.</span>
                )}
              </div>
              {record.reconciliation.balanceReturnProof && (
                <p className={styles.balanceReturnProof}>
                  <strong>Returned-balance transaction proof</strong>
                  <a
                    href={record.reconciliation.balanceReturnProof.dataUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open balance return proof ↗
                  </a>
                </p>
              )}
            </DetailSection>
          )}
        </div>

        <div className={styles.detailRail}>
          <aside className={styles.managerDecisionPanel}>
            <p>Finance action</p>
            <h2>
              {canPeerReview
                ? "Independently review request"
                : canVerify
                  ? "Verify payment information"
                  : canComplete
                    ? "Release Petty Cash"
                    : canReconcile
                      ? "Verify reconciliation"
                      : record.status === "RECONCILED"
                        ? "Reconciliation completed"
                        : "Processing recorded"}
            </h2>
            {canPeerReview && (
              <>
                <span>
                  This request was submitted by Finance. Your independent
                  preview is informational and does not block payment
                  processing.
                </span>
                <button
                  className={styles.managerApproveButton}
                  disabled={saving}
                  onClick={reviewFinanceRequest}
                  type="button"
                >
                  Record independent preview <b aria-hidden="true">→</b>
                </button>
              </>
            )}
            {canVerify && (
              <>
                <span>
                  Record the payment information and upload the receipt before
                  completing the Petty Cash payment.
                </span>
                <label>
                  <span>Payment date</span>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
                </label>
                <label>
                  <span>Payment reference</span>
                  <input readOnly value={paymentReference} />
                </label>
                <label>
                  <span>Upload payment receipt</span>
                  <div className={styles.financeReceiptUpload}>
                    <input
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      type="file"
                      onChange={selectReceipt}
                    />
                    <small>PDF, JPG or PNG · maximum 2.5 MB</small>
                    {paymentProofLink && (
                      <div>
                        <strong>
                          {paymentProofName || "Payment receipt attached"}
                        </strong>
                        <a
                          href={paymentProofLink}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Preview
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentProofLink("");
                            setPaymentProofName("");
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </label>
                <label>
                  <span>Finance notes</span>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional payment notes"
                  />
                </label>
                <label className={styles.financePaymentConfirmation}>
                  <input
                    checked={paymentProcessed}
                    onChange={(event) =>
                      setPaymentProcessed(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>I confirm that this payment has been processed.</span>
                </label>
                <button
                  className={styles.managerApproveButton}
                  disabled={
                    saving ||
                    !paymentDate ||
                    !paymentReference.trim() ||
                    !paymentProofLink.trim() ||
                    !paymentProcessed
                  }
                  onClick={verify}
                  type="button"
                >
                  Verify payment information <b aria-hidden="true">→</b>
                </button>
              </>
            )}
            {canComplete && (
              <>
                <span>
                  Release the funds to Staff. This creates the Money Out
                  transaction and starts Staff reconciliation.
                </span>
                <div className={styles.managerPaymentSummary}>
                  <span>Reference</span>
                  <strong>{record.paymentReference}</strong>
                  <span>Payment date</span>
                  <strong>{date(record.paymentDate)}</strong>
                </div>
                <button
                  className={styles.managerApproveButton}
                  disabled={saving}
                  onClick={markPaid}
                  type="button"
                >
                  Release funds <b aria-hidden="true">→</b>
                </button>
              </>
            )}
            {canReconcile && (
              <>
                <span>
                  Check every purchase receipt. If money was returned, also
                  verify the return transaction proof and reference.
                </span>
                {Number(record.reconciliation?.returnedBalance || 0) > 0 ? (
                  <label className={styles.financePaymentConfirmation}>
                    <input
                      checked={balanceReceived}
                      onChange={(event) =>
                        setBalanceReceived(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>
                      I confirm that Finance received the returned balance of{" "}
                      {money(record.reconciliation?.returnedBalance || 0)}.
                    </span>
                  </label>
                ) : (
                  <div className={styles.noBalanceConfirmation}>
                    No balance to receive. Review the requester&apos;s
                    declaration and purchase receipts before completing
                    reconciliation.
                  </div>
                )}
                <button
                  className={styles.managerApproveButton}
                  disabled={
                    saving ||
                    (Number(record.reconciliation?.returnedBalance || 0) > 0 &&
                      !balanceReceived)
                  }
                  onClick={() => reconcile("verify")}
                  type="button"
                >
                  Verify and complete <b aria-hidden="true">→</b>
                </button>
                <div className={styles.managerActionDivider}>
                  <span>or return with notes</span>
                </div>
                <label>
                  <span>Correction remarks</span>
                  <textarea
                    rows={4}
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="Explain what the requester must correct"
                  />
                </label>
                <button
                  className={styles.managerReturnButton}
                  disabled={saving || remarks.trim().length < 3}
                  onClick={() => reconcile("return")}
                  type="button"
                >
                  Return reconciliation
                </button>
              </>
            )}
            {record.status === "RECONCILED" && (
              <>
                <span>This payment and reconciliation are complete.</span>
                <small>
                  Verified {date(record.reconciliation?.financeVerifiedAt)}
                </small>
              </>
            )}
            {record.status === "RETURNED_TO_STAFF" && (
              <>
                <span>This request was returned to Staff.</span>
                <div className={styles.managerReturnedReason}>
                  <strong>Return reason</strong>
                  <p>{record.returnRemarks}</p>
                </div>
              </>
            )}
            {!canPeerReview && (canVerify || canComplete) && (
              <>
                <div className={styles.managerActionDivider}>
                  <span>or return with notes</span>
                </div>
                <label>
                  <span>Correction remarks</span>
                  <textarea
                    rows={4}
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="Explain what the requester must correct"
                  />
                </label>
                <button
                  className={styles.managerReturnButton}
                  disabled={saving || remarks.trim().length < 3}
                  onClick={returnRequest}
                  type="button"
                >
                  Return to requester
                </button>
              </>
            )}
          </aside>
          {embedded ? (
            <FinanceCurrentNextProcess
              title={
                canReconcile
                  ? "Verify requester reconciliation"
                  : canComplete
                    ? "Release Petty Cash"
                    : "Verify payment information"
              }
              copy={
                canReconcile
                  ? "Review purchase receipts and returned-balance evidence, then complete or return the reconciliation."
                  : "Complete the current Finance action or return the request with correction remarks."
              }
            />
          ) : (
            <WorkflowProgress record={record} />
          )}
        </div>
      </div>
    </main>
  );
}

function WorkflowProgress({ record }: { record: PettyCashRecord }) {
  const requesterRole = record.requesterRole ?? "staff";
  const independentTime =
    record.requesterReviewedAt ??
    (record.financeReviewerRole === "manager"
      ? record.managerApprovedAt
      : record.financeReviewerRole === "director"
        ? record.directorApprovedAt
        : undefined);
  const submitted = {
    title: "Request Submitted",
    copy: `Submitted by ${record.requesterName}`,
    state: "complete",
  };
  const manager = {
    title: "Manager Preview",
    copy: record.managerApprovedAt
      ? `Previewed ${date(record.managerApprovedAt)}`
      : "Informational preview available",
    state: record.managerApprovedAt ? "complete" : "pending",
  };
  const director = {
    title: "Director Preview",
    copy: record.directorApprovedAt
      ? `Previewed ${date(record.directorApprovedAt)}`
      : "Informational preview available",
    state: record.directorApprovedAt ? "complete" : "pending",
  };
  const independent = {
    title: "Independent Preview",
    copy: independentTime
      ? `Previewed ${date(independentTime)}`
      : "Informational preview available",
    state: independentTime ? "complete" : "pending",
  };
  const finance = {
    title: "Finance Processing",
    copy:
      record.status === "FINANCE_VERIFIED"
        ? "Payment information verified"
        : "Finance verification and payment",
    state:
      record.financeVerifiedAt || record.status === "PAID"
        ? "complete"
        : record.status === "RETURNED_TO_STAFF"
          ? "returned"
          : "active",
  };
  const completed = {
    title: "Completed",
    copy: "Payment completed and ledger updated",
    state:
      record.status === "PAID"
        ? "complete"
        : record.status === "FINANCE_VERIFIED"
          ? "active"
          : "pending",
  };
  const steps =
    requesterRole === "staff"
      ? [submitted, manager, director, finance, completed]
      : requesterRole === "manager"
        ? [submitted, director, finance, completed]
        : requesterRole === "director"
          ? [submitted, finance, completed]
          : [submitted, independent, finance, completed];
  const activeStep =
    record.status === "PAID"
      ? steps.length
      : Math.max(
          1,
          steps.findIndex(
            (step) => step.state === "active" || step.state === "returned",
          ) + 1,
        );
  return (
    <aside className={styles.progressPanel}>
      <header>
        <p>Payment progress</p>
        <span>
          Step {activeStep} of {steps.length}
        </span>
      </header>
      <ol>
        {steps.map((step) => (
          <li
            className={styles.progressStep}
            data-state={step.state}
            key={step.title}
          >
            <i aria-hidden="true">{step.state === "complete" ? "✓" : ""}</i>
            <div>
              <strong>{step.title}</strong>
              <small>
                {step.state === "active" || step.state === "returned"
                  ? `Current stage: ${step.copy}`
                  : step.copy}
              </small>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
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
function StatePage({ title, copy }: { title: string; copy: string }) {
  return (
    <main className={styles.statePage}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href="/beta/finance/payment-requests/petty-cash">
        Back to Petty Cash payments
      </Link>
    </main>
  );
}

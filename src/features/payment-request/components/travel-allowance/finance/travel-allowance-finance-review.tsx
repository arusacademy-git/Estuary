"use client";
import { createRuntimeId } from '@/lib/ids/runtime-id';

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  completeTravelAllowanceByFinance,
  fetchTravelAllowance,
  returnTravelAllowanceByFinance,
} from "@/data/payment-requests/travel-allowance/api";
import {
  notifyTravelAllowanceCompleted,
  notifyTravelAllowanceReturned,
} from "@/features/payment-request/notifications/travel-allowance-notifications";
import type { PaymentRequestDocument, TravelAllowanceRecord } from "@/domain/payment-requests/travel-allowance/types";
import { standardPaymentStatusLabel } from "@/domain/payment-requests/standard-payment-status";
import { travelAllowanceProgress, travelAllowanceStageTitle } from "@/domain/payment-requests/travel-allowance/types";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "../travel-allowance-workflow.module.css";
import { TravelAllowanceGroupedTable } from "../travel-allowance-grouped-table";
import { FinanceCurrentNextProcess } from "../../finance-pending-processing/finance-current-next-process";

const baseHref = "/beta/finance/payment-requests/travel-allowances";
const money = (value: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    value,
  );
function displayDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-MY");
}
function statusLabel(status: TravelAllowanceRecord["status"]) {
  return standardPaymentStatusLabel(status);
}
function readProof(file: File) {
  return new Promise<PaymentRequestDocument>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: createRuntimeId(), fileName: file.name, mimeType: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.onerror = () => reject(new Error("The transaction proof could not be read."));
    reader.readAsDataURL(file);
  });
}
export function TravelAllowanceFinanceReview({
  requestId,
  embedded = false,
  initialRecord,
}: {
  requestId: string;
  embedded?: boolean;
  initialRecord?: TravelAllowanceRecord;
}) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<TravelAllowanceRecord | null>(
    initialRecord ?? null,
  );
  const [checked, setChecked] = useState(Boolean(initialRecord));
  const [paymentDate, setPaymentDate] = useState(
    initialRecord?.financePaymentDate ?? "",
  );
  const [paymentReference, setPaymentReference] = useState(
    initialRecord?.financePaymentReference?.trim() ||
    initialRecord?.requestNumber ||
    "",
  );
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [transactionProof, setTransactionProof] = useState<File | null>(null);
  const [financeRemarks, setFinanceRemarks] = useState(
    initialRecord?.financeRemarks ?? "",
  );
  const [returnReason, setReturnReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const session = readBetaSession();
    setAccount(session);
    if (!session || session.role !== "finance") {
      setChecked(true);
      return;
    }
    if (initialRecord) {
      setRecord(initialRecord);
      setPaymentDate(initialRecord.financePaymentDate ?? "");
      setPaymentReference(
        initialRecord.financePaymentReference?.trim() ||
        initialRecord.requestNumber,
      );
      setPaymentProcessed(false);
      setFinanceRemarks(initialRecord.financeRemarks ?? "");
      setChecked(true);
      return;
    }
    fetchTravelAllowance(requestId)
      .then((item) => {
        setRecord(item);
        setPaymentDate(item.financePaymentDate ?? "");
        setPaymentReference(
          item.financePaymentReference?.trim() || item.requestNumber,
        );
        setPaymentProcessed(false);
        setFinanceRemarks(item.financeRemarks ?? "");
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Request could not be loaded.",
        ),
      )
      .finally(() => setChecked(true));
  }, [initialRecord, requestId]);

  async function complete() {
    if (!record || !account) return;
    const isProofStage = record.status === "PAYMENT_PROCESSED";
    const isCompletionStage = record.status === "TRANSACTION_PROOF_UPLOADED";
    if (!paymentDate || !paymentReference.trim() || (!isProofStage && !isCompletionStage && !paymentProcessed)) {
      setError("Check the payment details and confirm that the payment has been processed.");
      return;
    }
    if (isProofStage && !transactionProof) {
      setError("Upload the payment transaction proof before continuing.");
      return;
    }
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      if (transactionProof && transactionProof.size > 2.5 * 1024 * 1024) {
        throw new Error("The transaction proof must not exceed 2.5 MB.");
      }
      const proof = transactionProof ? await readProof(transactionProof) : undefined;
      const updated = await completeTravelAllowanceByFinance(
        record.id,
        account.id,
        paymentDate,
        paymentReference,
        proof,
        financeRemarks,
      );
      if (updated.status === "COMPLETED") notifyTravelAllowanceCompleted(updated, account);
      setRecord(updated);
      window.dispatchEvent(new Event("estuary:finance-queue-changed"));
      window.dispatchEvent(new Event("estuary:action-counts-changed"));
      setSuccess(
        updated.status === "COMPLETED"
          ? "The Travel Allowance is completed and available in Payment Records."
          : updated.status === "TRANSACTION_PROOF_UPLOADED"
            ? "The transaction proof was uploaded. Confirm completion to move this record to Payment Records."
            : "The payment was recorded. You may close this window and upload its transaction proof later.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Finance verification failed.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  async function returnToRequester() {
    if (!record || !account) return;
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      const updated = await returnTravelAllowanceByFinance(
        record.id,
        account.id,
        returnReason,
      );
      notifyTravelAllowanceReturned(updated, account, "Finance");
      setRecord(updated);
      window.dispatchEvent(new Event("estuary:finance-queue-changed"));
      window.dispatchEvent(new Event("estuary:action-counts-changed"));
      setSuccess("The Travel Allowance was returned for correction.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The request could not be returned.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!checked)
    return (
      <State
        title="Loading Travel Allowance"
        copy="Reading the request from the database…"
      />
    );
  if (!account || account.role !== "finance")
    return (
      <State
        title="Finance access required"
        copy="Sign in using a Finance account."
      />
    );
  if (!record)
    return (
      <State
        title="Travel Allowance not found"
        copy={error || "The request could not be found."}
      />
    );
  if (
    !["PENDING_FINANCE_VERIFICATION", "PAYMENT_PROCESSED", "TRANSACTION_PROOF_UPLOADED", "COMPLETED"].includes(record.status) &&
    !record.financeReturnedAt
  )
    return (
      <State
        title="Awaiting approval"
        copy="This request will be available after Director approval."
      />
    );

  const canAct = ["PENDING_FINANCE_VERIFICATION", "PAYMENT_PROCESSED", "TRANSACTION_PROOF_UPLOADED"].includes(record.status);
  const isProofStage = record.status === "PAYMENT_PROCESSED";
  const isCompletionStage = record.status === "TRANSACTION_PROOF_UPLOADED";
  const formHref = `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(record.id)}/form`;
  return (
    <main className={styles.page}>
      {!embedded && (
        <div className={styles.back}>
          <Link href={baseHref}>← Back to Travel Allowances</Link>
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className={styles.success} role="status">
          {success}
        </div>
      )}
      <div className={styles.detailLayout}>
        <section className={styles.detailMain}>
          <header className={styles.hero}>
            <div>
              <p>Finance verification</p>
              <h1>{record.requestNumber}</h1>
              <span>Submitted by {record.requesterName}</span>
            </div>
            <div>
              <small>Total allowance</small>
              <strong>{money(record.totalAmount)}</strong>
              <span className={styles.status} data-status={record.status}>
                {statusLabel(record.status)}
              </span>
            </div>
          </header>
          <InfoSection title="Request Overview">
            <dl className={styles.infoGrid}>
              <Value
                label="Request date"
                value={displayDate(record.requestDate)}
              />
              <Value label="Submitted by" value={record.requesterName} />
              <Value
                label="Requester role"
                value={
                  record.requesterRole === "manager"
                    ? "Manager — on behalf of Staff"
                    : "Staff"
                }
              />
              <Value label="Entries" value={String(record.lines.length)} />
              <Value label="Contact" value={record.contact} />
              <Value
                label="Payment target"
                value={displayDate(record.paymentDueDate)}
              />
            </dl>
          </InfoSection>
          <InfoSection title="TA Form">
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
          </InfoSection>
          <InfoSection title={`Allowance by employee · ${record.lines.length} entries`}>
            <TravelAllowanceGroupedTable lines={record.lines} />
          </InfoSection>
        </section>
        <aside className={styles.rail}>
          <section className={styles.actionCard}>
            <p>Finance action</p>
            <h2>{canAct ? "Verify payment" : "Payment completed"}</h2>
            {canAct ? (
              <>
                <span>{isCompletionStage ? "The transaction proof is uploaded. Confirm completion to archive this request in Payment Records." : isProofStage ? "The payment is recorded. Upload its transaction proof now or close and return later." : "Check the payment details, then confirm that it has been processed."}</span>
                <div className={styles.financeFields}>
                  <label>
                    <span>Payment date <em className={styles.requiredMark} aria-hidden="true">*</em></span>
                    <input
                      readOnly={isProofStage}
                      type="date"
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Payment reference <em className={styles.requiredMark} aria-hidden="true">*</em></span>
                    <input readOnly value={paymentReference} />
                  </label>
                  {!isProofStage && !isCompletionStage && <label>
                    <span>Finance remarks</span>
                    <textarea rows={3} value={financeRemarks} onChange={(event) => setFinanceRemarks(event.target.value)} />
                  </label>}
                </div>
                {isProofStage ? (
                  <div className={styles.proofField}>
                    <span className={styles.proofLabel}>
                      Transaction proof <em className={styles.requiredMark} aria-hidden="true">*</em>
                    </span>
                    <div className={styles.uploadProofBox}>
                      <label htmlFor={`travel-proof-${record.id}`}>Choose File</label>
                      <span>{transactionProof?.name ?? "No file chosen"}</span>
                      <input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" id={`travel-proof-${record.id}`} onChange={(event) => setTransactionProof(event.currentTarget.files?.[0] ?? null)} required type="file" />
                      <small>PDF, JPG or PNG · maximum 2.5 MB</small>
                    </div>
                  </div>
                ) : !isCompletionStage ? <label className={styles.financePaymentConfirmation}>
                  <input
                    checked={paymentProcessed}
                    onChange={(event) =>
                      setPaymentProcessed(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>I confirm that this payment has been processed.</span>
                </label> : null}
                <button
                  className={styles.primary}
                  disabled={
                    isSaving ||
                    !paymentDate ||
                    !paymentReference.trim() ||
                    (!isProofStage && !isCompletionStage && !paymentProcessed) ||
                    (isProofStage && !transactionProof)
                  }
                  type="button"
                  onClick={complete}
                >
                  {isCompletionStage ? "Complete and move to Payment Records →" : isProofStage ? "Upload transaction proof →" : "Record payment →"}
                </button>
                {!isProofStage && !isCompletionStage && <>
                  <div className={styles.divider}>or return with notes</div>
                  <label>
                    <span>Reason for returning</span>
                    <textarea rows={4} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} />
                  </label>
                  <button className={styles.returnButton} disabled={isSaving || returnReason.trim().length < 5} type="button" onClick={returnToRequester}>
                    Return to requester
                  </button>
                </>}
              </>
            ) : (
              <dl className={styles.infoGrid}>
                <Value
                  label="Payment date"
                  value={displayDate(record.financePaymentDate ?? "")}
                />
                <Value
                  label="Payment reference"
                  value={record.financePaymentReference ?? "—"}
                />
              </dl>
            )}
          </section>
          {embedded ? (
            <FinanceCurrentNextProcess
              title="Finance payment"
              copy="Review the allowance entries, record payment information and complete or return the request."
            />
          ) : (
            <Progress record={record} />
          )}
        </aside>
      </div>
    </main>
  );
}

function Progress({ record }: { record: TravelAllowanceRecord }) {
  const progress = travelAllowanceProgress(record);
  return (
    <section className={styles.progress}>
      <header>
        <p>Payment progress</p>
        <span>
          Step {progress.active} of {progress.total}
        </span>
      </header>
      <ol>
        {progress.stages.map((stage, index) => {
          const number = index + 1;
          const state = progress.stateOf(number);
          return (
            <li data-state={state} key={stage}>
              <i>{state === "complete" ? "✓" : number}</i>
              <div>
                <strong>{travelAllowanceStageTitle(stage, record)}</strong>
                <small>
                  {state === "complete"
                    ? "Completed"
                    : state === "returned"
                      ? "Returned for correction"
                      : state === "active"
                        ? "Current stage"
                        : "Waiting"}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
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
function State({ title, copy }: { title: string; copy: string }) {
  return (
    <main className={styles.state}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href={baseHref}>Back to Travel Allowances</Link>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchClaimRequest,
  processClaimByFinance,
  returnClaimByFinance,
  uploadClaimPaymentProof,
  verifyClaimByFinance,
} from "@/data/payment-requests/claims/api";
import {
  notifyClaimPaid,
  notifyClaimReturned,
} from "@/features/payment-request/notifications/claim-notifications";
import type { ClaimRecord } from "@/domain/payment-requests/claims/types";
import { standardPaymentStatusLabel } from "@/domain/payment-requests/standard-payment-status";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";
import { ClaimReviewDetails, ClaimWorkflow } from "../claim-review-shared";
import styles from "../claim-workflow.module.css";
import { FinanceCurrentNextProcess } from "../../finance-pending-processing/finance-current-next-process";

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

export function ClaimFinanceReview({
  requestId,
  embedded = false,
  initialRecord,
}: {
  requestId: string;
  embedded?: boolean;
  initialRecord?: ClaimRecord;
}) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<ClaimRecord | null>(
    initialRecord ?? null,
  );
  const [checked, setChecked] = useState(Boolean(initialRecord));
  const [paymentDate, setPaymentDate] = useState(today());
  const [reference, setReference] = useState(
    initialRecord?.paymentReference?.trim() || initialRecord?.claimNumber || "",
  );
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setAccount(readBetaSession());
    if (initialRecord) {
      setRecord(initialRecord);
      setReference(
        initialRecord.paymentReference?.trim() || initialRecord.claimNumber,
      );
      setPaymentProcessed(false);
      setChecked(true);
      return;
    }
    fetchClaimRequest(requestId)
      .then((item) => {
        setRecord(item);
        setReference(item.paymentReference?.trim() || item.claimNumber);
        setPaymentProcessed(false);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "The Claim could not be loaded.",
        ),
      )
      .finally(() => setChecked(true));
  }, [initialRecord, requestId]);
  async function processPayment() {
    if (!account || !record) return;
    if (!paymentDate || !reference.trim() || !paymentProcessed)
      return setError("Confirm that the payment has been processed.");
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await processClaimByFinance(record.id, account.id, {
        paymentDate,
        paymentReference: reference.trim(),
        notes: notes.trim() || undefined,
      });
      notifyClaimPaid(updated, account);
      setRecord(updated);
      setSuccess("Finance processing completed. The Claim is now marked Paid.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Claim could not be processed.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function verifyAndForward() {
    if (!account || !record) return;
    setSaving(true);
    setError("");
    try {
      const updated = await verifyClaimByFinance(record.id, account.id);
      setRecord(updated);
      setSuccess(
        "Finance verification completed. The Claim is now awaiting the assigned Director's decision.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Claim could not be verified.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function uploadProof() {
    if (!account || !record || !paymentProof) return;
    setSaving(true);
    setError("");
    try {
      const updated = await uploadClaimPaymentProof(
        record.id,
        account.id,
        paymentProof,
      );
      setRecord(updated);
      setSuccess("Transaction proof uploaded. The Claim workflow is complete.");
      setPaymentProof(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Transaction proof could not be uploaded.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function returnRequest() {
    if (!account || !record) return;
    if (remarks.trim().length < 3)
      return setError("Enter correction remarks before returning the Claim.");
    setSaving(true);
    setError("");
    try {
      const updated = await returnClaimByFinance(
        record.id,
        account.id,
        remarks.trim(),
      );
      notifyClaimReturned(updated, account, "Finance");
      setRecord(updated);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Claim could not be returned.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (!checked)
    return (
      <State title="Loading Claim" copy="Reading the Claim and receipts…" />
    );
  if (!account || account.role !== "finance")
    return (
      <State
        title="Finance access required"
        copy="This page is available only to Finance."
      />
    );
  if (!record)
    return (
      <State
        title="Claim not found"
        copy={error || "This Claim could not be found."}
      />
    );
  const verifying = record.status === "PENDING_FINANCE_VERIFICATION";
  const readyForPayment = record.status === "APPROVED_FOR_PAYMENT";
  const awaitingProof = record.status === "PAYMENT_PROCESSED";
  const actionable = verifying || readyForPayment;
  return (
    <main className={styles.page}>
      {!embedded && (
        <div className={styles.back}>
          <Link href="/beta/finance/payment-requests/claims">
            ← Back to Claims
          </Link>
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
          <ClaimReviewDetails
            contextLabel="Finance processing"
            record={record}
            userId={account.id}
          />
        </section>
        <aside className={styles.rail}>
          <section className={styles.actionCard}>
            <p>Finance action</p>
            <h2>
              {actionable
                ? verifying
                  ? "Verify Claim"
                  : "Process approved payment"
                : record.status === "PAYMENT_PROCESSED"
                  ? "Upload transaction proof"
                  : "No Finance action"}
            </h2>
            {verifying ? (
              <>
                <span>
                  Check the Claim form, receipts, policy and amount before
                  sending it to the assigned Director for a final decision.
                </span>
                <button
                  className={styles.primary}
                  disabled={saving}
                  onClick={verifyAndForward}
                  type="button"
                >
                  Verify and send to Director →
                </button>
                <div className={styles.divider}>or return with notes</div>
                <label>
                  <span>Reason for returning</span>
                  <textarea
                    onChange={(event) => setRemarks(event.target.value)}
                    placeholder="Explain what the claimant must correct"
                    rows={4}
                    value={remarks}
                  />
                </label>
                <button
                  className={styles.returnButton}
                  disabled={saving || remarks.trim().length < 3}
                  onClick={returnRequest}
                  type="button"
                >
                  Return to claimant
                </button>
              </>
            ) : readyForPayment ? (
              <>
                <span>
                  The Director approved this Claim. Record the payment details
                  before uploading its transaction proof.
                </span>
                <div className={styles.financeFields}>
                  <label>
                    <span>Payment date *</span>
                    <input
                      onChange={(event) => setPaymentDate(event.target.value)}
                      type="date"
                      value={paymentDate}
                    />
                  </label>
                  <label>
                    <span>Payment reference *</span>
                    <input readOnly value={reference} />
                  </label>
                  <label>
                    <span>Finance remarks</span>
                    <textarea
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional processing notes"
                      rows={3}
                      value={notes}
                    />
                  </label>
                </div>
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
                  className={styles.primary}
                  disabled={
                    saving ||
                    !paymentDate ||
                    !reference.trim() ||
                    !paymentProcessed
                  }
                  onClick={processPayment}
                  type="button"
                >
                  Confirm payment processed →
                </button>
              </>
            ) : awaitingProof ? (
              <>
                <span>
                  The payment is recorded. Upload its transaction receipt or
                  proof to complete the Claim.
                </span>
                <label>
                  <span>Transaction proof *</span>
                  <input
                    accept="application/pdf,image/png,image/jpeg"
                    type="file"
                    onChange={(event) =>
                      setPaymentProof(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
                <button
                  className={styles.primary}
                  disabled={saving || !paymentProof}
                  onClick={uploadProof}
                  type="button"
                >
                  Upload proof and complete →
                </button>
              </>
            ) : (
              <>
                <span>
                  This Claim is currently{" "}
                  {standardPaymentStatusLabel(record.status)}.
                </span>
                {record.returnRemarks && (
                  <p className={styles.remark}>
                    <strong>Reason of rejection:</strong> {record.returnRemarks}
                  </p>
                )}
              </>
            )}
          </section>
          {embedded ? (
            <FinanceCurrentNextProcess
              title="Finance payment"
              copy={
                verifying
                  ? "Verify the Claim and send it to the assigned Director."
                  : readyForPayment
                    ? "Record the approved payment, then upload its transaction proof."
                    : awaitingProof
                      ? "Upload the payment transaction proof to complete the Claim."
                      : "No Finance action is currently required."
              }
            />
          ) : (
            <ClaimWorkflow record={record} />
          )}
        </aside>
      </div>
    </main>
  );
}
function State({ title, copy }: { title: string; copy: string }) {
  return (
    <main className={styles.state}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href="/beta/finance/payment-requests/claims">
        Back to Finance Claims
      </Link>
    </main>
  );
}

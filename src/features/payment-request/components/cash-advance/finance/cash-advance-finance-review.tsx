"use client";
import { useEffect, useState } from "react";
import {
  completeCashAdvance,
  fetchCashAdvance,
  payCashAdvanceByFinance,
  returnCashAdvanceByFinance,
  returnCashAdvanceReconciliation,
} from "@/data/payment-requests/cash-advance/cash-advance-api";
import type { CashAdvanceDocument, CashAdvanceRecord } from "@/domain/payment-requests/cash-advance/types";
import {
  notifyCashAdvanceCompleted,
  notifyCashAdvancePaid,
  notifyCashAdvanceReturned,
} from "@/features/payment-request/notifications/cash-advance-notifications";
import { readBetaSession } from "@/lib/auth/beta-accounts";
import { CashAdvanceDetail } from "../cash-advance-detail";
import { CashAdvanceReconciliationReview } from "./cash-advance-reconciliation-review";
import styles from "../cash-advance.module.css";
import { FinanceCurrentNextProcess } from "../../finance-pending-processing/finance-current-next-process";
const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
function readProof(file: File) {
  return new Promise<CashAdvanceDocument>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: crypto.randomUUID(), fileName: file.name, mimeType: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.onerror = () => reject(new Error("The transaction proof could not be read."));
    reader.readAsDataURL(file);
  });
}

export function CashAdvanceFinanceReview({
  id,
  embedded = false,
  initialRecord,
}: {
  id: string;
  embedded?: boolean;
  initialRecord?: CashAdvanceRecord;
}) {
  const [record, setRecord] = useState<CashAdvanceRecord | null>(
    initialRecord ?? null,
  );
  const [date, setDate] = useState(
    initialRecord?.financePaidAt?.slice(0, 10) ?? today(),
  );
  const [reference, setReference] = useState(
    initialRecord?.financePaymentReference?.trim() ||
      initialRecord?.requestNumber ||
      "",
  );
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [transactionProof, setTransactionProof] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (initialRecord) {
      setRecord(initialRecord);
      setDate(initialRecord.financePaidAt?.slice(0, 10) ?? today());
      setReference(
        initialRecord.financePaymentReference?.trim() ||
          initialRecord.requestNumber,
      );
      setPaymentProcessed(false);
      return;
    }
    fetchCashAdvance(id)
      .then((next) => {
        setRecord(next);
        setDate(next.financePaidAt?.slice(0, 10) ?? today());
        setReference(
          next.financePaymentReference?.trim() || next.requestNumber,
        );
        setPaymentProcessed(false);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Cash Advance could not be loaded.",
        ),
      );
  }, [id, initialRecord]);
  async function act(
    kind: "pay" | "return" | "complete" | "return-reconciliation",
  ) {
    const account = readBetaSession();
    if (!account || account.role !== "finance")
      return setError("Sign in using a Finance account.");
    if (kind === "pay" && record?.status === "PENDING_FINANCE_PROCESSING" && (!date || !reference.trim() || !paymentProcessed)) {
      return setError("Check the payment details and confirm that the payment has been processed.");
    }
    if (kind === "pay" && record?.status === "PAYMENT_PROCESSED" && !transactionProof) {
      return setError("Upload the payment transaction proof before continuing.");
    }
    if (kind === "return" && reason.trim().length < 3) {
      return setError("Enter return remarks before returning the request.");
    }
    setSaving(true);
    setError("");
    try {
      let updated: CashAdvanceRecord;
      if (kind === "pay") {
        if (transactionProof && transactionProof.size > 2.5 * 1024 * 1024) {
          throw new Error("The transaction proof must not exceed 2.5 MB.");
        }
        const proof = transactionProof ? await readProof(transactionProof) : undefined;
        updated = await payCashAdvanceByFinance(
          id,
          account.id,
          date,
          reference,
          proof,
        );
      } else if (kind === "complete")
        updated = await completeCashAdvance(id, account.id);
      else if (kind === "return-reconciliation")
        updated = await returnCashAdvanceReconciliation(id, account.id, reason);
      else updated = await returnCashAdvanceByFinance(id, account.id, reason);
      if (kind === "pay" && updated.status === "PENDING_RECONCILIATION") notifyCashAdvancePaid(updated, account);
      else if (kind === "complete")
        notifyCashAdvanceCompleted(updated, account);
      else
        notifyCashAdvanceReturned(
          updated,
          account,
          kind === "return-reconciliation"
            ? "Finance reconciliation"
            : "Finance",
        );
      setRecord(updated);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The Finance action failed.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (error && !record) return <div className={styles.error}>{error}</div>;
  if (!record)
    return <div className={styles.notice}>Loading Cash Advance…</div>;
  let actions: React.ReactNode;
  if (record.status === "PENDING_FINANCE_PROCESSING")
    actions = (
      <section className={styles.sideCard}>
        <h3>Record payment</h3>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.field}>
          <label>Payment date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label>Payment reference</label>
          <input readOnly value={reference} />
        </div>
        <label className={styles.financePaymentConfirmation}>
          <input
            checked={paymentProcessed}
            onChange={(event) => setPaymentProcessed(event.target.checked)}
            type="checkbox"
          />
          <span>I confirm that this payment has been processed.</span>
        </label>
        <button
          className={styles.primary}
          disabled={saving || !date || !reference.trim() || !paymentProcessed}
          onClick={() => act("pay")}
          type="button"
        >
          Confirm payment
        </button>
        <div className={styles.field}>
          <label>Return remarks</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <button
          className={styles.danger}
          disabled={saving || reason.trim().length < 3}
          onClick={() => act("return")}
          type="button"
        >
          Return to Staff
        </button>
      </section>
    );
  if (record.status === "PAYMENT_PROCESSED")
    actions = (
      <section className={styles.sideCard}>
        <h3>Upload payment receipt</h3>
        <p className={styles.muted}>The payment is recorded. Add its transaction proof to release the Cash Advance for requester reconciliation.</p>
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.uploadProofBox}>
          <label htmlFor={`cash-proof-${record.id}`}>Choose File</label>
          <span>{transactionProof?.name ?? "No file chosen"}</span>
          <input
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            id={`cash-proof-${record.id}`}
            onChange={(event) => setTransactionProof(event.currentTarget.files?.[0] ?? null)}
            type="file"
          />
          <small>PDF, JPG or PNG · maximum 2.5 MB</small>
        </div>
        <button className={styles.primary} disabled={saving || !transactionProof} onClick={() => act("pay")} type="button">
          Upload receipt and continue →
        </button>
      </section>
    );
  if (record.status === "PENDING_FINANCE_RECONCILIATION")
    actions = (
      <CashAdvanceReconciliationReview
        error={error}
        onComplete={() => act("complete")}
        onReasonChange={setReason}
        onReturn={() => act("return-reconciliation")}
        reason={reason}
        record={record}
        saving={saving}
      />
    );
  return (
    <CashAdvanceDetail
      actions={actions}
      backHref="/beta/finance/payment-requests/cash-advance"
      embedded={embedded}
      railFooter={
        embedded ? (
          <FinanceCurrentNextProcess
            title={
              record.status === "PENDING_FINANCE_RECONCILIATION"
                ? "Verify Cash Advance reconciliation"
                : "Finance payment"
            }
            copy={
              record.status === "PENDING_FINANCE_RECONCILIATION"
                ? "Review expense evidence and returned-balance information, then complete or return the reconciliation."
                : "Record the payment or return the request to Staff with correction remarks."
            }
          />
        ) : undefined
      }
      record={record}
    />
  );
}

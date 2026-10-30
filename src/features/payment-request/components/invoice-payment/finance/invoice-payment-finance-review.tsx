"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  completeInvoicePaymentByFinance,
  fetchInvoicePayment,
  processInvoicePaymentByFinance,
  returnInvoicePaymentByFinance,
  uploadInvoicePaymentProofByFinance,
} from "@/data/payment-requests/invoice-payment/api";
import type {
  InvoicePaymentRequestRecord,
  PaymentRequestDocument,
} from "@/domain/payment-requests/invoice-payment/types";
import { standardPaymentStatusLabel } from "@/domain/payment-requests/standard-payment-status";
import {
  getBetaAccount,
  readBetaSession,
  type BetaAccount,
} from "@/lib/auth/beta-accounts";

import styles from "./invoice-payment-finance.module.css";
import { FinanceCurrentNextProcess } from "../../finance-pending-processing/finance-current-next-process";
import {
  notifyStaffInvoicePaymentCompleted,
  notifyStaffInvoicePaymentReturned,
} from "@/features/payment-request/notifications/invoice-payment-notifications";

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}
function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(parsed);
}
function downloadDocument(document: PaymentRequestDocument) {
  const link = window.document.createElement("a");
  link.href = document.dataUrl;
  link.download = document.fileName;
  link.click();
}
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
function readProof(file: File) {
  return new Promise<PaymentRequestDocument>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: crypto.randomUUID(), fileName: file.name, mimeType: file.type, size: file.size, dataUrl: String(reader.result) });
    reader.onerror = () => reject(new Error("The transaction proof could not be read."));
    reader.readAsDataURL(file);
  });
}

function isImageLink(value: string) {
  return (
    value.startsWith("data:image/") ||
    /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(value)
  );
}

export function InvoicePaymentFinanceReview({
  requestId,
  embedded = false,
  initialRecord,
}: {
  requestId: string;
  embedded?: boolean;
  initialRecord?: InvoicePaymentRequestRecord;
}) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<InvoicePaymentRequestRecord | null>(
    initialRecord ?? null,
  );
  const [checked, setChecked] = useState(Boolean(initialRecord));
  const [returnRemarks, setReturnRemarks] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentReference, setPaymentReference] = useState(initialRecord?.financePaymentReference ?? initialRecord?.requestNumber ?? "");
  const [transactionProof, setTransactionProof] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAccount(readBetaSession());
    if (initialRecord) {
      setRecord(initialRecord);
      setPaymentDate(initialRecord.financePaymentDate ?? today());
      setPaymentReference(initialRecord.financePaymentReference ?? initialRecord.requestNumber);
      setChecked(true);
      return;
    }
    fetchInvoicePayment(requestId)
      .then((item) => {
        setRecord(item);
        setPaymentDate(item.financePaymentDate ?? today());
        setPaymentReference(item.financePaymentReference ?? item.requestNumber);
      })
      .finally(() => setChecked(true));
  }, [initialRecord, requestId]);
  function announceUpdate() {
    window.dispatchEvent(new Event("estuary:finance-queue-changed"));
    window.dispatchEvent(new Event("estuary:action-counts-changed"));
  }
  async function processPayment() {
    if (!record || !account) return;
    if (!confirmed || !paymentDate || !paymentReference.trim()) {
      setError("Confirm the payment date, reference and supporting documents.");
      return;
    }
    setError("");
    setIsSaving(true);
    try {
      const updated = await processInvoicePaymentByFinance(record.id, account.id, paymentDate, paymentReference);
      setRecord(updated);
      setSuccess("Payment information verified. Upload the transaction proof next.");
      announceUpdate();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The request could not be completed.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  async function uploadProof() {
    if (!record || !account || !transactionProof) {
      setError("Upload the payment transaction proof.");
      return;
    }
    setError(""); setIsSaving(true);
    try {
      const proof = await readProof(transactionProof);
      const updated = await uploadInvoicePaymentProofByFinance(record.id, account.id, proof);
      setRecord(updated); setTransactionProof(null);
      setSuccess("Transaction proof uploaded. Review it and complete the record.");
      announceUpdate();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The proof could not be uploaded.");
    } finally { setIsSaving(false); }
  }
  async function completeRequest() {
    if (!record || !account) return;
    setError(""); setIsSaving(true);
    try {
      const updated = await completeInvoicePaymentByFinance(record.id, account.id);
      notifyStaffInvoicePaymentCompleted(updated, account);
      setRecord(updated);
      setSuccess("The Invoice Payment was marked as completed.");
      announceUpdate();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The request could not be completed.");
    } finally { setIsSaving(false); }
  }
  async function returnToStaff() {
    if (!record || !account) return;
    setError("");
    setIsSaving(true);
    try {
      const updated = await returnInvoicePaymentByFinance(
        record.id,
        account.id,
        returnRemarks,
      );
      notifyStaffInvoicePaymentReturned(updated, account, "Finance");
      setRecord(updated);
      setSuccess("The Invoice Payment was returned to Staff for correction.");
      announceUpdate();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The request could not be returned.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!checked)
    return (
      <StatePage
        title="Loading request"
        copy="Reading the Invoice Payment details…"
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
        title="Invoice Payment not found"
        copy="The local request could not be found in this browser."
      />
    );

  const canProcess = record.status === "PENDING_FINANCE_REVIEW";
  const canUploadProof = record.status === "PAYMENT_PROCESSED";
  const canComplete = record.status === "TRANSACTION_PROOF_UPLOADED";
  const canAct = canProcess || canUploadProof || canComplete;
  const managerName =
    getBetaAccount(record.managerApproverId)?.name ?? record.managerApproverId;
  const directorName =
    getBetaAccount(record.directorApproverId)?.name ??
    record.directorApproverId;
  const portion =
    record.paymentPortion === "UPFRONT_50"
      ? "50% upfront payment"
      : record.paymentPortion === "BALANCE_50"
        ? "50% balance payment"
        : record.paymentPortion === "FULL"
          ? "Full payment"
          : (record.paymentPortionOther ?? "Other");

  return (
    <main className={styles.page}>
      {!embedded && (
        <div className={styles.backRow}>
          <Link href="/beta/finance/payment-requests/invoice-payments">
            ← Back to Invoice Payments
          </Link>
        </div>
      )}
      {error && (
        <div className={styles.errorNotice} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className={styles.successNotice} role="status">
          {success}
        </div>
      )}
      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <header className={styles.detailHero}>
            <div>
              <div className={styles.detailEyebrow}>
                <span>Finance verification</span>
                <span
                  className={styles.detailStatusBadge}
                  data-status={record.status}
                >
                  {standardPaymentStatusLabel(record.status)}
                </span>
              </div>
              <h1>{record.requestNumber}</h1>
              <p>{record.title}</p>
            </div>
            <div className={styles.detailTotal}>
              <small>Total requested</small>
              <strong>{money(record.totalAmount)}</strong>
            </div>
          </header>
          <DetailSection title="Request & Approval Overview">
            <dl className={styles.detailGrid}>
              <Value label="Request date" value={date(record.requestDate)} />
              <Value label="Staff" value={record.staffName} />
              <Value label="Project" value={record.projectName} />
              <Value label="Manager reviewer" value={managerName} />
              <Value label="Director reviewer" value={directorName} />
              <Value
                label="Director approved"
                value={
                  record.directorReviewedAt
                    ? date(record.directorReviewedAt)
                    : "Not recorded"
                }
              />
            </dl>
          </DetailSection>
          <DetailSection title="Invoice Details">
            <dl className={styles.detailGrid}>
              <Value label="Vendor" value={record.vendorName} />
              <Value
                label="Transfer type"
                value={
                  record.transferType === "GIRO"
                    ? "GIRO transfer — next working day"
                    : "Instant transfer"
                }
              />
              <Value label="Payment portion" value={portion} />
              <div>
                <dt>E-invoice link</dt>
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
            <div className={styles.eInvoicePreview}>
              <span>E-invoice preview</span>
              {isImageLink(record.eInvoiceLink) ? (
                // The request may contain an uploaded image data URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`E-invoice preview for ${record.requestNumber}`}
                  src={record.eInvoiceLink}
                />
              ) : (
                <iframe
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={record.eInvoiceLink}
                  title={`E-invoice preview for ${record.requestNumber}`}
                />
              )}
              <small>
                If the source blocks embedded previews, use Open e-invoice
                above.
              </small>
            </div>
            {record.remarks && (
              <div className={styles.longValue}>
                <span>Additional remarks</span>
                <p>{record.remarks}</p>
              </div>
            )}
          </DetailSection>
          <DetailSection title="Payment Amount">
            <dl className={styles.detailGrid}>
              <Value label="Currency" value="MYR" />
              <Value label="Invoice total" value={money(record.invoiceTotal)} />
              <Value label="Tax / SST" value={money(record.taxAmount)} />
              <Value
                label="Amount requested"
                value={money(record.requestedAmount)}
              />
            </dl>
          </DetailSection>
          <DetailSection title="Supporting Documents">
            <div className={styles.documents}>
              {record.supportingDocuments.map((document) => (
                <div key={document.id}>
                  <span aria-hidden="true" className={styles.documentIcon}>
                    ▧
                  </span>
                  <div>
                    <strong>{document.fileName}</strong>
                    <span>
                      {Math.max(1, Math.round(document.size / 1024))} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadDocument(document)}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </DetailSection>
        </div>
        <div className={styles.rightRail}>
          <aside className={styles.actionPanel}>
            <p>Finance action</p>
            <h2>
              {canProcess
                ? "Verify payment information"
                : canUploadProof
                  ? "Upload transaction proof"
                  : canComplete
                    ? "Complete payment record"
                : record.status === "COMPLETED"
                  ? "Payment completed"
                  : "Verification recorded"}
            </h2>
            {canAct ? (
              <>
                {canProcess && <>
                  <span>Check the invoice and supporting documents, then confirm the payment information.</span>
                  <label><span>Payment date</span><input onChange={(event) => setPaymentDate(event.target.value)} type="date" value={paymentDate} /></label>
                  <label><span>Payment reference</span><input className={styles.financeReference} readOnly value={paymentReference} /></label>
                  <label className={styles.confirmation}><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /><span>I confirm that this payment has been processed and I reviewed the supporting documents.</span></label>
                  <button className={styles.primaryAction} disabled={isSaving || !confirmed || !paymentDate || !paymentReference.trim()} type="button" onClick={processPayment}>Verify payment information <b aria-hidden="true">→</b></button>
                </>}
                {canUploadProof && <>
                  <span>The payment is verified. Upload its transaction receipt or proof; this request remains in the Finance queue.</span>
                  <div className={styles.recordedPayment}><small>Payment date</small><strong>{date(record.financePaymentDate ?? paymentDate)}</strong><small>Payment reference</small><strong>{record.financePaymentReference ?? paymentReference}</strong></div>
                  <label><span>Payment transaction proof</span><input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setTransactionProof(event.currentTarget.files?.[0] ?? null)} type="file" /></label>
                  <button className={styles.primaryAction} disabled={isSaving || !transactionProof} type="button" onClick={uploadProof}>Upload transaction proof <b aria-hidden="true">→</b></button>
                </>}
                {canComplete && <>
                  <span>The transaction proof has been uploaded. Review the record before completing it.</span>
                  {record.financeTransactionProof && <button className={styles.proofLink} type="button" onClick={() => downloadDocument(record.financeTransactionProof!)}>Open {record.financeTransactionProof.fileName} ↗</button>}
                  <button className={styles.primaryAction} disabled={isSaving} type="button" onClick={completeRequest}>Mark as completed <b aria-hidden="true">→</b></button>
                </>}
                <div className={styles.actionDivider}>
                  <span>or return with notes</span>
                </div>
                <label>
                  <span>Reason for returning</span>
                  <textarea
                    rows={4}
                    placeholder="Explain what Staff needs to correct"
                    value={returnRemarks}
                    onChange={(event) => setReturnRemarks(event.target.value)}
                  />
                </label>
                <button
                  className={styles.returnAction}
                  disabled={isSaving || !returnRemarks.trim() || canComplete}
                  type="button"
                  onClick={returnToStaff}
                >
                  Return to Staff
                </button>
              </>
            ) : (
              <>
                <span>
                  This request is now:{" "}
                  <strong>{standardPaymentStatusLabel(record.status)}</strong>.
                </span>
                {record.financeVerifiedAt && (
                  <small>Completed {date(record.financeVerifiedAt)}</small>
                )}
                {record.financeReturnRemarks && (
                  <div className={styles.returnedReason}>
                    <strong>Reason of rejection</strong>
                    <p>{record.financeReturnRemarks}</p>
                  </div>
                )}
              </>
            )}
          </aside>
          {embedded ? (
            <FinanceCurrentNextProcess
              title="Finance verification"
              copy="Verify the invoice and supporting documents, then complete or return the request."
            />
          ) : (
            <Progress
              record={record}
              managerName={managerName}
              directorName={directorName}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function Progress({
  record,
  managerName,
  directorName,
}: {
  record: InvoicePaymentRequestRecord;
  managerName: string;
  directorName: string;
}) {
  const active = record.status === "COMPLETED" ? 5 : 4;
  const steps = [
    { title: "Request Submitted", copy: `Submitted by ${record.staffName}` },
    { title: "Manager Review", copy: `Approved by ${managerName}` },
    { title: "Director Review", copy: `Approved by ${directorName}` },
    {
      title: "Finance Verification",
      copy: "Finance verification and completion",
    },
    { title: "Completed", copy: "Request verified and closed" },
  ];
  return (
    <aside className={styles.progressPanel}>
      <header>
        <p>Payment progress</p>
        <span>Step {active} of 5</span>
      </header>
      <ol>
        {steps.map((step, index) => {
          const number = index + 1;
          const state =
            number < active || (record.status === "COMPLETED" && number === 5)
              ? "complete"
              : number === active
                ? "active"
                : "pending";
          return (
            <li
              className={styles.progressStep}
              data-state={state}
              key={step.title}
            >
              <i aria-hidden="true">{state === "complete" ? "✓" : ""}</i>
              <div>
                <strong>{step.title}</strong>
                <small>
                  {state === "active"
                    ? `Current stage: ${step.copy}`
                    : step.copy}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
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
function StatePage({ title, copy }: { title: string; copy: string }) {
  return (
    <main className={styles.statePage}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href="/beta/finance/payment-requests/invoice-payments">
        Back to Invoice Payments
      </Link>
    </main>
  );
}

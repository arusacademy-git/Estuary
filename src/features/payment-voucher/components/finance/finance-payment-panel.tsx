"use client";

import { useState } from "react";

import {
  completePaymentVoucher,
  markPaymentVoucherInactive,
  recordPaymentVoucherPdfGenerated,
  returnPaymentVoucherForNewSignature,
  savePaymentVoucherFinanceInformation,
  startPaymentVoucherFinanceProcessing,
} from "@/data/payment-vouchers/payment-voucher-api";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import {
  notifyStaffPdfReady,
  notifyStaffPvCompleted,
  notifyStaffPvInactive,
  notifyStaffSignedPvReturned,
} from "@/features/payment-voucher/notifications/payment-voucher-notifications";
import {
  downloadPaymentVoucherPdf,
  previewPaymentVoucherPdf,
} from "@/features/payment-voucher/pdf/download-payment-voucher-pdf";
import { betaAccounts, type BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "./finance-payment.module.css";

type FinanceProcessingPanelProps = {
  finance: BetaAccount;
  voucher: PaymentVoucherRecord;
  onUpdated: () => void | Promise<void>;
  onProcessingStarted?: (voucherId: string) => void;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

const accountName = (id: string) =>
  betaAccounts.find((account) => account.id === id)?.name ?? id;

export function FinanceProcessingPanel({
  finance,
  voucher,
  onUpdated,
  onProcessingStarted,
}: FinanceProcessingPanelProps) {
  const [paymentDate, setPaymentDate] = useState(
    voucher.paymentDate || today(),
  );
  const [financeRemarks, setFinanceRemarks] = useState(
    voucher.paymentRemarks || "",
  );
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showInactiveForm, setShowInactiveForm] = useState(false);
  const [inactiveRemarks, setInactiveRemarks] = useState("");
  const [transactionProof, setTransactionProof] = useState<File | null>(null);
  const [archiveConfirmed, setArchiveConfirmed] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [signedPvPreviewed, setSignedPvPreviewed] = useState(false);

  const isGenerationStage = [
    "APPROVED_FOR_PAYMENT",
    "FINANCE_PROCESSING",
  ].includes(voucher.status);
  const isWaitingForSignature = [
    "AWAITING_RECIPIENT_SIGNATURE",
    "AWAITING_SIGNED_PV_UPLOAD",
    "AWAITING_STAFF_CONFIRMATION",
  ].includes(voucher.status);
  const isFinalVerification = voucher.status === "PENDING_FINANCE_VERIFICATION";

  const canMarkInactive = [
    "APPROVED_FOR_PAYMENT",
    "FINANCE_PROCESSING",
    "AWAITING_RECIPIENT_SIGNATURE",
    "AWAITING_STAFF_CONFIRMATION",
    "PENDING_FINANCE_VERIFICATION",
    "AWAITING_SIGNED_PV_UPLOAD",
  ].includes(voucher.status);

  async function generatePaymentVoucher() {
    if (!paymentDate || !paymentProcessed) return;

    setProcessing(true);
    setMessage("");
    setError("");

    try {
      if (voucher.status === "APPROVED_FOR_PAYMENT") {
        await startPaymentVoucherFinanceProcessing(voucher.id, finance.id);
        onProcessingStarted?.(voucher.id);
      }

      await savePaymentVoucherFinanceInformation(voucher.id, {
        financeId: finance.id,
        paymentDate,
        paymentReference: voucher.voucherNumber,
        paymentRemarks: financeRemarks.trim() || undefined,
        paymentProofFileName:
          voucher.paymentProofFileName || voucher.receiptFileName || undefined,
      });

      const generatedVoucher = await recordPaymentVoucherPdfGenerated(
        voucher.id,
        finance.id,
      );

      notifyStaffPdfReady(generatedVoucher, finance);
      await onUpdated();
      setMessage(
        "PV generated. The requester can now send it to the external recipient for signing.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Payment Voucher could not be generated.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function markBankRejected() {
    const cleanedRemarks = inactiveRemarks.trim();

    if (!cleanedRemarks) {
      setError("Enter the bank rejection or incorrect-payment reason.");
      return;
    }

    setProcessing(true);
    setMessage("");
    setError("");

    try {
      const updatedVoucher = await markPaymentVoucherInactive(
        voucher.id,
        finance.id,
        cleanedRemarks,
      );

      notifyStaffPvInactive(updatedVoucher, finance);
      await onUpdated();
      setInactiveRemarks("");
      setShowInactiveForm(false);
      setMessage(
        "The Payment Voucher was marked inactive. Staff has been notified to create a new PV.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Payment Voucher could not be marked inactive.",
      );
    } finally {
      setProcessing(false);
    }
  }

  function selectTransactionProof(file: File | undefined) {
    setError("");

    if (!file) {
      setTransactionProof(null);
      return;
    }

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      setTransactionProof(null);
      setError("Upload the transaction proof as a PDF, JPG or PNG file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setTransactionProof(null);
      setError("The transaction proof must be 10 MB or smaller.");
      return;
    }

    setTransactionProof(file);
  }

  async function archivePaymentVoucher() {
    if (!transactionProof || !archiveConfirmed) return;

    setProcessing(true);
    setMessage("");
    setError("");

    try {
      await savePaymentVoucherFinanceInformation(voucher.id, {
        financeId: finance.id,
        paymentDate: voucher.paymentDate || paymentDate,
        paymentReference: voucher.voucherNumber,
        paymentRemarks: financeRemarks.trim() || voucher.paymentRemarks,
        paymentProofFileName: transactionProof.name,
      });

      const completedVoucher = await completePaymentVoucher(
        voucher.id,
        finance.id,
      );
      notifyStaffPvCompleted(completedVoucher, finance);
      await onUpdated();
      setMessage(
        "The signed PV and transaction proof were verified. The record is completed, archived and locked in Payment Records.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The signed Payment Voucher could not be archived.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function returnSignedPaymentVoucher() {
    const remarks = returnRemarks.trim();
    if (!remarks) {
      setError("Enter Finance remarks before returning the signed PV.");
      return;
    }

    setProcessing(true);
    setMessage("");
    setError("");

    try {
      const returnedVoucher = await returnPaymentVoucherForNewSignature(
        voucher.id,
        finance.id,
        remarks,
      );
      notifyStaffSignedPvReturned(returnedVoucher, finance);
      await onUpdated();
      setShowReturnForm(false);
      setReturnRemarks("");
      setMessage("The signed PV was returned to the requester for correction.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The signed Payment Voucher could not be returned.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function previewSignedPaymentVoucher() {
    setProcessing(true);
    setMessage("");
    setError("");

    try {
      await previewPaymentVoucherPdf(voucher);
      setSignedPvPreviewed(true);
      setMessage("Signed PV opened for Finance verification.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The signed Payment Voucher could not be previewed.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function downloadSignedPaymentVoucher() {
    setProcessing(true);
    setMessage("");
    setError("");

    try {
      if (voucher.signedPvDataUrl) {
        const link = document.createElement("a");
        link.href = voucher.signedPvDataUrl;
        link.download = voucher.signedPvFileName || `${voucher.voucherNumber}-signed.pdf`;
        link.click();
      } else {
        await downloadPaymentVoucherPdf(voucher);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The signed Payment Voucher could not be downloaded.",
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.details}>
        <h3>Payment details</h3>
        <dl className={styles.detailGrid}>
          <div>
            <dt>PV date</dt>
            <dd>{voucher.pvDate}</dd>
          </div>
          <div>
            <dt>Submitter</dt>
            <dd>{accountName(voucher.submitterId)}</dd>
          </div>
          <div>
            <dt>Division</dt>
            <dd>{voucher.division}</dd>
          </div>
          <div>
            <dt>Purpose of payment</dt>
            <dd>{voucher.purpose}</dd>
          </div>
          <div>
            <dt>Amount in words</dt>
            <dd>{money(voucher.amount)}</dd>
          </div>
        </dl>

        <h3>Recipient information</h3>
        <dl className={styles.detailGrid}>
          <div>
            <dt>Recipient name</dt>
            <dd>{voucher.recipientName}</dd>
          </div>
          <div>
            <dt>Recipient email</dt>
            <dd>{voucher.recipientEmail}</dd>
          </div>
          <div>
            <dt>Payment method</dt>
            <dd>{voucher.paymentMethod}</dd>
          </div>
          <div>
            <dt>Bank</dt>
            <dd>{voucher.bankName || "—"}</dd>
          </div>
          <div>
            <dt>Bank account</dt>
            <dd>{voucher.bankAccountNumber || "—"}</dd>
          </div>
          <div>
            <dt>Recipient reference</dt>
            <dd>{voucher.recipientReference}</dd>
          </div>
        </dl>

        <h3>Payment breakdown</h3>
        <div className={styles.breakdown}>
          <div className={styles.breakdownHeader}>
            <span>Account</span>
            <span>Description</span>
            <span>Qty × price</span>
            <span>Amount</span>
          </div>
          {voucher.lines.map((line, index) => (
            <div key={`${line.accountCode}-${index}`}>
              <span>{line.accountCode}</span>
              <strong>{line.description}</strong>
              <span>
                {line.quantity} × {money(line.unitAmount)}
              </span>
              <b>{money(line.quantity * line.unitAmount + line.taxAmount)}</b>
            </div>
          ))}
        </div>
        <div className={styles.grandTotal}>
          <span>Grand total</span>
          <strong>{money(voucher.amount)}</strong>
        </div>
      </section>

      <aside className={styles.actions}>
        <h3>
          {isFinalVerification
            ? "Verify signed Payment Voucher"
            : isWaitingForSignature
              ? "Signed PV in progress"
              : "Generate Payment Voucher"}
        </h3>

        {message && <div className={styles.success}>{message}</div>}
        {error && <div className={styles.error}>{error}</div>}

        {isGenerationStage && (
          <>
            <label>
              <span>Payment date</span>
              <input onChange={(event) => setPaymentDate(event.target.value)} type="date" value={paymentDate} />
            </label>
            <label>
              <span>Payment reference</span>
              <input readOnly value={voucher.voucherNumber} />
            </label>
            <label>
              <span>Finance remarks</span>
              <textarea onChange={(event) => setFinanceRemarks(event.target.value)} placeholder="Optional payment remarks" rows={4} value={financeRemarks} />
            </label>
            <label className={styles.paymentConfirmation}>
              <input checked={paymentProcessed} onChange={(event) => setPaymentProcessed(event.target.checked)} type="checkbox" />
              <span>I confirm that this payment has been processed.</span>
            </label>
            <div className={styles.primaryActions}>
              <button className={styles.generateButton} disabled={processing || !paymentDate || !paymentProcessed} onClick={generatePaymentVoucher} type="button">
                {processing ? "Generating…" : "Generate PV"}
              </button>
              {canMarkInactive && voucher.status !== "INACTIVE" && (
                <button className={styles.inactiveToggle} onClick={() => { setShowInactiveForm((current) => !current); setError(""); }} type="button">
                  {showInactiveForm ? "Cancel rejection" : "Bank rejected"}
                </button>
              )}
            </div>
          </>
        )}

        {isWaitingForSignature && (
          <section className={styles.waitingCard}>
            <span>Waiting for requester / recipient</span>
            <strong>
              {voucher.status === "AWAITING_STAFF_CONFIRMATION"
                ? "Requester must verify the signed PV"
                : "External recipient must sign the PV"}
            </strong>
            <p>
              Finance payment information is locked for this stage. The record returns to Finance only after the signed PV is confirmed by the original requester.
            </p>
          </section>
        )}

        {isFinalVerification && (
          <>
            <dl className={styles.verificationSummary}>
              <div>
                <dt>Signed PV</dt>
                <dd>
                  <button
                    className={styles.signedPvLink}
                    disabled={processing}
                    onClick={previewSignedPaymentVoucher}
                    type="button"
                  >
                    {voucher.signedPvFileName || `${voucher.voucherNumber}-signed.pdf`}
                  </button>
                </dd>
              </div>
              <div><dt>Payment reference</dt><dd>{voucher.voucherNumber}</dd></div>
            </dl>

            <button className={styles.downloadButton} disabled={processing} onClick={downloadSignedPaymentVoucher} type="button">
              Download signed PV
            </button>

            <label>
              <span>Payment transaction proof *</span>
              <input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => selectTransactionProof(event.target.files?.[0])} type="file" />
              <small>{transactionProof?.name || "PDF, JPG or PNG · maximum 10 MB"}</small>
            </label>

            <label>
              <span>Finance remarks</span>
              <textarea onChange={(event) => setFinanceRemarks(event.target.value)} placeholder="Optional archive remarks" rows={3} value={financeRemarks} />
            </label>

            <label className={styles.archiveConfirmation}>
              <input checked={archiveConfirmed} disabled={!signedPvPreviewed} onChange={(event) => setArchiveConfirmed(event.target.checked)} type="checkbox" />
              <span>I verified the signed PV and transaction proof. Complete, archive and lock this record.</span>
            </label>

            {!signedPvPreviewed && (
              <small className={styles.previewRequirement}>Open and review the signed PV before confirming archival.</small>
            )}

            <button className={styles.completeButton} disabled={processing || !signedPvPreviewed || !transactionProof || !archiveConfirmed} onClick={archivePaymentVoucher} type="button">
              {processing ? "Archiving…" : "Archive and complete PV"}
            </button>

            <button className={styles.returnButton} disabled={processing} onClick={() => { setShowReturnForm((current) => !current); setError(""); }} type="button">
              {showReturnForm ? "Cancel return" : "Return signed PV"}
            </button>

            {showReturnForm && (
              <section className={styles.returnCard}>
                <label>
                  <span>Reason for returning *</span>
                  <textarea maxLength={500} onChange={(event) => setReturnRemarks(event.target.value)} placeholder="Explain what must be corrected" rows={3} value={returnRemarks} />
                </label>
                <button disabled={processing || !returnRemarks.trim()} onClick={returnSignedPaymentVoucher} type="button">Confirm return</button>
              </section>
            )}
          </>
        )}

        {canMarkInactive &&
          voucher.status !== "INACTIVE" &&
          showInactiveForm && (
            <section className={styles.inactiveAction}>
              <div className={styles.inactiveForm}>
                <label>
                  <span>Bank rejection remarks</span>
                  <textarea
                    maxLength={500}
                    onChange={(event) => setInactiveRemarks(event.target.value)}
                    placeholder="Explain the bank rejection or incorrect payment information"
                    rows={4}
                    value={inactiveRemarks}
                  />
                </label>
                <p>
                  This locks the original PV. Staff must create a new Payment
                  Voucher if another payment attempt is required.
                </p>
                <button
                  className={styles.inactiveButton}
                  disabled={processing || !inactiveRemarks.trim()}
                  onClick={markBankRejected}
                  type="button"
                >
                  Mark PV as bank rejected
                </button>
              </div>
            </section>
          )}

        {isGenerationStage && <small className={styles.helpText}>Generating records the payment and notifies the requester to send the PV to the external recipient. It does not force a download.</small>}

        <section className={styles.nextProcess}>
          <span>Current next process</span>
          <strong>
            {isFinalVerification
              ? "Signed PV verification and archival"
              : isWaitingForSignature
                ? "Recipient signature and requester confirmation"
                : "Finance payment and PV generation"}
          </strong>
          <p>
            {isFinalVerification
              ? "Download and verify the signed PV, upload the transaction proof, then archive and lock the completed record in Payment Records."
              : isWaitingForSignature
                ? "The requester sends the PV to the recipient. After the recipient signs it, the requester confirms the signed PV and sends it back to Finance."
                : "Record the payment and generate the Payment Voucher for requester delivery and recipient signing."}
          </p>
        </section>
      </aside>
    </div>
  );
}

// Compatibility export for the dedicated Finance Payment Voucher page.
// The combined queue imports FinanceProcessingPanel from this same file.
export const FinancePaymentPanel = FinanceProcessingPanel;

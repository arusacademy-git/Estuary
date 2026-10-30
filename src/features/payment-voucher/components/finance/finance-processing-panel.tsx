"use client";

import { useState } from "react";

import {
  markPaymentVoucherInactive,
  recordPaymentVoucherPdfGenerated,
  savePaymentVoucherFinanceInformation,
  startPaymentVoucherFinanceProcessing,
} from "@/data/payment-vouchers/payment-voucher-api";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import {
  notifyStaffPdfReady,
  notifyStaffPvInactive,
} from "@/features/payment-voucher/notifications/payment-voucher-notifications";
import { betaAccounts, type BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "./finance-processing-panel.module.css";

type FinanceProcessingPanelProps = {
  finance: BetaAccount;
  voucher: PaymentVoucherRecord;
  onUpdated: () => void | Promise<void>;
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
        <h3>Generate Payment Voucher</h3>

        {message && <div className={styles.success}>{message}</div>}
        {error && <div className={styles.error}>{error}</div>}

        <label>
          <span>Payment date</span>
          <input
            onChange={(event) => setPaymentDate(event.target.value)}
            type="date"
            value={paymentDate}
          />
        </label>
        <label>
          <span>Payment reference</span>
          <input readOnly value={voucher.voucherNumber} />
        </label>
        <label>
          <span>Finance remarks</span>
          <textarea
            onChange={(event) => setFinanceRemarks(event.target.value)}
            placeholder="Optional payment remarks"
            rows={4}
            value={financeRemarks}
          />
        </label>

        <label className={styles.paymentConfirmation}>
          <input
            checked={paymentProcessed}
            onChange={(event) => setPaymentProcessed(event.target.checked)}
            type="checkbox"
          />
          <span>I confirm that this payment has been processed.</span>
        </label>

        <div className={styles.primaryActions}>
          <button
            className={styles.generateButton}
            disabled={processing || !paymentDate || !paymentProcessed}
            onClick={generatePaymentVoucher}
            type="button"
          >
            {processing ? "Generating…" : "Generate PV"}
          </button>

          {canMarkInactive && voucher.status !== "INACTIVE" && (
            <button
              className={styles.inactiveToggle}
              onClick={() => {
                setShowInactiveForm((current) => !current);
                setError("");
              }}
              type="button"
            >
              {showInactiveForm ? "Cancel rejection" : "Bank rejected"}
            </button>
          )}
        </div>

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

        <small className={styles.helpText}>
          Generating records the payment and notifies the requester to send the
          PV to the external recipient. It does not force a download.
        </small>

        {voucher.signedPvDataUrl && (
          <a
            className={styles.downloadButton}
            download={voucher.signedPvFileName}
            href={voucher.signedPvDataUrl}
          >
            Download signed PV
          </a>
        )}

        <section className={styles.nextProcess}>
          <span>Current next process</span>
          <strong>Finance payment and PV generation</strong>
          <p>
            Record the payment and generate the Payment Voucher for requester
            delivery and recipient signing. Upload the transaction proof from
            the Finance queue when it becomes available.
          </p>
        </section>
      </aside>
    </div>
  );
}

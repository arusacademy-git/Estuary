"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { deleteManualFormDraft } from "@/data/payment-requests/manual-drafts/api";
import { CashAdvancePaymentRecordDetail } from "@/features/payment-records/components/cash-advance/cash-advance-detail";
import { ClaimRecordDetail } from "@/features/payment-records/components/claims/claim-record-detail";
import { InvoicePaymentRecordDetail } from "@/features/payment-records/components/invoice-payment/invoice-payment-record-detail";
import { TravelAllowanceRecordDetail } from "@/features/payment-records/components/travel-allowance/travel-allowance-record-detail";
import { PettyCashDetail } from "@/features/payment-request/components/petty-cash/staff/petty-cash-detail";
import { PaymentVoucherDetail } from "@/features/payment-voucher/components/payment-voucher-detail";

import styles from "./my-request-action.module.css";

export type MyRequestActionRecord = {
  id: string;
  type:
    | "PAYMENT_VOUCHER"
    | "INVOICE_PAYMENT"
    | "TRAVEL_ALLOWANCE"
    | "CASH_ADVANCE"
    | "PETTY_CASH"
    | "CLAIM";
  reference: string;
  purpose: string;
  amount: number;
  href: string;
  draft: boolean;
};

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function Detail({ record }: { record: MyRequestActionRecord }) {
  if (record.type === "PAYMENT_VOUCHER")
    return <PaymentVoucherDetail voucherId={record.id} />;
  if (record.type === "INVOICE_PAYMENT")
    return <InvoicePaymentRecordDetail requestId={record.id} />;
  if (record.type === "TRAVEL_ALLOWANCE")
    return <TravelAllowanceRecordDetail requestId={record.id} />;
  if (record.type === "CASH_ADVANCE")
    return <CashAdvancePaymentRecordDetail requestId={record.reference} />;
  if (record.type === "PETTY_CASH")
    return <PettyCashDetail requestId={record.reference} />;
  return <ClaimRecordDetail requestId={record.reference} />;
}

export function MyRequestAction({
  record,
  label,
  organizationId,
  requesterId,
  onDraftDeleted,
}: {
  record: MyRequestActionRecord;
  label: string;
  organizationId: string;
  requesterId: string;
  onDraftDeleted: (id: string) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!detailOpen && !deleteOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailOpen(false);
        setDeleteOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [deleteOpen, detailOpen]);

  const removeDraft = async () => {
    setDeleting(true);
    setError("");
    try {
      const draftId = record.id.replace(/^draft-/, "");
      await deleteManualFormDraft(draftId, organizationId, requesterId);
      onDraftDeleted(record.id);
      setDeleteOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The draft could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (record.draft)
    return (
      <div className={styles.draftActions}>
        <Link href={record.href}>Continue draft</Link>
        <button onClick={() => setDeleteOpen(true)} type="button">
          Delete draft
        </button>
        {deleteOpen && (
          <div className={styles.backdrop} role="presentation">
            <section
              aria-labelledby="delete-draft-title"
              aria-modal="true"
              className={styles.deleteModal}
              role="dialog"
            >
              <Image
                alt=""
                height={18}
                src="/assets/icons/bin-red.png"
                width={18}
              />
              <h2 id="delete-draft-title">Delete this draft?</h2>
              <p>
                The saved {record.purpose}
                {!record.purpose.toLowerCase().endsWith("draft") && " draft"}
                {record.amount ? ` (${money(record.amount)})` : ""} will be
                permanently deleted. This cannot be undone.
              </p>
              {error && <span role="alert">{error}</span>}
              <footer>
                <button onClick={() => setDeleteOpen(false)} type="button">
                  Cancel
                </button>
                <button disabled={deleting} onClick={removeDraft} type="button">
                  {deleting ? "Deleting…" : "Delete draft"}
                </button>
              </footer>
            </section>
          </div>
        )}
      </div>
    );

  return (
    <>
      <button
        className={styles.openButton}
        onClick={() => setDetailOpen(true)}
        type="button"
      >
        {label}
      </button>
      {detailOpen && (
        <div className={styles.backdrop} role="presentation">
          <section
            aria-label={`${record.reference} details and payment progress`}
            aria-modal="true"
            className={styles.detailModal}
            role="dialog"
          >
            <header>
              <div>
                <span>{record.reference}</span>
                <h2>Request details and progress</h2>
              </div>
              <button
                aria-label="Close request details"
                onClick={() => setDetailOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className={styles.detailContent}>
              <Detail record={record} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

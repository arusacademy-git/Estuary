import type { ManualDraftType } from "@/domain/payment-requests/manual-drafts/types";

import styles from "./manual-draft-confirmation.module.css";

const DRAFT_META: Record<
  ManualDraftType,
  { code: string; label: string; recordsLabel: string; tone: string }
> = {
  PAYMENT_VOUCHER: {
    code: "PV",
    label: "Payment Voucher",
    recordsLabel: "Payment Voucher drafts",
    tone: "paymentVoucherBadge",
  },
  INVOICE_PAYMENT: {
    code: "INV",
    label: "Invoice Payment",
    recordsLabel: "Invoice Payment drafts",
    tone: "invoiceBadge",
  },
  TRAVEL_ALLOWANCE: {
    code: "TA",
    label: "Travel Allowance",
    recordsLabel: "Travel Allowance drafts",
    tone: "travelBadge",
  },
  PETTY_CASH: {
    code: "PC",
    label: "Petty Cash",
    recordsLabel: "Petty Cash drafts",
    tone: "pettyCashBadge",
  },
  CASH_ADVANCE: {
    code: "CA",
    label: "Cash Advance",
    recordsLabel: "Cash Advance drafts",
    tone: "cashAdvanceBadge",
  },
  CLAIM: {
    code: "CL",
    label: "Claim",
    recordsLabel: "Claim drafts",
    tone: "claimBadge",
  },
};

export function ManualDraftConfirmation({
  paymentType,
  recordsHref,
  createHref,
}: {
  paymentType: ManualDraftType;
  recordsHref: string;
  createHref: string;
}) {
  const meta = DRAFT_META[paymentType];

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span aria-hidden="true" className={styles.successIcon}>✓</span>

        <div className={styles.typeLine}>
          <span className={`${styles.typeBadge} ${styles[meta.tone]}`}>
            {meta.code}
          </span>
          <span>{meta.label} draft</span>
        </div>

        <h1>Draft saved successfully</h1>
        <p className={styles.intro}>
          Your unfinished {meta.label} is stored in My Requests and has not
          entered the approval workflow.
        </p>

        <dl className={styles.summary}>
          <div>
            <dt>Saved in</dt>
            <dd>My Requests · {meta.label}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd><span className={styles.status}>Draft · not submitted</span></dd>
          </div>
        </dl>

        <p className={styles.note}>
          Continue it later from My Requests, or start a separate {meta.label} request now.
        </p>

        <div className={styles.actions}>
          <a className={styles.secondaryButton} href={recordsHref}>
            View {meta.recordsLabel}
          </a>
          <a className={styles.primaryButton} href={createHref}>
            Create another {meta.label}
          </a>
        </div>
      </section>
    </main>
  );
}

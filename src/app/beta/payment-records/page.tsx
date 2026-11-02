"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { fetchInvoicePayments } from "@/data/payment-requests/invoice-payment/api";
import { fetchTravelAllowances } from "@/data/payment-requests/travel-allowance/api";
import { fetchCashAdvances } from "@/data/payment-requests/cash-advance/cash-advance-api";
import { fetchClaimRequests } from "@/data/payment-requests/claims/api";
import { fetchPettyCashRequests } from "@/data/payment-requests/petty-cash/api";
import { fetchManualFormDrafts } from "@/data/payment-requests/manual-drafts/api";
import type {
  ManualDraftType,
  ManualFormDraft,
} from "@/domain/payment-requests/manual-drafts/types";
import type { InvoicePaymentRequestRecord } from "@/domain/payment-requests/invoice-payment/types";
import type { TravelAllowanceRecord } from "@/domain/payment-requests/travel-allowance/types";
import type { CashAdvanceRecord } from "@/domain/payment-requests/cash-advance/types";
import type { ClaimRecord } from "@/domain/payment-requests/claims/types";
import type { PettyCashRecord } from "@/domain/payment-requests/petty-cash/types";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import { readBetaSession, type BetaAccount } from "@/lib/auth/beta-accounts";
import { PaymentTypeCard } from "@/features/payment-records/components/payment-type-card";
import { usePaymentVouchers } from "@/features/payment-voucher/hooks/use-payment-vouchers";

import styles from "@/features/payment-records/components/payment-records.module.css";

function visibleVouchersFor(
  vouchers: PaymentVoucherRecord[],
  account: BetaAccount,
) {
  return vouchers.filter((voucher) => {
    if (voucher.submitterId === account.id) return true;
    if (account.role === "staff") return voucher.submitterId === account.id;
    if (account.role === "manager")
      return voucher.projectManagerId === account.id;
    if (account.role === "director") return voucher.directorId === account.id;
    return account.role === "finance";
  });
}
function voucherNeedsAttention(
  voucher: PaymentVoucherRecord,
  account: BetaAccount,
) {
  if (
    voucher.submitterId === account.id &&
    [
      "DRAFT",
      "REJECTED",
      "AWAITING_RECIPIENT_SIGNATURE",
      "AWAITING_STAFF_CONFIRMATION",
    ].includes(voucher.status)
  )
    return true;
  if (account.role === "staff")
    return (
      voucher.status === "DRAFT" ||
      voucher.status === "REJECTED" ||
      voucher.status === "AWAITING_STAFF_VERIFICATION"
    );
  if (account.role === "manager")
    return (
      voucher.status === "APPROVED_FOR_PAYMENT" &&
      !voucher.projectManagerViewedAt
    );
  if (account.role === "director")
    return voucher.status === "PENDING_DIRECTOR_APPROVAL";
  return (
    account.role === "finance" &&
    (voucher.status === "APPROVED_FOR_PAYMENT" ||
      voucher.status === "FINANCE_PROCESSING")
  );
}
function visibleInvoicesFor(
  records: InvoicePaymentRequestRecord[],
  account: BetaAccount,
) {
  return records.filter((record) => {
    if (account.role === "staff") return record.staffId === account.id;
    if (account.role === "manager")
      return record.managerApproverId === account.id;
    if (account.role === "director")
      return record.directorApproverId === account.id;
    return account.role === "finance";
  });
}
function invoiceNeedsAttention(
  record: InvoicePaymentRequestRecord,
  account: BetaAccount,
) {
  if (account.role === "staff") return record.status === "RETURNED_TO_STAFF";
  if (account.role === "manager")
    return record.status === "PENDING_MANAGER_REVIEW";
  if (account.role === "director")
    return record.status === "PENDING_DIRECTOR_REVIEW";
  return (
    account.role === "finance" && record.status === "PENDING_FINANCE_REVIEW"
  );
}
function visibleTravelAllowancesFor(
  records: TravelAllowanceRecord[],
  account: BetaAccount,
) {
  return records.filter((record) => {
    if (account.role === "staff")
      return (
        record.requesterId === account.id ||
        record.lines.some((line) => line.employeeId === account.id)
      );
    if (account.role === "manager")
      return (
        record.managerApproverId === account.id ||
        record.requesterId === account.id
      );
    if (account.role === "director")
      return record.projectDirectorId === account.id;
    return account.role === "finance";
  });
}
function travelAllowanceNeedsAttention(
  record: TravelAllowanceRecord,
  account: BetaAccount,
) {
  if (account.role === "staff") return record.status === "RETURNED_TO_STAFF";
  if (account.role === "manager")
    return (
      record.status === "PENDING_MANAGER_REVIEW" &&
      record.managerApproverId === account.id
    );
  if (account.role === "director")
    return (
      record.status === "PENDING_DIRECTOR_APPROVAL" &&
      record.projectDirectorId === account.id
    );
  return (
    account.role === "finance" &&
    record.status === "PENDING_FINANCE_VERIFICATION"
  );
}
function visibleCashAdvancesFor(
  records: CashAdvanceRecord[],
  account: BetaAccount,
) {
  return records.filter((record) => {
    if (record.requesterId === account.id) return true;
    if (account.role === "staff") return record.requesterId === account.id;
    if (account.role === "manager")
      return record.managerApproverId === account.id;
    if (account.role === "director")
      return record.directorApproverId === account.id;
    return account.role === "finance";
  });
}
function cashAdvanceNeedsAttention(
  record: CashAdvanceRecord,
  account: BetaAccount,
) {
  if (
    record.requesterId === account.id &&
    (record.status === "PENDING_RECONCILIATION" ||
      (record.status === "RETURNED_TO_STAFF" &&
        record.returnedStage === "RECONCILIATION"))
  )
    return true;
  if (account.role === "staff")
    return (
      record.status === "RETURNED_TO_STAFF" ||
      record.status === "PENDING_RECONCILIATION"
    );
  if (account.role === "manager")
    return record.status === "PENDING_MANAGER_APPROVAL";
  if (account.role === "director")
    return record.status === "PENDING_DIRECTOR_APPROVAL";
  return (
    account.role === "finance" &&
    (record.status === "PENDING_FINANCE_PROCESSING" ||
      record.status === "PENDING_FINANCE_RECONCILIATION")
  );
}
function claimNeedsAttention(record: ClaimRecord, account: BetaAccount) {
  if (
    record.requesterId === account.id &&
    ["DRAFT", "RETURNED_TO_CLAIMANT"].includes(record.status)
  )
    return true;
  if (account.role === "director")
    return (
      record.status === "PENDING_DIRECTOR_APPROVAL" &&
      record.directorApproverId === account.id
    );
  return (
    account.role === "finance" &&
    record.status === "PENDING_FINANCE_VERIFICATION"
  );
}

function pettyCashNeedsAttention(
  record: PettyCashRecord,
  account: BetaAccount,
) {
  if (
    record.requesterId === account.id &&
    ["RETURNED_TO_STAFF", "PENDING_RECONCILIATION"].includes(record.status)
  )
    return true;
  if (account.role === "manager")
    return (
      record.status === "PENDING_MANAGER_APPROVAL" &&
      record.managerApproverId === account.id
    );
  if (account.role === "director")
    return (
      record.status === "PENDING_DIRECTOR_APPROVAL" &&
      record.directorApproverId === account.id
    );
  if (account.role === "finance")
    return (
      (record.status === "PENDING_FINANCE_REVIEW" &&
        record.financeReviewerId === account.id) ||
      [
        "PENDING_FINANCE_PAYMENT",
        "FINANCE_VERIFIED",
        "PENDING_FINANCE_RECONCILIATION",
      ].includes(record.status)
    );
  return false;
}

export default function PaymentRecordsPage() {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const personalOnly = searchParameters.get("scope") === "mine";
  const { records: paymentVouchers, isLoading: paymentVouchersLoading } =
    usePaymentVouchers();
  const [account] = useState<BetaAccount | null>(() => readBetaSession());
  const [invoicePayments, setInvoicePayments] = useState<
    InvoicePaymentRequestRecord[]
  >([]);
  const [travelAllowances, setTravelAllowances] = useState<
    TravelAllowanceRecord[]
  >([]);
  const [cashAdvances, setCashAdvances] = useState<CashAdvanceRecord[]>([]);
  const [pettyCashRequests, setPettyCashRequests] = useState<PettyCashRecord[]>(
    [],
  );
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [manualDrafts, setManualDrafts] = useState<ManualFormDraft[]>([]);
  const [sessionChecked, setSessionChecked] = useState(() => !account);
  const [categoryLoading, setCategoryLoading] = useState({
    invoice: true,
    travel: true,
    cashAdvance: true,
    pettyCash: true,
    claim: true,
    drafts: true,
  });

  useEffect(() => {
    if (!account) {
      router.replace("/beta");
      return;
    }

    let active = true;
    let settled = 0;
    function load<T>(
      key: keyof typeof categoryLoading,
      request: Promise<T[]>,
      apply: (items: T[]) => void,
    ) {
      request
        .then((items) => {
          if (active) apply(items);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!active) return;
          settled += 1;
          setCategoryLoading((current) => ({ ...current, [key]: false }));
          if (settled === 1) setSessionChecked(true);
        });
    }

    load(
      "invoice",
      fetchInvoicePayments({
        role: account.role,
        userId: account.id,
        includeAll: true,
      }),
      setInvoicePayments,
    );
    load(
      "travel",
      fetchTravelAllowances({
        role: account.role,
        userId: account.id,
        includeAll: true,
      }),
      setTravelAllowances,
    );
    load(
      "cashAdvance",
      fetchCashAdvances({
        role: account.role,
        userId: account.id,
        includeAll: true,
      }),
      setCashAdvances,
    );
    load(
      "pettyCash",
      fetchPettyCashRequests({
        role: account.role,
        userId: account.id,
        includeAll: personalOnly,
      }),
      setPettyCashRequests,
    );
    load(
      "claim",
      fetchClaimRequests({ role: account.role, userId: account.id }),
      setClaims,
    );
    load(
      "drafts",
      fetchManualFormDrafts("beta-arus-org", account.id),
      setManualDrafts,
    );
    return () => {
      active = false;
    };
  }, [account, personalOnly, router]);

  const visibleVouchers = useMemo(
    () =>
      account
        ? personalOnly
          ? paymentVouchers.filter(
              (record) => record.submitterId === account.id,
            )
          : visibleVouchersFor(paymentVouchers, account)
        : [],
    [account, paymentVouchers, personalOnly],
  );
  const visibleInvoices = useMemo(
    () =>
      account
        ? personalOnly
          ? invoicePayments.filter((record) => record.staffId === account.id)
          : visibleInvoicesFor(invoicePayments, account)
        : [],
    [account, invoicePayments, personalOnly],
  );
  const visibleTravelAllowances = useMemo(
    () =>
      account
        ? personalOnly
          ? travelAllowances.filter(
              (record) => record.requesterId === account.id,
            )
          : visibleTravelAllowancesFor(travelAllowances, account)
        : [],
    [account, personalOnly, travelAllowances],
  );
  const visibleCashAdvances = useMemo(
    () =>
      account
        ? personalOnly
          ? cashAdvances.filter((record) => record.requesterId === account.id)
          : visibleCashAdvancesFor(cashAdvances, account)
        : [],
    [account, cashAdvances, personalOnly],
  );
  const visiblePettyCash = useMemo(
    () =>
      account
        ? personalOnly
          ? pettyCashRequests.filter(
              (record) => record.requesterId === account.id,
            )
          : pettyCashRequests
        : [],
    [account, personalOnly, pettyCashRequests],
  );
  const visibleClaims = useMemo(
    () =>
      account
        ? personalOnly
          ? claims.filter((record) => record.requesterId === account.id)
          : claims
        : [],
    [account, claims, personalOnly],
  );
  const voucherAttention = useMemo(
    () =>
      account
        ? visibleVouchers.filter((record) =>
            voucherNeedsAttention(record, account),
          ).length
        : 0,
    [account, visibleVouchers],
  );
  const invoiceAttention = useMemo(
    () =>
      account
        ? visibleInvoices.filter((record) =>
            invoiceNeedsAttention(record, account),
          ).length
        : 0,
    [account, visibleInvoices],
  );
  const travelAllowanceAttention = useMemo(
    () =>
      account
        ? visibleTravelAllowances.filter((record) =>
            travelAllowanceNeedsAttention(record, account),
          ).length
        : 0,
    [account, visibleTravelAllowances],
  );
  const cashAdvanceAttention = useMemo(
    () =>
      account
        ? visibleCashAdvances.filter((record) =>
            cashAdvanceNeedsAttention(record, account),
          ).length
        : 0,
    [account, visibleCashAdvances],
  );
  const pettyCashAttention = useMemo(
    () =>
      account
        ? visiblePettyCash.filter((record) =>
            pettyCashNeedsAttention(record, account),
          ).length
        : 0,
    [account, visiblePettyCash],
  );
  const claimAttention = useMemo(
    () =>
      account
        ? visibleClaims.filter((record) => claimNeedsAttention(record, account))
            .length
        : 0,
    [account, visibleClaims],
  );
  const manualDraftCount = manualDrafts.length;
  const manualDraftCountFor = (paymentType: ManualDraftType) =>
    manualDrafts.filter((draft) => draft.paymentType === paymentType).length;

  if (!sessionChecked)
    return (
      <section className={styles.paymentRecordsState}>
        <h1>Loading payment records</h1>
        <p>The first available payment category will appear immediately.</p>
      </section>
    );
  if (!account) return null;

  return (
    <div className={styles.paymentRecordsPage}>
      <header className={styles.paymentRecordsHeader}>
        <div>
          <p className={styles.pageEyebrow}>
            {personalOnly ? "My Requests" : "Payment Records"}
          </p>
          <h1>
            {personalOnly
              ? "Track the requests you created"
              : "Track every type of payment"}
          </h1>
          <p>
            {personalOnly
              ? "Select a payment type to view only the requests that you submitted."
              : "Select a payment type to view its records, current statuses and actions that require your attention."}
          </p>
        </div>
        <div className={styles.signedInSummary}>
          <span>Viewing records for</span>
          <strong>{account.name}</strong>
          <small>{account.position}</small>
        </div>
      </header>
      <section className={styles.recordsSummary}>
        <article>
          <span>Payment types</span>
          <strong>6</strong>
        </article>
        <article>
          <span>{personalOnly ? "Saved drafts" : "Available in beta"}</span>
          <strong>{personalOnly ? manualDraftCount : 6}</strong>
        </article>
        <article>
          <span>{personalOnly ? "My records" : "Visible records"}</span>
          <strong>
            {visibleVouchers.length +
              visibleInvoices.length +
              visibleTravelAllowances.length +
              visibleCashAdvances.length +
              visiblePettyCash.length +
              visibleClaims.length +
              (personalOnly ? manualDraftCount : 0)}
          </strong>
        </article>
        <article>
          <span>Require attention</span>
          <strong>
            {voucherAttention +
              invoiceAttention +
              travelAllowanceAttention +
              cashAdvanceAttention +
              pettyCashAttention +
              claimAttention +
              (personalOnly ? manualDraftCount : 0)}
          </strong>
        </article>
      </section>
      <section className={styles.paymentTypesSection}>
        <div className={styles.sectionHeading}>
          <div>
            <h2>Payment types</h2>
            <p>
              Each payment type has its own records, requirements and workflow.
            </p>
          </div>
        </div>
        <div className={styles.paymentTypesGrid}>
          <PaymentTypeCard
            title="Payment Voucher"
            description="Track vouchers from requester submission through Director approval, Finance processing and completion."
            shortCode="PV"
            totalRecords={
              visibleVouchers.length +
              (personalOnly ? manualDraftCountFor("PAYMENT_VOUCHER") : 0)
            }
            attentionCount={
              voucherAttention +
              (personalOnly ? manualDraftCountFor("PAYMENT_VOUCHER") : 0)
            }
            isLoading={paymentVouchersLoading || categoryLoading.drafts}
            href={
              personalOnly
                ? "/beta/payment-vouchers?scope=mine"
                : "/beta/payment-vouchers"
            }
            available
          />
          <PaymentTypeCard
            title="Invoice Payment"
            description="Track invoice requests through Manager review, Director approval, Finance verification and completion."
            shortCode="INV"
            totalRecords={
              visibleInvoices.length +
              (personalOnly ? manualDraftCountFor("INVOICE_PAYMENT") : 0)
            }
            attentionCount={
              invoiceAttention +
              (personalOnly ? manualDraftCountFor("INVOICE_PAYMENT") : 0)
            }
            isLoading={categoryLoading.invoice || categoryLoading.drafts}
            href={
              personalOnly
                ? "/beta/payment-records/invoice-payments?scope=mine"
                : "/beta/payment-records/invoice-payments"
            }
            available
          />
          <PaymentTypeCard
            title="Claim"
            description="Track Claim Drafts, review stages, supporting receipts and Finance payment."
            shortCode="CL"
            totalRecords={visibleClaims.length}
            attentionCount={claimAttention}
            isLoading={categoryLoading.claim}
            href={
              personalOnly
                ? "/beta/payment-records/claims?scope=mine"
                : "/beta/payment-records/claims"
            }
            available
          />
          <PaymentTypeCard
            title="Cash Advance"
            description="Track advance requests, Manager review, Director approval, payment and reconciliation."
            shortCode="CA"
            totalRecords={
              visibleCashAdvances.length +
              (personalOnly ? manualDraftCountFor("CASH_ADVANCE") : 0)
            }
            attentionCount={
              cashAdvanceAttention +
              (personalOnly ? manualDraftCountFor("CASH_ADVANCE") : 0)
            }
            isLoading={categoryLoading.cashAdvance || categoryLoading.drafts}
            href={
              personalOnly
                ? "/beta/payment-records/cash-advances?scope=mine"
                : "/beta/payment-records/cash-advances"
            }
            available
          />
          <PaymentTypeCard
            title="Travel Allowance"
            description="Track travel allowance requests through Manager, Director and Finance processing."
            shortCode="TA"
            totalRecords={
              visibleTravelAllowances.length +
              (personalOnly ? manualDraftCountFor("TRAVEL_ALLOWANCE") : 0)
            }
            attentionCount={
              travelAllowanceAttention +
              (personalOnly ? manualDraftCountFor("TRAVEL_ALLOWANCE") : 0)
            }
            isLoading={categoryLoading.travel || categoryLoading.drafts}
            href={
              personalOnly
                ? "/beta/payment-records/travel-allowances?scope=mine"
                : "/beta/payment-records/travel-allowances"
            }
            available
          />
          <PaymentTypeCard
            title="Petty Cash"
            description="Track approval, Finance payment, requester reconciliation and final verification."
            shortCode="PC"
            totalRecords={
              visiblePettyCash.length +
              (personalOnly ? manualDraftCountFor("PETTY_CASH") : 0)
            }
            attentionCount={
              pettyCashAttention +
              (personalOnly ? manualDraftCountFor("PETTY_CASH") : 0)
            }
            isLoading={categoryLoading.pettyCash || categoryLoading.drafts}
            href={
              personalOnly
                ? "/beta/payment-records/petty-cash?scope=mine"
                : "/beta/payment-records/petty-cash"
            }
            available
          />
        </div>
      </section>
    </div>
  );
}

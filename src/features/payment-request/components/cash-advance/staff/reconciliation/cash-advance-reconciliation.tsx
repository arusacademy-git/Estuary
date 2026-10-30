"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  saveCashAdvanceReconciliationDraft,
  submitCashAdvanceReconciliation,
} from "@/data/payment-requests/cash-advance/cash-advance-api";
import {
  cashAdvanceBalance,
  cashAdvanceExpenseTotal,
  cashAdvanceOutcome,
} from "@/domain/payment-requests/cash-advance/policy";
import type {
  CashAdvanceDocument,
  CashAdvanceExpense,
  CashAdvanceRecord,
} from "@/domain/payment-requests/cash-advance/types";
import { notifyCashAdvanceReconciliationSubmitted } from "@/features/payment-request/notifications/cash-advance-notifications";
import { readBetaSession } from "@/lib/auth/beta-accounts";

import { BalanceReturnProof } from "./balance-return-proof";
import { CashSpentSummary } from "./cash-spent-summary";
import { CashSpentGoogleSheet } from "./cash-spent-google-sheet";
import { ParticipantAllowance } from "./participant-allowance";
import { ReconciliationReview } from "./reconciliation-review";
import styles from "../../cash-advance.module.css";

const newExpense = (): CashAdvanceExpense => ({
  id: crypto.randomUUID(),
  expenseDate: "",
  supplier: "",
  description: "",
  accountType: "",
  amount: 0,
});

export function CashAdvanceReconciliation({
  record,
}: {
  record: CashAdvanceRecord;
}) {
  const router = useRouter();
  const previous = record.reconciliation;
  const [stage, setStage] = useState<"EDIT" | "REVIEW">("EDIT");
  const [expenses, setExpenses] = useState<CashAdvanceExpense[]>(
    previous?.expenses ?? [newExpense()],
  );
  const [includesParticipants, setIncludesParticipants] = useState(
    previous?.includesParticipantAllowance ?? false,
  );
  const [participantProof] = useState<CashAdvanceDocument | undefined>(
    previous?.participantProof,
  );
  const [participantProofLink, setParticipantProofLink] = useState(
    previous?.participantProofLink ?? "",
  );
  const [returnDate, setReturnDate] = useState(
    previous?.balanceReturnDate ?? "",
  );
  const [returnReference, setReturnReference] = useState(
    previous?.balanceReturnReference ?? "",
  );
  const [balanceProof, setBalanceProof] = useState<
    CashAdvanceDocument | undefined
  >(previous?.balanceReturnProof);
  const [remarks, setRemarks] = useState(previous?.remarks ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");

  const totalSpent = useMemo(
    () => cashAdvanceExpenseTotal(expenses),
    [expenses],
  );
  const balance = cashAdvanceBalance(record.totalAmount, totalSpent);
  const outcome = cashAdvanceOutcome(balance);

  function reconciliationInput(requesterId: string) {
    return {
      requesterId,
      expenses,
      includesParticipantAllowance: includesParticipants,
      participants: [],
      participantProof: includesParticipants ? participantProof : undefined,
      participantProofLink: includesParticipants
        ? participantProofLink.trim() || undefined
        : undefined,
      balanceReturnDate: outcome === "UNDERSPEND" ? returnDate : undefined,
      balanceReturnReference:
        outcome === "UNDERSPEND" ? returnReference : undefined,
      balanceReturnProof: outcome === "UNDERSPEND" ? balanceProof : undefined,
      remarks: remarks.trim() || undefined,
    };
  }

  async function saveDraft() {
    const account = readBetaSession();
    if (!account || account.id !== record.requesterId) {
      setError("Only the original requester can save this reconciliation draft.");
      return;
    }
    setSaving(true);
    setError("");
    setDraftMessage("");
    try {
      await saveCashAdvanceReconciliationDraft(
        record.id,
        reconciliationInput(account.id),
      );
      setDraftMessage("Reconciliation draft saved.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The reconciliation draft could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  function validate() {
    if (
      !expenses.length ||
      expenses.some(
        (expense) =>
          !expense.expenseDate ||
          !expense.supplier?.trim() ||
          !expense.description.trim() ||
          !expense.accountType?.trim() ||
          expense.amount <= 0,
      )
    ) {
      return "Complete the date, supplier, description, type of account and amount for every Cash Spent Summary row.";
    }
    if (
      includesParticipants &&
      !participantProof &&
      !participantProofLink.trim()
    ) {
      return "Paste the Participant Allowance Google Sheet link.";
    }
    if (includesParticipants && participantProofLink.trim()) {
      try {
        const url = new URL(participantProofLink.trim());
        if (url.protocol !== "https:" || url.hostname !== "docs.google.com")
          return "Use a valid Google Sheets link for Participant Allowance.";
      } catch {
        return "Use a valid Google Sheets link for Participant Allowance.";
      }
    }
    if (
      outcome === "UNDERSPEND" &&
      (!returnDate || !returnReference.trim() || !balanceProof)
    ) {
      return "Complete the balance return date, bank reference and payment proof.";
    }
    return null;
  }

  function review() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setStage("REVIEW");
  }

  async function submit() {
    const account = readBetaSession();
    if (!account || account.id !== record.requesterId) {
      setError("Only the original requester can reconcile this Cash Advance.");
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setStage("EDIT");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await submitCashAdvanceReconciliation(record.id, {
        ...reconciliationInput(account.id),
      });
      notifyCashAdvanceReconciliationSubmitted(updated, account);
      router.refresh();
      window.location.reload();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Reconciliation could not be submitted.",
      );
      setSaving(false);
    }
  }

  if (stage === "REVIEW") {
    return (
      <div className={styles.page}>
        {error && <div className={styles.error}>{error}</div>}
        <ReconciliationReview
          advance={record.totalAmount}
          balance={balance}
          balanceReturnDate={returnDate}
          balanceReturnProof={balanceProof}
          balanceReturnReference={returnReference}
          expenses={expenses}
          includesParticipants={includesParticipants}
          onBack={() => setStage("EDIT")}
          onSubmit={submit}
          outcome={outcome}
          participantProof={participantProof}
          participantProofLink={participantProofLink}
          remarks={remarks}
          requestNumber={record.requestNumber}
          saving={saving}
          totalSpent={totalSpent}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Cash Advance · Reconciliation</p>
          <h1>Reconcile {record.requestNumber}</h1>
          <p className={styles.muted}>
            Complete Appendix A, the optional Participant Allowance, and balance
            proof where required.
          </p>
        </div>
      </header>
      {record.returnedStage === "RECONCILIATION" && record.returnRemarks && (
        <div className={styles.returnNotice}>
          <strong>Finance requested corrections</strong>
          <p>{record.returnRemarks}</p>
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}
      {draftMessage && <div className={styles.draftMessage}>{draftMessage}</div>}
      <div className={styles.formReceipt}>
        <CashSpentSummary
          expenses={expenses}
          onChange={setExpenses}
          totalSpent={totalSpent}
        />
        <div
          className={styles.reconciliationOr}
          role="separator"
          aria-label="Or use Google Sheets"
        >
          <span>OR</span>
        </div>
        <CashSpentGoogleSheet
          onApply={(retrieved) => {
            setExpenses(retrieved);
            setError("");
          }}
        />
        <ParticipantAllowance
          enabled={includesParticipants}
          onEnabledChange={setIncludesParticipants}
          onSheetLinkChange={setParticipantProofLink}
          sheetLink={participantProofLink}
        />
        <BalanceReturnProof
          advance={record.totalAmount}
          balance={balance}
          onError={setError}
          onProofChange={setBalanceProof}
          onReturnDateChange={setReturnDate}
          onReturnReferenceChange={setReturnReference}
          outcome={outcome}
          proof={balanceProof}
          returnDate={returnDate}
          returnReference={returnReference}
          totalSpent={totalSpent}
        />
        <section className={styles.receiptSection}>
          <div className={styles.field}>
            <label>Additional reconciliation remarks</label>
            <textarea
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Add any information Finance should know"
              value={remarks}
            />
          </div>
          <div className={styles.footerActions}>
            <span>Review all entries before submitting.</span>
            <div className={styles.reconciliationFooterButtons}>
              <button
                className={styles.reconciliationDraftButton}
                disabled={saving}
                onClick={saveDraft}
                type="button"
              >
                {saving ? "Saving draft…" : "Save as draft"}
              </button>
              <button className={styles.primary} disabled={saving} onClick={review} type="button">
                Review reconciliation →
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

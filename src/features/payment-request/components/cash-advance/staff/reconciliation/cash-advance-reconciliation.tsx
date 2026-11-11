"use client";
import { createRuntimeId } from '@/lib/ids/runtime-id';

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
import { CashSpentGoogleSheet } from "./cash-spent-google-sheet";
import { CashSpentSummary } from "./cash-spent-summary";
import { ParticipantAllowance } from "./participant-allowance";
import { ReconciliationReview } from "./reconciliation-review";
import styles from "../../cash-advance.module.css";

const createNewExpense = (): CashAdvanceExpense => ({
  id: createRuntimeId(),
  expenseDate: "",
  supplier: "",
  description: "",
  accountType: "",
  amount: 0,
});

type EntryMode = "MANUAL" | "SHEET";
type PageStage = "EDIT" | "REVIEW";

interface CashAdvanceReconciliationProps {
  record: CashAdvanceRecord;
}

export function CashAdvanceReconciliation({ record }: CashAdvanceReconciliationProps) {
  const router = useRouter();
  const previous = record.reconciliation;

  // UI State
  const [stage, setStage] = useState<PageStage>("EDIT");
  const [entryMode, setEntryMode] = useState<EntryMode>("MANUAL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  // Form State
  const [expenses, setExpenses] = useState<CashAdvanceExpense[]>(
    previous?.expenses ?? [createNewExpense()]
  );
  const [includesParticipants, setIncludesParticipants] = useState(
    previous?.includesParticipantAllowance ?? false
  );
  const [participantProof] = useState<CashAdvanceDocument | undefined>(
    previous?.participantProof
  );
  const [participantProofLink, setParticipantProofLink] = useState(
    previous?.participantProofLink ?? ""
  );
  const [returnDate, setReturnDate] = useState(
    previous?.balanceReturnDate ?? ""
  );
  const [returnReference, setReturnReference] = useState(
    previous?.balanceReturnReference ?? ""
  );
  const [balanceProof, setBalanceProof] = useState<CashAdvanceDocument | undefined>(
    previous?.balanceReturnProof
  );
  const [remarks, setRemarks] = useState(previous?.remarks ?? "");

  // Derived Calculations
  const totalSpent = useMemo(
    () => cashAdvanceExpenseTotal(expenses),
    [expenses]
  );
  const balance = cashAdvanceBalance(record.totalAmount, totalSpent);
  const outcome = cashAdvanceOutcome(balance);

  const areExpensesValid = useMemo(() => {
    return (
      expenses.length > 0 &&
      expenses.every(
        (expense) => Boolean(expense.receipt || expense.receiptLink?.trim())
      )
    );
  }, [expenses]);

  const createReconciliationPayload = (requesterId: string) => ({
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
  });

  const validateForm = (): string | null => {
    const isExpensesIncomplete =
      !expenses.length ||
      expenses.some(
        (expense) =>
          !expense.expenseDate ||
          !expense.supplier?.trim() ||
          !expense.description.trim() ||
          !expense.accountType?.trim() ||
          expense.amount <= 0 ||
          (!expense.receipt && !expense.receiptLink?.trim())
      );

    if (isExpensesIncomplete) {
      return "Complete every expense and upload its receipt or proof before review.";
    }

    if (includesParticipants) {
      const trimmedLink = participantProofLink.trim();
      if (!participantProof && !trimmedLink) {
        return "Paste the Participant Allowance Google Sheet link.";
      }
      if (trimmedLink) {
        try {
          const url = new URL(trimmedLink);
          if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
            return "Use a valid Google Sheets link for Participant Allowance.";
          }
        } catch {
          return "Use a valid Google Sheets link for Participant Allowance.";
        }
      }
    }

    if (
      outcome === "UNDERSPEND" &&
      (!returnDate || !returnReference.trim() || !balanceProof)
    ) {
      return "Complete the balance return date, bank reference and payment proof.";
    }

    return null;
  };

  const handleSaveDraft = async () => {
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
        createReconciliationPayload(account.id)
      );
      setDraftMessage("Reconciliation draft saved.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The reconciliation draft could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReview = () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setStage("REVIEW");
  };

  const handleSubmit = async () => {
    const account = readBetaSession();
    if (!account || account.id !== record.requesterId) {
      setError("Only the original requester can reconcile this Cash Advance.");
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setStage("EDIT");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const updated = await submitCashAdvanceReconciliation(
        record.id,
        createReconciliationPayload(account.id)
      );
      notifyCashAdvanceReconciliationSubmitted(updated, account);
      router.refresh();
      window.location.reload();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Reconciliation could not be submitted."
      );
      setSaving(false);
    }
  };

  const handleApplyGoogleSheetExpenses = (retrievedExpenses: CashAdvanceExpense[]) => {
    setExpenses(retrievedExpenses);
    setError("");
    setEntryMode("MANUAL");
  };

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
          onSubmit={handleSubmit}
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
      <header className={styles.reconciliationPrototypeHeader}>
        <div>
          <p>
            <span>CA</span> Cash Advance · Reconciliation
          </p>
          <h1>Reconcile {record.requestNumber}</h1>
          <small>
            Complete Appendix A, the optional Participant Allowance, and balance
            proof where required.
          </small>
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

      <div className={styles.reconciliationWorkspace}>
        <main className={`${styles.formReceipt} ${styles.reconciliationMain}`}>
          <section className={styles.reconciliationEntrySection}>
            <div
              aria-label="Cash spent entry method"
              className={styles.reconciliationModeTabs}
              role="tablist"
            >
              <button
                aria-selected={entryMode === "MANUAL"}
                onClick={() => setEntryMode("MANUAL")}
                role="tab"
                type="button"
              >
                Enter expenses
              </button>
              <button
                aria-selected={entryMode === "SHEET"}
                onClick={() => setEntryMode("SHEET")}
                role="tab"
                type="button"
              >
                Retrieve from Appendix A
              </button>
            </div>

            {entryMode === "MANUAL" ? (
              <CashSpentSummary
                expenses={expenses}
                onChange={setExpenses}
                onError={setError}
                totalSpent={totalSpent}
              />
            ) : (
              <CashSpentGoogleSheet onApply={handleApplyGoogleSheetExpenses} />
            )}
          </section>

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
              <label>
                Additional reconciliation remarks <small>(optional)</small>
              </label>
              <textarea
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Add any information Finance should know"
                value={remarks}
              />
            </div>
          </section>
        </main>

        <aside className={styles.reconciliationSummaryRail}>
          <p>Reconciliation summary</p>
          <dl>
            <div>
              <dt>Advance received</dt>
              <dd>RM {record.totalAmount.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Total spent</dt>
              <dd>RM {totalSpent.toFixed(2)}</dd>
            </div>
          </dl>

          <div className={styles.reconciliationBalance}>
            <span>
              {outcome === "OVERSPEND" ? "Amount overspent" : "Balance to return"}
            </span>
            <strong>RM {Math.abs(balance).toFixed(2)}</strong>
          </div>

          <div className={styles.reconciliationChecklist}>
            <p>Checklist</p>
            <div>
              <i data-state={expenses.length > 0 && totalSpent > 0 ? "done" : "pending"} />
              Expenses <span>{expenses.length} added</span>
            </div>
            <div>
              <i data-state={areExpensesValid ? "done" : "pending"} />
              Receipts <span>{areExpensesValid ? "Added" : "Missing"}</span>
            </div>
            <div>
              <i data-state={includesParticipants ? "done" : "optional"} />
              Participant allowance{" "}
              <span>{includesParticipants ? "Included" : "Optional"}</span>
            </div>
            <div>
              <i
                data-state={
                  outcome !== "UNDERSPEND" || Boolean(balanceProof)
                    ? "done"
                    : "pending"
                }
              />
              Balance proof{" "}
              <span>
                {outcome === "UNDERSPEND"
                  ? balanceProof
                    ? "Added"
                    : "Required"
                  : "Not required"}
              </span>
            </div>
          </div>

          <button
            className={styles.primary}
            disabled={saving}
            onClick={handleReview}
            type="button"
          >
            Review reconciliation
          </button>

          <button
            className={styles.reconciliationDraftButton}
            disabled={saving}
            onClick={handleSaveDraft}
            type="button"
          >
            {saving ? "Saving draft…" : "Save as draft"}
          </button>

          <small>Review all entries before submitting.</small>
        </aside>
      </div>
    </div>
  );
}
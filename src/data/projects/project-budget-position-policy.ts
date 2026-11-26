export type ProjectBudgetBucket = "SPENT" | "COMMITTED" | "EXCLUDED";

export type ProjectBudgetSubmissionState = {
    paymentType: string;
    stateCode: string;
    stateGroup: string;
    transitionActions?: string[];
    cashAdvancePaidAt?: Date | null;
    cashAdvanceReconciledAt?: Date | null;
    cashAdvanceReconciliationOutcome?: string | null;
};

const excludedGroups = new Set(["DRAFT", "REJECTED", "VOIDED"]);
const excludedStates = [
    "DRAFT",
    "REJECTED",
    "CANCELLED",
    "CANCELED",
    "INACTIVE",
    "VOIDED",
    "RETURNED_TO_STAFF",
    "RETURNED_TO_CLAIMANT",
];
const spentStates = new Set([
    "COMPLETED",
    "COMPLETE",
    "CLOSED",
    "PAID",
    "PAYMENT_PROCESSED",
    "TRANSACTION_PROOF_UPLOADED",
    "RECONCILED",
]);
const committedStates = new Set([
    "APPROVED_FOR_PAYMENT",
    "PENDING_FINANCE_PAYMENT",
    "PENDING_FINANCE_PROCESSING",
    "PENDING_FINANCE_REVIEW",
    "PENDING_FINANCE_VERIFICATION",
    "AWAITING_RECIPIENT_SIGNATURE",
]);

function isExcludedState(stateCode: string) {
    return excludedStates.some(
        (state) => stateCode === state || stateCode.startsWith(`${state}_`),
    );
}

export function classifyProjectBudgetSubmission(
    submission: ProjectBudgetSubmissionState,
): ProjectBudgetBucket {
    if (submission.paymentType === "PETTY_CASH_TOPUP") return "EXCLUDED";

    const actions = new Set(submission.transitionActions ?? []);
    if (submission.paymentType === "CASH_ADVANCE") {
        if (
            submission.cashAdvanceReconciledAt ||
            submission.cashAdvanceReconciliationOutcome ||
            submission.stateCode === "COMPLETED" ||
            submission.stateCode === "RECONCILED"
        ) {
            return "SPENT";
        }
        if (
            submission.cashAdvancePaidAt ||
            actions.has("PAYMENT_PROCESSED") ||
            spentStates.has(submission.stateCode) ||
            submission.stateCode.includes("RECONCILIATION")
        ) {
            return "COMMITTED";
        }
        return "EXCLUDED";
    }

    if (
        excludedGroups.has(submission.stateGroup) ||
        isExcludedState(submission.stateCode)
    ) {
        return "EXCLUDED";
    }
    if (
        submission.stateGroup === "COMPLETE" ||
        actions.has("PAYMENT_PROCESSED") ||
        spentStates.has(submission.stateCode)
    ) {
        return "SPENT";
    }
    if (committedStates.has(submission.stateCode)) return "COMMITTED";
    return "EXCLUDED";
}

import type {
  CashAdvanceExpense,
  CashAdvanceParticipant,
  CashAdvanceRequestLine,
  CashAdvanceStatus,
} from './types';

export const CASH_ADVANCE_RECONCILIATION_DAYS = 14;

export function cashAdvanceInitialWorkflow(directorApproverId: string) {
  return {
    state: 'PENDING_DIRECTOR_APPROVAL' as const,
    assigneeId: directorApproverId,
  };
}

export function cashAdvanceVisibleStatus(state: string): CashAdvanceStatus {
  return (state === 'PENDING_MANAGER_APPROVAL' ? 'PENDING_DIRECTOR_APPROVAL' : state) as CashAdvanceStatus;
}

export function cashAdvanceRequestedTotal(lines: CashAdvanceRequestLine[]) {
  return lines.reduce((total, line) => total + Number(line.amount || 0), 0);
}

export function cashAdvanceExpenseTotal(expenses: CashAdvanceExpense[]) {
  return expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
}

export function cashAdvanceParticipantTotal(participants: CashAdvanceParticipant[]) {
  return participants.reduce((total, participant) => total + Number(participant.amount || 0), 0);
}

export function cashAdvanceBalance(advanceAmount: number, totalSpent: number) {
  return Number((advanceAmount - totalSpent).toFixed(2));
}

export function cashAdvanceOutcome(balance: number) {
  if (balance > 0) return 'UNDERSPEND' as const;
  if (balance < 0) return 'OVERSPEND' as const;
  return 'EXACT' as const;
}

export function addCalendarDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function validateCashAdvanceRequest(lines: CashAdvanceRequestLine[]) {
  if (!lines.length) return 'Add at least one requested expense.';
  if (lines.some((line) => !Number.isFinite(line.amount) || line.amount < 0)) return 'Every requested amount must be valid.';
  if (cashAdvanceRequestedTotal(lines) <= 0) return 'The Cash Advance total must be greater than RM 0.00.';
  return null;
}

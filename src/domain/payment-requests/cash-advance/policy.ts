import type {
  CashAdvanceExpense,
  CashAdvanceParticipant,
  CashAdvanceRequestLine,
} from './types';

export const CASH_ADVANCE_MINIMUM = 300;
export const CASH_ADVANCE_RECONCILIATION_DAYS = 14;

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
  if (lines.some((line) => !line.description.trim() || !line.purpose.trim() || line.amount <= 0)) {
    return 'Complete the description, purpose and amount for every expense.';
  }
  if (cashAdvanceRequestedTotal(lines) < CASH_ADVANCE_MINIMUM) {
    return `Cash Advance requests must be at least RM ${CASH_ADVANCE_MINIMUM.toFixed(2)}.`;
  }
  return null;
}

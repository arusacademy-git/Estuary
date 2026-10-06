import type {
  CreatePettyCashInput,
  PettyCashRequestLine,
} from './types';

export const PETTY_CASH_MONTHLY_ALLOCATION = 500;
export const PETTY_CASH_REQUEST_LIMIT = 300;

export function pettyCashTotal(lines: PettyCashRequestLine[]) {
  return lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
}

export function validatePettyCashInput(input: CreatePettyCashInput) {
  if (!input.requestDate || !input.requesterContact.trim()) {
    return 'Complete the request date and contact number.';
  }
  if (!input.location) return 'Select the Petty Cash location.';
  if (input.requesterRole === 'staff' && (!input.managerApproverId || !input.directorApproverId)) {
    return 'Select the Manager reviewer and Director previewer.';
  }
  if (input.requesterRole === 'manager' && !input.directorApproverId) {
    return 'Select the Director previewer.';
  }
  if (input.requesterRole === 'finance') {
    if (!input.financeReviewerId || !input.financeReviewerRole) {
      return 'Select another authorized Finance user or a Director to review this request.';
    }
    if (input.financeReviewerId === input.requesterId) {
      return 'A Finance requester cannot review their own Petty Cash request.';
    }
  }
  if (!input.lines.length) return 'Add at least one expense.';

  const incomplete = input.lines.some((line) =>
    !line.expenseDate ||
    !line.supplier.trim() ||
    !line.details.trim() ||
    !line.proofLink.trim() ||
    !line.accountType.trim() ||
    !line.division.trim() ||
    !Number.isFinite(Number(line.amount)) ||
    Number(line.amount) <= 0,
  );
  if (incomplete) return 'Complete every expense row, receipt/invoice link and positive amount.';

  const total = pettyCashTotal(input.lines);
  if (total <= 0) return 'The request total must be greater than RM0.00.';
  if (total >= PETTY_CASH_REQUEST_LIMIT) {
    return 'Petty Cash requests must be below RM300.00.';
  }
  return '';
}
export type DashboardSummaryPaymentType =
  | 'PAYMENT_VOUCHER'
  | 'INVOICE_PAYMENT'
  | 'TRAVEL_ALLOWANCE'
  | 'CASH_ADVANCE'
  | 'PETTY_CASH'
  | 'EXPENSE_CLAIM';

export type DashboardSummaryRecord = {
  id: string;
  reference: string;
  paymentType: DashboardSummaryPaymentType;
  requesterId: string;
  requesterName: string;
  status: string;
  amount: number;
  updatedAt: string;
  currentAssigneeId?: string;
  approverIds: string[];
  managerViewed: boolean;
  claimManagerPreviewed: boolean;
  claimDirectorPreviewed: boolean;
  recipientLinkIssued: boolean;
};

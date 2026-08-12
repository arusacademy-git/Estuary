export type PaymentRequestType =
  | 'INVOICE_PAYMENT'
  | 'EXPENSE_CLAIM'
  | 'TRAVEL_ALLOWANCE'
  | 'CASH_ADVANCE';

export type PaymentRequestRole =
  | 'STAFF'
  | 'MANAGER'
  | 'DIRECTOR'
  | 'FINANCE_ADMIN';

export type PaymentRequestStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PROCESSED'
  | 'COMPLETE'
  | 'PENDING_MANAGER_APPROVAL'
  | 'PENDING_DIRECTOR_APPROVAL'
  | 'APPROVED_PENDING_PAYMENT'
  | 'PROCESSED_PENDING_RECONCILIATION'
  | 'RECON_PENDING_CHILD_CLOSURE'
  | 'CLOSED';

export type PaymentRequestLineItem = {
  id: string;
  description: string;
  accountCode: string;
  quantity: string;
  unitAmount: string;
  taxAmount: string;
  totalAmount: string;
};

export type PaymentRequestLineItemInput = {
  id?: string;
  description: string;
  accountCode: string;
  quantity: number;
  unitAmount: number;
  taxAmount?: number;
};

export type PaymentRequestActivityEntry = {
  id: string;
  at: string;
  actorUserId: string;
  actorName: string;
  action: string;
  detail: string;
};

export type PaymentRequestReconciliation = {
  reconciledAt: string;
  reconciledByUserId: string;
  reconciledByName: string;
  note: string;
  childRequestIds: string[];
  pendingChildRequestIds: string[];
};

export type PaymentRequestRecord = {
  id: string;
  requestNumber: string;
  type: PaymentRequestType;
  title: string;
  submitterId: string;
  submitterName: string;
  payeeName: string;
  currency: string;
  status: PaymentRequestStatus;
  lineItems: PaymentRequestLineItem[];
  totalAmount: string;
  notes: string;
  managerApproverId?: string;
  directorApproverId?: string;
  currentApproverId?: string;
  processedAt?: string;
  processedByUserId?: string;
  processedByName?: string;
  paymentDate?: string;
  paymentReference?: string;
  receiptLink?: string;
  parentRequestId?: string;
  childRequestIds: string[];
  reconciliation?: PaymentRequestReconciliation;
  createdAt: string;
  updatedAt: string;
  activity: PaymentRequestActivityEntry[];
};

export type PaymentRequestNotificationKind =
  | 'manager_approval_requested'
  | 'director_approval_requested'
  | 'finance_payment_requested'
  | 'submitter_processed_notice'
  | 'cash_reconciliation_requested'
  | 'cash_reconciliation_closed';

export type PaymentRequestNotification = {
  id: string;
  requestId: string;
  kind: PaymentRequestNotificationKind;
  toUserId: string;
  toLabel: string;
  toEmail: string;
  subject: string;
  body: string;
  createdAt: string;
  outboxPath: string;
};

export type PaymentRequestState = {
  requests: PaymentRequestRecord[];
  notifications: PaymentRequestNotification[];
};

export type PaymentRequestCreateInput = {
  actorId: string;
  type: PaymentRequestType;
  title: string;
  payeeName: string;
  currency?: string;
  lineItems: PaymentRequestLineItemInput[];
  notes?: string;
  managerApproverId?: string;
  directorApproverId?: string;
  parentRequestId?: string;
  childRequestIds?: string[];
};

export type PaymentRequestActionResult = {
  state: PaymentRequestState;
  notifications: PaymentRequestNotification[];
  request?: PaymentRequestRecord;
};

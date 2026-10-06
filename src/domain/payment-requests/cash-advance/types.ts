export type CashAdvanceStatus =
  | 'PENDING_MANAGER_APPROVAL'
  | 'PENDING_DIRECTOR_APPROVAL'
  | 'PENDING_FINANCE_PROCESSING'
  | 'PENDING_RECONCILIATION'
  | 'PENDING_FINANCE_RECONCILIATION'
  | 'RETURNED_TO_STAFF'
  | 'COMPLETED';

export type CashAdvanceDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

export type CashAdvanceRequestLine = {
  id: string;
  description: string;
  purpose: string;
  amount: number;
};

export type CashAdvanceExpense = {
  id: string;
  expenseDate: string;
  supplier: string;
  description: string;
  accountType: string;
  division?: string;
  amount: number;
  receiptLink?: string;
  receipt?: CashAdvanceDocument;
};

export type CashAdvanceParticipant = {
  id: string;
  participantName: string;
  activity: string;
  allowanceDate: string;
  amount: number;
};

export type CashAdvanceReconciliationInput = {
  requesterId: string;
  expenses: CashAdvanceExpense[];
  includesParticipantAllowance: boolean;
  participants: CashAdvanceParticipant[];
  participantProof?: CashAdvanceDocument;
  participantProofLink?: string;
  balanceReturnDate?: string;
  balanceReturnReference?: string;
  balanceReturnProof?: CashAdvanceDocument;
  remarks?: string;
};

export type CreateCashAdvanceInput = {
  organizationId: string;
  requestDate: string;
  requesterId: string;
  requesterName: string;
  requesterPosition: string;
  requesterDepartment: string;
  requesterContact: string;
  accountHolderName: string;
  bankName: string;
  bankAccountNumber: string;
  projectName: string;
  isOtherProject: boolean;
  managerApproverId: string;
  directorApproverId: string;
  purpose: string;
  currency: 'MYR';
  lines: CashAdvanceRequestLine[];
  supportingDocuments: CashAdvanceDocument[];
  remarks?: string;
  staffSignatureKey: string;
};

export type CashAdvanceReconciliation = CashAdvanceReconciliationInput & {
  totalSpent: number;
  balance: number;
  outcome: 'EXACT' | 'UNDERSPEND' | 'OVERSPEND';
  submittedAt: string;
};

export type CashAdvanceRecord = CreateCashAdvanceInput & {
  id: string;
  requestNumber: string;
  requestType: 'CASH_ADVANCE';
  status: CashAdvanceStatus;
  totalAmount: number;
  staffSignedAt: string;
  managerSignatureKey?: string;
  managerApprovedAt?: string;
  directorSignatureKey?: string;
  directorApprovedAt?: string;
  financePaidAt?: string;
  financePaidById?: string;
  financePaymentReference?: string;
  reconciliationDueDate?: string;
  reconciliation?: CashAdvanceReconciliation;
  returnRemarks?: string;
  returnedById?: string;
  returnedAt?: string;
  returnedStage?: 'REQUEST' | 'RECONCILIATION';
  completedAt?: string;
  completedById?: string;
  createdAt: string;
  updatedAt: string;
};

export type CashAdvanceRole = 'staff' | 'manager' | 'director' | 'finance';

export const CASH_ADVANCE_PROJECTS = [
  'N-AOC-UNDP',
  'N-MARCOMMS-ARUS',
  'O-BD-ARUS',
  'O-BMOFFICE-ARUS',
  'O-HR-ARUS',
  'O-KLOFFICE-ARUS',
  'O-L&D-ARUS',
  'O-MAKERSPACE-ARUS',
  'O-MANAGEMENT-ARUS',
  'O-WELFARE-ARUS',
  'P-BJCK-ARUS',
  'P-MAKERPROG-ARUS',
  'P-PWCDTT-UNICEF',
  'V-BAITBAIK-DAP',
  'V-BAITBAIK-SERI',
  'V-BESMART-CIMB',
  'V-FFL-FWDT',
  'V-FFLU-FWDI',
  'V-FS4A-GOOGLE',
  'V-FS4A-MISC',
  'V-FS4A-UNICEF',
  'V-IDENTIFAKE-USEMB',
  'V-KARISMA-YH',
  'V-MAKMUR-JICA',
  'V-ME4A-USEMB',
  'V-PJCC-MBPJ',
  'V-SEL-MISC',
  'V-STEAM-MISC',
  'V-VIA-TEF',
] as const;

export const CASH_ADVANCE_ACCOUNT_TYPES = [
  '600-001 PROJECT ACCOMODATION',
  '600-002 PROJECT TRANSPORTATION',
  '600-002A RENTAL OF MOTOR VEHICLE',
  '600-002B PROJECT MILEAGE CLAIM',
  '600-002C PROJECT TOLL & PARKING',
  "600-003 FASILITATOR AND TRAINER'S FEE",
  '600-004 PROJECT FOOD & BEVERAGE',
  '600-005 PROJECT CONSUMABLES',
  '600-006 PROJECT PR & MARKETING',
  '600-008 PARTICIPANT ALLOWANCE',
  '600-009 PROJECT DEVELOPMENT SOFTWARE',
  '600-010 PROJECT PRINTING & STATIONERY',
  '600-012 PROJECT VENUE/SPACE RENTAL',
  '901-000 ADVERTISEMENT',
  '906-000 STAFF BENEFITS',
  '910-000 OPERATING EXPENSES',
  '916-000 TOLL & PARKING',
  '917-000 TRAVEL & ACCOMODATION',
  '920-000 PRINTING & STATIONERIES',
  '921-001 STAFF GIFT',
  '922-000 OFFICE REFRESHMENT',
  '924-000 REPAIRS AND MAINTENANCE',
  '929-000 UPKEEP OF OFFICE',
  '929-001 UPKEEP OF AIRCOND',
  '932-000 POSTAGE & COURIER',
  '933-000 ENTERTAINMENT',
  '934-000 SUBSCRIPTIONS',
  '935-000 STAMPING',
  '937-000 FOOD / REFRESHMENT',
  '940-000 SEMINAR/TRAINING - STAFF',
  '941-000 REGISTRATION FEES',
  '946-000 OFFICE EXPENSES',
  '949-001 PROFESSIONAL FEES',
] as const;

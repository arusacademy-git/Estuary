export type PettyCashLocation = 'PENANG' | 'KUALA_LUMPUR';

export type PettyCashStatus =
  | 'PENDING_MANAGER_APPROVAL'
  | 'PENDING_DIRECTOR_APPROVAL'
  | 'PENDING_FINANCE_REVIEW'
  | 'PENDING_FINANCE_PAYMENT'
  | 'FINANCE_VERIFIED'
  | 'RETURNED_TO_STAFF'
  | 'PAID';

export type PettyCashRequestLine = {
  id: string;
  expenseDate: string;
  supplier: string;
  details: string;
  proofLink: string;
  accountType: string;
  division: string;
  amount: number;
};

export type CreatePettyCashInput = {
  organizationId: string;
  requesterId: string;
  requesterRole: PettyCashRole;
  requesterName: string;
  requesterPosition: string;
  requesterContact: string;
  requestDate: string;
  location: PettyCashLocation;
  managerApproverId: string;
  directorApproverId: string;
  financeReviewerId?: string;
  financeReviewerRole?: 'director' | 'finance';
  lines: PettyCashRequestLine[];
  notes?: string;
};

export type PettyCashRecord = CreatePettyCashInput & {
  id: string;
  requestNumber: string;
  requestType: 'PETTY_CASH_REQUEST';
  status: PettyCashStatus;
  totalAmount: number;
  managerApprovedAt?: string;
  directorApprovedAt?: string;
  requesterReviewedAt?: string;
  requesterReviewedById?: string;
  financeVerifiedAt?: string;
  financeVerifiedById?: string;
  paymentDate?: string;
  paymentReference?: string;
  paymentProofLink?: string;
  paidAt?: string;
  paidById?: string;
  returnRemarks?: string;
  returnedById?: string;
  returnedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PettyCashFinanceInput = {
  financeId: string;
  paymentDate: string;
  paymentReference: string;
  paymentProofLink: string;
  notes?: string;
};

export type PettyCashLedgerTransaction = {
  id: string;
  date: string;
  name: string;
  location: PettyCashLocation;
  moneyIn: number;
  moneyOut: number;
  balance: number;
  proofLink?: string;
  notes: string;
  requestId?: string;
  requestNumber?: string;
};

export type PettyCashLedgerSummary = {
  location: PettyCashLocation;
  month: string;
  allocation: number;
  openingBalance: number;
  moneyIn: number;
  moneyOut: number;
  balance: number;
  transactions: PettyCashLedgerTransaction[];
};

export type PettyCashRole = 'staff' | 'manager' | 'director' | 'finance';

export const PETTY_CASH_LOCATIONS: ReadonlyArray<{
  value: PettyCashLocation;
  label: string;
}> = [
  { value: 'PENANG', label: 'Penang' },
  { value: 'KUALA_LUMPUR', label: 'Kuala Lumpur' },
];

export const DIVISION_TYPES = [
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

export const PETTY_CASH_ACCOUNT_TYPES = [
  '600-001 PROJECT ACCOMODATION',
  '600-002 PROJECT TRANSPORTATION',
  '600-002C PROJECT TOLL & PARKING',
  '600-004 PROJECT FOOD & BEVERAGE',
  '600-005 PROJECT CONSUMABLES',
  '600-006 PROJECT PR & MARKETING',
  '600-010 PROJECT PRINTING & STATIONERY',
  '906-000 STAFF BENEFITS',
  '910-000 OPERATING EXPENSES',
  '916-000 TOLL & PARKING',
  '920-000 PRINTING & STATIONERIES',
  '922-000 OFFICE REFRESHMENT',
  '932-000 POSTAGE & COURIER',
  '937-000 FOOD / REFRESHMENT',
  '946-000 OFFICE EXPENSES',
] as const;

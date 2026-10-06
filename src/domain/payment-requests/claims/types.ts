import type { BetaRole } from '@/lib/auth/beta-accounts';

export type ClaimType =
  | 'EXPENSE'
  | 'INTERNET_COMMUTE'
  | 'MEDICAL'
  | 'MILEAGE'
  | 'PD'
  | 'TECH';

export type ClaimLine = {
  id: string;
  expenseDate: string;
  supplier: string;
  details: string;
  receiptDocumentId?: string;
  receiptLink?: string;
  receiptFileName: string;
  receiptMimeType: string;
  receiptFileSize: number;
  accountType: string;
  division: string;
  amount: number;
  from: string;
  to: string;
  kilometers: number;
};

export type CreateClaimInput = {
  organizationId: string;
  requesterId: string;
  requesterName: string;
  requesterPosition: string;
  requesterRole: BetaRole;
  managerApproverId?: string;
  directorApproverId?: string;
  requesterContact: string;
  claimDate: string;
  claimType: ClaimType;
  techExtended: boolean;
  lines: ClaimLine[];
  notes?: string;
};

export type ClaimStatus =
  | 'DRAFT'
  | 'CLAIM_SUBMITTED'
  | 'PENDING_MANAGER_APPROVAL'
  | 'PENDING_DIRECTOR_APPROVAL'
  | 'RETURNED_TO_CLAIMANT'
  | 'PENDING_FINANCE_PROCESSING'
  | 'PAID';

export type ClaimRecord = CreateClaimInput & {
  id: string;
  claimNumber: string;
  requestType: 'CLAIM_REQUEST';
  status: ClaimStatus;
  totalAmount: number;
  managerApprovedAt?: string;
  managerApprovedById?: string;
  directorReviewedAt?: string;
  directorReviewedById?: string;
  financeProcessedAt?: string;
  financeProcessedById?: string;
  paymentDate?: string;
  paymentReference?: string;
  paymentNotes?: string;
  returnedAt?: string;
  returnedById?: string;
  returnRemarks?: string;
  returnedFromStage?: 'MANAGER' | 'DIRECTOR' | 'FINANCE';
  createdAt: string;
  updatedAt: string;
};

export type ClaimFinanceInput = {
  paymentDate: string;
  paymentReference: string;
  notes?: string;
};

export type ClaimPolicyContext = {
  medicalUsedThisYear: number;
  techExtendedLockedUntil?: string;
};

export type ClaimReceiptUpload = {
  lineId: string;
  fileName: string;
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';
  bytes: Uint8Array;
};

export const CLAIM_TYPES: ReadonlyArray<{
  value: ClaimType;
  code: string;
  label: string;
  description: string;
  template: string;
}> = [
  { value: 'EXPENSE', code: 'EX', label: 'Expense claim', description: 'General reimbursable work expenses with no monetary cap.', template: 'Expense Claim Form Template.pdf' },
  { value: 'INTERNET_COMMUTE', code: 'IC', label: 'Internet / commute', description: 'Internet and commuting expenses up to RM70.00.', template: 'Internet_Commute Claim Form Template.pdf' },
  { value: 'MEDICAL', code: 'MC', label: 'Medical claim', description: 'Medical reimbursement within the RM500.00 calendar-year allowance.', template: 'Medical Claim Form Template.pdf' },
  { value: 'MILEAGE', code: 'MI', label: 'Mileage claim', description: 'Mileage calculated automatically from the distance of each trip.', template: 'Mileage Claim Form Template.pdf' },
  { value: 'PD', code: 'PD', label: 'PD claim', description: 'Professional development expenses up to RM500.00.', template: 'PD Claim Form Template.pdf' },
  { value: 'TECH', code: 'TC', label: 'Tech claim', description: 'Technology expenses up to RM500.00, or RM1,000.00 with the three-year option.', template: 'Tech Claim Form Template.pdf' },
];

export function claimTypeDetails(type: ClaimType) {
  return CLAIM_TYPES.find((item) => item.value === type) ?? CLAIM_TYPES[0];
}

export const CLAIM_DIVISION_TYPES = [
  'N-AOC-UNDP',
  'N-MARCOMMS-ARUS',
  'O-BMOFFICE-ARUS',
  'O-BD-ARUS',
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

export const CLAIM_ACCOUNT_TYPES = [
  '600-001 PROJECT ACCOMODATION',
  '600-002 PROJECT TRANSPORTATION',
  '600-002A RENTAL OF MOTOR VEHICLE',
  '600-002B PROJECT MILEAGE CLAIM',
  '600-002C PROJECT TOLL & PARKING',
  "600-003 FACILITATOR AND TRAINER'S FEE",
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

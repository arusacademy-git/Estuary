export type InvoiceTransferType = 'GIRO' | 'INSTANT';

export type InvoicePaymentPortion =
  | 'UPFRONT_50'
  | 'BALANCE_50'
  | 'FULL'
  | 'OTHER';

export const INVOICE_PAYMENT_PROJECTS = [
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

export type PaymentRequestStatus =
  | 'DRAFT'
  | 'PENDING_MANAGER_REVIEW'
  | 'PENDING_DIRECTOR_REVIEW'
  | 'PENDING_FINANCE_REVIEW'
  | 'COMPLETED'
  | 'RETURNED_TO_STAFF';

export type PaymentRequestDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

export type CreateInvoicePaymentRequestInput = {
  organizationId: string;
  requestDate: string;
  staffId: string;
  staffName: string;
  projectName: string;
  title: string;
  purpose: string;
  vendorName: string;
  eInvoiceLink: string;
  transferType: InvoiceTransferType;
  paymentPortion: InvoicePaymentPortion;
  paymentPortionOther?: string;
  managerApproverId: string;
  directorApproverId: string;
  currency: 'MYR';
  invoiceTotal: number;
  taxAmount: number;
  requestedAmount: number;
  supportingDocuments: PaymentRequestDocument[];
  remarks?: string;
};

export type InvoicePaymentRequestRecord =
  CreateInvoicePaymentRequestInput & {
    id: string;
    requestNumber: string;
    requestType: 'INVOICE_PAYMENT';
    status: PaymentRequestStatus;
    totalAmount: number;
    managerReviewedAt?: string;
    managerReviewedById?: string;
    managerReturnedAt?: string;
    managerReturnedById?: string;
    managerReturnRemarks?: string;
    directorReviewedAt?: string;
    directorReviewedById?: string;
    directorReturnedAt?: string;
    directorReturnedById?: string;
    directorReturnRemarks?: string;
    financeVerifiedAt?: string;
    financeVerifiedById?: string;
    financeReturnedAt?: string;
    financeReturnedById?: string;
    financeReturnRemarks?: string;
    createdAt: string;
    updatedAt: string;
  };
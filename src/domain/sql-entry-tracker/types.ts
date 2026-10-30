export type SqlEntryStatus =
  | 'PENDING_ENTRY'
  | 'RECORDED_IN_SQL_SYSTEM'
  | 'NEEDS_CORRECTION'
  | 'NOT_REQUIRED';

export type SqlEntryPaymentType =
  | 'PAYMENT_VOUCHER'
  | 'INVOICE_PAYMENT'
  | 'TRAVEL_ALLOWANCE'
  | 'CASH_ADVANCE'
  | 'PETTY_CASH'
  | 'CLAIM';

export type SqlEntryRecord = {
  submissionId: string;
  referenceNumber: string;
  paymentType: SqlEntryPaymentType;
  requesterName: string;
  programme: string;
  amount: number;
  paymentDate: string;
  status: SqlEntryStatus;
  sqlReference: string;
  recordedAt: string;
  notes: string;
  updatedByName: string;
  updatedAt: string;
  detailHref: string;
};

export type SqlEntryTrackingEntry = Pick<
  SqlEntryRecord,
  'submissionId' | 'status' | 'sqlReference' | 'recordedAt' | 'notes' | 'updatedByName' | 'updatedAt'
>;
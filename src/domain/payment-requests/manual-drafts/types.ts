export const MANUAL_DRAFT_TYPES = [
  "PAYMENT_VOUCHER",
  "PETTY_CASH",
  "INVOICE_PAYMENT",
  "TRAVEL_ALLOWANCE",
  "CASH_ADVANCE",
  "CLAIM",
] as const;

export type ManualDraftType = (typeof MANUAL_DRAFT_TYPES)[number];

export type ManualFormDraft<T = unknown> = {
  id: string;
  organizationId: string;
  requesterId: string;
  paymentType: ManualDraftType;
  snapshot: T;
  createdAt: string;
  updatedAt: string;
};

export type SaveManualFormDraftInput<T = unknown> = {
  id?: string;
  organizationId: string;
  requesterId: string;
  paymentType: ManualDraftType;
  snapshot: T;
};

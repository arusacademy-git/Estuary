import type {
  PaymentVoucherStatus,
} from './status';

export type PaymentVoucherActorRole =
  | 'STAFF'
  | 'MANAGER'
  | 'DIRECTOR'
  | 'FINANCE_ADMIN'
  | 'PROJECT_MANAGER'
  | 'EXTERNAL_RECIPIENT';

/*
 * The signing option explicitly selected
 * by the recipient.
 *
 * The system should not attempt to detect
 * this automatically from the PDF.
 */
export type RecipientSignatureMethod =
  | 'DIGITAL'
  | 'MANUAL';

/*
 * Identifies who uploaded the final signed
 * Payment Voucher into Estuary.
 */
export type SignedPvUploadSource =
  | 'RECIPIENT'
  | 'STAFF';

export type PaymentVoucherLineInput = {
  accountCode: string;
  description: string;
  quantity: number;
  unitAmount: number;
  taxAmount: number;
};

export type PaymentVoucherRecord = {
  id: string;
  organizationId: string;
  voucherNumber: string;
  status: PaymentVoucherStatus;

  /*
   * Staff and workflow assignments.
   */
  submitterId: string;
  directorId: string;

  projectManagerId?: string;
  projectManagerViewedAt?: string;

  /*
   * General Payment Voucher information.
   */
  pvDate: string;
  division: string;

  /*
   * Recipient information.
   */
  recipientName: string;
  recipientEmail: string;
  recipientReference: string;
  recipientIc?: string;
  recipientIsMalaysian: boolean;

  /*
   * Recipient bank and payment method.
   */
  paymentMethod: string;
  bankName?: string;
  bankAccountNumber?: string;

  /*
   * Payment purpose and voucher lines.
   */
  purpose: string;
  lines: PaymentVoucherLineInput[];
  amount: number;

  /*
   * Director approval or rejection.
   */
  rejectionRemarks?: string;
  directorSignatureKey?: string;
  directorApprovedAt?: string;

  /*
   * Finance payment processing.
   */
  financeReviewedAt?: string;

  paymentDate?: string;
  paymentReference?: string;

  paymentProofFileName?: string;
  paymentProofUploadedAt?: string;

  paymentRemarks?: string;
  paymentMadeById?: string;

  /*
   * Temporary legacy receipt fields.
   *
   * Keep these until all older components
   * use paymentProofFileName.
   */
  receiptFileName?: string;
  receiptUploadedAt?: string;

  /*
   * Finance-generated PV PDF.
   */
  pvPdfFileName?: string;
  pvPdfGeneratedAt?: string;

  /*
   * Staff sends the generated PV to the
   * recipient outside Estuary.
   */
  recipientPvSentAt?: string;
  recipientPvSentById?: string;
  recipientPvSendCount?: number;

  /*
   * Recipient signing method.
   *
   * DIGITAL:
   * The recipient signs using the secure
   * recipient page.
   *
   * MANUAL:
   * The recipient downloads, prints and
   * signs the Payment Voucher manually.
   */
  recipientSignatureMethod?:
    RecipientSignatureMethod;

  recipientSignatureMethodSelectedAt?:
    string;

  /*
   * Digital signature information.
   *
   * recipientSignatureDataUrl stores the
   * signature image in the beta prototype.
   */
  recipientSignedAt?: string;
  recipientSignatureDataUrl?: string;

  /*
   * Final signed Payment Voucher.
   *
   * signedPvUploadSource identifies whether
   * the recipient uploaded it through the
   * secure link or Staff uploaded a copy
   * received outside Estuary.
   */
  signedPvFileName?: string;
  signedPvDataUrl?: string;

  signedPvUploadSource?:
    SignedPvUploadSource;

  signedPvUploadedAt?: string;
  signedPvUploadedById?: string;

  /*
   * Staff confirmation of the signed PV.
   *
   * When Staff uploads a manually signed PV,
   * the upload and confirmation may happen
   * in the same action.
   */
  staffConfirmedSignedPvAt?: string;
  staffConfirmedSignedPvById?: string;

  /*
   * Final Finance verification.
   */
  financeVerifiedAt?: string;
  financeCompletedById?: string;

  /*
   * Bank rejection or invalid payment.
   */
  inactiveAt?: string;
  inactiveById?: string;
  inactiveRemarks?: string;

  /*
   * Secure recipient-link prototype fields.
   */
  recipientAccessToken?: string;
  recipientAccessExpiresAt?: string;
  recipientConfirmedAt?: string;

  recipientLinkSentAt?: string;
  recipientLinkSentById?: string;
  recipientLinkSendCount?: number;

  /*
   * Temporary legacy verification fields.
   */
  staffVerifiedAt?: string;
  recipientSignatureKey?: string;

  /*
   * Record timestamps.
   */
  createdAt: string;
  updatedAt: string;
};

export type CreatePaymentVoucherInput =
  Omit<
    PaymentVoucherRecord,

    /*
     * System-generated identity and status.
     */
    | 'id'
    | 'voucherNumber'
    | 'status'
    | 'recipientReference'
    | 'amount'

    /*
     * Project Manager workflow.
     */
    | 'projectManagerViewedAt'

    /*
     * Director workflow.
     */
    | 'rejectionRemarks'
    | 'directorSignatureKey'
    | 'directorApprovedAt'

    /*
     * Finance processing.
     */
    | 'financeReviewedAt'
    | 'paymentDate'
    | 'paymentReference'
    | 'paymentProofFileName'
    | 'paymentProofUploadedAt'
    | 'paymentRemarks'
    | 'paymentMadeById'

    /*
     * Temporary legacy receipt fields.
     */
    | 'receiptFileName'
    | 'receiptUploadedAt'

    /*
     * Generated PV PDF.
     */
    | 'pvPdfFileName'
    | 'pvPdfGeneratedAt'

    /*
     * Recipient delivery tracking.
     */
    | 'recipientPvSentAt'
    | 'recipientPvSentById'
    | 'recipientPvSendCount'

    /*
     * Recipient signing method.
     */
    | 'recipientSignatureMethod'
    | 'recipientSignatureMethodSelectedAt'

    /*
     * Digital signature information.
     */
    | 'recipientSignedAt'
    | 'recipientSignatureDataUrl'

    /*
     * Final signed PV upload.
     */
    | 'signedPvFileName'
    | 'signedPvDataUrl'
    | 'signedPvUploadSource'
    | 'signedPvUploadedAt'
    | 'signedPvUploadedById'

    /*
     * Staff signed-PV confirmation.
     */
    | 'staffConfirmedSignedPvAt'
    | 'staffConfirmedSignedPvById'

    /*
     * Finance archive verification.
     */
    | 'financeVerifiedAt'
    | 'financeCompletedById'

    /*
     * Inactive workflow.
     */
    | 'inactiveAt'
    | 'inactiveById'
    | 'inactiveRemarks'

    /*
     * Secure recipient-link fields.
     */
    | 'recipientAccessToken'
    | 'recipientAccessExpiresAt'
    | 'recipientConfirmedAt'
    | 'recipientLinkSentAt'
    | 'recipientLinkSentById'
    | 'recipientLinkSendCount'

    /*
     * Temporary legacy workflow fields.
     */
    | 'staffVerifiedAt'
    | 'recipientSignatureKey'

    /*
     * System timestamps.
     */
    | 'createdAt'
    | 'updatedAt'
  > & {
    /*
     * Staff may optionally provide an
     * existing recipient reference.
     * Otherwise the dummy store generates it.
     */
    recipientReference?: string;
  };

export type PaymentVoucherVisibilityRole =
  | 'staff'
  | 'manager'
  | 'director'
  | 'finance';
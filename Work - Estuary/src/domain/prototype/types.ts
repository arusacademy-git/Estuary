import type { RuntimeSignal } from '@/domain/bootstrap/types';

export type ThemeTokens = {
  canvas: string;
  panel: string;
  panelStrong: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
};

export type DummyUser = {
  id: string;
  name: string;
  email: string;
  title: string;
  roles: string[];
  areaCode: string;
  agentCode: string;
};

export type ReferenceItem = {
  id: string;
  code: string;
  label: string;
  detail?: string;
};

export type ReferenceCollection = {
  id: string;
  label: string;
  description: string;
  itemLabel: string;
  items: ReferenceItem[];
};

export type WorkflowPolicy = {
  approverSelectionMode: string;
  financeAdminOverride: boolean;
  samePersonManagerDirectorAllowed: boolean;
  amountThresholdsDeferred: boolean;
  managerOnLeaveFallback: string;
  selfApprovalToggleModes: string[];
  urgentBypassRule: string;
  signatureReminderPolicy: string;
  signedVoucherRejectionTargetState: string;
  retentionPolicy: string;
};

export type EmailTemplateDefinition = {
  title: string;
  subject: string;
  body: string;
};

export type TemplatePlaceholder = {
  key: string;
  label: string;
  example: string;
};

export type VoucherFieldDefinition = {
  section: string;
  label: string;
  binding: string;
};

export type LifecycleStage = {
  id: string;
  title: string;
  detail: string;
};

export type ExceptionRule = {
  id: string;
  title: string;
  resolution: string;
};

export type PrototypeDraftLineItem = {
  id: string;
  accountCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxCode: string;
  taxAmount: string;
};

export type PrototypeDraft = {
  voucherNumber: string;
  organizationName: string;
  currentUserId: string;
  approverId: string;
  payeeName: string;
  payeeEmail: string;
  payeeIdentity: string;
  amountInWords: string;
  paymentDetails: string;
  paymentModeCode: string;
  bankName: string;
  bankAccountNumber: string;
  projectCode: string;
  glCode: string;
  paymentReference: string;
  urgentBypass: boolean;
  selfApprovalMode: string;
  lineItems: PrototypeDraftLineItem[];
  amountsTaxInclusive: boolean;
  showDescriptionColumn: boolean;
  showTaxAmountColumn: boolean;
  showFooters: boolean;
};

export type PrototypeConfig = {
  brand: string;
  status: string;
  heroTitle: string;
  heroSummary: string;
  theme: ThemeTokens;
  users: DummyUser[];
  referenceCollections: ReferenceCollection[];
  workflowPolicy: WorkflowPolicy;
  emailTemplate: EmailTemplateDefinition;
  templatePlaceholders: TemplatePlaceholder[];
  voucherFields: VoucherFieldDefinition[];
  lifecycleStages: LifecycleStage[];
  exceptionRules: ExceptionRule[];
  sourceArtifacts: string[];
  prototypeDraft: PrototypeDraft;
};

export type PrototypeWorkspace = PrototypeConfig & {
  runtimeSignals: RuntimeSignal[];
  vouchers: PrototypeVoucherRecord[];
  notifications: PrototypeNotification[];
  exports: PrototypeExportArtifact[];
  templateCards: PrototypeTemplateCard[];
};

export type PrototypeVoucherStatus =
  | 'pending_director_approval'
  | 'approved_for_payment'
  | 'awaiting_signature'
  | 'awaiting_staff_verification'
  | 'completed'
  | 'signature_rejected';

export type PrototypeActivityEntry = {
  id: string;
  at: string;
  actorLabel: string;
  action: string;
  detail: string;
};

export type PrototypeDirectorApproval = {
  approverUserId: string;
  approverName: string;
  signatureText: string;
  approvedAt: string;
  note: string;
};

export type PrototypeFinanceProcessing = {
  processedByUserId: string;
  processedByName: string;
  paidAt: string;
  paymentReference: string;
  receiptLink: string;
  note: string;
};

export type PrototypeRecipientSignature = {
  recipientName: string;
  recipientEmail: string;
  token: string;
  signatureText?: string;
  signedAt?: string;
  note?: string;
};

export type PrototypeStaffVerification = {
  verifiedByUserId: string;
  verifiedByName: string;
  verifiedAt: string;
  note: string;
};

export type PrototypeVoucherRecord = {
  id: string;
  voucherNumber: string;
  title: string;
  submitterId: string;
  approverId: string;
  amount: string;
  status: PrototypeVoucherStatus;
  urgent: boolean;
  projectCode: string;
  glCode: string;
  lastUpdatedLabel: string;
  payeeName: string;
  payeeEmail: string;
  paymentReference?: string;
  createdAt: string;
  updatedAt: string;
  draft: PrototypeDraft;
  directorApproval?: PrototypeDirectorApproval;
  financeProcessing?: PrototypeFinanceProcessing;
  recipientSignature: PrototypeRecipientSignature;
  staffVerification?: PrototypeStaffVerification;
  activity: PrototypeActivityEntry[];
  lastExportPath?: string;
};

export type PrototypeNotification = {
  id: string;
  voucherId: string;
  kind:
    | 'approval_request'
    | 'finance_ready'
    | 'recipient_signature_request'
    | 'staff_verification_request'
    | 'finance_completion_notice';
  toLabel: string;
  toEmail: string;
  subject: string;
  body: string;
  actionPath?: string;
  createdAt: string;
  outboxPath: string;
};

export type PrototypeExportArtifact = {
  id: string;
  createdAt: string;
  createdByUserId: string;
  voucherIds: string[];
  filePath: string;
  kind: 'single' | 'batch';
};

export type PrototypeSubmissionStatus =
  | 'pending_director_approval'
  | 'approved_for_payment'
  | 'awaiting_signature'
  | 'awaiting_staff_verification'
  | 'completed'
  | 'signature_rejected';

export type PrototypeSubmission = {
  id: string;
  voucherNumber: string;
  title: string;
  submitterId: string;
  approverId: string;
  amount: string;
  status: PrototypeSubmissionStatus;
  urgent: boolean;
  projectCode: string;
  glCode: string;
  lastUpdatedLabel: string;
  payeeName: string;
  paymentReference?: string;
};

export type PrototypeFinanceItem = {
  id: string;
  voucherNumber: string;
  queueLabel: string;
  ownerLabel: string;
  dueLabel: string;
  urgent: boolean;
};

export type PrototypeTemplateCard = {
  id: string;
  title: string;
  description: string;
  placeholderKeys: string[];
};

export type PrototypeAppData = {
  submissions: PrototypeSubmission[];
  financeQueue: PrototypeFinanceItem[];
  templateCards: PrototypeTemplateCard[];
};

export type PrototypeState = {
  vouchers: PrototypeVoucherRecord[];
  notifications: PrototypeNotification[];
  exports: PrototypeExportArtifact[];
};

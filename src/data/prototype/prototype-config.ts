import type { PrototypeConfig } from '@/domain/prototype/types';

export const prototypeConfig: PrototypeConfig = {
  brand: 'Estuary',
  status: 'Config-driven PV Prototype',
  heroTitle:
    'Payment vouchers should feel like a controlled workflow, not a spreadsheet ritual.',
  heroSummary:
    'This workbench models your latest decisions as editable configuration: submitter-chosen approvers, finance override, urgent bypass, self-approval toggle modes, dummy sign-in, and placeholder-driven templates.',
  theme: {
    canvas: '#f5efe6',
    panel: '#fbf7f1',
    panelStrong: '#efe3d2',
    line: 'rgba(29, 24, 20, 0.12)',
    ink: '#171310',
    muted: 'rgba(23, 19, 16, 0.68)',
    accent: '#8d4f21',
    accentSoft: 'rgba(141, 79, 33, 0.14)',
    success: '#2b6d55',
    warning: '#8d5f21',
  },
  users: [
    {
      id: 'usr-afiq',
      name: 'Afiq Rahman',
      email: 'afiq@arus.local',
      title: 'Programme Staff',
      roles: ['STAFF'],
      areaCode: 'KL',
      agentCode: 'AG-KL-014',
    },
    {
      id: 'usr-sarah',
      name: 'Sarah Lim',
      email: 'sarah@arus.local',
      title: 'Finance Admin',
      roles: ['FINANCE_ADMIN'],
      areaCode: 'PG',
      agentCode: 'AG-PG-002',
    },
    {
      id: 'usr-maryam',
      name: 'Maryam Iskandar',
      email: 'maryam@arus.local',
      title: 'Operations Manager',
      roles: ['STAFF', 'MANAGER'],
      areaCode: 'KL',
      agentCode: 'AG-KL-001',
    },
    {
      id: 'usr-farid',
      name: 'Farid Hakim',
      email: 'farid@arus.local',
      title: 'School Director',
      roles: ['STAFF', 'DIRECTOR'],
      areaCode: 'PG',
      agentCode: 'AG-PG-001',
    },
    {
      id: 'usr-aisha',
      name: 'Aisha Noor',
      email: 'aisha@arus.local',
      title: 'Group Director',
      roles: ['DIRECTOR'],
      areaCode: 'KL',
      agentCode: 'AG-KL-900',
    },
    {
      id: 'usr-jasmin',
      name: 'Jasmin Teh',
      email: 'jasmin@arus.local',
      title: 'Director',
      roles: ['DIRECTOR'],
      areaCode: 'PG',
      agentCode: 'AG-PG-901',
    },
    {
      id: 'usr-yusuf',
      name: 'Yusuf Khair',
      email: 'yusuf@arus.local',
      title: 'Director',
      roles: ['DIRECTOR'],
      areaCode: 'JB',
      agentCode: 'AG-JB-902',
    },
  ],
  referenceCollections: [
    {
      id: 'staff',
      label: 'Staff directory',
      description:
        'Submitters pick approvers from live people, not from hardcoded logic.',
      itemLabel: 'staff member',
      items: [
        {
          id: 'staff-afiq',
          code: 'AFIQ',
          label: 'Afiq Rahman',
          detail: 'Programme Staff',
        },
        {
          id: 'staff-maryam',
          code: 'MARYAM',
          label: 'Maryam Iskandar',
          detail: 'Operations Manager',
        },
        {
          id: 'staff-farid',
          code: 'FARID',
          label: 'Farid Hakim',
          detail: 'School Director',
        },
        {
          id: 'staff-aisha',
          code: 'AISHA',
          label: 'Aisha Noor',
          detail: 'Group Director',
        },
      ],
    },
    {
      id: 'projects',
      label: 'Projects',
      description:
        'Project codes stay editable because the organization changes constantly.',
      itemLabel: 'project',
      items: [
        { id: 'prj-alma', code: 'ALMA', label: 'Alma Campus' },
        { id: 'prj-scholar', code: 'SCHOLAR', label: 'Scholarship Fund' },
        { id: 'prj-ops', code: 'OPS', label: 'General Operations' },
      ],
    },
    {
      id: 'gl-codes',
      label: 'GL codes',
      description:
        'Line-level GL selection mirrors the eventual SQL Account export model.',
      itemLabel: 'GL code',
      items: [
        { id: 'gl-5100', code: '5100', label: 'Transport Claims' },
        { id: 'gl-5210', code: '5210', label: 'Programme Materials' },
        { id: 'gl-6100', code: '6100', label: 'Honorarium' },
      ],
    },
    {
      id: 'payment-modes',
      label: 'Payment modes',
      description:
        'Templates and finance operations should read from editable payment modes.',
      itemLabel: 'payment mode',
      items: [
        { id: 'pm-bank', code: 'BANK_TRANSFER', label: 'Bank Transfer' },
        { id: 'pm-cash', code: 'CASH', label: 'Cash' },
        { id: 'pm-cheque', code: 'CHEQUE', label: 'Cheque' },
      ],
    },
    {
      id: 'tax-codes',
      label: 'Tax codes',
      description:
        'Line items should read tax posture from editable tax codes, not fixed UI assumptions.',
      itemLabel: 'tax code',
      items: [
        { id: 'tax-none', code: 'NO_TAX', label: 'No tax' },
        { id: 'tax-sst', code: 'SST_6', label: 'SST 6%' },
        { id: 'tax-manual', code: 'MANUAL', label: 'Manual tax' },
      ],
    },
  ],
  workflowPolicy: {
    approverSelectionMode:
      'Submitter selects the approver from the live staff directory.',
    financeAdminOverride: true,
    samePersonManagerDirectorAllowed: true,
    amountThresholdsDeferred: true,
    managerOnLeaveFallback:
      'Directors can approve directly when manager approval is unavailable.',
    selfApprovalToggleModes: [
      'Require another director',
      'Auto pass-through when the submitter is a director',
    ],
    urgentBypassRule:
      'Urgent items can bypass manager approval, but still require director approval and stay visibly flagged for finance.',
    signatureReminderPolicy:
      'Keep sending reminders indefinitely and flag the item for human follow-up.',
    signedVoucherRejectionTargetState:
      'Return to pending signature and continue the collection loop.',
    retentionPolicy: 'Keep documents permanently.',
  },
  emailTemplate: {
    title: 'Approval request',
    subject:
      '[{{organizationName}}] {{voucherNumber}} needs {{approvalStageLabel}} approval',
    body:
      'Hello {{approverName}},\n\n{{submitterName}} has submitted {{voucherNumber}} for {{amount}} ({{amountInWords}}).\n\nPayee: {{payeeName}}\nBeing: {{paymentDetails}}\nUrgent bypass: {{urgentFlag}}\n\nOpen the approval surface and review the payment voucher.\n\nRegards,\nEstuary',
  },
  templatePlaceholders: [
    {
      key: 'organizationName',
      label: 'Organization',
      example: 'Arus Education Sdn Bhd',
    },
    {
      key: 'voucherNumber',
      label: 'Voucher number',
      example: 'PV-2026-04-17',
    },
    {
      key: 'approvalStageLabel',
      label: 'Approval stage',
      example: 'director',
    },
    {
      key: 'submitterName',
      label: 'Submitter',
      example: 'Afiq Rahman',
    },
    {
      key: 'approverName',
      label: 'Approver',
      example: 'Farid Hakim',
    },
    { key: 'payeeName', label: 'Payee', example: 'Nurul Irdina' },
    { key: 'amount', label: 'Amount', example: 'RM 1,250.00' },
    {
      key: 'amountInWords',
      label: 'Amount in words',
      example:
        'Ringgit Malaysia One Thousand Two Hundred Fifty Only',
    },
    {
      key: 'paymentDetails',
      label: 'Being',
      example: 'Transport allowance for Alma teacher programme',
    },
    {
      key: 'urgentFlag',
      label: 'Urgent flag',
      example: 'Yes - bypass manager stage',
    },
  ],
  voucherFields: [
    {
      section: 'Header',
      label: 'Date',
      binding: 'auto-generated from the draft date',
    },
    { section: 'Header', label: 'Currency', binding: 'always MYR by organization default' },
    { section: 'Header', label: 'Transaction No', binding: 'voucherNumber' },
    { section: 'Payment', label: 'Amount', binding: 'amount' },
    {
      section: 'Payment',
      label: 'Amount in words',
      binding: 'amountInWords',
    },
    {
      section: 'Payment',
      label: 'Payment details',
      binding: 'paymentDetails',
    },
    {
      section: 'Payment',
      label: 'Mode of payment',
      binding: 'paymentModeCode',
    },
    { section: 'Bank', label: 'Bank name', binding: 'bankName' },
    {
      section: 'Bank',
      label: 'Bank account number',
      binding: 'bankAccountNumber',
    },
    {
      section: 'Payee',
      label: 'To whom',
      binding: 'payeeName + payeeIdentity',
    },
    { section: 'Approval', label: 'Approved by', binding: 'approverId' },
    { section: 'Finance', label: 'Paid by', binding: 'finance capture later' },
    {
      section: 'Receipt',
      label: 'Received by (signature)',
      binding: 'recipient signature later',
    },
    {
      section: 'Finance',
      label: 'Approval date / reference',
      binding: 'approval + payment stage data',
    },
  ],
  lifecycleStages: [
    {
      id: 'generate',
      title: 'Generate',
      detail:
        'Submitter fills the draft and the system issues a controlled voucher record.',
    },
    {
      id: 'approval',
      title: 'Approval',
      detail:
        'Approver is selected from live staff records; directors remain the final gatekeepers.',
    },
    {
      id: 'payment',
      title: 'Payment',
      detail:
        'Finance records payment proof, reference, and payment date before PDF issuance.',
    },
    {
      id: 'verification',
      title: 'Verification',
      detail:
        'Recipient checks, signs, and the signed file comes back into the workflow.',
    },
    {
      id: 'archive',
      title: 'Archive',
      detail:
        'Finance validates the signed document and marks the voucher complete.',
    },
  ],
  exceptionRules: [
    {
      id: 'manager-on-leave',
      title: 'Manager unavailable',
      resolution:
        'Directors can approve directly; the director pool acts as the durable fallback.',
    },
    {
      id: 'submitter-is-director',
      title: 'Submitter is also an approver',
      resolution:
        'The organization can toggle between pass-through and forcing another director to approve.',
    },
    {
      id: 'recipient-never-signs',
      title: 'Recipient never signs',
      resolution:
        'Reminder loop continues indefinitely and finance sees it as a human follow-up item.',
    },
    {
      id: 'signed-pv-rejected',
      title: 'Signed voucher rejected',
      resolution:
        'Reject it back to pending signature and let the collection loop continue.',
    },
    {
      id: 'urgent-bypass',
      title: 'Urgent payment',
      resolution:
        'Bypass is allowed, but director approval remains mandatory and finance sees the urgent flag.',
    },
  ],
  sourceArtifacts: [
    '(PV) Payment Voucher Operating System Guidelines.pdf',
    'PV Generator - PV_Template.pdf',
  ],
  prototypeDraft: {
    voucherNumber: 'PV-2026-04-17',
    organizationName: 'Arus Education Sdn Bhd',
    currentUserId: 'usr-afiq',
    approverId: 'usr-farid',
    payeeName: 'Nurul Irdina',
    payeeEmail: 'nurul.irdina@example.com',
    payeeIdentity: '900101-07-1234',
    amountInWords:
      'Ringgit Malaysia One Thousand Two Hundred Fifty Only',
    paymentDetails: 'Transport allowance claim for Alma literacy workshop.',
    paymentModeCode: 'BANK_TRANSFER',
    bankName: 'Maybank',
    bankAccountNumber: '5140-8230-1884',
    projectCode: 'ALMA',
    glCode: '5100',
    paymentReference: 'To be captured by finance',
    urgentBypass: false,
    selfApprovalMode: 'Require another director',
    lineItems: [
      {
        id: 'line-1',
        accountCode: '5100',
        description: 'Workshop transport claim - Day 1',
        quantity: '2',
        unitPrice: '125.00',
        taxCode: 'NO_TAX',
        taxAmount: '0.00',
      },
    ],
    amountsTaxInclusive: false,
    showDescriptionColumn: true,
    showTaxAmountColumn: true,
    showFooters: true,
  },
};

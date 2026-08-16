import type { PrototypeTemplateCard } from '@/domain/prototype/types';

export const prototypeTemplateCards: PrototypeTemplateCard[] = [
  {
    id: 'approval-request',
    title: 'Approval request email',
    description:
      'Sent to the selected approver when a staff member issues a payment voucher.',
    placeholderKeys: [
      'organizationName',
      'voucherNumber',
      'approverName',
      'submitterName',
      'urgentFlag',
    ],
  },
  {
    id: 'signature-request',
    title: 'Recipient signature request',
    description:
      'Queued after finance marks a voucher as paid and needs recipient sign-off.',
    placeholderKeys: ['voucherNumber', 'payeeName', 'amount', 'paymentDate'],
  },
  {
    id: 'staff-verification',
    title: 'Staff verification notice',
    description:
      'Queued after the recipient signs so the submitter can verify before finance closes the item.',
    placeholderKeys: ['voucherNumber', 'submitterName', 'payeeName'],
  },
];

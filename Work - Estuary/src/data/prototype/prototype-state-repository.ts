import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { prototypeConfig } from '@/data/prototype/prototype-config';
import type {
  DummyUser,
  PrototypeDraft,
  PrototypeExportArtifact,
  PrototypeNotification,
  PrototypeState,
  PrototypeVoucherRecord,
} from '@/domain/prototype/types';
import { buildPaymentVoucherPdfDocument } from '@/lib/prototype/payment-voucher-pdf';
import { formatMoney, summarizeDraftTotals } from '@/lib/prototype/voucher-calculations';
import { interpolateTemplate } from '@/lib/template/interpolate-template';

const runtimeRoot = path.join(process.cwd(), 'runtime', 'prototype');
const outboxRoot = path.join(runtimeRoot, 'outbox');
const exportRoot = path.join(runtimeRoot, 'exports');
const statePath = path.join(runtimeRoot, 'state.json');

type NotificationInput = Omit<PrototypeNotification, 'id' | 'createdAt' | 'outboxPath'>;

type WorkflowMutationResult = {
  state: PrototypeState;
  notifications: PrototypeNotification[];
  exports: PrototypeExportArtifact[];
  voucher?: PrototypeVoucherRecord;
};

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function relativeTimeLabel(timestamp: string): string {
  const deltaMs = Date.now() - new Date(timestamp).getTime();
  const deltaMinutes = Math.max(1, Math.round(deltaMs / 60000));

  if (deltaMinutes < 60) {
    return `Updated ${deltaMinutes} minute${deltaMinutes === 1 ? '' : 's'} ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `Updated ${deltaHours} hour${deltaHours === 1 ? '' : 's'} ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  return `Updated ${deltaDays} day${deltaDays === 1 ? '' : 's'} ago`;
}

function buildTitle(draft: PrototypeDraft): string {
  return draft.paymentDetails || draft.lineItems[0]?.description || `Payment voucher for ${draft.payeeName}`;
}

function buildVoucherAmount(draft: PrototypeDraft): string {
  return formatMoney(summarizeDraftTotals(draft).grand);
}

function cloneDraft(draft: PrototypeDraft): PrototypeDraft {
  return structuredClone(draft);
}

function findUser(userId: string): DummyUser {
  const user = prototypeConfig.users.find((entry) => entry.id === userId);

  if (!user) {
    throw new Error(`Unknown user: ${userId}`);
  }

  return user;
}

function voucherCanBeApproved(voucher: PrototypeVoucherRecord, actorId: string): boolean {
  const actor = findUser(actorId);
  return voucher.status === 'pending_director_approval' && (voucher.approverId === actorId || actor.roles.includes('DIRECTOR'));
}

function voucherCanBePaid(voucher: PrototypeVoucherRecord, actorId: string): boolean {
  const actor = findUser(actorId);
  return voucher.status === 'approved_for_payment' && actor.roles.includes('FINANCE_ADMIN');
}

function voucherCanBeVerified(voucher: PrototypeVoucherRecord, actorId: string): boolean {
  return voucher.status === 'awaiting_staff_verification' && voucher.submitterId === actorId;
}

function createActivity(
  actorLabel: string,
  action: string,
  detail: string,
  at: string
): PrototypeVoucherRecord['activity'][number] {
  return {
    id: makeId('activity'),
    at,
    actorLabel,
    action,
    detail,
  };
}

function nextVoucherNumber(vouchers: PrototypeVoucherRecord[]): string {
  const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const sameDayCount = vouchers.filter((voucher) =>
    voucher.voucherNumber.includes(today)
  ).length;

  return `PV-${today}-${String(sameDayCount + 1).padStart(3, '0')}`;
}

function buildRecipientToken(): string {
  return `recipient-${Math.random().toString(36).slice(2, 12)}`;
}

function getFinanceUsers(): DummyUser[] {
  return prototypeConfig.users.filter((user) => user.roles.includes('FINANCE_ADMIN'));
}

function buildApprovalEmail(voucher: PrototypeVoucherRecord): NotificationInput {
  const submitter = findUser(voucher.submitterId);
  const approver = findUser(voucher.approverId);
  const amount = buildVoucherAmount(voucher.draft);
  const paymentDetails = voucher.draft.paymentDetails;

  return {
    voucherId: voucher.id,
    kind: 'approval_request',
    toLabel: approver.name,
    toEmail: approver.email,
    actionPath: `/payment-vouchers/${voucher.id}?user=${approver.id}`,
    subject: interpolateTemplate(prototypeConfig.emailTemplate.subject, {
      organizationName: voucher.draft.organizationName,
      voucherNumber: voucher.voucherNumber,
      approvalStageLabel: 'director',
      submitterName: submitter.name,
      approverName: approver.name,
      payeeName: voucher.payeeName,
      amount,
      amountInWords: voucher.draft.amountInWords,
      paymentDetails,
      urgentFlag: voucher.urgent ? 'Yes' : 'No',
    }),
    body: interpolateTemplate(prototypeConfig.emailTemplate.body, {
      organizationName: voucher.draft.organizationName,
      voucherNumber: voucher.voucherNumber,
      approvalStageLabel: 'director',
      submitterName: submitter.name,
      approverName: approver.name,
      payeeName: voucher.payeeName,
      amount,
      amountInWords: voucher.draft.amountInWords,
      paymentDetails,
      urgentFlag: voucher.urgent ? 'Yes' : 'No',
    }),
  };
}

function buildFinanceReadyEmails(voucher: PrototypeVoucherRecord): NotificationInput[] {
  return getFinanceUsers().map((user) => ({
    voucherId: voucher.id,
    kind: 'finance_ready',
    toLabel: user.name,
    toEmail: user.email,
    actionPath: `/payment-vouchers/${voucher.id}?user=${user.id}`,
    subject: `[Estuary] ${voucher.voucherNumber} is approved and ready for payment`,
    body:
      `${voucher.voucherNumber} for ${voucher.amount} has director approval and is ready for finance processing.\n\n` +
      `Payee: ${voucher.payeeName}\n` +
      `Open: /payment-vouchers/${voucher.id}?user=${user.id}`,
  }));
}

function buildRecipientSignatureEmail(voucher: PrototypeVoucherRecord): NotificationInput {
  return {
    voucherId: voucher.id,
    kind: 'recipient_signature_request',
    toLabel: voucher.recipientSignature.recipientName,
    toEmail: voucher.recipientSignature.recipientEmail,
    actionPath: `/recipient/${voucher.recipientSignature.token}`,
    subject: `[Estuary] Please sign ${voucher.voucherNumber}`,
    body:
      `Hello ${voucher.recipientSignature.recipientName},\n\n` +
      `${voucher.voucherNumber} has been paid and now needs your signature.\n\n` +
      `Amount: ${voucher.amount}\n` +
      `Payment date: ${voucher.financeProcessing?.paidAt ?? 'Pending'}\n` +
      `Open: /recipient/${voucher.recipientSignature.token}`,
  };
}

function buildStaffVerificationEmail(voucher: PrototypeVoucherRecord): NotificationInput {
  const submitter = findUser(voucher.submitterId);
  return {
    voucherId: voucher.id,
    kind: 'staff_verification_request',
    toLabel: submitter.name,
    toEmail: submitter.email,
    actionPath: `/payment-vouchers/${voucher.id}?user=${submitter.id}`,
    subject: `[Estuary] Recipient signed ${voucher.voucherNumber}`,
    body:
      `${voucher.payeeName} has signed ${voucher.voucherNumber}.\n\n` +
      `Please verify the signed voucher and hand the completed item back to finance.\n\n` +
      `Open: /payment-vouchers/${voucher.id}?user=${submitter.id}`,
  };
}

function buildFinanceCompletionEmails(voucher: PrototypeVoucherRecord): NotificationInput[] {
  return getFinanceUsers().map((user) => ({
    voucherId: voucher.id,
    kind: 'finance_completion_notice',
    toLabel: user.name,
    toEmail: user.email,
    actionPath: `/payment-vouchers/${voucher.id}?user=${user.id}`,
    subject: `[Estuary] ${voucher.voucherNumber} verified and complete`,
    body:
      `${voucher.voucherNumber} has been verified by staff and is ready for finance close-out.\n\n` +
      `Receipt link: ${voucher.financeProcessing?.receiptLink ?? 'Not provided'}\n` +
      `Open: /payment-vouchers/${voucher.id}?user=${user.id}`,
  }));
}

async function ensureRuntime(): Promise<void> {
  await mkdir(runtimeRoot, { recursive: true });
  await mkdir(outboxRoot, { recursive: true });
  await mkdir(exportRoot, { recursive: true });
}

async function writeState(state: PrototypeState): Promise<void> {
  await ensureRuntime();
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
}

async function writeQueuedNotifications(
  queuedNotifications: PrototypeNotification[]
): Promise<void> {
  await Promise.all(
    queuedNotifications.map((notification) =>
      writeFile(notification.outboxPath, JSON.stringify(notification, null, 2), 'utf8')
    )
  );
}

function withQueuedNotification(
  notification: NotificationInput,
  createdAt: string
): PrototypeNotification {
  const safeVoucherId = notification.voucherId.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${createdAt.slice(0, 19).replaceAll(':', '-')}_${notification.kind}_${safeVoucherId}.json`;
  return {
    ...notification,
    id: makeId('mail'),
    createdAt,
    outboxPath: path.join(outboxRoot, fileName),
  };
}

function seedVoucher(
  draftOverride: Partial<PrototypeDraft>,
  override: Partial<PrototypeVoucherRecord>
): PrototypeVoucherRecord {
  const createdAt = override.createdAt ?? nowIso();
  const baseDraft = cloneDraft(prototypeConfig.prototypeDraft);
  const draft = {
    ...baseDraft,
    ...draftOverride,
    lineItems: draftOverride.lineItems ?? baseDraft.lineItems,
  };

  const voucher: PrototypeVoucherRecord = {
    id: override.id ?? makeId('voucher'),
    voucherNumber: override.voucherNumber ?? draft.voucherNumber,
    title: override.title ?? buildTitle(draft),
    submitterId: override.submitterId ?? draft.currentUserId,
    approverId: override.approverId ?? draft.approverId,
    amount: override.amount ?? buildVoucherAmount(draft),
    status: override.status ?? 'pending_director_approval',
    urgent: override.urgent ?? draft.urgentBypass,
    projectCode: override.projectCode ?? draft.projectCode,
    glCode: override.glCode ?? draft.glCode,
    lastUpdatedLabel: override.lastUpdatedLabel ?? relativeTimeLabel(createdAt),
    payeeName: override.payeeName ?? draft.payeeName,
    payeeEmail: override.payeeEmail ?? draft.payeeEmail,
    paymentReference: override.paymentReference,
    createdAt,
    updatedAt: override.updatedAt ?? createdAt,
    draft,
    directorApproval: override.directorApproval,
    financeProcessing: override.financeProcessing,
    recipientSignature: override.recipientSignature ?? {
      recipientName: draft.payeeName,
      recipientEmail: draft.payeeEmail,
      token: buildRecipientToken(),
    },
    staffVerification: override.staffVerification,
    activity:
      override.activity ?? [
        createActivity(findUser(draft.currentUserId).name, 'Issued voucher', buildTitle(draft), createdAt),
      ],
    lastExportPath: override.lastExportPath,
  };

  return voucher;
}

function createSeedState(): PrototypeState {
  const approvedAt = new Date(Date.now() - 1000 * 60 * 90).toISOString();
  const paidAt = new Date(Date.now() - 1000 * 60 * 45).toISOString().slice(0, 10);
  const signedAt = new Date(Date.now() - 1000 * 60 * 20).toISOString();

  return {
    vouchers: [
      seedVoucher(
        {
          voucherNumber: 'PV-20260415-001',
          paymentDetails: 'Transport allowance claim for Alma literacy workshop.',
        },
        {}
      ),
      seedVoucher(
        {
          voucherNumber: 'PV-20260415-002',
          payeeName: 'Anis Fatin',
          payeeEmail: 'anis.fatin@example.com',
          currentUserId: 'usr-maryam',
          approverId: 'usr-aisha',
          urgentBypass: true,
          paymentDetails: 'Workshop materials reimbursement for urgent school event.',
        },
        {
          status: 'approved_for_payment',
          urgent: true,
          directorApproval: {
            approverUserId: 'usr-aisha',
            approverName: 'Aisha Noor',
            signatureText: 'Aisha Noor',
            approvedAt,
            note: 'Urgent bypass approved.',
          },
          updatedAt: approvedAt,
          lastUpdatedLabel: relativeTimeLabel(approvedAt),
        }
      ),
      seedVoucher(
        {
          voucherNumber: 'PV-20260415-003',
          payeeName: 'Dr. Shafinaz',
          payeeEmail: 'shafinaz@example.com',
          currentUserId: 'usr-sarah',
          approverId: 'usr-jasmin',
          paymentDetails: 'Honorarium for curriculum advisor.',
        },
        {
          status: 'awaiting_signature',
          directorApproval: {
            approverUserId: 'usr-jasmin',
            approverName: 'Jasmin Teh',
            signatureText: 'Jasmin Teh',
            approvedAt,
            note: 'Approved for payment.',
          },
          financeProcessing: {
            processedByUserId: 'usr-sarah',
            processedByName: 'Sarah Lim',
            paidAt,
            paymentReference: 'MBB-442901',
            receiptLink: 'https://local.example/receipt/MBB-442901',
            note: 'Transferred via Maybank.',
          },
          updatedAt: approvedAt,
          lastUpdatedLabel: relativeTimeLabel(approvedAt),
        }
      ),
      seedVoucher(
        {
          voucherNumber: 'PV-20260415-004',
          payeeName: 'Metro Transit Services',
          payeeEmail: 'accounts@metro.example.com',
          currentUserId: 'usr-afiq',
          approverId: 'usr-farid',
          paymentDetails: 'School transport vendor payout.',
        },
        {
          status: 'awaiting_staff_verification',
          directorApproval: {
            approverUserId: 'usr-farid',
            approverName: 'Farid Hakim',
            signatureText: 'Farid Hakim',
            approvedAt,
            note: 'Approved.',
          },
          financeProcessing: {
            processedByUserId: 'usr-sarah',
            processedByName: 'Sarah Lim',
            paidAt,
            paymentReference: 'MBB-438012',
            receiptLink: 'https://local.example/receipt/MBB-438012',
            note: 'Receipt attached in finance folder.',
          },
          recipientSignature: {
            recipientName: 'Metro Transit Services',
            recipientEmail: 'accounts@metro.example.com',
            token: buildRecipientToken(),
            signatureText: 'Metro Transit Services',
            signedAt,
            note: 'Signed digitally.',
          },
          updatedAt: signedAt,
          lastUpdatedLabel: relativeTimeLabel(signedAt),
        }
      ),
    ],
    notifications: [],
    exports: [],
  };
}

export async function getPrototypeState(): Promise<PrototypeState> {
  await ensureRuntime();

  try {
    const raw = await readFile(statePath, 'utf8');
    return JSON.parse(raw) as PrototypeState;
  } catch {
    const seeded = createSeedState();
    await writeState(seeded);
    return seeded;
  }
}

async function commitMutation(
  nextState: PrototypeState,
  queuedNotifications: PrototypeNotification[] = [],
  createdExports: PrototypeExportArtifact[] = []
): Promise<WorkflowMutationResult> {
  await writeState(nextState);
  if (queuedNotifications.length > 0) {
    await writeQueuedNotifications(queuedNotifications);
  }

  return {
    state: nextState,
    notifications: queuedNotifications,
    exports: createdExports,
  };
}

export async function issueVoucher(
  draft: PrototypeDraft,
  actorId: string
): Promise<WorkflowMutationResult> {
  const state = await getPrototypeState();
  const submitter = findUser(actorId);
  const createdAt = nowIso();
  const voucherNumber = nextVoucherNumber(state.vouchers);
  const nextDraft = {
    ...cloneDraft(draft),
    voucherNumber,
    currentUserId: actorId,
  };
  const voucher = seedVoucher(nextDraft, {
    id: makeId('voucher'),
    voucherNumber,
    submitterId: actorId,
    approverId: nextDraft.approverId,
    title: buildTitle(nextDraft),
    status: 'pending_director_approval',
    payeeEmail: nextDraft.payeeEmail,
    createdAt,
    updatedAt: createdAt,
    lastUpdatedLabel: relativeTimeLabel(createdAt),
    activity: [
      createActivity(submitter.name, 'Issued voucher', buildTitle(nextDraft), createdAt),
    ],
  });
  const queuedNotifications = [withQueuedNotification(buildApprovalEmail(voucher), createdAt)];
  const nextState = {
    ...state,
    vouchers: [voucher, ...state.vouchers],
    notifications: [...queuedNotifications, ...state.notifications],
  };

  const result = await commitMutation(nextState, queuedNotifications);
  return { ...result, voucher };
}

export async function approveVoucher(
  voucherId: string,
  actorId: string,
  signatureText: string,
  note: string
): Promise<WorkflowMutationResult> {
  const state = await getPrototypeState();
  const actor = findUser(actorId);
  const approvedAt = nowIso();
  let targetVoucher: PrototypeVoucherRecord | undefined;

  const vouchers = state.vouchers.map((voucher) => {
    if (voucher.id !== voucherId) {
      return voucher;
    }

    if (!voucherCanBeApproved(voucher, actorId)) {
      throw new Error('This voucher cannot be approved by the current user.');
    }

    targetVoucher = {
      ...voucher,
      status: 'approved_for_payment',
      updatedAt: approvedAt,
      lastUpdatedLabel: relativeTimeLabel(approvedAt),
      directorApproval: {
        approverUserId: actorId,
        approverName: actor.name,
        signatureText,
        approvedAt,
        note,
      },
      activity: [
        createActivity(actor.name, 'Approved voucher', note || 'Director approval recorded.', approvedAt),
        ...voucher.activity,
      ],
    };

    return targetVoucher;
  });

  if (!targetVoucher) {
    throw new Error('Voucher not found.');
  }

  const queuedNotifications = buildFinanceReadyEmails(targetVoucher).map((notification) =>
    withQueuedNotification(notification, approvedAt)
  );
  const nextState = {
    ...state,
    vouchers,
    notifications: [...queuedNotifications, ...state.notifications],
  };

  const result = await commitMutation(nextState, queuedNotifications);
  return { ...result, voucher: targetVoucher };
}

export async function markVoucherPaid(
  voucherId: string,
  actorId: string,
  paidAt: string,
  paymentReference: string,
  receiptLink: string,
  note: string
): Promise<WorkflowMutationResult> {
  const state = await getPrototypeState();
  const actor = findUser(actorId);
  const updatedAt = nowIso();
  let targetVoucher: PrototypeVoucherRecord | undefined;

  const vouchers = state.vouchers.map((voucher) => {
    if (voucher.id !== voucherId) {
      return voucher;
    }

    if (!voucherCanBePaid(voucher, actorId)) {
      throw new Error('This voucher cannot be marked as paid by the current user.');
    }

    targetVoucher = {
      ...voucher,
      status: 'awaiting_signature',
      paymentReference,
      updatedAt,
      lastUpdatedLabel: `Paid on ${paidAt}`,
      financeProcessing: {
        processedByUserId: actorId,
        processedByName: actor.name,
        paidAt,
        paymentReference,
        receiptLink,
        note,
      },
      activity: [
        createActivity(actor.name, 'Marked paid', `${paymentReference} ${receiptLink}`.trim(), updatedAt),
        ...voucher.activity,
      ],
    };

    return targetVoucher;
  });

  if (!targetVoucher) {
    throw new Error('Voucher not found.');
  }

  const queuedNotifications = [
    withQueuedNotification(buildRecipientSignatureEmail(targetVoucher), updatedAt),
  ];
  const nextState = {
    ...state,
    vouchers,
    notifications: [...queuedNotifications, ...state.notifications],
  };

  const result = await commitMutation(nextState, queuedNotifications);
  return { ...result, voucher: targetVoucher };
}

export async function signVoucherByRecipient(
  token: string,
  recipientName: string,
  signatureText: string,
  note: string
): Promise<WorkflowMutationResult> {
  const state = await getPrototypeState();
  const signedAt = nowIso();
  let targetVoucher: PrototypeVoucherRecord | undefined;

  const vouchers = state.vouchers.map((voucher) => {
    if (voucher.recipientSignature.token !== token) {
      return voucher;
    }

    targetVoucher = {
      ...voucher,
      status: 'awaiting_staff_verification',
      updatedAt: signedAt,
      lastUpdatedLabel: relativeTimeLabel(signedAt),
      recipientSignature: {
        ...voucher.recipientSignature,
        recipientName,
        signatureText,
        signedAt,
        note,
      },
      activity: [
        createActivity(recipientName, 'Signed voucher', note || 'Recipient signature captured.', signedAt),
        ...voucher.activity,
      ],
    };

    return targetVoucher;
  });

  if (!targetVoucher) {
    throw new Error('Recipient link is invalid.');
  }

  const queuedNotifications = [
    withQueuedNotification(buildStaffVerificationEmail(targetVoucher), signedAt),
  ];
  const nextState = {
    ...state,
    vouchers,
    notifications: [...queuedNotifications, ...state.notifications],
  };

  const result = await commitMutation(nextState, queuedNotifications);
  return { ...result, voucher: targetVoucher };
}

export async function verifyVoucher(
  voucherId: string,
  actorId: string,
  note: string
): Promise<WorkflowMutationResult> {
  const state = await getPrototypeState();
  const actor = findUser(actorId);
  const verifiedAt = nowIso();
  let targetVoucher: PrototypeVoucherRecord | undefined;

  const vouchers = state.vouchers.map((voucher) => {
    if (voucher.id !== voucherId) {
      return voucher;
    }

    if (!voucherCanBeVerified(voucher, actorId)) {
      throw new Error('This voucher cannot be verified by the current user.');
    }

    targetVoucher = {
      ...voucher,
      status: 'completed',
      updatedAt: verifiedAt,
      lastUpdatedLabel: 'Completed and verified',
      staffVerification: {
        verifiedByUserId: actorId,
        verifiedByName: actor.name,
        verifiedAt,
        note,
      },
      activity: [
        createActivity(actor.name, 'Verified signed voucher', note || 'Staff verification recorded.', verifiedAt),
        ...voucher.activity,
      ],
    };

    return targetVoucher;
  });

  if (!targetVoucher) {
    throw new Error('Voucher not found.');
  }

  const queuedNotifications = buildFinanceCompletionEmails(targetVoucher).map((notification) =>
    withQueuedNotification(notification, verifiedAt)
  );
  const nextState = {
    ...state,
    vouchers,
    notifications: [...queuedNotifications, ...state.notifications],
  };

  const result = await commitMutation(nextState, queuedNotifications);
  return { ...result, voucher: targetVoucher };
}

function voucherCanBeExported(voucher: PrototypeVoucherRecord): boolean {
  return [
    'awaiting_signature',
    'awaiting_staff_verification',
    'completed',
  ].includes(voucher.status);
}

async function createExportArtifact(
  voucherIds: string[],
  createdByUserId: string,
  filePath: string,
  kind: 'single' | 'batch'
): Promise<PrototypeExportArtifact> {
  return {
    id: makeId('export'),
    createdAt: nowIso(),
    createdByUserId,
    voucherIds,
    filePath,
    kind,
  };
}

async function renderVoucherPdfToFile(
  voucher: PrototypeVoucherRecord,
  targetPath: string
): Promise<void> {
  const pdfBytes = await buildPaymentVoucherPdfDocument({
    draft: voucher.draft,
    approverName: voucher.directorApproval?.approverName,
    directorSignatureText: voucher.directorApproval?.signatureText,
    approvalDate: voucher.directorApproval?.approvedAt?.slice(0, 10),
    paymentDate: voucher.financeProcessing?.paidAt,
    paymentReference: voucher.financeProcessing?.paymentReference,
    receiptLink: voucher.financeProcessing?.receiptLink,
    recipientSignatureText: voucher.recipientSignature.signatureText,
    recipientSignedAt: voucher.recipientSignature.signedAt,
    verificationLabel: voucher.staffVerification
      ? `Verified by ${voucher.staffVerification.verifiedByName} on ${voucher.staffVerification.verifiedAt.slice(0, 10)}`
      : undefined,
  });

  await writeFile(targetPath, Buffer.from(pdfBytes));
}

export async function exportVoucherToLocalFolder(
  voucherId: string,
  actorId: string
): Promise<WorkflowMutationResult> {
  const state = await getPrototypeState();
  const actor = findUser(actorId);
  const voucher = state.vouchers.find((entry) => entry.id === voucherId);

  if (!voucher) {
    throw new Error('Voucher not found.');
  }

  if (!voucherCanBeExported(voucher)) {
    throw new Error('This voucher is not ready for export yet.');
  }

  await ensureRuntime();
  const targetPath = path.join(exportRoot, `${voucher.voucherNumber}.pdf`);
  await renderVoucherPdfToFile(voucher, targetPath);
  const artifact = await createExportArtifact([voucher.id], actor.id, targetPath, 'single');

  const vouchers = state.vouchers.map((entry) =>
    entry.id === voucherId
      ? {
          ...entry,
          lastExportPath: targetPath,
          updatedAt: nowIso(),
          lastUpdatedLabel: `Exported to ${targetPath}`,
          activity: [
            createActivity(actor.name, 'Exported voucher PDF', targetPath, nowIso()),
            ...entry.activity,
          ],
        }
      : entry
  );
  const nextState = {
    ...state,
    vouchers,
    exports: [artifact, ...state.exports],
  };

  const result = await commitMutation(nextState, [], [artifact]);
  return { ...result, voucher: vouchers.find((entry) => entry.id === voucherId) };
}

export async function exportVoucherBatchToLocalFolder(
  voucherIds: string[],
  actorId: string
): Promise<WorkflowMutationResult> {
  const state = await getPrototypeState();
  const actor = findUser(actorId);
  const createdAt = nowIso().replaceAll(':', '-');
  const batchDir = path.join(exportRoot, `batch-${createdAt}`);
  await mkdir(batchDir, { recursive: true });

  const targetVouchers = state.vouchers.filter((voucher) => voucherIds.includes(voucher.id));
  const exportableVouchers = targetVouchers.filter(voucherCanBeExported);

  if (exportableVouchers.length === 0) {
    throw new Error('No eligible vouchers selected for batch export.');
  }

  await Promise.all(
    exportableVouchers.map((voucher) =>
      renderVoucherPdfToFile(
        voucher,
        path.join(batchDir, `${voucher.voucherNumber}.pdf`)
      )
    )
  );

  const artifact = await createExportArtifact(
    exportableVouchers.map((voucher) => voucher.id),
    actor.id,
    batchDir,
    'batch'
  );

  const vouchers = state.vouchers.map((voucher) =>
    exportableVouchers.some((entry) => entry.id === voucher.id)
      ? {
          ...voucher,
          lastExportPath: batchDir,
          updatedAt: nowIso(),
          lastUpdatedLabel: `Batch exported to ${batchDir}`,
          activity: [
            createActivity(actor.name, 'Batch exported voucher PDF', batchDir, nowIso()),
            ...voucher.activity,
          ],
        }
      : voucher
  );

  const nextState = {
    ...state,
    vouchers,
    exports: [artifact, ...state.exports],
  };

  return commitMutation(nextState, [], [artifact]);
}

export async function savePrototypeState(state: PrototypeState): Promise<void> {
  await writeState(state);
}

export async function getVoucherByRecipientToken(
  token: string
): Promise<PrototypeVoucherRecord | undefined> {
  const state = await getPrototypeState();
  return state.vouchers.find((voucher) => voucher.recipientSignature.token === token);
}

export async function getVoucherById(
  voucherId: string
): Promise<PrototypeVoucherRecord | undefined> {
  const state = await getPrototypeState();
  return state.vouchers.find((voucher) => voucher.id === voucherId);
}

/* eslint-disable camelcase -- Prisma fields mirror the existing snake_case database schema. */
import {
  createHash,
  randomBytes,
} from 'node:crypto';

import {
  ActorType,
  PaymentMode,
  PaymentType,
  Prisma,
  StateGroup,
} from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

import type {
  CreatePaymentVoucherInput,
  PaymentVoucherLineInput,
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

const paymentVoucherInclude = {
  pv_detail: true,
  lines: {
    include: {
      gl_account: true,
      project: true,
    },
    orderBy: {
      line_number: 'asc' as const,
    },
  },
  transitions: {
    orderBy: {
      created_at: 'asc' as const,
    },
  },
  approval_steps: {
    include: {
      decision: true,
    },
    orderBy: {
      step_number: 'asc' as const,
    },
  },
  evidence: {
    include: {
      document: true,
    },
    orderBy: {
      created_at: 'asc' as const,
    },
  },
  external_tokens: {
    orderBy: {
      created_at: 'desc' as const,
    },
  },
} satisfies Prisma.SubmissionInclude;

type StoredPaymentVoucher = Prisma.SubmissionGetPayload<{
  include: typeof paymentVoucherInclude;
}>;

type PaymentVoucherSnapshot = {
  division?: string;
  directorId?: string;
  projectManagerId?: string;
  pvDate?: string;
  recipientReference?: string;
  recipientIsMalaysian?: boolean;
  lines?: PaymentVoucherLineInput[];
};

export type FinancePaymentInformationInput = {
  financeId: string;
  paymentDate: string;
  paymentReference: string;
  paymentRemarks?: string;
  paymentProofFileName?: string;
};

export type IssuedRecipientLink = {
  voucher: PaymentVoucherRecord;
  token: string;
  expiresAt: string;
};

export type RecipientDigitalSignatureInput = {
  signatureFileName: string;
  signatureDataUrl: string;
  confirmedPaymentReceived: boolean;
  requestIp?: string;
  requestUserAgent?: string;
};

export type ManualSignedPaymentVoucherInput = {
  fileName: string;
  dataUrl: string;
  confirmedPaymentReceived: boolean;
  requestIp?: string;
  requestUserAgent?: string;
};

function normalizeProjectManagerId(projectManagerId?: string) {
  /*
   * Early beta vouchers used a role-like placeholder instead of the
   * seeded Manager account ID. Keep those records available while new
   * vouchers store the correct Manager user ID.
   */
  return projectManagerId === 'operations-manager'
    ? 'nadia-hassan'
    : projectManagerId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSnapshot(voucher: StoredPaymentVoucher): PaymentVoucherSnapshot {
  const snapshotTransition = [...voucher.transitions]
    .reverse()
    .find((transition) => {
      if (
        transition.action_code !== 'CREATE' &&
        transition.action_code !== 'RESUBMIT'
      ) {
        return false;
      }

      const metadata = transition.metadata_json;
      return isRecord(metadata) && isRecord(metadata.snapshot);
    });
  const metadata = snapshotTransition?.metadata_json;

  if (!isRecord(metadata) || !isRecord(metadata.snapshot)) {
    return {};
  }

  return metadata.snapshot as PaymentVoucherSnapshot;
}

function toPaymentMode(value: string): PaymentMode {
  const normalized = value.trim().toUpperCase().replaceAll(/[-\s]+/g, '_');

  if (normalized === 'CASH') return PaymentMode.CASH;
  if (normalized === 'CHEQUE') return PaymentMode.CHEQUE;
  if (normalized === 'IBG') return PaymentMode.IBG;
  if (normalized === 'DUITNOW') return PaymentMode.DUITNOW;
  return PaymentMode.BANK_TRANSFER;
}

function fromPaymentMode(value: PaymentMode): string {
  const labels: Record<PaymentMode, string> = {
    BANK_TRANSFER: 'Bank Transfer',
    CASH: 'Cash',
    CHEQUE: 'Cheque',
    IBG: 'IBG',
    DUITNOW: 'DuitNow',
  };

  return labels[value];
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function hashRecipientToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function findTransition(
  voucher: StoredPaymentVoucher,
  actionCode: string,
) {
  return [...voucher.transitions]
    .reverse()
    .find((transition) => transition.action_code === actionCode);
}

function documentFor(voucher: StoredPaymentVoucher, evidenceType: string) {
  return [...voucher.evidence]
    .reverse()
    .find((entry) => entry.evidence_type_code === evidenceType)?.document;
}

export function mapStoredPaymentVoucher(
  voucher: StoredPaymentVoucher,
): PaymentVoucherRecord {
  if (!voucher.pv_detail) {
    throw new Error(`Submission ${voucher.id} has no Payment Voucher detail.`);
  }

  const detail = voucher.pv_detail;
  const snapshot = readSnapshot(voucher);
  const directorStep = [...voucher.approval_steps].reverse().find(
    (step) => step.required_role === 'DIRECTOR',
  );
  const approvedTransition = findTransition(voucher, 'APPROVE');
  const rejectedTransition = findTransition(voucher, 'REJECT');
  const financeStartedTransition =
    findTransition(voucher, 'START_FINANCE_REVIEW') ??
    findTransition(voucher, 'START_FINANCE_PROCESSING');
  const generatedPdfTransition = findTransition(voucher, 'RECORD_PAYMENT');
  const financeTransition =
    findTransition(voucher, 'SAVE_PAYMENT_INFORMATION') ??
    generatedPdfTransition;
  const completedTransition = findTransition(voucher, 'COMPLETE');
  const inactiveTransition = findTransition(voucher, 'MARK_INACTIVE');
  const staffConfirmationTransition = findTransition(
    voucher,
    'CONFIRM_SIGNED_PV',
  );
  const recipientLinkTransition = findTransition(
    voucher,
    'ISSUE_RECIPIENT_LINK',
  );
  const recipientSignatureTransition = findTransition(
    voucher,
    'COLLECT_SIGNATURE',
  );
  const staffManualUploadTransition = findTransition(
    voucher,
    'UPLOAD_MANUAL_SIGNED_PV',
  );
  const signedVoucherTransition =
    recipientSignatureTransition && staffManualUploadTransition
      ? recipientSignatureTransition.created_at >=
        staffManualUploadTransition.created_at
        ? recipientSignatureTransition
        : staffManualUploadTransition
      : recipientSignatureTransition ?? staffManualUploadTransition;
  const latestRecipientToken = voucher.external_tokens.find(
    (token) => token.token_type === 'SIGNATURE_REQUEST',
  );
  const generatedPdf = documentFor(voucher, 'GENERATED_PDF');
  const signedPdf = documentFor(voucher, 'SIGNED_DOCUMENT');
  const paymentProof = documentFor(voucher, 'PAYMENT_PROOF');
  const approvedMetadata = approvedTransition?.metadata_json;
  const financeMetadata = financeTransition?.metadata_json;
  const generatedPdfMetadata = generatedPdfTransition?.metadata_json;
  const recipientSignatureMetadata = signedVoucherTransition?.metadata_json;
  const directorSignatureKey =
    isRecord(approvedMetadata) &&
    typeof approvedMetadata.signatureKey === 'string'
      ? approvedMetadata.signatureKey
      : undefined;
  const paymentRemarks =
    isRecord(financeMetadata) &&
    typeof financeMetadata.paymentRemarks === 'string'
      ? financeMetadata.paymentRemarks
      : undefined;
  const pendingPaymentProofFileName =
    isRecord(financeMetadata) &&
    typeof financeMetadata.paymentProofFileName === 'string'
      ? financeMetadata.paymentProofFileName
      : undefined;
  const generatedPdfFileName =
    isRecord(generatedPdfMetadata) &&
    typeof generatedPdfMetadata.generatedPdfFileName === 'string'
      ? generatedPdfMetadata.generatedPdfFileName
      : undefined;

  const storedLines = snapshot.lines?.length
    ? snapshot.lines
    : voucher.lines.map((line) => ({
        accountCode: line.gl_account?.code ?? '',
        description: line.description ?? '',
        quantity: 1,
        unitAmount: Number(line.amount),
        taxAmount: 0,
      }));

  return {
    id: voucher.id,
    organizationId: voucher.organization_id,
    voucherNumber: voucher.submission_number ?? voucher.id,
    status: voucher.current_state_code as PaymentVoucherRecord['status'],
    submitterId: voucher.submitted_by_id,
    directorId:
      directorStep?.assigned_user_id ?? snapshot.directorId ?? '',
    projectManagerId: normalizeProjectManagerId(
      snapshot.projectManagerId,
    ),
    projectManagerViewedAt:
      findTransition(voucher, 'MANAGER_PREVIEW')?.created_at.toISOString(),
    pvDate: snapshot.pvDate ?? toDateOnly(voucher.created_at),
    division: snapshot.division ?? '',
    recipientName: detail.recipient_name,
    recipientEmail: detail.recipient_email,
    recipientReference:
      snapshot.recipientReference ?? `REC-${voucher.id.slice(-12).toUpperCase()}`,
    recipientIc: detail.recipient_ic ?? undefined,
    recipientIsMalaysian: snapshot.recipientIsMalaysian ?? true,
    paymentMethod: fromPaymentMode(detail.payment_mode),
    bankName: detail.recipient_bank_name ?? undefined,
    bankAccountNumber: detail.recipient_bank_account ?? undefined,
    purpose: detail.being_text ?? voucher.description ?? '',
    lines: storedLines,
    amount: Number(voucher.total_amount),
    rejectionRemarks: rejectedTransition?.reason_text ?? undefined,
    directorSignatureKey,
    directorApprovedAt: approvedTransition?.created_at.toISOString(),
    financeReviewedAt:
      financeStartedTransition?.created_at.toISOString(),
    paymentDate: detail.paid_at ? toDateOnly(detail.paid_at) : undefined,
    paymentReference: detail.paid_reference ?? undefined,
    paymentProofFileName:
      paymentProof?.original_file_name ?? pendingPaymentProofFileName,
    paymentProofUploadedAt: paymentProof?.created_at.toISOString(),
    paymentRemarks,
    paymentMadeById: financeTransition?.actor_user_id ?? undefined,
    pvPdfFileName:
      generatedPdf?.original_file_name ?? generatedPdfFileName,
    pvPdfGeneratedAt:
      generatedPdf?.created_at.toISOString() ??
      generatedPdfTransition?.created_at.toISOString(),
    recipientAccessExpiresAt:
      latestRecipientToken?.expires_at.toISOString(),
    recipientLinkSentAt:
      recipientLinkTransition?.created_at.toISOString(),
    recipientLinkSentById:
      recipientLinkTransition?.actor_user_id ?? undefined,
    recipientLinkSendCount: voucher.transitions.filter(
      (transition) => transition.action_code === 'ISSUE_RECIPIENT_LINK',
    ).length,
    recipientSignatureMethod:
      detail.signature_method === 'UPLOAD'
        ? 'MANUAL'
        : detail.signature_method === 'DIGITAL'
          ? 'DIGITAL'
          : undefined,
    recipientSignedAt: detail.signature_collected_at?.toISOString(),
    recipientConfirmedAt: detail.signature_collected_at
      ? signedVoucherTransition?.created_at.toISOString()
      : undefined,
    recipientSignatureDataUrl:
      detail.signature_collected_at &&
      isRecord(recipientSignatureMetadata) &&
      typeof recipientSignatureMetadata.signatureDataUrl === 'string'
        ? recipientSignatureMetadata.signatureDataUrl
        : undefined,
    signedPvFileName:
      detail.signature_method === 'DIGITAL' && detail.signature_collected_at
        ? `${voucher.submission_number ?? voucher.id}-signed.pdf`
        : detail.signature_collected_at &&
      isRecord(recipientSignatureMetadata) &&
      typeof recipientSignatureMetadata.signedPvFileName === 'string'
        ? recipientSignatureMetadata.signedPvFileName
        : signedPdf?.original_file_name,
    signedPvDataUrl:
      detail.signature_method === 'UPLOAD' &&
      isRecord(recipientSignatureMetadata) &&
      typeof recipientSignatureMetadata.signedPvDataUrl === 'string'
        ? recipientSignatureMetadata.signedPvDataUrl
        : undefined,
    signedPvUploadSource:
      detail.signature_method === 'UPLOAD' &&
      isRecord(recipientSignatureMetadata) &&
      (recipientSignatureMetadata.uploadSource === 'RECIPIENT' ||
        recipientSignatureMetadata.uploadSource === 'STAFF')
        ? recipientSignatureMetadata.uploadSource
        : detail.signature_method === 'DIGITAL'
          ? 'RECIPIENT'
          : undefined,
    signedPvUploadedAt:
      signedPdf?.created_at.toISOString() ??
      (detail.signature_method === 'UPLOAD'
        ? signedVoucherTransition?.created_at.toISOString()
        : undefined),
    signedPvUploadedById:
      detail.signature_method === 'UPLOAD' &&
      isRecord(recipientSignatureMetadata) &&
      typeof recipientSignatureMetadata.uploadedById === 'string'
        ? recipientSignatureMetadata.uploadedById
        : undefined,
    staffConfirmedSignedPvAt: detail.signature_verified_at?.toISOString(),
    staffConfirmedSignedPvById:
      staffConfirmationTransition?.actor_user_id ?? undefined,
    financeVerifiedAt: completedTransition?.created_at.toISOString(),
    financeCompletedById: completedTransition?.actor_user_id ?? undefined,
    inactiveAt: inactiveTransition?.created_at.toISOString(),
    inactiveById: inactiveTransition?.actor_user_id ?? undefined,
    inactiveRemarks: inactiveTransition?.reason_text ?? undefined,
    createdAt: voucher.created_at.toISOString(),
    updatedAt: voucher.updated_at.toISOString(),
  };
}

async function nextVoucherNumber(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  date: Date,
) {
  const year = date.getUTCFullYear();

  /*
   * Payment Vouchers use one sequence for the entire year.
   * DocumentSequence requires a month value, so month 0 is reserved
   * as the yearly Payment Voucher counter and is never displayed.
   */
  const yearlySequenceMonth = 0;
  const sequence = await transaction.documentSequence.upsert({
    where: {
      organization_id_payment_type_year_month: {
        organization_id: organizationId,
        payment_type: PaymentType.PAYMENT_VOUCHER,
        year,
        month: yearlySequenceMonth,
      },
    },
    create: {
      organization_id: organizationId,
      payment_type: PaymentType.PAYMENT_VOUCHER,
      year,
      month: yearlySequenceMonth,
      prefix: 'PV',
      last_sequence: 1,
    },
    update: {
      last_sequence: {
        increment: 1,
      },
    },
  });

  return `${sequence.prefix}-${year}-${String(sequence.last_sequence).padStart(
    4,
    '0',
  )}`;
}

export async function listPaymentVouchersFromDatabase() {
  const submissions = await prisma.submission.findMany({
    where: {
      payment_type: PaymentType.PAYMENT_VOUCHER,
    },
    include: paymentVoucherInclude,
    orderBy: {
      updated_at: 'desc',
    },
  });

  return submissions.map(mapStoredPaymentVoucher);
}

export async function getPaymentVoucherFromDatabase(id: string) {
  const submission = await prisma.submission.findFirst({
    where: {
      payment_type: PaymentType.PAYMENT_VOUCHER,
      OR: [{ id }, { submission_number: id }],
    },
    include: paymentVoucherInclude,
  });

  return submission ? mapStoredPaymentVoucher(submission) : null;
}

export async function createPaymentVoucherInDatabase(
  input: CreatePaymentVoucherInput,
  submitForApproval = true,
) {
  const totalAmount = input.lines.reduce(
    (total, line) =>
      total + line.quantity * line.unitAmount + line.taxAmount,
    0,
  );

  if (totalAmount <= 0) {
    throw new Error('Payment Voucher total must be greater than RM 0.00.');
  }

  const now = new Date();
  const initialState = submitForApproval
    ? 'PENDING_DIRECTOR_APPROVAL'
    : 'DRAFT';
  const recipientReference =
    input.recipientReference?.trim() ||
    `REC-${crypto.randomUUID().replaceAll('-', '').slice(0, 14).toUpperCase()}`;

  return prisma.$transaction(async (transaction) => {
    const [organization, submitter, director, workflow] = await Promise.all([
      transaction.organization.findUnique({
        where: { id: input.organizationId },
        select: { id: true },
      }),
      transaction.user.findUnique({
        where: { id: input.submitterId },
        select: { id: true },
      }),
      transaction.user.findUnique({
        where: { id: input.directorId },
        select: { id: true },
      }),
      transaction.workflowDefinition.findFirst({
        where: {
          payment_type: PaymentType.PAYMENT_VOUCHER,
          is_active: true,
        },
        orderBy: { version: 'desc' },
        select: { id: true },
      }),
    ]);

    if (!organization) throw new Error('Payment Voucher organization was not found.');
    if (!submitter) throw new Error('The Payment Voucher submitter was not found in PostgreSQL.');
    if (!director) throw new Error('The assigned Director was not found in PostgreSQL.');

    await requirePaymentVoucherRequesterMembership(
      transaction,
      input.organizationId,
      input.submitterId,
    );

    const accountCodes = [...new Set(input.lines.map((line) => line.accountCode))];
    const accounts = await transaction.glAccount.findMany({
      where: {
        organization_id: input.organizationId,
        code: { in: accountCodes },
      },
      select: { id: true, code: true },
    });
    const accountIdByCode = new Map(
      accounts.map((account) => [account.code, account.id]),
    );
    const voucherNumber = await nextVoucherNumber(
      transaction,
      input.organizationId,
      now,
    );

    const snapshot: PaymentVoucherSnapshot = {
      division: input.division,
      directorId: input.directorId,
      projectManagerId: input.projectManagerId,
      pvDate: input.pvDate,
      recipientReference,
      recipientIsMalaysian: input.recipientIsMalaysian,
      lines: input.lines,
    };

    const submission = await transaction.submission.create({
      data: {
        organization_id: input.organizationId,
        payment_type: PaymentType.PAYMENT_VOUCHER,
        workflow_definition_id: workflow?.id,
        current_state_code: initialState,
        current_state_group: submitForApproval
          ? StateGroup.IN_REVIEW
          : StateGroup.DRAFT,
        current_assignee_id: submitForApproval ? input.directorId : null,
        submission_number: voucherNumber,
        submitted_by_id: input.submitterId,
        submitted_at: submitForApproval ? now : null,
        total_amount: new Prisma.Decimal(totalAmount.toFixed(2)),
        currency: 'MYR',
        description: input.purpose,
        pv_detail: {
          create: {
            recipient_name: input.recipientName,
            recipient_ic: input.recipientIc,
            recipient_email: input.recipientEmail,
            recipient_bank_name: input.bankName,
            recipient_bank_account: input.bankAccountNumber,
            payment_mode: toPaymentMode(input.paymentMethod),
            being_text: input.purpose,
          },
        },
        lines: {
          create: input.lines.map((line, index) => ({
            line_number: index + 1,
            description: line.description,
            amount: new Prisma.Decimal(
              (line.quantity * line.unitAmount + line.taxAmount).toFixed(2),
            ),
            gl_account_id: accountIdByCode.get(line.accountCode),
          })),
        },
        approval_steps: {
          create: {
            step_number: 1,
            required_role: 'DIRECTOR',
            assigned_user_id: input.directorId,
            status_code: submitForApproval ? 'ACTIVE' : 'PENDING',
          },
        },
        transitions: {
          create: {
            from_state_code: 'NONE',
            action_code: 'CREATE',
            to_state_code: initialState,
            actor_type: ActorType.INTERNAL_USER,
            actor_user_id: input.submitterId,
            metadata_json: {
              snapshot,
            } as Prisma.InputJsonValue,
          },
        },
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: input.organizationId,
        submission_id: submission.id,
        event_type: submitForApproval
          ? 'payment_voucher.submitted'
          : 'payment_voucher.draft_created',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.submitterId,
        payload_json: {
          voucherNumber,
          status: initialState,
          totalAmount: totalAmount.toFixed(2),
        },
      },
    });

    return mapStoredPaymentVoucher(submission);
  });
}

export async function resubmitPaymentVoucherInDatabase(
  id: string,
  input: CreatePaymentVoucherInput,
) {
  const totalAmount = input.lines.reduce(
    (total, line) =>
      total + line.quantity * line.unitAmount + line.taxAmount,
    0,
  );

  if (totalAmount <= 0) {
    throw new Error('Payment Voucher total must be greater than RM 0.00.');
  }

  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.current_state_code !== 'REJECTED') {
      throw new Error('Only a rejected Payment Voucher can be amended.');
    }

    if (voucher.submitted_by_id !== input.submitterId) {
      throw new Error('Only the person who created this Payment Voucher can amend it.');
    }

    if (voucher.organization_id !== input.organizationId) {
      throw new Error('The Payment Voucher organization cannot be changed during amendment.');
    }

    const [, director] = await Promise.all([
      requirePaymentVoucherRequesterMembership(
        transaction,
        voucher.organization_id,
        input.submitterId,
      ),
      transaction.user.findUnique({
        where: { id: input.directorId },
        select: { id: true },
      }),
    ]);

    if (!director) {
      throw new Error('The assigned Director was not found in PostgreSQL.');
    }

    await requireDirectorMembership(
      transaction,
      voucher.organization_id,
      input.directorId,
    );

    const accountCodes = [...new Set(input.lines.map((line) => line.accountCode))];
    const accounts = await transaction.glAccount.findMany({
      where: {
        organization_id: voucher.organization_id,
        code: { in: accountCodes },
      },
      select: { id: true, code: true },
    });
    const accountIdByCode = new Map(
      accounts.map((account) => [account.code, account.id]),
    );

    const missingAccountCode = accountCodes.find(
      (code) => !accountIdByCode.has(code),
    );

    if (missingAccountCode) {
      throw new Error(`GL account ${missingAccountCode} was not found for this organization.`);
    }

    const recipientReference =
      input.recipientReference?.trim() ||
      readSnapshot(voucher).recipientReference ||
      `REC-${voucher.id.slice(-12).toUpperCase()}`;
    const snapshot: PaymentVoucherSnapshot = {
      division: input.division,
      directorId: input.directorId,
      projectManagerId: input.projectManagerId,
      pvDate: input.pvDate,
      recipientReference,
      recipientIsMalaysian: input.recipientIsMalaysian,
      lines: input.lines,
    };
    const nextStepNumber =
      Math.max(0, ...voucher.approval_steps.map((step) => step.step_number)) + 1;

    await transaction.submissionLine.deleteMany({
      where: { submission_id: voucher.id },
    });

    await transaction.submissionLine.createMany({
      data: input.lines.map((line, index) => ({
        submission_id: voucher.id,
        line_number: index + 1,
        description: line.description,
        amount: new Prisma.Decimal(
          (line.quantity * line.unitAmount + line.taxAmount).toFixed(2),
        ),
        gl_account_id: accountIdByCode.get(line.accountCode),
      })),
    });

    await transaction.paymentVoucherDetail.update({
      where: { submission_id: voucher.id },
      data: {
        recipient_name: input.recipientName,
        recipient_ic: input.recipientIc || null,
        recipient_email: input.recipientEmail,
        recipient_bank_name: input.bankName || null,
        recipient_bank_account: input.bankAccountNumber || null,
        payment_mode: toPaymentMode(input.paymentMethod),
        being_text: input.purpose,
      },
    });

    await transaction.approvalStep.create({
      data: {
        submission_id: voucher.id,
        step_number: nextStepNumber,
        required_role: 'DIRECTOR',
        assigned_user_id: input.directorId,
        status_code: 'ACTIVE',
      },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'REJECTED',
        action_code: 'RESUBMIT',
        to_state_code: 'PENDING_DIRECTOR_APPROVAL',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.submitterId,
        metadata_json: {
          snapshot,
        } as Prisma.InputJsonValue,
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'PENDING_DIRECTOR_APPROVAL',
        current_state_group: StateGroup.IN_REVIEW,
        current_assignee_id: input.directorId,
        submitted_at: new Date(),
        closed_at: null,
        total_amount: new Prisma.Decimal(totalAmount.toFixed(2)),
        description: input.purpose,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.resubmitted',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.submitterId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          fromState: 'REJECTED',
          toState: 'PENDING_DIRECTOR_APPROVAL',
          totalAmount: totalAmount.toFixed(2),
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  }, {
    maxWait: 10_000,
    timeout: 15_000,
  });
}

export async function submitDraftPaymentVoucherInDatabase(
  id: string,
  staffId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.submitted_by_id !== staffId) {
      throw new Error('This draft belongs to another requester account.');
    }

    if (voucher.current_state_code !== 'DRAFT') {
      throw new Error('Only a draft Payment Voucher can be submitted.');
    }

    await requirePaymentVoucherRequesterMembership(
      transaction,
      voucher.organization_id,
      staffId,
    );

    const snapshot = readSnapshot(voucher);
    const directorId = snapshot.directorId?.trim();

    if (!directorId) {
      throw new Error('The draft has no assigned Director.');
    }

    await requireDirectorMembership(
      transaction,
      voucher.organization_id,
      directorId,
    );

    const approvalStep = voucher.approval_steps.find(
      (step) => step.required_role === 'DIRECTOR',
    );

    if (!approvalStep) {
      throw new Error('The draft has no Director approval step.');
    }

    const now = new Date();

    await transaction.approvalStep.update({
      where: { id: approvalStep.id },
      data: {
        assigned_user_id: directorId,
        status_code: 'ACTIVE',
      },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'DRAFT',
        action_code: 'SUBMIT',
        to_state_code: 'PENDING_DIRECTOR_APPROVAL',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: staffId,
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'PENDING_DIRECTOR_APPROVAL',
        current_state_group: StateGroup.IN_REVIEW,
        current_assignee_id: directorId,
        submitted_at: now,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.submitted',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: staffId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          fromState: 'DRAFT',
          toState: 'PENDING_DIRECTOR_APPROVAL',
          directorId,
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

async function requireDirectorMembership(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  directorId: string,
) {
  const membership = await transaction.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: directorId,
      is_active: true,
      membership_status: 'ACTIVE',
      roles: {
        some: {
          role: 'DIRECTOR',
        },
      },
    },
    select: {
      id: true,
      signature_url: true,
    },
  });

  if (!membership) {
    throw new Error('The approving user is not an active Director for this organization.');
  }

  return membership;
}

async function requireManagerMembership(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  managerId: string,
) {
  const membership = await transaction.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: managerId,
      is_active: true,
      membership_status: 'ACTIVE',
      roles: {
        some: {
          role: 'MANAGER',
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!membership) {
    throw new Error('The viewing user is not an active Manager for this organization.');
  }

  return membership;
}

async function requireFinanceMembership(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  financeId: string,
) {
  const membership = await transaction.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: financeId,
      is_active: true,
      membership_status: 'ACTIVE',
      roles: {
        some: {
          role: 'FINANCE_ADMIN',
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!membership) {
    throw new Error(
      'The acting user is not an active Finance Administrator for this organization.',
    );
  }

  return membership;
}

async function requireRequesterMembership(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  requesterId: string,
) {
  const membership = await transaction.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: requesterId,
      is_active: true,
      membership_status: 'ACTIVE',
    },
    select: {
      id: true,
    },
  });

  if (!membership) {
    throw new Error(
      'The original requester is not an active member of this organization.',
    );
  }

  return membership;
}

async function requirePaymentVoucherRequesterMembership(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  requesterId: string,
) {
  const membership = await transaction.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: requesterId,
      is_active: true,
      membership_status: 'ACTIVE',
      roles: {
        some: {
          role: {
            in: ['STAFF', 'MANAGER', 'FINANCE_ADMIN'],
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!membership) {
    throw new Error(
      'Only active Staff, Manager or Finance members can request a Payment Voucher.',
    );
  }

  return membership;
}

export async function markPaymentVoucherManagerViewedInDatabase(
  id: string,
  managerId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher) {
      throw new Error('Payment Voucher could not be found.');
    }

    const snapshot = readSnapshot(voucher);

    const assignedProjectManagerId = normalizeProjectManagerId(
      snapshot.projectManagerId,
    );

    if (!assignedProjectManagerId) {
      throw new Error('This Payment Voucher does not have an assigned Project Manager.');
    }

    if (assignedProjectManagerId !== managerId) {
      throw new Error('This Payment Voucher is assigned to another Project Manager.');
    }

    if (
      voucher.current_state_code === 'DRAFT' ||
      voucher.current_state_code === 'PENDING_DIRECTOR_APPROVAL' ||
      voucher.current_state_code === 'REJECTED'
    ) {
      throw new Error(
        'The Project Manager can view the voucher only after Director approval.',
      );
    }

    const alreadyViewed = voucher.transitions.some(
      (transition) =>
        transition.action_code === 'MANAGER_PREVIEW' &&
        transition.actor_user_id === managerId,
    );

    if (alreadyViewed) {
      return mapStoredPaymentVoucher(voucher);
    }

    const membership = await requireManagerMembership(
      transaction,
      voucher.organization_id,
      managerId,
    );

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: voucher.current_state_code,
        action_code: 'MANAGER_PREVIEW',
        to_state_code: voucher.current_state_code,
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: managerId,
        actor_membership_id: membership.id,
        metadata_json: {
          informational: true,
        },
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        updated_at: new Date(),
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.manager_previewed',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: managerId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          state: voucher.current_state_code,
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function startPaymentVoucherFinanceProcessingInDatabase(
  id: string,
  financeId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.current_state_code === 'FINANCE_PROCESSING') {
      return mapStoredPaymentVoucher(voucher);
    }

    if (voucher.current_state_code !== 'APPROVED_FOR_PAYMENT') {
      throw new Error(
        'Only a Director-approved Payment Voucher can enter Finance processing.',
      );
    }

    const membership = await requireFinanceMembership(
      transaction,
      voucher.organization_id,
      financeId,
    );

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'APPROVED_FOR_PAYMENT',
        action_code: 'START_FINANCE_REVIEW',
        to_state_code: 'FINANCE_PROCESSING',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        actor_membership_id: membership.id,
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'FINANCE_PROCESSING',
        current_state_group: StateGroup.IN_REVIEW,
        current_assignee_id: financeId,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.finance_processing_started',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          fromState: 'APPROVED_FOR_PAYMENT',
          toState: 'FINANCE_PROCESSING',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function savePaymentVoucherFinanceInformationInDatabase(
  id: string,
  input: FinancePaymentInformationInput,
) {
  const paymentDate = input.paymentDate.trim();
  const paymentReference = input.paymentReference.trim();
  const paymentRemarks = input.paymentRemarks?.trim() || undefined;
  const paymentProofFileName =
    input.paymentProofFileName?.trim() || undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    throw new Error('Enter a valid payment date.');
  }

  const paidAt = new Date(`${paymentDate}T00:00:00.000Z`);

  if (
    Number.isNaN(paidAt.getTime()) ||
    toDateOnly(paidAt) !== paymentDate
  ) {
    throw new Error('Enter a valid payment date.');
  }

  if (!paymentReference) {
    throw new Error('Payment reference is required.');
  }

  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.current_state_code !== 'FINANCE_PROCESSING') {
      throw new Error(
        'Payment information can only be edited while Finance is processing the Payment Voucher.',
      );
    }

    const membership = await requireFinanceMembership(
      transaction,
      voucher.organization_id,
      input.financeId,
    );

    await transaction.paymentVoucherDetail.update({
      where: { submission_id: voucher.id },
      data: {
        paid_at: paidAt,
        paid_reference: paymentReference,
      },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'FINANCE_PROCESSING',
        action_code: 'SAVE_PAYMENT_INFORMATION',
        to_state_code: 'FINANCE_PROCESSING',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.financeId,
        actor_membership_id: membership.id,
        metadata_json: {
          paymentRemarks,
          paymentProofFileName,
          paymentProofStoragePending: Boolean(paymentProofFileName),
        },
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_assignee_id: input.financeId,
        updated_at: new Date(),
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.payment_information_saved',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: input.financeId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          paymentDate,
          paymentReference,
          hasPaymentProofSelection: Boolean(paymentProofFileName),
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function recordPaymentVoucherPdfGeneratedInDatabase(
  id: string,
  financeId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.current_state_code !== 'FINANCE_PROCESSING') {
      throw new Error(
        'The PV PDF can only be generated while Finance is processing the payment.',
      );
    }

    if (!voucher.pv_detail?.paid_at) {
      throw new Error('Save the payment date before generating the PV PDF.');
    }

    if (!voucher.pv_detail.paid_reference?.trim()) {
      throw new Error('Save the payment reference before generating the PV PDF.');
    }

    const directorApproved = voucher.transitions.some(
      (transition) => transition.action_code === 'APPROVE',
    );

    if (!directorApproved) {
      throw new Error('Director approval information is missing.');
    }

    const membership = await requireFinanceMembership(
      transaction,
      voucher.organization_id,
      financeId,
    );
    const generatedPdfFileName =
      `${voucher.submission_number ?? voucher.id}.pdf`;

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'FINANCE_PROCESSING',
        action_code: 'RECORD_PAYMENT',
        to_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        actor_membership_id: membership.id,
        metadata_json: {
          generatedPdfFileName,
          pdfDeliveryMode: 'CLIENT_DOWNLOAD_ONLY',
        },
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
        current_state_group: StateGroup.AWAITING_EXTERNAL_ACTION,
        current_assignee_id: voucher.submitted_by_id,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.pdf_generated_for_download',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          generatedPdfFileName,
          fromState: 'FINANCE_PROCESSING',
          toState: 'AWAITING_RECIPIENT_SIGNATURE',
          storageMode: 'CLIENT_DOWNLOAD_ONLY',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function issuePaymentVoucherRecipientLinkInDatabase(
  id: string,
  requesterId: string,
): Promise<IssuedRecipientLink> {
  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.submitted_by_id !== requesterId) {
      throw new Error(
        'Only the original submitter can issue the recipient link.',
      );
    }

    if (voucher.current_state_code !== 'AWAITING_RECIPIENT_SIGNATURE') {
      throw new Error(
        'The recipient link can only be issued while awaiting recipient signature.',
      );
    }

    if (!voucher.pv_detail?.recipient_email.trim()) {
      throw new Error('The recipient email address is missing.');
    }

    const membership = await requireRequesterMembership(
      transaction,
      voucher.organization_id,
      requesterId,
    );
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashRecipientToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);
    const now = new Date();

    await transaction.externalActionToken.updateMany({
      where: {
        submission_id: voucher.id,
        token_type: 'SIGNATURE_REQUEST',
        revoked_at: null,
        used_at: null,
      },
      data: {
        revoked_at: now,
      },
    });

    const tokenRecord = await transaction.externalActionToken.create({
      data: {
        submission_id: voucher.id,
        token_hash: tokenHash,
        token_type: 'SIGNATURE_REQUEST',
        bound_email: voucher.pv_detail.recipient_email.trim().toLowerCase(),
        expires_at: expiresAt,
      },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
        action_code: 'ISSUE_RECIPIENT_LINK',
        to_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: requesterId,
        actor_membership_id: membership.id,
        metadata_json: {
          tokenId: tokenRecord.id,
          expiresAt: expiresAt.toISOString(),
          recipientEmail: voucher.pv_detail.recipient_email.trim().toLowerCase(),
        },
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_assignee_id: null,
        updated_at: now,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.recipient_link_issued',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: requesterId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          tokenId: tokenRecord.id,
          expiresAt: expiresAt.toISOString(),
          recipientEmail: voucher.pv_detail.recipient_email.trim().toLowerCase(),
        },
      },
    });

    return {
      voucher: mapStoredPaymentVoucher(updatedVoucher),
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
    };
  });
}

export async function getPaymentVoucherByRecipientTokenFromDatabase(
  token: string,
) {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    throw new Error('The recipient link is invalid.');
  }

  const tokenRecord = await prisma.externalActionToken.findUnique({
    where: {
      token_hash: hashRecipientToken(normalizedToken),
    },
  });

  if (
    !tokenRecord ||
    tokenRecord.token_type !== 'SIGNATURE_REQUEST' ||
    tokenRecord.revoked_at
  ) {
    throw new Error('The recipient link is invalid or has been replaced.');
  }

  if (tokenRecord.expires_at.getTime() <= Date.now()) {
    throw new Error(
      'This secure recipient link has expired. Please contact the requester.',
    );
  }

  const voucher = await prisma.submission.findFirst({
    where: {
      id: tokenRecord.submission_id,
      payment_type: PaymentType.PAYMENT_VOUCHER,
    },
    include: paymentVoucherInclude,
  });

  if (!voucher?.pv_detail) {
    throw new Error('Payment Voucher could not be found.');
  }

  if (
    voucher.pv_detail.recipient_email.trim().toLowerCase() !==
    tokenRecord.bound_email.trim().toLowerCase()
  ) {
    throw new Error('The recipient link does not match this Payment Voucher.');
  }

  return mapStoredPaymentVoucher(voucher);
}

export async function submitPaymentVoucherRecipientSignatureInDatabase(
  token: string,
  input: RecipientDigitalSignatureInput,
) {
  const normalizedToken = token.trim();
  const signatureFileName = input.signatureFileName.trim();
  const signatureDataUrl = input.signatureDataUrl.trim();

  if (!normalizedToken) {
    throw new Error('The recipient link is invalid.');
  }

  if (!input.confirmedPaymentReceived) {
    throw new Error(
      'Please confirm that the payment was received and the information is correct.',
    );
  }

  if (!signatureFileName || !/^data:image\/(png|jpeg);base64,/i.test(signatureDataUrl)) {
    throw new Error('Please upload a valid PNG or JPG signature image.');
  }

  if (signatureDataUrl.length > 2_800_000) {
    throw new Error('The signature image must be smaller than 2 MB.');
  }

  return prisma.$transaction(async (transaction) => {
    const tokenRecord = await transaction.externalActionToken.findUnique({
      where: {
        token_hash: hashRecipientToken(normalizedToken),
      },
    });

    if (
      !tokenRecord ||
      tokenRecord.token_type !== 'SIGNATURE_REQUEST' ||
      tokenRecord.revoked_at ||
      tokenRecord.used_at
    ) {
      throw new Error('The recipient link is invalid or has already been used.');
    }

    if (tokenRecord.expires_at.getTime() <= Date.now()) {
      throw new Error(
        'This secure recipient link has expired. Please contact the requester.',
      );
    }

    const voucher = await transaction.submission.findFirst({
      where: {
        id: tokenRecord.submission_id,
        payment_type: PaymentType.PAYMENT_VOUCHER,
      },
      include: paymentVoucherInclude,
    });

    if (!voucher?.pv_detail) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (
      voucher.pv_detail.recipient_email.trim().toLowerCase() !==
      tokenRecord.bound_email.trim().toLowerCase()
    ) {
      throw new Error('The recipient link does not match this Payment Voucher.');
    }

    if (voucher.current_state_code !== 'AWAITING_RECIPIENT_SIGNATURE') {
      throw new Error(
        'This Payment Voucher is not currently awaiting a recipient signature.',
      );
    }

    const now = new Date();
    const consentText =
      'I confirm that I received the payment and that the Payment Voucher information is correct.';

    await transaction.externalActionToken.update({
      where: { id: tokenRecord.id },
      data: { used_at: now },
    });

    await transaction.paymentVoucherDetail.update({
      where: { submission_id: voucher.id },
      data: {
        signature_method: 'DIGITAL',
        signature_requested_at:
          voucher.pv_detail.signature_requested_at ?? tokenRecord.created_at,
        signature_collected_at: now,
      },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
        action_code: 'COLLECT_SIGNATURE',
        to_state_code: 'AWAITING_STAFF_CONFIRMATION',
        actor_type: ActorType.EXTERNAL_RECIPIENT,
        request_ip: input.requestIp,
        request_user_agent: input.requestUserAgent,
        metadata_json: {
          tokenId: tokenRecord.id,
          signatureFileName,
          signatureDataUrl,
          consentText,
          recipientEmail: tokenRecord.bound_email,
          storageMode: 'POSTGRES_TRANSITION_METADATA_BETA',
        },
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'AWAITING_STAFF_CONFIRMATION',
        current_state_group: StateGroup.PENDING_VERIFICATION,
        current_assignee_id: voucher.submitted_by_id,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.recipient_signature_collected',
        actor_type: ActorType.EXTERNAL_RECIPIENT,
        payload_json: {
          voucherNumber: voucher.submission_number,
          tokenId: tokenRecord.id,
          signatureFileName,
          consentText,
          fromState: 'AWAITING_RECIPIENT_SIGNATURE',
          toState: 'AWAITING_STAFF_CONFIRMATION',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

function validateManualSignedPaymentVoucher(
  input: ManualSignedPaymentVoucherInput,
) {
  const fileName = input.fileName.trim();
  const dataUrl = input.dataUrl.trim();

  if (!input.confirmedPaymentReceived) {
    throw new Error(
      'Please confirm that the payment was received and this is the complete signed Payment Voucher.',
    );
  }

  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please upload the manually signed Payment Voucher as a PDF file.');
  }

  if (!/^data:application\/pdf;base64,/i.test(dataUrl)) {
    throw new Error('Please upload a valid PDF file.');
  }

  /*
   * Temporary beta storage only. A 2.5 MB PDF becomes roughly 3.5 MB
   * after base64 encoding. Move this content to object storage later.
   */
  if (dataUrl.length > 3_600_000) {
    throw new Error('The signed PDF must be smaller than 2.5 MB.');
  }

  return { fileName, dataUrl };
}

export async function submitManualSignedPaymentVoucherByRecipientInDatabase(
  token: string,
  input: ManualSignedPaymentVoucherInput,
) {
  const normalizedToken = token.trim();
  const { fileName, dataUrl } = validateManualSignedPaymentVoucher(input);

  if (!normalizedToken) {
    throw new Error('The recipient link is invalid.');
  }

  return prisma.$transaction(async (transaction) => {
    const tokenRecord = await transaction.externalActionToken.findUnique({
      where: { token_hash: hashRecipientToken(normalizedToken) },
    });

    if (
      !tokenRecord ||
      tokenRecord.token_type !== 'SIGNATURE_REQUEST' ||
      tokenRecord.revoked_at ||
      tokenRecord.used_at
    ) {
      throw new Error('The recipient link is invalid or has already been used.');
    }

    if (tokenRecord.expires_at.getTime() <= Date.now()) {
      throw new Error(
        'This secure recipient link has expired. Please contact the requester.',
      );
    }

    const voucher = await transaction.submission.findFirst({
      where: {
        id: tokenRecord.submission_id,
        payment_type: PaymentType.PAYMENT_VOUCHER,
      },
      include: paymentVoucherInclude,
    });

    if (!voucher?.pv_detail) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (
      voucher.pv_detail.recipient_email.trim().toLowerCase() !==
      tokenRecord.bound_email.trim().toLowerCase()
    ) {
      throw new Error('The recipient link does not match this Payment Voucher.');
    }

    if (voucher.current_state_code !== 'AWAITING_RECIPIENT_SIGNATURE') {
      throw new Error(
        'This Payment Voucher is not currently awaiting a recipient signature.',
      );
    }

    const now = new Date();
    const consentText =
      'I confirm that I received the payment and uploaded the complete manually signed Payment Voucher.';

    await transaction.externalActionToken.update({
      where: { id: tokenRecord.id },
      data: { used_at: now },
    });

    await transaction.paymentVoucherDetail.update({
      where: { submission_id: voucher.id },
      data: {
        signature_method: 'UPLOAD',
        signature_requested_at:
          voucher.pv_detail.signature_requested_at ?? tokenRecord.created_at,
        signature_collected_at: now,
      },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
        action_code: 'COLLECT_SIGNATURE',
        to_state_code: 'AWAITING_STAFF_CONFIRMATION',
        actor_type: ActorType.EXTERNAL_RECIPIENT,
        request_ip: input.requestIp,
        request_user_agent: input.requestUserAgent,
        metadata_json: {
          tokenId: tokenRecord.id,
          signedPvFileName: fileName,
          signedPvDataUrl: dataUrl,
          uploadSource: 'RECIPIENT',
          uploadedById: tokenRecord.bound_email,
          consentText,
          recipientEmail: tokenRecord.bound_email,
          storageMode: 'POSTGRES_TRANSITION_METADATA_BETA',
        },
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'AWAITING_STAFF_CONFIRMATION',
        current_state_group: StateGroup.PENDING_VERIFICATION,
        current_assignee_id: voucher.submitted_by_id,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.manual_signature_uploaded_by_recipient',
        actor_type: ActorType.EXTERNAL_RECIPIENT,
        payload_json: {
          voucherNumber: voucher.submission_number,
          tokenId: tokenRecord.id,
          fileName,
          consentText,
          fromState: 'AWAITING_RECIPIENT_SIGNATURE',
          toState: 'AWAITING_STAFF_CONFIRMATION',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function uploadManualSignedPaymentVoucherByStaffInDatabase(
  id: string,
  requesterId: string,
  input: ManualSignedPaymentVoucherInput,
) {
  const { fileName, dataUrl } = validateManualSignedPaymentVoucher(input);

  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher?.pv_detail) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.submitted_by_id !== requesterId) {
      throw new Error(
        'Only the original submitter can upload the manually signed Payment Voucher.',
      );
    }

    if (voucher.current_state_code !== 'AWAITING_RECIPIENT_SIGNATURE') {
      throw new Error(
        'This Payment Voucher is not currently awaiting a recipient signature.',
      );
    }

    const membership = await requireRequesterMembership(
      transaction,
      voucher.organization_id,
      requesterId,
    );
    const now = new Date();
    const uploadMetadata = {
      signedPvFileName: fileName,
      signedPvDataUrl: dataUrl,
      uploadSource: 'STAFF',
      uploadedById: requesterId,
      confirmedPaymentReceived: true,
      storageMode: 'POSTGRES_TRANSITION_METADATA_BETA',
    };

    await transaction.externalActionToken.updateMany({
      where: {
        submission_id: voucher.id,
        token_type: 'SIGNATURE_REQUEST',
        revoked_at: null,
      },
      data: { revoked_at: now },
    });

    await transaction.paymentVoucherDetail.update({
      where: { submission_id: voucher.id },
      data: {
        signature_method: 'UPLOAD',
        signature_requested_at:
          voucher.pv_detail.signature_requested_at ?? now,
        signature_collected_at: now,
        signature_verified_at: now,
      },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
        action_code: 'UPLOAD_MANUAL_SIGNED_PV',
        to_state_code: 'AWAITING_STAFF_CONFIRMATION',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: requesterId,
        actor_membership_id: membership.id,
        metadata_json: uploadMetadata,
      },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'AWAITING_STAFF_CONFIRMATION',
        action_code: 'CONFIRM_SIGNED_PV',
        to_state_code: 'PENDING_FINANCE_VERIFICATION',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: requesterId,
        actor_membership_id: membership.id,
        metadata_json: {
          signatureMethod: 'UPLOAD',
          recipientSignedAt: now.toISOString(),
          uploadedByStaff: true,
        },
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'PENDING_FINANCE_VERIFICATION',
        current_state_group: StateGroup.PENDING_VERIFICATION,
        current_assignee_id: null,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.manual_signature_uploaded_by_staff',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: requesterId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          fileName,
          fromState: 'AWAITING_RECIPIENT_SIGNATURE',
          toState: 'PENDING_FINANCE_VERIFICATION',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function confirmRecipientSignedPaymentVoucherInDatabase(
  id: string,
  requesterId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher?.pv_detail) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.submitted_by_id !== requesterId) {
      throw new Error(
        'Only the original submitter can confirm the recipient-signed Payment Voucher.',
      );
    }

    if (voucher.current_state_code !== 'AWAITING_STAFF_CONFIRMATION') {
      throw new Error(
        'This Payment Voucher is not currently awaiting requester confirmation.',
      );
    }

    if (!voucher.pv_detail.signature_collected_at) {
      throw new Error('The recipient signature has not been recorded.');
    }

    const membership = await requireRequesterMembership(
      transaction,
      voucher.organization_id,
      requesterId,
    );
    const now = new Date();

    await transaction.paymentVoucherDetail.update({
      where: { submission_id: voucher.id },
      data: {
        signature_verified_at: now,
      },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'AWAITING_STAFF_CONFIRMATION',
        action_code: 'CONFIRM_SIGNED_PV',
        to_state_code: 'PENDING_FINANCE_VERIFICATION',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: requesterId,
        actor_membership_id: membership.id,
        metadata_json: {
          signatureMethod: voucher.pv_detail.signature_method,
          recipientSignedAt:
            voucher.pv_detail.signature_collected_at.toISOString(),
        },
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'PENDING_FINANCE_VERIFICATION',
        current_state_group: StateGroup.PENDING_VERIFICATION,
        current_assignee_id: null,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.recipient_signature_confirmed_by_staff',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: requesterId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          signatureMethod: voucher.pv_detail.signature_method,
          fromState: 'AWAITING_STAFF_CONFIRMATION',
          toState: 'PENDING_FINANCE_VERIFICATION',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function completePaymentVoucherInDatabase(
  id: string,
  financeId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher?.pv_detail) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.current_state_code !== 'PENDING_FINANCE_VERIFICATION') {
      throw new Error(
        'Only a Payment Voucher pending Finance verification can be completed.',
      );
    }

    if (
      !voucher.pv_detail.signature_collected_at ||
      !voucher.pv_detail.signature_verified_at
    ) {
      throw new Error(
        'The recipient signature must be collected and confirmed by the original requester first.',
      );
    }

    const membership = await requireFinanceMembership(
      transaction,
      voucher.organization_id,
      financeId,
    );
    const now = new Date();

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'PENDING_FINANCE_VERIFICATION',
        action_code: 'COMPLETE',
        to_state_code: 'COMPLETED',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        actor_membership_id: membership.id,
        metadata_json: {
          recipientSignedAt:
            voucher.pv_detail.signature_collected_at.toISOString(),
          staffConfirmedAt:
            voucher.pv_detail.signature_verified_at.toISOString(),
        },
      },
    });

    await transaction.externalActionToken.updateMany({
      where: {
        submission_id: voucher.id,
        revoked_at: null,
      },
      data: {
        revoked_at: now,
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'COMPLETED',
        current_state_group: StateGroup.COMPLETE,
        current_assignee_id: null,
        closed_at: now,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.completed',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          fromState: 'PENDING_FINANCE_VERIFICATION',
          toState: 'COMPLETED',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function markPaymentVoucherInactiveInDatabase(
  id: string,
  financeId: string,
  remarks: string,
) {
  const normalizedRemarks = remarks.trim();

  if (normalizedRemarks.length < 5) {
    throw new Error(
      'Please provide a clear reason for marking this Payment Voucher as inactive.',
    );
  }

  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher?.pv_detail) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.current_state_code !== 'FINANCE_PROCESSING') {
      throw new Error(
        'Only a Payment Voucher being processed by Finance can be marked as inactive.',
      );
    }

    const membership = await requireFinanceMembership(
      transaction,
      voucher.organization_id,
      financeId,
    );
    const now = new Date();

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'FINANCE_PROCESSING',
        action_code: 'MARK_INACTIVE',
        to_state_code: 'INACTIVE',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        actor_membership_id: membership.id,
        reason_text: normalizedRemarks,
      },
    });

    await transaction.externalActionToken.updateMany({
      where: {
        submission_id: voucher.id,
        revoked_at: null,
      },
      data: {
        revoked_at: now,
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'INACTIVE',
        current_state_group: StateGroup.VOIDED,
        current_assignee_id: null,
        closed_at: now,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.marked_inactive',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          remarks: normalizedRemarks,
          fromState: 'FINANCE_PROCESSING',
          toState: 'INACTIVE',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function returnPaymentVoucherForNewSignatureInDatabase(
  id: string,
  financeId: string,
  remarks: string,
) {
  const normalizedRemarks = remarks.trim();

  if (normalizedRemarks.length < 5) {
    throw new Error(
      'Please provide a clear reason for returning the signed Payment Voucher.',
    );
  }

  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher?.pv_detail) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.current_state_code !== 'PENDING_FINANCE_VERIFICATION') {
      throw new Error(
        'Only a Payment Voucher pending Finance verification can be returned.',
      );
    }

    const membership = await requireFinanceMembership(
      transaction,
      voucher.organization_id,
      financeId,
    );
    const now = new Date();

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'PENDING_FINANCE_VERIFICATION',
        action_code: 'RETURN_SIGNED_PV',
        to_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        actor_membership_id: membership.id,
        reason_text: normalizedRemarks,
      },
    });

    await transaction.paymentVoucherDetail.update({
      where: { submission_id: voucher.id },
      data: {
        signature_method: null,
        signature_requested_at: null,
        signature_collected_at: null,
        signature_verified_at: null,
      },
    });

    await transaction.externalActionToken.updateMany({
      where: {
        submission_id: voucher.id,
        revoked_at: null,
      },
      data: {
        revoked_at: now,
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'AWAITING_RECIPIENT_SIGNATURE',
        current_state_group: StateGroup.AWAITING_EXTERNAL_ACTION,
        current_assignee_id: voucher.submitted_by_id,
        closed_at: null,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.signed_document_returned',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: financeId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          remarks: normalizedRemarks,
          fromState: 'PENDING_FINANCE_VERIFICATION',
          toState: 'AWAITING_RECIPIENT_SIGNATURE',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function approvePaymentVoucherInDatabase(
  id: string,
  directorId: string,
  signatureKey: string,
) {
  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.current_state_code !== 'PENDING_DIRECTOR_APPROVAL') {
      throw new Error(
        'Only a Payment Voucher pending Director approval can be approved.',
      );
    }

    const approvalStep = voucher.approval_steps.find(
      (step) => step.required_role === 'DIRECTOR' && step.status_code === 'ACTIVE',
    );

    if (!approvalStep || approvalStep.assigned_user_id !== directorId) {
      throw new Error('This Payment Voucher is assigned to another Director.');
    }

    const membership = await requireDirectorMembership(
      transaction,
      voucher.organization_id,
      directorId,
    );

    if (!membership.signature_url) {
      throw new Error(
        'Upload your signature in Settings before approving this Payment Voucher.',
      );
    }

    const signatureDocument = await transaction.document.findFirst({
      where: {
        id: signatureKey,
        organization_id: voucher.organization_id,
        uploaded_by_id: directorId,
        document_type: 'SIGNATURE_IMAGE',
        storage_key: membership.signature_url,
      },
      select: { id: true },
    });

    if (!signatureDocument) {
      throw new Error(
        'The selected Director signature is no longer active. Open Signature Settings and try again.',
      );
    }

    await transaction.approvalDecision.create({
      data: {
        approval_step_id: approvalStep.id,
        decision_code: 'APPROVED',
        decided_by_user_id: directorId,
      },
    });

    await transaction.approvalStep.update({
      where: { id: approvalStep.id },
      data: { status_code: 'COMPLETE' },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'PENDING_DIRECTOR_APPROVAL',
        action_code: 'APPROVE',
        to_state_code: 'APPROVED_FOR_PAYMENT',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: directorId,
        actor_membership_id: membership.id,
        metadata_json: {
          signatureKey,
        },
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'APPROVED_FOR_PAYMENT',
        current_state_group: StateGroup.IN_REVIEW,
        current_assignee_id: null,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.approved',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: directorId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          fromState: 'PENDING_DIRECTOR_APPROVAL',
          toState: 'APPROVED_FOR_PAYMENT',
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

export async function rejectPaymentVoucherInDatabase(
  id: string,
  directorId: string,
  remarks: string,
) {
  const normalizedRemarks = remarks.trim();

  if (normalizedRemarks.length < 5) {
    throw new Error('Please provide a clear reason for rejecting this Payment Voucher.');
  }

  return prisma.$transaction(async (transaction) => {
    const voucher = await transaction.submission.findFirst({
      where: {
        payment_type: PaymentType.PAYMENT_VOUCHER,
        OR: [{ id }, { submission_number: id }],
      },
      include: paymentVoucherInclude,
    });

    if (!voucher) {
      throw new Error('Payment Voucher could not be found.');
    }

    if (voucher.current_state_code !== 'PENDING_DIRECTOR_APPROVAL') {
      throw new Error(
        'Only a Payment Voucher pending Director approval can be rejected.',
      );
    }

    const approvalStep = voucher.approval_steps.find(
      (step) => step.required_role === 'DIRECTOR' && step.status_code === 'ACTIVE',
    );

    if (!approvalStep || approvalStep.assigned_user_id !== directorId) {
      throw new Error('This Payment Voucher is assigned to another Director.');
    }

    const membership = await requireDirectorMembership(
      transaction,
      voucher.organization_id,
      directorId,
    );

    await transaction.approvalDecision.create({
      data: {
        approval_step_id: approvalStep.id,
        decision_code: 'REJECTED',
        decided_by_user_id: directorId,
        reason_text: normalizedRemarks,
      },
    });

    await transaction.approvalStep.update({
      where: { id: approvalStep.id },
      data: { status_code: 'COMPLETE' },
    });

    await transaction.submissionTransition.create({
      data: {
        submission_id: voucher.id,
        from_state_code: 'PENDING_DIRECTOR_APPROVAL',
        action_code: 'REJECT',
        to_state_code: 'REJECTED',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: directorId,
        actor_membership_id: membership.id,
        reason_text: normalizedRemarks,
      },
    });

    const updatedVoucher = await transaction.submission.update({
      where: { id: voucher.id },
      data: {
        current_state_code: 'REJECTED',
        current_state_group: StateGroup.REJECTED,
        current_assignee_id: voucher.submitted_by_id,
      },
      include: paymentVoucherInclude,
    });

    await transaction.auditEvent.create({
      data: {
        organization_id: voucher.organization_id,
        submission_id: voucher.id,
        event_type: 'payment_voucher.rejected',
        actor_type: ActorType.INTERNAL_USER,
        actor_user_id: directorId,
        payload_json: {
          voucherNumber: voucher.submission_number,
          fromState: 'PENDING_DIRECTOR_APPROVAL',
          toState: 'REJECTED',
          remarks: normalizedRemarks,
        },
      },
    });

    return mapStoredPaymentVoucher(updatedVoucher);
  });
}

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ActorType,
  OrgRole,
  PaymentType,
  Prisma,
  StateGroup,
} from "@prisma/client";

import {
  claimPolicyContext,
  claimTotal,
  validateClaimInput,
} from "@/domain/payment-requests/claims/policy";
import type {
  ClaimPolicyContext,
  ClaimFinanceInput,
  ClaimReceiptUpload,
  ClaimRecord,
  ClaimStatus,
  ClaimType,
  CreateClaimInput,
} from "@/domain/payment-requests/claims/types";
import { prisma } from "@/lib/db/prisma";

const PRIVATE_ROOT = path.resolve(process.cwd(), "runtime", "private");
const RECEIPT_MAX_SIZE = 10 * 1024 * 1024;
const receiptExtensions: Record<ClaimReceiptUpload["mimeType"], string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

const CLAIM_PAYMENT_TYPE = {
  EXPENSE: "EXPENSE_CLAIM",
  INTERNET_COMMUTE: "INTERNET_COMMUTE_CLAIM",
  MEDICAL: "MEDICAL_CLAIM",
  MILEAGE: "MILEAGE_CLAIM",
  PD: "PD_CLAIM",
  TECH: "TECH_CLAIM",
} as const satisfies Record<ClaimType, string>;

const CLAIM_PAYMENT_TYPES = Object.values(CLAIM_PAYMENT_TYPE) as PaymentType[];

function paymentTypeForClaim(claimType: ClaimType) {
  return CLAIM_PAYMENT_TYPE[claimType] as PaymentType;
}

const include = {
  submitted_by: true,
  claim_detail: true,
  lines: { orderBy: { line_number: "asc" as const } },
  transitions: { orderBy: { created_at: "asc" as const } },
  approval_steps: {
    include: { decision: true },
    orderBy: { step_number: "asc" as const },
  },
} satisfies Prisma.SubmissionInclude;

type StoredClaim = Prisma.SubmissionGetPayload<{ include: typeof include }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeSegment(value: string) {
  return value.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
}

function resolvePrivateFile(storageKey: string) {
  const filePath = path.resolve(PRIVATE_ROOT, ...storageKey.split("/"));
  if (!filePath.startsWith(`${PRIVATE_ROOT}${path.sep}`))
    throw new Error("Invalid private claim document path.");
  return filePath;
}

function readSnapshot(record: StoredClaim): CreateClaimInput {
  const transition = [...record.transitions].reverse().find((item) => {
    if (!["CREATE", "SAVE_DRAFT", "SUBMIT_DRAFT"].includes(item.action_code))
      return false;
    return (
      isRecord(item.metadata_json) && isRecord(item.metadata_json.snapshot)
    );
  });
  const metadata = transition?.metadata_json;
  if (!isRecord(metadata) || !isRecord(metadata.snapshot)) {
    throw new Error(
      `Claim ${record.submission_number ?? record.id} has no request snapshot.`,
    );
  }
  return metadata.snapshot as unknown as CreateClaimInput;
}

function normalizedClaimStatus(status: string): ClaimStatus {
  if (
    status === "PENDING_MANAGER_APPROVAL" ||
    status === "PENDING_FINANCE_PROCESSING"
  )
    return "PENDING_FINANCE_VERIFICATION";
  if (status === "PAID") return "PAYMENT_PROCESSED";
  // Claims completed before the explicit final state was introduced were
  // closed while still carrying the proof-upload status.
  if (status === "TRANSACTION_PROOF_UPLOADED") return "COMPLETED";
  return status as ClaimStatus;
}

function mapClaim(record: StoredClaim): ClaimRecord {
  const snapshot = readSnapshot(record);
  const managerApproval = [...record.transitions]
    .reverse()
    .find((item) => item.action_code === "APPROVE_BY_MANAGER");
  const directorReview = [...record.transitions]
    .reverse()
    .find((item) => item.action_code === "FORWARD_BY_DIRECTOR");
  const financeProcessing = [...record.transitions]
    .reverse()
    .find((item) => item.action_code === "PROCESS_BY_FINANCE");
  const returned = [...record.transitions]
    .reverse()
    .find((item) =>
      ["RETURN_BY_MANAGER", "RETURN_BY_DIRECTOR", "RETURN_BY_FINANCE"].includes(
        item.action_code,
      ),
    );
  const financeMetadata = financeProcessing?.metadata_json;
  return {
    ...snapshot,
    id: record.id,
    claimNumber: record.submission_number ?? `CL-DRAFT-${record.id.slice(-6)}`,
    requestType: "CLAIM_REQUEST",
    status: normalizedClaimStatus(record.current_state_code),
    totalAmount: Number(record.total_amount),
    managerApprovedAt: managerApproval?.created_at.toISOString(),
    managerApprovedById: managerApproval?.actor_user_id ?? undefined,
    directorReviewedAt: directorReview?.created_at.toISOString(),
    directorReviewedById: directorReview?.actor_user_id ?? undefined,
    financeProcessedAt: financeProcessing?.created_at.toISOString(),
    financeProcessedById: financeProcessing?.actor_user_id ?? undefined,
    paymentDate:
      isRecord(financeMetadata) &&
      typeof financeMetadata.paymentDate === "string"
        ? financeMetadata.paymentDate
        : undefined,
    paymentReference:
      isRecord(financeMetadata) &&
      typeof financeMetadata.paymentReference === "string"
        ? financeMetadata.paymentReference
        : undefined,
    paymentNotes:
      isRecord(financeMetadata) && typeof financeMetadata.notes === "string"
        ? financeMetadata.notes
        : undefined,
    returnedAt: returned?.created_at.toISOString(),
    returnedById: returned?.actor_user_id ?? undefined,
    returnRemarks: returned?.reason_text ?? undefined,
    returnedFromStage:
      returned?.action_code === "RETURN_BY_DIRECTOR"
        ? "DIRECTOR"
        : returned?.action_code === "RETURN_BY_FINANCE"
          ? "FINANCE"
          : returned
            ? "MANAGER"
            : undefined,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
  };
}

async function requireRole(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
  role: OrgRole,
) {
  const membership = await tx.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
      is_active: true,
      membership_status: "ACTIVE",
      roles: { some: { role } },
    },
    select: { id: true },
  });
  if (!membership)
    throw new Error(
      `The selected user is not an active ${role.replaceAll("_", " ")}.`,
    );
  return membership;
}

async function requireActiveMembership(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
) {
  const membership = await tx.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
      is_active: true,
      membership_status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!membership)
    throw new Error(
      "The claimant is not an active member of this organization.",
    );
  return membership;
}

async function activeFinanceUser(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  const membership = await tx.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      is_active: true,
      membership_status: "ACTIVE",
      roles: { some: { role: OrgRole.FINANCE_ADMIN } },
    },
    select: { user_id: true },
  });
  if (!membership)
    throw new Error(
      "No active Finance user is available to process this Claim.",
    );
  return membership.user_id;
}

async function nextClaimNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
  claimDate: string,
) {
  const year = Number(claimDate.slice(0, 4));
  const month = Number(claimDate.slice(5, 7));
  const shortYear = String(year).slice(-2);
  const sequence = await tx.documentSequence.upsert({
    where: {
      organization_id_payment_type_year_month: {
        organization_id: organizationId,
        // All Claim subtypes intentionally share one CL number sequence.
        payment_type: PaymentType.EXPENSE_CLAIM,
        year,
        month,
      },
    },
    create: {
      organization_id: organizationId,
      // All Claim subtypes share one CL reference sequence.
      payment_type: PaymentType.EXPENSE_CLAIM,
      year,
      month,
      prefix: "CL",
      last_sequence: 1,
    },
    update: { last_sequence: { increment: 1 } },
  });
  return `${sequence.prefix}${shortYear}-${String(month).padStart(2, "0")}-${String(sequence.last_sequence).padStart(2, "0")}`;
}

async function policyContextInTransaction(
  tx: Prisma.TransactionClient,
  organizationId: string,
  requesterId: string,
  claimDate: string,
): Promise<ClaimPolicyContext> {
  const records = await tx.submission.findMany({
    where: {
      organization_id: organizationId,
      payment_type: { in: CLAIM_PAYMENT_TYPES },
      submitted_by_id: requesterId,
      current_state_group: {
        notIn: [StateGroup.DRAFT, StateGroup.REJECTED, StateGroup.VOIDED],
      },
    },
    include,
    orderBy: { created_at: "asc" },
  });
  const compatibleRecords = records.flatMap((record) => {
    try {
      return [mapClaim(record)];
    } catch {
      return [];
    }
  });
  return claimPolicyContext(compatibleRecords, requesterId, claimDate);
}

export async function getClaimPolicyContextFromDatabase(input: {
  organizationId: string;
  requesterId: string;
  claimDate: string;
}) {
  return prisma.$transaction((tx) =>
    policyContextInTransaction(
      tx,
      input.organizationId,
      input.requesterId,
      input.claimDate,
    ),
  );
}

export async function createClaimInDatabase(
  input: CreateClaimInput,
  receiptUploads: ClaimReceiptUpload[],
  mode: "draft" | "submit" = "submit",
) {
  const requiredLineIds =
    input.claimType === "MILEAGE" ? [] : input.lines.map((line) => line.id);
  if (
    mode === "submit" &&
    requiredLineIds.some(
      (id) =>
        !receiptUploads.some((upload) => upload.lineId === id) &&
        !input.lines.find((line) => line.id === id)?.receiptLink?.trim(),
    )
  ) {
    throw new Error("Provide one receipt link or upload for every claim item.");
  }
  for (const upload of receiptUploads) {
    if (
      !(upload.mimeType in receiptExtensions) ||
      !upload.bytes.length ||
      upload.bytes.length > RECEIPT_MAX_SIZE
    ) {
      throw new Error(
        "Each receipt must be a PDF, JPG or PNG file no larger than 10 MB.",
      );
    }
  }

  const prepared = receiptUploads.map((upload) => {
    const storageKey = `claims/${safeSegment(input.organizationId)}/${safeSegment(input.requesterId)}/${randomUUID()}.${receiptExtensions[upload.mimeType]}`;
    return { ...upload, storageKey, filePath: resolvePrivateFile(storageKey) };
  });
  try {
    for (const upload of prepared) {
      await mkdir(path.dirname(upload.filePath), { recursive: true });
      await writeFile(upload.filePath, upload.bytes, { flag: "wx" });
    }
  } catch (error) {
    await Promise.all(
      prepared.map((upload) => unlink(upload.filePath).catch(() => undefined)),
    );
    throw error;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await requireActiveMembership(
        tx,
        input.organizationId,
        input.requesterId,
      );
      if (mode === "submit") {
        await requireRole(
          tx,
          input.organizationId,
          input.directorApproverId ?? "",
          OrgRole.DIRECTOR,
        );
        if (input.directorApproverId === input.requesterId)
          throw new Error("Select a different Director to approve this Claim.");
      }
      const context = await policyContextInTransaction(
        tx,
        input.organizationId,
        input.requesterId,
        input.claimDate,
      );
      const validation =
        mode === "submit" ? validateClaimInput(input, context) : "";
      if (validation) throw new Error(validation);

      const receiptDocuments = new Map<string, string>();
      for (const upload of prepared) {
        const document = await tx.document.create({
          data: {
            organization_id: input.organizationId,
            document_type: "SUPPORTING_DOC",
            storage_bucket: "local-private",
            storage_key: upload.storageKey,
            original_file_name: upload.fileName,
            mime_type: upload.mimeType,
            file_size_bytes: upload.bytes.length,
            sha256_hash: createHash("sha256")
              .update(upload.bytes)
              .digest("hex"),
            uploaded_by_id: input.requesterId,
          },
        });
        receiptDocuments.set(upload.lineId, document.id);
      }
      const storedInput: CreateClaimInput = {
        ...input,
        lines: input.lines.map((line) => ({
          ...line,
          receiptDocumentId: receiptDocuments.get(line.id),
          receiptFileName:
            prepared.find((upload) => upload.lineId === line.id)?.fileName ??
            "",
          receiptMimeType:
            prepared.find((upload) => upload.lineId === line.id)?.mimeType ??
            "",
          receiptFileSize:
            prepared.find((upload) => upload.lineId === line.id)?.bytes
              .length ?? 0,
        })),
      };

      const total = claimTotal(storedInput.claimType, storedInput.lines);
      const claimNumber = await nextClaimNumber(
        tx,
        input.organizationId,
        input.claimDate,
      );
      const lineDates = input.lines.map(
        (line) => new Date(`${line.expenseDate || input.claimDate}T12:00:00`),
      );
      const claimPeriodStart = new Date(
        Math.min(...lineDates.map((value) => value.getTime())),
      );
      const claimPeriodEnd = new Date(
        Math.max(...lineDates.map((value) => value.getTime())),
      );

      const financeId =
        mode === "submit"
          ? input.requesterRole === "finance"
            ? input.requesterId
            : await activeFinanceUser(tx, input.organizationId)
          : undefined;
      const firstState =
        mode === "draft" ? "DRAFT" : "PENDING_FINANCE_VERIFICATION";
      const firstAssignee = mode === "draft" ? undefined : financeId;
      const submission = await tx.submission.create({
        data: {
          organization_id: input.organizationId,
          payment_type: paymentTypeForClaim(storedInput.claimType),
          current_state_code: firstState,
          current_state_group:
            mode === "draft"
              ? StateGroup.DRAFT
              : StateGroup.PENDING_VERIFICATION,
          current_assignee_id: firstAssignee,
          submission_number: claimNumber,
          submitted_by_id: input.requesterId,
          submitted_at: mode === "submit" ? new Date() : null,
          total_amount: new Prisma.Decimal(total.toFixed(2)),
          currency: "MYR",
          description: storedInput.notes || storedInput.lines[0]?.details,
          claim_detail: {
            create: {
              claim_period_start: claimPeriodStart,
              claim_period_end: claimPeriodEnd,
              claim_notes: storedInput.notes,
            },
          },
          lines: {
            create: storedInput.lines.map((line, index) => ({
              line_number: index + 1,
              description: line.details,
              amount: new Prisma.Decimal(
                (storedInput.claimType === "MILEAGE"
                  ? Number(line.kilometers) *
                    (Number(line.kilometers) <= 500 ? 0.5 : 0.3)
                  : Number(line.amount)
                ).toFixed(2),
              ),
            })),
          },
          transitions: {
            create: {
              from_state_code: "DRAFT",
              to_state_code: firstState,
              action_code: "CREATE",
              actor_type: ActorType.INTERNAL_USER,
              actor_user_id: input.requesterId,
              metadata_json: {
                snapshot: storedInput,
              } as unknown as Prisma.InputJsonValue,
            },
          },
          approval_steps:
            mode === "draft"
              ? undefined
              : {
                  create: [
                    {
                      step_number: 1,
                      required_role: OrgRole.DIRECTOR,
                      assigned_user_id: input.directorApproverId,
                      status_code: "PENDING",
                    },
                  ],
                },
          evidence: {
            create: [...receiptDocuments.values()].map((documentId) => ({
              document_id: documentId,
              evidence_type_code: "SUPPORTING_DOC",
            })),
          },
        },
        include,
      });

      await tx.auditEvent.create({
        data: {
          organization_id: input.organizationId,
          submission_id: submission.id,
          event_type: mode === "draft" ? "claim.draft_saved" : "claim.created",
          actor_type: ActorType.INTERNAL_USER,
          actor_user_id: input.requesterId,
          payload_json: {
            claimType: storedInput.claimType,
            techExtended: storedInput.techExtended,
            totalAmount: total,
            receiptCount: receiptDocuments.size,
          } as Prisma.InputJsonValue,
        },
      });
      return mapClaim(submission);
    });
  } catch (error) {
    await Promise.all(
      prepared.map((upload) => unlink(upload.filePath).catch(() => undefined)),
    );
    throw error;
  }
}

export async function updateClaimDraftInDatabase(
  id: string,
  input: CreateClaimInput,
  receiptUploads: ClaimReceiptUpload[],
  mode: "draft" | "submit",
) {
  for (const upload of receiptUploads) {
    if (
      !(upload.mimeType in receiptExtensions) ||
      !upload.bytes.length ||
      upload.bytes.length > RECEIPT_MAX_SIZE
    ) {
      throw new Error(
        "Each receipt must be a PDF, JPG or PNG file no larger than 10 MB.",
      );
    }
  }
  const prepared = receiptUploads.map((upload) => {
    const storageKey = `claims/${safeSegment(input.organizationId)}/${safeSegment(input.requesterId)}/${randomUUID()}.${receiptExtensions[upload.mimeType]}`;
    return { ...upload, storageKey, filePath: resolvePrivateFile(storageKey) };
  });
  try {
    for (const upload of prepared) {
      await mkdir(path.dirname(upload.filePath), { recursive: true });
      await writeFile(upload.filePath, upload.bytes, { flag: "wx" });
    }
  } catch (error) {
    await Promise.all(
      prepared.map((upload) => unlink(upload.filePath).catch(() => undefined)),
    );
    throw error;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await getStoredClaim(tx, id);
      if (
        !["DRAFT", "RETURNED_TO_CLAIMANT"].includes(existing.current_state_code)
      )
        throw new Error(
          "Only a Draft or returned Claim can be updated from the form.",
        );
      if (existing.submitted_by_id !== input.requesterId)
        throw new Error(
          "Only the claimant who created this Draft can update it.",
        );
      await requireActiveMembership(
        tx,
        input.organizationId,
        input.requesterId,
      );
      if (mode === "submit") {
        await requireRole(
          tx,
          input.organizationId,
          input.directorApproverId ?? "",
          OrgRole.DIRECTOR,
        );
        if (input.directorApproverId === input.requesterId)
          throw new Error("Select a different Director to approve this Claim.");
      }

      const receiptDocuments = new Map<string, string>();
      for (const upload of prepared) {
        const document = await tx.document.create({
          data: {
            organization_id: input.organizationId,
            document_type: "SUPPORTING_DOC",
            storage_bucket: "local-private",
            storage_key: upload.storageKey,
            original_file_name: upload.fileName,
            mime_type: upload.mimeType,
            file_size_bytes: upload.bytes.length,
            sha256_hash: createHash("sha256")
              .update(upload.bytes)
              .digest("hex"),
            uploaded_by_id: input.requesterId,
          },
        });
        receiptDocuments.set(upload.lineId, document.id);
      }
      const storedInput: CreateClaimInput = {
        ...input,
        lines: input.lines.map((line) => {
          const upload = prepared.find((item) => item.lineId === line.id);
          return upload
            ? {
                ...line,
                receiptDocumentId: receiptDocuments.get(line.id),
                receiptFileName: upload.fileName,
                receiptMimeType: upload.mimeType,
                receiptFileSize: upload.bytes.length,
              }
            : line;
        }),
      };
      if (
        mode === "submit" &&
        storedInput.claimType !== "MILEAGE" &&
        storedInput.lines.some(
          (line) => !line.receiptDocumentId && !line.receiptLink?.trim(),
        )
      ) {
        throw new Error(
          "Provide one receipt link or upload for every claim item.",
        );
      }
      const context = await policyContextInTransaction(
        tx,
        input.organizationId,
        input.requesterId,
        input.claimDate,
      );
      const validation =
        mode === "submit" ? validateClaimInput(storedInput, context) : "";
      if (validation) throw new Error(validation);

      const financeId =
        mode === "submit"
          ? input.requesterRole === "finance"
            ? input.requesterId
            : await activeFinanceUser(tx, input.organizationId)
          : undefined;
      const nextState =
        mode === "draft" ? "DRAFT" : "PENDING_FINANCE_VERIFICATION";
      const assignee = mode === "draft" ? undefined : financeId;
      const total = claimTotal(storedInput.claimType, storedInput.lines);
      const lineDates = storedInput.lines.map(
        (line) => new Date(`${line.expenseDate || input.claimDate}T12:00:00`),
      );
      const claimPeriodStart = new Date(
        Math.min(...lineDates.map((value) => value.getTime())),
      );
      const claimPeriodEnd = new Date(
        Math.max(...lineDates.map((value) => value.getTime())),
      );

      await tx.submissionLine.deleteMany({
        where: { submission_id: existing.id },
      });
      await tx.approvalDecision.deleteMany({
        where: { approval_step: { submission_id: existing.id } },
      });
      await tx.approvalStep.deleteMany({
        where: { submission_id: existing.id },
      });
      return mapClaim(
        await tx.submission.update({
          where: { id: existing.id },
          data: {
            payment_type: paymentTypeForClaim(storedInput.claimType),
            current_state_code: nextState,
            current_state_group:
              mode === "draft"
                ? StateGroup.DRAFT
                : StateGroup.PENDING_VERIFICATION,
            current_assignee_id: assignee,
            submitted_at: mode === "submit" ? new Date() : null,
            total_amount: new Prisma.Decimal(total.toFixed(2)),
            description: storedInput.notes || storedInput.lines[0]?.details,
            claim_detail: {
              update: {
                claim_period_start: claimPeriodStart,
                claim_period_end: claimPeriodEnd,
                claim_notes: storedInput.notes,
              },
            },
            lines: {
              create: storedInput.lines.map((line, index) => ({
                line_number: index + 1,
                description: line.details,
                amount: new Prisma.Decimal(
                  (storedInput.claimType === "MILEAGE"
                    ? Number(line.kilometers) *
                      (Number(line.kilometers) <= 500 ? 0.5 : 0.3)
                    : Number(line.amount)
                  ).toFixed(2),
                ),
              })),
            },
            approval_steps:
              mode === "draft"
                ? undefined
                : {
                    create: [
                      {
                        step_number: 1,
                        required_role: OrgRole.DIRECTOR,
                        assigned_user_id: input.directorApproverId,
                        status_code: "PENDING",
                      },
                    ],
                  },
            transitions: {
              create: {
                from_state_code: existing.current_state_code,
                to_state_code: nextState,
                action_code: mode === "draft" ? "SAVE_DRAFT" : "SUBMIT_DRAFT",
                actor_type: ActorType.INTERNAL_USER,
                actor_user_id: input.requesterId,
                metadata_json: {
                  snapshot: storedInput,
                } as unknown as Prisma.InputJsonValue,
              },
            },
            evidence: receiptDocuments.size
              ? {
                  create: [...receiptDocuments.values()].map((documentId) => ({
                    document_id: documentId,
                    evidence_type_code: "SUPPORTING_DOC",
                  })),
                }
              : undefined,
          },
          include,
        }),
      );
    });
  } catch (error) {
    await Promise.all(
      prepared.map((upload) => unlink(upload.filePath).catch(() => undefined)),
    );
    throw error;
  }
}

export async function listClaimsFromDatabase(scope: {
  role: string;
  userId: string;
}) {
  const records = await prisma.submission.findMany({
    where: {
      payment_type: { in: CLAIM_PAYMENT_TYPES },
      ...(scope.role === "manager"
        ? {
            OR: [
              { current_assignee_id: scope.userId },
              { approval_steps: { some: { assigned_user_id: scope.userId } } },
              { submitted_by_id: scope.userId },
            ],
          }
        : scope.role === "director"
          ? {
              OR: [
                { current_assignee_id: scope.userId },
                {
                  approval_steps: { some: { assigned_user_id: scope.userId } },
                },
                { submitted_by_id: scope.userId },
              ],
            }
          : scope.role === "finance"
            ? {
                OR: [
                  { current_assignee_id: scope.userId },
                  {
                    current_state_code: {
                      in: [
                        "PENDING_MANAGER_APPROVAL",
                        "PENDING_FINANCE_PROCESSING",
                        "PENDING_FINANCE_VERIFICATION",
                        "APPROVED_FOR_PAYMENT",
                        "PAYMENT_PROCESSED",
                      ],
                    },
                  },
                  { submitted_by_id: scope.userId },
                  {
                    transitions: {
                      some: {
                        actor_user_id: scope.userId,
                        action_code: {
                          in: ["VERIFY_BY_FINANCE", "PROCESS_BY_FINANCE"],
                        },
                      },
                    },
                  },
                ],
              }
            : scope.role === "staff"
              ? { submitted_by_id: scope.userId }
              : {}),
    },
    include,
    orderBy: { updated_at: "desc" },
    take: 1000,
  });
  return records.flatMap((record) => {
    try {
      return [mapClaim(record)];
    } catch {
      return [];
    }
  });
}

export async function getClaimFromDatabase(id: string) {
  const record = await prisma.submission.findFirst({
    where: {
      payment_type: { in: CLAIM_PAYMENT_TYPES },
      OR: [{ id }, { submission_number: id }],
    },
    include,
  });
  return record ? mapClaim(record) : null;
}

async function getStoredClaim(tx: Prisma.TransactionClient, id: string) {
  const record = await tx.submission.findFirst({
    where: {
      payment_type: { in: CLAIM_PAYMENT_TYPES },
      OR: [{ id }, { submission_number: id }],
    },
    include,
  });
  if (!record) throw new Error("The Claim request could not be found.");
  return record;
}

export async function approveClaimByManagerInDatabase(
  id: string,
  managerId: string,
) {
  return prisma.$transaction(async (tx) => {
    const record = await getStoredClaim(tx, id);
    const snapshot = readSnapshot(record);
    if (snapshot.managerApproverId !== managerId)
      throw new Error("This Claim is assigned to another Manager.");
    if (
      record.transitions.some(
        (item) => item.action_code === "APPROVE_BY_MANAGER",
      )
    )
      throw new Error("The Manager preview has already been recorded.");
    if (["DRAFT", "RETURNED_TO_CLAIMANT"].includes(record.current_state_code))
      throw new Error("This Claim is not available for Manager preview.");
    await requireRole(tx, record.organization_id, managerId, OrgRole.MANAGER);
    const managerStep = record.approval_steps.find(
      (step) => step.required_role === OrgRole.MANAGER,
    );
    if (!managerStep) throw new Error("The Manager preview step is missing.");
    await tx.approvalStep.update({
      where: { id: managerStep.id },
      data: {
        status_code: "COMPLETE",
        decision: {
          create: { decision_code: "APPROVED", decided_by_user_id: managerId },
        },
      },
    });
    const legacyState = [
      "PENDING_MANAGER_APPROVAL",
      "PENDING_DIRECTOR_APPROVAL",
    ].includes(record.current_state_code);
    const financeId = legacyState
      ? await activeFinanceUser(tx, record.organization_id)
      : record.current_assignee_id;
    return mapClaim(
      await tx.submission.update({
        where: { id: record.id },
        data: {
          current_state_code: legacyState
            ? "PENDING_FINANCE_PROCESSING"
            : record.current_state_code,
          current_state_group: legacyState
            ? StateGroup.PENDING_VERIFICATION
            : record.current_state_group,
          current_assignee_id: legacyState
            ? financeId
            : record.current_assignee_id,
          transitions: {
            create: {
              from_state_code: record.current_state_code,
              to_state_code: legacyState
                ? "PENDING_FINANCE_PROCESSING"
                : record.current_state_code,
              action_code: "APPROVE_BY_MANAGER",
              actor_type: ActorType.INTERNAL_USER,
              actor_user_id: managerId,
            },
          },
        },
        include,
      }),
    );
  });
}

export async function returnClaimByManagerInDatabase(
  id: string,
  managerId: string,
  reason: string,
) {
  if (reason.trim().length < 3)
    throw new Error("Enter correction remarks before returning the Claim.");
  return prisma.$transaction(async (tx) => {
    const record = await getStoredClaim(tx, id);
    if (record.current_state_code !== "PENDING_MANAGER_APPROVAL")
      throw new Error("Only a Claim pending Manager review can be returned.");
    if (record.current_assignee_id !== managerId)
      throw new Error("This Claim is assigned to another Manager.");
    await requireRole(tx, record.organization_id, managerId, OrgRole.MANAGER);
    return mapClaim(
      await tx.submission.update({
        where: { id: record.id },
        data: {
          current_state_code: "RETURNED_TO_CLAIMANT",
          current_state_group: StateGroup.REJECTED,
          current_assignee_id: record.submitted_by_id,
          transitions: {
            create: {
              from_state_code: record.current_state_code,
              to_state_code: "RETURNED_TO_CLAIMANT",
              action_code: "RETURN_BY_MANAGER",
              actor_type: ActorType.INTERNAL_USER,
              actor_user_id: managerId,
              reason_text: reason.trim(),
            },
          },
        },
        include,
      }),
    );
  });
}

export async function verifyClaimByFinanceInDatabase(
  id: string,
  financeId: string,
) {
  return prisma.$transaction(async (tx) => {
    const record = await getStoredClaim(tx, id);
    const snapshot = readSnapshot(record);
    if (record.current_state_code !== "PENDING_FINANCE_VERIFICATION")
      throw new Error(
        "Only a Claim pending Finance verification can be forwarded.",
      );
    if (record.current_assignee_id !== financeId)
      throw new Error("This Claim is assigned to another Finance user.");
    await requireRole(
      tx,
      record.organization_id,
      financeId,
      OrgRole.FINANCE_ADMIN,
    );
    const directorStep = record.approval_steps.find(
      (step) => step.required_role === OrgRole.DIRECTOR,
    );
    if (!directorStep || !snapshot.directorApproverId)
      throw new Error("The assigned Director is missing.");
    await tx.approvalStep.update({
      where: { id: directorStep.id },
      data: { status_code: "ACTIVE" },
    });
    return mapClaim(
      await tx.submission.update({
        where: { id: record.id },
        data: {
          current_state_code: "PENDING_DIRECTOR_APPROVAL",
          current_state_group: StateGroup.IN_REVIEW,
          current_assignee_id: snapshot.directorApproverId,
          transitions: {
            create: {
              from_state_code: record.current_state_code,
              to_state_code: "PENDING_DIRECTOR_APPROVAL",
              action_code: "VERIFY_BY_FINANCE",
              actor_type: ActorType.INTERNAL_USER,
              actor_user_id: financeId,
            },
          },
        },
        include,
      }),
    );
  });
}

export async function forwardClaimByDirectorInDatabase(
  id: string,
  directorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const record = await getStoredClaim(tx, id);
    const snapshot = readSnapshot(record);
    if (snapshot.directorApproverId !== directorId)
      throw new Error("This Claim is assigned to another Director.");
    if (record.current_state_code !== "PENDING_DIRECTOR_APPROVAL")
      throw new Error(
        "Only a Claim pending Director approval can be approved.",
      );
    if (record.current_assignee_id !== directorId)
      throw new Error("This Claim is assigned to another Director.");
    await requireRole(tx, record.organization_id, directorId, OrgRole.DIRECTOR);
    const directorStep = record.approval_steps.find(
      (step) => step.required_role === OrgRole.DIRECTOR,
    );
    if (!directorStep) throw new Error("The Director review step is missing.");
    await tx.approvalStep.update({
      where: { id: directorStep.id },
      data: {
        status_code: "COMPLETE",
        decision: {
          create: { decision_code: "APPROVED", decided_by_user_id: directorId },
        },
      },
    });
    const financeId =
      snapshot.requesterRole === "finance" &&
      snapshot.requesterId !== directorId
        ? snapshot.requesterId
        : await activeFinanceUser(tx, record.organization_id);
    return mapClaim(
      await tx.submission.update({
        where: { id: record.id },
        data: {
          current_state_code: "APPROVED_FOR_PAYMENT",
          current_state_group: StateGroup.PENDING_VERIFICATION,
          current_assignee_id: financeId,
          transitions: {
            create: {
              from_state_code: record.current_state_code,
              to_state_code: "APPROVED_FOR_PAYMENT",
              action_code: "FORWARD_BY_DIRECTOR",
              actor_type: ActorType.INTERNAL_USER,
              actor_user_id: directorId,
            },
          },
        },
        include,
      }),
    );
  });
}

export async function returnClaimByDirectorInDatabase(
  id: string,
  directorId: string,
  reason: string,
) {
  if (reason.trim().length < 3)
    throw new Error("Enter correction remarks before returning the Claim.");
  return prisma.$transaction(async (tx) => {
    const record = await getStoredClaim(tx, id);
    if (record.current_state_code !== "PENDING_DIRECTOR_APPROVAL")
      throw new Error(
        "Only a Claim pending Director approval can be rejected.",
      );
    if (record.current_assignee_id !== directorId)
      throw new Error("This Claim is assigned to another Director.");
    await requireRole(tx, record.organization_id, directorId, OrgRole.DIRECTOR);
    const directorStep = record.approval_steps.find(
      (step) => step.required_role === OrgRole.DIRECTOR,
    );
    if (!directorStep) throw new Error("The Director review step is missing.");
    await tx.approvalStep.update({
      where: { id: directorStep.id },
      data: {
        status_code: "COMPLETE",
        decision: {
          create: {
            decision_code: "REJECTED",
            decided_by_user_id: directorId,
            reason_text: reason.trim(),
          },
        },
      },
    });
    return mapClaim(
      await tx.submission.update({
        where: { id: record.id },
        data: {
          current_state_code: "PAYMENT_REJECTED",
          current_state_group: StateGroup.REJECTED,
          current_assignee_id: null,
          closed_at: new Date(),
          transitions: {
            create: {
              from_state_code: record.current_state_code,
              to_state_code: "PAYMENT_REJECTED",
              action_code: "RETURN_BY_DIRECTOR",
              actor_type: ActorType.INTERNAL_USER,
              actor_user_id: directorId,
              reason_text: reason.trim(),
            },
          },
        },
        include,
      }),
    );
  });
}

export async function processClaimByFinanceInDatabase(
  id: string,
  financeId: string,
  input: ClaimFinanceInput,
) {
  if (!input.paymentDate || !input.paymentReference.trim())
    throw new Error("Payment date and payment reference are required.");
  return prisma.$transaction(async (tx) => {
    const record = await getStoredClaim(tx, id);
    if (record.current_state_code !== "APPROVED_FOR_PAYMENT")
      throw new Error(
        "The Director must approve this Claim before Finance processes payment.",
      );
    if (record.current_assignee_id !== financeId)
      throw new Error("This Claim is assigned to another Finance user.");
    await requireRole(
      tx,
      record.organization_id,
      financeId,
      OrgRole.FINANCE_ADMIN,
    );
    return mapClaim(
      await tx.submission.update({
        where: { id: record.id },
        data: {
          current_state_code: "PAYMENT_PROCESSED",
          current_state_group: StateGroup.PENDING_VERIFICATION,
          current_assignee_id: financeId,
          transitions: {
            create: {
              from_state_code: record.current_state_code,
              to_state_code: "PAYMENT_PROCESSED",
              action_code: "PROCESS_BY_FINANCE",
              actor_type: ActorType.INTERNAL_USER,
              actor_user_id: financeId,
              metadata_json: {
                paymentDate: input.paymentDate,
                paymentReference: input.paymentReference.trim(),
                notes: input.notes?.trim() || null,
              } as Prisma.InputJsonValue,
            },
          },
        },
        include,
      }),
    );
  });
}

export async function uploadClaimPaymentProofInDatabase(
  id: string,
  financeId: string,
  upload: Omit<ClaimReceiptUpload, "lineId">,
) {
  if (
    !(upload.mimeType in receiptExtensions) ||
    !upload.bytes.length ||
    upload.bytes.length > RECEIPT_MAX_SIZE
  ) {
    throw new Error(
      "Transaction proof must be a PDF, JPG or PNG file no larger than 10 MB.",
    );
  }
  const extension = receiptExtensions[upload.mimeType];
  const storageKey = `claims/payment-proofs/${safeSegment(financeId)}/${randomUUID()}.${extension}`;
  const filePath = resolvePrivateFile(storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, upload.bytes, { flag: "wx" });
  try {
    return await prisma.$transaction(async (tx) => {
      const record = await getStoredClaim(tx, id);
      if (record.current_state_code !== "PAYMENT_PROCESSED")
        throw new Error(
          "Process the Claim payment before uploading its transaction proof.",
        );
      if (record.current_assignee_id !== financeId)
        throw new Error("This Claim is assigned to another Finance user.");
      await requireRole(
        tx,
        record.organization_id,
        financeId,
        OrgRole.FINANCE_ADMIN,
      );
      const document = await tx.document.create({
        data: {
          organization_id: record.organization_id,
          document_type: "PAYMENT_PROOF",
          storage_bucket: "local-private",
          storage_key: storageKey,
          original_file_name: upload.fileName,
          mime_type: upload.mimeType,
          file_size_bytes: upload.bytes.length,
          sha256_hash: createHash("sha256").update(upload.bytes).digest("hex"),
          uploaded_by_id: financeId,
        },
      });
      return mapClaim(
        await tx.submission.update({
          where: { id: record.id },
          data: {
            current_state_code: "COMPLETED",
            current_state_group: StateGroup.COMPLETE,
            current_assignee_id: null,
            closed_at: new Date(),
            evidence: {
              create: {
                document_id: document.id,
                evidence_type_code: "PAYMENT_PROOF",
              },
            },
            transitions: {
              create: [
                {
                  from_state_code: record.current_state_code,
                  to_state_code: "TRANSACTION_PROOF_UPLOADED",
                  action_code: "UPLOAD_TRANSACTION_PROOF",
                  actor_type: ActorType.INTERNAL_USER,
                  actor_user_id: financeId,
                  metadata_json: {
                    documentId: document.id,
                    fileName: upload.fileName,
                  } as Prisma.InputJsonValue,
                },
                {
                  from_state_code: "TRANSACTION_PROOF_UPLOADED",
                  to_state_code: "COMPLETED",
                  action_code: "COMPLETE",
                  actor_type: ActorType.INTERNAL_USER,
                  actor_user_id: financeId,
                },
              ],
            },
          },
          include,
        }),
      );
    });
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  }
}

export async function returnClaimByFinanceInDatabase(
  id: string,
  financeId: string,
  reason: string,
) {
  if (reason.trim().length < 3)
    throw new Error("Enter correction remarks before returning the Claim.");
  return prisma.$transaction(async (tx) => {
    const record = await getStoredClaim(tx, id);
    if (
      !["PENDING_FINANCE_VERIFICATION", "APPROVED_FOR_PAYMENT"].includes(
        record.current_state_code,
      )
    )
      throw new Error("Only a Claim awaiting Finance action can be returned.");
    if (record.current_assignee_id !== financeId)
      throw new Error("This Claim is assigned to another Finance user.");
    await requireRole(
      tx,
      record.organization_id,
      financeId,
      OrgRole.FINANCE_ADMIN,
    );
    return mapClaim(
      await tx.submission.update({
        where: { id: record.id },
        data: {
          current_state_code: "RETURNED_TO_CLAIMANT",
          current_state_group: StateGroup.REJECTED,
          current_assignee_id: record.submitted_by_id,
          transitions: {
            create: {
              from_state_code: record.current_state_code,
              to_state_code: "RETURNED_TO_CLAIMANT",
              action_code: "RETURN_BY_FINANCE",
              actor_type: ActorType.INTERNAL_USER,
              actor_user_id: financeId,
              reason_text: reason.trim(),
            },
          },
        },
        include,
      }),
    );
  });
}

export async function readClaimReceiptFromDatabase(
  documentId: string,
  userId: string,
) {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      document_type: "SUPPORTING_DOC",
      evidence: {
        some: { submission: { payment_type: { in: CLAIM_PAYMENT_TYPES } } },
      },
    },
    include: {
      evidence: {
        where: { submission: { payment_type: { in: CLAIM_PAYMENT_TYPES } } },
        include: { submission: { select: { organization_id: true } } },
        take: 1,
      },
    },
  });
  const organizationId = document?.evidence[0]?.submission.organization_id;
  if (
    !document ||
    !organizationId ||
    document.storage_bucket !== "local-private"
  )
    return null;
  const membership = await prisma.userOrgMembership.findFirst({
    where: {
      organization_id: organizationId,
      user_id: userId,
      is_active: true,
      membership_status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!membership)
    throw new Error("You do not have access to this claim receipt.");
  return {
    document,
    bytes: await readFile(resolvePrivateFile(document.storage_key)),
  };
}

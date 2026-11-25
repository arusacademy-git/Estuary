import { createLocalNotification } from "@/data/notifications/local-notification-store";
import type { CreateNotificationInput } from "@/domain/notifications/types";
import type { ClaimRecord } from "@/domain/payment-requests/claims/types";
import { betaAccounts, type BetaAccount } from "@/lib/auth/beta-accounts";

function createSafely(input: CreateNotificationInput) {
  try {
    createLocalNotification(input);
  } catch (error) {
    console.error(
      "The Claim changed, but its notification could not be created.",
      error,
    );
  }
}

const recordHref = (record: ClaimRecord) =>
  `/beta/payment-records/claims/${encodeURIComponent(record.claimNumber)}`;

function notifyFinance(
  record: ClaimRecord,
  actor: BetaAccount,
  type: "CLAIM_SUBMITTED" | "CLAIM_MANAGER_APPROVED" | "CLAIM_DIRECTOR_FORWARDED",
  title: string,
  message: string,
) {
  const recipients =
    record.requesterRole === "finance"
      ? betaAccounts.filter((item) => item.id === record.requesterId)
      : betaAccounts.filter((item) => item.role === "finance");

  recipients.forEach((finance) =>
    createSafely({
      recipientId: finance.id,
      actorId: actor.id,
      type,
      entityType: "EXPENSE_CLAIM",
      entityId: record.id,
      referenceNumber: record.claimNumber,
      title,
      message,
      href: `/beta/finance/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`,
    }),
  );
}

export function notifyClaimSubmitted(record: ClaimRecord, actor: BetaAccount) {
  if (record.approvalRoute === "MANAGER" && (record.managerApproverIds?.length || record.managerApproverId)) {
    (record.managerApproverIds?.length ? record.managerApproverIds : [record.managerApproverId!]).forEach((managerId) => createSafely({
      recipientId: managerId,
      actorId: actor.id,
      type: "CLAIM_SUBMITTED",
      entityType: "EXPENSE_CLAIM",
      entityId: record.id,
      referenceNumber: record.claimNumber,
      title: "Claim requires Manager approval",
      message: `${actor.name} submitted ${record.claimNumber}. Your approval is required before Finance verification.`,
      href: `/beta/project-manager/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`,
    }));
    if (record.directorApproverId && record.directorApproverId !== actor.id) {
      createSafely({
        recipientId: record.directorApproverId,
        actorId: actor.id,
        type: "CLAIM_SUBMITTED",
        entityType: "EXPENSE_CLAIM",
        entityId: record.id,
        referenceNumber: record.claimNumber,
        title: "Claim submitted for your information",
        message: `${actor.name} submitted ${record.claimNumber}. The assigned Manager will approve it; no Director action is required.`,
        href: `/beta/director/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`,
      });
    }
    return;
  }
  if (record.approvalRoute === "DIRECTOR" && record.directorApproverId) {
    createSafely({
      recipientId: record.directorApproverId,
      actorId: actor.id,
      type: "CLAIM_SUBMITTED",
      entityType: "EXPENSE_CLAIM",
      entityId: record.id,
      referenceNumber: record.claimNumber,
      title: "Manager's Claim requires Director approval",
      message: `${actor.name} submitted ${record.claimNumber}. Your approval is required before Finance verification.`,
      href: `/beta/director/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`,
    });
    (record.managerApproverIds ?? []).filter((id) => id !== actor.id).forEach((managerId) => createSafely({
      recipientId: managerId,
      actorId: actor.id,
      type: "CLAIM_SUBMITTED",
      entityType: "EXPENSE_CLAIM",
      entityId: record.id,
      referenceNumber: record.claimNumber,
      title: "Claim submitted for your information",
      message: `${actor.name} submitted ${record.claimNumber}. Director approval is required; no Manager action is needed.`,
      href: `/beta/project-manager/payment-requests/claims/${encodeURIComponent(record.claimNumber)}`,
    }));
    return;
  }
  if (record.status !== "PENDING_FINANCE_VERIFICATION") return;
  notifyFinance(
    record,
    actor,
    "CLAIM_SUBMITTED",
    "Claim requires Finance verification",
    `${actor.name} submitted ${record.claimNumber}. Verify the Claim before sending it to the assigned Director.`,
  );
}

export function notifyClaimManagerApproved(
  record: ClaimRecord,
  actor: BetaAccount,
) {
  if (record.approvalRoute === "MANAGER" && record.status === "PENDING_FINANCE_VERIFICATION") {
    notifyFinance(record, actor, "CLAIM_MANAGER_APPROVED", "Claim requires Finance verification", `${actor.name} approved ${record.claimNumber}. Finance verification can begin.`);
  }
  createSafely({
    recipientId: record.requesterId,
    actorId: actor.id,
    type: "CLAIM_MANAGER_APPROVED",
    entityType: "EXPENSE_CLAIM",
    entityId: record.id,
    referenceNumber: record.claimNumber,
    title: record.approvalRoute === "MANAGER" ? "Claim approved by Manager" : "Manager preview recorded",
    message: record.approvalRoute === "MANAGER" ? record.status === "PENDING_FINANCE_VERIFICATION" ? `${actor.name} approved ${record.claimNumber}. All assigned Managers have approved; it has moved to Finance.` : `${actor.name} approved their programme entries in ${record.claimNumber}. Other Manager approvals are still pending.` : `${actor.name} completed the informational preview for ${record.claimNumber}. Finance processing continues independently.`,
    href: recordHref(record),
  });
}

export function notifyClaimDirectorForwarded(
  record: ClaimRecord,
  actor: BetaAccount,
) {
  createSafely({
    recipientId: record.requesterId,
    actorId: actor.id,
    type: "CLAIM_DIRECTOR_FORWARDED",
    entityType: "EXPENSE_CLAIM",
    entityId: record.id,
    referenceNumber: record.claimNumber,
    title: "Claim approved for payment",
    message: `${actor.name} approved ${record.claimNumber}. It has returned to Finance for payment processing.`,
    href: recordHref(record),
  });
  if (record.status === "APPROVED_FOR_PAYMENT" || record.approvalRoute === "DIRECTOR" && record.status === "PENDING_FINANCE_VERIFICATION") {
    notifyFinance(
      record,
      actor,
      "CLAIM_DIRECTOR_FORWARDED",
      record.status === "APPROVED_FOR_PAYMENT" ? "Claim approved for payment" : "Claim requires Finance verification",
      record.status === "APPROVED_FOR_PAYMENT" ? `${record.claimNumber} was approved by the assigned Director and is ready for payment processing.` : `${record.claimNumber} was approved by the assigned Director and requires Finance verification.`,
    );
  }
}

export function notifyClaimReturned(
  record: ClaimRecord,
  actor: BetaAccount,
  stage: "Manager" | "Director" | "Finance",
) {
  createSafely({
    recipientId: record.requesterId,
    actorId: actor.id,
    type: "CLAIM_RETURNED",
    entityType: "EXPENSE_CLAIM",
    entityId: record.id,
    referenceNumber: record.claimNumber,
    title:
      stage === "Director"
        ? "Claim payment rejected"
        : "Claim returned for correction",
    message:
      stage === "Director"
        ? `${actor.name} rejected ${record.claimNumber}. Review the rejection reason in Payment Records.`
        : `${stage} returned ${record.claimNumber}. Review the correction notes before resubmitting.`,
    href: recordHref(record),
  });
}

export function notifyClaimPaid(record: ClaimRecord, actor: BetaAccount) {
  createSafely({
    recipientId: record.requesterId,
    actorId: actor.id,
    type: "CLAIM_PAID",
    entityType: "EXPENSE_CLAIM",
    entityId: record.id,
    referenceNumber: record.claimNumber,
    title: "Claim payment processed",
    message: `${record.claimNumber} was processed by Finance. Transaction proof will be available after it is uploaded.`,
    href: recordHref(record),
  });
}

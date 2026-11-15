import type { PaymentVoucherStatus } from "@/domain/payment-vouchers/status";
import type { PaymentVoucherRecord } from "@/domain/payment-vouchers/types";
import { betaAccounts } from "@/lib/auth/beta-accounts";
import { PaymentProgressTimeline } from "@/features/payment-records/components/shared/payment-progress-timeline";
import {
  businessMinutesBetween,
  formatBusinessDuration,
} from "@/features/payment-records/components/shared/payment-progress-duration";
import type {
  PaymentProgressStage,
  PaymentProgressSummary,
} from "@/features/payment-records/components/shared/payment-progress-types";

const afterDirectorApproval = new Set<PaymentVoucherStatus>([
  "APPROVED_FOR_PAYMENT",
  "FINANCE_PROCESSING",
  "AWAITING_RECIPIENT_SIGNATURE",
  "AWAITING_STAFF_CONFIRMATION",
  "PENDING_FINANCE_VERIFICATION",
  "COMPLETED",
  "INACTIVE",
  "AWAITING_SIGNED_PV_UPLOAD",
  "AWAITING_STAFF_VERIFICATION",
  "AWAITING_SIGNATURE",
]);

const afterFinanceProcessing = new Set<PaymentVoucherStatus>([
  "AWAITING_RECIPIENT_SIGNATURE",
  "AWAITING_STAFF_CONFIRMATION",
  "PENDING_FINANCE_VERIFICATION",
  "COMPLETED",
  "AWAITING_SIGNED_PV_UPLOAD",
  "AWAITING_STAFF_VERIFICATION",
  "AWAITING_SIGNATURE",
]);

const afterRecipientSignature = new Set<PaymentVoucherStatus>([
  "AWAITING_STAFF_CONFIRMATION",
  "PENDING_FINANCE_VERIFICATION",
  "COMPLETED",
]);

const afterStaffConfirmation = new Set<PaymentVoucherStatus>([
  "PENDING_FINANCE_VERIFICATION",
  "COMPLETED",
]);

type VoucherWithSubmission = PaymentVoucherRecord & { submittedAt?: string };

function submissionTime(voucher: VoucherWithSubmission) {
  if (voucher.status === "DRAFT") return null;
  return voucher.submittedAt ?? voucher.createdAt;
}

function createStages(
  voucher: VoucherWithSubmission,
  directorName: string,
): PaymentProgressStage[] {
  const submittedAt = submissionTime(voucher);
  const directorFinishedAt =
    voucher.directorApprovedAt ??
    (voucher.status === "REJECTED" ? voucher.updatedAt : null);
  const directorApproved =
    Boolean(voucher.directorApprovedAt) ||
    afterDirectorApproval.has(voucher.status);
  const financeFinishedAt = voucher.pvPdfGeneratedAt ?? null;
  const financeFinished =
    Boolean(financeFinishedAt) || afterFinanceProcessing.has(voucher.status);
  const recipientFinishedAt =
    voucher.recipientSignedAt ?? voucher.signedPvUploadedAt ?? null;
  const recipientFinished =
    Boolean(recipientFinishedAt) || afterRecipientSignature.has(voucher.status);
  const staffFinishedAt =
    voucher.staffConfirmedSignedPvAt ?? voucher.staffVerifiedAt ?? null;
  const staffFinished =
    Boolean(staffFinishedAt) || afterStaffConfirmation.has(voucher.status);
  const completedAt =
    voucher.financeVerifiedAt ??
    (voucher.status === "COMPLETED" ? voucher.updatedAt : null);

  const submissionState: PaymentProgressStage["state"] =
    voucher.status === "DRAFT" ? "current" : "complete";
  const directorState: PaymentProgressStage["state"] =
    voucher.status === "REJECTED"
      ? "rejected"
      : voucher.status === "PENDING_DIRECTOR_APPROVAL"
        ? "current"
        : directorApproved
          ? "complete"
          : "pending";
  const managerState: PaymentProgressStage["state"] =
    voucher.projectManagerViewedAt
      ? "complete"
      : voucher.status === "APPROVED_FOR_PAYMENT"
        ? "current"
        : "pending";
  const financeState: PaymentProgressStage["state"] =
    voucher.status === "INACTIVE"
      ? "rejected"
      : ["APPROVED_FOR_PAYMENT", "FINANCE_PROCESSING"].includes(voucher.status)
        ? "current"
        : financeFinished
          ? "complete"
          : "pending";
  const recipientState: PaymentProgressStage["state"] = [
    "AWAITING_RECIPIENT_SIGNATURE",
    "AWAITING_SIGNED_PV_UPLOAD",
    "AWAITING_STAFF_VERIFICATION",
    "AWAITING_SIGNATURE",
  ].includes(voucher.status)
    ? "current"
    : recipientFinished
      ? "complete"
      : "pending";
  const staffState: PaymentProgressStage["state"] =
    voucher.status === "AWAITING_STAFF_CONFIRMATION"
      ? "current"
      : staffFinished
        ? "complete"
        : "pending";
  const verificationState: PaymentProgressStage["state"] =
    voucher.status === "PENDING_FINANCE_VERIFICATION"
      ? "current"
      : voucher.status === "COMPLETED"
        ? "complete"
        : "pending";

  return [
    {
      id: "submission",
      kind: "submission",
      title: "Payment Voucher submitted",
      description:
        submissionState === "complete"
          ? "Staff submitted the Payment Voucher successfully."
          : "Complete the draft and submit it for Director approval.",
      actorName: betaAccounts.find((item) => item.id === voucher.submitterId)
        ?.name,
      actorRole: "Staff",
      state: submissionState,
      receivedAt: submittedAt,
      completedAt: submittedAt,
    },
    {
      id: "director-approval",
      kind: "approval",
      title: "Director approval and signature",
      description:
        directorState === "rejected"
          ? `${directorName} rejected the Payment Voucher. Staff must amend and resubmit it.`
          : directorState === "complete"
            ? `${directorName} approved and signed the Payment Voucher.`
            : directorState === "current"
              ? `Waiting for ${directorName} to review, approve and sign.`
              : "Director review begins after submission.",
      actorName: directorName,
      actorRole: "Director",
      state: directorState,
      receivedAt: submittedAt,
      completedAt: directorFinishedAt,
    },
    {
      id: "project-manager-preview",
      kind: "approval",
      title: "Manager preview",
      description: voucher.projectManagerViewedAt
        ? "The Manager viewed the approved Payment Voucher."
        : directorApproved
          ? "The approved Payment Voucher is available for Manager preview."
          : "Manager preview becomes available after Director approval.",
      actorName: voucher.projectManagerId
        ? betaAccounts.find((item) => item.id === voucher.projectManagerId)
            ?.name
        : undefined,
      actorRole: "Manager",
      informational: true,
      state: managerState,
      receivedAt: voucher.directorApprovedAt,
      completedAt: voucher.projectManagerViewedAt,
    },
    {
      id: "finance-processing",
      kind: "processing",
      title: "Finance payment processing",
      description:
        financeState === "rejected"
          ? "Finance marked this Payment Voucher as inactive."
          : financeState === "complete"
            ? "Finance recorded the payment and generated the completed PV PDF."
            : financeState === "current"
              ? "Finance is recording payment information and generating the PV PDF."
              : "Finance processing begins after Director approval.",
      actorName: voucher.paymentMadeById
        ? betaAccounts.find((item) => item.id === voucher.paymentMadeById)?.name
        : undefined,
      actorRole: "Finance",
      state: financeState,
      receivedAt: voucher.directorApprovedAt,
      actionStartedAt: voucher.financeReviewedAt,
      completedAt:
        financeState === "rejected" ? voucher.inactiveAt : financeFinishedAt,
    },
    {
      id: "recipient-signature",
      kind: "processing",
      title: "Recipient verification and signature",
      description:
        recipientState === "complete"
          ? `${voucher.recipientName} verified and signed the Payment Voucher.`
          : recipientState === "current"
            ? voucher.recipientLinkSentAt
              ? `The secure link was sent to ${voucher.recipientName}. Waiting for verification and signature.`
              : `Staff must send the secure link to ${voucher.recipientName}.`
            : "Recipient signing begins after Finance generates the PV PDF.",
      actorName: voucher.recipientName,
      actorRole: "Recipient",
      state: recipientState,
      receivedAt: financeFinishedAt,
      actionStartedAt: voucher.recipientLinkSentAt,
      completedAt: recipientFinishedAt,
    },
    {
      id: "staff-confirmation",
      kind: "processing",
      title: "Staff confirms signed PV",
      description:
        staffState === "complete"
          ? "Staff confirmed receipt of the signed Payment Voucher."
          : staffState === "current"
            ? "Review the signed Payment Voucher and confirm receipt."
            : "Staff confirmation opens after the recipient signs.",
      actorName: voucher.staffConfirmedSignedPvById
        ? betaAccounts.find(
            (item) => item.id === voucher.staffConfirmedSignedPvById,
          )?.name
        : undefined,
      actorRole: "Staff",
      state: staffState,
      receivedAt: recipientFinishedAt,
      completedAt: staffFinishedAt,
    },
    {
      id: "finance-verification",
      kind: "processing",
      title: "Finance archive verification",
      description:
        verificationState === "complete"
          ? "Finance verified the signed Payment Voucher."
          : verificationState === "current"
            ? "Finance must verify the signed PV before completing the record."
            : "Final verification begins after Staff confirmation.",
      actorName: voucher.financeCompletedById
        ? betaAccounts.find((item) => item.id === voucher.financeCompletedById)
            ?.name
        : undefined,
      actorRole: "Finance",
      state: verificationState,
      receivedAt: staffFinishedAt,
      completedAt,
    },
    {
      id: "completed",
      kind: "completion",
      title: "Payment Voucher completed",
      description:
        voucher.status === "COMPLETED"
          ? "The Payment Voucher is complete, archived and locked."
          : voucher.status === "INACTIVE"
            ? "This Payment Voucher is inactive and cannot continue."
            : "The record closes after final Finance verification.",
      state: voucher.status === "COMPLETED" ? "complete" : "pending",
      receivedAt: completedAt,
      completedAt,
    },
  ];
}

function currentUpdate(voucher: PaymentVoucherRecord) {
  const updates: Partial<Record<PaymentVoucherStatus, string>> = {
    DRAFT: "Complete this draft",
    PENDING_DIRECTOR_APPROVAL: "Waiting for Director approval",
    REJECTED: "Amendment required",
    APPROVED_FOR_PAYMENT: "Ready for Finance processing",
    FINANCE_PROCESSING: "Finance is processing payment",
    AWAITING_RECIPIENT_SIGNATURE: "Waiting for recipient signature",
    AWAITING_STAFF_CONFIRMATION: "Staff confirmation required",
    PENDING_FINANCE_VERIFICATION: "Waiting for Finance verification",
    COMPLETED: "Payment Voucher completed",
    INACTIVE: "Payment Voucher inactive",
    AWAITING_SIGNED_PV_UPLOAD: "Waiting for signed PV upload",
    AWAITING_STAFF_VERIFICATION: "Staff verification required",
    AWAITING_SIGNATURE: "Waiting for recipient signature",
  };
  return updates[voucher.status] ?? "Status update unavailable";
}

export function PaymentVoucherTracker({
  voucher,
}: {
  voucher: PaymentVoucherRecord;
}) {
  const extendedVoucher = voucher as VoucherWithSubmission;
  const directorName =
    betaAccounts.find((account) => account.id === voucher.directorId)?.name ??
    "the assigned Director";
  const stages = createStages(extendedVoucher, directorName);
  const submittedAt = submissionTime(extendedVoucher);
  const lifecycleEnd =
    voucher.financeVerifiedAt ??
    (voucher.status === "COMPLETED" ? voucher.updatedAt : new Date());
  const summaries: PaymentProgressSummary[] = [
    {
      label: "Current update",
      value: currentUpdate(voucher),
      tone:
        voucher.status === "COMPLETED"
          ? "success"
          : ["REJECTED", "INACTIVE"].includes(voucher.status)
            ? "danger"
            : "active",
    },
  ];

  if (submittedAt) {
    summaries.push({
      label:
        voucher.status === "COMPLETED"
          ? "Total processing time"
          : "Elapsed processing time",
      value: formatBusinessDuration(
        businessMinutesBetween(submittedAt, lifecycleEnd),
      ),
      tone: voucher.status === "COMPLETED" ? "success" : "neutral",
    });
  }

  return <PaymentProgressTimeline stages={stages} summaries={summaries} />;
}

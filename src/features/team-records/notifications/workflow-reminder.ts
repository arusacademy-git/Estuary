import { createLocalNotification } from "@/data/notifications/local-notification-store";
import type { TeamRecord } from "@/data/team-records/team-records-api";
import type { NotificationEntityType } from "@/domain/notifications/types";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

export type WorkflowReminderStage = "APPROVAL" | "PAYMENT" | "RECONCILIATION";

const entityTypes: Record<TeamRecord["paymentType"], NotificationEntityType> = {
    PAYMENT_VOUCHER: "PAYMENT_VOUCHER",
    INVOICE_PAYMENT: "INVOICE_PAYMENT",
    TRAVEL_ALLOWANCE: "TRAVEL_ALLOWANCE",
    CASH_ADVANCE: "CASH_ADVANCE",
    PETTY_CASH: "PETTY_CASH",
    EXPENSE_CLAIM: "EXPENSE_CLAIM",
};

export function workflowReminderAction(
    record: TeamRecord,
    stage: WorkflowReminderStage,
) {
    if (stage === "RECONCILIATION")
        return {
            label: "Remind requester",
            recipientId: record.requesterId,
            recipientLabel: "requester",
        };
    if (stage === "PAYMENT")
        return {
            label: "Remind Finance",
            recipientId: record.currentAssigneeId,
            recipientLabel: "Finance",
        };
    if (record.status.includes("DIRECTOR"))
        return {
            label: "Remind Director",
            recipientId: record.currentAssigneeId,
            recipientLabel: "Director",
        };
    if (record.status.includes("MANAGER"))
        return {
            label: "Remind Manager",
            recipientId: record.currentAssigneeId,
            recipientLabel: "Manager",
        };
    return {
        label: "Remind approver",
        recipientId: record.currentAssigneeId,
        recipientLabel: "approver",
    };
}

export function sendWorkflowReminder({
    account,
    record,
    stage,
}: {
    account: BetaAccount;
    record: TeamRecord;
    stage: WorkflowReminderStage;
}) {
    const action = workflowReminderAction(record, stage);
    if (!action.recipientId)
        throw new Error(`No ${action.recipientLabel} is assigned to this request.`);

    return createLocalNotification({
        actorId: account.id,
        entityId: record.id,
        entityType: entityTypes[record.paymentType],
        href: record.href,
        message: `${account.name} sent a reminder for ${record.reference}. Open the request to continue the required action.`,
        recipientId: action.recipientId,
        referenceNumber: record.reference,
        title: `Reminder from ${account.name}`,
        type: "GENERAL",
    });
}

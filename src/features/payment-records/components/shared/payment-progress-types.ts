export type PaymentProgressState =
    | "complete"
    | "current"
    | "pending"
    | "returned"
    | "rejected";

export type PaymentProgressStageKind =
    | "submission"
    | "approval"
    | "processing"
    | "payment"
    | "reconciliation"
    | "correction"
    | "completion";

export type PaymentProgressStage = {
    id: string;
    title: string;
    description?: string;
    actorName?: string;
    actorRole?: string;
    kind?: PaymentProgressStageKind;
    state: PaymentProgressState;
    /** When this stage entered the responsible person's queue. */
    receivedAt?: string | Date | null;
    /** Set only after an explicit start/open-for-work event is recorded. */
    actionStartedAt?: string | Date | null;
    /** The immutable workflow-transition time that closed this stage. */
    completedAt?: string | Date | null;
    targetBusinessMinutes?: number;
    badge?: string;
    informational?: boolean;
};

export type PaymentProgressSummary = {
    label: string;
    value: string;
    tone?: "neutral" | "active" | "success" | "warning" | "danger";
};

export type BusinessCalendar = {
    /** Local ISO dates (YYYY-MM-DD) that do not count as working time. */
    holidays?: readonly string[];
    workingWeekdays?: readonly number[];
    workdayStartHour?: number;
    workdayEndHour?: number;
};

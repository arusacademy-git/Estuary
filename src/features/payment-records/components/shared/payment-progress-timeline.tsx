import {
  businessMinutesBetween,
  formatBusinessDuration,
  formatTimelineTimestamp,
} from "./payment-progress-duration";
import type {
  BusinessCalendar,
  PaymentProgressStage,
  PaymentProgressSummary,
} from "./payment-progress-types";

import styles from "./payment-progress-timeline.module.css";

type PaymentProgressTimelineProps = {
  stages: readonly PaymentProgressStage[];
  summaries?: readonly PaymentProgressSummary[];
  calendar?: BusinessCalendar;
  now?: string | Date;
  title?: string;
};

function durationRows(
  stage: PaymentProgressStage,
  now: string | Date,
  calendar: BusinessCalendar,
) {
  if (!stage.receivedAt) return [];
  const stageEnd = stage.completedAt ?? now;
  const rows: Array<{ label: string; value: string; late?: boolean }> = [];

  if (stage.actionStartedAt) {
    const waiting = businessMinutesBetween(
      stage.receivedAt,
      stage.actionStartedAt,
      calendar,
    );
    rows.push({
      label: "Waiting",
      value: formatBusinessDuration(waiting, calendar),
    });
    const action = businessMinutesBetween(
      stage.actionStartedAt,
      stageEnd,
      calendar,
    );
    rows.push({
      label: "Action",
      value: formatBusinessDuration(action, calendar),
    });
  } else if (stage.state !== "pending") {
    const processing = businessMinutesBetween(
      stage.receivedAt,
      stageEnd,
      calendar,
    );
    rows.push({
      label: stage.state === "current" ? "Waiting" : "Stage duration",
      value: formatBusinessDuration(processing, calendar),
      late:
        stage.state === "current" &&
        Boolean(
          stage.targetBusinessMinutes &&
          processing > stage.targetBusinessMinutes,
        ),
    });
  }

  return rows;
}

export function PaymentProgressTimeline({
  stages,
  summaries = [],
  calendar = {},
  now = new Date(),
  title = "Payment progress",
}: PaymentProgressTimelineProps) {
  const completedCount = stages.filter((stage) =>
    ["complete", "returned", "rejected"].includes(stage.state),
  ).length;
  const currentIndex = stages.findIndex(
    (stage) => stage.state === "current" && !stage.informational,
  );
  const displayedStep = Math.min(
    stages.length,
    currentIndex >= 0 ? currentIndex + 1 : Math.max(1, completedCount),
  );

  return (
    <section className={styles.timeline} aria-label={title}>
      <header className={styles.header}>
        <p>{title}</p>
        <span>
          Step {displayedStep} of {stages.length}
        </span>
      </header>

      {summaries.length > 0 && (
        <div className={styles.summaryGrid}>
          {summaries.map((summary) => (
            <div data-tone={summary.tone ?? "neutral"} key={summary.label}>
              <span>{summary.label}</span>
              <strong>{summary.value}</strong>
            </div>
          ))}
        </div>
      )}

      <ol className={styles.steps}>
        {stages.map((stage) => {
          const timestamp = formatTimelineTimestamp(
            stage.completedAt ?? stage.actionStartedAt ?? stage.receivedAt,
          );
          const durations = durationRows(stage, now, calendar);
          return (
            <li data-state={stage.state} key={stage.id}>
              <i aria-hidden="true">
                {stage.state === "complete"
                  ? "✓"
                  : stage.state === "returned"
                    ? "↩"
                    : stage.state === "rejected"
                      ? "×"
                      : ""}
              </i>
              <div className={styles.stageBody}>
                <div className={styles.stageHeading}>
                  <strong>{stage.title}</strong>
                  {stage.informational && <em>Informational</em>}
                  {stage.badge && <em>{stage.badge}</em>}
                  {timestamp && <time>{timestamp}</time>}
                </div>
                {(stage.actorName || stage.actorRole) && (
                  <span className={styles.actor}>
                    {[stage.actorName, stage.actorRole]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
                {stage.description && <small>{stage.description}</small>}
                {durations.length > 0 && (
                  <div className={styles.durations}>
                    {durations.map((duration) => (
                      <span
                        data-late={duration.late || undefined}
                        key={duration.label}
                      >
                        {duration.label}: <b>{duration.value}</b>
                      </span>
                    ))}
                    {stage.targetBusinessMinutes &&
                    stage.state === "current" ? (
                      <span>
                        Target:{" "}
                        <b>
                          {formatBusinessDuration(
                            stage.targetBusinessMinutes,
                            calendar,
                          )}
                        </b>
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

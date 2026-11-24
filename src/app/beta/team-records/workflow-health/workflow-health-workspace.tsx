"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { ListPagination } from "@/components/ui/list-pagination/list-pagination";
import { useListPagination } from "@/components/ui/list-pagination/use-list-pagination";
import {
  teamProjectOptions,
  teamRecordGroup,
  type TeamRecord,
} from "@/data/team-records/team-records-api";
import type { BetaAccount } from "@/lib/auth/beta-accounts";
import {
  sendWorkflowReminder,
  workflowReminderAction,
} from "@/features/team-records/notifications/workflow-reminder";

import styles from "./workflow-health.module.css";

export type WorkflowStage = "APPROVAL" | "PAYMENT" | "RECONCILIATION";
type Period = "3" | "6" | "12" | "ALL";

const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short" }).format(
    new Date(value),
  );

function stageFor(record: TeamRecord): WorkflowStage | null {
  if (
    ["CASH_ADVANCE", "PETTY_CASH"].includes(record.paymentType) &&
    record.status.includes("RECONCILIATION")
  )
    return "RECONCILIATION";
  const group = teamRecordGroup(record);
  if (group === "APPROVAL") return "APPROVAL";
  if (group === "PAYMENT") return "PAYMENT";
  return null;
}

function waitingDays(record: TeamRecord) {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(record.submittedAt).getTime()) / 86_400_000,
    ),
  );
}

function waitingOn(record: TeamRecord, stage: WorkflowStage) {
  if (stage === "RECONCILIATION")
    return { person: record.requesterName, detail: "Submit receipts" };
  if (stage === "PAYMENT")
    return { person: "Finance", detail: "Payment release" };
  if (record.status.includes("DIRECTOR"))
    return { person: "Director", detail: "Director approval" };
  if (record.status.includes("MANAGER"))
    return { person: "Manager", detail: "Manager approval" };
  return { person: "Approval team", detail: "Approval decision" };
}

function roleCopy(role: BetaAccount["role"] | undefined) {
  if (role === "finance")
    return {
      title: "Where requests are",
      description:
        "Every open request across all projects: who it is waiting on, for how long, and what to do next.",
      approval: "In approval",
      payment: "With Finance",
      approvalNote: "With managers or directors",
      paymentNote: "Approved, not yet closed",
    };
  if (role === "director")
    return {
      title: "Workflow health",
      description:
        "See where requests across the organisation are waiting, who they are waiting on and for how long.",
      approval: "Awaiting review",
      payment: "Awaiting payment",
      approvalNote: "In approval queues",
      paymentNote: "Approved, with Finance",
    };
  return {
    title: "Workflow health",
    description:
      "See where your team’s requests are waiting, who they are waiting on and for how long.",
    approval: "Awaiting review",
    payment: "Awaiting payment",
    approvalNote: "In approval queues",
    paymentNote: "Approved, with Finance",
  };
}

export function WorkflowHealthWorkspace({
  account,
  error,
  initialStage,
  loading,
  records,
}: {
  account?: BetaAccount;
  error?: string;
  initialStage: WorkflowStage;
  loading: boolean;
  records: TeamRecord[];
}) {
  const [stage, setStage] = useState(initialStage);
  const [project, setProject] = useState("ALL");
  const [period, setPeriod] = useState<Period>("6");
  const [reminderStatus, setReminderStatus] = useState<{
    message: string;
    tone: "error" | "success";
  }>();
  const copy = roleCopy(account?.role);
  const now = new Date();
  const scoped = records.filter((record) => {
    if (project !== "ALL" && record.projectCode !== project) return false;
    if (period === "ALL") return true;
    const threshold = new Date(now);
    threshold.setMonth(threshold.getMonth() - Number(period));
    return new Date(record.submittedAt) >= threshold;
  });
  const stageRecords = scoped
    .filter((record) => stageFor(record) === stage)
    .sort((left, right) => waitingDays(right) - waitingDays(left));
  const pagination = useListPagination(stageRecords, 10);
  const stageCounts = {
    APPROVAL: scoped.filter((record) => stageFor(record) === "APPROVAL").length,
    PAYMENT: scoped.filter((record) => stageFor(record) === "PAYMENT").length,
    RECONCILIATION: scoped.filter(
      (record) => stageFor(record) === "RECONCILIATION",
    ).length,
  };
  const oldest = (nextStage: WorkflowStage) =>
    Math.max(
      0,
      ...scoped
        .filter((record) => stageFor(record) === nextStage)
        .map(waitingDays),
    );

  if (loading)
    return <main className={styles.state}>Loading Workflow health…</main>;
  if (error) return <main className={styles.state}>{error}</main>;

  const meta = {
    APPROVAL: {
      eyebrow: "Approval stage",
      title: copy.approval,
      description: "Requests waiting for an approval decision, oldest first.",
    },
    PAYMENT: {
      eyebrow: "Payment stage",
      title: copy.payment,
      description: "Approved requests that Finance has not closed yet.",
    },
    RECONCILIATION: {
      eyebrow: "Reconciliation",
      title: "Unreconciled cash advances",
      description: "Paid advances still waiting for receipts.",
    },
  }[stage];

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/beta/team-records">Team records</Link>
        <span>/</span>
        <Link href="/beta/team-records?view=analysis">Analysis</Link>
        <span>/</span>
        <strong>{copy.title}</strong>
      </nav>
      <header className={styles.hero}>
        <div>
          <p>Team records · Analysis</p>
          <h1>{copy.title}</h1>
          <span>{copy.description}</span>
        </div>
        <Link href="/beta/team-records?view=analysis">← Back to analysis</Link>
      </header>
      <section className={styles.stageCards}>
        {(
          [
            [
              "APPROVAL",
              copy.approval,
              copy.approvalNote,
              "/assets/icons/clipboard-check.png",
            ],
            [
              "PAYMENT",
              copy.payment,
              copy.paymentNote,
              "/assets/icons/payment-records-light.png",
            ],
            [
              "RECONCILIATION",
              "Unreconciled",
              "Cash advances without receipts",
              "/assets/icons/reconciliation-sync-white.png",
            ],
          ] as const
        ).map(([value, label, note, icon]) => (
          <button
            aria-pressed={stage === value}
            data-tone={value}
            key={value}
            onClick={() => setStage(value)}
            type="button"
          >
            <span>{label}</span>
            <strong>{stageCounts[value]}</strong>
            <small>
              {note} · oldest {oldest(value)} days
            </small>
            <i>
              <Image alt="" height={18} src={icon} width={18} />
            </i>
            {stage === value && <em>Showing</em>}
          </button>
        ))}
      </section>
      <section className={styles.queue}>
        <header>
          <div>
            <p>{meta.eyebrow}</p>
            <h2>{meta.title}</h2>
            <span>{meta.description}</span>
          </div>
          <strong>
            {stageRecords.length} waiting ·{" "}
            {money(
              stageRecords.reduce((sum, record) => sum + record.amount, 0),
            )}
          </strong>
        </header>
        <div className={styles.filters}>
          <label>
            Project
            <select
              value={project}
              onChange={(event) => setProject(event.target.value)}
            >
              <option value="ALL">All assigned projects</option>
              {teamProjectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Period
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="ALL">All time</option>
            </select>
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Requester</th>
                <th>Amount</th>
                <th>Waiting on</th>
                <th>{stage === "RECONCILIATION" ? "Due" : "Waiting for"}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageRecords.map((record) => {
                const waiting = waitingOn(record, stage);
                const days = waitingDays(record);
                const ownsAction =
                  (stage === "PAYMENT" && account?.role === "finance") ||
                  (stage === "APPROVAL" &&
                    Boolean(
                      account?.id && record.currentAssigneeId === account.id,
                    ));
                const reminder = workflowReminderAction(record, stage);
                return (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.reference}</strong>
                      <small>{record.purpose}</small>
                    </td>
                    <td>{record.requesterName}</td>
                    <td>
                      <strong>{money(record.amount)}</strong>
                    </td>
                    <td>
                      <strong>{waiting.person}</strong>
                      <small>{waiting.detail}</small>
                    </td>
                    <td>
                      <span
                        className={styles.age}
                        data-age={
                          days >= 7 ? "late" : days >= 4 ? "warning" : "good"
                        }
                      >
                        {stage === "RECONCILIATION" && days >= 7
                          ? `${days} days overdue`
                          : `${days} days`}
                      </span>
                      <small>Since {shortDate(record.submittedAt)}</small>
                    </td>
                    <td>
                      {ownsAction ? (
                        <Link href={record.href}>
                          {stage === "PAYMENT" ? "Process" : "Review"}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!account) return;
                            try {
                              sendWorkflowReminder({ account, record, stage });
                              setReminderStatus({
                                message: `${reminder.label} notification sent for ${record.reference}.`,
                                tone: "success",
                              });
                            } catch (reminderError) {
                              setReminderStatus({
                                message:
                                  reminderError instanceof Error
                                    ? reminderError.message
                                    : "The reminder could not be sent.",
                                tone: "error",
                              });
                            }
                          }}
                        >
                          {reminder.label}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!pagination.totalRecords && (
            <p className={styles.empty}>
              No requests match this stage and filter.
            </p>
          )}
        </div>
        {reminderStatus && (
          <p
            className={styles.reminderStatus}
            data-tone={reminderStatus.tone}
            role="status"
          >
            {reminderStatus.message}
          </p>
        )}
        <div className={styles.legend}>
          <span data-tone="good">Under 4 days</span>
          <span data-tone="warning">4–6 days</span>
          <span data-tone="late">7 days or more, or overdue</span>
        </div>
        <ListPagination
          currentPage={pagination.currentPage}
          firstRecord={pagination.firstRecord}
          lastRecord={pagination.lastRecord}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalRecords={pagination.totalRecords}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>
    </main>
  );
}

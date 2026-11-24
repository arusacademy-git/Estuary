"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { ListPagination } from "@/components/ui/list-pagination/list-pagination";
import { useListPagination } from "@/components/ui/list-pagination/use-list-pagination";
import {
  completedTeamStatuses,
  inactiveTeamStatuses,
  teamProjectOptions,
  teamRecordGroup,
  teamRecordTypeLabels,
  type TeamRecord,
} from "@/data/team-records/team-records-api";
import type { DashboardSummaryPaymentType } from "@/domain/dashboard/types";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "./team-records.module.css";

type View = "RECORDS" | "ANALYSIS";
export type TeamRecordGroup =
  | "APPROVAL"
  | "PAYMENT"
  | "COMPLETED"
  | "RECONCILED"
  | "INACTIVE";
type AnalysisView = "TREND" | "TYPE";
type Period = "3" | "6" | "12" | "ALL";

const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const groupMeta: Array<{
  value: TeamRecordGroup;
  label: string;
  note: string;
  icon: string;
}> = [
  {
    value: "APPROVAL",
    label: "Pending approval",
    note: "Waiting for a decision",
    icon: "/assets/icons/clipboard-check.png",
  },
  {
    value: "PAYMENT",
    label: "Awaiting payment",
    note: "Approved, not yet paid",
    icon: "/assets/icons/payment-records-light.png",
  },
  {
    value: "COMPLETED",
    label: "Completed",
    note: "Paid and closed",
    icon: "/assets/icons/completed-check-white.png",
  },
  {
    value: "RECONCILED",
    label: "Reconciled",
    note: "Advances settled",
    icon: "/assets/icons/reconciliation-sync-white.png",
  },
  {
    value: "INACTIVE",
    label: "Rejected / inactive",
    note: "Not taken forward",
    icon: "/assets/icons/rejected-inactive-shield-white.png",
  },
];

export function TeamRecordsWorkspace({
  account,
  error,
  initialGroup = "APPROVAL",
  initialView = "RECORDS",
  loading = false,
  records,
}: {
  account?: BetaAccount;
  error?: string;
  initialGroup?: TeamRecordGroup;
  initialView?: View;
  loading?: boolean;
  records: TeamRecord[];
}) {
  const [view, setView] = useState<View>(initialView);
  const [group, setGroup] = useState<TeamRecordGroup>(initialGroup);
  const [project, setProject] = useState("ALL");
  const [period, setPeriod] = useState<Period>("6");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | DashboardSummaryPaymentType>("ALL");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [exactDate, setExactDate] = useState("");
  const [minimumAmount, setMinimumAmount] = useState("");
  const [maximumAmount, setMaximumAmount] = useState("");
  const [analysisView, setAnalysisView] = useState<AnalysisView>("TREND");

  const now = new Date();
  const periodRecords = records.filter((record) => {
    if (period === "ALL") return true;
    const threshold = new Date(now);
    threshold.setMonth(threshold.getMonth() - Number(period));
    return new Date(record.updatedAt) >= threshold;
  });
  const scoped = periodRecords.filter(
    (record) => project === "ALL" || record.projectCode === project,
  );
  const counts = Object.fromEntries(
    groupMeta.map((item) => [
      item.value,
      records.filter((record) => teamRecordGroup(record) === item.value).length,
    ]),
  ) as Record<TeamRecordGroup, number>;
  const query = search.trim().toLowerCase();
  const filtered = scoped
    .filter((record) => teamRecordGroup(record) === group)
    .filter((record) => type === "ALL" || record.paymentType === type)
    .filter(
      (record) => !exactDate || record.submittedAt.slice(0, 10) === exactDate,
    )
    .filter(
      (record) => !minimumAmount || record.amount >= Number(minimumAmount),
    )
    .filter(
      (record) => !maximumAmount || record.amount <= Number(maximumAmount),
    )
    .filter(
      (record) =>
        !query ||
        [record.reference, record.requesterName, record.purpose]
          .join(" ")
          .toLowerCase()
          .includes(query),
    );
  const pagination = useListPagination(filtered, 10);
  const total = scoped.reduce((sum, record) => sum + record.amount, 0);
  const paid = scoped
    .filter((record) => completedTeamStatuses.has(record.status))
    .reduce((sum, record) => sum + record.amount, 0);
  const committed = scoped
    .filter((record) => !completedTeamStatuses.has(record.status))
    .filter((record) => !inactiveTeamStatuses.has(record.status))
    .reduce((sum, record) => sum + record.amount, 0);
  const budget = Math.max(100000, paid + committed);
  const available = Math.max(0, budget - paid - committed);

  if (loading)
    return <main className={styles.state}>Loading Team Records…</main>;
  if (error) return <main className={styles.state}>{error}</main>;

  const exportCsv = () => {
    const rows = [
      ["Reference", "Requester", "Project", "Type", "Amount", "Status"],
      ...scoped.map((record) => [
        record.reference,
        record.requesterName,
        record.projectName ?? record.projectCode ?? "",
        record.typeLabel,
        String(record.amount),
        record.statusLabel,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Estuary-team-records.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Project management · Team records</p>
          <h1>Team records</h1>
          <span>
            Every payment request from your team, its documents and how the
            budget is being spent.
          </span>
        </div>
        <div>
          <Link href="/beta/payment-records">↓ Documents</Link>
          <button onClick={exportCsv} type="button">
            ↓ Export
          </button>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Team Records view">
        {(["RECORDS", "ANALYSIS"] as const).map((item) => (
          <button
            aria-pressed={view === item}
            key={item}
            onClick={() => setView(item)}
            type="button"
          >
            {item === "RECORDS" ? "Records" : "Analysis"}
          </button>
        ))}
      </nav>

      {view === "RECORDS" ? (
        <>
          <section className={styles.summaryGrid}>
            {groupMeta.map((item) => (
              <button
                aria-pressed={group === item.value}
                data-tone={item.value}
                key={item.value}
                onClick={() => setGroup(item.value)}
                type="button"
              >
                <span>{item.label}</span>
                <strong>{counts[item.value]}</strong>
                <small>{item.note}</small>
                <i>
                  <Image alt="" height={20} src={item.icon} width={20} />
                </i>
                {group === item.value && <em>Showing</em>}
              </button>
            ))}
          </section>
          <section className={styles.recordsCard}>
            <header>
              <div>
                <p>Team requests</p>
                <h2>{groupMeta.find((item) => item.value === group)?.label}</h2>
                <span>
                  Requests from your team in assigned projects at this stage.
                </span>
              </div>
              <strong>
                {filtered.length} records ·{" "}
                {money(
                  filtered.reduce((sum, record) => sum + record.amount, 0),
                )}
              </strong>
            </header>
            <div className={styles.primaryFilters}>
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
            <div className={styles.secondaryFilters}>
              <input
                aria-label="Search records"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reference, requester or purpose…"
                value={search}
              />
              <select
                aria-label="Payment type"
                value={type}
                onChange={(event) => setType(event.target.value as typeof type)}
              >
                <option value="ALL">All payment types</option>
                {Object.entries(teamRecordTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                aria-expanded={moreFiltersOpen}
                onClick={() => setMoreFiltersOpen((current) => !current)}
                type="button"
              >
                ☷ More filters
              </button>
            </div>
            {moreFiltersOpen && (
              <div className={styles.moreFiltersPanel}>
                <label>
                  Exact date
                  <input
                    onChange={(event) => setExactDate(event.target.value)}
                    type="date"
                    value={exactDate}
                  />
                </label>
                <label>
                  Minimum amount (RM)
                  <input
                    min="0"
                    onChange={(event) => setMinimumAmount(event.target.value)}
                    placeholder="0.00"
                    type="number"
                    value={minimumAmount}
                  />
                </label>
                <label>
                  Maximum amount (RM)
                  <input
                    min="0"
                    onChange={(event) => setMaximumAmount(event.target.value)}
                    placeholder="No maximum"
                    type="number"
                    value={maximumAmount}
                  />
                </label>
                <button
                  onClick={() => {
                    setExactDate("");
                    setMinimumAmount("");
                    setMaximumAmount("");
                  }}
                  type="button"
                >
                  Clear extra filters
                </button>
              </div>
            )}
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Requester</th>
                    <th>Project</th>
                    <th>Amount</th>
                    <th>Submitted</th>
                    <th>Purpose</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.reference}</strong>
                        <small>{record.typeLabel}</small>
                      </td>
                      <td>{record.requesterName}</td>
                      <td>{record.projectName ?? record.projectCode ?? "—"}</td>
                      <td>
                        <strong>{money(record.amount)}</strong>
                      </td>
                      <td>{shortDate(record.submittedAt)}</td>
                      <td>{record.purpose}</td>
                      <td>
                        <Link href={record.href}>View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!pagination.totalRecords && (
                <p className={styles.empty}>No records match these filters.</p>
              )}
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
        </>
      ) : (
        <Analysis
          account={account}
          analysisView={analysisView}
          available={available}
          budget={budget}
          committed={committed}
          paid={paid}
          period={period}
          project={project}
          records={scoped}
          setAnalysisView={setAnalysisView}
          setPeriod={setPeriod}
          setProject={setProject}
          total={total}
        />
      )}
    </main>
  );
}

function Analysis({
  account,
  analysisView,
  available,
  budget,
  committed,
  paid,
  period,
  project,
  records,
  setAnalysisView,
  setPeriod,
  setProject,
  total,
}: {
  account?: BetaAccount;
  analysisView: AnalysisView;
  available: number;
  budget: number;
  committed: number;
  paid: number;
  period: Period;
  project: string;
  records: TeamRecord[];
  setAnalysisView: (value: AnalysisView) => void;
  setPeriod: (value: Period) => void;
  setProject: (value: string) => void;
  total: number;
}) {
  const awaiting = records
    .filter((record) => teamRecordGroup(record) === "PAYMENT")
    .reduce((sum, record) => sum + record.amount, 0);
  const approval = records
    .filter((record) => teamRecordGroup(record) === "APPROVAL")
    .reduce((sum, record) => sum + record.amount, 0);
  const completedDurations = records
    .filter((record) => completedTeamStatuses.has(record.status))
    .map(
      (record) =>
        (new Date(record.updatedAt).getTime() -
          new Date(record.submittedAt).getTime()) /
        86_400_000,
    )
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  const averageApprovalDays = completedDurations.length
    ? completedDurations.reduce((sum, duration) => sum + duration, 0) /
      completedDurations.length
    : 0;
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const amount = records
      .filter((record) => {
        const updated = new Date(record.updatedAt);
        return (
          updated.getMonth() === date.getMonth() &&
          updated.getFullYear() === date.getFullYear()
        );
      })
      .reduce((sum, record) => sum + record.amount, 0);
    return {
      label: date.toLocaleDateString("en-MY", { month: "short" }),
      amount,
    };
  });
  const byType = Object.entries(teamRecordTypeLabels).map(([value, label]) => ({
    value: value as DashboardSummaryPaymentType,
    label,
    amount: records
      .filter((record) => record.paymentType === value)
      .reduce((sum, record) => sum + record.amount, 0),
  }));
  const max = Math.max(
    1,
    ...(analysisView === "TREND"
      ? months.map((item) => item.amount)
      : byType.map((item) => item.amount)),
  );
  const workflowCounts = {
    review: records.filter((record) => teamRecordGroup(record) === "APPROVAL")
      .length,
    payment: records.filter((record) => teamRecordGroup(record) === "PAYMENT")
      .length,
    reconciliation: records.filter(
      (record) =>
        ["CASH_ADVANCE", "PETTY_CASH"].includes(record.paymentType) &&
        record.status.includes("RECONCILIATION"),
    ).length,
  };
  const projectSpend = teamProjectOptions
    .filter((option) => project === "ALL" || option.value === project)
    .map((option) => ({
      code: option.value,
      label: option.label,
      amount: records
        .filter((record) => record.projectCode === option.value)
        .reduce((sum, record) => sum + record.amount, 0),
    }))
    .filter((item) => item.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 3);
  const highestProjectSpend = Math.max(
    1,
    ...projectSpend.map((item) => item.amount),
  );
  return (
    <>
      <section className={styles.analysisKpis}>
        <article data-primary>
          <span>Total expenses</span>
          <strong>{money(total)}</strong>
          <small>Paid out · selected period</small>
        </article>
        <article>
          <span>Awaiting payment</span>
          <strong>{money(awaiting)}</strong>
          <small>Approved, not yet paid</small>
        </article>
        <article>
          <span>Pending approval</span>
          <strong>{money(approval)}</strong>
          <small>Submitted, awaiting decision</small>
        </article>
        <article>
          <span>Average approval time</span>
          <strong>
            {completedDurations.length
              ? `${averageApprovalDays.toFixed(1)} days`
              : "No data"}
          </strong>
          <small>Submission to final approval</small>
        </article>
      </section>
      <section className={styles.analysisFilters}>
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
      </section>
      <section className={styles.budget}>
        <header>
          <div>
            <h2>Budget utilisation</h2>
            <span>Approved budget {money(budget)} · all assigned projects</span>
          </div>
          <strong>
            {Math.round(((paid + committed) / budget) * 100)}% used
          </strong>
        </header>
        <div className={styles.budgetBar}>
          <i style={{ width: `${(paid / budget) * 100}%` }} />
          <b style={{ width: `${(committed / budget) * 100}%` }} />
        </div>
        <div>
          <p>
            <i />
            Paid<strong>{money(paid)}</strong>
            <small>Money already released</small>
          </p>
          <p>
            <i />
            Committed<strong>{money(committed)}</strong>
            <small>Approved or pending, not yet paid</small>
          </p>
          <p>
            <i />
            Available<strong>{money(available)}</strong>
            <small>Left to spend</small>
          </p>
        </div>
      </section>
      <section className={styles.analysisChart}>
        <header>
          <div>
            <h2>Payment analysis</h2>
            <span>
              {analysisView === "TREND"
                ? "Monthly payments released"
                : "Payments released by type"}{" "}
              · selected period
            </span>
          </div>
          <nav>
            <button
              aria-pressed={analysisView === "TREND"}
              onClick={() => setAnalysisView("TREND")}
              type="button"
            >
              Trend
            </button>
            <button
              aria-pressed={analysisView === "TYPE"}
              onClick={() => setAnalysisView("TYPE")}
              type="button"
            >
              By type
            </button>
          </nav>
        </header>
        {analysisView === "TREND" ? (
          <div className={styles.bars}>
            {months.map((item) => (
              <div key={item.label}>
                <strong>{money(item.amount)}</strong>
                <i
                  style={{
                    height: `${Math.max(5, (item.amount / max) * 100)}%`,
                  }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.typeBars}>
            {byType.map((item) => (
              <div key={item.value} data-type={item.value}>
                <span>{item.label}</span>
                <i>
                  <b style={{ width: `${(item.amount / max) * 100}%` }} />
                </i>
                <strong>{money(item.amount)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className={styles.analysisBottom}>
        <article>
          <header>
            <h2>
              {account?.role === "finance"
                ? "Where requests are"
                : "Workflow health"}
            </h2>
            <Link href="/beta/team-records/workflow-health">
              View details →
            </Link>
          </header>
          <p>Where requests are waiting. Click a number to open it.</p>
          <div className={styles.workflowHealth}>
            <Link href="/beta/team-records/workflow-health?stage=APPROVAL">
              <strong>{workflowCounts.review}</strong>
              <span>Awaiting review</span>
              <small>In approval queues</small>
            </Link>
            <Link href="/beta/team-records/workflow-health?stage=PAYMENT">
              <strong>{workflowCounts.payment}</strong>
              <span>Awaiting payment</span>
              <small>With Finance</small>
            </Link>
            <Link href="/beta/team-records/workflow-health?stage=RECONCILIATION">
              <strong>{workflowCounts.reconciliation}</strong>
              <span>Unreconciled</span>
              <small>Open cash advances</small>
            </Link>
          </div>
        </article>
        <article>
          <h2>Spend by project</h2>
          <span>Paid amount against each project&apos;s budget</span>
          {projectSpend.map((item) => (
            <div className={styles.projectSpend} key={item.code}>
              <strong>{item.label}</strong>
              <span>{money(item.amount)}</span>
              <i>
                <b
                  style={{
                    width: `${(item.amount / highestProjectSpend) * 100}%`,
                  }}
                />
              </i>
            </div>
          ))}
          {!projectSpend.length && (
            <p className={styles.noProjectSpend}>
              No spend is recorded for the selected project and period.
            </p>
          )}
        </article>
      </section>
    </>
  );
}

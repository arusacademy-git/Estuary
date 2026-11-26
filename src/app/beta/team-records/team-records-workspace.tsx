"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { ListPagination } from "@/components/ui/list-pagination/list-pagination";
import { useListPagination } from "@/components/ui/list-pagination/use-list-pagination";
import {
  completedTeamStatuses,
  teamProjectOptions,
  teamRecordGroup,
  teamRecordTypeLabels,
  type TeamRecord,
} from "@/data/team-records/team-records-api";
import type { DashboardSummaryPaymentType } from "@/domain/dashboard/types";
import type { ProjectBudgetPosition } from "@/domain/projects/project-budget-types";
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
type SortKey =
  | "reference"
  | "requester"
  | "project"
  | "amount"
  | "submitted"
  | "purpose";
type SortDirection = "asc" | "desc";

const sortableColumns: Array<{ key: SortKey; label: string }> = [
  { key: "reference", label: "Reference" },
  { key: "requester", label: "Requester" },
  { key: "project", label: "Project" },
  { key: "amount", label: "Amount" },
  { key: "submitted", label: "Submitted" },
  { key: "purpose", label: "Purpose" },
];

const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
    icon: "/assets/icons/pending-approvals-light.png",
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
  budgetError = "",
  budgetPositions = [],
  error,
  initialGroup = "APPROVAL",
  initialView = "RECORDS",
  loading = false,
  records,
}: {
  account?: BetaAccount;
  budgetError?: string;
  budgetPositions?: ProjectBudgetPosition[];
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
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
  const sorted = [...filtered].sort((left, right) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    if (sortKey === "amount") return (left.amount - right.amount) * direction;
    if (sortKey === "submitted") {
      return (
        (new Date(left.submittedAt).getTime() -
          new Date(right.submittedAt).getTime()) *
        direction
      );
    }
    const leftValue =
      sortKey === "reference"
        ? left.reference
        : sortKey === "requester"
          ? left.requesterName
          : sortKey === "project"
            ? (left.projectCode ?? "")
            : left.purpose;
    const rightValue =
      sortKey === "reference"
        ? right.reference
        : sortKey === "requester"
          ? right.requesterName
          : sortKey === "project"
            ? (right.projectCode ?? "")
            : right.purpose;
    return (
      leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction
    );
  });
  const pagination = useListPagination(sorted, 10);
  const total = scoped.reduce((sum, record) => sum + record.amount, 0);
  const selectedPositions = budgetPositions.filter(
    (position) => project === "ALL" || position.projectCode === project,
  );
  const configuredPositions = selectedPositions.filter(
    (position) => position.configured,
  );
  const budget = configuredPositions.reduce(
    (sum, position) => sum + Number(position.budget),
    0,
  );
  const paid = configuredPositions.reduce(
    (sum, position) => sum + Number(position.spent),
    0,
  );
  const committed = configuredPositions.reduce(
    (sum, position) => sum + Number(position.committed),
    0,
  );
  const available = configuredPositions.reduce(
    (sum, position) => sum + Number(position.available),
    0,
  );

  if (loading)
    return <main className={styles.state}>Loading Team Records…</main>;
  if (error) return <main className={styles.state}>{error}</main>;

  const changeSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "submitted" ? "desc" : "asc");
  };

  const exportCsv = () => {
    const rows = [
      ["Reference", "Requester", "Project", "Type", "Amount", "Status"],
      ...scoped.map((record) => [
        record.reference,
        record.requesterName,
        record.projectCode ?? "",
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
                    {sortableColumns.map((column) => {
                      const active = sortKey === column.key;
                      return (
                        <th
                          aria-sort={
                            active
                              ? sortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                          key={column.key}
                        >
                          <button
                            className={styles.sortHeader}
                            data-active={active}
                            onClick={() => changeSort(column.key)}
                            type="button"
                          >
                            {column.label}
                            <span aria-hidden="true">
                              {active
                                ? sortDirection === "asc"
                                  ? "▲"
                                  : "▼"
                                : "↕"}
                            </span>
                          </button>
                        </th>
                      );
                    })}
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
                      <td>{record.projectCode ?? "—"}</td>
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
          budgetError={budgetError}
          budgetPositions={selectedPositions}
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
  budgetError,
  budgetPositions,
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
  budgetError: string;
  budgetPositions: ProjectBudgetPosition[];
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
  const projectSpend = budgetPositions
    .map((position) => ({
      code: position.projectCode,
      label: position.projectName,
      amount: Number(position.spent),
      budget: position.configured ? Number(position.budget) : null,
    }))
    .filter((item) => item.amount > 0 || item.budget !== null)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 3);
  const highestProjectSpend = Math.max(
    1,
    ...projectSpend.map((item) => item.amount),
  );
  const budgetUsed = paid + committed;
  const budgetUsedPercent = budget
    ? Math.round((budgetUsed / budget) * 100)
    : 0;
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
            <span>
              {budget
                ? `Approved budget ${money(budget)} · selected projects`
                : "Budget not configured for the selected projects"}
            </span>
          </div>
          <strong>
            {budget ? `${budgetUsedPercent}% used` : "Not configured"}
          </strong>
        </header>
        <div className={styles.budgetBar}>
          <i style={{ width: `${budget ? (paid / budget) * 100 : 0}%` }} />
          <b style={{ width: `${budget ? (committed / budget) * 100 : 0}%` }} />
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
            Available
            <strong>{budget ? money(available) : "Not configured"}</strong>
            <small>Left to spend</small>
          </p>
        </div>
        {budgetError && <p className={styles.noProjectSpend}>{budgetError}</p>}
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
              <span>
                {money(item.amount)} of{" "}
                {item.budget === null ? "Not configured" : money(item.budget)}
              </span>
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

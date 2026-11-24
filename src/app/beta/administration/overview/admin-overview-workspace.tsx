"use client";

import Image from "next/image";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { fetchDashboardSummary } from "@/data/dashboard/api";
import type { DashboardSummaryRecord } from "@/domain/dashboard/types";
import {
  readAdminSettings,
  saveAdminSettings,
  type AdminSettings,
} from "@/features/administration/admin-settings";
import { readBetaSession } from "@/lib/auth/beta-accounts";

import styles from "./admin-overview.module.css";

type BudgetRow = { projectId: string; projectName?: string; amount: number };
type AttentionItem = {
  action: "budget" | "link";
  description: string;
  href?: string;
  key: string;
  label: string;
  title: string;
  tone: "critical" | "warning" | "neutral";
};
const currentYear = new Date().getFullYear();
const storageKey = (year: number) =>
  `estuary:project-budgets:beta-arus-org:${year}`;
const completed = new Set([
  "COMPLETED",
  "COMPLETE",
  "CLOSED",
  "PAID",
  "RECONCILED",
]);
const excluded = new Set([
  "DRAFT",
  "REJECTED",
  "PAYMENT_REJECTED",
  "INACTIVE",
  "CANCELLED",
  "RETURNED_TO_STAFF",
  "RETURNED_TO_CLAIMANT",
]);
const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);
const prototypeProjectNames: Record<string, string> = {
  "N-AOC-UNDP": "AOC – UNDP partnership",
  "O-HR-ARUS": "HR – Arus Academy",
  "P-SCH-OUT": "School Outreach",
  "P-YTH-FRM": "Youth Forum 2026",
  "O-OPS-ARUS": "Office Operations",
  "P-COM-WEL": "Community Welfare",
};
function projectName(project: AdminSettings["programmes"][number] | undefined) {
  if (!project) return "";
  if (project.name.trim() && project.name.trim() !== project.code.trim())
    return project.name;
  return prototypeProjectNames[project.code] ?? project.name;
}
function readBudgets(year: number) {
  try {
    return JSON.parse(
      window.localStorage.getItem(storageKey(year)) ?? "[]",
    ) as BudgetRow[];
  } catch {
    return [];
  }
}

export function AdminOverviewWorkspace() {
  const [account] = useState(() => readBetaSession());
  const [year, setYear] = useState(currentYear);
  const [settings, setSettings] = useState<AdminSettings>(() =>
    readAdminSettings(),
  );
  const [records, setRecords] = useState<DashboardSummaryRecord[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [draft, setDraft] = useState<BudgetRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) return;
    fetchDashboardSummary({ role: "director", userId: account.id })
      .then((nextRecords) => {
        setRecords(nextRecords);
        setBudgets(readBudgets(year));
      })
      .catch(() => setBudgets(readBudgets(year)))
      .finally(() => setLoading(false));
  }, [account, year]);

  if (!account)
    return (
      <main className={styles.state}>Administration access required.</main>
    );
  if (loading)
    return <main className={styles.state}>Loading Admin overview…</main>;

  const activeProjects = settings.programmes.filter((item) => item.active);
  const activeEmployees = settings.employees.filter((item) => item.active);
  const totalBudget = budgets.reduce((sum, row) => sum + row.amount, 0);
  const spent = records
    .filter((record) => completed.has(record.status))
    .reduce((sum, record) => sum + record.amount, 0);
  const committed = records
    .filter(
      (record) => !completed.has(record.status) && !excluded.has(record.status),
    )
    .reduce((sum, record) => sum + record.amount, 0);
  const remaining = totalBudget - spent - committed;
  const spentPercent = totalBudget ? (spent / totalBudget) * 100 : 0;
  const committedPercent = totalBudget ? (committed / totalBudget) * 100 : 0;
  const remainingPercent = totalBudget
    ? Math.max(0, (remaining / totalBudget) * 100)
    : 0;
  const projectUsage = (projectId: string) => {
    const project = settings.programmes.find((item) => item.id === projectId);
    const scoped = records.filter(
      (record) => record.projectCode === project?.code,
    );
    return {
      spent: scoped
        .filter((record) => completed.has(record.status))
        .reduce((sum, record) => sum + record.amount, 0),
      committed: scoped
        .filter(
          (record) =>
            !completed.has(record.status) && !excluded.has(record.status),
        )
        .reduce((sum, record) => sum + record.amount, 0),
    };
  };
  const claimUsed = records
    .filter(
      (record) =>
        record.paymentType === "EXPENSE_CLAIM" && completed.has(record.status),
    )
    .reduce((sum, record) => sum + record.amount, 0);
  const claimLimit =
    settings.claimPolicy.medicalAnnualLimit * activeEmployees.length;
  const attention: AttentionItem[] = [
    ...budgets
      .filter((row) => {
        const usage = projectUsage(row.projectId);
        return usage.spent + usage.committed > row.amount;
      })
      .map((row) => {
        const project = settings.programmes.find(
          (item) => item.id === row.projectId,
        );
        const usage = projectUsage(row.projectId);
        return {
          action: "budget" as const,
          description: `${money(usage.spent + usage.committed)} spent or committed against ${money(row.amount)} for ${year}.`,
          key: `budget-${row.projectId}`,
          label: "Set budget",
          title: `${row.projectName || projectName(project)} is over budget`,
          tone: "critical" as const,
        };
      }),
    ...activeProjects
      .filter((item) => !item.managerId)
      .map((item) => ({
        action: "link" as const,
        description: "Requests for this programme have no first approver.",
        href: "/beta/administration?section=programmes",
        key: `programme-${item.id}`,
        label: "Assign",
        title: `${item.code} has no manager`,
        tone: "warning" as const,
      })),
    ...settings.employees
      .filter((item) => !item.active)
      .map((item) => ({
        action: "link" as const,
        description:
          "Still assigned to a programme. Review or reactivate them.",
        href: "/beta/administration?section=employees",
        key: `employee-${item.id}`,
        label: "Review",
        title: `${item.name} is inactive`,
        tone: "warning" as const,
      })),
    ...settings.accountingCodes
      .filter((item) => !item.active)
      .map((item) => ({
        action: "link" as const,
        description: "Legacy requests still use it; review it before deleting.",
        href: "/beta/administration?section=accounting",
        key: `code-${item.id}`,
        label: "View",
        title: `${item.code} ${item.name} is inactive`,
        tone: "neutral" as const,
      })),
  ].slice(0, 4);
  const openBudgets = () => {
    setDraft(
      budgets
        .filter((row) =>
          activeProjects.some((project) => project.id === row.projectId),
        )
        .map((row) => ({
          ...row,
          projectName:
            row.projectName ??
            projectName(
              activeProjects.find((project) => project.id === row.projectId),
            ),
        })),
    );
    setModalOpen(true);
  };
  const saveBudgets = () => {
    window.localStorage.setItem(storageKey(year), JSON.stringify(draft));
    const nextSettings: AdminSettings = {
      ...settings,
      programmes: settings.programmes.map((project) => {
        const budget = draft.find((row) => row.projectId === project.id);
        return budget?.projectName?.trim()
          ? { ...project, name: budget.projectName.trim() }
          : project;
      }),
    };
    saveAdminSettings(nextSettings);
    setSettings(nextSettings);
    setBudgets(draft);
    setModalOpen(false);
  };

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p>
          Admin workspace <em>Beta · saved in this browser</em>
        </p>
        <h1>Overview</h1>
        <span>How the organisation is set up, and what needs fixing.</span>
      </header>
      <section className={styles.stats}>
        {[
          {
            action: "Manage employees →",
            href: "/beta/administration?section=employees",
            icon: "/assets/icons/employees-tile.png",
            label: "Employees",
            note: `${settings.employees.filter((item) => !item.active).length} inactive · 4 roles`,
            tone: "blue",
            value: settings.employees.length,
          },
          {
            action: "Manage programmes →",
            href: "/beta/administration?section=programmes",
            icon: "/assets/icons/programmes-tile.png",
            label: "Programmes",
            note: `${activeProjects.filter((item) => !item.managerId).length} without a manager`,
            tone: "orange",
            value: activeProjects.length,
          },
          {
            action: "Manage codes →",
            href: "/beta/administration?section=accounting",
            icon: "/assets/icons/accounting-codes-tile.png",
            label: "Accounting codes",
            note: `${settings.accountingCodes.filter((item) => !item.active).length} inactive (legacy)`,
            tone: "teal",
            value: settings.accountingCodes.length,
          },
          {
            action: "Manage entitlements →",
            href: "/beta/administration?section=claims",
            icon: "/assets/icons/custom-entitlements-tile.png",
            label: "Custom entitlements",
            note: "Others use the organisation policy",
            tone: "purple",
            value: Object.keys(settings.claimOverrides).length,
          },
        ].map(({ action, href, icon, label, note, tone, value }) => (
          <article data-tone={tone} key={label}>
            <Image alt="" height={34} src={icon} width={34} />
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
            <a href={href}>{action}</a>
          </article>
        ))}
      </section>
      <section className={styles.budgetCard}>
        <header>
          <div>
            <p>Yearly budget · {year}</p>
            <h2>Budget tracker</h2>
            <span>
              Spent updates when Finance completes a payment. Committed is
              approved but not paid yet.
            </span>
          </div>
          <div>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              <option>{currentYear}</option>
              <option>{currentYear - 1}</option>
            </select>
            <button onClick={openBudgets} type="button">
              Set budgets
            </button>
          </div>
        </header>
        <div className={styles.budgetTotals}>
          {[
            [
              "Total budget",
              totalBudget,
              `${budgets.length} active programmes`,
              "total",
            ],
            [
              "Spent",
              spent,
              `${Math.round(spentPercent)}% of budget · paid`,
              "spent",
            ],
            ["Committed", committed, "Approved, not paid yet", "committed"],
            [
              "Remaining",
              remaining,
              `${Math.round(remainingPercent)}% left to spend`,
              "remaining",
            ],
          ].map(([label, value, note, tone]) => (
            <article data-tone={tone} key={label}>
              <span>{label}</span>
              <strong>{money(Number(value))}</strong>
              <small>{note}</small>
            </article>
          ))}
        </div>
        <div className={styles.utilisation}>
          <i
            style={{
              width: `${Math.min(100, spentPercent)}%`,
            }}
          />
          <b
            style={{
              width: `${Math.min(100, committedPercent)}%`,
            }}
          />
        </div>
        <div className={styles.legend}>
          <span data-tone="spent">Spent</span>
          <span data-tone="committed">Committed</span>
          <span data-tone="remaining">Remaining</span>
          <b>Year elapsed · {year}</b>
        </div>
        <div className={styles.projectTable}>
          <div>
            <b>Programme</b>
            <b>Budget</b>
            <b>Spent</b>
            <b>Committed</b>
            <b>Remaining</b>
            <b>Usage</b>
          </div>
          {budgets.map((row) => {
            const project = settings.programmes.find(
              (item) => item.id === row.projectId,
            );
            const usage = projectUsage(row.projectId);
            const left = row.amount - usage.spent - usage.committed;
            const used = row.amount
              ? Math.round(((usage.spent + usage.committed) / row.amount) * 100)
              : 0;
            return (
              <div key={row.projectId}>
                <strong>
                  {row.projectName?.trim() || projectName(project) || "Unknown"}
                  <small>{project?.code}</small>
                </strong>
                <span>{money(row.amount)}</span>
                <span>{money(usage.spent)}</span>
                <span>{money(usage.committed)}</span>
                <span data-negative={left < 0}>{money(left)}</span>
                <span className={styles.usage}>
                  <i>
                    <b
                      data-tone={
                        used >= 100
                          ? "danger"
                          : used >= 85
                            ? "warning"
                            : "normal"
                      }
                      style={{ width: `${Math.min(100, used)}%` }}
                    />
                  </i>
                  <em
                    data-tone={
                      used >= 100 ? "danger" : used >= 85 ? "warning" : "normal"
                    }
                  >
                    {used}%
                    {used >= 100
                      ? " · over"
                      : used >= 85
                        ? " · near limit"
                        : ""}
                  </em>
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <div className={styles.bottomGrid}>
        <section>
          <p>Claim entitlements · {year}</p>
          <h2>How much of the yearly allowance is used</h2>
          {[
            [
              "Medical",
              claimUsed,
              claimLimit,
              "navy",
              `${Math.round(claimLimit ? (claimUsed / claimLimit) * 100 : 0)}% used`,
            ],
            [
              "Professional development (PD)",
              0,
              settings.claimPolicy.pdAnnualLimit * activeEmployees.length,
              "blue",
              "Organisation allowance",
            ],
            [
              "Tech",
              0,
              settings.claimPolicy.techStandardLimit * activeEmployees.length,
              "teal",
              "Standard and extended limits apply",
            ],
            [
              "Internet / Commute",
              0,
              settings.claimPolicy.internetCommuteLimit,
              "orange",
              "Per-claim policy limit",
            ],
          ].map(([label, used, limit, tone, note]) => (
            <a
              className={styles.claimBar}
              data-tone={tone}
              href="/beta/administration?section=claims"
              key={String(label)}
            >
              <strong>{label}</strong>
              <span>
                {money(Number(used))} of {money(Number(limit))}
              </span>
              <i>
                <b
                  style={{
                    width: `${Math.min(100, Number(limit) ? (Number(used) / Number(limit)) * 100 : 0)}%`,
                  }}
                />
              </i>
              <small>{note}</small>
            </a>
          ))}
        </section>
        <section>
          <p>Needs attention</p>
          <h2>{attention.length} things to check</h2>
          <ul>
            {attention.map((item) => (
              <li data-tone={item.tone} key={item.key}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </div>
                {item.action === "budget" ? (
                  <button onClick={openBudgets} type="button">
                    {item.label}
                  </button>
                ) : (
                  <a href={item.href}>{item.label}</a>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
      {modalOpen && (
        <BudgetModal
          activeProjects={activeProjects}
          draft={draft}
          setDraft={setDraft}
          year={year}
          close={() => setModalOpen(false)}
          save={saveBudgets}
          settings={settings}
        />
      )}
    </main>
  );
}

function BudgetModal({
  activeProjects,
  close,
  draft,
  save,
  setDraft,
  settings,
  year,
}: {
  activeProjects: AdminSettings["programmes"];
  close: () => void;
  draft: BudgetRow[];
  save: () => void;
  setDraft: Dispatch<SetStateAction<BudgetRow[]>>;
  settings: AdminSettings;
  year: number;
}) {
  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section aria-modal="true" className={styles.modal} role="dialog">
        <header>
          <div>
            <p>Yearly budget</p>
            <h2>Set budgets for {year}</h2>
          </div>
          <button aria-label="Close" onClick={close} type="button">
            ×
          </button>
        </header>
        <div className={styles.modalBody}>
          <p>
            Spent and committed are tracked automatically from payment requests.
            Change a budget at any time; history is kept by year.
          </p>
          <div className={styles.budgetRowHeader}>
            <span>Project code *</span>
            <span>Project name</span>
            <span>Budget (RM) *</span>
            <span />
          </div>
          {draft.map((row, index) => {
            const project = settings.programmes.find(
              (item) => item.id === row.projectId,
            );
            return (
              <div
                className={styles.budgetRow}
                key={`${row.projectId}-${index}`}
              >
                <select
                  value={row.projectId}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              projectId: event.target.value,
                              projectName: projectName(
                                activeProjects.find(
                                  (project) =>
                                    project.id === event.target.value,
                                ),
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                >
                  {activeProjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Project name"
                  value={row.projectName ?? projectName(project)}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, projectName: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  inputMode="decimal"
                  value={row.amount || ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              amount: Math.max(
                                0,
                                Number(event.target.value) || 0,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  aria-label="Remove project"
                  onClick={() =>
                    setDraft((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  type="button"
                >
                  ⌫
                </button>
              </div>
            );
          })}
          <button
            className={styles.addProject}
            onClick={() => {
              const unused = activeProjects.find(
                (project) => !draft.some((row) => row.projectId === project.id),
              );
              if (unused)
                setDraft((current) => [
                  ...current,
                  {
                    projectId: unused.id,
                    projectName: projectName(unused),
                    amount: 0,
                  },
                ]);
            }}
            type="button"
          >
            ＋ Add project
          </button>
          <strong>
            Total {year}:{" "}
            {money(draft.reduce((sum, row) => sum + row.amount, 0))}
          </strong>
        </div>
        <footer>
          <button onClick={close} type="button">
            Cancel
          </button>
          <button onClick={save} type="button">
            Save budgets
          </button>
        </footer>
      </section>
    </div>
  );
}

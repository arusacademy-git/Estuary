"use client";

import { useEffect, useState } from "react";

import { fetchProjectBudgetPositions } from "@/data/projects/project-budget-api";
import type { ProjectBudgetPosition } from "@/domain/projects/project-budget-types";

import styles from "./finance-dashboard.module.css";

const organizationId = "beta-arus-org";
const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value);

export function FinanceProgrammeBudgets({ accountId }: { accountId: string }) {
  const [year] = useState(() => new Date().getFullYear());
  const [positions, setPositions] = useState<ProjectBudgetPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchProjectBudgetPositions(organizationId, accountId, year)
      .then((result) => {
        if (!active) return;
        setPositions(result.positions);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setPositions([]);
        setError(
          reason instanceof Error
            ? reason.message
            : "Programme budget positions could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountId, year]);

  return (
    <section className={styles.budgetCard}>
      <header>
        <div>
          <p>Programme budgets · {year}</p>
          <h2>Programme budget position</h2>
          <span>
            Set by Admin. Spent updates when Finance completes a payment;
            committed is approved but not paid yet.
          </span>
        </div>
      </header>
      <div className={styles.budgetTable}>
        <div>
          <b>Programme</b>
          <b>Budget</b>
          <b>Spent</b>
          <b>Remaining</b>
          <b>Usage</b>
        </div>
        {positions.map((position) => {
          const budget = Number(position.budget);
          const spent = Number(position.spent);
          const committed = Number(position.committed);
          const remaining = Number(position.available);
          const percent = budget
            ? Math.round(((spent + committed) / budget) * 100)
            : 0;
          const tone =
            percent >= 100 ? "danger" : percent >= 85 ? "warning" : "normal";
          return (
            <div key={position.projectId}>
              <strong>
                {position.projectName}
                <small>{position.projectCode}</small>
              </strong>
              <span>
                {position.configured ? money(budget) : "Not configured"}
              </span>
              <span>{money(spent)}</span>
              <span data-negative={position.overBudget}>
                {position.configured ? money(remaining) : "—"}
              </span>
              <span className={styles.budgetUsage}>
                {position.configured ? (
                  <>
                    <i>
                      <b
                        data-tone={tone}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </i>
                    <em data-tone={tone}>{percent}%</em>
                  </>
                ) : (
                  <em>—</em>
                )}
              </span>
            </div>
          );
        })}
        {(loading || error || !positions.length) && (
          <p className={styles.budgetEmpty}>
            {loading
              ? "Loading programme budget positions…"
              : error ||
                "Programme budgets will appear after Admin configures them."}
          </p>
        )}
      </div>
    </section>
  );
}

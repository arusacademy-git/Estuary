"use client";

import { useState } from "react";

import type { ManagerDashboardRecord } from "@/data/dashboard/manager-dashboard-api";
import { readAdminSettings } from "@/features/administration/admin-settings";

import styles from "./finance-dashboard.module.css";

type BudgetRow = { projectId: string; projectName?: string; amount: number };
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

export function FinanceProgrammeBudgets({
    records,
}: {
    records: ManagerDashboardRecord[];
}) {
    const [year] = useState(() => new Date().getFullYear());
    const [settings] = useState(() => readAdminSettings());
    const [budgets] = useState<BudgetRow[]>(() => {
        try {
            return JSON.parse(
                window.localStorage.getItem(
                    `estuary:project-budgets:beta-arus-org:${new Date().getFullYear()}`,
                ) ?? "[]",
            ) as BudgetRow[];
        } catch {
            return [];
        }
    });
    const usage = (projectId: string) => {
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
                {budgets.map((row) => {
                    const project = settings.programmes.find(
                        (item) => item.id === row.projectId,
                    );
                    const totals = usage(row.projectId);
                    const remaining = row.amount - totals.spent - totals.committed;
                    const percent = row.amount
                        ? Math.round(((totals.spent + totals.committed) / row.amount) * 100)
                        : 0;
                    const tone =
                        percent >= 100 ? "danger" : percent >= 85 ? "warning" : "normal";
                    return (
                        <div key={row.projectId}>
                            <strong>
                                {row.projectName || project?.name || project?.code}
                                <small>{project?.code}</small>
                            </strong>
                            <span>{money(row.amount)}</span>
                            <span>{money(totals.spent)}</span>
                            <span data-negative={remaining < 0}>{money(remaining)}</span>
                            <span className={styles.budgetUsage}>
                                <i>
                                    <b
                                        data-tone={tone}
                                        style={{ width: `${Math.min(100, percent)}%` }}
                                    />
                                </i>
                                <em data-tone={tone}>{percent}%</em>
                            </span>
                        </div>
                    );
                })}
                {!budgets.length && (
                    <p className={styles.budgetEmpty}>
                        Programme budgets will appear after Admin sets the yearly budgets.
                    </p>
                )}
            </div>
        </section>
    );
}

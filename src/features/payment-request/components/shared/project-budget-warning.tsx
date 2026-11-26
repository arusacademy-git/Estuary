"use client";

import { useEffect, useMemo, useState } from "react";

import { checkProjectBudgets } from "@/data/projects/project-budget-api";
import type { ProjectBudgetWarning as BudgetWarning } from "@/domain/projects/project-budget-types";

import styles from "./project-budget-warning.module.css";

export type ProjectBudgetAllocation = {
    projectReference: string;
    amount: number;
};

const money = (value: number) =>
    new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        minimumFractionDigits: 2,
    }).format(value);

export function ProjectBudgetWarning({
    accountId,
    allocations,
    organizationId = "beta-arus-org",
    year = new Date().getFullYear(),
}: {
    accountId?: string;
    allocations: ProjectBudgetAllocation[];
    organizationId?: string;
    year?: number;
}) {
    const [warnings, setWarnings] = useState<BudgetWarning[]>([]);
    const [loadError, setLoadError] = useState("");

    const validAllocations = useMemo(
        () =>
            allocations.filter(
                ({ projectReference, amount }) =>
                    projectReference.trim() && Number.isFinite(amount) && amount > 0,
            ),
        [allocations],
    );

    useEffect(() => {
        if (!accountId || validAllocations.length === 0) {
            setWarnings([]);
            setLoadError("");
            return;
        }
        let cancelled = false;
        const timer = window.setTimeout(() => {
            checkProjectBudgets({
                organizationId,
                actorId: accountId,
                year,
                allocations: validAllocations,
            })
                .then((result) => {
                    if (!cancelled) {
                        setWarnings(result.warnings);
                        setLoadError("");
                    }
                })
                .catch((caught) => {
                    if (!cancelled) {
                        setLoadError(
                            caught instanceof Error
                                ? caught.message
                                : "Project budget availability could not be checked.",
                        );
                    }
                });
        }, 250);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [accountId, organizationId, validAllocations, year]);

    if (!accountId || (!loadError && warnings.length === 0)) return null;

    return (
        <aside className={styles.wrapper} aria-live="polite">
            <div className={styles.heading}>
                <span aria-hidden="true">!</span>
                <div>
                    <strong>Project budget check</strong>
                    <p>This is a warning only and will not block submission.</p>
                </div>
            </div>
            {loadError ? (
                <p className={styles.loadError}>
                    Budget availability could not be checked: {loadError}
                </p>
            ) : (
                <ul>
                    {warnings.map((warning) => (
                        <li
                            className={
                                warning.reason === "INSUFFICIENT"
                                    ? styles.warning
                                    : styles.unconfigured
                            }
                            key={`${warning.projectReference}-${warning.reason}`}
                        >
                            <strong>
                                {warning.projectName}:{" "}
                                {warning.reason === "INSUFFICIENT"
                                    ? "request exceeds available budget"
                                    : "budget not configured"}
                            </strong>
                            <span>
                                {warning.reason === "INSUFFICIENT"
                                    ? `${money(Number(warning.requested))} requested · ${money(Number(warning.available))} available · ${money(Number(warning.overBy))} over budget. Submission is still allowed.`
                                    : `${money(Number(warning.requested))} can still be submitted. An administrator should configure this project's budget.`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}

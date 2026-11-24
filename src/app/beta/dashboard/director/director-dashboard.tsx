"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
    directorNeedsApproval,
    directorRequesterAction,
    fetchDirectorDashboard,
    type DirectorDashboardRecord,
    type DirectorProjectOption,
} from "@/data/dashboard/director-dashboard-api";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

import { ManagerDashboardMyRequest } from "../manager/manager-dashboard-my-request";
import styles from "../manager/manager-dashboard.module.css";
import { ManagerDashboardTeamRecords } from "../manager/manager-dashboard-team-records";
import directorStyles from "./director-dashboard.module.css";
import { DirectorDashboardOrgOverview } from "./director-dashboard-org-overview";

type DirectorTab = "ORG" | "TEAM" | "MINE";
const createOptions = [
    {
        type: "PAYMENT_VOUCHER",
        label: "Payment Voucher",
        description: "Pay a person or vendor",
        href: "/beta/payment-vouchers/new",
    },
    {
        type: "INVOICE_PAYMENT",
        label: "Invoice Payment",
        description: "Pay against a supplier invoice",
        href: "/beta/payment-requests/invoice-payment/new",
    },
    {
        type: "TRAVEL_ALLOWANCE",
        label: "Travel Allowance",
        description: "Get approval and allowance for travel",
        href: "/beta/payment-requests/travel-allowance/new",
    },
    {
        type: "CASH_ADVANCE",
        label: "Cash Advance",
        description: "Get money before an activity",
        href: "/beta/payment-requests/cash-advance/new",
    },
    {
        type: "PETTY_CASH",
        label: "Petty Cash",
        description: "Small day-to-day spending",
        href: "/beta/payment-requests/petty-cash/new",
    },
    {
        type: "EXPENSE_CLAIM",
        label: "Claim",
        description: "Get reimbursed for an expense",
        href: "/beta/payment-requests/claims/new",
    },
] as const;

export function DirectorDashboard({ account }: { account: BetaAccount }) {
    const [tab, setTab] = useState<DirectorTab>("ORG");
    const [records, setRecords] = useState<DirectorDashboardRecord[]>([]);
    const [projects, setProjects] = useState<DirectorProjectOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(() => new Date());
    const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        let active = true;
        fetchDirectorDashboard(account)
            .then((result) => {
                if (!active) return;
                setRecords(result.records);
                setProjects(result.projects);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [account]);

    const mine = records.filter((record) => record.requesterId === account.id);
    const approvals = records.filter(directorNeedsApproval).length;
    const myActions = mine.filter(directorRequesterAction).length;
    const lastUsedType = [...mine].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
    )[0]?.type;
    const recentOption = createOptions.find(
        (option) => option.type === lastUsedType,
    );
    const greeting =
        now.getHours() < 12
            ? "Good morning"
            : now.getHours() < 18
                ? "Good afternoon"
                : "Good evening";

    if (loading)
        return <div className={styles.loading}>Loading Director workspace…</div>;

    return (
        <main className={`${styles.dashboard} ${directorStyles.dashboard}`}>
            <section className={styles.hero}>
                <div>
                    <p>
                        {greeting}, {account.name.split(" ")[0]} ·{" "}
                        {new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(
                            now,
                        )}
                    </p>
                    <h1>Director workspace</h1>
                    <span>
                        Review assigned approvals and monitor requests already forwarded to
                        Finance.
                    </span>
                </div>
                <div className={styles.heroActions}>
                    <button
                        aria-expanded={paymentMenuOpen}
                        onClick={() => setPaymentMenuOpen((open) => !open)}
                        type="button"
                    >
                        ＋ Request a payment
                    </button>
                    {!paymentMenuOpen && (
                        <Link data-followup href="/beta/director/pending-approvals">
                            {approvals + myActions} to follow up
                        </Link>
                    )}
                    {paymentMenuOpen && (
                        <div className={styles.paymentMenu}>
                            {recentOption && (
                                <div className={styles.paymentMenuGroup}>
                                    <span>Recent</span>
                                    <Link
                                        data-type={recentOption.type}
                                        href={recentOption.href}
                                        onClick={() => setPaymentMenuOpen(false)}
                                    >
                                        <i />
                                        <b>{recentOption.label}</b>
                                        <small>{recentOption.description}</small>
                                        <em>Last used</em>
                                    </Link>
                                </div>
                            )}
                            <div className={styles.paymentMenuGroup}>
                                <span>All payment types</span>
                                {createOptions.map((option) => (
                                    <Link
                                        data-type={option.type}
                                        href={option.href}
                                        key={option.type}
                                        onClick={() => setPaymentMenuOpen(false)}
                                    >
                                        <i />
                                        <b>{option.label}</b>
                                        <small>{option.description}</small>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
            <nav aria-label="Director dashboard view" className={styles.tabs}>
                <button
                    aria-pressed={tab === "ORG"}
                    onClick={() => setTab("ORG")}
                    type="button"
                >
                    Org overview
                </button>
                <button
                    aria-pressed={tab === "TEAM"}
                    onClick={() => setTab("TEAM")}
                    type="button"
                >
                    Team approvals <span>{approvals}</span>
                </button>
                <button
                    aria-pressed={tab === "MINE"}
                    onClick={() => setTab("MINE")}
                    type="button"
                >
                    My requests <span>{myActions}</span>
                </button>
            </nav>
            {tab === "ORG" && (
                <DirectorDashboardOrgOverview now={now} records={records} />
            )}
            {tab === "TEAM" && (
                <ManagerDashboardTeamRecords
                    account={account}
                    approvalHref="/beta/director/pending-approvals"
                    needsApproval={directorNeedsApproval}
                    projects={projects}
                    records={records}
                />
            )}
            {tab === "MINE" && (
                <ManagerDashboardMyRequest account={account} records={mine} />
            )}
        </main>
    );
}

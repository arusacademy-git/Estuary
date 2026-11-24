"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  fetchManagerDashboard,
  managerNeedsApproval,
  managerRequesterAction,
  type ManagerDashboardRecord,
  type ManagerProjectOption,
} from "@/data/dashboard/manager-dashboard-api";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

import { ManagerDashboardMyRequest } from "./manager-dashboard-my-request";
import styles from "./manager-dashboard.module.css";
import { ManagerDashboardTeamRecords } from "./manager-dashboard-team-records";

type ManagerTab = "TEAM" | "MINE";
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

export function ManagerDashboard({ account }: { account: BetaAccount }) {
  const [tab, setTab] = useState<ManagerTab>("TEAM");
  const [records, setRecords] = useState<ManagerDashboardRecord[]>([]);
  const [projects, setProjects] = useState<ManagerProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetchManagerDashboard(account)
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
  const pendingApprovals = records.filter(managerNeedsApproval).length;
  const myActions = mine.filter(managerRequesterAction).length;
  const lastUsedType = [...records].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
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
    return <div className={styles.loading}>Loading Manager workspace…</div>;

  return (
    <main className={styles.dashboard}>
      <section className={styles.hero}>
        <div>
          <p>
            {greeting}, {account.name.split(" ")[0]} ·{" "}
            {new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(
              now,
            )}
          </p>
          <h1>Manager workspace</h1>
          <span>
            Preview Payment Vouchers and review assigned Payment Requests across
            every request type.
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
            <Link
              data-followup
              href={
                tab === "TEAM"
                  ? "/beta/project-manager/pending-approvals"
                  : "/beta/payment-records?scope=mine&summary=ACTION"
              }
            >
              {tab === "TEAM" ? pendingApprovals : myActions} to follow up
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

      <nav aria-label="Manager dashboard view" className={styles.tabs}>
        <button
          aria-pressed={tab === "TEAM"}
          onClick={() => setTab("TEAM")}
          type="button"
        >
          Team approvals <span>{pendingApprovals}</span>
        </button>
        <button
          aria-pressed={tab === "MINE"}
          onClick={() => setTab("MINE")}
          type="button"
        >
          My requests <span>{myActions}</span>
        </button>
      </nav>

      {tab === "TEAM" ? (
        <ManagerDashboardTeamRecords
          account={account}
          projects={projects}
          records={records}
        />
      ) : (
        <ManagerDashboardMyRequest account={account} records={mine} />
      )}
    </main>
  );
}

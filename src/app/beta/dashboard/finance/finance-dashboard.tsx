"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  fetchFinanceDashboard,
  financeCompletedStatuses,
  financeNeedsProcessing,
} from "@/data/dashboard/finance-dashboard-api";
import {
  managerTypeCodes,
  type ManagerDashboardRecord,
  type ManagerDashboardType,
} from "@/data/dashboard/manager-dashboard-api";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

import { DirectorDashboardOrgOverview } from "../director/director-dashboard-org-overview";
import styles from "./finance-dashboard.module.css";
import { FinanceProgrammeBudgets } from "./finance-programme-budgets";

type FinanceTab = "QUEUE" | "ORG";
const managerTypeOrder: ManagerDashboardType[] = [
  "PAYMENT_VOUCHER",
  "INVOICE_PAYMENT",
  "TRAVEL_ALLOWANCE",
  "CASH_ADVANCE",
  "PETTY_CASH",
  "EXPENSE_CLAIM",
];
const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
const ageInDays = (value: string, now: Date) =>
  Math.max(
    0,
    Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000),
  );

export function FinanceDashboard({ account }: { account: BetaAccount }) {
  const [tab, setTab] = useState<FinanceTab>("QUEUE");
  const [records, setRecords] = useState<ManagerDashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetchFinanceDashboard(account)
      .then((items) => {
        if (active) setRecords(items);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [account]);

  const queue = records.filter(financeNeedsProcessing);
  const completed = records.filter((record) =>
    financeCompletedStatuses.has(record.status),
  );
  const released = records.filter(
    (record) =>
      financeCompletedStatuses.has(record.status) ||
      [
        "PAYMENT_PROCESSED",
        "FINANCE_VERIFIED",
        "TRANSACTION_PROOF_UPLOADED",
      ].includes(record.status),
  );
  const unreconciled = records.filter((record) =>
    record.status.includes("RECONCILIATION"),
  );
  const groupedQueue = managerTypeOrder
    .map((type) => {
      const items = queue.filter((record) => record.type === type);
      return {
        type,
        count: items.length,
        amount: items.reduce((sum, record) => sum + record.amount, 0),
        oldest: Math.max(
          0,
          ...items.map((item) => ageInDays(item.updatedAt, now)),
        ),
      };
    })
    .filter((group) => group.count > 0);
  const releasedByMonth = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + offset, 1);
    const total = released
      .filter((record) => {
        const value = new Date(record.updatedAt);
        return (
          value.getFullYear() === date.getFullYear() &&
          value.getMonth() === date.getMonth()
        );
      })
      .reduce((sum, record) => sum + record.amount, 0);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat("en-MY", { month: "short" }).format(date),
      total,
    };
  });
  const chartMaximum = Math.max(
    1,
    ...releasedByMonth.map((month) => month.total),
  );
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";

  if (loading)
    return <div className={styles.loading}>Loading Finance workspace…</div>;

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
          <h1>Finance workspace</h1>
          <span>Verify, process and record payments across Estuary.</span>
        </div>
        <div>
          <Link href="/beta/finance/pending-processing">
            Open processing queue →
          </Link>
          <span>{queue.length} to process</span>
        </div>
      </section>

      <nav className={styles.tabs} aria-label="Finance dashboard view">
        <button
          aria-pressed={tab === "QUEUE"}
          onClick={() => setTab("QUEUE")}
          type="button"
        >
          Finance queue <span>{queue.length}</span>
        </button>
        <button
          aria-pressed={tab === "ORG"}
          onClick={() => setTab("ORG")}
          type="button"
        >
          Org overview
        </button>
      </nav>

      {tab === "QUEUE" ? (
        <>
          <section className={styles.kpis}>
            {[
              [
                "Pending processing",
                queue.length,
                "Waiting for a Finance action",
                "pending",
                "/assets/icons/pending-processing-tile.png",
              ],
              [
                "Received by Finance",
                records.length,
                "Across all payment types",
                "received",
                "/assets/icons/received-by-finance-tile.png",
              ],
              [
                "Payments completed",
                completed.length,
                "Paid and closed",
                "completed",
                "/assets/icons/payments-completed-tile.png",
              ],
              [
                "Unreconciled advances",
                unreconciled.length,
                "Cash advances without receipts",
                "reconciliation",
                "/assets/icons/unreconciled-advances-tile.png",
              ],
            ].map(([label, value, note, tone, icon]) => (
              <article data-tone={tone} key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
                <i>
                  <Image alt="" height={22} src={String(icon)} width={22} />
                </i>
              </article>
            ))}
          </section>

          <section className={styles.queueCard}>
            <header>
              <div>
                <h2>Priority processing queue</h2>
                <p>
                  Requests waiting for the next Finance action, by payment type.
                </p>
              </div>
              <span>{queue.length} pending</span>
            </header>
            <div className={styles.queueTable}>
              <div>
                <b>Type</b>
                <b>Pending</b>
                <b>Total amount</b>
                <b>Oldest waiting</b>
                <b>Action</b>
              </div>
              {groupedQueue.map((group) => (
                <div key={group.type}>
                  <i data-type={group.type}>{managerTypeCodes[group.type]}</i>
                  <strong>{group.count}</strong>
                  <strong>{money(group.amount)}</strong>
                  <em
                    data-age={
                      group.oldest >= 6
                        ? "late"
                        : group.oldest >= 4
                          ? "warning"
                          : "okay"
                    }
                  >
                    {group.oldest} day{group.oldest === 1 ? "" : "s"}
                  </em>
                  <Link
                    href={`/beta/finance/pending-processing?type=${group.type}`}
                  >
                    Process
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.chartCard}>
            <header>
              <div>
                <h2>Payments released</h2>
                <p>Money paid out by Finance each month, last 6 months.</p>
              </div>
              <strong>
                This month
                <br />
                {money(releasedByMonth.at(-1)?.total ?? 0)}
              </strong>
            </header>
            <div className={styles.chart}>
              {releasedByMonth.map((month, index) => (
                <div key={month.key}>
                  <strong>{money(month.total)}</strong>
                  <i
                    data-current={index === releasedByMonth.length - 1}
                    style={{
                      height: `${Math.max(3, (month.total / chartMaximum) * 100)}%`,
                    }}
                  />
                  <span>{month.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.accountingCard}>
            <h2>Accounting and reconciliation</h2>
            <div>
              <Link href="/beta/finance/sql-entry-tracker">
                <i>
                  <Image
                    alt=""
                    height={38}
                    src="/assets/icons/sql-entry-tracker-tile.png"
                    width={38}
                  />
                </i>
                <span>
                  <strong>SQL Entry Tracker</strong>
                  <small>Paid transactions not yet recorded in SQL</small>
                </span>
                <b>{completed.length}</b>
              </Link>
              <Link href="/beta/team-records?group=RECONCILED">
                <i>
                  <Image
                    alt=""
                    height={38}
                    src="/assets/icons/unreconciled-advances-tile.png"
                    width={38}
                  />
                </i>
                <span>
                  <strong>Reconciliation</strong>
                  <small>Outstanding cash advances and petty cash</small>
                </span>
                <b>{unreconciled.length}</b>
              </Link>
            </div>
          </section>
        </>
      ) : (
        <div className={styles.orgOverview}>
          <DirectorDashboardOrgOverview now={now} records={records} />
          <FinanceProgrammeBudgets records={records} />
        </div>
      )}
    </main>
  );
}

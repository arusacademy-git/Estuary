"use client";

import Image from "next/image";
import Link from "next/link";

import {
  managerCompletedStatuses,
  managerReturnedStatuses,
  managerTypeCodes,
  managerTypeLabels,
  type ManagerDashboardRecord,
  type ManagerDashboardType,
} from "@/data/dashboard/manager-dashboard-api";

import styles from "./director-dashboard-org-overview.module.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
const pendingStatuses = (status: string) =>
  status.includes("PENDING") || status.includes("AWAITING");
const ageInDays = (value: string, now: Date) =>
  Math.max(
    0,
    Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000),
  );

function statusTone(record: ManagerDashboardRecord) {
  if (managerCompletedStatuses.has(record.status)) return "complete";
  if (managerReturnedStatuses.has(record.status)) return "returned";
  return "pending";
}

export function DirectorDashboardOrgOverview({
  now,
  records,
}: {
  now: Date;
  records: ManagerDashboardRecord[];
}) {
  const completed = records.filter((record) =>
    managerCompletedStatuses.has(record.status),
  );
  const inProgress = records.filter((record) => pendingStatuses(record.status));
  const unreconciled = records.filter((record) =>
    record.status.includes("RECONCILIATION"),
  );
  const returned = records.filter((record) =>
    managerReturnedStatuses.has(record.status),
  );
  const delayedApprovals = records.filter(
    (record) =>
      record.status.includes("APPROVAL") &&
      ageInDays(record.updatedAt, now) >= 7,
  );
  const delayedFinance = records.filter(
    (record) =>
      record.status.includes("FINANCE") &&
      ageInDays(record.updatedAt, now) >= 5,
  );
  const byType = Object.keys(managerTypeLabels).map((type) => {
    const paymentType = type as ManagerDashboardType;
    const typed = records.filter((record) => record.type === paymentType);
    return {
      active: typed.filter(
        (record) => !managerCompletedStatuses.has(record.status),
      ).length,
      attention: typed.filter(
        (record) =>
          managerReturnedStatuses.has(record.status) ||
          (pendingStatuses(record.status) &&
            ageInDays(record.updatedAt, now) >= 5),
      ).length,
      done: typed.filter((record) =>
        managerCompletedStatuses.has(record.status),
      ).length,
      paymentType,
    };
  });

  return (
    <div className={styles.overview}>
      <section className={styles.kpis}>
        <article data-tone="records">
          <span>Organisation records</span>
          <strong>{records.length}</strong>
          <small>Across every team and payment type</small>
          <i>
            <Image
              alt=""
              height={22}
              src="/assets/icons/team-records-white.png"
              width={22}
            />
          </i>
        </article>
        <article data-tone="progress">
          <span>In progress</span>
          <strong>{inProgress.length}</strong>
          <small>Awaiting approval or payment</small>
          <i>
            <Image
              alt=""
              height={22}
              src="/assets/icons/in-progress-clock-white.png"
              width={22}
            />
          </i>
        </article>
        <article data-tone="completed">
          <span>Completed payments</span>
          <strong>{completed.length}</strong>
          <small>Paid or fully closed</small>
          <i>
            <Image
              alt=""
              height={22}
              src="/assets/icons/completed-check-white.png"
              width={22}
            />
          </i>
        </article>
      </section>

      <section className={styles.highlights}>
        <header>
          <h2>Oversight highlights</h2>
          <p>
            Items across the organisation that may need your attention. Click
            one to see those records.
          </p>
        </header>
        <div>
          <Link
            data-tone="reconciliation"
            href="/beta/team-records?group=RECONCILED"
          >
            <i>
              <Image
                alt=""
                height={18}
                src="/assets/icons/reconciliation-sync-white.png"
                width={18}
              />
            </i>
            <strong>
              {unreconciled.length}
              <span>Unreconciled advances</span>
              <small>Cash advances without receipts</small>
            </strong>
          </Link>
          <Link data-tone="returned" href="/beta/team-records?group=INACTIVE">
            <i aria-hidden="true">↩</i>
            <strong>
              {returned.length}
              <span>Returned requests</span>
              <small>Sent back for corrections</small>
            </strong>
          </Link>
          <Link data-tone="delayed" href="/beta/team-records?group=APPROVAL">
            <i>
              <Image
                alt=""
                height={18}
                src="/assets/icons/in-progress-clock-white.png"
                width={18}
              />
            </i>
            <strong>
              {delayedApprovals.length}
              <span>Delayed approvals</span>
              <small>Waiting 7 days or more</small>
            </strong>
          </Link>
          <Link data-tone="finance" href="/beta/team-records?group=PAYMENT">
            <i>
              <Image
                alt=""
                height={18}
                src="/assets/icons/sandglass-blue.png"
                width={18}
              />
            </i>
            <strong>
              {delayedFinance.length}
              <span>Finance pending too long</span>
              <small>With Finance over 5 days</small>
            </strong>
          </Link>
        </div>
      </section>

      <div className={styles.activityGrid}>
        <section className={styles.typeOverview}>
          <header>
            <h2>Organisation payment overview</h2>
            <p>Payment activity by type.</p>
          </header>
          <div className={styles.typeTable}>
            <div>
              <b>Type</b>
              <b>Active</b>
              <b>Done</b>
              <b>Attention</b>
            </div>
            {byType.map((item) => (
              <Link
                href={`/beta/team-records?type=${item.paymentType}`}
                key={item.paymentType}
              >
                <i data-type={item.paymentType}>
                  {managerTypeCodes[item.paymentType]}
                </i>
                <span>{item.active}</span>
                <span>{item.done}</span>
                <em data-active={item.attention > 0}>{item.attention}</em>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.recentActivity}>
          <header>
            <div>
              <h2>Recent payment activity</h2>
              <p>Latest requests and payments · across the organisation.</p>
            </div>
            <Link href="/beta/team-records">View all →</Link>
          </header>
          <div className={styles.recordsTable}>
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Requester</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 6).map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>{record.reference}</strong>
                    </td>
                    <td>{record.requesterName}</td>
                    <td>
                      <strong>{money(record.amount)}</strong>
                    </td>
                    <td>
                      <span data-tone={statusTone(record)}>
                        {record.statusLabel}
                      </span>
                    </td>
                    <td>
                      <Link href={record.href}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>
            Showing {Math.min(6, records.length)} of {records.length} records
          </small>
        </section>
      </div>
    </div>
  );
}

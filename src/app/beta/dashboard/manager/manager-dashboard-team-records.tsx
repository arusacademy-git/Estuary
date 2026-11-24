"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
  managerCompletedStatuses,
  managerNeedsApproval,
  type ManagerDashboardRecord,
  type ManagerProjectOption,
} from "@/data/dashboard/manager-dashboard-api";
import { MyRequestAction } from "@/features/payment-records/components/shared/my-request-action";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "./manager-dashboard.module.css";

const money = (value: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    value,
  );

type TeamSortKey =
  | "reference"
  | "requester"
  | "project"
  | "purpose"
  | "amount"
  | "status";
type SortDirection = "asc" | "desc";

export function ManagerDashboardTeamRecords({
  account,
  approvalHref = "/beta/project-manager/pending-approvals",
  needsApproval = managerNeedsApproval,
  projects,
  records,
}: {
  account: BetaAccount;
  approvalHref?: string;
  needsApproval?: (record: ManagerDashboardRecord) => boolean;
  projects: ManagerProjectOption[];
  records: ManagerDashboardRecord[];
}) {
  const [project, setProject] = useState("ALL");
  const [sortKey, setSortKey] = useState<TeamSortKey>("reference");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const toggleSort = (nextKey: TeamSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "amount" ? "desc" : "asc");
  };
  const visible = records
    .filter((record) => project === "ALL" || record.projectCode === project)
    .sort((left, right) => {
      const values: Record<TeamSortKey, [string | number, string | number]> = {
        reference: [left.reference, right.reference],
        requester: [left.requesterName, right.requesterName],
        project: [
          left.projectName ?? left.projectCode ?? "",
          right.projectName ?? right.projectCode ?? "",
        ],
        purpose: [left.purpose, right.purpose],
        amount: [left.amount, right.amount],
        status: [left.statusLabel, right.statusLabel],
      };
      const [leftValue, rightValue] = values[sortKey];
      const result =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), "en-MY", {
              numeric: true,
              sensitivity: "base",
            });
      return sortDirection === "asc" ? result : -result;
    })
    .slice(0, 10);
  const pending = records.filter(needsApproval);
  const completed = records.filter((record) =>
    managerCompletedStatuses.has(record.status),
  );

  return (
    <>
      <section className={styles.stats}>
        <Link
          className={styles.statCard}
          data-tone="approval"
          href={approvalHref}
        >
          <span>Pending your approval</span>
          <strong>{pending.length}</strong>
          <small>Requests waiting for your review</small>
          <i>
            <Image
              alt=""
              height={22}
              src="/assets/icons/clipboard-check.png"
              width={22}
            />
          </i>
        </Link>
        <Link
          className={styles.statCard}
          data-tone="team"
          href="/beta/team-records"
        >
          <span>Team records</span>
          <strong>{records.length}</strong>
          <small>Assigned and submitted records</small>
          <i>
            <Image
              alt=""
              height={22}
              src="/assets/icons/team-records-white.png"
              width={22}
            />
          </i>
        </Link>
        <Link
          className={styles.statCard}
          data-tone="complete"
          href="/beta/team-records?group=COMPLETED"
        >
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
        </Link>
      </section>

      <section className={styles.approvalPanel}>
        <header>
          <div>
            <h2>
              <Image
                alt=""
                aria-hidden="true"
                height={24}
                src="/assets/icons/clipboard-check.png"
                width={24}
              />
              Pending approvals
            </h2>
            <p>
              Review requests assigned to you before they move to the next
              payment stage.
            </p>
          </div>
          <span>{pending.length} pending</span>
        </header>
        <div>
          <strong>{pending.length} requests awaiting review</strong>
          <small>Open your approval queue to review each request.</small>
          <Link href={approvalHref}>Review →</Link>
        </div>
      </section>

      <section className={styles.activity}>
        <header>
          <div>
            <p>Team activity</p>
            <h2>Team payment activity</h2>
            <span>
              Requests from your team, with requester, purpose, amount and
              approval status.
            </span>
          </div>
          <label>
            Project
            <select
              onChange={(event) => setProject(event.target.value)}
              value={project}
            >
              <option value="ALL">All projects</option>
              {projects.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </header>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {(
                  [
                    ["reference", "Reference"],
                    ["requester", "Requester"],
                    ["project", "Project name"],
                    ["purpose", "Purpose"],
                    ["amount", "Amount"],
                    ["status", "Status"],
                  ] as const
                ).map(([key, label]) => (
                  <th
                    aria-sort={
                      sortKey === key
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    key={key}
                  >
                    <button
                      className={styles.sortHeader}
                      data-active={sortKey === key}
                      onClick={() => toggleSort(key)}
                      type="button"
                    >
                      {label}
                      <span aria-hidden="true">
                        {sortKey === key
                          ? sortDirection === "asc"
                            ? "▲"
                            : "▼"
                          : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.reference}</strong>
                    <small>{record.typeLabel}</small>
                  </td>
                  <td>{record.requesterName}</td>
                  <td>{record.projectName ?? record.projectCode ?? "—"}</td>
                  <td>{record.purpose}</td>
                  <td>
                    <strong>{money(record.amount)}</strong>
                  </td>
                  <td>
                    <span
                      className={styles.status}
                      data-complete={managerCompletedStatuses.has(
                        record.status,
                      )}
                      data-pending={
                        record.status.startsWith("PENDING_") ||
                        record.status.startsWith("AWAITING_")
                      }
                    >
                      {record.statusLabel}
                    </span>
                  </td>
                  <td>
                    <MyRequestAction
                      label={managerNeedsApproval(record) ? "Review" : "Open"}
                      onDraftDeleted={() => undefined}
                      organizationId="beta-arus-org"
                      record={{
                        id: record.id,
                        type:
                          record.type === "EXPENSE_CLAIM"
                            ? "CLAIM"
                            : record.type,
                        reference: record.reference,
                        purpose: record.purpose,
                        amount: record.amount,
                        href: record.href,
                        draft: false,
                      }}
                      requesterId={account.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link className={styles.viewAll} href="/beta/team-records">
          View team records →
        </Link>
      </section>
    </>
  );
}

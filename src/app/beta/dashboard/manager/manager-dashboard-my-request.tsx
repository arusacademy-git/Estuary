"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
  managerCompletedStatuses,
  managerRequesterAction,
  managerReturnedStatuses,
  managerTypeCodes,
  managerTypeLabels,
  type ManagerDashboardRecord,
  type ManagerDashboardType,
} from "@/data/dashboard/manager-dashboard-api";
import { MyRequestAction } from "@/features/payment-records/components/shared/my-request-action";
import type { BetaAccount } from "@/lib/auth/beta-accounts";

import styles from "./manager-dashboard.module.css";

type StatusFilter = "ALL" | "PROGRESS" | "COMPLETED";
type MyRequestSortKey =
  | "reference"
  | "requester"
  | "amount"
  | "submitted"
  | "status";
type SortDirection = "asc" | "desc";
const money = (value: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    value,
  );
const date = (value: string) =>
  new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export function ManagerDashboardMyRequest({
  account,
  records,
}: {
  account: BetaAccount;
  records: ManagerDashboardRecord[];
}) {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [type, setType] = useState<"ALL" | ManagerDashboardType>("ALL");
  const [sortKey, setSortKey] = useState<MyRequestSortKey>("submitted");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const toggleSort = (nextKey: MyRequestSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(
      nextKey === "amount" || nextKey === "submitted" ? "desc" : "asc",
    );
  };
  const actions = records.filter(managerRequesterAction);
  const completed = records.filter((record) =>
    managerCompletedStatuses.has(record.status),
  );
  const progress = records.filter(
    (record) =>
      !managerCompletedStatuses.has(record.status) &&
      !managerReturnedStatuses.has(record.status) &&
      !managerRequesterAction(record),
  );
  const visible = records
    .filter((record) => type === "ALL" || record.type === type)
    .filter(
      (record) =>
        status === "ALL" ||
        (status === "COMPLETED"
          ? managerCompletedStatuses.has(record.status)
          : !managerCompletedStatuses.has(record.status) &&
          !managerReturnedStatuses.has(record.status)),
    )
    .sort((left, right) => {
      const values: Record<
        MyRequestSortKey,
        [string | number, string | number]
      > = {
        reference: [left.reference, right.reference],
        requester: [left.requesterName, right.requesterName],
        amount: [left.amount, right.amount],
        submitted: [left.updatedAt, right.updatedAt],
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

  return (
    <>
      <section className={styles.stats}>
        <Link
          className={styles.statCard}
          data-tone="approval"
          href="/beta/payment-records?scope=mine&summary=ACTION"
        >
          <span>Needs your action</span>
          <strong>{actions.length}</strong>
          <small>Returned or reconciliation due</small>
          <i>
            <Image
              alt=""
              height={22}
              src="/assets/icons/requires-action-bell-white.png"
              width={22}
            />
          </i>
        </Link>
        <Link
          className={styles.statCard}
          data-tone="team"
          href="/beta/payment-records?scope=mine&summary=PROGRESS"
        >
          <span>In progress</span>
          <strong>{progress.length}</strong>
          <small>Awaiting approval or processing</small>
          <i>
            <Image
              alt=""
              height={22}
              src="/assets/icons/in-progress-clock-white.png"
              width={22}
            />
          </i>
        </Link>
        <Link
          className={styles.statCard}
          data-tone="complete"
          href="/beta/payment-records?scope=mine&summary=COMPLETED"
        >
          <span>Completed</span>
          <strong>{completed.length}</strong>
          <small>Paid or closed</small>
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
              <span aria-hidden="true">!</span> Needs your action
            </h2>
            <p>
              These requests need a response from you before they can move
              forward.
            </p>
          </div>
          <span>
            {actions.length} request{actions.length === 1 ? "" : "s"}
          </span>
        </header>
        {(Object.keys(managerTypeLabels) as ManagerDashboardType[]).map(
          (paymentType) => {
            const typeActions = actions.filter(
              (record) => record.type === paymentType,
            );
            if (!typeActions.length) return null;
            const first = typeActions[0];
            return (
              <div data-type={paymentType} key={paymentType}>
                <i>{managerTypeCodes[paymentType]}</i>
                <section>
                  <strong>
                    {managerTypeLabels[paymentType]}
                    <em>
                      {typeActions.length} item
                      {typeActions.length === 1 ? "" : "s"}
                    </em>
                  </strong>
                  <small>
                    {first.reference} · {first.statusLabel} ·{" "}
                    {money(first.amount)}
                  </small>
                </section>
                <Link
                  href={`/beta/payment-records?scope=mine&summary=ACTION&type=${paymentType === "EXPENSE_CLAIM" ? "CLAIM" : paymentType}`}
                >
                  Review correction →
                </Link>
              </div>
            );
          },
        )}
        {!actions.length && (
          <div>
            <strong>All caught up</strong>
            <small>Nothing needs your action right now.</small>
          </div>
        )}
      </section>
      <section className={styles.activity}>
        <header>
          <div>
            <p>Recent activity</p>
            <h2>My latest payments and requests</h2>
            <span>
              Combined activity from every supported payment workflow.
            </span>
          </div>
          <Link href="/beta/payment-records?scope=mine">View all records</Link>
        </header>
        <div className={styles.activityFilters}>
          <div>
            {(["ALL", "PROGRESS", "COMPLETED"] as const).map((value) => (
              <button
                aria-pressed={status === value}
                key={value}
                onClick={() => setStatus(value)}
                type="button"
              >
                {value === "ALL"
                  ? "All requests"
                  : value === "PROGRESS"
                    ? "In progress"
                    : "Completed"}
              </button>
            ))}
          </div>
          <label>
            Payment type
            <select
              onChange={(event) =>
                setType(event.target.value as "ALL" | ManagerDashboardType)
              }
              value={type}
            >
              <option value="ALL">All types</option>
              {Object.entries(managerTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {(
                  [
                    ["reference", "Reference"],
                    ["requester", "Requester"],
                    ["amount", "Amount"],
                    ["submitted", "Submitted"],
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
                  <td>
                    <strong>{money(record.amount)}</strong>
                  </td>
                  <td>{date(record.updatedAt)}</td>
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
                      label="Open"
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
        <small className={styles.showing}>
          Showing {visible.length} of {records.length} requests
        </small>
      </section>
    </>
  );
}

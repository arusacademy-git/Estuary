"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { MyRequestAction } from "@/features/payment-records/components/shared/my-request-action";
import type { BetaAccount } from "@/lib/auth/beta-accounts";
import {
  fetchStaffDashboardRecords,
  staffCompletedStatuses,
  staffNeedsAction,
  staffRequestsHref,
  staffReturnedStatuses,
  staffTypeCodes,
  staffTypeLabels,
  staffTypeOrder,
  type StaffDashboardRecord,
  type StaffDashboardType,
} from "@/data/dashboard/staff-dashboard-api";

import styles from "./staff-dashboard.module.css";

type StatusFilter = "ALL" | "IN_PROGRESS" | "COMPLETED";
type SortKey = "reference" | "requester" | "amount" | "submitted" | "status";
type SortDirection = "asc" | "desc";

const sortableColumns: Array<{ key: SortKey; label: string }> = [
  { key: "reference", label: "Reference" },
  { key: "requester", label: "Requester" },
  { key: "amount", label: "Amount" },
  { key: "submitted", label: "Submitted" },
  { key: "status", label: "Status" },
];

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

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function StaffDashboard({ account }: { account: BetaAccount }) {
  const [records, setRecords] = useState<StaffDashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | StaffDashboardType>(
    "ALL",
  );
  const [sortKey, setSortKey] = useState<SortKey>("submitted");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    fetchStaffDashboardRecords(account)
      .then((items) => {
        if (active) setRecords(items);
      })
      .catch(() => {
        if (active) setWarning("Dashboard records could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [account]);

  const actionRecords = useMemo(
    () => records.filter(staffNeedsAction),
    [records],
  );
  const completed = records.filter((record) =>
    staffCompletedStatuses.has(record.status),
  ).length;
  const inProgress = records.filter(
    (record) =>
      !staffCompletedStatuses.has(record.status) &&
      !staffReturnedStatuses.has(record.status),
  ).length;
  const filtered = useMemo(
    () =>
      records
        .filter((record) => typeFilter === "ALL" || record.type === typeFilter)
        .filter((record) => {
          if (statusFilter === "COMPLETED")
            return staffCompletedStatuses.has(record.status);
          if (statusFilter === "IN_PROGRESS")
            return (
              !staffCompletedStatuses.has(record.status) &&
              !staffReturnedStatuses.has(record.status)
            );
          return true;
        })
        .sort((a, b) => {
          const direction = sortDirection === "asc" ? 1 : -1;
          if (sortKey === "amount") return (a.amount - b.amount) * direction;
          if (sortKey === "submitted")
            return (
              (new Date(a.updatedAt).getTime() -
                new Date(b.updatedAt).getTime()) *
              direction
            );
          const left =
            sortKey === "reference"
              ? a.reference
              : sortKey === "requester"
                ? a.requesterName
                : a.statusLabel;
          const right =
            sortKey === "reference"
              ? b.reference
              : sortKey === "requester"
                ? b.requesterName
                : b.statusLabel;
          return (
            left.localeCompare(right, "en-MY", {
              numeric: true,
              sensitivity: "base",
            }) * direction
          );
        }),
    [records, sortDirection, sortKey, statusFilter, typeFilter],
  );
  const recent = filtered.slice(0, 10);
  const lastUsedType = [...records].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0]?.type;
  const recentCreateOption = createOptions.find(
    (option) => option.type === lastUsedType,
  );
  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "submitted" ? "desc" : "asc");
  };

  if (loading)
    return (
      <div className={styles.loading}>Loading your Estuary workspace…</div>
    );

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
          <h1>My payment workspace</h1>
          <span>
            Create payments, follow every request type and respond to
            corrections from one place.
          </span>
        </div>
        <div className={styles.heroActions}>
          <button
            className={styles.makePaymentButton}
            onClick={() => setPaymentMenuOpen((open) => !open)}
            type="button"
          >
            ＋ Request a payment
          </button>
          {!paymentMenuOpen && (
            <Link
              className={styles.followUpLink}
              data-empty={actionRecords.length === 0}
              href={staffRequestsHref(undefined, "ACTION")}
            >
              {actionRecords.length
                ? `${actionRecords.length} to follow up`
                : "All caught up"}
            </Link>
          )}
          {paymentMenuOpen && (
            <div className={styles.makePaymentMenu}>
              {recentCreateOption && (
                <div className={styles.makePaymentGroup}>
                  <span>Recent</span>
                  <Link
                    data-type={recentCreateOption.type}
                    href={recentCreateOption.href}
                    onClick={() => setPaymentMenuOpen(false)}
                  >
                    <i />
                    <b>{recentCreateOption.label}</b>
                    <small>{recentCreateOption.description}</small>
                    <em>Last used</em>
                  </Link>
                </div>
              )}
              <div className={styles.makePaymentGroup}>
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

      {warning && <div className={styles.warning}>{warning}</div>}

      <section className={styles.staffKpis} aria-label="My request summary">
        {(
          [
            [
              "Needs your action",
              actionRecords.length,
              "Requests waiting for your follow-up",
              "action",
              "ACTION",
              "/assets/icons/requires-action-bell-white.png",
            ],
            [
              "In progress",
              inProgress,
              "Awaiting approval or processing",
              "progress",
              "PROGRESS",
              "/assets/icons/in-progress-clock-white.png",
            ],
            [
              "Completed",
              completed,
              "Paid or fully closed",
              "completed",
              "COMPLETED",
              "/assets/icons/completed-check-white.png",
            ],
          ] as const
        ).map(([label, value, note, tone, summary, icon]) => (
          <Link
            className={styles.staffKpiCard}
            data-tone={tone}
            href={staffRequestsHref(undefined, summary)}
            key={label}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
            <i aria-hidden="true">
              <Image alt="" height={22} src={icon} width={22} />
            </i>
          </Link>
        ))}
      </section>

      <section
        className={styles.staffActionPanel}
        data-empty={actionRecords.length === 0}
      >
        <header className={styles.staffActionHeader}>
          <div>
            <h2>
              <span>!</span> Needs your action
            </h2>
            <p>
              These requests need a response from you before they can move
              forward.
            </p>
          </div>
          <strong>
            {actionRecords.length} request
            {actionRecords.length === 1 ? "" : "s"}
          </strong>
        </header>
        <div className={styles.staffActionList}>
          {staffTypeOrder.map((type) => {
            const typeActions = actionRecords.filter(
              (record) => record.type === type,
            );
            const count = typeActions.length;
            if (!count) return null;
            const returned = typeActions.find((record) =>
              staffReturnedStatuses.has(record.status),
            );
            return (
              <div
                className={styles.staffActionRow}
                data-type={type}
                key={type}
              >
                <i>{staffTypeCodes[type]}</i>
                <div>
                  <strong>
                    {staffTypeLabels[type]}
                    <small>
                      {count} item{count === 1 ? "" : "s"}
                    </small>
                  </strong>
                  <span>
                    {returned
                      ? `${returned.reference} · ${returned.statusLabel} · ${money(returned.amount)}`
                      : `${count} request${count === 1 ? "" : "s"} need follow-up: add missing details or confirm receipts.`}
                  </span>
                </div>
                <Link
                  data-primary={Boolean(returned)}
                  href={staffRequestsHref(type, "ACTION")}
                >
                  {returned
                    ? "Review correction"
                    : `Review ${staffTypeLabels[type].toLowerCase()}`}{" "}
                  →
                </Link>
              </div>
            );
          })}
          {!actionRecords.length && (
            <div className={styles.staffActionEmpty}>
              All caught up. Nothing needs your action right now.
            </div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p>Recent activity</p>
            <h2>My latest payments and requests</h2>
            <span>
              Combined activity from every supported payment workflow.
            </span>
          </div>
          <Link href={staffRequestsHref()}>View all records</Link>
        </div>
        <div className={styles.recentFilters}>
          <div className={styles.recentStatusTabs}>
            {(["ALL", "IN_PROGRESS", "COMPLETED"] as const).map((value) => (
              <button
                aria-pressed={statusFilter === value}
                key={value}
                onClick={() => setStatusFilter(value)}
                type="button"
              >
                {value === "ALL"
                  ? "All requests"
                  : value === "IN_PROGRESS"
                    ? "In progress"
                    : "Completed"}
              </button>
            ))}
          </div>
          <label className={styles.recentTypeFilter}>
            <span>Payment type</span>
            <select
              onChange={(event) =>
                setTypeFilter(event.target.value as "ALL" | StaffDashboardType)
              }
              value={typeFilter}
            >
              <option value="ALL">All types</option>
              {staffTypeOrder.map((type) => (
                <option key={type} value={type}>
                  {staffTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {sortableColumns.map((column) => {
                  const active = sortKey === column.key;
                  return (
                    <th
                      aria-sort={
                        active
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      key={column.key}
                    >
                      <button
                        className={styles.sortHeader}
                        data-active={active}
                        onClick={() => toggleSort(column.key)}
                        type="button"
                      >
                        {column.label}
                        <span aria-hidden="true">
                          {active ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {recent.map((record) => (
                <tr key={`${record.type}-${record.id}`}>
                  <td>
                    <strong>{record.reference}</strong>
                    <small className={styles.referenceType}>
                      {record.typeLabel}
                    </small>
                  </td>
                  <td>{record.requesterName}</td>
                  <td>
                    <strong>{money(record.amount)}</strong>
                  </td>
                  <td>{date(record.updatedAt)}</td>
                  <td>
                    <span
                      className={styles.status}
                      data-status={record.status}
                      data-tone={
                        staffCompletedStatuses.has(record.status)
                          ? "green"
                          : staffReturnedStatuses.has(record.status)
                            ? "red"
                            : record.status.startsWith("PENDING_") ||
                                record.status.startsWith("AWAITING_") ||
                                staffNeedsAction(record)
                              ? "amber"
                              : "blue"
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
                        purpose: record.typeLabel,
                        amount: record.amount,
                        href: record.href,
                        draft: record.status === "DRAFT",
                      }}
                      requesterId={account.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.recentTableFooter}>
            Showing {recent.length} of {filtered.length} requests
          </div>
        </div>
      </section>
    </main>
  );
}

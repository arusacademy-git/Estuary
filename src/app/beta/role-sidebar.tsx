"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import type { BetaAccount, BetaRole } from "@/lib/auth/beta-accounts";
import { isProjectManagerAccount } from "@/features/administration/admin-settings";
import {
  createEmptySidebarActionCounts,
  fetchSidebarActionCounts,
  PENDING_QUEUE_COUNT_EVENT,
  readPublishedPendingQueueCount,
  type SidebarPaymentType,
} from "./sidebar-action-counts";
import styles from "./beta.module.css";
import countStyles from "./role-sidebar-counts.module.css";

type NavigationItem = {
  label: string;
  href?: string;
  children?: NavigationItem[];
  actionType?: SidebarPaymentType;
};

type NavigationGroup = {
  label?: string;
  items: NavigationItem[];
};

const roleLabels: Record<BetaRole, string> = {
  staff: "Programme Staff",
  manager: "Operations Manager",
  director: "Director",
  finance: "Finance Admin",
};

const standardRequests: NavigationItem[] = [
  { label: "Payment Voucher", href: "/beta/payment-vouchers/new" },
  {
    label: "Invoice Payment",
    href: "/beta/payment-requests/invoice-payment/new",
  },
  { label: "Cash Advance", href: "/beta/payment-requests/cash-advance/new" },
];

function paymentRequest(
  includePettyCash = false,
  travelAllowanceHref?: string,
  includePaymentVoucher = true,
): NavigationItem {
  return {
    label: "Payment Request",
    children: [
      ...(includePaymentVoucher ? standardRequests.slice(0, 1) : []),
      ...standardRequests.slice(1, 2),
      ...(travelAllowanceHref
        ? [{ label: "Travel Allowance", href: travelAllowanceHref }]
        : []),
      ...standardRequests.slice(2),
      ...(includePettyCash
        ? [
            {
              label: "Petty Cash",
              href: "/beta/payment-requests/petty-cash/new",
            },
          ]
        : []),
      { label: "Claims", href: "/beta/payment-requests/claims/new" },
    ],
  };
}

const pettyCash: NavigationItem = {
  label: "Petty Cash",
  href: "/beta/petty-cash",
};

export const roleNavigation: Record<BetaRole, NavigationGroup[]> = {
  staff: [
    { items: [{ label: "Overview", href: "/beta/dashboard" }] },
    {
      label: "Create payments",
      items: [paymentRequest(false)],
    },
    {
      items: [
        {
          label: "Petty Cash",
          href: "/beta/payment-requests/petty-cash/new",
        },
      ],
    },
    {
      label: "Records",
      items: [
        {
          label: "My Requests",
          href: "/beta/payment-records?scope=mine",
          actionType: "MY_REQUESTS",
        },
      ],
    },
  ],
  manager: [
    { items: [{ label: "Overview", href: "/beta/dashboard" }] },
    {
      label: "Create payments",
      items: [
        paymentRequest(false, "/beta/payment-requests/travel-allowance/new"),
      ],
    },
    {
      label: "Approvals",
      items: [
        {
          label: "Pending Approvals",
          href: "/beta/project-manager/pending-approvals",
          actionType: "ALL_PENDING",
        },
      ],
    },
    {
      items: [
        {
          label: "Petty Cash",
          href: "/beta/project-manager/payment-requests/petty-cash",
        },
      ],
    },
    {
      label: "Records",
      items: [
        {
          label: "My Requests",
          href: "/beta/payment-records?scope=mine",
          actionType: "MY_REQUESTS",
        },
        { label: "Team Records", href: "/beta/team-records" },
      ],
    },
  ],
  director: [
    { items: [{ label: "Overview", href: "/beta/dashboard" }] },
    {
      label: "Create payments",
      items: [
        paymentRequest(false, "/beta/payment-requests/travel-allowance/new"),
      ],
    },
    {
      label: "Approvals",
      items: [
        {
          label: "Pending Approvals",
          href: "/beta/director/pending-approvals",
          actionType: "ALL_PENDING",
        },
      ],
    },
    { label: "Petty cash", items: [pettyCash] },
    {
      label: "Records",
      items: [
        {
          label: "My Requests",
          href: "/beta/payment-records?scope=mine",
          actionType: "MY_REQUESTS",
        },
        { label: "Team Records", href: "/beta/team-records" },
      ],
    },
  ],
  finance: [
    { items: [{ label: "Overview", href: "/beta/dashboard" }] },
    {
      label: "Create payments",
      items: [paymentRequest(false)],
    },
    {
      label: "Payment processing",
      items: [
        {
          label: "Pending Processing",
          href: "/beta/finance/pending-processing",
          actionType: "ALL_PENDING",
        },
      ],
    },
    {
      label: "SQL system",
      items: [
        { label: "SQL Entry Tracker", href: "/beta/finance/sql-entry-tracker" },
      ],
    },
    { label: "Petty cash", items: [pettyCash] },
    {
      label: "Records",
      items: [
        {
          label: "My Requests",
          href: "/beta/payment-records?scope=mine",
          actionType: "MY_REQUESTS",
        },
        { label: "Team Records", href: "/beta/team-records" },
      ],
    },
  ],
};

export function navigationForRole(
  role: BetaRole,
  projectManager = false,
): NavigationGroup[] {
  if (role !== "staff" || !projectManager) return roleNavigation[role];

  return roleNavigation.staff.flatMap((group) => {
    if (
      group.items.some(
        (item) => item.href === "/beta/payment-requests/petty-cash/new",
      )
    ) {
      return [];
    }

    if (group.label === "Records") {
      return [
        {
          ...group,
          items: [
            ...group.items,
            { label: "Team Records", href: "/beta/team-records" },
          ],
        },
      ];
    }
    if (group.label !== "Create payments") return [group];

    return [
      {
        ...group,
        items: [
          paymentRequest(false, "/beta/payment-requests/travel-allowance/new"),
        ],
      },
      {
        label: "Project management",
        items: [
          {
            label: "Pending Approvals",
            href: "/beta/project-manager/pending-approvals",
            actionType: "ALL_PENDING",
          },
        ],
      },
      {
        items: [
          {
            label: "Petty Cash",
            href: "/beta/project-manager/payment-requests/petty-cash",
          },
        ],
      },
    ];
  });
}

function collectHrefs(items: NavigationItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...(item.children ? collectHrefs(item.children) : []),
  ]);
}

export default function RoleSidebar({ account }: { account: BetaAccount }) {
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const currentQuery = searchParameters.toString();
  const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
  const projectManager = isProjectManagerAccount(account);
  const adminWorkspace =
    account.role === "director" &&
    account.isAdministrator &&
    pathname.startsWith("/beta/administration");
  const baseGroups = navigationForRole(account.role, projectManager);
  const groups = adminWorkspace
    ? [
        {
          items: [
            { label: "Overview", href: "/beta/administration/overview" },
            { label: "Settings", href: "/beta/administration" },
          ],
        },
      ]
    : account.isAdministrator && account.role !== "director"
      ? [
          ...baseGroups,
          {
            label: "System",
            items: [{ label: "Settings", href: "/beta/settings" }],
          },
        ]
      : baseGroups;
  const hrefs = groups.flatMap((group) => collectHrefs(group.items));
  const activeHref = hrefs
    .filter((href) =>
      href.includes("?")
        ? currentUrl === href
        : currentQuery.length === 0 &&
          (pathname === href || pathname.startsWith(`${href}/`)),
    )
    .sort((left, right) => right.length - left.length)[0];

  const initiallyExpanded = Object.fromEntries(
    groups
      .flatMap((group) => group.items)
      .filter((item) =>
        item.children?.some((child) => {
          const nested = collectHrefs([child]);
          return nested.some((href) => href === activeHref);
        }),
      )
      .map((item) => [item.label, true]),
  );
  const [expanded, setExpanded] =
    useState<Record<string, boolean>>(initiallyExpanded);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [actionCounts, setActionCounts] = useState(
    createEmptySidebarActionCounts,
  );

  useEffect(() => {
    let active = true;
    const isCombinedQueue =
      (projectManager &&
        pathname.startsWith("/beta/project-manager/pending-approvals")) ||
      (account.role === "director" &&
        pathname.startsWith("/beta/director/pending-approvals")) ||
      (account.role === "finance" &&
        pathname.startsWith("/beta/finance/pending-processing"));
    const refreshCounts = () => {
      fetchSidebarActionCounts(account)
        .then((counts) => {
          if (!active) return;
          const publishedCount = isCombinedQueue
            ? readPublishedPendingQueueCount(account.role)
            : null;
          setActionCounts({
            ...counts,
            ALL_PENDING: publishedCount ?? counts.ALL_PENDING,
          });
        })
        .catch(() => {
          if (!active) return;
          const publishedCount = isCombinedQueue
            ? readPublishedPendingQueueCount(account.role)
            : null;
          setActionCounts((current) =>
            publishedCount === null
              ? createEmptySidebarActionCounts()
              : { ...current, ALL_PENDING: publishedCount },
          );
        });
    };
    const syncPendingCount = (event: Event) => {
      const detail = (event as CustomEvent<{ role: BetaRole; count: number }>)
        .detail;
      if (!detail || detail.role !== account.role) return;
      setActionCounts((current) => ({
        ...current,
        ALL_PENDING: detail.count,
      }));
    };
    refreshCounts();
    const refreshTimer = window.setInterval(refreshCounts, 15_000);
    window.addEventListener("focus", refreshCounts);
    window.addEventListener("estuary:action-counts-changed", refreshCounts);
    window.addEventListener(PENDING_QUEUE_COUNT_EVENT, syncPendingCount);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshCounts);
      window.removeEventListener(
        "estuary:action-counts-changed",
        refreshCounts,
      );
      window.removeEventListener(PENDING_QUEUE_COUNT_EVENT, syncPendingCount);
    };
  }, [account, currentUrl, pathname, projectManager]);

  function itemActionCount(item: NavigationItem): number {
    if (item.actionType) return actionCounts[item.actionType];
    return (
      item.children?.reduce(
        (total, child) => total + itemActionCount(child),
        0,
      ) ?? 0
    );
  }

  function itemLabel(item: NavigationItem) {
    const count = itemActionCount(item);
    return (
      <span className={countStyles.itemContent}>
        <span className={countStyles.label}>{item.label}</span>
        {count > 0 && (
          <span
            className={countStyles.count}
            aria-label={`${count} actions required`}
          >
            {count}
          </span>
        )}
      </span>
    );
  }

  function renderItem(item: NavigationItem, depth = 0, parent = ""): ReactNode {
    const key = parent ? `${parent}/${item.label}` : item.label;
    if (item.children?.length) {
      const isOpen = Boolean(expanded[key] ?? expanded[item.label]);
      return (
        <div className={styles.navigationBranch} key={key}>
          <button
            className={`${styles.navigationBranchButton} ${isOpen ? styles.navigationBranchButtonExpanded : ""} ${depth ? styles.nestedNavigationItem : ""}`}
            data-label={item.label}
            type="button"
            aria-expanded={isOpen}
            onClick={() =>
              setExpanded((current) => ({ ...current, [key]: !isOpen }))
            }
          >
            {itemLabel(item)}
            <span className={styles.navigationChevron} aria-hidden="true">
              {isOpen ? "⌃" : "⌄"}
            </span>
          </button>
          <div
            className={styles.nestedNavigationItems}
            data-depth={depth + 1}
            hidden={!isOpen}
          >
            {item.children.map((child) => renderItem(child, depth + 1, key))}
          </div>
        </div>
      );
    }

    return (
      <Link
        aria-current={item.href === activeHref ? "page" : undefined}
        className={`${item.href === activeHref ? styles.activeNavigationItem : styles.navigationItem} ${depth ? styles.nestedNavigationItem : ""}`}
        data-label={item.label}
        href={item.href ?? "/beta/dashboard"}
        key={key}
      >
        {itemLabel(item)}
      </Link>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarIdentity}>
        <Link
          className={styles.brand}
          href={
            adminWorkspace ? "/beta/administration/overview" : "/beta/dashboard"
          }
        >
          <Image
            alt=""
            aria-hidden="true"
            height={28}
            src="/assets/icons/estuary-icon-white.png"
            width={28}
          />
          <span>Estuary</span>
        </Link>
        <p className={styles.roleLabel}>
          {projectManager && account.role === "staff"
            ? "Staff · Project Manager"
            : roleLabels[account.role]}
        </p>
        {account.role === "director" && account.isAdministrator && (
          <div className={styles.workspaceSwitcher}>
            <button
              aria-expanded={workspaceMenuOpen}
              onClick={() => setWorkspaceMenuOpen((open) => !open)}
              type="button"
            >
              <span>{adminWorkspace ? "ADM" : "DIR"}</span>
              <div>
                <small>Workspace</small>
                <strong>{adminWorkspace ? "Admin" : "Director"}</strong>
              </div>
              <i aria-hidden="true">⇅</i>
            </button>
            {workspaceMenuOpen && (
              <div className={styles.workspaceMenu}>
                <p>Switch workspace</p>
                <Link
                  href="/beta/dashboard"
                  onClick={() => setWorkspaceMenuOpen(false)}
                >
                  <b>DIR</b>
                  <span>
                    <strong>Director workspace</strong>
                    <small>Approvals, team records and your own requests</small>
                  </span>
                  {!adminWorkspace && <i>✓</i>}
                </Link>
                <Link
                  href="/beta/administration/overview"
                  onClick={() => setWorkspaceMenuOpen(false)}
                >
                  <b>ADM</b>
                  <span>
                    <strong>Admin workspace</strong>
                    <small>
                      Programmes, accounting codes, employees and entitlements
                    </small>
                  </span>
                  {adminWorkspace && <i>✓</i>}
                </Link>
                <small>
                  Only accounts with admin access see this workspace.
                </small>
              </div>
            )}
          </div>
        )}
      </div>
      <nav
        aria-label={`${roleLabels[account.role]} navigation`}
        className={styles.roleNavigation}
      >
        {groups.map((group, index) => (
          <section
            className={
              group.label ? styles.navigationGroupCard : styles.navigationGroup
            }
            key={`${group.label ?? "main"}-${index}`}
          >
            {group.label && (
              <p className={styles.navigationGroupLabel}>{group.label}</p>
            )}
            <div className={styles.navigationItems}>
              {group.items.map((item) => renderItem(item))}
            </div>
          </section>
        ))}
      </nav>
      <div className={styles.sidebarProfile}>
        <span>
          {account.name
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </span>
        <div>
          <strong>{account.name}</strong>
          <small>
            {adminWorkspace
              ? `${account.position} · Admin access`
              : account.position}
          </small>
        </div>
        <i aria-hidden="true">‹</i>
      </div>
    </aside>
  );
}

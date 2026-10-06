'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import type { BetaAccount, BetaRole } from '@/lib/auth/beta-accounts';
import {
  createEmptySidebarActionCounts,
  fetchSidebarActionCounts,
  type SidebarPaymentType,
} from './sidebar-action-counts';
import styles from './beta.module.css';
import countStyles from './role-sidebar-counts.module.css';

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
  staff: 'Programme Staff',
  manager: 'Operations Manager',
  director: 'Director',
  finance: 'Finance Admin',
};

const standardRequests: NavigationItem[] = [
  { label: 'Invoice Payment', href: '/beta/payment-requests/invoice-payment/new' },
  { label: 'Travel Allowance', href: '/beta/payment-requests/travel-allowance/new' },
  { label: 'Cash Advance', href: '/beta/payment-requests/cash-advance/new' },
];

function paymentRequest(includePettyCash = false): NavigationItem {
  return {
    label: 'Payment Request',
    children: [
      ...standardRequests,
      { label: 'Claims', href: '/beta/payment-requests/claims/new' },
      ...(includePettyCash
        ? [{ label: 'Petty Cash', href: '/beta/payment-requests/petty-cash/new' }]
        : []),
    ],
  };
}

function pendingApprovalItems(role: 'project-manager' | 'director'): NavigationItem[] {
  return [
    ...(role === 'project-manager'
      ? [{ label: 'Payment Voucher Preview', href: '/beta/project-manager/payment-vouchers', actionType: 'PAYMENT_VOUCHER' as const }]
      : [{ label: 'Payment Voucher', href: '/beta/approvals', actionType: 'PAYMENT_VOUCHER' as const }]),
    ...(role === 'project-manager'
      ? [{ label: 'Petty Cash', href: '/beta/project-manager/payment-requests/petty-cash', actionType: 'PETTY_CASH' as const }]
      : [{ label: 'Petty Cash', href: '/beta/director/payment-requests/petty-cash', actionType: 'PETTY_CASH' as const }]),
    { label: 'Invoice Payment', href: `/beta/${role}/payment-requests/invoice-payments`, actionType: 'INVOICE_PAYMENT' as const },
    { label: 'Travel Allowance', href: `/beta/${role}/payment-requests/travel-allowances`, actionType: 'TRAVEL_ALLOWANCE' as const },
    { label: 'Cash Advance', href: `/beta/${role}/payment-requests/cash-advance`, actionType: 'CASH_ADVANCE' as const },
    { label: 'Claims', href: role === 'project-manager' ? '/beta/project-manager/payment-requests/claims' : '/beta/director/payment-requests/claims', actionType: 'EXPENSE_CLAIM' as const },
  ];
}

const financeProcessing: NavigationItem[] = [
  { label: 'Payment Voucher', href: '/beta/finance', actionType: 'PAYMENT_VOUCHER' },
  { label: 'Petty Cash', href: '/beta/finance/payment-requests/petty-cash', actionType: 'PETTY_CASH' },
  { label: 'Invoice Payment', href: '/beta/finance/payment-requests/invoice-payments', actionType: 'INVOICE_PAYMENT' },
  { label: 'Travel Allowance', href: '/beta/finance/payment-requests/travel-allowances', actionType: 'TRAVEL_ALLOWANCE' },
  { label: 'Cash Advance', href: '/beta/finance/payment-requests/cash-advance', actionType: 'CASH_ADVANCE' },
  { label: 'Claims', href: '/beta/finance/payment-requests/claims', actionType: 'EXPENSE_CLAIM' },
];

const pettyCash: NavigationItem = {
  label: 'Petty Cash',
  children: [
    { label: 'Overview', href: '/beta/petty-cash' },
  ],
};

const roleNavigation: Record<BetaRole, NavigationGroup[]> = {
  staff: [
    { items: [{ label: 'Dashboard', href: '/beta/dashboard' }] },
    {
      label: 'Create payments',
      items: [
        { label: 'Payment Voucher', href: '/beta/payment-vouchers/new' },
        paymentRequest(true),
      ],
    },
    {
      label: 'Records',
      items: [{ label: 'My Requests', href: '/beta/payment-records?scope=mine', actionType: 'MY_REQUESTS' }],
    },
  ],
  manager: [
    { items: [{ label: 'Dashboard', href: '/beta/dashboard' }] },
    {
      label: 'Create payments',
      items: [
        { label: 'Payment Voucher', href: '/beta/payment-vouchers/new' },
        paymentRequest(true),
      ],
    },
    {
      label: 'Approvals',
      items: [{ label: 'Pending Approvals', children: pendingApprovalItems('project-manager') }],
    },
    {
      label: 'Records',
      items: [
        { label: 'Payment Records', href: '/beta/payment-records' },
        { label: 'My Requests', href: '/beta/payment-records?scope=mine', actionType: 'MY_REQUESTS' },
      ],
    },
  ],
  director: [
    { items: [{ label: 'Dashboard', href: '/beta/dashboard' }] },
    {
      label: 'Create payments',
      items: [paymentRequest(true)],
    },
    {
      label: 'Approvals',
      items: [{ label: 'Pending Approvals', children: pendingApprovalItems('director') }],
    },
    { label: 'Petty cash', items: [pettyCash] },
    {
      label: 'Records',
      items: [
        { label: 'Payment Records', href: '/beta/payment-records' },
        { label: 'My Requests', href: '/beta/payment-records?scope=mine', actionType: 'MY_REQUESTS' },
      ],
    },
  ],
  finance: [
    { items: [{ label: 'Dashboard', href: '/beta/dashboard' }] },
    {
      label: 'Create payments',
      items: [
        { label: 'Payment Voucher', href: '/beta/payment-vouchers/new' },
        paymentRequest(true),
      ],
    },
    {
      label: 'Payment processing',
      items: [{ label: 'Pending Processing', children: financeProcessing }],
    },
    { label: 'Petty cash', items: [pettyCash] },
    {
      label: 'Records',
      items: [
        { label: 'Payment Records', href: '/beta/payment-records' },
        { label: 'My Requests', href: '/beta/payment-records?scope=mine', actionType: 'MY_REQUESTS' },
      ],
    },
  ],
};

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
  const groups = roleNavigation[account.role];
  const hrefs = groups.flatMap((group) => collectHrefs(group.items));
  const activeHref = hrefs
    .filter((href) => href.includes('?')
      ? currentUrl === href
      : currentQuery.length === 0 && (pathname === href || pathname.startsWith(`${href}/`)))
    .sort((left, right) => right.length - left.length)[0];

  const initiallyExpanded = Object.fromEntries(
    groups.flatMap((group) => group.items)
      .filter((item) => item.children?.some((child) => {
        const nested = collectHrefs([child]);
        return nested.some((href) => href === activeHref);
      }))
      .map((item) => [item.label, true]),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>(initiallyExpanded);
  const [actionCounts, setActionCounts] = useState(createEmptySidebarActionCounts);

  useEffect(() => {
    let active = true;
    fetchSidebarActionCounts(account).then((counts) => {
      if (active) setActionCounts(counts);
    }).catch(() => {
      if (active) setActionCounts(createEmptySidebarActionCounts());
    });
    return () => { active = false; };
  }, [account]);

  function itemActionCount(item: NavigationItem): number {
    if (item.actionType) return actionCounts[item.actionType];
    return item.children?.reduce((total, child) => total + itemActionCount(child), 0) ?? 0;
  }

  function itemLabel(item: NavigationItem) {
    const count = itemActionCount(item);
    return <span className={countStyles.itemContent}>
      <span className={countStyles.label}>{item.label}</span>
      {count > 0 && <span className={countStyles.count} aria-label={`${count} actions required`}>{count}</span>}
    </span>;
  }

  function renderItem(item: NavigationItem, depth = 0, parent = ''): ReactNode {
    const key = parent ? `${parent}/${item.label}` : item.label;
    if (item.children?.length) {
      const isOpen = Boolean(expanded[key] ?? expanded[item.label]);
      return <div className={styles.navigationBranch} key={key}>
        <button className={`${styles.navigationBranchButton} ${isOpen ? styles.navigationBranchButtonExpanded : ''} ${depth ? styles.nestedNavigationItem : ''}`} type="button" aria-expanded={isOpen} onClick={() => setExpanded((current) => ({ ...current, [key]: !isOpen }))}>
          {itemLabel(item)}<span className={countStyles.branchEnd}><span aria-hidden="true" className={`${styles.navigationChevron} ${isOpen ? styles.navigationChevronExpanded : ''}`}>⌄</span></span>
        </button>
        <div className={styles.nestedNavigationItems} data-depth={depth + 1} hidden={!isOpen}>
          {item.children.map((child) => renderItem(child, depth + 1, key))}
        </div>
      </div>;
    }

    return <Link className={`${item.href === activeHref ? styles.activeNavigationItem : styles.navigationItem} ${depth ? styles.nestedNavigationItem : ''}`} href={item.href ?? '/beta/dashboard'} key={key}>{itemLabel(item)}</Link>;
  }

  return <aside className={styles.sidebar}>
    <div className={styles.sidebarIdentity}>
      <Link className={styles.brand} href="/beta/dashboard">Estuary</Link>
      <p className={styles.roleLabel}>{roleLabels[account.role]}</p>
    </div>
    <nav aria-label={`${roleLabels[account.role]} navigation`} className={styles.roleNavigation}>
      {groups.map((group, index) => <section className={group.label ? styles.navigationGroupCard : styles.navigationGroup} key={`${group.label ?? 'main'}-${index}`}>
        {group.label && <p className={styles.navigationGroupLabel}>{group.label}</p>}
        <div className={styles.navigationItems}>{group.items.map((item) => renderItem(item))}</div>
      </section>)}
    </nav>
  </aside>;
}

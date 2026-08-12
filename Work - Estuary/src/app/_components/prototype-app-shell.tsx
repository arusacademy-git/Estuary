'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from 'react';

import type { DummyUser } from '@/domain/prototype/types';

import styles from './prototype-app-shell.module.css';

type ShellContextValue = {
  currentUser: DummyUser;
  users: DummyUser[];
  hrefWithUser: (href: string) => string;
};

const ShellContext = createContext<ShellContextValue | null>(null);

const navItems = [
  { href: '/dashboard', label: 'Dashboard', short: '01' },
  { href: '/payment-requests', label: 'Payment Requests', short: '02' },
  { href: '/payment-vouchers/new', label: 'New Voucher', short: '03' },
  { href: '/approvals', label: 'Approvals', short: '04' },
  { href: '/finance', label: 'Finance', short: '05' },
  { href: '/settings', label: 'Settings', short: '06' },
];

type PrototypeAppShellProps = {
  brand: string;
  status: string;
  users: DummyUser[];
  children: React.ReactNode;
};

export function PrototypeAppShell({
  brand,
  status,
  users,
  children,
}: PrototypeAppShellProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const userId = searchParams.get('user') ?? users[0]?.id;
  const currentUser =
    users.find((user) => user.id === userId) ?? users[0];

  const hrefWithUser = useCallback((href: string): string => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('user', currentUser.id);
    return `${href}?${params.toString()}`;
  }, [currentUser.id, searchParams]);
  const activeNavItem =
    navItems.find((item) => pathname.startsWith(item.href)) ?? navItems[0];

  const contextValue = useMemo(
    () => ({ currentUser, users, hrefWithUser }),
    [currentUser, users, hrefWithUser]
  );

  function switchUser(nextUserId: string): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set('user', nextUserId);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <ShellContext.Provider value={contextValue}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.brandCluster}>
            <div className={styles.brandBlock}>
              <span className={styles.brand}>{brand}</span>
              <span className={styles.status}>{status}</span>
            </div>
            <div className={styles.brandNote}>
              Editable workflow policy, route-level navigation, and one live
              voucher builder.
            </div>
          </div>

          <nav className={styles.nav}>
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  className={`${styles.navLink} ${
                    isActive ? styles.navLinkActive : ''
                  }`}
                  href={hrefWithUser(item.href)}
                >
                  <span className={styles.navIndex}>{item.short}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className={styles.sidebarFooter}>
            <span className={styles.footerLabel}>Prototype Mode</span>
            <div className={styles.footerList}>
              <span>Dummy sign-in stays local.</span>
              <span>Route structure is now stable.</span>
              <span>Real auth can replace the operator switch later.</span>
            </div>
          </div>
        </aside>

        <div className={styles.mainArea}>
          <header className={styles.topbar}>
            <div className={styles.topbarTitleBlock}>
              <span className={styles.topbarLabel}>{activeNavItem.label}</span>
              <strong className={styles.topbarTitle}>{currentUser.name}</strong>
              <p className={styles.topbarMeta}>
                {currentUser.title} - {currentUser.roles.join(' + ')}
              </p>
            </div>

            <div className={styles.topbarControls}>
              <div className={styles.routeBadge}>{activeNavItem.short}</div>
              <label className={styles.userSwitch}>
                <span>Browse as</span>
                <select
                  disabled={isPending}
                  value={currentUser.id}
                  onChange={(event) => switchUser(event.target.value)}
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </header>

          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}

export function usePrototypeShell(): ShellContextValue {
  const value = useContext(ShellContext);

  if (!value) {
    throw new Error('usePrototypeShell must be used within PrototypeAppShell');
  }

  return value;
}

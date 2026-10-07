'use client';

import {
  useEffect,
} from 'react';

import type { ReactNode } from 'react';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import RoleSidebar from './role-sidebar';
import { BetaHeaderIcons } from './beta-header-icons';

import {
  BETA_SESSION_KEY,
  readBetaSession,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';

import styles from './beta.module.css';

export default function BetaShell({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPage =
    pathname === '/beta' ||
    pathname.startsWith('/beta/recipient/');
  const account: BetaAccount | null = readBetaSession();

  useEffect(() => {
    if (!isPublicPage && !account) {
      router.replace('/beta');
    }
  }, [account, isPublicPage, router]);

  function handleSignOut() {
    window.localStorage.removeItem(
      BETA_SESSION_KEY,
    );

    router.push('/beta');
  }

  if (isPublicPage) {
    return children;
  }

  if (!account) {
    return (
      <main className={styles.sessionLoading}>
        Loading your Estuary workspace…
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <RoleSidebar account={account} />

      <main className={styles.main}>
        <header className={styles.header}>
          <strong className={styles.headerBrand}>
            Estuary Beta
          </strong>

          <div className={styles.headerAccount}>
            <BetaHeaderIcons accountId={account.id} />

            <div className={styles.headerIdentity}>
              <span>{account.name}</span>
              <small>{account.position}</small>
            </div>

            <button
              className={styles.signOutButton}
              type="button"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

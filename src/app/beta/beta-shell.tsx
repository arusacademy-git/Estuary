'use client';

import {
  useEffect,
  useSyncExternalStore,
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
  betaAccounts,
  type BetaAccount,
} from '@/lib/auth/beta-accounts';

import styles from './beta.module.css';

const BETA_SESSION_EVENT = 'estuary-beta-session-change';

function subscribeToBetaSession(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === BETA_SESSION_KEY) onStoreChange();
  }

  window.addEventListener('storage', handleStorage);
  window.addEventListener(BETA_SESSION_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(BETA_SESSION_EVENT, onStoreChange);
  };
}

function getBetaSessionId(): string | null | undefined {
  return window.localStorage.getItem(BETA_SESSION_KEY);
}

function getServerBetaSessionId(): undefined {
  return undefined;
}

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
  const accountId = useSyncExternalStore(
    subscribeToBetaSession,
    getBetaSessionId,
    getServerBetaSessionId,
  );
  const account: BetaAccount | null =
    betaAccounts.find((candidate) => candidate.id === accountId) ?? null;
  const isSessionHydrated = accountId !== undefined;

  useEffect(() => {
    if (isSessionHydrated && !isPublicPage && !account) {
      router.replace('/beta');
    }
  }, [account, isPublicPage, isSessionHydrated, router]);

  function handleSignOut() {
    window.localStorage.removeItem(
      BETA_SESSION_KEY,
    );
    window.dispatchEvent(new Event(BETA_SESSION_EVENT));

    router.push('/beta');
  }

  if (isPublicPage) {
    return children;
  }

  if (!isSessionHydrated || !account) {
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

'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import {
  BETA_SESSION_KEY,
  betaAccounts,
} from '@/lib/auth/beta-accounts';

import styles from './login-page.module.css';

export default function BetaLoginPage() {
  const router = useRouter();

  const [selectedAccountId, setSelectedAccountId] = useState(
    betaAccounts[0]?.id ?? '',
  );

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedAccount = betaAccounts.find(
      (account) => account.id === selectedAccountId,
    );

    if (!selectedAccount) {
      return;
    }

    window.localStorage.setItem(
      BETA_SESSION_KEY,
      selectedAccount.id,
    );

    router.push('/beta/dashboard');
  }

  function openRecipientPortal() {
    router.push('/beta/recipient/demo-token');
  }

  return (
    <main className={styles.page}>
      <section className={styles.introduction}>
        <div className={styles.introductionContent}>
          <p className={styles.brand}>Estuary</p>

          <p className={styles.tagline}>
            Payment management, simplified
          </p>

          <h1>One place for every payment workflow.</h1>

          <p className={styles.description}>
            Manage requests, approvals, documents, and payment records in one organised workspace.
          </p>
        </div>
      </section>

      <section className={styles.loginArea}>
        <div className={styles.loginCard}>
          <p className={styles.accessLabel}>Beta Version access</p>

          <h2>Welcome to Estuary</h2>

          <p className={styles.loginDescription}>
            Choose a demo account, then continue using the simulated Google
            sign-in.
          </p>

          <form onSubmit={handleLogin}>
            <label className={styles.field}>
              <span>Demo account</span>

              <select
                value={selectedAccountId}
                onChange={(event) =>
                  setSelectedAccountId(event.target.value)
                }
              >
                {betaAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} — {account.position}
                  </option>
                ))}
              </select>
            </label>

            <button className={styles.googleButton} type="submit">
              <span className={styles.googleIcon}>G</span>
              Continue with Google — Demo
            </button>
          </form>

          <aside className={styles.notice}>
            <strong>Beta Version only:</strong> Google authentication is currently
            simulated. The production version can use Google Workspace OAuth
            and load permissions from the authenticated Estuary account.
          </aside>
        </div>
      </section>
    </main>
  );
}
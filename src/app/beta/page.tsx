"use client";

import Image from "next/image";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { BETA_SESSION_KEY, betaAccounts } from "@/lib/auth/beta-accounts";

import styles from "./login-page.module.css";

export default function BetaLoginPage() {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState(
    betaAccounts[0]?.id ?? "",
  );

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedAccount = betaAccounts.find(
      (account) => account.id === selectedAccountId,
    );
    if (!selectedAccount) return;

    window.localStorage.setItem(BETA_SESSION_KEY, selectedAccount.id);
    router.push("/beta/dashboard");
  }

  return (
    <main className={styles.page}>
      <section className={styles.introduction}>
        <div className={styles.introductionContent}>
          <div className={styles.brandLockup}>
            <div className={styles.brandRow}>
              <Image
                alt=""
                aria-hidden="true"
                height={46}
                priority
                src="/assets/icons/estuary-icon-navy.png"
                width={46}
              />
              <p className={styles.brand}>Estuary</p>
            </div>
            <p className={styles.tagline}>Arus Academy Workspace</p>
          </div>

          <h1>One place for every payment workflow.</h1>

          <p className={styles.description}>
            Manage requests, approvals, documents, and payment records in one
            organised workspace.
          </p>

          <div className={styles.workflow} aria-label="Payment workflow">
            <div className={styles.workflowSteps}>
              <div className={styles.workflowStep}>
                <span>1</span>
                <strong>Request</strong>
              </div>
              <svg
                aria-hidden="true"
                className={styles.workflowWave}
                preserveAspectRatio="none"
                viewBox="0 0 120 36"
              >
                <path d="M0 18 C18 18 18 31 36 31 S54 5 72 5 S90 24 120 18" />
              </svg>
              <div className={styles.workflowStep}>
                <span>2</span>
                <strong>Approve</strong>
              </div>
              <svg
                aria-hidden="true"
                className={styles.workflowWave}
                preserveAspectRatio="none"
                viewBox="0 0 120 36"
              >
                <path d="M0 18 C18 18 18 5 36 5 S54 31 72 31 S90 12 120 18" />
              </svg>
              <div className={`${styles.workflowStep} ${styles.workflowPaid}`}>
                <span>3</span>
                <strong>Pay</strong>
              </div>
            </div>
            <p>
              Like streams meeting at an estuary, every request follows through
              one path, from submission to approval to payment.
            </p>
          </div>
        </div>
        <div className={styles.waveLines} aria-hidden="true">
          <span />
          <span />
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
                onChange={(event) => setSelectedAccountId(event.target.value)}
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
            <strong>Beta Version only:</strong> Google authentication is
            currently simulated. The production version can use Google Workspace
            OAuth and load permissions from the authenticated Estuary account.
          </aside>
        </div>
      </section>
    </main>
  );
}

import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './correction-edit-layout.module.css';

export function CorrectionBackLink({ href, label }: { href: string; label: string }) {
  return <Link className={styles.backLink} href={href}>← Back to {label}</Link>;
}

export function CorrectionEditLayout({ children, remarks, reviewerLabel = 'Reviewer remarks' }: { children: ReactNode; remarks?: string; reviewerLabel?: string }) {
  if (!remarks) return <>{children}</>;

  return (
    <div className={styles.layout}>
      <div className={styles.formColumn}>{children}</div>
      <aside className={styles.remarkCard} role="status">
        <span>Action required</span>
        <h2>This request was returned for correction</h2>
        <small>{reviewerLabel}</small>
        <blockquote>{remarks}</blockquote>
        <p>Update the requested information, then review and resubmit the request.</p>
      </aside>
    </div>
  );
}

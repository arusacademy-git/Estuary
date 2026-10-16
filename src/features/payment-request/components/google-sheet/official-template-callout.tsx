import type { ReactNode } from 'react';

import styles from './official-template-callout.module.css';

type OfficialTemplateCalloutProps = {
  actionLabel: string;
  children?: ReactNode;
  description: string;
  title: string;
  unavailableLabel: string;
  url: string;
};

export function OfficialTemplateCallout({
  actionLabel,
  children,
  description,
  title,
  unavailableLabel,
  url,
}: OfficialTemplateCalloutProps) {
  return (
    <aside className={styles.callout}>
      <div className={styles.copy}>
        <span>Official template</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.actions}>
        {children}
        {url
          ? <a href={url} rel="noreferrer" target="_blank">{actionLabel}</a>
          : <span className={styles.unavailable}>{unavailableLabel}</span>}
      </div>
    </aside>
  );
}

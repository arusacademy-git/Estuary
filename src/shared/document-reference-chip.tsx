import { isWebDocumentReference } from './document-reference';
import styles from './document-reference-chip.module.css';

export function DocumentReferenceChip({ value, href }: { value: string; href?: string }) {
  const candidate = href ?? value;
  const target = candidate.startsWith('/') || isWebDocumentReference(candidate) ? candidate : undefined;
  const content = <><span aria-hidden="true" className={styles.icon}><svg fill="currentColor" viewBox="0 0 24 24"><path d="M6.5 2.5h7l4 4v15h-11a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Zm6 1.8v3.2h3.2l-3.2-3.2ZM8 12h6v-1.5H8V12Zm0 3h8v-1.5H8V15Zm0 3h8v-1.5H8V18Z" /></svg></span><span className={styles.label}>{value}</span></>;

  return target
    ? <a className={styles.chip} href={target} rel="noreferrer" target="_blank" title={value}>{content}</a>
    : <span className={styles.chip} title={value}>{content}</span>;
}

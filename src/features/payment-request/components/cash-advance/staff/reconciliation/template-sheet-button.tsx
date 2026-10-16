import styles from '../../cash-advance.module.css';

export function TemplateSheetButton({ label, url }: { label: string; url: string }) {
  return url
    ? <a className={styles.templateSheetButton} href={url} rel="noreferrer" target="_blank">{label} ↗</a>
    : <button className={styles.templateSheetButton} disabled title="Add the template URL to the environment configuration." type="button">{label} ↗</button>;
}

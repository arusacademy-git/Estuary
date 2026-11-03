import styles from "./manual-draft-status.module.css";

export function ManualDraftStatus({ message }: { message?: string }) {
  if (!message) return null;
  const saved = message.startsWith("Draft saved");
  return (
    <span className={styles.pill} data-saved={saved} role="status">
      <i aria-hidden="true" />
      {message}
    </span>
  );
}
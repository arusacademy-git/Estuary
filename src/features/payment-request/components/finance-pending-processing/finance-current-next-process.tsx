import styles from "./finance-pending-processing.module.css";

export function FinanceCurrentNextProcess({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <section className={styles.currentUpdate}>
      <span>Current next process</span>
      <strong>{title}</strong>
      <p>{copy}</p>
    </section>
  );
}

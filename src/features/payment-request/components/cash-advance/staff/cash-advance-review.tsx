import Image from 'next/image';
import type { CashAdvanceRequestLine } from '@/domain/payment-requests/cash-advance/types';
import type { UserSignatureRecord } from '@/domain/signatures/types';
import styles from '../cash-advance.module.css';

const money = (value: number) =>
  new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(value);

type Props = {
  requesterName: string;
  requestDate: string;
  projectName: string;
  purpose: string;
  managerName: string;
  directorName: string;
  accountHolderName: string;
  bankName: string;
  bankAccountNumber: string;
  lines: CashAdvanceRequestLine[];
  total: number;
  signature: UserSignatureRecord | null;
  confirmed: boolean;
  saving: boolean;
  error: string;
  amendment: boolean;
  onConfirmedChange: (value: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
};

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function CashAdvanceReview(p: Props) {
  const initials = p.requesterName
    .split(/\s+/)
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className={styles.cashReviewPage}>
      {p.error && <div className={styles.error}>{p.error}</div>}

      <section className={styles.cashReviewCard}>
        <div className={styles.cashReviewMain}>
          <header className={styles.cashReviewTitle}>
            <p>
              <span>CA</span>Cash Advance Request
            </p>
            <h1>Review and sign your request</h1>
            <small>
              Confirm the entries before forwarding the request to the Manager.
            </small>
          </header>

          <section className={styles.cashReviewSection}>
            <h2>Request details</h2>
            <dl className={styles.cashReviewGrid}>
              <div>
                <dt>Requester</dt>
                <dd className={styles.cashReviewPerson}>
                  <i>{initials}</i>
                  {p.requesterName}
                </dd>
              </div>
              <Value label="Request date" value={p.requestDate} />
              <Value label="Project" value={p.projectName} />
              <Value label="Purpose" value={p.purpose} />
            </dl>
          </section>

          <section className={styles.cashReviewSection}>
            <h2>Approval</h2>
            <dl className={styles.cashReviewGrid}>
              <Value label="Manager" value={p.managerName} />
              <Value label="Director" value={p.directorName} />
            </dl>
          </section>

          <section className={styles.cashReviewSection}>
            <h2>Payment account</h2>
            <small>Requester bank account receiving the Cash Advance</small>
            <dl className={styles.cashReviewAccount}>
              <Value label="Account holder" value={p.accountHolderName} />
              <Value label="Bank" value={p.bankName} />
              <Value label="Account number" value={p.bankAccountNumber} />
            </dl>
          </section>

          <section className={styles.cashReviewSection}>
            <h2>
              Expense entries{' '}
              <small>
                {p.lines.length} {p.lines.length === 1 ? 'entry' : 'entries'}
              </small>
            </h2>
            <div className={styles.tableShell}>
              <table className={styles.lineTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Purpose</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {p.lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
                      <td>{line.description}</td>
                      <td>{line.purpose}</td>
                      <td className={styles.amount}>{money(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.cashReviewTotal}>
              <span>Total amount requested</span>
              <strong>{money(p.total)}</strong>
            </div>
          </section>
        </div>

        <aside className={styles.cashReviewAside}>
          <div>
            <small>Total amount requested</small>
            <strong>{money(p.total)}</strong>
            <p>
              {p.lines.length} expense{' '}
              {p.lines.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>

          <section>
            <h2>Requester declaration</h2>
            <small>Your saved signature will be attached to this submission.</small>
            {p.signature ? (
              <div className={styles.cashReviewSignature}>
                <div>
                  <span>Active signature</span>
                  <strong>{p.signature.fileName}</strong>
                </div>
                <Image
                  alt={`${p.requesterName} signature`}
                  height={70}
                  src={p.signature.imageUrl}
                  unoptimized
                  width={170}
                />
              </div>
            ) : (
              <div className={styles.error}>
                No active signature found.{' '}
                <a href="/beta/settings/signature">Upload it in Settings</a>.
              </div>
            )}
            <label className={styles.cashReviewConfirm}>
              <input
                checked={p.confirmed}
                onChange={(e) => p.onConfirmedChange(e.target.checked)}
                type="checkbox"
              />
              <span>
                I confirm this request is for approved work-related expenses and
                all information is accurate.
              </span>
            </label>
          </section>

          <div className={styles.cashReviewActions}>
            <button
              className={styles.primary}
              disabled={p.saving || !p.signature || !p.confirmed}
              onClick={p.onSubmit}
              type="button"
            >
              {p.saving
                ? 'Submitting…'
                : p.amendment
                  ? 'Sign and resubmit'
                  : 'Sign and submit to Manager →'}
            </button>
            <button className={styles.secondary} onClick={p.onBack} type="button">
              Back to edit
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
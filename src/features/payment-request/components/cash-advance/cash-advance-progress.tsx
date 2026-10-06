import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';
import { betaAccounts } from '@/lib/auth/beta-accounts';
import styles from './cash-advance.module.css';

const labels = [
  'Request Submitted',
  'Manager Review',
  'Director Review',
  'Finance Payment',
  'Reconciliation',
  'Completed',
] as const;

type ProgressState = 'done' | 'active' | 'returned' | '';

function accountName(id?: string) {
  if (!id) return undefined;
  return betaAccounts.find((account) => account.id === id)?.name ?? id;
}

function formatDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(parsed);
}

function currentIndex(record: CashAdvanceRecord) {
  if (record.status === 'PENDING_MANAGER_APPROVAL') return 1;
  if (record.status === 'PENDING_DIRECTOR_APPROVAL') return 2;
  if (record.status === 'PENDING_FINANCE_PROCESSING') return 3;
  if (record.status === 'PENDING_RECONCILIATION' || record.status === 'PENDING_FINANCE_RECONCILIATION') return 4;
  if (record.status === 'COMPLETED') return 5;
  if (record.returnedStage === 'RECONCILIATION') return 4;
  if (record.directorApprovedAt) return 3;
  if (record.managerApprovedAt) return 2;
  return 1;
}

function actorDate(actor: string | undefined, value?: string) {
  const formatted = formatDate(value);
  return actor && formatted ? `${actor} on ${formatted}` : actor ?? formatted;
}

function stepDetail(record: CashAdvanceRecord, index: number, state: ProgressState) {
  if (state === 'returned') {
    const returnedBy = actorDate(accountName(record.returnedById), record.returnedAt) ?? 'An approver';
    const correction = record.returnedStage === 'RECONCILIATION' ? 'reconciliation' : 'request';
    return `${returnedBy} returned the ${correction}. The original requester must correct and resubmit it.`;
  }

  if (index === 0) {
    return `Signed by ${actorDate(record.requesterName, record.staffSignedAt ?? record.createdAt)} and sent to the assigned Manager.`;
  }

  if (index === 1) {
    const manager = accountName(record.managerApproverId) ?? 'the assigned Manager';
    if (state === 'done') return `Approved by ${actorDate(manager, record.managerApprovedAt)} and forwarded to the Director.`;
    if (state === 'active') return `Waiting for ${manager} to review, sign, or return the request.`;
    return 'Starts after the Staff request is submitted.';
  }

  if (index === 2) {
    const director = accountName(record.directorApproverId) ?? 'the assigned Director';
    if (state === 'done') return `Approved by ${actorDate(director, record.directorApprovedAt)} and forwarded to Finance.`;
    if (state === 'active') return `Waiting for ${director} to review, sign, or return the request.`;
    return 'Starts after Manager approval.';
  }

  if (index === 3) {
    if (state === 'done') return `Payment recorded by ${actorDate(accountName(record.financePaidById) ?? 'Finance', record.financePaidAt)}. Staff can now reconcile the spending.`;
    if (state === 'active') return 'Finance will record the payment or return the request for correction.';
    return 'Starts after Director approval.';
  }

  if (index === 4) {
    if (record.reconciliation?.submittedAt && state === 'done') return `Submitted by ${actorDate(record.requesterName, record.reconciliation.submittedAt)} and verified by Finance.`;
    if (record.reconciliation?.submittedAt) return `Submitted by ${actorDate(record.requesterName, record.reconciliation.submittedAt)}. Waiting for Finance verification.`;
    if (state === 'active') return 'The original requester must record actual expenses and provide balance-return proof when required.';
    return 'Starts after Finance records the Cash Advance payment.';
  }

  if (state === 'done') return `Closed by ${actorDate(accountName(record.completedById) ?? 'Finance', record.completedAt)}. No further action is required.`;
  if (state === 'active') return 'Finance will complete the record after verifying the reconciliation.';
  return 'Completes after Finance verifies the reconciliation.';
}

export function CashAdvanceProgress({ record }: { record: CashAdvanceRecord }) {
  const activeIndex = currentIndex(record);
  const returned = record.status === 'RETURNED_TO_STAFF';
  const completed = record.status === 'COMPLETED';

  return (
    <section className={styles.sideCard}>
      <div className={styles.progressHeader}>
        <strong>Payment progress</strong>
        <span>Step {activeIndex + 1} of {labels.length}</span>
      </div>
      <ol className={styles.progress}>
        {labels.map((label, index) => {
          const state: ProgressState = completed
            ? 'done'
            : returned && index === activeIndex
              ? 'returned'
              : index < activeIndex
                ? 'done'
                : index === activeIndex
                  ? 'active'
                  : '';
          return (
            <li className={state ? styles[state] : undefined} key={label}>
              <span className={styles.dot}>{state === 'done' ? '✓' : state === 'returned' ? '×' : ''}</span>
              <span className={styles.stepCopy}>
                <strong>{label}</strong>
                <small>{stepDetail(record, index, state)}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

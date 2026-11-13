'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import {
  approvePettyCashByManager,
  fetchPettyCashRequest,
} from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { notifyPettyCashManagerApproved } from '@/features/payment-request/notifications/petty-cash-notifications';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { isProjectManagerAccount } from '@/features/administration/admin-settings';

import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

function money(value: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(value);
}

function date(value?: string) {
  if (!value) return '—';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-MY', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsed);
}

function location(record: PettyCashRecord) {
  return record.location === 'PENANG' ? 'Penang' : 'Kuala Lumpur';
}

interface PettyCashManagerReviewProps {
  requestId: string;
}

export function PettyCashManagerReview({ requestId }: PettyCashManagerReviewProps) {
  const [account, setAccount] = useState<BetaAccount | null>(null);
  const [record, setRecord] = useState<PettyCashRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAccount(readBetaSession());
    fetchPettyCashRequest(requestId)
      .then(setRecord)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Request could not be loaded.')
      )
      .finally(() => setChecked(true));
  }, [requestId]);

  async function handleApprove() {
    if (!account || !isProjectManagerAccount(account) || !record) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await approvePettyCashByManager(record.id, account.id);
      notifyPettyCashManagerApproved(updated, account);
      setRecord(updated);
      setSuccess(
        updated.requesterRole === 'staff'
          ? 'Petty Cash approved and forwarded to the Director.'
          : 'Your informational preview was recorded. Finance processing continues independently.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request could not be approved.');
    } finally {
      setSaving(false);
    }
  }

  if (!checked) {
    return <StatePage title="Loading request" copy="Reading the Petty Cash details…" />;
  }
  if (!account || !isProjectManagerAccount(account)) {
    return <StatePage title="Manager access required" copy="You need an active project manager assignment." />;
  }
  if (!record) {
    return <StatePage title="Petty Cash request not found" copy={error || 'The request could not be found.'} />;
  }
  if (record.managerApproverId !== account.id && record.financeReviewerId !== account.id) {
    return <StatePage title="Request assigned to another Manager" copy="You cannot preview this Petty Cash request." />;
  }

  const requiresApproval = record.requesterRole === 'staff';
  const actionable =
    !record.managerApprovedAt &&
    record.status !== 'RETURNED_TO_STAFF' &&
    (!requiresApproval || record.status === 'PENDING_MANAGER_APPROVAL');

  return (
    <main className={styles.managerReviewPage}>
      <div className={styles.managerBackRow}>
        <Link href="/beta/project-manager/payment-requests/petty-cash">
          ← Back to Petty Cash requests
        </Link>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className={styles.managerSuccess} role="status">
          {success}
        </div>
      )}

      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <header className={styles.detailHero}>
            <div>
              <div className={styles.managerReviewEyebrow}>
                <p>
                  {requiresApproval
                    ? 'Manager approval · mandatory'
                    : 'Manager preview · informational'}
                </p>
                <PettyCashStatusBadge status={record.status} />
              </div>
              <h1>{record.requestNumber}</h1>
              <span>
                {record.requesterName} · {location(record)}
              </span>
            </div>
            <div>
              <small>Total requested</small>
              <strong>{money(record.totalAmount)}</strong>
            </div>
          </header>

          <DetailSection title="Request overview">
            <dl className={styles.managerReviewGrid}>
              <Value label="Request date" value={date(record.requestDate)} />
              <Value label="Staff" value={record.requesterName} />
              <Value label="Position" value={record.requesterPosition} />
              <Value label="Contact" value={record.requesterContact} />
              <Value label="Office location" value={location(record)} />
              <Value label="Manager reviewer" value={account.name} />
            </dl>
          </DetailSection>

          <DetailSection title="Expense breakdown">
            <div className={styles.managerReviewTable}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Details / purpose</th>
                    <th>Account category</th>
                    <th>Division</th>
                    <th>Estimated amount</th>
                  </tr>
                </thead>
                <tbody>
                  {record.lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
                      <td>{line.details}</td>
                      <td>{line.accountType}</td>
                      <td>{line.division}</td>
                      <td>
                        <strong>{money(line.amount)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.managerReviewTotal}>
              <span>Total requested</span>
              <strong>{money(record.totalAmount)}</strong>
            </div>
          </DetailSection>

          <DetailSection title="Notes / purpose justification">
            <p className={styles.detailCopy}>
              {record.notes?.trim() || 'No additional notes were provided.'}
            </p>
          </DetailSection>
        </div>

        <div className={styles.detailRail}>
          <aside className={styles.managerDecisionPanel}>
            <p>Manager action</p>
            <h2>
              {actionable
                ? requiresApproval
                  ? 'Approve Petty Cash request'
                  : 'Preview Petty Cash request'
                : requiresApproval
                  ? 'Manager decision recorded'
                  : 'Preview recorded'}
            </h2>
            {actionable ? (
              <>
                <span>
                  {requiresApproval
                    ? 'Review the planned expenses. Approval is required before this request can move to the Director.'
                    : 'Review the planned expenses for visibility. Purchase receipts are provided later during reconciliation.'}
                </span>
                <button
                  className={styles.managerApproveButton}
                  disabled={saving}
                  onClick={handleApprove}
                  type="button"
                >
                  {requiresApproval ? 'Approve and forward' : 'Record Manager preview'}{' '}
                  <b aria-hidden="true">→</b>
                </button>
              </>
            ) : (
              <>
                <span>
                  {requiresApproval
                    ? 'The request has moved to the assigned Director.'
                    : 'Finance processing is independent from this informational preview.'}
                </span>
                {record.managerApprovedAt && <small>Previewed {date(record.managerApprovedAt)}</small>}
              </>
            )}
          </aside>
          <WorkflowProgress record={record} managerName={account.name} />
        </div>
      </div>
    </main>
  );
}

interface WorkflowProgressProps {
  record: PettyCashRecord;
  managerName: string;
}

function WorkflowProgress({ record, managerName }: WorkflowProgressProps) {
  const activeStep = record.status === 'PAID' ? 5 : record.status === 'FINANCE_VERIFIED' ? 5 : 4;
  const steps = [
    {
      title: 'Request Submitted',
      copy: `Submitted by ${record.requesterName}`,
      state: 'complete',
    },
    {
      title: record.requesterRole === 'staff' ? 'Manager Approval' : 'Manager Preview',
      copy: record.managerApprovedAt
        ? `${record.requesterRole === 'staff' ? 'Approved' : 'Previewed'} by ${managerName}`
        : record.requesterRole === 'staff'
          ? 'Mandatory Manager approval'
          : 'Informational preview available',
      state: record.managerApprovedAt
        ? 'complete'
        : record.status === 'PENDING_MANAGER_APPROVAL'
          ? 'active'
          : 'pending',
    },
    {
      title: record.requesterRole === 'staff' ? 'Director Approval' : 'Director Preview',
      copy: record.directorApprovedAt
        ? `${record.requesterRole === 'staff' ? 'Approved' : 'Preview completed'}`
        : record.requesterRole === 'staff'
          ? 'Mandatory Director approval after Manager'
          : 'Informational preview available',
      state: record.directorApprovedAt
        ? 'complete'
        : record.status === 'PENDING_DIRECTOR_APPROVAL'
          ? 'active'
          : 'pending',
    },
    {
      title: 'Finance Processing',
      copy:
        record.status === 'FINANCE_VERIFIED'
          ? 'Payment details verified'
          : 'Finance verification and payment',
      state:
        record.financeVerifiedAt || record.status === 'PAID'
          ? 'complete'
          : record.status === 'RETURNED_TO_STAFF'
            ? 'returned'
            : 'active',
    },
    {
      title: 'Completed',
      copy: 'Payment completed and ledger updated',
      state:
        record.status === 'PAID'
          ? 'complete'
          : record.status === 'FINANCE_VERIFIED'
            ? 'active'
            : 'pending',
    },
  ];

  return (
    <aside className={styles.progressPanel}>
      <header>
        <p>Payment progress</p>
        <span>Step {activeStep} of 5</span>
      </header>
      <ol>
        {steps.map((step) => (
          <li className={styles.progressStep} data-state={step.state} key={step.title}>
            <i aria-hidden="true">{step.state === 'complete' ? '✓' : ''}</i>
            <div>
              <strong>{step.title}</strong>
              <small>
                {step.state === 'active' || step.state === 'returned'
                  ? `Current stage: ${step.copy}`
                  : step.copy}
              </small>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}

interface DetailSectionProps {
  title: string;
  children: ReactNode;
}

function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <section className={styles.detailSection}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

interface ValueProps {
  label: string;
  value: string;
}

function Value({ label, value }: ValueProps) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

interface StatePageProps {
  title: string;
  copy: string;
}

function StatePage({ title, copy }: StatePageProps) {
  return (
    <main className={styles.statePage}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href="/beta/project-manager/payment-requests/petty-cash">
        Back to Petty Cash requests
      </Link>
    </main>
  );
}

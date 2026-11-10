'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { approvePettyCashByDirector, fetchPettyCashRequest } from '@/data/payment-requests/petty-cash/api';
import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';
import { notifyPettyCashDirectorApproved } from '@/features/payment-request/notifications/petty-cash-notifications';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';

import { PettyCashStatusBadge } from '../petty-cash-status-badge';
import styles from '../petty-cash.module.css';

const money = (value: number) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);

const date = (value?: string) =>
  value
    ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('en-MY')
    : '—';

interface PettyCashDirectorReviewProps {
  requestId: string;
}

export function PettyCashDirectorReview({ requestId }: PettyCashDirectorReviewProps) {
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
    if (!account || !record) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await approvePettyCashByDirector(record.id, account.id);
      notifyPettyCashDirectorApproved(updated, account);
      setRecord(updated);
      setSuccess(
        updated.requesterRole === 'staff'
          ? 'Petty Cash approved and forwarded to Finance.'
          : 'Your informational preview was recorded. Finance processing continues independently.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request could not be approved.');
    } finally {
      setSaving(false);
    }
  }

  if (!checked) {
    return <State title="Loading Petty Cash request" copy="Reading the approval details…" />;
  }
  if (!account || account.role !== 'director') {
    return <State title="Director access required" copy="This page is available only to a Director." />;
  }
  if (!record) {
    return <State title="Petty Cash request not found" copy={error || 'The request could not be found.'} />;
  }
  if (record.directorApproverId !== account.id && record.financeReviewerId !== account.id) {
    return <State title="Request assigned to another Director" copy="You cannot preview this Petty Cash request." />;
  }

  const requiresApproval = record.requesterRole === 'staff';
  const canAct =
    !record.directorApprovedAt &&
    record.status !== 'RETURNED_TO_STAFF' &&
    (!requiresApproval || record.status === 'PENDING_DIRECTOR_APPROVAL');

  return (
    <main className={styles.managerReviewPage}>
      <div className={styles.managerBackRow}>
        <Link href="/beta/director/payment-requests/petty-cash">
          ← Back to Petty Cash approvals
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
              <p>{requiresApproval ? 'Director approval · mandatory' : 'Director preview'}</p>
              <h1>{record.requestNumber}</h1>
              <span>
                {record.requesterName} · {date(record.requestDate)}
              </span>
            </div>
            <div>
              <small>Total requested</small>
              <strong>{money(record.totalAmount)}</strong>
              <PettyCashStatusBadge status={record.status} />
            </div>
          </header>

          <section className={styles.detailSection}>
            <h2>Request overview</h2>
            <dl className={styles.managerReviewGrid}>
              <Value label="Requester" value={record.requesterName} />
              <Value label="Position" value={record.requesterPosition} />
              <Value label="Contact" value={record.requesterContact} />
              <Value label="Manager reviewed" value={date(record.managerApprovedAt)} />
            </dl>
          </section>

          <section className={styles.detailSection}>
            <h2>Planned expense breakdown</h2>
            <div className={styles.managerReviewTable}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Purpose</th>
                    <th>Account</th>
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
          </section>
        </div>

        <aside className={styles.detailRail}>
          <div className={styles.managerDecisionPanel}>
            <p>{requiresApproval ? 'Director action' : 'Director preview · informational'}</p>
            <h2>
              {canAct
                ? requiresApproval
                  ? 'Approve Petty Cash request'
                  : 'Preview Petty Cash request'
                : requiresApproval
                  ? 'Director decision recorded'
                  : 'Preview recorded'}
            </h2>
            {canAct ? (
              <>
                <span>
                  {requiresApproval
                    ? 'Review the complete request. Approval is required before Finance can process the payment.'
                    : 'Review the request for visibility. Finance can process it before or after your preview.'}
                </span>
                <button
                  className={styles.managerApproveButton}
                  disabled={saving}
                  onClick={handleApprove}
                  type="button"
                >
                  {requiresApproval ? 'Approve and forward to Finance' : 'Record Director preview'} →
                </button>
              </>
            ) : (
              <span>
                {requiresApproval
                  ? 'The request has moved to Finance processing.'
                  : 'Finance processing is independent from this informational preview.'}
              </span>
            )}
          </div>
        </aside>
      </div>
    </main>
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

interface StateProps {
  title: string;
  copy: string;
}

function State({ title, copy }: StateProps) {
  return (
    <main className={styles.statePage}>
      <h1>{title}</h1>
      <p>{copy}</p>
      <Link href="/beta/director/payment-requests/petty-cash">
        Back to Petty Cash approvals
      </Link>
    </main>
  );
}
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { prototypeTemplateCards } from '@/data/prototype/prototype-app-data';
import type {
  PrototypeDraft,
  PrototypeDraftLineItem,
  PrototypeNotification,
  PrototypeVoucherRecord,
  PrototypeWorkspace,
} from '@/domain/prototype/types';
import {
  calculateLineTotal,
  createLineItem,
  formatMoney,
  summarizeDraftTotals,
  syncLineItem,
} from '@/lib/prototype/voucher-calculations';

import { usePrototypeShell } from './prototype-app-shell';
import styles from './prototype-screens.module.css';

type WorkflowResponse = {
  data?: {
    voucher?: PrototypeVoucherRecord;
    exports?: Array<{ filePath: string }>;
  };
  error?: string;
};

function statusLabel(status: PrototypeVoucherRecord['status']): string {
  return status.replaceAll('_', ' ');
}

function statusClass(status: PrototypeVoucherRecord['status']): string {
  if (status === 'completed') return styles.statusComplete;
  if (status === 'approved_for_payment') return styles.statusFinance;
  if (
    status === 'awaiting_signature' ||
    status === 'awaiting_staff_verification' ||
    status === 'signature_rejected'
  ) {
    return styles.statusAttention;
  }

  return styles.statusReview;
}

function cloneDraft(draft: PrototypeDraft): PrototypeDraft {
  return structuredClone(draft);
}

function createComposerDraft(
  workspace: PrototypeWorkspace,
  currentUserId: string
): PrototypeDraft {
  return {
    ...cloneDraft(workspace.prototypeDraft),
    voucherNumber: 'Assigned on issue',
    currentUserId,
    payeeName: '',
    payeeEmail: '',
    payeeIdentity: '',
    amountInWords: '',
    paymentDetails: '',
    paymentReference: '',
    lineItems: [createLineItem(1, workspace.prototypeDraft.glCode)],
  };
}

function formatDateForInput(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function buildAbsolutePathPreview(value: string): string {
  return value || 'Not available yet';
}

function usePrototypeWorkspaceData() {
  const [workspace, setWorkspace] = useState<PrototypeWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/prototype/workspace', {
        cache: 'no-store',
      });
      const payload = (await response.json()) as { data: PrototypeWorkspace };
      setWorkspace(payload.data);
    } catch {
      setError('Could not load the prototype workspace.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  return {
    workspace,
    isLoading,
    error,
    refreshWorkspace: loadWorkspace,
  };
}

async function runWorkflowAction(
  payload: Record<string, unknown>
): Promise<WorkflowResponse> {
  const response = await fetch('/api/v1/prototype/workflow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return (await response.json()) as WorkflowResponse;
}

function WorkspaceLoadingState(): React.JSX.Element {
  return <div className={styles.emptyState}>Loading workflow data...</div>;
}

function WorkspaceErrorState({ message }: { message: string }): React.JSX.Element {
  return <div className={styles.emptyState}>{message}</div>;
}

export function DashboardScreen(): React.JSX.Element {
  const { currentUser, hrefWithUser } = usePrototypeShell();
  const { workspace, isLoading, error } = usePrototypeWorkspaceData();

  if (isLoading) return <WorkspaceLoadingState />;
  if (!workspace || error) return <WorkspaceErrorState message={error ?? 'Workspace unavailable.'} />;

  const myVouchers = workspace.vouchers.filter(
    (voucher) => voucher.submitterId === currentUser.id
  );
  const pendingApprovals = workspace.vouchers.filter(
    (voucher) =>
      voucher.status === 'pending_director_approval' &&
      (voucher.approverId === currentUser.id || currentUser.roles.includes('DIRECTOR'))
  );
  const financeReady = workspace.vouchers.filter(
    (voucher) => voucher.status === 'approved_for_payment'
  );
  const pendingVerification = workspace.vouchers.filter(
    (voucher) =>
      voucher.status === 'awaiting_staff_verification' &&
      voucher.submitterId === currentUser.id
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Live workflow MVP</span>
          <h1 className={styles.title}>Payment vouchers that actually move.</h1>
          <p className={styles.copy}>
            Issue vouchers, route them for director approval, capture finance payment,
            collect recipient signatures, verify the signed copy, and export the finished
            document into a local folder.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.primaryAction} href={hrefWithUser('/payment-vouchers/new')}>
            Issue payment voucher
          </Link>
          <Link className={styles.secondaryAction} href={hrefWithUser('/finance')}>
            Open finance queue
          </Link>
        </div>
      </section>

      <section className={styles.metricGrid}>
        <div className={styles.metricCard}>
          <span>My issued vouchers</span>
          <strong>{myVouchers.length}</strong>
          <p>Records currently owned by {currentUser.name}.</p>
        </div>
        <div className={styles.metricCard}>
          <span>Need my approval</span>
          <strong>{pendingApprovals.length}</strong>
          <p>Director/approver actions currently available to this operator.</p>
        </div>
        <div className={styles.metricCard}>
          <span>Ready for finance</span>
          <strong>{financeReady.length}</strong>
          <p>Approved vouchers still waiting for payment processing.</p>
        </div>
        <div className={styles.metricCard}>
          <span>Need my verification</span>
          <strong>{pendingVerification.length}</strong>
          <p>Recipient-signed vouchers waiting for submitter confirmation.</p>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent vouchers</h2>
            <span>{workspace.vouchers.length} live records</span>
          </div>
          <div className={styles.list}>
            {workspace.vouchers.slice(0, 6).map((voucher) => (
              <Link
                key={voucher.id}
                className={styles.listRow}
                href={hrefWithUser(`/payment-vouchers/${voucher.id}`)}
              >
                <div>
                  <strong>{voucher.voucherNumber}</strong>
                  <p>{voucher.title}</p>
                </div>
                <div className={styles.rowMeta}>
                  <span className={`${styles.status} ${statusClass(voucher.status)}`}>
                    {statusLabel(voucher.status)}
                  </span>
                  <strong>{voucher.amount}</strong>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Queued emails</h2>
            <span>SMTP intentionally not wired yet</span>
          </div>
          <div className={styles.list}>
            {workspace.notifications.slice(0, 5).map((notification) => (
              <div className={styles.listRow} key={notification.id}>
                <div>
                  <strong>{notification.subject}</strong>
                  <p>{notification.toLabel} · {notification.toEmail}</p>
                </div>
                <div className={styles.rowMeta}>
                  <span className={styles.status}>queued</span>
                  <strong>{notification.createdAt.slice(0, 10)}</strong>
                </div>
              </div>
            ))}
            {workspace.notifications.length === 0 ? (
              <div className={styles.emptyState}>No notifications queued yet.</div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function VoucherComposerScreen(): React.JSX.Element {
  const { currentUser } = usePrototypeShell();
  const { workspace, isLoading, error, refreshWorkspace } = usePrototypeWorkspaceData();
  const [draft, setDraft] = useState<PrototypeDraft | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isIssuingVoucher, setIsIssuingVoucher] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (workspace && !draft) {
      setDraft(createComposerDraft(workspace, currentUser.id));
    }
  }, [workspace, draft, currentUser.id]);

  if (isLoading) return <WorkspaceLoadingState />;
  if (!workspace || !draft || error) {
    return <WorkspaceErrorState message={error ?? 'Composer unavailable.'} />;
  }
  const activeWorkspace = workspace;
  const activeDraft = draft;

  const projectOptions =
    activeWorkspace.referenceCollections.find((collection) => collection.id === 'projects')?.items ?? [];
  const glOptions =
    activeWorkspace.referenceCollections.find((collection) => collection.id === 'gl-codes')?.items ?? [];
  const paymentModeOptions =
    activeWorkspace.referenceCollections.find((collection) => collection.id === 'payment-modes')?.items ?? [];
  const taxCodeOptions =
    activeWorkspace.referenceCollections.find((collection) => collection.id === 'tax-codes')?.items ?? [];
  const approverOptions = activeWorkspace.users.filter(
    (user) => user.roles.includes('DIRECTOR') || user.roles.includes('MANAGER')
  );
  const approver =
    approverOptions.find((user) => user.id === activeDraft.approverId) ?? approverOptions[0];
  const totals = summarizeDraftTotals(activeDraft);

  function updateLineItem(
    lineItemId: string,
    patch: Partial<PrototypeDraftLineItem>
  ): void {
    setDraft((current) =>
      current
        ? {
            ...current,
            lineItems: current.lineItems.map((item) =>
              item.id === lineItemId ? syncLineItem({ ...item, ...patch }) : item
            ),
          }
        : current
    );
  }

  function addLineItem(): void {
    setDraft((current) =>
      current
        ? {
            ...current,
            lineItems: [
              ...current.lineItems,
              createLineItem(current.lineItems.length + 1, current.glCode),
            ],
          }
        : current
    );
  }

  function removeLineItem(lineItemId: string): void {
    setDraft((current) => {
      if (!current || current.lineItems.length === 1) {
        return current;
      }

      return {
        ...current,
        lineItems: current.lineItems.filter((item) => item.id !== lineItemId),
      };
    });
  }

  async function downloadPaymentVoucherPdf(): Promise<void> {
    setIsDownloadingPdf(true);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/v1/prototype/payment-voucher-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(activeDraft),
      });

      if (!response.ok) {
        throw new Error('PDF generation failed.');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${activeDraft.voucherNumber || 'payment-voucher'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      setStatusMessage('Draft PDF downloaded.');
    } catch {
      setStatusMessage('Could not generate the draft PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  async function issuePaymentVoucher(): Promise<void> {
    setIsIssuingVoucher(true);
    setStatusMessage(null);

    try {
      const payload = await runWorkflowAction({
        action: 'issue_voucher',
        actorId: currentUser.id,
        draft: activeDraft,
      });

      if (payload.error || !payload.data?.voucher) {
        throw new Error(payload.error ?? 'Could not issue voucher.');
      }

      await refreshWorkspace();
      setDraft(createComposerDraft(activeWorkspace, currentUser.id));
      setStatusMessage(`Issued ${payload.data.voucher.voucherNumber}.`);
      window.location.href = `/payment-vouchers/${payload.data.voucher.id}?user=${currentUser.id}`;
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Could not issue voucher.'
      );
    } finally {
      setIsIssuingVoucher(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>New voucher</span>
          <h1 className={styles.sectionTitle}>Issue payment voucher</h1>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Voucher draft</h2>
            <span>{currentUser.name}</span>
          </div>
          <div className={styles.sectionStack}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Payee</span>
                <input
                  value={activeDraft.payeeName}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, payeeName: event.target.value } : current
                    )
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Payee email</span>
                <input
                  type='email'
                  value={activeDraft.payeeEmail}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, payeeEmail: event.target.value } : current
                    )
                  }
                />
              </label>
              <label className={styles.field}>
                <span>IC / identity</span>
                <input
                  value={activeDraft.payeeIdentity}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, payeeIdentity: event.target.value } : current
                    )
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Approver</span>
                <select
                  value={activeDraft.approverId}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, approverId: event.target.value } : current
                    )
                  }
                >
                  {approverOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Project</span>
                <select
                  value={activeDraft.projectCode}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, projectCode: event.target.value } : current
                    )
                  }
                >
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.code}>
                      {project.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Payment mode</span>
                <select
                  value={activeDraft.paymentModeCode}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, paymentModeCode: event.target.value } : current
                    )
                  }
                >
                  {paymentModeOptions.map((mode) => (
                    <option key={mode.id} value={mode.code}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Default GL</span>
                <select
                  value={activeDraft.glCode}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, glCode: event.target.value } : current
                    )
                  }
                >
                  {glOptions.map((option) => (
                    <option key={option.id} value={option.code}>
                      {option.code} - {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Bank</span>
                <input
                  value={activeDraft.bankName}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, bankName: event.target.value } : current
                    )
                  }
                />
              </label>
              <label className={styles.field}>
                <span>Account number</span>
                <input
                  value={activeDraft.bankAccountNumber}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, bankAccountNumber: event.target.value }
                        : current
                    )
                  }
                />
              </label>
              <label className={styles.fieldWide}>
                <span>Amount in words</span>
                <input
                  value={activeDraft.amountInWords}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, amountInWords: event.target.value } : current
                    )
                  }
                />
              </label>
              <label className={styles.fieldWide}>
                <span>Voucher summary</span>
                <textarea
                  rows={3}
                  value={activeDraft.paymentDetails}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, paymentDetails: event.target.value } : current
                    )
                  }
                />
              </label>
            </div>

            <div className={styles.lineItemSection}>
              <div className={styles.blockHeader}>
                <div>
                  <h3>Voucher lines</h3>
                  <span>Add as many payment lines as needed.</span>
                </div>
                <button className={styles.ghostButton} type='button' onClick={addLineItem}>
                  Add line
                </button>
              </div>

              <div className={styles.optionRow}>
                <label className={styles.optionPill}>
                  <input
                    checked={activeDraft.amountsTaxInclusive}
                    type='checkbox'
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, amountsTaxInclusive: event.target.checked }
                          : current
                      )
                    }
                  />
                  <span>Amounts are tax inclusive</span>
                </label>
                <label className={styles.optionPill}>
                  <input
                    checked={activeDraft.showDescriptionColumn}
                    type='checkbox'
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, showDescriptionColumn: event.target.checked }
                          : current
                      )
                    }
                  />
                  <span>Show description column</span>
                </label>
                <label className={styles.optionPill}>
                  <input
                    checked={activeDraft.showTaxAmountColumn}
                    type='checkbox'
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, showTaxAmountColumn: event.target.checked }
                          : current
                      )
                    }
                  />
                  <span>Show tax amount column</span>
                </label>
                <label className={styles.optionPill}>
                  <input
                    checked={activeDraft.showFooters}
                    type='checkbox'
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, showFooters: event.target.checked } : current
                      )
                    }
                  />
                  <span>Show totals footer</span>
                </label>
              </div>

              <div className={styles.lineItemTableWrap}>
                <table className={styles.lineItemTable}>
                  <thead>
                    <tr>
                      <th>Account</th>
                      {activeDraft.showDescriptionColumn ? <th>Description</th> : null}
                      <th>Qty</th>
                      <th>Unit price</th>
                      <th>Tax code</th>
                      {activeDraft.showTaxAmountColumn ? <th>Tax amount</th> : null}
                      <th>Total</th>
                      <th aria-label='Actions' />
                    </tr>
                  </thead>
                  <tbody>
                    {activeDraft.lineItems.map((item, index) => (
                      <tr key={item.id}>
                        <td>
                          <select
                            className={styles.lineInput}
                            value={item.accountCode}
                            onChange={(event) =>
                              updateLineItem(item.id, {
                                accountCode: event.target.value,
                              })
                            }
                          >
                            {glOptions.map((option) => (
                              <option key={option.id} value={option.code}>
                                {option.code} - {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        {activeDraft.showDescriptionColumn ? (
                          <td>
                            <input
                              className={styles.lineInput}
                              placeholder={`Line ${index + 1} description`}
                              value={item.description}
                              onChange={(event) =>
                                updateLineItem(item.id, {
                                  description: event.target.value,
                                })
                              }
                            />
                          </td>
                        ) : null}
                        <td>
                          <input
                            className={styles.lineInput}
                            inputMode='decimal'
                            value={item.quantity}
                            onChange={(event) =>
                              updateLineItem(item.id, {
                                quantity: event.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className={styles.lineInput}
                            inputMode='decimal'
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateLineItem(item.id, {
                                unitPrice: event.target.value,
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            className={styles.lineInput}
                            value={item.taxCode}
                            onChange={(event) =>
                              updateLineItem(item.id, {
                                taxCode: event.target.value,
                              })
                            }
                          >
                            {taxCodeOptions.map((option) => (
                              <option key={option.id} value={option.code}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        {activeDraft.showTaxAmountColumn ? (
                          <td>
                            <input
                              className={styles.lineInput}
                              disabled={item.taxCode !== 'MANUAL'}
                              inputMode='decimal'
                              value={item.taxAmount}
                              onChange={(event) =>
                                updateLineItem(item.id, {
                                  taxAmount: event.target.value,
                                })
                              }
                            />
                          </td>
                        ) : null}
                        <td className={styles.lineTotalCell}>
                          {formatMoney(calculateLineTotal(item, activeDraft.amountsTaxInclusive))}
                        </td>
                        <td>
                          <button
                            aria-label={`Remove line ${index + 1}`}
                            className={styles.iconButton}
                            disabled={activeDraft.lineItems.length === 1}
                            type='button'
                            onClick={() => removeLineItem(item.id)}
                          >
                            x
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activeDraft.showFooters ? (
                <div className={styles.totalsPanel}>
                  <div>
                    <span>Lines</span>
                    <strong>{activeDraft.lineItems.length}</strong>
                  </div>
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatMoney(totals.subtotal)}</strong>
                  </div>
                  <div>
                    <span>Tax</span>
                    <strong>{formatMoney(totals.tax)}</strong>
                  </div>
                  <div>
                    <span>Grand total</span>
                    <strong>{formatMoney(totals.grand)}</strong>
                  </div>
                </div>
              ) : null}
            </div>

            <label className={styles.toggleRow}>
              <input
                checked={activeDraft.urgentBypass}
                type='checkbox'
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, urgentBypass: event.target.checked } : current
                  )
                }
              />
              <span>Urgent bypass: skip manager stage, still require director approval</span>
            </label>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Workflow next step</h2>
            <span>{activeDraft.voucherNumber}</span>
          </div>
          <div className={styles.previewActions}>
            <button
              className={styles.primaryAction}
              disabled={isIssuingVoucher}
              type='button'
              onClick={() => {
                void issuePaymentVoucher();
              }}
            >
              {isIssuingVoucher ? 'Issuing voucher...' : 'Issue payment voucher'}
            </button>
            <button
              className={styles.secondaryAction}
              disabled={isDownloadingPdf}
              type='button'
              onClick={() => {
                void downloadPaymentVoucherPdf();
              }}
            >
              {isDownloadingPdf ? 'Generating PDF...' : 'Download draft PDF'}
            </button>
            <p className={styles.helperText}>
              Issuing writes a live voucher record and queues the director approval email.
            </p>
            {statusMessage ? <p className={styles.helperStatus}>{statusMessage}</p> : null}
          </div>
          <div className={styles.previewMeta}>
            <div>
              <span>Approver</span>
              <strong>{approver.name}</strong>
            </div>
            <div>
              <span>Recipient email</span>
              <strong>{activeDraft.payeeEmail || 'Pending'}</strong>
            </div>
            <div>
              <span>Grand total</span>
              <strong>{formatMoney(totals.grand)}</strong>
            </div>
            <div>
              <span>Export path later</span>
              <strong>runtime/prototype/exports</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ApprovalsScreen(): React.JSX.Element {
  const { currentUser, hrefWithUser } = usePrototypeShell();
  const { workspace, isLoading, error } = usePrototypeWorkspaceData();

  if (isLoading) return <WorkspaceLoadingState />;
  if (!workspace || error) return <WorkspaceErrorState message={error ?? 'Approvals unavailable.'} />;

  const queue = workspace.vouchers.filter(
    (voucher) =>
      voucher.status === 'pending_director_approval' &&
      (voucher.approverId === currentUser.id || currentUser.roles.includes('DIRECTOR'))
  );

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Approvals</span>
          <h1 className={styles.sectionTitle}>Director approval queue</h1>
        </div>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2>Pending for {currentUser.name}</h2>
          <span>{queue.length} items</span>
        </div>
        <div className={styles.list}>
          {queue.map((voucher) => (
            <Link
              key={voucher.id}
              className={styles.listRow}
              href={hrefWithUser(`/payment-vouchers/${voucher.id}`)}
            >
              <div>
                <strong>{voucher.voucherNumber}</strong>
                <p>{voucher.title}</p>
              </div>
              <div className={styles.rowMeta}>
                <span className={`${styles.status} ${statusClass(voucher.status)}`}>
                  {statusLabel(voucher.status)}
                </span>
                <strong>{voucher.amount}</strong>
              </div>
            </Link>
          ))}
          {queue.length === 0 ? (
            <div className={styles.emptyState}>No approval actions are waiting for this operator.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function FinanceScreen(): React.JSX.Element {
  const { currentUser, hrefWithUser } = usePrototypeShell();
  const { workspace, isLoading, error, refreshWorkspace } = usePrototypeWorkspaceData();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (isLoading) return <WorkspaceLoadingState />;
  if (!workspace || error) return <WorkspaceErrorState message={error ?? 'Finance queue unavailable.'} />;

  const readyForPayment = workspace.vouchers.filter(
    (voucher) => voucher.status === 'approved_for_payment'
  );
  const exportable = workspace.vouchers.filter((voucher) =>
    ['awaiting_signature', 'awaiting_staff_verification', 'completed'].includes(voucher.status)
  );

  async function exportBatch(): Promise<void> {
    setIsExporting(true);
    setStatusMessage(null);

    try {
      const payload = await runWorkflowAction({
        action: 'export_voucher_batch',
        actorId: currentUser.id,
        voucherIds: exportable.map((voucher) => voucher.id),
      });

      if (payload.error) {
        throw new Error(payload.error);
      }

      await refreshWorkspace();
      const targetPath = payload.data?.exports?.[0]?.filePath ?? 'runtime/prototype/exports';
      setStatusMessage(`Batch exported to ${targetPath}.`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Could not export voucher batch.'
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Finance operations</span>
          <h1 className={styles.sectionTitle}>Finance queue</h1>
        </div>
      </section>
      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Ready for payment</h2>
            <span>{readyForPayment.length} vouchers</span>
          </div>
          <div className={styles.list}>
            {readyForPayment.map((voucher) => (
              <Link
                key={voucher.id}
                className={styles.listRow}
                href={hrefWithUser(`/payment-vouchers/${voucher.id}`)}
              >
                <div>
                  <strong>{voucher.voucherNumber}</strong>
                  <p>{voucher.title}</p>
                </div>
                <div className={styles.rowMeta}>
                  <span className={`${styles.status} ${statusClass(voucher.status)}`}>
                    {statusLabel(voucher.status)}
                  </span>
                  <strong>{voucher.amount}</strong>
                </div>
              </Link>
            ))}
            {readyForPayment.length === 0 ? (
              <div className={styles.emptyState}>No vouchers are waiting for payment.</div>
            ) : null}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Export finished vouchers</h2>
            <span>{exportable.length} exportable items</span>
          </div>
          <div className={styles.sectionStack}>
            <button
              className={styles.primaryAction}
              disabled={isExporting || exportable.length === 0}
              type='button'
              onClick={() => {
                void exportBatch();
              }}
            >
              {isExporting ? 'Exporting batch...' : 'Export batch to local folder'}
            </button>
            <p className={styles.helperText}>
              Batch export writes one PDF per voucher into a new subfolder inside
              `runtime/prototype/exports`.
            </p>
            {statusMessage ? <p className={styles.helperStatus}>{statusMessage}</p> : null}
            <div className={styles.list}>
              {exportable.slice(0, 6).map((voucher) => (
                <div className={styles.listRow} key={voucher.id}>
                  <div>
                    <strong>{voucher.voucherNumber}</strong>
                    <p>{voucher.lastExportPath ?? 'Not exported yet'}</p>
                  </div>
                  <div className={styles.rowMeta}>
                    <span className={`${styles.status} ${statusClass(voucher.status)}`}>
                      {statusLabel(voucher.status)}
                    </span>
                    <strong>{voucher.amount}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function SettingsScreen(): React.JSX.Element {
  const { workspace, isLoading, error } = usePrototypeWorkspaceData();

  if (isLoading) return <WorkspaceLoadingState />;
  if (!workspace || error) return <WorkspaceErrorState message={error ?? 'Settings unavailable.'} />;

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Settings</span>
          <h1 className={styles.sectionTitle}>Templates and local output</h1>
        </div>
      </section>
      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Email templates</h2>
            <span>{prototypeTemplateCards.length} workflow messages</span>
          </div>
          <div className={styles.cardGrid}>
            {prototypeTemplateCards.map((template) => (
              <div className={styles.infoCard} key={template.id}>
                <strong>{template.title}</strong>
                <p>{template.description}</p>
                <span>{template.placeholderKeys.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Local outbox and exports</h2>
            <span>{workspace.notifications.length} emails · {workspace.exports.length} exports</span>
          </div>
          <div className={styles.sectionStack}>
            <div className={styles.infoCard}>
              <strong>Outbox folder</strong>
              <p>Queued emails are written as JSON files so SMTP can be wired later.</p>
              <span>runtime/prototype/outbox</span>
            </div>
            <div className={styles.infoCard}>
              <strong>Export folder</strong>
              <p>Complete voucher PDFs land here when single or batch export runs.</p>
              <span>runtime/prototype/exports</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActionPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={styles.actionPanel}>
      <h3>{title}</h3>
      <div className={styles.sectionStack}>{children}</div>
    </div>
  );
}

function NotificationList({
  notifications,
}: {
  notifications: PrototypeNotification[];
}): React.JSX.Element {
  return (
    <div className={styles.list}>
      {notifications.map((notification) => (
        <div className={styles.listRow} key={notification.id}>
          <div>
            <strong>{notification.subject}</strong>
            <p>{notification.toLabel} · {notification.toEmail}</p>
          </div>
          <div className={styles.rowMeta}>
            <span className={styles.status}>queued</span>
            <strong>{notification.outboxPath}</strong>
          </div>
        </div>
      ))}
      {notifications.length === 0 ? (
        <div className={styles.emptyState}>No queued notifications for this voucher yet.</div>
      ) : null}
    </div>
  );
}

export function SubmissionDetailScreen({
  submissionId,
}: {
  submissionId: string;
}): React.JSX.Element {
  const { currentUser } = usePrototypeShell();
  const { workspace, isLoading, error, refreshWorkspace } = usePrototypeWorkspaceData();
  const [signatureText, setSignatureText] = useState(currentUser.name);
  const [directorNote, setDirectorNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(formatDateForInput());
  const [paymentReference, setPaymentReference] = useState('');
  const [receiptLink, setReceiptLink] = useState('');
  const [financeNote, setFinanceNote] = useState('');
  const [verificationNote, setVerificationNote] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (isLoading) return <WorkspaceLoadingState />;
  if (!workspace || error) return <WorkspaceErrorState message={error ?? 'Voucher detail unavailable.'} />;

  const voucher = workspace.vouchers.find((entry) => entry.id === submissionId);
  if (!voucher) {
    return <WorkspaceErrorState message='Voucher not found.' />;
  }
  const activeVoucher = voucher;

  const voucherNotifications = workspace.notifications.filter(
    (notification) => notification.voucherId === activeVoucher.id
  );

  async function approveCurrentVoucher(): Promise<void> {
    const payload = await runWorkflowAction({
      action: 'approve_voucher',
      actorId: currentUser.id,
      voucherId: activeVoucher.id,
      signatureText,
      note: directorNote,
    });

    if (payload.error) {
      setStatusMessage(payload.error);
      return;
    }

    setStatusMessage('Voucher approved and finance has been notified.');
    await refreshWorkspace();
  }

  async function markPaid(): Promise<void> {
    const payload = await runWorkflowAction({
      action: 'mark_paid',
      actorId: currentUser.id,
      voucherId: activeVoucher.id,
      paidAt: paymentDate,
      paymentReference,
      receiptLink,
      note: financeNote,
    });

    if (payload.error) {
      setStatusMessage(payload.error);
      return;
    }

    setStatusMessage('Payment captured and recipient signature email queued.');
    await refreshWorkspace();
  }

  async function verifySignedVoucher(): Promise<void> {
    const payload = await runWorkflowAction({
      action: 'verify_voucher',
      actorId: currentUser.id,
      voucherId: activeVoucher.id,
      note: verificationNote,
    });

    if (payload.error) {
      setStatusMessage(payload.error);
      return;
    }

    setStatusMessage('Voucher verified. Finance has been notified.');
    await refreshWorkspace();
  }

  async function exportVoucher(): Promise<void> {
    const payload = await runWorkflowAction({
      action: 'export_voucher',
      actorId: currentUser.id,
      voucherId: activeVoucher.id,
    });

    if (payload.error) {
      setStatusMessage(payload.error);
      return;
    }

    const targetPath = payload.data?.exports?.[0]?.filePath ?? activeVoucher.lastExportPath;
    setStatusMessage(`Voucher exported to ${targetPath}.`);
    await refreshWorkspace();
  }

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>{activeVoucher.voucherNumber}</span>
          <h1 className={styles.sectionTitle}>{activeVoucher.title}</h1>
        </div>
        <span className={`${styles.status} ${statusClass(activeVoucher.status)}`}>
          {statusLabel(activeVoucher.status)}
        </span>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Voucher summary</h2>
            <span>{activeVoucher.amount}</span>
          </div>

          <div className={styles.cardGrid}>
            <div className={styles.infoCard}>
              <strong>Payee</strong>
              <p>{activeVoucher.payeeName}</p>
              <span>{activeVoucher.payeeEmail}</span>
            </div>
            <div className={styles.infoCard}>
              <strong>Recipient link</strong>
              <p>/recipient/{activeVoucher.recipientSignature.token}</p>
              <span>Used after finance marks as paid</span>
            </div>
            <div className={styles.infoCard}>
              <strong>Payment reference</strong>
              <p>{activeVoucher.financeProcessing?.paymentReference ?? 'Pending'}</p>
              <span>{activeVoucher.financeProcessing?.receiptLink ?? 'Receipt not linked yet'}</span>
            </div>
            <div className={styles.infoCard}>
              <strong>Last export path</strong>
              <p>{buildAbsolutePathPreview(activeVoucher.lastExportPath ?? '')}</p>
              <span>Single export writes one PDF into the local runtime folder.</span>
            </div>
          </div>

          <div className={styles.lineItemTableWrap}>
            <table className={styles.lineItemTable}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {activeVoucher.draft.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.accountCode}</td>
                    <td>{item.description || item.accountCode}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unitPrice}</td>
                    <td>{formatMoney(calculateLineTotal(item, activeVoucher.draft.amountsTaxInclusive))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {statusMessage ? <p className={styles.helperStatus}>{statusMessage}</p> : null}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Workflow actions</h2>
            <span>{currentUser.name}</span>
          </div>

          <div className={styles.sectionStack}>
            {activeVoucher.status === 'pending_director_approval' &&
            (activeVoucher.approverId === currentUser.id ||
              currentUser.roles.includes('DIRECTOR')) ? (
              <ActionPanel title='Director approval'>
                <label className={styles.fieldWide}>
                  <span>Signature text</span>
                  <input
                    value={signatureText}
                    onChange={(event) => setSignatureText(event.target.value)}
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Approval note</span>
                  <textarea
                    rows={3}
                    value={directorNote}
                    onChange={(event) => setDirectorNote(event.target.value)}
                  />
                </label>
                <button className={styles.primaryAction} type='button' onClick={() => void approveCurrentVoucher()}>
                  Approve with signature
                </button>
              </ActionPanel>
            ) : null}

            {activeVoucher.status === 'approved_for_payment' &&
            currentUser.roles.includes('FINANCE_ADMIN') ? (
              <ActionPanel title='Finance processing'>
                <label className={styles.fieldWide}>
                  <span>Payment date</span>
                  <input
                    type='date'
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Payment reference</span>
                  <input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Receipt link</span>
                  <input
                    value={receiptLink}
                    onChange={(event) => setReceiptLink(event.target.value)}
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Finance note</span>
                  <textarea
                    rows={3}
                    value={financeNote}
                    onChange={(event) => setFinanceNote(event.target.value)}
                  />
                </label>
                <button className={styles.primaryAction} type='button' onClick={() => void markPaid()}>
                  Mark as paid and notify recipient
                </button>
              </ActionPanel>
            ) : null}

            {activeVoucher.status === 'awaiting_staff_verification' &&
            activeVoucher.submitterId === currentUser.id ? (
              <ActionPanel title='Staff verification'>
                <label className={styles.fieldWide}>
                  <span>Verification note</span>
                  <textarea
                    rows={3}
                    value={verificationNote}
                    onChange={(event) => setVerificationNote(event.target.value)}
                  />
                </label>
                <button className={styles.primaryAction} type='button' onClick={() => void verifySignedVoucher()}>
                  Verify signed voucher
                </button>
              </ActionPanel>
            ) : null}

            {['awaiting_signature', 'awaiting_staff_verification', 'completed'].includes(
              activeVoucher.status
            ) ? (
              <ActionPanel title='Complete PDF export'>
                <p className={styles.helperText}>
                  This export includes director signature text and finance payment date, then writes the finished PDF into the local runtime folder.
                </p>
                <button className={styles.secondaryAction} type='button' onClick={() => void exportVoucher()}>
                  Export complete voucher PDF
                </button>
              </ActionPanel>
            ) : null}

            <ActionPanel title='Queued emails'>
              <NotificationList notifications={voucherNotifications} />
            </ActionPanel>

            <ActionPanel title='Activity'>
              <div className={styles.timeline}>
                {activeVoucher.activity.map((entry) => (
                  <div className={styles.timelineItem} key={entry.id}>
                    <strong>{entry.action}</strong>
                    <p>{entry.detail}</p>
                    <span>{entry.actorLabel} · {entry.at}</span>
                  </div>
                ))}
              </div>
            </ActionPanel>
          </div>
        </div>
      </section>
    </div>
  );
}

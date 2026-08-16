'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePrototypeShell } from './prototype-app-shell';
import styles from './payment-request-screens.module.css';

type PaymentRequestType =
  | 'invoice'
  | 'claim'
  | 'travel_allowance'
  | 'cash_advance';

type PaymentRequestLineItem = {
  id: string;
  description: string;
  accountCode: string;
  quantity: string;
  unitAmount: string;
  taxAmount: string;
  note: string;
};

type PaymentRequestNotification = {
  id: string;
  requestId: string;
  kind: string;
  toLabel: string;
  toEmail: string;
  subject: string;
  body: string;
  createdAt: string;
  outboxPath: string;
};

type PaymentRequestActivity = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
};

type PaymentRequestRecord = {
  id: string;
  requestNumber: string;
  title: string;
  type: PaymentRequestType;
  status: string;
  submitterId: string;
  submitterName: string;
  managerApproverId: string;
  directorApproverId: string;
  totalAmount: number;
  currency: string;
  recipientName: string;
  recipientEmail: string;
  projectCode: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  paymentReference?: string;
  receiptLink?: string;
  directorSignatureText?: string;
  reconciliationOutcome?: string;
  lineItems: PaymentRequestLineItem[];
  notifications: PaymentRequestNotification[];
  activity: PaymentRequestActivity[];
};

type PaymentRequestReferenceData = {
  types: PaymentRequestType[];
  statuses: string[];
  projects: Array<{ code: string; label: string }>;
  accountCodes: Array<{ code: string; label: string }>;
};

type PaymentRequestListResult = {
  requests: PaymentRequestRecord[];
  reference: PaymentRequestReferenceData;
};

type DraftRequest = {
  type: PaymentRequestType;
  title: string;
  description: string;
  recipientName: string;
  recipientEmail: string;
  projectCode: string;
  managerApproverId: string;
  directorApproverId: string;
  urgent: boolean;
  currency: string;
  lineItems: PaymentRequestLineItem[];
};

type ActionResponse = {
  request?: PaymentRequestRecord;
  error?: string;
};

const typeOptions: Array<{ value: PaymentRequestType; label: string }> = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'claim', label: 'Claim' },
  { value: 'travel_allowance', label: 'Travel allowance' },
  { value: 'cash_advance', label: 'Cash advance' },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(
  record: Record<string, unknown> | null,
  key: string,
  fallback = ''
): string {
  if (!record) return fallback;
  const value = record[key];
  return typeof value === 'string' ? value : fallback;
}

function readNumber(
  record: Record<string, unknown> | null,
  key: string,
  fallback = 0
): number {
  if (!record) return fallback;
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeType(value: string): PaymentRequestType {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'invoice') return 'invoice';
  if (normalized === 'claim') return 'claim';
  if (normalized === 'travel_allowance') return 'travel_allowance';
  if (normalized === 'cash_advance') return 'cash_advance';
  if (normalized === 'travel allowance') return 'travel_allowance';
  if (normalized === 'cash advance') return 'cash_advance';
  if (normalized === 'invoice_payment') return 'invoice';
  if (normalized === 'expense_claim') return 'claim';

  return 'invoice';
}

function toApiType(type: PaymentRequestType): string {
  if (type === 'invoice') return 'INVOICE_PAYMENT';
  if (type === 'claim') return 'EXPENSE_CLAIM';
  if (type === 'travel_allowance') return 'TRAVEL_ALLOWANCE';
  return 'CASH_ADVANCE';
}

function formatType(type: string): string {
  return type.replaceAll('_', ' ');
}

function formatStatus(status: string): string {
  return status.replaceAll('_', ' ');
}

function formatMoney(amount: number, currency = 'MYR'): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function createLineItem(index: number): PaymentRequestLineItem {
  return {
    id: `line-${index}`,
    description: '',
    accountCode: 'GL-1000',
    quantity: '1',
    unitAmount: '',
    taxAmount: '0',
    note: '',
  };
}

function lineTotal(lineItem: PaymentRequestLineItem): number {
  const quantity = Number(lineItem.quantity || '0');
  const unitAmount = Number(lineItem.unitAmount || '0');
  const taxAmount = Number(lineItem.taxAmount || '0');
  const total = quantity * unitAmount + taxAmount;

  return Number.isFinite(total) ? total : 0;
}

function requestTotal(lineItems: PaymentRequestLineItem[]): number {
  return lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
}

function defaultReferenceData(): PaymentRequestReferenceData {
  return {
    types: typeOptions.map((entry) => entry.value),
    statuses: [
      'draft',
      'pending_manager_approval',
      'pending_director_approval',
      'approved_for_finance',
      'paid',
      'reconciled',
    ],
    projects: [],
    accountCodes: [],
  };
}

function defaultDraft(): DraftRequest {
  return {
    type: 'invoice',
    title: '',
    description: '',
    recipientName: '',
    recipientEmail: '',
    projectCode: '',
    managerApproverId: '',
    directorApproverId: '',
    urgent: false,
    currency: 'MYR',
    lineItems: [createLineItem(1)],
  };
}

function statusTone(status: string): string {
  if (status === 'reconciled') return styles.statusComplete;
  if (status === 'paid') return styles.statusFinance;
  if (
    status === 'pending_manager_approval' ||
    status === 'pending_director_approval'
  ) {
    return styles.statusReview;
  }
  if (status === 'approved_for_finance') return styles.statusAttention;

  return styles.statusMuted;
}

function normalizeLineItem(
  value: unknown,
  index: number
): PaymentRequestLineItem {
  const record = asRecord(value);

  return {
    id: readString(record, 'id', `line-${index + 1}`),
    description: readString(record, 'description'),
    accountCode: readString(record, 'accountCode', readString(record, 'glCode', 'GL-1000')),
    quantity: String(
      readString(record, 'quantity', String(readNumber(record, 'qty', 1)))
    ),
    unitAmount: String(
      readString(record, 'unitAmount', String(readNumber(record, 'unitPrice', 0)))
    ),
    taxAmount: String(
      readString(record, 'taxAmount', String(readNumber(record, 'tax', 0)))
    ),
    note: readString(record, 'note'),
  };
}

function normalizeNotification(
  value: unknown,
  index: number
): PaymentRequestNotification {
  const record = asRecord(value);

  return {
    id: readString(record, 'id', `notification-${index + 1}`),
    requestId: readString(record, 'requestId'),
    kind: readString(record, 'kind', 'unknown'),
    toLabel: readString(record, 'toLabel', readString(record, 'toName', 'Unknown')),
    toEmail: readString(record, 'toEmail'),
    subject: readString(record, 'subject', 'Untitled notification'),
    body: readString(record, 'body'),
    createdAt: readString(record, 'createdAt'),
    outboxPath: readString(record, 'outboxPath'),
  };
}

function normalizeActivity(value: unknown, index: number): PaymentRequestActivity {
  const record = asRecord(value);

  return {
    id: readString(record, 'id', `activity-${index + 1}`),
    at: readString(record, 'at', readString(record, 'createdAt')),
    actor: readString(
      record,
      'actor',
      readString(record, 'actorName', readString(record, 'actorLabel', 'System'))
    ),
    action: readString(record, 'action', 'update'),
    detail: readString(record, 'detail'),
  };
}

function normalizeRequest(value: unknown): PaymentRequestRecord {
  const record = asRecord(value);
  const lineItems = asArray(
    record?.lineItems ?? record?.items ?? record?.lines
  ).map(normalizeLineItem);
  const notifications = asArray(
    record?.notifications ?? record?.notificationQueue ?? record?.queuedNotifications
  ).map(normalizeNotification);
  const activity = asArray(
    record?.activity ?? record?.auditTrail ?? record?.timeline
  ).map(normalizeActivity);
  const currency = readString(record, 'currency', 'MYR');

  const normalizedLineItems = lineItems.length > 0 ? lineItems : [createLineItem(1)];
  const totalAmount = readNumber(
    record,
    'totalAmount',
    readNumber(record, 'amount', requestTotal(normalizedLineItems))
  );

  return {
    id: readString(record, 'id', readString(record, 'requestId', 'unknown-request')),
    requestNumber: readString(
      record,
      'requestNumber',
      readString(record, 'number', 'PR-UNASSIGNED')
    ),
    title: readString(record, 'title', 'Untitled payment request'),
    type: normalizeType(readString(record, 'type', readString(record, 'requestType', 'invoice'))),
    status: readString(record, 'status', 'draft'),
    submitterId: readString(record, 'submitterId'),
    submitterName: readString(record, 'submitterName'),
    managerApproverId: readString(
      record,
      'managerApproverId',
      readString(record, 'managerId')
    ),
    directorApproverId: readString(
      record,
      'directorApproverId',
      readString(record, 'directorId')
    ),
    totalAmount,
    currency,
    recipientName: readString(record, 'recipientName', readString(record, 'payeeName')),
    recipientEmail: readString(record, 'recipientEmail', readString(record, 'payeeEmail')),
    projectCode: readString(record, 'projectCode'),
    createdAt: readString(record, 'createdAt'),
    updatedAt: readString(record, 'updatedAt'),
    paidAt: readString(record, 'paidAt') || undefined,
    paymentReference: readString(record, 'paymentReference') || undefined,
    receiptLink: readString(record, 'receiptLink') || undefined,
    directorSignatureText: readString(record, 'directorSignatureText') || undefined,
    reconciliationOutcome: readString(record, 'reconciliationOutcome') || undefined,
    lineItems: normalizedLineItems,
    notifications,
    activity,
  };
}

function normalizeReferenceData(value: unknown): PaymentRequestReferenceData {
  const record = asRecord(value);
  const types = asArray(record?.types).map((item) =>
    normalizeType(String(item ?? 'invoice'))
  );
  const statuses = asArray(record?.statuses)
    .map((item) => String(item ?? ''))
    .filter((item) => item.length > 0);
  const projects = asArray(record?.projects)
    .map((item) => {
      const projectRecord = asRecord(item);
      const code = readString(projectRecord, 'code');
      const label = readString(projectRecord, 'label', code);
      return code ? { code, label } : null;
    })
    .filter((item): item is { code: string; label: string } => item !== null);
  const accountCodes = asArray(record?.accountCodes)
    .map((item) => {
      const accountRecord = asRecord(item);
      const code = readString(accountRecord, 'code');
      const label = readString(accountRecord, 'label', code);
      return code ? { code, label } : null;
    })
    .filter((item): item is { code: string; label: string } => item !== null);

  return {
    types: types.length > 0 ? types : defaultReferenceData().types,
    statuses: statuses.length > 0 ? statuses : defaultReferenceData().statuses,
    projects,
    accountCodes,
  };
}

function normalizeListResponse(value: unknown): PaymentRequestListResult {
  if (Array.isArray(value)) {
    return {
      requests: value.map(normalizeRequest),
      reference: defaultReferenceData(),
    };
  }

  const root = asRecord(value);
  const data = asRecord(root?.data) ?? root;
  const requestsSource = asArray(
    data?.requests ?? data?.items ?? data?.paymentRequests ?? data?.list
  );
  const globalNotifications = asArray(data?.notifications).map(
    normalizeNotification
  );
  const singleRequest = asRecord(data?.request);
  const requests = requestsSource.map(normalizeRequest).map((request) => ({
    ...request,
    notifications:
      request.notifications.length > 0
        ? request.notifications
        : globalNotifications.filter(
            (notification) => notification.requestId === request.id
          ),
  }));

  if (requests.length === 0 && singleRequest) {
    requests.push(normalizeRequest(singleRequest));
  }

  const reference = normalizeReferenceData(data?.reference ?? data?.meta);
  const discoveredStatuses = Array.from(
    new Set(requests.map((request) => request.status))
  );
  const discoveredTypes = Array.from(new Set(requests.map((request) => request.type)));

  return {
    requests,
    reference: {
      ...reference,
      statuses: Array.from(new Set([...reference.statuses, ...discoveredStatuses])),
      types: Array.from(new Set([...reference.types, ...discoveredTypes])),
    },
  };
}

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function fetchPaymentRequests(): Promise<PaymentRequestListResult> {
  const response = await fetch('/api/v1/prototype/payment-requests', {
    cache: 'no-store',
  });
  const payload = await readJsonSafe(response);

  if (!response.ok) {
    const parsed = asRecord(payload);
    const errorMessage = readString(parsed, 'error', 'Could not load payment requests.');
    throw new Error(errorMessage);
  }

  return normalizeListResponse(payload);
}

async function fetchPaymentRequestById(
  requestId: string
): Promise<PaymentRequestRecord | null> {
  const response = await fetch(
    `/api/v1/prototype/payment-requests?id=${encodeURIComponent(requestId)}`,
    {
      cache: 'no-store',
    }
  );
  const payload = await readJsonSafe(response);

  if (!response.ok) return null;

  const parsed = normalizeListResponse(payload);
  return parsed.requests.find((entry) => entry.id === requestId) ?? null;
}

async function createPaymentRequest(
  draft: DraftRequest,
  actorId: string
): Promise<PaymentRequestRecord> {
  const response = await fetch('/api/v1/prototype/payment-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actorId,
      type: toApiType(draft.type),
      title: draft.title,
      payeeName: draft.recipientName,
      currency: draft.currency,
      notes: draft.description,
      managerApproverId: draft.managerApproverId || undefined,
      directorApproverId: draft.directorApproverId || undefined,
      lineItems: draft.lineItems.map((line) => ({
        id: line.id,
        description: line.description || draft.title,
        accountCode: line.accountCode,
        quantity: Number(line.quantity || '0'),
        unitAmount: Number(line.unitAmount || '0'),
        taxAmount: Number(line.taxAmount || '0'),
      })),
    }),
  });

  const payload = await readJsonSafe(response);
  const parsed = asRecord(payload);

  if (!response.ok) {
    throw new Error(readString(parsed, 'error', 'Could not create payment request.'));
  }

  const data = asRecord(parsed?.data) ?? parsed;
  const requestRecord = data?.request ?? data?.paymentRequest;
  const normalized = asRecord(requestRecord);

  if (!normalized) {
    throw new Error('Create endpoint did not return request data.');
  }

  return normalizeRequest(normalized);
}

async function runPaymentRequestAction(
  payload: Record<string, unknown>
): Promise<ActionResponse> {
  const response = await fetch('/api/v1/prototype/payment-request-actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await readJsonSafe(response);
  const parsed = asRecord(body);
  const data = asRecord(parsed?.data) ?? parsed;
  const requestRecord = asRecord(data?.request ?? data?.paymentRequest ?? data?.updatedRequest);

  if (!response.ok) {
    return {
      error: readString(parsed, 'error', 'Payment request action failed.'),
    };
  }

  return {
    request: requestRecord ? normalizeRequest(requestRecord) : undefined,
  };
}

function LoadingState(): React.JSX.Element {
  return <div className={styles.emptyState}>Loading payment request module...</div>;
}

function ErrorState({ message }: { message: string }): React.JSX.Element {
  return <div className={styles.emptyState}>{message}</div>;
}

export function PaymentRequestListScreen(): React.JSX.Element {
  const { hrefWithUser } = usePrototypeShell();
  const [requests, setRequests] = useState<PaymentRequestRecord[]>([]);
  const [reference, setReference] = useState<PaymentRequestReferenceData>(
    defaultReferenceData()
  );
  const [typeFilter, setTypeFilter] = useState<'all' | PaymentRequestType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadList(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await fetchPaymentRequests();
      setRequests(payload.requests);
      setReference(payload.reference);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load payment requests.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (typeFilter !== 'all' && request.type !== typeFilter) return false;
      if (statusFilter !== 'all' && request.status !== statusFilter) return false;
      return true;
    });
  }, [requests, statusFilter, typeFilter]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Payment requests</span>
          <h1 className={styles.title}>All payment requests</h1>
          <p className={styles.copy}>
            Filter by request type or workflow status, then open a request to run
            approvals, finance processing, and reconciliation.
          </p>
        </div>
        <Link className={styles.primaryAction} href={hrefWithUser('/payment-requests/new')}>
          New payment request
        </Link>
      </section>

      <section className={styles.panel}>
        <div className={styles.filterBar}>
          <label className={styles.field}>
            <span>Type filter</span>
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as 'all' | PaymentRequestType);
              }}
            >
              <option value='all'>All types</option>
              {reference.types.map((type) => (
                <option key={type} value={type}>
                  {formatType(type)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Status filter</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
              }}
            >
              <option value='all'>All statuses</option>
              {reference.statuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.ghostAction} type='button' onClick={() => void loadList()}>
            Refresh list
          </button>
        </div>

        <div className={styles.listTableWrap}>
          <table className={styles.listTable}>
            <thead>
              <tr>
                <th>Request</th>
                <th>Type</th>
                <th>Status</th>
                <th>Submitter</th>
                <th>Total</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <Link
                      className={styles.inlineLink}
                      href={hrefWithUser(`/payment-requests/${request.id}`)}
                    >
                      {request.requestNumber}
                    </Link>
                    <p className={styles.cellSubtext}>{request.title}</p>
                  </td>
                  <td>{formatType(request.type)}</td>
                  <td>
                    <span className={`${styles.statusPill} ${statusTone(request.status)}`}>
                      {formatStatus(request.status)}
                    </span>
                  </td>
                  <td>{request.submitterName || request.submitterId || '-'}</td>
                  <td>{formatMoney(request.totalAmount, request.currency)}</td>
                  <td>{request.updatedAt || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 ? (
          <div className={styles.emptyState}>No payment requests match the selected filters.</div>
        ) : null}
      </section>
    </div>
  );
}

export function PaymentRequestCreateScreen(): React.JSX.Element {
  const { currentUser, hrefWithUser } = usePrototypeShell();
  const [draft, setDraft] = useState<DraftRequest>(defaultDraft());
  const [reference, setReference] = useState<PaymentRequestReferenceData>(
    defaultReferenceData()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReferenceData(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await fetchPaymentRequests();
      setReference(payload.reference);
      setDraft((previous) => ({
        ...previous,
        projectCode:
          previous.projectCode || payload.reference.projects[0]?.code || '',
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load payment request references.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadReferenceData();
  }, []);

  function updateLineItem(
    lineItemId: string,
    patch: Partial<PaymentRequestLineItem>
  ): void {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.map((item) =>
        item.id === lineItemId ? { ...item, ...patch } : item
      ),
    }));
  }

  function setRequestType(nextType: PaymentRequestType): void {
    setDraft((current) => {
      if (nextType === 'invoice') {
        const invoiceLine = current.lineItems[0] ?? createLineItem(1);
        return {
          ...current,
          type: nextType,
          lineItems: [{ ...invoiceLine, id: 'line-1' }],
        };
      }

      return {
        ...current,
        type: nextType,
        lineItems:
          current.lineItems.length > 0
            ? current.lineItems
            : [createLineItem(1)],
      };
    });
  }

  function addLineItem(): void {
    setDraft((current) => ({
      ...current,
      lineItems: [...current.lineItems, createLineItem(current.lineItems.length + 1)],
    }));
  }

  function removeLineItem(lineItemId: string): void {
    setDraft((current) => {
      if (current.lineItems.length === 1 || current.type === 'invoice') {
        return current;
      }
      return {
        ...current,
        lineItems: current.lineItems.filter((item) => item.id !== lineItemId),
      };
    });
  }

  async function submitCreate(): Promise<void> {
    setIsSubmitting(true);
    setStatusMessage(null);
    setError(null);

    try {
      if (!draft.title.trim()) {
        throw new Error('Request title is required.');
      }
      if (!draft.recipientName.trim() || !draft.recipientEmail.trim()) {
        throw new Error('Recipient name and email are required.');
      }

      const created = await createPaymentRequest(draft, currentUser.id);
      setStatusMessage(`${created.requestNumber} created successfully.`);
      window.location.href = hrefWithUser(`/payment-requests/${created.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not create payment request.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <LoadingState />;
  if (error && !statusMessage) {
    return <ErrorState message={error} />;
  }

  const total = requestTotal(draft.lineItems);
  const allowMultipleLines = draft.type !== 'invoice';

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>New payment request</span>
          <h1 className={styles.title}>Create request</h1>
          <p className={styles.copy}>
            Build invoice, claim, travel allowance, or cash advance requests with
            role routing and line-level totals.
          </p>
        </div>
      </section>

      <section className={styles.layoutGrid}>
        <div className={styles.panel}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Request type</span>
              <select
                value={draft.type}
                onChange={(event) => setRequestType(event.target.value as PaymentRequestType)}
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Currency</span>
              <input
                value={draft.currency}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, currency: event.target.value }))
                }
              />
            </label>
            <label className={styles.fieldWide}>
              <span>Title</span>
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className={styles.fieldWide}>
              <span>Description</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>Recipient name</span>
              <input
                value={draft.recipientName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, recipientName: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>Recipient email</span>
              <input
                type='email'
                value={draft.recipientEmail}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, recipientEmail: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>Project code</span>
              <select
                value={draft.projectCode}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, projectCode: event.target.value }))
                }
              >
                <option value=''>Select project</option>
                {reference.projects.map((project) => (
                  <option key={project.code} value={project.code}>
                    {project.code} - {project.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Manager approver ID</span>
              <input
                value={draft.managerApproverId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    managerApproverId: event.target.value,
                  }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>Director approver ID</span>
              <input
                value={draft.directorApproverId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    directorApproverId: event.target.value,
                  }))
                }
              />
            </label>
            <label className={styles.toggleField}>
              <input
                checked={draft.urgent}
                type='checkbox'
                onChange={(event) =>
                  setDraft((current) => ({ ...current, urgent: event.target.checked }))
                }
              />
              <span>Urgent processing</span>
            </label>
          </div>

          <div className={styles.linesHeader}>
            <div>
              <h2>Line items</h2>
              <p>
                {allowMultipleLines
                  ? 'Add multiple rows for this request type.'
                  : 'Invoice uses a single line by default.'}
              </p>
            </div>
            <button
              className={styles.ghostAction}
              disabled={!allowMultipleLines}
              type='button'
              onClick={addLineItem}
            >
              Add line
            </button>
          </div>

          <div className={styles.listTableWrap}>
            <table className={styles.listTable}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {draft.lineItems.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <input
                        className={styles.tableInput}
                        list='account-code-list'
                        value={line.accountCode}
                        onChange={(event) =>
                          updateLineItem(line.id, { accountCode: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={styles.tableInput}
                        value={line.description}
                        onChange={(event) =>
                          updateLineItem(line.id, { description: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={styles.tableInput}
                        value={line.quantity}
                        onChange={(event) =>
                          updateLineItem(line.id, { quantity: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={styles.tableInput}
                        value={line.unitAmount}
                        onChange={(event) =>
                          updateLineItem(line.id, { unitAmount: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={styles.tableInput}
                        value={line.taxAmount}
                        onChange={(event) =>
                          updateLineItem(line.id, { taxAmount: event.target.value })
                        }
                      />
                    </td>
                    <td className={styles.totalCell}>
                      {formatMoney(lineTotal(line), draft.currency)}
                    </td>
                    <td>
                      <button
                        className={styles.iconAction}
                        disabled={draft.lineItems.length === 1 || !allowMultipleLines}
                        type='button'
                        onClick={() => removeLineItem(line.id)}
                      >
                        -
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <datalist id='account-code-list'>
            {reference.accountCodes.map((account) => (
              <option key={account.code} value={account.code}>
                {account.label}
              </option>
            ))}
          </datalist>
        </div>

        <div className={styles.panel}>
          <h2>Request summary</h2>
          <div className={styles.infoList}>
            <div>
              <span>Operator</span>
              <strong>{currentUser.name}</strong>
            </div>
            <div>
              <span>Request type</span>
              <strong>{formatType(draft.type)}</strong>
            </div>
            <div>
              <span>Lines</span>
              <strong>{draft.lineItems.length}</strong>
            </div>
            <div>
              <span>Total amount</span>
              <strong>{formatMoney(total, draft.currency)}</strong>
            </div>
          </div>

          <div className={styles.actionStack}>
            <button
              className={styles.primaryAction}
              disabled={isSubmitting}
              type='button'
              onClick={() => void submitCreate()}
            >
              {isSubmitting ? 'Creating request...' : 'Create payment request'}
            </button>
            <Link className={styles.secondaryAction} href={hrefWithUser('/payment-requests')}>
              Back to request list
            </Link>
            {statusMessage ? <p className={styles.helperStatus}>{statusMessage}</p> : null}
            {error ? <p className={styles.helperError}>{error}</p> : null}
          </div>

          <p className={styles.helperText}>
            Create page keeps invoice as single-line by default, while claim,
            travel allowance, and cash advance support multiple lines.
          </p>
        </div>
      </section>
    </div>
  );
}

type DetailActionForm = {
  managerNote: string;
  directorSignature: string;
  directorNote: string;
  paymentDate: string;
  paymentReference: string;
  receiptLink: string;
  financeNote: string;
  reconciliationNote: string;
  resolvedChildRequestIds: string;
};

function defaultDetailActionForm(currentUserName: string): DetailActionForm {
  return {
    managerNote: '',
    directorSignature: currentUserName,
    directorNote: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentReference: '',
    receiptLink: '',
    financeNote: '',
    reconciliationNote: '',
    resolvedChildRequestIds: '',
  };
}

function canSubmit(request: PaymentRequestRecord, currentUserId: string): boolean {
  return (
    ['DRAFT', 'draft', 'RETURNED_TO_SUBMITTER', 'returned_to_submitter'].includes(
      request.status
    ) &&
    (request.submitterId === currentUserId || request.submitterId.length === 0)
  );
}

function canManagerApprove(
  request: PaymentRequestRecord,
  roles: string[]
): boolean {
  return (
    roles.includes('MANAGER') &&
    ['PENDING_MANAGER_APPROVAL', 'pending_manager_approval'].includes(request.status)
  );
}

function canDirectorApprove(
  request: PaymentRequestRecord,
  roles: string[]
): boolean {
  return (
    roles.includes('DIRECTOR') &&
    ['PENDING_DIRECTOR_APPROVAL', 'pending_director_approval'].includes(request.status)
  );
}

function canFinanceProcess(
  request: PaymentRequestRecord,
  roles: string[]
): boolean {
  return (
    roles.includes('FINANCE_ADMIN') &&
    [
      'PENDING_PAYMENT',
      'APPROVED_PENDING_PAYMENT',
      'approved_for_finance',
      'finance_ready',
    ].includes(request.status)
  );
}

function canCompleteOrReconcile(
  request: PaymentRequestRecord,
  roles: string[],
  currentUserId: string
): boolean {
  if (request.status === 'PROCESSED') {
    return roles.includes('FINANCE_ADMIN');
  }

  return (
    (roles.includes('FINANCE_ADMIN') ||
      request.submitterId === currentUserId) &&
    [
      'PROCESSED_PENDING_RECONCILIATION',
      'RECON_PENDING_CHILD_CLOSURE',
      'paid',
      'awaiting_reconciliation',
    ].includes(request.status)
  );
}

export function PaymentRequestDetailScreen({
  requestId,
}: {
  requestId: string;
}): React.JSX.Element {
  const { currentUser, hrefWithUser } = usePrototypeShell();
  const [request, setRequest] = useState<PaymentRequestRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [form, setForm] = useState<DetailActionForm>(() =>
    defaultDetailActionForm(currentUser.name)
  );

  const loadRequest = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await fetchPaymentRequests();
      let target = payload.requests.find((entry) => entry.id === requestId) ?? null;

      if (!target) {
        target = await fetchPaymentRequestById(requestId);
      }

      if (!target) {
        throw new Error('Payment request not found.');
      }

      setRequest(target);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load payment request.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  async function runAction(action: string, extra: Record<string, unknown> = {}): Promise<void> {
    if (!request) return;

    setIsWorking(true);
    setActionMessage(null);

    try {
      const payload: Record<string, unknown> = {
        action,
        requestId: request.id,
        actorId: currentUser.id,
        ...extra,
      };

      const result = await runPaymentRequestAction(payload);

      if (result.error) {
        setActionMessage(result.error);
        return;
      }

      if (result.request) {
        setRequest(result.request);
      } else {
        await loadRequest();
      }

      setActionMessage('Action completed.');
    } catch (actionError) {
      setActionMessage(
        actionError instanceof Error
          ? actionError.message
          : 'Payment request action failed.'
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (isLoading) return <LoadingState />;
  if (!request || error) return <ErrorState message={error ?? 'Request unavailable.'} />;

  return (
    <div className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>{request.requestNumber}</span>
          <h1 className={styles.title}>{request.title}</h1>
          <p className={styles.copy}>
            {formatType(request.type)} request for {request.recipientName}.
          </p>
        </div>
        <div className={styles.headerMeta}>
          <span className={`${styles.statusPill} ${statusTone(request.status)}`}>
            {formatStatus(request.status)}
          </span>
          <strong>{formatMoney(request.totalAmount, request.currency)}</strong>
        </div>
      </section>

      <section className={styles.layoutGrid}>
        <div className={styles.panel}>
          <h2>Request details</h2>
          <div className={styles.infoList}>
            <div>
              <span>Type</span>
              <strong>{formatType(request.type)}</strong>
            </div>
            <div>
              <span>Submitter</span>
              <strong>{request.submitterName || request.submitterId || '-'}</strong>
            </div>
            <div>
              <span>Recipient</span>
              <strong>{request.recipientName || '-'}</strong>
            </div>
            <div>
              <span>Recipient email</span>
              <strong>{request.recipientEmail || '-'}</strong>
            </div>
            <div>
              <span>Project</span>
              <strong>{request.projectCode || '-'}</strong>
            </div>
            <div>
              <span>Payment reference</span>
              <strong>{request.paymentReference || '-'}</strong>
            </div>
          </div>

          <div className={styles.listTableWrap}>
            <table className={styles.listTable}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Tax</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {request.lineItems.map((line) => (
                  <tr key={line.id}>
                    <td>{line.accountCode}</td>
                    <td>{line.description || '-'}</td>
                    <td>{line.quantity}</td>
                    <td>{line.unitAmount}</td>
                    <td>{line.taxAmount}</td>
                    <td>{formatMoney(lineTotal(line), request.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.panel}>
          <h2>Workflow actions</h2>
          <div className={styles.actionStack}>
            {canSubmit(request, currentUser.id) ? (
              <button
                className={styles.primaryAction}
                disabled={isWorking}
                type='button'
                onClick={() => void runAction('submit_request')}
              >
                Submit request
              </button>
            ) : null}

            {canManagerApprove(request, currentUser.roles) ? (
              <div className={styles.actionPanel}>
                <label className={styles.fieldWide}>
                  <span>Manager note</span>
                  <textarea
                    rows={2}
                    value={form.managerNote}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        managerNote: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className={styles.primaryAction}
                  disabled={isWorking}
                  type='button'
                  onClick={() =>
                    void runAction('approve_manager', { note: form.managerNote })
                  }
                >
                  Manager approve
                </button>
              </div>
            ) : null}

            {canDirectorApprove(request, currentUser.roles) ? (
              <div className={styles.actionPanel}>
                <label className={styles.fieldWide}>
                  <span>Director signature text</span>
                  <input
                    value={form.directorSignature}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        directorSignature: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Director note</span>
                  <textarea
                    rows={2}
                    value={form.directorNote}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        directorNote: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className={styles.primaryAction}
                  disabled={isWorking}
                  type='button'
                  onClick={() =>
                    void runAction('approve_director', {
                      note:
                        form.directorNote.trim() ||
                        `Approved by ${form.directorSignature}.`,
                    })
                  }
                >
                  Director approve
                </button>
              </div>
            ) : null}

            {canFinanceProcess(request, currentUser.roles) ? (
              <div className={styles.actionPanel}>
                <label className={styles.fieldWide}>
                  <span>Payment date</span>
                  <input
                    type='date'
                    value={form.paymentDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Payment reference</span>
                  <input
                    value={form.paymentReference}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        paymentReference: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Receipt link</span>
                  <input
                    value={form.receiptLink}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        receiptLink: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.fieldWide}>
                  <span>Finance note</span>
                  <textarea
                    rows={2}
                    value={form.financeNote}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        financeNote: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className={styles.primaryAction}
                  disabled={isWorking}
                  type='button'
                  onClick={() =>
                    void runAction('process_payment', {
                      paymentDate: form.paymentDate,
                      paymentReference: form.paymentReference,
                      receiptLink: form.receiptLink,
                      note: form.financeNote,
                    })
                  }
                >
                  Finance process
                </button>
              </div>
            ) : null}

            {canCompleteOrReconcile(request, currentUser.roles, currentUser.id) ? (
              <div className={styles.actionPanel}>
                <label className={styles.fieldWide}>
                  <span>Reconciliation note</span>
                  <textarea
                    rows={2}
                    value={form.reconciliationNote}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reconciliationNote: event.target.value,
                      }))
                    }
                  />
                </label>
                {request.status === 'RECON_PENDING_CHILD_CLOSURE' ? (
                  <label className={styles.fieldWide}>
                    <span>Resolved child request IDs (comma-separated)</span>
                    <input
                      value={form.resolvedChildRequestIds}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          resolvedChildRequestIds: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}
                <button
                  className={styles.primaryAction}
                  disabled={isWorking}
                  type='button'
                  onClick={() => {
                    if (request.status === 'PROCESSED') {
                      void runAction('complete_request', {
                        note: form.reconciliationNote,
                      });
                      return;
                    }

                    if (request.status === 'RECON_PENDING_CHILD_CLOSURE') {
                      const resolvedChildRequestIds = form.resolvedChildRequestIds
                        .split(',')
                        .map((entry) => entry.trim())
                        .filter((entry) => entry.length > 0);

                      void runAction('resolve_cash_advance_children', {
                        note: form.reconciliationNote,
                        resolvedChildRequestIds,
                      });
                      return;
                    }

                    void runAction('reconcile_cash_advance', {
                      note: form.reconciliationNote,
                    });
                  }}
                >
                  {request.status === 'PROCESSED'
                    ? 'Mark complete'
                    : 'Record reconciliation outcome'}
                </button>
              </div>
            ) : null}

            <Link className={styles.secondaryAction} href={hrefWithUser('/payment-requests')}>
              Back to request list
            </Link>

            {actionMessage ? <p className={styles.helperStatus}>{actionMessage}</p> : null}
          </div>
        </div>
      </section>

      <section className={styles.layoutGrid}>
        <div className={styles.panel}>
          <h2>Queued notification previews</h2>
          <div className={styles.stack}>
            {request.notifications.map((notification) => (
              <div className={styles.timelineItem} key={notification.id}>
                <strong>{notification.subject}</strong>
                <p>{notification.body || '-'}</p>
                <span>
                  {notification.toLabel || '-'} ({notification.toEmail || '-'}) -{' '}
                  {notification.outboxPath || 'No outbox path'}
                </span>
              </div>
            ))}
            {request.notifications.length === 0 ? (
              <div className={styles.emptyState}>
                No queued notifications returned by backend payload.
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.panel}>
          <h2>Audit and activity trail</h2>
          <div className={styles.stack}>
            {request.activity.map((entry) => (
              <div className={styles.timelineItem} key={entry.id}>
                <strong>{entry.action}</strong>
                <p>{entry.detail || '-'}</p>
                <span>
                  {entry.actor || 'System'} - {entry.at || '-'}
                </span>
              </div>
            ))}
            {request.activity.length === 0 ? (
              <div className={styles.emptyState}>
                No activity entries returned by backend payload.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

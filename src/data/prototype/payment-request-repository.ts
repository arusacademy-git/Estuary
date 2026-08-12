import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { prototypeConfig } from '@/data/prototype/prototype-config';
import type { DummyUser } from '@/domain/prototype/types';
import type {
  PaymentRequestActionResult,
  PaymentRequestActivityEntry,
  PaymentRequestCreateInput,
  PaymentRequestLineItem,
  PaymentRequestLineItemInput,
  PaymentRequestNotification,
  PaymentRequestNotificationKind,
  PaymentRequestRecord,
  PaymentRequestRole,
  PaymentRequestState,
  PaymentRequestStatus,
  PaymentRequestType,
} from '@/domain/prototype/payment-request-types';

type QueuedNotificationInput = Omit<
  PaymentRequestNotification,
  'id' | 'createdAt' | 'outboxPath'
>;

type ProcessPaymentInput = {
  requestId: string;
  actorId: string;
  paymentDate: string;
  paymentReference: string;
  receiptLink: string;
  note?: string;
};

type ReconcileCashAdvanceInput = {
  requestId: string;
  actorId: string;
  note: string;
  childRequestIds?: string[];
  pendingChildRequestIds?: string[];
};

type ResolveCashAdvanceChildrenInput = {
  requestId: string;
  actorId: string;
  resolvedChildRequestIds: string[];
  note: string;
};

function runtimeRoot(): string {
  const override = process.env.ESTUARY_PROTOTYPE_RUNTIME_ROOT?.trim();
  if (override) {
    return override;
  }

  return path.join(process.cwd(), 'runtime', 'prototype');
}

function outboxRoot(): string {
  return path.join(runtimeRoot(), 'outbox');
}

function statePath(): string {
  return path.join(runtimeRoot(), 'payment-requests-state.json');
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toMoney(value: number): string {
  return value.toFixed(2);
}

function parseMoney(value: string): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function buildRequestNumber(requests: PaymentRequestRecord[]): string {
  const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const count = requests.filter((entry) =>
    entry.requestNumber.includes(today)
  ).length;
  return `PR-${today}-${String(count + 1).padStart(3, '0')}`;
}

function getUser(userId: string): DummyUser {
  const user = prototypeConfig.users.find((entry) => entry.id === userId);
  if (!user) {
    throw new Error(`Unknown user: ${userId}`);
  }

  return user;
}

function hasRole(user: DummyUser, role: PaymentRequestRole): boolean {
  return user.roles.includes(role);
}

function assertHasRole(
  user: DummyUser,
  roles: PaymentRequestRole[],
  errorMessage: string
): void {
  if (roles.some((role) => hasRole(user, role))) {
    return;
  }

  throw new Error(errorMessage);
}

function createActivity(
  actor: DummyUser,
  action: string,
  detail: string,
  at: string
): PaymentRequestActivityEntry {
  return {
    id: makeId('request-activity'),
    at,
    actorUserId: actor.id,
    actorName: actor.name,
    action,
    detail,
  };
}

function createLineItem(
  item: PaymentRequestLineItemInput,
  index: number
): PaymentRequestLineItem {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const unitAmount = Number.isFinite(item.unitAmount) ? item.unitAmount : 0;
  const taxAmount = Number.isFinite(item.taxAmount ?? 0) ? item.taxAmount ?? 0 : 0;
  const totalAmount = quantity * unitAmount + taxAmount;

  return {
    id: item.id?.trim() ? item.id : `request-line-${index + 1}`,
    description: item.description.trim(),
    accountCode: item.accountCode.trim(),
    quantity: toMoney(quantity),
    unitAmount: toMoney(unitAmount),
    taxAmount: toMoney(taxAmount),
    totalAmount: toMoney(totalAmount),
  };
}

function sumTotalAmount(lineItems: PaymentRequestLineItem[]): string {
  const total = lineItems.reduce(
    (sum, lineItem) => sum + parseMoney(lineItem.totalAmount),
    0
  );
  return toMoney(total);
}

function createSeedState(): PaymentRequestState {
  return {
    requests: [],
    notifications: [],
  };
}

function ensureTransition(
  request: PaymentRequestRecord,
  allowedStatus: PaymentRequestStatus[],
  errorMessage: string
): void {
  if (allowedStatus.includes(request.status)) {
    return;
  }

  throw new Error(errorMessage);
}

function isInvoiceOrExpense(type: PaymentRequestType): boolean {
  return type === 'INVOICE_PAYMENT' || type === 'EXPENSE_CLAIM';
}

function isTravelOrCash(type: PaymentRequestType): boolean {
  return type === 'TRAVEL_ALLOWANCE' || type === 'CASH_ADVANCE';
}

function firstManagerUserId(): string | undefined {
  return prototypeConfig.users.find((user) => user.roles.includes('MANAGER'))?.id;
}

function firstDirectorUserId(): string | undefined {
  return prototypeConfig.users.find((user) => user.roles.includes('DIRECTOR'))?.id;
}

function financeUsers(): DummyUser[] {
  return prototypeConfig.users.filter((user) => user.roles.includes('FINANCE_ADMIN'));
}

function buildNotification(
  input: QueuedNotificationInput,
  createdAt: string
): PaymentRequestNotification {
  const safeRequestId = input.requestId.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${createdAt.slice(0, 19).replaceAll(':', '-')}_${input.kind}_${safeRequestId}.json`;
  return {
    ...input,
    id: makeId('request-mail'),
    createdAt,
    outboxPath: path.join(outboxRoot(), fileName),
  };
}

function createNotificationPayload(
  kind: PaymentRequestNotificationKind,
  request: PaymentRequestRecord,
  toUser: DummyUser,
  actionText: string
): QueuedNotificationInput {
  return {
    requestId: request.id,
    kind,
    toUserId: toUser.id,
    toLabel: toUser.name,
    toEmail: toUser.email,
    subject: `[Estuary] ${request.requestNumber} ${actionText}`,
    body:
      `${request.requestNumber} (${request.type}) - ${request.title}\n\n` +
      `Status: ${request.status}\n` +
      `Amount: ${request.totalAmount} ${request.currency}\n` +
      `Submitter: ${request.submitterName}\n` +
      `Payee: ${request.payeeName}\n` +
      `Request: /payment-requests/${request.id}?user=${toUser.id}`,
  };
}

async function ensureRuntime(): Promise<void> {
  await mkdir(runtimeRoot(), { recursive: true });
  await mkdir(outboxRoot(), { recursive: true });
}

async function writeState(state: PaymentRequestState): Promise<void> {
  await ensureRuntime();
  await writeFile(statePath(), JSON.stringify(state, null, 2), 'utf8');
}

async function writeNotificationOutbox(
  notifications: PaymentRequestNotification[]
): Promise<void> {
  await Promise.all(
    notifications.map((notification) =>
      writeFile(notification.outboxPath, JSON.stringify(notification, null, 2), 'utf8')
    )
  );
}

export async function getPaymentRequestState(): Promise<PaymentRequestState> {
  await ensureRuntime();

  try {
    const raw = await readFile(statePath(), 'utf8');
    return JSON.parse(raw) as PaymentRequestState;
  } catch {
    const seeded = createSeedState();
    await writeState(seeded);
    return seeded;
  }
}

async function commitState(
  state: PaymentRequestState,
  notifications: PaymentRequestNotification[] = []
): Promise<PaymentRequestActionResult> {
  await writeState(state);
  if (notifications.length > 0) {
    await writeNotificationOutbox(notifications);
  }

  return {
    state,
    notifications,
  };
}

function attachChildrenToParent(
  requests: PaymentRequestRecord[],
  parentRequestId: string,
  childIds: string[]
): PaymentRequestRecord[] {
  if (childIds.length === 0) {
    return requests;
  }

  return requests.map((entry) => {
    if (!childIds.includes(entry.id)) {
      return entry;
    }

    return {
      ...entry,
      parentRequestId,
      updatedAt: nowIso(),
    };
  });
}

export async function createPaymentRequest(
  input: PaymentRequestCreateInput
): Promise<PaymentRequestActionResult> {
  const actor = getUser(input.actorId);
  const state = await getPaymentRequestState();
  const createdAt = nowIso();
  const lineItems = input.lineItems.map(createLineItem);
  if (lineItems.length === 0) {
    throw new Error('At least one line item is required.');
  }

  const request: PaymentRequestRecord = {
    id: makeId('request'),
    requestNumber: buildRequestNumber(state.requests),
    type: input.type,
    title: input.title.trim(),
    submitterId: actor.id,
    submitterName: actor.name,
    payeeName: input.payeeName.trim(),
    currency: input.currency?.trim() || 'MYR',
    status: 'DRAFT',
    lineItems,
    totalAmount: sumTotalAmount(lineItems),
    notes: input.notes?.trim() || '',
    managerApproverId: input.managerApproverId,
    directorApproverId: input.directorApproverId,
    currentApproverId: undefined,
    parentRequestId: input.parentRequestId,
    childRequestIds: input.childRequestIds ?? [],
    createdAt,
    updatedAt: createdAt,
    activity: [
      createActivity(actor, 'Created payment request', 'Request saved as draft.', createdAt),
    ],
  };

  const nextState = {
    ...state,
    requests: [request, ...state.requests],
  };

  const result = await commitState(nextState);
  return { ...result, request };
}

export async function submitPaymentRequest(
  requestId: string,
  actorId: string
): Promise<PaymentRequestActionResult> {
  const state = await getPaymentRequestState();
  const actor = getUser(actorId);
  const submittedAt = nowIso();
  const queuedInputs: QueuedNotificationInput[] = [];
  let updatedRequest: PaymentRequestRecord | undefined;

  const requests = state.requests.map((request) => {
    if (request.id !== requestId) {
      return request;
    }

    if (request.submitterId !== actorId) {
      throw new Error('Only the submitter can submit this payment request.');
    }

    ensureTransition(
      request,
      ['DRAFT'],
      'Only draft payment requests can be submitted.'
    );

    if (isInvoiceOrExpense(request.type)) {
      updatedRequest = {
        ...request,
        status: 'PENDING_PAYMENT',
        updatedAt: submittedAt,
        currentApproverId: undefined,
        activity: [
          createActivity(actor, 'Submitted request', 'Sent to finance queue.', submittedAt),
          ...request.activity,
        ],
      };

      for (const financeUser of financeUsers()) {
        queuedInputs.push(
          createNotificationPayload(
            'finance_payment_requested',
            updatedRequest,
            financeUser,
            'is ready for finance processing'
          )
        );
      }

      return updatedRequest;
    }

    if (isTravelOrCash(request.type)) {
      const managerId = request.managerApproverId ?? firstManagerUserId();
      if (!managerId) {
        throw new Error('No manager is configured for approval routing.');
      }
      const managerUser = getUser(managerId);

      updatedRequest = {
        ...request,
        status: 'PENDING_MANAGER_APPROVAL',
        managerApproverId: managerId,
        currentApproverId: managerId,
        updatedAt: submittedAt,
        activity: [
          createActivity(
            actor,
            'Submitted request',
            `Sent to manager approval: ${managerUser.name}.`,
            submittedAt
          ),
          ...request.activity,
        ],
      };

      queuedInputs.push(
        createNotificationPayload(
          'manager_approval_requested',
          updatedRequest,
          managerUser,
          'needs manager approval'
        )
      );

      return updatedRequest;
    }

    return request;
  });

  if (!updatedRequest) {
    throw new Error('Payment request not found.');
  }

  const notifications = queuedInputs.map((entry) =>
    buildNotification(entry, submittedAt)
  );
  const nextState = {
    ...state,
    requests,
    notifications: [...notifications, ...state.notifications],
  };
  const result = await commitState(nextState, notifications);
  return { ...result, request: updatedRequest };
}

export async function approveManagerPaymentRequest(
  requestId: string,
  actorId: string,
  note: string
): Promise<PaymentRequestActionResult> {
  const state = await getPaymentRequestState();
  const actor = getUser(actorId);
  assertHasRole(
    actor,
    ['MANAGER', 'DIRECTOR'],
    'Only manager/director roles can perform manager approval.'
  );
  const approvedAt = nowIso();
  let updatedRequest: PaymentRequestRecord | undefined;
  const queuedInputs: QueuedNotificationInput[] = [];

  const requests = state.requests.map((request) => {
    if (request.id !== requestId) {
      return request;
    }

    ensureTransition(
      request,
      ['PENDING_MANAGER_APPROVAL'],
      'Request is not pending manager approval.'
    );
    if (!isTravelOrCash(request.type)) {
      throw new Error('Manager approval is only valid for travel allowance/cash advance.');
    }

    const directorId = request.directorApproverId ?? firstDirectorUserId();
    if (!directorId) {
      throw new Error('No director is configured for approval routing.');
    }
    const directorUser = getUser(directorId);

    updatedRequest = {
      ...request,
      status: 'PENDING_DIRECTOR_APPROVAL',
      directorApproverId: directorId,
      currentApproverId: directorId,
      updatedAt: approvedAt,
      activity: [
        createActivity(
          actor,
          'Manager approved',
          note.trim() || 'Escalated to director approval.',
          approvedAt
        ),
        ...request.activity,
      ],
    };

    queuedInputs.push(
      createNotificationPayload(
        'director_approval_requested',
        updatedRequest,
        directorUser,
        'needs director approval'
      )
    );

    return updatedRequest;
  });

  if (!updatedRequest) {
    throw new Error('Payment request not found.');
  }

  const notifications = queuedInputs.map((entry) =>
    buildNotification(entry, approvedAt)
  );
  const nextState = {
    ...state,
    requests,
    notifications: [...notifications, ...state.notifications],
  };
  const result = await commitState(nextState, notifications);
  return { ...result, request: updatedRequest };
}

export async function approveDirectorPaymentRequest(
  requestId: string,
  actorId: string,
  note: string
): Promise<PaymentRequestActionResult> {
  const state = await getPaymentRequestState();
  const actor = getUser(actorId);
  assertHasRole(actor, ['DIRECTOR'], 'Only directors can approve this request.');
  const approvedAt = nowIso();
  let updatedRequest: PaymentRequestRecord | undefined;
  const queuedInputs: QueuedNotificationInput[] = [];

  const requests = state.requests.map((request) => {
    if (request.id !== requestId) {
      return request;
    }

    ensureTransition(
      request,
      ['PENDING_DIRECTOR_APPROVAL'],
      'Request is not pending director approval.'
    );
    if (!isTravelOrCash(request.type)) {
      throw new Error('Director approval is only valid for travel allowance/cash advance.');
    }

    updatedRequest = {
      ...request,
      status: 'APPROVED_PENDING_PAYMENT',
      currentApproverId: undefined,
      directorApproverId: actor.id,
      updatedAt: approvedAt,
      activity: [
        createActivity(
          actor,
          'Director approved',
          note.trim() || 'Approved and moved to finance queue.',
          approvedAt
        ),
        ...request.activity,
      ],
    };

    for (const financeUser of financeUsers()) {
      queuedInputs.push(
        createNotificationPayload(
          'finance_payment_requested',
          updatedRequest,
          financeUser,
          'is approved and ready for finance processing'
        )
      );
    }

    return updatedRequest;
  });

  if (!updatedRequest) {
    throw new Error('Payment request not found.');
  }

  const notifications = queuedInputs.map((entry) =>
    buildNotification(entry, approvedAt)
  );
  const nextState = {
    ...state,
    requests,
    notifications: [...notifications, ...state.notifications],
  };
  const result = await commitState(nextState, notifications);
  return { ...result, request: updatedRequest };
}

export async function processPaymentRequest(
  input: ProcessPaymentInput
): Promise<PaymentRequestActionResult> {
  const state = await getPaymentRequestState();
  const actor = getUser(input.actorId);
  assertHasRole(
    actor,
    ['FINANCE_ADMIN'],
    'Only finance admin users can process payment requests.'
  );
  const processedAt = nowIso();
  let updatedRequest: PaymentRequestRecord | undefined;
  const queuedInputs: QueuedNotificationInput[] = [];

  const requests = state.requests.map((request) => {
    if (request.id !== input.requestId) {
      return request;
    }

    const allowed: PaymentRequestStatus[] = isInvoiceOrExpense(request.type)
      ? ['PENDING_PAYMENT']
      : ['APPROVED_PENDING_PAYMENT'];
    ensureTransition(request, allowed, 'Request is not ready for finance processing.');

    const nextStatus: PaymentRequestStatus = isInvoiceOrExpense(request.type)
      ? 'PROCESSED'
      : 'PROCESSED_PENDING_RECONCILIATION';

    updatedRequest = {
      ...request,
      status: nextStatus,
      paymentDate: input.paymentDate,
      paymentReference: input.paymentReference,
      receiptLink: input.receiptLink,
      processedAt,
      processedByUserId: actor.id,
      processedByName: actor.name,
      updatedAt: processedAt,
      activity: [
        createActivity(
          actor,
          'Finance processed payment',
          input.note?.trim() || `Payment reference ${input.paymentReference}.`,
          processedAt
        ),
        ...request.activity,
      ],
    };

    const submitter = getUser(request.submitterId);
    if (isInvoiceOrExpense(request.type)) {
      queuedInputs.push(
        createNotificationPayload(
          'submitter_processed_notice',
          updatedRequest,
          submitter,
          'was processed by finance'
        )
      );
    } else {
      queuedInputs.push(
        createNotificationPayload(
          'cash_reconciliation_requested',
          updatedRequest,
          submitter,
          'is paid and pending reconciliation'
        )
      );
    }

    return updatedRequest;
  });

  if (!updatedRequest) {
    throw new Error('Payment request not found.');
  }

  const notifications = queuedInputs.map((entry) =>
    buildNotification(entry, processedAt)
  );
  const nextState = {
    ...state,
    requests,
    notifications: [...notifications, ...state.notifications],
  };
  const result = await commitState(nextState, notifications);
  return { ...result, request: updatedRequest };
}

export async function completePaymentRequest(
  requestId: string,
  actorId: string,
  note: string
): Promise<PaymentRequestActionResult> {
  const state = await getPaymentRequestState();
  const actor = getUser(actorId);
  assertHasRole(
    actor,
    ['FINANCE_ADMIN'],
    'Only finance admin users can complete payment requests.'
  );
  const completedAt = nowIso();
  let updatedRequest: PaymentRequestRecord | undefined;

  const requests = state.requests.map((request) => {
    if (request.id !== requestId) {
      return request;
    }

    if (!isInvoiceOrExpense(request.type)) {
      throw new Error('Only invoice/expense requests can be marked complete.');
    }

    ensureTransition(
      request,
      ['PROCESSED'],
      'Only processed invoice/expense requests can be marked complete.'
    );

    updatedRequest = {
      ...request,
      status: 'COMPLETE',
      updatedAt: completedAt,
      activity: [
        createActivity(
          actor,
          'Completed request',
          note.trim() || 'Finance close-out completed.',
          completedAt
        ),
        ...request.activity,
      ],
    };

    return updatedRequest;
  });

  if (!updatedRequest) {
    throw new Error('Payment request not found.');
  }

  const nextState = {
    ...state,
    requests,
  };
  const result = await commitState(nextState);
  return { ...result, request: updatedRequest };
}

export async function reconcileCashAdvance(
  input: ReconcileCashAdvanceInput
): Promise<PaymentRequestActionResult> {
  const state = await getPaymentRequestState();
  const actor = getUser(input.actorId);
  const reconciledAt = nowIso();
  let updatedRequest: PaymentRequestRecord | undefined;
  const queuedInputs: QueuedNotificationInput[] = [];

  const requests = state.requests.map((request) => {
    if (request.id !== input.requestId) {
      return request;
    }

    if (request.type !== 'CASH_ADVANCE') {
      throw new Error('Reconciliation actions are only valid for cash advance requests.');
    }

    const actorCanReconcile =
      request.submitterId === actor.id || hasRole(actor, 'FINANCE_ADMIN');
    if (!actorCanReconcile) {
      throw new Error('Only submitter or finance admin can reconcile this cash advance.');
    }

    ensureTransition(
      request,
      ['PROCESSED_PENDING_RECONCILIATION', 'RECON_PENDING_CHILD_CLOSURE'],
      'Cash advance is not in a reconciliation state.'
    );

    const childRequestIds = input.childRequestIds ?? request.childRequestIds;
    const pendingChildRequestIds = input.pendingChildRequestIds ?? [];
    const nextStatus: PaymentRequestStatus =
      pendingChildRequestIds.length === 0
        ? 'CLOSED'
        : 'RECON_PENDING_CHILD_CLOSURE';

    updatedRequest = {
      ...request,
      status: nextStatus,
      childRequestIds,
      updatedAt: reconciledAt,
      reconciliation: {
        reconciledAt,
        reconciledByUserId: actor.id,
        reconciledByName: actor.name,
        note: input.note,
        childRequestIds,
        pendingChildRequestIds,
      },
      activity: [
        createActivity(
          actor,
          'Reconciled cash advance',
          input.note.trim() || 'Reconciliation details recorded.',
          reconciledAt
        ),
        ...request.activity,
      ],
    };

    for (const financeUser of financeUsers()) {
      queuedInputs.push(
        createNotificationPayload(
          nextStatus === 'CLOSED'
            ? 'cash_reconciliation_closed'
            : 'cash_reconciliation_requested',
          updatedRequest,
          financeUser,
          nextStatus === 'CLOSED'
            ? 'reconciliation is closed'
            : 'reconciliation is pending child closure'
        )
      );
    }

    return updatedRequest;
  });

  if (!updatedRequest) {
    throw new Error('Payment request not found.');
  }

  const withChildLinks = attachChildrenToParent(
    requests,
    updatedRequest.id,
    updatedRequest.childRequestIds
  );
  const notifications = queuedInputs.map((entry) =>
    buildNotification(entry, reconciledAt)
  );
  const nextState = {
    ...state,
    requests: withChildLinks,
    notifications: [...notifications, ...state.notifications],
  };
  const result = await commitState(nextState, notifications);
  const request = withChildLinks.find((entry) => entry.id === updatedRequest?.id);
  return { ...result, request };
}

export async function resolveCashAdvanceChildren(
  input: ResolveCashAdvanceChildrenInput
): Promise<PaymentRequestActionResult> {
  const state = await getPaymentRequestState();
  const actor = getUser(input.actorId);
  assertHasRole(
    actor,
    ['FINANCE_ADMIN', 'DIRECTOR'],
    'Only finance admin/director can close child reconciliation.'
  );
  const resolvedAt = nowIso();
  let updatedRequest: PaymentRequestRecord | undefined;
  const queuedInputs: QueuedNotificationInput[] = [];

  const requests = state.requests.map((request) => {
    if (request.id !== input.requestId) {
      return request;
    }

    if (request.type !== 'CASH_ADVANCE') {
      throw new Error('Child reconciliation closure is only valid for cash advance.');
    }

    ensureTransition(
      request,
      ['RECON_PENDING_CHILD_CLOSURE'],
      'Cash advance is not waiting for child closure.'
    );

    const pending = request.reconciliation?.pendingChildRequestIds ?? [];
    const resolvedSet = new Set(input.resolvedChildRequestIds);
    const remainingPending = pending.filter((childId) => !resolvedSet.has(childId));
    const nextStatus: PaymentRequestStatus =
      remainingPending.length === 0 ? 'CLOSED' : 'RECON_PENDING_CHILD_CLOSURE';

    updatedRequest = {
      ...request,
      status: nextStatus,
      updatedAt: resolvedAt,
      reconciliation: {
        reconciledAt: resolvedAt,
        reconciledByUserId: actor.id,
        reconciledByName: actor.name,
        note: input.note,
        childRequestIds: request.reconciliation?.childRequestIds ?? request.childRequestIds,
        pendingChildRequestIds: remainingPending,
      },
      activity: [
        createActivity(
          actor,
          'Updated child reconciliation',
          input.note.trim() || 'Child reconciliation state updated.',
          resolvedAt
        ),
        ...request.activity,
      ],
    };

    if (nextStatus === 'CLOSED') {
      const submitter = getUser(request.submitterId);
      queuedInputs.push(
        createNotificationPayload(
          'cash_reconciliation_closed',
          updatedRequest,
          submitter,
          'reconciliation is closed'
        )
      );
      for (const financeUser of financeUsers()) {
        queuedInputs.push(
          createNotificationPayload(
            'cash_reconciliation_closed',
            updatedRequest,
            financeUser,
            'reconciliation is closed'
          )
        );
      }
    }

    return updatedRequest;
  });

  if (!updatedRequest) {
    throw new Error('Payment request not found.');
  }

  const notifications = queuedInputs.map((entry) =>
    buildNotification(entry, resolvedAt)
  );
  const nextState = {
    ...state,
    requests,
    notifications: [...notifications, ...state.notifications],
  };
  const result = await commitState(nextState, notifications);
  return { ...result, request: updatedRequest };
}

export async function getPaymentRequestById(
  requestId: string
): Promise<PaymentRequestRecord | undefined> {
  const state = await getPaymentRequestState();
  return state.requests.find((request) => request.id === requestId);
}

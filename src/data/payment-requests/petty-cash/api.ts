import type {
  CreatePettyCashInput,
  PettyCashFinanceInput,
  PettyCashLedgerSummary,
  PettyCashLocation,
  PettyCashRecord,
  PettyCashRole,
} from '@/domain/payment-requests/petty-cash/types';

type Envelope<T> = { data?: T; message?: string };

async function read<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok) throw new Error(body?.message ?? `Petty Cash request failed (${response.status}).`);
  if (!body || body.data === undefined) throw new Error('The Petty Cash API returned no data.');
  return body.data;
}

async function action(id: string, route: string, body: unknown) {
  const response = await fetch(
    `/api/v1/payment-requests/petty-cash/${encodeURIComponent(id)}/${route}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  return read<PettyCashRecord>(response);
}

export async function createPettyCashRequest(input: CreatePettyCashInput) {
  const response = await fetch('/api/v1/payment-requests/petty-cash', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return read<PettyCashRecord>(response);
}

export async function fetchPettyCashRequests(scope: {
  role: PettyCashRole;
  userId: string;
  month?: string;
  includeAll?: boolean;
}) {
  const query = new URLSearchParams({ role: scope.role, userId: scope.userId });
  if (scope.month) query.set('month', scope.month);
  if (scope.includeAll) query.set('includeAll', '1');
  return read<PettyCashRecord[]>(await fetch(
    `/api/v1/payment-requests/petty-cash?${query}`,
    { cache: 'no-store' },
  ));
}

export async function fetchPettyCashRequest(id: string) {
  return read<PettyCashRecord>(await fetch(
    `/api/v1/payment-requests/petty-cash/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  ));
}

export const approvePettyCashByManager = (id: string, managerId: string) =>
  action(id, 'manager-approve', { managerId });
export const returnPettyCashByManager = (id: string, managerId: string, reason: string) =>
  action(id, 'manager-return', { managerId, reason });
export const approvePettyCashByDirector = (id: string, directorId: string) =>
  action(id, 'director-approve', { directorId });
export const reviewPettyCashByFinancePeer = (id: string, reviewerId: string) =>
  action(id, 'finance-review', { reviewerId });
export const returnPettyCashByDirector = (id: string, directorId: string, reason: string) =>
  action(id, 'director-return', { directorId, reason });
export const returnPettyCashByFinance = (id: string, financeId: string, reason: string) =>
  action(id, 'finance-return', { financeId, reason });
export const verifyPettyCashByFinance = (id: string, input: PettyCashFinanceInput) =>
  action(id, 'finance-verify', input);
export const markPettyCashPaid = (id: string, financeId: string) =>
  action(id, 'mark-paid', { financeId });
export const resubmitPettyCashRequest = (id: string, input: CreatePettyCashInput) =>
  action(id, 'resubmit', input);

export async function fetchPettyCashLedger(input: {
  organizationId: string;
  month: string;
  location?: PettyCashLocation;
}) {
  const query = new URLSearchParams({ organizationId: input.organizationId, month: input.month });
  if (input.location) query.set('location', input.location);
  return read<PettyCashLedgerSummary[]>(await fetch(
    `/api/v1/payment-requests/petty-cash/ledger?${query}`,
    { cache: 'no-store' },
  ));
}

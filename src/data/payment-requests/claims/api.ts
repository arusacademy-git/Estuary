import type {
  ClaimPolicyContext,
  ClaimFinanceInput,
  ClaimRecord,
  CreateClaimInput,
} from '@/domain/payment-requests/claims/types';

type Envelope<T> = { data?: T; message?: string };

const claimListCache = new Map<string, {
  expiresAt: number;
  promise: Promise<ClaimRecord[]>;
}>();
const CLAIM_LIST_CACHE_MS = 2 * 60 * 1000;

function invalidateClaimLists() {
  claimListCache.clear();
}

async function read<T>(response: Response) {
  const body = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok) throw new Error(body?.message ?? `Claims request failed (${response.status}).`);
  if (!body || body.data === undefined) throw new Error('The Claims API returned no data.');
  return body.data;
}

async function writeClaim(input: CreateClaimInput, receiptFiles: Record<string, File>, mode: 'draft' | 'submit', claimId?: string) {
  const form = new FormData();
  form.set('payload', JSON.stringify(input));
  form.set('mode', mode);
  if (claimId) form.set('claimId', claimId);
  input.lines.forEach((line) => {
    const file = receiptFiles[line.id];
    if (file) form.set(`receipt:${line.id}`, file, file.name);
  });
  const record = await read<ClaimRecord>(await fetch('/api/v1/payment-requests/claims', {
    method: 'POST',
    body: form,
  }));
  invalidateClaimLists();
  return record;
}

export const createClaimRequest = (input: CreateClaimInput, receiptFiles: Record<string, File>) => writeClaim(input, receiptFiles, 'submit');
export const saveClaimDraft = (input: CreateClaimInput, receiptFiles: Record<string, File>, claimId?: string) => writeClaim(input, receiptFiles, 'draft', claimId);
export const submitClaimDraft = (claimId: string, input: CreateClaimInput, receiptFiles: Record<string, File>) => writeClaim(input, receiptFiles, 'submit', claimId);

export async function fetchClaimPolicyContext(input: {
  organizationId: string;
  requesterId: string;
  claimDate: string;
}) {
  const query = new URLSearchParams(input);
  return read<ClaimPolicyContext>(await fetch(
    `/api/v1/payment-requests/claims?${query}`,
    { cache: 'no-store' },
  ));
}

export async function fetchClaimRequests(input: { role: string; userId: string }) {
  const query = new URLSearchParams(input);
  const key = query.toString();
  const cached = claimListCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetch(`/api/v1/payment-requests/claims?${query}`, { cache: 'no-store' })
    .then((response) => read<ClaimRecord[]>(response));
  claimListCache.set(key, { expiresAt: Date.now() + CLAIM_LIST_CACHE_MS, promise });

  try {
    return await promise;
  } catch (error) {
    if (claimListCache.get(key)?.promise === promise) claimListCache.delete(key);
    throw error;
  }
}

export async function fetchClaimRequest(id: string) {
  return read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}`, { cache: 'no-store' }));
}

export async function approveClaimByManager(id: string, managerId: string) {
  const record = await read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}/manager-approve`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ managerId }),
  }));
  invalidateClaimLists();
  return record;
}

export async function returnClaimByManager(id: string, managerId: string, reason: string) {
  return read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}/manager-return`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ managerId, reason }),
  }));
}

export async function forwardClaimByDirector(id: string, directorId: string) {
  const record = await read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}/director-forward`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ directorId }),
  }));
  invalidateClaimLists();
  return record;
}

export async function returnClaimByDirector(id: string, directorId: string, reason: string) {
  return read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}/director-return`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ directorId, reason }),
  }));
}

export async function processClaimByFinance(id: string, financeId: string, input: ClaimFinanceInput) {
  return read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}/finance-process`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ financeId, ...input }),
  }));
}

export async function returnClaimByFinance(id: string, financeId: string, reason: string) {
  return read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}/finance-return`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ financeId, reason }),
  }));
}

import type {
  ClaimPolicyContext,
  ClaimFinanceInput,
  ClaimRecord,
  CreateClaimInput,
} from '@/domain/payment-requests/claims/types';

type Envelope<T> = { data?: T; message?: string };

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
  return read<ClaimRecord>(await fetch('/api/v1/payment-requests/claims', {
    method: 'POST',
    body: form,
  }));
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
  return read<ClaimRecord[]>(await fetch(`/api/v1/payment-requests/claims?${query}`, { cache: 'no-store' }));
}

export async function fetchClaimRequest(id: string) {
  return read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}`, { cache: 'no-store' }));
}

export async function approveClaimByManager(id: string, managerId: string) {
  return read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}/manager-approve`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ managerId }),
  }));
}

export async function returnClaimByManager(id: string, managerId: string, reason: string) {
  return read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}/manager-return`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ managerId, reason }),
  }));
}

export async function forwardClaimByDirector(id: string, directorId: string) {
  return read<ClaimRecord>(await fetch(`/api/v1/payment-requests/claims/${encodeURIComponent(id)}/director-forward`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ directorId }),
  }));
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

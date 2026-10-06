import type {
  CreateTravelAllowanceInput,
  TravelAllowanceRecord,
} from '@/domain/payment-requests/travel-allowance/types';

type Envelope<T> = { data?: T; message?: string };

async function read<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok) {
    throw new Error(body?.message ?? `Travel Allowance request failed (${response.status}).`);
  }
  if (!body || body.data === undefined) {
    throw new Error('The Travel Allowance API returned no data.');
  }
  return body.data;
}

export async function createTravelAllowance(input: CreateTravelAllowanceInput) {
  const response = await fetch('/api/v1/payment-requests/travel-allowance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return read<TravelAllowanceRecord>(response);
}

export async function resubmitTravelAllowance(id: string, input: CreateTravelAllowanceInput) {
  return read<TravelAllowanceRecord>(await fetch(`/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }));
}

export async function fetchTravelAllowances(scope?: { role: 'staff' | 'manager' | 'director' | 'finance'; userId: string; month?: string; includeAll?: boolean }) {
  const query = scope
    ? `?role=${encodeURIComponent(scope.role)}&userId=${encodeURIComponent(scope.userId)}${scope.month ? `&month=${encodeURIComponent(scope.month)}` : ''}${scope.includeAll ? '&includeAll=1' : ''}`
    : '';
  const response = await fetch(`/api/v1/payment-requests/travel-allowance${query}`, { cache: 'no-store' });
  return read<TravelAllowanceRecord[]>(response);
}

export async function reviewTravelAllowanceByManager(id: string, managerId: string) {
  const response = await fetch(
    `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}/manager-review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId }),
    },
  );
  return read<TravelAllowanceRecord>(response);
}

export async function returnTravelAllowanceByManager(
  id: string,
  managerId: string,
  reason: string,
) {
  const response = await fetch(
    `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}/manager-return`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId, reason }),
    },
  );
  return read<TravelAllowanceRecord>(response);
}

export async function approveTravelAllowanceByDirector(id: string, directorId: string) {
  const response = await fetch(
    `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}/director-approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directorId }),
    },
  );
  return read<TravelAllowanceRecord>(response);
}

export async function returnTravelAllowanceByDirector(
  id: string,
  directorId: string,
  reason: string,
) {
  const response = await fetch(
    `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}/director-return`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directorId, reason }),
    },
  );
  return read<TravelAllowanceRecord>(response);
}

export async function completeTravelAllowanceByFinance(
  id: string,
  financeId: string,
  paymentDate: string,
  paymentReference: string,
  remarks?: string,
) {
  const response = await fetch(
    `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}/finance-complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financeId, paymentDate, paymentReference, remarks }),
    },
  );
  return read<TravelAllowanceRecord>(response);
}

export async function returnTravelAllowanceByFinance(
  id: string,
  financeId: string,
  reason: string,
) {
  const response = await fetch(
    `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}/finance-return`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financeId, reason }),
    },
  );
  return read<TravelAllowanceRecord>(response);
}

export async function fetchTravelAllowance(id: string) {
  const response = await fetch(
    `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  return read<TravelAllowanceRecord>(response);
}
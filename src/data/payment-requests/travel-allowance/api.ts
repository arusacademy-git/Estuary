import type {
  CreateTravelAllowanceInput,
  TravelAllowanceRecord,
} from '@/domain/payment-requests/travel-allowance/types';

type Envelope<T> = { data?: T; message?: string };

const travelAllowanceListCache = new Map<string, { expiresAt: number; promise: Promise<TravelAllowanceRecord[]> }>();
const TRAVEL_ALLOWANCE_LIST_CACHE_MS = 2 * 60 * 1000;

function invalidateTravelAllowanceLists() {
  travelAllowanceListCache.clear();
}

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
  const record = await read<TravelAllowanceRecord>(response);
  invalidateTravelAllowanceLists();
  return record;
}

export async function resubmitTravelAllowance(id: string, input: CreateTravelAllowanceInput) {
  const record = await read<TravelAllowanceRecord>(await fetch(`/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }));
  invalidateTravelAllowanceLists();
  return record;
}

export async function fetchTravelAllowances(scope?: { role: 'staff' | 'manager' | 'director' | 'finance'; userId: string; month?: string; includeAll?: boolean; approvalOnly?: boolean }) {
  const query = scope
    ? `?role=${encodeURIComponent(scope.role)}&userId=${encodeURIComponent(scope.userId)}${scope.month ? `&month=${encodeURIComponent(scope.month)}` : ''}${scope.includeAll ? '&includeAll=1' : ''}${scope.approvalOnly ? '&approvalOnly=1' : ''}`
    : '';
  const cached = travelAllowanceListCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = fetch(`/api/v1/payment-requests/travel-allowance${query}`, { cache: 'no-store' })
    .then(async (response) => {
      const records = await read<TravelAllowanceRecord[]>(response);
      if (scope && !scope.approvalOnly && !scope.includeAll && !scope.month && (scope.role === 'manager' || scope.role === 'director')) {
        const status = scope.role === 'manager' ? 'PENDING_MANAGER_REVIEW' : 'PENDING_DIRECTOR_APPROVAL';
        const assigned = records.filter((record) => record.status === status && (
          scope.role === 'manager' ? record.managerApproverId === scope.userId : record.projectDirectorId === scope.userId
        ));
        travelAllowanceListCache.set(`${query}&approvalOnly=1`, {
          expiresAt: Date.now() + TRAVEL_ALLOWANCE_LIST_CACHE_MS,
          promise: Promise.resolve(assigned),
        });
      }
      return records;
    });
  travelAllowanceListCache.set(query, { expiresAt: Date.now() + TRAVEL_ALLOWANCE_LIST_CACHE_MS, promise });
  try {
    return await promise;
  } catch (error) {
    if (travelAllowanceListCache.get(query)?.promise === promise) travelAllowanceListCache.delete(query);
    throw error;
  }
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
  const record = await read<TravelAllowanceRecord>(response);
  invalidateTravelAllowanceLists();
  return record;
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
  const record = await read<TravelAllowanceRecord>(response);
  invalidateTravelAllowanceLists();
  return record;
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
  const record = await read<TravelAllowanceRecord>(response);
  invalidateTravelAllowanceLists();
  return record;
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
  const record = await read<TravelAllowanceRecord>(response);
  invalidateTravelAllowanceLists();
  return record;
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
  const record = await read<TravelAllowanceRecord>(response);
  invalidateTravelAllowanceLists();
  return record;
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
  const record = await read<TravelAllowanceRecord>(response);
  invalidateTravelAllowanceLists();
  return record;
}

export async function fetchTravelAllowance(id: string) {
  const response = await fetch(
    `/api/v1/payment-requests/travel-allowance/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  return read<TravelAllowanceRecord>(response);
}

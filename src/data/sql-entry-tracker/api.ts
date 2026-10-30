import type {
  SqlEntryStatus,
  SqlEntryTrackingEntry,
} from '@/domain/sql-entry-tracker/types';

type Envelope<T> = { data?: T; message?: string };

async function read<T>(response: Response) {
  const body = await response.json().catch(() => null) as Envelope<T> | null;
  if (!response.ok) throw new Error(body?.message ?? `SQL Entry Tracker request failed (${response.status}).`);
  if (!body || body.data === undefined) throw new Error('The SQL Entry Tracker API returned no data.');
  return body.data;
}

export async function fetchSqlEntryTracking(userId: string) {
  const query = new URLSearchParams({ role: 'finance', userId });
  return read<SqlEntryTrackingEntry[]>(await fetch(
    `/api/v1/sql-entry-tracking?${query}`,
    { cache: 'no-store' },
  ));
}

export async function saveSqlEntryTracking(input: {
  userId: string;
  submissionId: string;
  status: SqlEntryStatus;
  sqlReference: string;
  recordedAt: string;
  notes: string;
}) {
  return read<SqlEntryTrackingEntry>(await fetch('/api/v1/sql-entry-tracking', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }));
}

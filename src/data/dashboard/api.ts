import type { DashboardSummaryRecord } from '@/domain/dashboard/types';

type Envelope<T> = { data?: T; message?: string };

export async function fetchDashboardSummary(input: {
  role: 'staff' | 'manager' | 'director' | 'finance';
  userId: string;
  view?: 'ROLE' | 'ORGANIZATION_COMPLETED';
}) {
  const query = new URLSearchParams({ role: input.role, userId: input.userId });
  if (input.view) query.set('view', input.view);
  const response = await fetch(`/api/v1/dashboard/records?${query}`, {
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null) as Envelope<DashboardSummaryRecord[]> | null;
  if (!response.ok) throw new Error(body?.message ?? `Dashboard summary failed (${response.status}).`);
  return body?.data ?? [];
}

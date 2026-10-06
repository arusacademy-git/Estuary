import type {
    CashAdvanceReconciliationInput,
    CashAdvanceRecord,
    CashAdvanceRole,
    CreateCashAdvanceInput,
} from '@/domain/payment-requests/cash-advance/types';

type Envelope<T> = { data?: T; message?: string };

async function read<T>(response: Response) {
    const body = (await response.json().catch(() => null)) as Envelope<T> | null;
    if (!response.ok) throw new Error(body?.message ?? `Cash Advance request failed (${response.status}).`);
    if (!body || body.data === undefined) throw new Error('The Cash Advance API returned no data.');
    return body.data;
}

async function action(id: string, route: string, body: unknown) {
    const response = await fetch(
        `/api/v1/payment-requests/cash-advance/${encodeURIComponent(id)}/${route}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    return read<CashAdvanceRecord>(response);
}

export async function createCashAdvance(input: CreateCashAdvanceInput) {
    const response = await fetch('/api/v1/payment-requests/cash-advance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    return read<CashAdvanceRecord>(response);
}

export async function fetchCashAdvances(scope: { role: CashAdvanceRole; userId: string; month?: string; includeAll?: boolean }) {
    const query = new URLSearchParams({ role: scope.role, userId: scope.userId });
    if (scope.month) query.set('month', scope.month);
    if (scope.includeAll) query.set('includeAll', '1');
    const response = await fetch(`/api/v1/payment-requests/cash-advance?${query}`, { cache: 'no-store' });
    return read<CashAdvanceRecord[]>(response);
}

export async function fetchCashAdvance(id: string) {
    const response = await fetch(`/api/v1/payment-requests/cash-advance/${encodeURIComponent(id)}`, { cache: 'no-store' });
    return read<CashAdvanceRecord>(response);
}

export const approveCashAdvanceByManager = (id: string, managerId: string, signatureKey: string) =>
    action(id, 'manager-approve', { managerId, signatureKey });
export const returnCashAdvanceByManager = (id: string, managerId: string, reason: string) =>
    action(id, 'manager-return', { managerId, reason });
export const approveCashAdvanceByDirector = (id: string, directorId: string, signatureKey: string) =>
    action(id, 'director-approve', { directorId, signatureKey });
export const returnCashAdvanceByDirector = (id: string, directorId: string, reason: string) =>
    action(id, 'director-return', { directorId, reason });
export const payCashAdvanceByFinance = (id: string, financeId: string, paymentDate: string, paymentReference: string) =>
    action(id, 'finance-pay', { financeId, paymentDate, paymentReference });
export const returnCashAdvanceByFinance = (id: string, financeId: string, reason: string) =>
    action(id, 'finance-return', { financeId, reason });
export const resubmitCashAdvance = (id: string, input: CreateCashAdvanceInput) =>
    action(id, 'resubmit', input);
export const submitCashAdvanceReconciliation = (id: string, input: CashAdvanceReconciliationInput) =>
    action(id, 'reconciliation', input);
export const returnCashAdvanceReconciliation = (id: string, financeId: string, reason: string) =>
    action(id, 'reconciliation-return', { financeId, reason });
export const completeCashAdvance = (id: string, financeId: string) =>
    action(id, 'complete', { financeId });

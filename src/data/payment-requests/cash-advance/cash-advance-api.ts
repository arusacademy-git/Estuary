import type {
    CashAdvanceReconciliationInput,
    CashAdvanceRecord,
    CashAdvanceRole,
    CreateCashAdvanceInput,
} from '@/domain/payment-requests/cash-advance/types';

type Envelope<T> = { data?: T; message?: string };

const cashAdvanceListCache = new Map<string, { expiresAt: number; promise: Promise<CashAdvanceRecord[]> }>();
const CASH_ADVANCE_LIST_CACHE_MS = 2 * 60 * 1000;

function invalidateCashAdvanceLists() {
    cashAdvanceListCache.clear();
}

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
    const record = await read<CashAdvanceRecord>(response);
    invalidateCashAdvanceLists();
    return record;
}

export async function createCashAdvance(input: CreateCashAdvanceInput) {
    const response = await fetch('/api/v1/payment-requests/cash-advance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    const record = await read<CashAdvanceRecord>(response);
    invalidateCashAdvanceLists();
    return record;
}

export async function fetchCashAdvances(scope: { role: CashAdvanceRole; userId: string; month?: string; includeAll?: boolean; approvalOnly?: boolean }) {
    const query = new URLSearchParams({ role: scope.role, userId: scope.userId });
    if (scope.month) query.set('month', scope.month);
    if (scope.includeAll) query.set('includeAll', '1');
    if (scope.approvalOnly) query.set('approvalOnly', '1');
    const key = query.toString();
    const cached = cashAdvanceListCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;
    const promise = fetch(`/api/v1/payment-requests/cash-advance?${query}`, { cache: 'no-store' })
        .then(async (response) => {
            const records = await read<CashAdvanceRecord[]>(response);
            if (!scope.approvalOnly && !scope.includeAll && !scope.month && (scope.role === 'manager' || scope.role === 'director')) {
                const status = scope.role === 'manager' ? 'PENDING_MANAGER_APPROVAL' : 'PENDING_DIRECTOR_APPROVAL';
                const assigned = records.filter((record) => record.status === status && (
                    scope.role === 'manager' ? record.managerApproverId === scope.userId : record.directorApproverId === scope.userId
                ));
                cashAdvanceListCache.set(`${key}&approvalOnly=1`, {
                    expiresAt: Date.now() + CASH_ADVANCE_LIST_CACHE_MS,
                    promise: Promise.resolve(assigned),
                });
            }
            return records;
        });
    cashAdvanceListCache.set(key, { expiresAt: Date.now() + CASH_ADVANCE_LIST_CACHE_MS, promise });
    try {
        return await promise;
    } catch (error) {
        if (cashAdvanceListCache.get(key)?.promise === promise) cashAdvanceListCache.delete(key);
        throw error;
    }
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

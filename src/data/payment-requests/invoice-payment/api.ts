import type { CreateInvoicePaymentRequestInput, InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';

type Envelope<T> = { data?: T; message?: string };

const invoicePaymentListCache = new Map<string, { expiresAt: number; promise: Promise<InvoicePaymentRequestRecord[]> }>();
const INVOICE_PAYMENT_LIST_CACHE_MS = 2 * 60 * 1000;

function invalidateInvoicePaymentLists() {
  invoicePaymentListCache.clear();
}

async function read<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok) throw new Error(body?.message ?? `Invoice Payment request failed (${response.status}).`);
  if (!body || body.data === undefined) throw new Error('The Invoice Payment API returned no data.');
  return body.data;
}

export async function createInvoicePayment(input: CreateInvoicePaymentRequestInput) {
  const record = await read<InvoicePaymentRequestRecord>(await fetch('/api/v1/payment-requests/invoice-payment', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }));
  invalidateInvoicePaymentLists();
  return record;
}

export async function resubmitInvoicePayment(id: string, input: CreateInvoicePaymentRequestInput) {
    const record = await read<InvoicePaymentRequestRecord>(await fetch(`/api/v1/payment-requests/invoice-payment/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }));
    invalidateInvoicePaymentLists();
    return record;
}

export async function fetchInvoicePayments(scope: { role: 'staff' | 'manager' | 'director' | 'finance'; userId: string; includeAll?: boolean; approvalOnly?: boolean }) {
  const query = new URLSearchParams({ role: scope.role, userId: scope.userId });
  if (scope.includeAll) query.set('includeAll', '1');
  if (scope.approvalOnly) query.set('approvalOnly', '1');
  const key = query.toString();
  const cached = invoicePaymentListCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = fetch(`/api/v1/payment-requests/invoice-payment?${query}`, { cache: 'no-store' })
    .then(async (response) => {
      const records = await read<InvoicePaymentRequestRecord[]>(response);
      if (!scope.approvalOnly && !scope.includeAll && (scope.role === 'manager' || scope.role === 'director')) {
        const status = scope.role === 'manager' ? 'PENDING_MANAGER_REVIEW' : 'PENDING_DIRECTOR_REVIEW';
        const assigned = records.filter((record) => record.status === status && (
          scope.role === 'manager' ? record.managerApproverId === scope.userId : record.directorApproverId === scope.userId
        ));
        invoicePaymentListCache.set(`${key}&approvalOnly=1`, {
          expiresAt: Date.now() + INVOICE_PAYMENT_LIST_CACHE_MS,
          promise: Promise.resolve(assigned),
        });
      }
      return records;
    });
  invoicePaymentListCache.set(key, { expiresAt: Date.now() + INVOICE_PAYMENT_LIST_CACHE_MS, promise });
  try {
    return await promise;
  } catch (error) {
    if (invoicePaymentListCache.get(key)?.promise === promise) invoicePaymentListCache.delete(key);
    throw error;
  }
}

export async function fetchInvoicePayment(id: string) {
  return read<InvoicePaymentRequestRecord>(await fetch(`/api/v1/payment-requests/invoice-payment/${encodeURIComponent(id)}`, { cache: 'no-store' }));
}

async function action(id: string, name: string, body: object) {
  const record = await read<InvoicePaymentRequestRecord>(await fetch(`/api/v1/payment-requests/invoice-payment/${encodeURIComponent(id)}/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  invalidateInvoicePaymentLists();
  return record;
}

export const reviewInvoicePaymentByManager = (id: string, managerId: string) => action(id, 'manager-review', { managerId });
export const returnInvoicePaymentByManager = (id: string, managerId: string, remarks: string) => action(id, 'manager-return', { managerId, remarks });
export const reviewInvoicePaymentByDirector = (id: string, directorId: string) => action(id, 'director-review', { directorId });
export const returnInvoicePaymentByDirector = (id: string, directorId: string, remarks: string) => action(id, 'director-return', { directorId, remarks });
export const completeInvoicePaymentByFinance = (id: string, financeId: string) => action(id, 'finance-complete', { financeId });
export const returnInvoicePaymentByFinance = (id: string, financeId: string, remarks: string) => action(id, 'finance-return', { financeId, remarks });

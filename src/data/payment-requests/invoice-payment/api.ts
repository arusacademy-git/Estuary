import type { CreateInvoicePaymentRequestInput, InvoicePaymentRequestRecord } from '@/domain/payment-requests/invoice-payment/types';

type Envelope<T> = { data?: T; message?: string };

async function read<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok) throw new Error(body?.message ?? `Invoice Payment request failed (${response.status}).`);
  if (!body || body.data === undefined) throw new Error('The Invoice Payment API returned no data.');
  return body.data;
}

export async function createInvoicePayment(input: CreateInvoicePaymentRequestInput) {
  return read<InvoicePaymentRequestRecord>(await fetch('/api/v1/payment-requests/invoice-payment', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }));
}

export async function resubmitInvoicePayment(id: string, input: CreateInvoicePaymentRequestInput) {
    return read<InvoicePaymentRequestRecord>(await fetch(`/api/v1/payment-requests/invoice-payment/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }));
}

export async function fetchInvoicePayments(scope: { role: 'staff' | 'manager' | 'director' | 'finance'; userId: string; includeAll?: boolean }) {
  const query = new URLSearchParams({ role: scope.role, userId: scope.userId });
  if (scope.includeAll) query.set('includeAll', '1');
  return read<InvoicePaymentRequestRecord[]>(await fetch(`/api/v1/payment-requests/invoice-payment?${query}`, { cache: 'no-store' }));
}

export async function fetchInvoicePayment(id: string) {
  return read<InvoicePaymentRequestRecord>(await fetch(`/api/v1/payment-requests/invoice-payment/${encodeURIComponent(id)}`, { cache: 'no-store' }));
}

async function action(id: string, name: string, body: object) {
  return read<InvoicePaymentRequestRecord>(await fetch(`/api/v1/payment-requests/invoice-payment/${encodeURIComponent(id)}/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
}

export const reviewInvoicePaymentByManager = (id: string, managerId: string) => action(id, 'manager-review', { managerId });
export const returnInvoicePaymentByManager = (id: string, managerId: string, remarks: string) => action(id, 'manager-return', { managerId, remarks });
export const reviewInvoicePaymentByDirector = (id: string, directorId: string) => action(id, 'director-review', { directorId });
export const returnInvoicePaymentByDirector = (id: string, directorId: string, remarks: string) => action(id, 'director-return', { directorId, remarks });
export const completeInvoicePaymentByFinance = (id: string, financeId: string) => action(id, 'finance-complete', { financeId });
export const returnInvoicePaymentByFinance = (id: string, financeId: string, remarks: string) => action(id, 'finance-return', { financeId, remarks });

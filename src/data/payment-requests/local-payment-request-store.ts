import type {
  CreateInvoicePaymentRequestInput,
  InvoicePaymentRequestRecord,
} from '@/domain/payment-requests/invoice-payment/types';

const STORAGE_KEY = 'estuary-payment-requests-v2';

function readRecords(): InvoicePaymentRequestRecord[] {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const records = JSON.parse(value) as unknown;
    return Array.isArray(records)
      ? (records as InvoicePaymentRequestRecord[])
      : [];
  } catch {
    return [];
  }
}

function writeRecords(records: InvoicePaymentRequestRecord[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error(
        'Browser storage is full. Remove large supporting documents and try again.',
      );
    }
    throw error;
  }
}

function replaceRecord(
  id: string,
  update: (record: InvoicePaymentRequestRecord) => InvoicePaymentRequestRecord,
) {
  const records = readRecords();
  const index = records.findIndex(
    (record) => record.id === id || record.requestNumber === id,
  );

  if (index < 0) {
    throw new Error('Invoice Payment request could not be found.');
  }

  const updated = update(records[index]);
  const nextRecords = [...records];
  nextRecords[index] = updated;
  writeRecords(nextRecords);
  return updated;
}

function nextRequestNumber(records: InvoicePaymentRequestRecord[]) {
  const year = new Date().getFullYear();
  const countForYear = records.filter((record) =>
    record.requestNumber.startsWith(`INV-${year}-`),
  ).length;

  return `INV-${year}-${String(countForYear + 1).padStart(4, '0')}`;
}

export function listLocalInvoicePaymentRequests() {
  return readRecords().filter(
    (record) => record.requestType === 'INVOICE_PAYMENT',
  );
}

export function getLocalInvoicePaymentRequest(id: string) {
  return readRecords().find(
    (record) => record.id === id || record.requestNumber === id,
  ) ?? null;
}

export function createLocalInvoicePaymentRequest(
  input: CreateInvoicePaymentRequestInput,
) {
  const records = readRecords();
  const now = new Date().toISOString();
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `invoice-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const record: InvoicePaymentRequestRecord = {
    ...input,
    id,
    requestNumber: nextRequestNumber(records),
    requestType: 'INVOICE_PAYMENT',
    status: 'PENDING_MANAGER_REVIEW',
    totalAmount: input.requestedAmount,
    createdAt: now,
    updatedAt: now,
  };

  writeRecords([record, ...records]);
  return record;
}

export function reviewLocalInvoicePaymentByManager(
  id: string,
  managerId: string,
) {
  return replaceRecord(id, (record) => {
    if (record.managerApproverId !== managerId) {
      throw new Error('This Invoice Payment request is assigned to another Manager.');
    }
    if (record.status !== 'PENDING_MANAGER_REVIEW') {
      throw new Error('This request is not currently waiting for Manager review.');
    }

    const now = new Date().toISOString();
    return {
      ...record,
      status: 'PENDING_DIRECTOR_REVIEW',
      managerReviewedAt: now,
      managerReviewedById: managerId,
      managerReturnedAt: undefined,
      managerReturnedById: undefined,
      managerReturnRemarks: undefined,
      updatedAt: now,
    };
  });
}

export function returnLocalInvoicePaymentByManager(
  id: string,
  managerId: string,
  remarks: string,
) {
  const normalizedRemarks = remarks.trim();
  if (!normalizedRemarks) {
    throw new Error('Explain what Staff needs to correct before returning the request.');
  }

  return replaceRecord(id, (record) => {
    if (record.managerApproverId !== managerId) {
      throw new Error('This Invoice Payment request is assigned to another Manager.');
    }
    if (record.status !== 'PENDING_MANAGER_REVIEW') {
      throw new Error('This request is not currently waiting for Manager review.');
    }

    const now = new Date().toISOString();
    return {
      ...record,
      status: 'RETURNED_TO_STAFF',
      managerReturnedAt: now,
      managerReturnedById: managerId,
      managerReturnRemarks: normalizedRemarks,
      updatedAt: now,
    };
  });
}

export function reviewLocalInvoicePaymentByDirector(
  id: string,
  directorId: string,
) {
  return replaceRecord(id, (record) => {
    if (record.directorApproverId !== directorId) {
      throw new Error('This Invoice Payment request is assigned to another Director.');
    }
    if (record.status !== 'PENDING_DIRECTOR_REVIEW') {
      throw new Error('This request is not currently waiting for Director review.');
    }

    const now = new Date().toISOString();
    return {
      ...record,
      status: 'PENDING_FINANCE_REVIEW',
      directorReviewedAt: now,
      directorReviewedById: directorId,
      directorReturnedAt: undefined,
      directorReturnedById: undefined,
      directorReturnRemarks: undefined,
      updatedAt: now,
    };
  });
}

export function returnLocalInvoicePaymentByDirector(
  id: string,
  directorId: string,
  remarks: string,
) {
  const normalizedRemarks = remarks.trim();
  if (!normalizedRemarks) {
    throw new Error('Explain what Staff needs to correct before returning the request.');
  }

  return replaceRecord(id, (record) => {
    if (record.directorApproverId !== directorId) {
      throw new Error('This Invoice Payment request is assigned to another Director.');
    }
    if (record.status !== 'PENDING_DIRECTOR_REVIEW') {
      throw new Error('This request is not currently waiting for Director review.');
    }

    const now = new Date().toISOString();
    return {
      ...record,
      status: 'RETURNED_TO_STAFF',
      directorReturnedAt: now,
      directorReturnedById: directorId,
      directorReturnRemarks: normalizedRemarks,
      updatedAt: now,
    };
  });
}

export function completeLocalInvoicePaymentByFinance(
  id: string,
  financeId: string,
) {
  return replaceRecord(id, (record) => {
    if (record.status !== 'PENDING_FINANCE_REVIEW') {
      throw new Error('This request is not currently waiting for Finance verification.');
    }

    const now = new Date().toISOString();
    return {
      ...record,
      status: 'COMPLETED',
      financeVerifiedAt: now,
      financeVerifiedById: financeId,
      financeReturnedAt: undefined,
      financeReturnedById: undefined,
      financeReturnRemarks: undefined,
      updatedAt: now,
    };
  });
}

export function returnLocalInvoicePaymentByFinance(
  id: string,
  financeId: string,
  remarks: string,
) {
  const normalizedRemarks = remarks.trim();
  if (!normalizedRemarks) {
    throw new Error('Explain what Staff needs to correct before returning the request.');
  }

  return replaceRecord(id, (record) => {
    if (record.status !== 'PENDING_FINANCE_REVIEW') {
      throw new Error('This request is not currently waiting for Finance verification.');
    }

    const now = new Date().toISOString();
    return {
      ...record,
      status: 'RETURNED_TO_STAFF',
      financeReturnedAt: now,
      financeReturnedById: financeId,
      financeReturnRemarks: normalizedRemarks,
      updatedAt: now,
    };
  });
}

import { createNextPaymentRecordReference } from '@/domain/payment-records/payment-record-reference';
import type {
  CreateTravelAllowanceInput,
  TravelAllowanceRecord,
} from '@/domain/payment-requests/travel-allowance/types';
import { travelLineTotal } from '@/domain/payment-requests/travel-allowance/types';

const STORAGE_KEY = 'estuary-travel-allowances-v1';

function readRecords(): TravelAllowanceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(stored) ? (stored as TravelAllowanceRecord[]) : [];
  } catch {
    return [];
  }
}

function previousBusinessDay(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  do date.setDate(date.getDate() - 1);
  while (date.getDay() === 0 || date.getDay() === 6);
  return date.toISOString().slice(0, 10);
}

export function listLocalTravelAllowances() {
  return readRecords();
}

export function createLocalTravelAllowance(input: CreateTravelAllowanceInput) {
  const records = readRecords();
  const now = new Date().toISOString();
  const earliestTravelDate = [...input.lines]
    .map((line) => line.travelDate)
    .sort()[0];
  const record: TravelAllowanceRecord = {
    ...input,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `travel-allowance-${Date.now()}`,
    requestNumber: createNextPaymentRecordReference(
      'TRAVEL_ALLOWANCE',
      records.map((item) => item.requestNumber),
    ),
    requestType: 'TRAVEL_ALLOWANCE',
    status: 'PENDING_DIRECTOR_APPROVAL',
    totalAmount: input.lines.reduce((total, line) => total + travelLineTotal(line), 0),
    paymentDueDate: previousBusinessDay(earliestTravelDate),
    createdAt: now,
    updatedAt: now,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...records]));
  return record;
}
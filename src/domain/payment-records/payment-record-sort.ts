export type PaymentRecordSort =
  | 'UPDATED_DESC'
  | 'UPDATED_ASC'
  | 'AMOUNT_DESC'
  | 'AMOUNT_ASC'
  | 'REFERENCE_ASC';

export const PAYMENT_RECORD_SORT_OPTIONS: Array<{
  value: PaymentRecordSort;
  label: string;
}> = [
  { value: 'UPDATED_DESC', label: 'Newest updated' },
  { value: 'UPDATED_ASC', label: 'Oldest updated' },
  { value: 'AMOUNT_DESC', label: 'Amount: high to low' },
  { value: 'AMOUNT_ASC', label: 'Amount: low to high' },
  { value: 'REFERENCE_ASC', label: 'Reference number' },
];

type SortFields = {
  reference: string;
  updatedAt: string;
  amount: number;
};

export function sortPaymentRecords<T>(
  records: T[],
  sort: PaymentRecordSort,
  fields: (record: T) => SortFields,
) {
  return [...records].sort((first, second) => {
    const a = fields(first);
    const b = fields(second);

    if (sort === 'UPDATED_ASC') return a.updatedAt.localeCompare(b.updatedAt);
    if (sort === 'AMOUNT_DESC') return b.amount - a.amount;
    if (sort === 'AMOUNT_ASC') return a.amount - b.amount;
    if (sort === 'REFERENCE_ASC') {
      return a.reference.localeCompare(b.reference, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }

    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
import type {
  PrototypeDraft,
  PrototypeDraftLineItem,
} from '@/domain/prototype/types';

const currencyFormatter = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  minimumFractionDigits: 2,
});

export type VoucherTotals = {
  subtotal: number;
  tax: number;
  grand: number;
};

export function parseMoney(value: string): number {
  const normalized = value.replaceAll(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: number): string {
  return currencyFormatter.format(value);
}

export function calculateLineSubtotal(item: PrototypeDraftLineItem): number {
  return parseMoney(item.quantity) * parseMoney(item.unitPrice);
}

export function calculateLineTotal(
  item: PrototypeDraftLineItem,
  amountsTaxInclusive: boolean
): number {
  const subtotal = calculateLineSubtotal(item);
  const taxAmount = parseMoney(item.taxAmount);

  return amountsTaxInclusive ? subtotal : subtotal + taxAmount;
}

export function syncLineItem(
  item: PrototypeDraftLineItem
): PrototypeDraftLineItem {
  if (item.taxCode === 'NO_TAX') {
    return { ...item, taxAmount: '0.00' };
  }

  if (item.taxCode === 'SST_6') {
    return {
      ...item,
      taxAmount: (calculateLineSubtotal(item) * 0.06).toFixed(2),
    };
  }

  return item;
}

export function createLineItem(
  index: number,
  accountCode: string
): PrototypeDraftLineItem {
  return {
    id: `line-${index}`,
    accountCode,
    description: '',
    quantity: '1',
    unitPrice: '0.00',
    taxCode: 'NO_TAX',
    taxAmount: '0.00',
  };
}

export function summarizeDraftTotals(draft: PrototypeDraft): VoucherTotals {
  return draft.lineItems.reduce(
    (summary, item) => {
      summary.subtotal += calculateLineSubtotal(item);
      summary.tax += parseMoney(item.taxAmount);
      summary.grand += calculateLineTotal(item, draft.amountsTaxInclusive);
      return summary;
    },
    { subtotal: 0, tax: 0, grand: 0 }
  );
}

export function composePaymentDetails(
  draft: PrototypeDraft,
  accountLabels: Record<string, string>
): string {
  return [
    draft.paymentDetails,
    draft.lineItems
      .map((item, index) => {
        const account = accountLabels[item.accountCode] ?? item.accountCode;
        const description = item.description || account;

        return `${index + 1}. ${description} - ${formatMoney(
          calculateLineTotal(item, draft.amountsTaxInclusive)
        )}`;
      })
      .join('\n'),
  ]
    .filter(Boolean)
    .join('\n');
}

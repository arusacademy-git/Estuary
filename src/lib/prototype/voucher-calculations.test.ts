import { describe, expect, it } from 'vitest';

import { prototypeConfig } from '@/data/prototype/prototype-config';

import {
  composePaymentDetails,
  formatMoney,
  summarizeDraftTotals,
} from './voucher-calculations';

describe('voucher calculations', () => {
  it('summarizes draft totals from line items', () => {
    const totals = summarizeDraftTotals(prototypeConfig.prototypeDraft);

    expect(formatMoney(totals.grand)).toBe('RM 250.00');
    expect(totals.tax).toBe(0);
  });

  it('builds payment details from summary and lines', () => {
    const accountLabels = { '5100': 'Transport Claims' };
    const details = composePaymentDetails(
      prototypeConfig.prototypeDraft,
      accountLabels
    );

    expect(details).toContain('Transport allowance claim');
    expect(details).toContain('Workshop transport claim - Day 1');
  });
});

import { describe, expect, it } from 'vitest';

import { prototypeConfig } from '@/data/prototype/prototype-config';

import {
  composePaymentDetails,
  formatMoney,
  formatRinggitMalaysiaInWords,
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

  it.each([
    [0, 'RINGGIT MALAYSIA KOSONG DAN SEN KOSONG SAHAJA'],
    [12.05, 'RINGGIT MALAYSIA DUA BELAS DAN SEN LIMA SAHAJA'],
    [115, 'RINGGIT MALAYSIA SERATUS LIMABELAS DAN SEN KOSONG SAHAJA'],
    [
      1_250.4,
      'RINGGIT MALAYSIA SATU RIBU DUA RATUS LIMA PULUH DAN SEN EMPAT PULUH SAHAJA',
    ],
    [
      1_234_567.89,
      'RINGGIT MALAYSIA SATU JUTA DUA RATUS TIGA PULUH EMPAT RIBU LIMA RATUS ENAM PULUH TUJUH DAN SEN LAPAN PULUH SEMBILAN SAHAJA',
    ],
  ])('converts RM %d into the established Malay wording', (amount, expected) => {
    expect(formatRinggitMalaysiaInWords(amount)).toBe(expected);
  });
});

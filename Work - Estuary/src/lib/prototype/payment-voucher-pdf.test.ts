import { describe, expect, it } from 'vitest';

import { prototypeConfig } from '@/data/prototype/prototype-config';

import { buildPaymentVoucherPdf } from './payment-voucher-pdf';

describe('payment voucher pdf', () => {
  it('generates a pdf document for the draft', async () => {
    const pdfBytes = await buildPaymentVoucherPdf(prototypeConfig.prototypeDraft);
    const header = String.fromCharCode(...pdfBytes.slice(0, 4));

    expect(header).toBe('%PDF');
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });
});

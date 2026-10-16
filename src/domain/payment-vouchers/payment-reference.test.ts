import { describe, expect, it } from 'vitest';

import {
  paymentVoucherRecipientReference,
  paymentVoucherReference,
} from './payment-reference';

describe('Payment Voucher payment reference', () => {
  it('uses the PV number when Finance has not saved a reference', () => {
    expect(paymentVoucherReference({ voucherNumber: 'PV-2026-0013' })).toBe('PV-2026-0013');
  });

  it('preserves the saved PV reference on an existing voucher', () => {
    expect(paymentVoucherReference({ voucherNumber: 'PV-2026-0013', paymentReference: 'PV-2026-0013' })).toBe('PV-2026-0013');
  });

  it('uses the PV number as the recipient reference', () => {
    expect(paymentVoucherRecipientReference('PV-2026-0013')).toBe('PV-2026-0013');
  });
});

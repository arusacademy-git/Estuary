import { describe, expect, it } from 'vitest';

import { canTransitionPaymentVoucher, requireRejectionRemarks } from './workflow';

describe('Payment Voucher beta workflow', () => {
  it('allows Staff to resubmit a rejected voucher', () => {
    expect(canTransitionPaymentVoucher('REJECTED', 'PENDING_DIRECTOR_APPROVAL')).toBe(true);
  });

  it('requires remarks when a Director rejects', () => {
    expect(() => requireRejectionRemarks('REJECTED', '')).toThrow(
      'Rejection remarks are required.'
    );
  });
});

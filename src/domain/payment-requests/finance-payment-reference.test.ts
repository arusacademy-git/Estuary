import { describe, expect, it } from 'vitest';

import { paymentRequestReference } from './finance-payment-reference';

describe('Finance payment references', () => {
  it.each([
    ['IV26-10-01', 'IV26-10-01'],
    ['TA26-09-01', 'TA26-09-01'],
    ['CA26-10-01', 'CA26-10-01'],
    ['PC26-10-01', 'PC26-10-01'],
  ])('uses the request number for %s', (requestNumber, expected) => {
    expect(paymentRequestReference(requestNumber)).toBe(expected);
  });
});

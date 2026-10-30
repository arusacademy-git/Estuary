import { describe, expect, it } from 'vitest';

import { bankAccountNumberError, identificationNumberError, normalizeNumericIdentifier } from './payment-identity-validation';

describe('payment identity validation', () => {
  it('requires exactly 12 IC digits while accepting display hyphens', () => {
    expect(identificationNumberError('900101-10-1234')).toBe('');
    expect(identificationNumberError('1234567890123')).toContain('exactly 12');
    expect(identificationNumberError('12345678901A')).toContain('digits only');
  });

  it('validates savings/current account lengths by bank', () => {
    expect(bankAccountNumberError('MAYBANK', '123456789012')).toBe('');
    expect(bankAccountNumberError('MAYBANK', '1234567890')).toContain('12 digits');
    expect(bankAccountNumberError('CIMB', '1234567890')).toBe('');
    expect(bankAccountNumberError('CIMB', '12345678901234')).toBe('');
    expect(bankAccountNumberError('HONG LEONG', '12345678901')).toBe('');
  });

  it('stores numeric identifiers without spaces or hyphens', () => {
    expect(normalizeNumericIdentifier('900101-10-1234')).toBe('900101101234');
  });
});

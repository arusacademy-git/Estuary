import { describe, expect, it } from 'vitest';

import { formatTravelAllowanceNumber } from './travel-allowance-number';

describe('Travel Allowance request numbers', () => {
  it.each([
    [2026, 9, 1, 'TA26-09-01'],
    [2026, 10, 12, 'TA26-10-12'],
  ])(
    'formats year %i, month %i, sequence %i as %s',
    (year, month, sequence, expected) => {
      expect(formatTravelAllowanceNumber(year, month, sequence)).toBe(expected);
    },
  );
});

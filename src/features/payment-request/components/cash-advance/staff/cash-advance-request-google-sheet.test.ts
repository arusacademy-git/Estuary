import { describe, expect, it } from 'vitest';

import { parseRequestSheet } from './cash-advance-request-google-sheet';

describe('Cash Advance request Google Sheet parser', () => {
  it('preserves entered cells, accepts blank descriptive cells and ignores untouched zero rows', () => {
    const result = parseRequestSheet([
      'NAME:,Afiq Rahman,POSITION:,Programme Staff',
      'CONTACT:,0123456789,DATE:,15/10/2026',
      'No,Breakdown of Request - List of Expenses,Purpose,Amount (RM)',
      '1,Workshop materials,,125.50',
      '2,,,0.00',
      '3,,Emergency transport,25.00',
    ].join('\n'));

    expect(result.requesterName).toBe('Afiq Rahman');
    expect(result.requestDate).toBe('2026-10-15');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ description: 'Workshop materials', purpose: '', amount: 125.5 });
    expect(result.lines[1]).toMatchObject({ description: '', purpose: 'Emergency transport', amount: 25 });
  });
});

import { describe, expect, it } from 'vitest';

import { cashAdvanceInitialWorkflow, cashAdvanceVisibleStatus, validateCashAdvanceRequest } from './policy';

const line = (amount: number) => ({
  id: 'line-1',
  description: 'Approved expense',
  purpose: 'Project work',
  amount,
});

describe('Cash Advance request amount policy', () => {
  it('accepts a positive amount below the former RM300 minimum', () => {
    expect(validateCashAdvanceRequest([line(0.01)])).toBeNull();
  });

  it('does not impose a maximum request amount', () => {
    expect(validateCashAdvanceRequest([line(10_000_000)])).toBeNull();
  });

  it('accepts blank descriptive cells and zero-value companion rows when the request total is positive', () => {
    expect(validateCashAdvanceRequest([
      { ...line(25), description: '', purpose: '' },
      { ...line(0), id: 'line-2', description: 'Pending detail', purpose: '' },
    ])).toBeNull();
  });

  it('still rejects zero and negative amounts', () => {
    expect(validateCashAdvanceRequest([line(0)])).toBeTruthy();
    expect(validateCashAdvanceRequest([line(-1)])).toBeTruthy();
  });
});

describe('Cash Advance approval routing', () => {
  it('routes a submitted request directly to its Director', () => {
    expect(cashAdvanceInitialWorkflow('director-1')).toEqual({
      state: 'PENDING_DIRECTOR_APPROVAL',
      assigneeId: 'director-1',
    });
  });

  it('exposes legacy Manager-blocked requests as ready for Director action', () => {
    expect(cashAdvanceVisibleStatus('PENDING_MANAGER_APPROVAL')).toBe('PENDING_DIRECTOR_APPROVAL');
  });
});

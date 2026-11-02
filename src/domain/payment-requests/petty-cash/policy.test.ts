import { describe, expect, it } from 'vitest';

import { validatePettyCashInput } from './policy';
import type { CreatePettyCashInput } from './types';

function request(overrides: Partial<CreatePettyCashInput> = {}): CreatePettyCashInput {
  return {
    organizationId: 'beta-arus-org', requesterId: 'staff-1', requesterRole: 'staff',
    requesterName: 'Staff', requesterPosition: 'Staff', requesterContact: '0123456789',
    requestDate: '2026-10-17', location: 'PENANG', managerApproverId: 'manager-1', directorApproverId: 'director-1',
    lines: [{ id: 'line-1', expenseDate: '2026-10-17', supplier: 'Expected supplier', details: 'Planned stationery', proofLink: '', accountType: '920-000 PRINTING & STATIONERIES', division: 'O-MANAGEMENT-ARUS', amount: 100 }],
    ...overrides,
  };
}

describe('Petty Cash request policy', () => {
  it('does not require a receipt before Finance releases the money', () => {
    expect(validatePettyCashInput(request())).toBe('');
  });

  it('requires a Staff request to name a Manager reviewer and Director previewer', () => {
    expect(validatePettyCashInput(request({ directorApproverId: '' }))).toBe('Select the Manager reviewer and Director previewer.');
  });

  it('allows the Director requester to use the optional self-preview', () => {
    expect(validatePettyCashInput(request({ requesterId: 'director-1', requesterRole: 'director' }))).toBe('');
  });
});

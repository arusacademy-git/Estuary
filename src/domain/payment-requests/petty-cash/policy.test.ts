import { describe, expect, it } from 'vitest';

import { validatePettyCashInput } from './policy';
import type { CreatePettyCashInput } from './types';

function request(overrides: Partial<CreatePettyCashInput> = {}): CreatePettyCashInput {
  return {
    organizationId: 'beta-arus-org', requesterId: 'staff-1', requesterRole: 'staff',
    requesterName: 'Staff', requesterPosition: 'Staff', requesterContact: '0123456789',
    requestDate: '2026-10-17', location: 'PENANG', managerApproverId: '', directorApproverId: 'director-1',
    lines: [{ id: 'line-1', expenseDate: '2026-10-17', supplier: 'Expected supplier', details: 'Planned stationery', proofLink: '', accountType: '920-000 PRINTING & STATIONERIES', division: 'O-MANAGEMENT-ARUS', amount: 100 }],
    ...overrides,
  };
}

describe('Petty Cash request policy', () => {
  it('does not require a receipt before Finance releases the money', () => {
    expect(validatePettyCashInput(request())).toBe('');
  });

  it('requires every request to have a Director approver', () => {
    expect(validatePettyCashInput(request({ directorApproverId: '' }))).toBe('Select the mandatory Director approver.');
  });

  it('requires a Director requester to choose another Director', () => {
    expect(validatePettyCashInput(request({ requesterId: 'director-1', requesterRole: 'director' }))).toBe('A Director requester must select another Director to approve the request.');
  });
});

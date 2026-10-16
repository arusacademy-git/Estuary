import { describe, expect, it } from 'vitest';

import {
  normalizeTechAllowance,
  requiresTechManagerApproval,
  validateClaimInput,
} from './policy';
import type { ClaimLine, CreateClaimInput } from './types';

function line(amount: number): ClaimLine {
  return {
    id: 'line-1',
    expenseDate: '2026-10-15',
    supplier: 'Technology supplier',
    details: 'Work equipment',
    receiptLink: 'https://example.com/receipt.pdf',
    receiptFileName: '',
    receiptMimeType: '',
    receiptFileSize: 0,
    accountType: '',
    division: '',
    amount,
    from: '',
    to: '',
    kilometers: 0,
  };
}

function techClaim(amount: number): CreateClaimInput {
  return {
    organizationId: 'org-1',
    requesterId: 'staff-1',
    requesterName: 'Staff User',
    requesterPosition: 'Staff',
    requesterRole: 'staff',
    managerApproverId: 'manager-1',
    directorApproverId: 'director-1',
    requesterContact: 'staff@example.com',
    claimDate: '2026-10-15',
    claimType: 'TECH',
    techExtended: false,
    lines: [line(amount)],
  };
}

describe('Tech Claim policy', () => {
  it('keeps a claim up to RM500 on the standard allowance', () => {
    const input = normalizeTechAllowance(techClaim(500));

    expect(input.techExtended).toBe(false);
    expect(requiresTechManagerApproval(input)).toBe(false);
    expect(validateClaimInput(input, { medicalUsedThisYear: 0 })).toBe('');
  });

  it('automatically uses the extended allowance and Manager approval above RM500', () => {
    const input = normalizeTechAllowance(techClaim(800));

    expect(input.techExtended).toBe(true);
    expect(requiresTechManagerApproval(input)).toBe(true);
    expect(validateClaimInput(input, { medicalUsedThisYear: 0 })).toBe('');
  });

  it('rejects a Tech Claim above the RM1,000 policy ceiling', () => {
    const input = normalizeTechAllowance(techClaim(1_500));

    expect(validateClaimInput(input, { medicalUsedThisYear: 0 })).toBe(
      'This claim exceeds the RM1000.00 extended limit.',
    );
  });

  it('applies the three-year lock to an extended Tech Claim', () => {
    const input = normalizeTechAllowance(techClaim(700));

    expect(validateClaimInput(input, {
      medicalUsedThisYear: 0,
      techExtendedLockedUntil: '2028-10-15',
    })).toContain('Tech claims are unavailable until');
  });
});

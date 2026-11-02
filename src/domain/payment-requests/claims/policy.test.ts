import { describe, expect, it } from 'vitest';

import {
  claimLimit,
  claimPolicyContext,
  normalizeTechAllowance,
  proratedAnnualEntitlement,
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

  it('automatically uses the extended allowance without Manager approval above RM500', () => {
    const input = normalizeTechAllowance(techClaim(800));

    expect(input.techExtended).toBe(true);
    expect(requiresTechManagerApproval(input)).toBe(false);
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

describe('Claim purchase-date policy', () => {
  it('allows non-Internet claims through day 30 and rejects day 31', () => {
    const input = techClaim(100);
    input.lines[0].expenseDate = '2026-09-14';
    expect(validateClaimInput(input, { medicalUsedThisYear: 0 })).toBe('Claims must be submitted within 30 days of the purchase date.');
    input.lines[0].expenseDate = '2026-09-15';
    expect(validateClaimInput(input, { medicalUsedThisYear: 0 })).toBe('');
  });

  it('requires Internet / Commute claims in the same calendar month', () => {
    const input = techClaim(70);
    input.claimType = 'INTERNET_COMMUTE';
    input.lines[0].expenseDate = '2026-09-30';
    expect(validateClaimInput(input, { medicalUsedThisYear: 0 })).toBe('Internet / Commute claims must be submitted within the same calendar month as the bill or commute expense.');
    input.lines[0].expenseDate = '2026-10-01';
    expect(validateClaimInput(input, { medicalUsedThisYear: 0 })).toBe('');
  });
});

describe('Annual Medical and PD entitlements', () => {
  it('prorates RM500 from the employee joining month', () => {
    expect(proratedAnnualEntitlement(500, '2026-07-15', '2026-10-19')).toBe(250);
    expect(proratedAnnualEntitlement(500, '2025-12-01', '2026-10-19')).toBe(500);
  });

  it('deducts submitted Medical and PD claims from separate annual balances', () => {
    const medical = { ...techClaim(100), claimType: 'MEDICAL' as const };
    const pd = { ...techClaim(75), claimType: 'PD' as const };
    const records = [medical, pd].map((input, index) => ({
      ...input,
      id: `claim-${index}`,
      claimNumber: `CL26-10-0${index + 1}`,
      requestType: 'CLAIM_REQUEST' as const,
      status: 'CLAIM_SUBMITTED' as const,
      totalAmount: input.lines[0].amount,
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-19T00:00:00.000Z',
    }));
    const context = claimPolicyContext(records, 'staff-1', '2026-10-19', '2026-07-01');
    expect(context.medicalAnnualEntitlement).toBe(250);
    expect(context.pdAnnualEntitlement).toBe(250);
    expect(claimLimit({ claimType: 'MEDICAL', techExtended: false }, context)).toBe(150);
    expect(claimLimit({ claimType: 'PD', techExtended: false }, context)).toBe(175);
  });
});

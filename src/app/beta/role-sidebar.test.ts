import { describe, expect, it } from 'vitest';

import { navigationForRole } from './role-sidebar';

function createPaymentLabels(role: 'staff' | 'director', projectManager = false) {
  return navigationForRole(role, projectManager)
    .find((group) => group.label === 'Create payments')
    ?.items.flatMap((item) => item.children?.map((child) => child.label) ?? []) ?? [];
}

describe('role sidebar payment links', () => {
  it('shows Payment Voucher but not Travel Allowance for ordinary Staff', () => {
    const labels = createPaymentLabels('staff');
    expect(labels).toContain('Payment Voucher');
    expect(labels).not.toContain('Travel Allowance');
  });

  it('shows Travel Allowance for project-scoped Managers', () => {
    expect(createPaymentLabels('staff', true)).toContain('Travel Allowance');
  });

  it('shows every payment type for Directors', () => {
    expect(createPaymentLabels('director')).toEqual([
      'Payment Voucher',
      'Invoice Payment',
      'Travel Allowance',
      'Cash Advance',
      'Petty Cash',
      'Claims',
    ]);
  });
});

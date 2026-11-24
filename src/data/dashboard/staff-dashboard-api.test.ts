import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BetaAccount } from '@/lib/auth/beta-accounts';
import { fetchStaffDashboardSummary } from './api';
import {
  fetchStaffDashboardRecords,
  staffNeedsAction,
  staffRequestsHref,
} from './staff-dashboard-api';

vi.mock('./api', () => ({ fetchStaffDashboardSummary: vi.fn() }));

const account: BetaAccount = {
  id: 'staff-1',
  name: 'Staff User',
  email: 'staff@example.com',
  position: 'Staff',
  department: 'Programme',
  role: 'staff',
};

describe('staff dashboard records', () => {
  beforeEach(() => vi.resetAllMocks());

  it('maps the requester’s Claim to its My Requests detail and action state', async () => {
    vi.mocked(fetchStaffDashboardSummary).mockResolvedValue([
      {
        id: 'claim-1',
        reference: 'CL26-11-01',
        paymentType: 'EXPENSE_CLAIM',
        requesterId: 'staff-1',
        requesterName: 'Staff User',
        status: 'RETURNED_TO_CLAIMANT',
        amount: 75,
        submittedAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z',
        approverIds: [],
        managerViewed: false,
        claimManagerPreviewed: false,
        claimDirectorPreviewed: false,
        recipientLinkIssued: false,
      },
      {
        id: 'claim-2',
        reference: 'CL26-11-02',
        paymentType: 'EXPENSE_CLAIM',
        requesterId: 'other-user',
        requesterName: 'Other User',
        status: 'COMPLETED',
        amount: 50,
        submittedAt: '2026-11-23T00:00:00.000Z',
        updatedAt: '2026-11-24T00:00:00.000Z',
        approverIds: [],
        managerViewed: false,
        claimManagerPreviewed: false,
        claimDirectorPreviewed: false,
        recipientLinkIssued: false,
      },
    ]);

    const records = await fetchStaffDashboardRecords(account);
    expect(fetchStaffDashboardSummary).toHaveBeenCalledWith(account.id);
    expect(records).toHaveLength(1);
    expect(records[0].href).toBe('/beta/payment-records?scope=mine&type=CLAIM&request=claim-1&open=1');
    expect(records[0].statusLabel).toBe('Payment Rejected');
    expect(staffNeedsAction(records[0])).toBe(true);
    expect(staffRequestsHref('EXPENSE_CLAIM', 'ACTION')).toBe('/beta/payment-records?scope=mine&type=CLAIM&summary=ACTION');
  });
});

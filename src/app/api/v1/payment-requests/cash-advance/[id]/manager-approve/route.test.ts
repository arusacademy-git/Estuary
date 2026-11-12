import { beforeEach, describe, expect, it, vi } from 'vitest';

const approve = vi.hoisted(() => vi.fn());
vi.mock('@/data/payment-requests/cash-advance/prisma-cash-advance-repository', () => ({
  approveCashAdvanceByManagerInDatabase: approve,
}));

import { POST } from './route';

const context = { params: Promise.resolve({ id: 'ca-test-id' }) };

describe('Cash Advance Manager approval route', () => {
  beforeEach(() => {
    approve.mockReset();
    approve.mockResolvedValue({ id: 'ca-test-id', status: 'PENDING_DIRECTOR_APPROVAL' });
  });

  it('passes the selected signature to the approval operation', async () => {
    const response = await POST(new Request('http://localhost/api/v1/payment-requests/cash-advance/ca-test-id/manager-approve', {
      method: 'POST',
      body: JSON.stringify({ managerId: 'manager-test', signatureKey: 'signature-test' }),
    }), context);
    expect(response.status).toBe(200);
    expect(approve).toHaveBeenCalledWith('ca-test-id', 'manager-test', 'signature-test');
  });

  it('does not approve without a signature', async () => {
    const response = await POST(new Request('http://localhost/api/v1/payment-requests/cash-advance/ca-test-id/manager-approve', {
      method: 'POST',
      body: JSON.stringify({ managerId: 'manager-test' }),
    }), context);
    expect(response.status).toBe(400);
    expect(approve).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const returnByDirector = vi.hoisted(() => vi.fn());
vi.mock('@/data/payment-requests/petty-cash/prisma-repository', () => ({
  returnPettyCashByDirectorInDatabase: returnByDirector,
}));

import { POST } from './route';

const context = { params: Promise.resolve({ id: 'PC26-11-01' }) };

describe('Petty Cash Director return route', () => {
  beforeEach(() => returnByDirector.mockReset());

  it('requires correction remarks before changing the request', async () => {
    const response = await POST(
      new Request('http://localhost/api/return', {
        method: 'POST',
        body: JSON.stringify({ directorId: 'director-1', reason: ' ' }),
      }),
      context,
    );
    expect(response.status).toBe(400);
    expect(returnByDirector).not.toHaveBeenCalled();
  });

  it('returns the updated request from the Director action', async () => {
    const updated = { id: 'PC26-11-01', status: 'RETURNED_TO_STAFF' };
    returnByDirector.mockResolvedValue(updated);
    const response = await POST(
      new Request('http://localhost/api/return', {
        method: 'POST',
        body: JSON.stringify({ directorId: 'director-1', reason: 'Please correct the receipt' }),
      }),
      context,
    );
    expect(returnByDirector).toHaveBeenCalledWith('PC26-11-01', 'director-1', 'Please correct the receipt');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: updated });
  });
});

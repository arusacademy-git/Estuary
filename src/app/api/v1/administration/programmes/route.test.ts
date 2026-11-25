import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { project: { findMany } } }));

import { GET, PUT } from './route';

describe('programme Settings API', () => {
  beforeEach(() => findMany.mockReset());

  it('reads the project assignment and keeps archived codes out of Settings', async () => {
    findMany.mockResolvedValue([
      { id: 'project-1', code: 'N-AOC-UNDP', name: 'AOC', is_active: true, is_archived: false,
        manager_assignments: [{ membership: { user_id: 'nadia-hassan' } }] },
      { id: 'project-2', code: 'O-BD-ARUS', name: 'Deleted', is_active: false, is_archived: true,
        manager_assignments: [] },
    ]);
    const response = await GET();
    const body = await response.json() as { data: Array<{ code: string; managerId: string }> };
    expect(body.data.find((item) => item.code === 'N-AOC-UNDP')).toMatchObject({ managerId: 'nadia-hassan' });
    expect(body.data.some((item) => item.code === 'O-BD-ARUS')).toBe(false);
  });

  it('rejects programme edits from a non-administrator account', async () => {
    const response = await PUT(new Request('http://localhost/api/v1/administration/programmes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorId: 'afiq-rahman', programmes: [{ id: 'one', code: 'P-ONE', name: 'One', managerId: 'nadia-hassan', active: true }] }),
    }));
    expect(response.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });
});

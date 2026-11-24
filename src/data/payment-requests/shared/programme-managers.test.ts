import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { programmeManagerIds, requireSameManagerIds } from './programme-managers';

function transaction(rows: Array<{ code: string; manager_id: string | null }>, active: string[]) {
  return {
    betaProgramme: { findMany: vi.fn().mockResolvedValue(rows) },
    userOrgMembership: { findMany: vi.fn().mockResolvedValue(active.map((user_id) => ({ user_id }))) },
  } as unknown as Prisma.TransactionClient;
}

describe('programme Manager resolution', () => {
  it('collects every distinct Manager for a multi-programme request', async () => {
    const tx = transaction([
      { code: 'P-ONE', manager_id: 'manager-a' },
      { code: 'P-TWO', manager_id: 'manager-b' },
      { code: 'P-THREE', manager_id: 'manager-a' },
    ], ['manager-a', 'manager-b']);
    const assigned = await programmeManagerIds(tx, 'arus-org', ['p-one', 'P-TWO', 'P-THREE']);
    expect(assigned).toEqual(['manager-a', 'manager-b']);
    expect(() => requireSameManagerIds(assigned, ['manager-b', 'manager-a'])).not.toThrow();
    expect(() => requireSameManagerIds(assigned, ['manager-a'])).toThrow('assignment changed');
  });

  it('rejects an unassigned programme or inactive Manager', async () => {
    await expect(programmeManagerIds(transaction([{ code: 'P-ONE', manager_id: null }], []), 'arus-org', ['P-ONE']))
      .rejects.toThrow('Assign a Manager');
    await expect(programmeManagerIds(transaction([{ code: 'P-ONE', manager_id: 'manager-a' }], []), 'arus-org', ['P-ONE']))
      .rejects.toThrow('not an active member');
  });
});

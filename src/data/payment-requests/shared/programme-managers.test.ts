import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { programmeManagerIds, requireSameManagerIds } from './programme-managers';

function transaction(rows: Array<{ code: string; managers: string[] }>, active: string[]) {
  return {
    project: { findMany: vi.fn().mockResolvedValue(rows.map((row) => ({
      code: row.code,
      manager_assignments: row.managers.map((user_id) => ({ membership: {
        user_id, is_active: active.includes(user_id), membership_status: 'ACTIVE',
      } })),
    }))) },
  } as unknown as Prisma.TransactionClient;
}

describe('programme Manager resolution', () => {
  it('collects every distinct Manager for a multi-programme request', async () => {
    const tx = transaction([
      { code: 'P-ONE', managers: ['manager-a'] },
      { code: 'P-TWO', managers: ['manager-b'] },
      { code: 'P-THREE', managers: ['manager-a'] },
    ], ['manager-a', 'manager-b']);
    const assigned = await programmeManagerIds(tx, 'arus-org', ['p-one', 'P-TWO', 'P-THREE']);
    expect(assigned).toEqual(['manager-a', 'manager-b']);
    expect(() => requireSameManagerIds(assigned, ['manager-b', 'manager-a'])).not.toThrow();
    expect(() => requireSameManagerIds(assigned, ['manager-a'])).toThrow('assignment changed');
  });

  it('rejects an unassigned programme or inactive Manager', async () => {
    await expect(programmeManagerIds(transaction([{ code: 'P-ONE', managers: [] }], []), 'arus-org', ['P-ONE']))
      .rejects.toThrow('Assign a Manager');
    await expect(programmeManagerIds(transaction([{ code: 'P-ONE', managers: ['manager-a'] }], []), 'arus-org', ['P-ONE']))
      .rejects.toThrow('Assign a Manager');
    await expect(programmeManagerIds(transaction([{ code: 'P-ONE', managers: ['manager-a', 'manager-b'] }], ['manager-a', 'manager-b']), 'arus-org', ['P-ONE']))
      .rejects.toThrow('exactly one');
  });
});

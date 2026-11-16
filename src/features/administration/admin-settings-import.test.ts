import { describe, expect, it } from 'vitest';

import { createDefaultAdminSettings } from './admin-settings';
import {
  upsertAccountingCodesFromCsv,
  upsertProgrammesFromCsv,
} from './admin-settings-import';

describe('administration spreadsheet imports', () => {
  it('updates matching programmes and creates new programmes by code', () => {
    const settings = createDefaultAdminSettings();
    settings.programmes = [{ id: 'existing', code: 'ALPHA', name: 'Old', managerId: '', active: true }];
    const manager = settings.employees.find((employee) => employee.role === 'staff')!;
    const csv = `Programme Code,Programme Name,Manager Email,Active\nALPHA,Updated Alpha,${manager.email},Yes\nBETA,"Beta, North",,No`;

    const result = upsertProgrammesFromCsv(csv, settings.programmes, settings.employees);

    expect(result).toMatchObject({ created: 1, updated: 1 });
    expect(result.items).toEqual([
      { id: 'existing', code: 'ALPHA', name: 'Updated Alpha', managerId: manager.id, active: true },
      expect.objectContaining({ code: 'BETA', name: 'Beta, North', managerId: '', active: false }),
    ]);
  });

  it('rejects missing headers and unknown manager emails', () => {
    const settings = createDefaultAdminSettings();
    expect(() => upsertProgrammesFromCsv('Programme Code,Programme Name\nA,Alpha', [], settings.employees)).toThrow('Manager Email, Active');
    expect(() => upsertProgrammesFromCsv('Programme Code,Programme Name,Manager Email,Active\nA,Alpha,nobody@example.com,Yes', [], settings.employees)).toThrow('no active employee');
  });

  it('updates and creates accounting codes without deleting omitted codes', () => {
    const existing = [
      { id: 'one', code: '1000', name: 'Old', description: '', active: true },
      { id: 'keep', code: '2000', name: 'Keep', description: '', active: true },
    ];
    const result = upsertAccountingCodesFromCsv('Accounting Code,Account Name,Description,Active\n1000,New,Updated,True\n3000,Created,,False', existing);
    expect(result).toMatchObject({ created: 1, updated: 1 });
    expect(result.items.find((item) => item.code === '1000')).toMatchObject({ id: 'one', name: 'New', description: 'Updated' });
    expect(result.items.find((item) => item.code === '2000')?.name).toBe('Keep');
    expect(result.items.find((item) => item.code === '3000')?.active).toBe(false);
  });
});

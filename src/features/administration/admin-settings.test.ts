import { describe, expect, it } from 'vitest';

import { getBetaAccount } from '@/lib/auth/beta-accounts';
import {
  createDefaultAdminSettings,
  effectiveClaimPolicy,
  isProjectManagerAccount,
  managedProgrammesFor,
  projectManagerFor,
  travelProjectCodesFor,
} from './admin-settings';

describe('project-scoped manager settings', () => {
  it('keeps a project manager as Staff at organization level', () => {
    const nadia = getBetaAccount('nadia-hassan');
    const settings = createDefaultAdminSettings();

    expect(nadia?.role).toBe('staff');
    expect(isProjectManagerAccount(nadia, settings)).toBe(true);
    expect(managedProgrammesFor(nadia!.id, settings).length).toBeGreaterThan(0);
  });

  it('grants authority only for explicitly assigned active projects', () => {
    const settings = createDefaultAdminSettings();
    settings.programmes = [
      { id: 'a', code: 'PROJECT-A', name: 'Project A', managerId: 'afiq-rahman', active: true },
      { id: 'b', code: 'PROJECT-B', name: 'Project B', managerId: 'nadia-hassan', active: true },
      { id: 'c', code: 'PROJECT-C', name: 'Project C', managerId: 'afiq-rahman', active: false },
    ];

    expect(projectManagerFor('Project A', settings)).toBe('afiq-rahman');
    expect(projectManagerFor('PROJECT-B', settings)).toBe('nadia-hassan');
    expect(projectManagerFor('PROJECT-C', settings)).toBeUndefined();
    expect(managedProgrammesFor('afiq-rahman', settings).map((item) => item.code)).toEqual(['PROJECT-A']);
  });

  it('limits project Managers to assigned travel projects while Directors see all active projects', () => {
    const settings = createDefaultAdminSettings();
    settings.programmes = [
      { id: 'a', code: 'PROJECT-A', name: 'Project A', managerId: 'nadia-hassan', active: true },
      { id: 'b', code: 'PROJECT-B', name: 'Project B', managerId: 'afiq-rahman', active: true },
      { id: 'c', code: 'PROJECT-C', name: 'Project C', managerId: 'nadia-hassan', active: false },
    ];

    expect(travelProjectCodesFor(getBetaAccount('nadia-hassan'), settings)).toEqual(['PROJECT-A']);
    expect(travelProjectCodesFor(getBetaAccount('daniel-lee'), settings)).toEqual(['PROJECT-A', 'PROJECT-B']);
  });
});

describe('claim entitlement overrides', () => {
  it('uses organization defaults unless a per-person value overrides them', () => {
    const settings = createDefaultAdminSettings();
    settings.claimPolicy.medicalAnnualLimit = 1000;
    settings.claimPolicy.pdAnnualLimit = 500;
    settings.claimOverrides['afiq-rahman'] = { medicalAnnualLimit: 1400 };

    expect(effectiveClaimPolicy('afiq-rahman', settings)).toMatchObject({
      medicalAnnualLimit: 1400,
      pdAnnualLimit: 500,
    });
    expect(effectiveClaimPolicy('nadia-hassan', settings).medicalAnnualLimit).toBe(1000);
  });
});

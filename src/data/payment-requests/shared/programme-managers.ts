import type { Prisma } from '@prisma/client';

export async function programmeManagerIds(
  tx: Prisma.TransactionClient,
  organizationId: string,
  programmeCodes: string[],
) {
  const codes = [...new Set(programmeCodes.map((code) => code.trim().toUpperCase()))];
  if (!codes.length || codes.some((code) => !code)) {
    throw new Error('Choose a programme code for every request item.');
  }
  const programmes = await tx.betaProgramme.findMany({
    where: { code: { in: codes }, is_active: true },
    select: { code: true, manager_id: true },
  });
  const byCode = new Map(programmes.map((programme) => [programme.code, programme.manager_id]));
  for (const code of codes) {
    if (!byCode.get(code)) throw new Error(`Assign a Manager to programme ${code} in Settings before submitting.`);
  }
  const managerIds = [...new Set(codes.map((code) => byCode.get(code)!))];
  const memberships = await tx.userOrgMembership.findMany({
    where: {
      organization_id: organizationId,
      user_id: { in: managerIds },
      is_active: true,
      membership_status: 'ACTIVE',
    },
    select: { user_id: true },
  });
  const activeIds = new Set(memberships.map((membership) => membership.user_id));
  if (managerIds.some((id) => !activeIds.has(id))) {
    throw new Error('A programme Manager is not an active member of this organization.');
  }
  return managerIds;
}

export function requireSameManagerIds(assigned: string[], submitted: string[]) {
  const actual = new Set(submitted);
  if (actual.size !== assigned.length || assigned.some((id) => !actual.has(id))) {
    throw new Error('The programme Manager assignment changed. Reload the form and submit again.');
  }
}

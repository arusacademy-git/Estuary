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
  const now = new Date();
  const programmes = await tx.project.findMany({
    where: { organization_id: organizationId, code: { in: codes }, is_active: true, is_archived: false },
    select: {
      code: true,
      manager_assignments: {
        where: {
          is_active: true,
          effective_from: { lte: now },
          OR: [{ effective_until: null }, { effective_until: { gt: now } }],
        },
        select: {
          membership: { select: { user_id: true, is_active: true, membership_status: true } },
        },
      },
    },
  });
  const byCode = new Map(programmes.map((programme) => [
    programme.code,
    programme.manager_assignments
      .filter((assignment) => assignment.membership.is_active && assignment.membership.membership_status === 'ACTIVE')
      .map((assignment) => assignment.membership.user_id),
  ]));
  for (const code of codes) {
    const assigned = byCode.get(code);
    if (!assigned?.length) throw new Error(`Assign a Manager to programme ${code} in Settings before submitting.`);
    if (assigned.length !== 1) throw new Error(`Programme ${code} must have exactly one active Manager.`);
  }
  return [...new Set(codes.map((code) => byCode.get(code)![0]))];
}

export function requireSameManagerIds(assigned: string[], submitted: string[]) {
  const actual = new Set(submitted);
  if (actual.size !== assigned.length || assigned.some((id) => !actual.has(id))) {
    throw new Error('The programme Manager assignment changed. Reload the form and submit again.');
  }
}

import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { betaAccounts } from '@/lib/auth/beta-accounts';
import { createDefaultAdminSettings, type AdminProgramme } from '@/features/administration/admin-settings';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const betaOrganizationId = 'beta-arus-org';
const hiddenSeedCodes = new Set(['GENERAL', 'PROGRAMME']);
const programmeSchema = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  managerId: z.string().trim(),
  active: z.boolean(),
});
const updateSchema = z.object({
  actorId: z.string().trim().min(1),
  programmes: z.array(programmeSchema).min(1).max(200),
});

async function directory(): Promise<AdminProgramme[]> {
  const rows = await prisma.project.findMany({
    where: { organization_id: betaOrganizationId, code: { notIn: [...hiddenSeedCodes] } },
    orderBy: { code: 'asc' },
    include: {
      manager_assignments: {
        where: { is_active: true },
        include: { membership: true },
      },
    },
  });
  const byCode = new Map(rows.map((row) => [row.code, row]));
  const defaults = createDefaultAdminSettings().programmes;
  const listed = defaults.flatMap((item) => {
    const row = byCode.get(item.code);
    if (row?.is_archived) return [];
    return [row ? {
      id: row.id, code: row.code, name: row.name,
      managerId: row.manager_assignments[0]?.membership.user_id ?? '', active: row.is_active,
    } : item];
  });
  const defaultCodes = new Set(defaults.map((item) => item.code));
  return [...listed, ...rows.filter((row) => !row.is_archived && !defaultCodes.has(row.code)).map((row) => ({
    id: row.id, code: row.code, name: row.name,
    managerId: row.manager_assignments[0]?.membership.user_id ?? '', active: row.is_active,
  }))];
}

export async function GET() {
  try { return dataResponse(await directory()); }
  catch { return Response.json({ message: 'Programme settings could not be loaded.' }, { status: 503 }); }
}

export async function PUT(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'The programme directory is invalid.' }, { status: 400 });
  const { actorId, programmes } = parsed.data;
  if (!betaAccounts.some((account) => account.id === actorId && account.isAdministrator)) {
    return Response.json({ message: 'Administrator access required.' }, { status: 403 });
  }
  const ids = new Set(programmes.map((item) => item.id));
  const codes = new Set(programmes.map((item) => item.code.toUpperCase()));
  if (ids.size !== programmes.length || codes.size !== programmes.length || programmes.some((item) => hiddenSeedCodes.has(item.code.toUpperCase()) || item.managerId && !betaAccounts.some((account) => account.id === item.managerId))) {
    return Response.json({ message: 'Programme codes, IDs and Manager accounts must be valid and unique.' }, { status: 400 });
  }
  try {
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({ where: { id: betaOrganizationId }, select: { id: true } });
      if (!organization) throw new Error('The beta organization was not found.');
      const managerIds = [...new Set(programmes.map((item) => item.managerId).filter(Boolean))];
      const memberships = await tx.userOrgMembership.findMany({
        where: { organization_id: betaOrganizationId, user_id: { in: managerIds }, is_active: true, membership_status: 'ACTIVE' },
        select: { id: true, user_id: true },
      });
      const membershipByUser = new Map(memberships.map((membership) => [membership.user_id, membership.id]));
      if (managerIds.some((id) => !membershipByUser.has(id))) throw new Error('A selected Manager is not an active member of this organization.');

      await tx.project.updateMany({
        where: { organization_id: betaOrganizationId, code: { notIn: [...codes, ...hiddenSeedCodes] }, is_archived: false },
        data: { is_archived: true, is_active: false },
      });
      for (const item of programmes) {
        const code = item.code.toUpperCase();
        const existingById = await tx.project.findFirst({ where: { id: item.id, organization_id: betaOrganizationId }, select: { id: true } });
        const project = existingById
          ? await tx.project.update({ where: { id: item.id }, data: { code, name: item.name, is_active: item.active, is_archived: false } })
          : await tx.project.upsert({
            where: { organization_id_code: { organization_id: betaOrganizationId, code } },
            update: { name: item.name, is_active: item.active, is_archived: false },
            create: { id: item.id, organization_id: betaOrganizationId, code, name: item.name, is_active: item.active },
          });
        await tx.projectManagerAssignment.updateMany({ where: { project_id: project.id }, data: { is_active: false } });
        if (item.managerId) {
          const membershipId = membershipByUser.get(item.managerId)!;
          await tx.projectManagerAssignment.upsert({
            where: { project_id_membership_id: { project_id: project.id, membership_id: membershipId } },
            update: { is_active: true, effective_from: new Date(), effective_until: null },
            create: { project_id: project.id, membership_id: membershipId },
          });
        }
      }
    });
    return dataResponse(await directory());
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : 'The programme directory could not be saved.' }, { status: 503 });
  }
}

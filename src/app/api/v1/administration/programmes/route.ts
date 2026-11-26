import { z } from "zod";

import {
  createDefaultAdminSettings,
  type AdminProgramme,
} from "@/features/administration/admin-settings";
import { dataResponse } from "@/lib/api/response";
import { betaAccounts } from "@/lib/auth/beta-accounts";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const betaOrganizationId = "beta-arus-org";
const hiddenSeedCodes = new Set(["GENERAL", "PROGRAMME"]);
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

const projectInclude = {
  manager_assignments: {
    where: { is_active: true },
    include: { membership: true },
  },
} as const;

async function directory(): Promise<AdminProgramme[]> {
  const rows = await prisma.project.findMany({
    where: {
      organization_id: betaOrganizationId,
      code: { notIn: [...hiddenSeedCodes] },
    },
    orderBy: { code: "asc" },
    include: projectInclude,
  });
  const byCode = new Map(rows.map((row) => [row.code, row]));
  const defaults = createDefaultAdminSettings().programmes;
  const listed = defaults.flatMap((item) => {
    const row = byCode.get(item.code);
    if (row?.is_archived) return [];
    return [
      row
        ? {
            id: row.id,
            code: row.code,
            name: row.name,
            managerId: row.manager_assignments[0]?.membership.user_id ?? "",
            active: row.is_active,
          }
        : item,
    ];
  });
  const defaultCodes = new Set(defaults.map((item) => item.code));
  return [
    ...listed,
    ...rows
      .filter((row) => !row.is_archived && !defaultCodes.has(row.code))
      .map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        managerId: row.manager_assignments[0]?.membership.user_id ?? "",
        active: row.is_active,
      })),
  ];
}

export async function GET() {
  try {
    return dataResponse(await directory());
  } catch {
    return Response.json(
      { message: "Programme settings could not be loaded." },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { message: "The programme directory is invalid." },
      { status: 400 },
    );
  }
  const { actorId, programmes } = parsed.data;
  if (
    !betaAccounts.some(
      (account) => account.id === actorId && account.isAdministrator,
    )
  ) {
    return Response.json(
      { message: "Administrator access required." },
      { status: 403 },
    );
  }

  const ids = new Set(programmes.map((item) => item.id));
  const codes = new Set(programmes.map((item) => item.code.toUpperCase()));
  const invalidDirectory =
    ids.size !== programmes.length ||
    codes.size !== programmes.length ||
    programmes.some(
      (item) =>
        hiddenSeedCodes.has(item.code.toUpperCase()) ||
        (item.managerId &&
          !betaAccounts.some((account) => account.id === item.managerId)),
    );
  if (invalidDirectory) {
    return Response.json(
      {
        message:
          "Programme codes, IDs and Manager accounts must be valid and unique.",
      },
      { status: 400 },
    );
  }

  try {
    const managerIds = [
      ...new Set(programmes.map((item) => item.managerId).filter(Boolean)),
    ];
    const [organization, memberships, existingProjects] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: betaOrganizationId },
        select: { id: true },
      }),
      prisma.userOrgMembership.findMany({
        where: {
          organization_id: betaOrganizationId,
          user_id: { in: managerIds },
          is_active: true,
          membership_status: "ACTIVE",
        },
        select: { id: true, user_id: true },
      }),
      prisma.project.findMany({
        where: { organization_id: betaOrganizationId },
        include: projectInclude,
      }),
    ]);
    if (!organization) throw new Error("The beta organization was not found.");

    const membershipByUser = new Map(
      memberships.map((membership) => [membership.user_id, membership.id]),
    );
    if (managerIds.some((id) => !membershipByUser.has(id))) {
      throw new Error(
        "A selected Manager is not an active member of this organization.",
      );
    }

    const existingById = new Map(
      existingProjects.map((project) => [project.id, project]),
    );
    const existingByCode = new Map(
      existingProjects.map((project) => [project.code, project]),
    );
    const normalized = programmes.map((item) => {
      const code = item.code.toUpperCase();
      const existing = existingById.get(item.id) ?? existingByCode.get(code);
      return {
        ...item,
        code,
        projectId: existing?.id ?? item.id,
        existing,
      };
    });
    const newProjects = normalized.filter((item) => !item.existing);
    const changedProjects = normalized.filter(
      (item) =>
        item.existing &&
        (item.existing.code !== item.code ||
          item.existing.name !== item.name ||
          item.existing.is_active !== item.active ||
          item.existing.is_archived),
    );
    const changedManagers = normalized.filter((item) => {
      const currentManagerIds =
        item.existing?.manager_assignments.map(
          (assignment) => assignment.membership.user_id,
        ) ?? [];
      return item.managerId
        ? currentManagerIds.length !== 1 ||
            currentManagerIds[0] !== item.managerId
        : currentManagerIds.length > 0;
    });
    const now = new Date();

    await prisma.$transaction(async (transaction) => {
      await transaction.project.updateMany({
        where: {
          organization_id: betaOrganizationId,
          code: { notIn: [...codes, ...hiddenSeedCodes] },
          is_archived: false,
        },
        data: { is_archived: true, is_active: false },
      });

      if (newProjects.length) {
        await transaction.project.createMany({
          data: newProjects.map((item) => ({
            id: item.projectId,
            organization_id: betaOrganizationId,
            code: item.code,
            name: item.name,
            is_active: item.active,
            is_archived: false,
          })),
          skipDuplicates: true,
        });
      }

      for (const item of changedProjects) {
        await transaction.project.update({
          where: { id: item.projectId },
          data: {
            code: item.code,
            name: item.name,
            is_active: item.active,
            is_archived: false,
          },
        });
      }

      const managerProjectIds = changedManagers.map((item) => item.projectId);
      if (managerProjectIds.length) {
        await transaction.projectManagerAssignment.updateMany({
          where: {
            project_id: { in: managerProjectIds },
            is_active: true,
          },
          data: { is_active: false, effective_until: now },
        });
      }
      for (const item of changedManagers) {
        if (!item.managerId) continue;
        const membershipId = membershipByUser.get(item.managerId);
        if (!membershipId) continue;
        await transaction.projectManagerAssignment.upsert({
          where: {
            project_id_membership_id: {
              project_id: item.projectId,
              membership_id: membershipId,
            },
          },
          update: {
            is_active: true,
            effective_from: now,
            effective_until: null,
          },
          create: {
            project_id: item.projectId,
            membership_id: membershipId,
          },
        });
      }
    });

    return dataResponse(await directory());
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "The programme directory could not be saved.",
      },
      { status: 503 },
    );
  }
}

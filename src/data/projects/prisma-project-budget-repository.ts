import { MembershipStatus, OrgRole, Prisma } from "@prisma/client";

import type {
    ProjectBudgetList,
    ProjectBudgetRecord,
    ReplaceProjectBudgetsInput,
} from "@/domain/projects/project-budget-types";
import { prisma } from "@/lib/db/prisma";

const ADMIN_ROLES = [OrgRole.OWNER, OrgRole.DIRECTOR];

async function requireAdministrator(organizationId: string, actorId: string) {
    const membership = await prisma.userOrgMembership.findFirst({
        where: {
            organization_id: organizationId,
            user_id: actorId,
            is_active: true,
            membership_status: MembershipStatus.ACTIVE,
            roles: { some: { role: { in: ADMIN_ROLES } } },
        },
        select: { id: true },
    });

    if (!membership) throw new Error("Administration access is required.");
}

function mapBudget(record: {
    id: string;
    projectId: string;
    year: number;
    amount: Prisma.Decimal;
    updatedAt: Date;
    project: { code: string; name: string };
}): ProjectBudgetRecord {
    return {
        id: record.id,
        projectId: record.projectId,
        projectCode: record.project.code,
        projectName: record.project.name,
        year: record.year,
        amount: record.amount.toFixed(2),
        updatedAt: record.updatedAt.toISOString(),
    };
}

async function listForYear(
    organizationId: string,
    year: number,
): Promise<ProjectBudgetList> {
    const budgets = await prisma.projectBudget.findMany({
        where: {
            year,
            project: { organization_id: organizationId },
        },
        include: { project: { select: { code: true, name: true } } },
        orderBy: { project: { code: "asc" } },
    });

    return { year, budgets: budgets.map(mapBudget) };
}

export async function listProjectBudgetsFromDatabase(
    organizationId: string,
    actorId: string,
    year: number,
) {
    await requireAdministrator(organizationId, actorId);
    return listForYear(organizationId, year);
}

export async function replaceProjectBudgetsInDatabase(
    input: ReplaceProjectBudgetsInput,
) {
    await requireAdministrator(input.organizationId, input.actorId);

    const projectIds = input.budgets.map((budget) => budget.projectId);
    const uniqueProjectIds = new Set(projectIds);
    if (uniqueProjectIds.size !== projectIds.length) {
        throw new Error("Each project can only have one budget per year.");
    }

    const projects = await prisma.project.findMany({
        where: {
            id: { in: projectIds },
            organization_id: input.organizationId,
            is_active: true,
        },
        select: { id: true },
    });
    if (projects.length !== projectIds.length) {
        throw new Error(
            "Every budget must reference an active project in this organization.",
        );
    }

    await prisma.$transaction(async (transaction) => {
        await transaction.projectBudget.deleteMany({
            where: {
                year: input.year,
                project: { organization_id: input.organizationId },
            },
        });

        if (input.budgets.length > 0) {
            await transaction.projectBudget.createMany({
                data: input.budgets.map((budget) => ({
                    projectId: budget.projectId,
                    year: input.year,
                    amount: new Prisma.Decimal(budget.amount),
                })),
            });
        }
    });

    return listForYear(input.organizationId, input.year);
}

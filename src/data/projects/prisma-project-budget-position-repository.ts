import { MembershipStatus, OrgRole, Prisma } from "@prisma/client";

import type {
    ProjectBudgetPosition,
    ProjectBudgetPositionList,
    ProjectBudgetCheckInput,
    ProjectBudgetCheckResult,
    ProjectBudgetWarning,
} from "@/domain/projects/project-budget-types";
import { prisma } from "@/lib/db/prisma";
import { classifyProjectBudgetSubmission } from "./project-budget-position-policy";

const organizationWideRoles = new Set<OrgRole>([
    OrgRole.OWNER,
    OrgRole.DIRECTOR,
    OrgRole.FINANCE_ADMIN,
]);

async function readableProjectIds(
    organizationId: string,
    actorId: string,
    organizationMemberScope = false,
) {
    const membership = await prisma.userOrgMembership.findFirst({
        where: {
            organization_id: organizationId,
            user_id: actorId,
            is_active: true,
            membership_status: MembershipStatus.ACTIVE,
        },
        select: {
            roles: { select: { role: true } },
            managed_projects: {
                where: {
                    is_active: true,
                    OR: [
                        { effective_until: null },
                        { effective_until: { gte: new Date() } },
                    ],
                },
                select: { project_id: true },
            },
        },
    });
    if (!membership) throw new Error("Active organization access is required.");
    if (organizationMemberScope) return null;

    const organizationWide = membership.roles.some(({ role }) =>
        organizationWideRoles.has(role),
    );
    if (organizationWide) return null;

    const projectIds = membership.managed_projects.map(
        (assignment) => assignment.project_id,
    );
    if (!projectIds.length) {
        throw new Error("Project budget access is required.");
    }
    return projectIds;
}

const decimal = (value: Prisma.Decimal) => Number(value.toString());
const fixed = (value: number) => value.toFixed(2);
const normalizeReference = (value: string) =>
    value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotProjectReference(
    transitions: Array<{ action_code: string; metadata_json: unknown }>,
) {
    for (const transition of [...transitions].reverse()) {
        if (!["CREATE", "RESUBMIT"].includes(transition.action_code)) continue;
        const metadata = transition.metadata_json;
        if (!isRecord(metadata) || !isRecord(metadata.snapshot)) continue;
        const division = metadata.snapshot.division;
        if (typeof division === "string" && division.trim()) return division.trim();
    }
    return null;
}

export async function listProjectBudgetPositionsFromDatabase(
    organizationId: string,
    actorId: string,
    year: number,
    organizationMemberScope = false,
): Promise<ProjectBudgetPositionList> {
    const projectIds = await readableProjectIds(
        organizationId,
        actorId,
        organizationMemberScope,
    );
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));

    const [projects, unlinkedPaymentVoucherLines] = await Promise.all([
        prisma.project.findMany({
            where: {
                organization_id: organizationId,
                is_active: true,
                ...(projectIds ? { id: { in: projectIds } } : {}),
            },
            select: {
                id: true,
                code: true,
                name: true,
                budgets: {
                    where: { year },
                    select: { amount: true },
                    take: 1,
                },
                submission_lines: {
                    where: {
                        submission: {
                            organization_id: organizationId,
                            OR: [
                                { submitted_at: { gte: yearStart, lt: nextYearStart } },
                                {
                                    submitted_at: null,
                                    created_at: { gte: yearStart, lt: nextYearStart },
                                },
                            ],
                        },
                    },
                    select: {
                        amount: true,
                        submission: {
                            select: {
                                payment_type: true,
                                current_state_code: true,
                                current_state_group: true,
                                transitions: { select: { action_code: true } },
                                ca_detail: {
                                    select: {
                                        paid_at: true,
                                        reconciliation_closed_at: true,
                                        reconciliation_outcome: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { code: "asc" },
        }),
        prisma.submissionLine.findMany({
            where: {
                project_id: null,
                submission: {
                    organization_id: organizationId,
                    payment_type: "PAYMENT_VOUCHER",
                    OR: [
                        { submitted_at: { gte: yearStart, lt: nextYearStart } },
                        {
                            submitted_at: null,
                            created_at: { gte: yearStart, lt: nextYearStart },
                        },
                    ],
                },
            },
            select: {
                amount: true,
                submission: {
                    select: {
                        payment_type: true,
                        current_state_code: true,
                        current_state_group: true,
                        transitions: {
                            where: { action_code: { in: ["CREATE", "RESUBMIT"] } },
                            orderBy: { created_at: "asc" },
                            select: { action_code: true, metadata_json: true },
                        },
                    },
                },
            },
        }),
    ]);

    const fallbackByProject = new Map<
        string,
        { spent: number; committed: number }
    >();
    for (const line of unlinkedPaymentVoucherLines) {
        const reference = snapshotProjectReference(line.submission.transitions);
        if (!reference) continue;
        const normalized = normalizeReference(reference);
        const project = projects.find((item) =>
            [item.id, item.code, item.name].some(
                (value) => normalizeReference(value) === normalized,
            ),
        );
        if (!project) continue;
        const bucket = classifyProjectBudgetSubmission({
            paymentType: line.submission.payment_type,
            stateCode: line.submission.current_state_code,
            stateGroup: line.submission.current_state_group,
        });
        const current = fallbackByProject.get(project.id) ?? {
            spent: 0,
            committed: 0,
        };
        const amount = decimal(line.amount);
        if (bucket === "SPENT") current.spent += amount;
        if (bucket === "COMMITTED") current.committed += amount;
        fallbackByProject.set(project.id, current);
    }

    const positions: ProjectBudgetPosition[] = projects.map((project) => {
        let spent = fallbackByProject.get(project.id)?.spent ?? 0;
        let committed = fallbackByProject.get(project.id)?.committed ?? 0;
        for (const line of project.submission_lines) {
            const bucket = classifyProjectBudgetSubmission({
                paymentType: line.submission.payment_type,
                stateCode: line.submission.current_state_code,
                stateGroup: line.submission.current_state_group,
                transitionActions: line.submission.transitions.map(
                    (transition) => transition.action_code,
                ),
                cashAdvancePaidAt: line.submission.ca_detail?.paid_at,
                cashAdvanceReconciledAt:
                    line.submission.ca_detail?.reconciliation_closed_at,
                cashAdvanceReconciliationOutcome:
                    line.submission.ca_detail?.reconciliation_outcome,
            });
            const amount = decimal(line.amount);
            if (bucket === "SPENT") spent += amount;
            if (bucket === "COMMITTED") committed += amount;
        }

        const configured = Boolean(project.budgets[0]);
        const budget = configured ? decimal(project.budgets[0].amount) : null;
        const available = budget === null ? null : budget - spent - committed;
        return {
            projectId: project.id,
            projectCode: project.code,
            projectName: project.name,
            configured,
            budget: budget === null ? null : fixed(budget),
            spent: fixed(spent),
            committed: fixed(committed),
            available: available === null ? null : fixed(available),
            overBudget: available !== null && available < 0,
        };
    });

    const configured = positions.filter((position) => position.configured);
    const totals = configured.reduce(
        (sum, position) => ({
            budget: sum.budget + Number(position.budget),
            spent: sum.spent + Number(position.spent),
            committed: sum.committed + Number(position.committed),
            available: sum.available + Number(position.available),
        }),
        { budget: 0, spent: 0, committed: 0, available: 0 },
    );

    return {
        year,
        positions,
        totals: {
            budget: fixed(totals.budget),
            spent: fixed(totals.spent),
            committed: fixed(totals.committed),
            available: fixed(totals.available),
        },
    };
}

export async function checkProjectBudgetFromDatabase(
    input: ProjectBudgetCheckInput,
): Promise<ProjectBudgetCheckResult> {
    const positionList = await listProjectBudgetPositionsFromDatabase(
        input.organizationId,
        input.actorId,
        input.year,
        true,
    );
    const grouped = new Map<string, number>();
    for (const allocation of input.allocations) {
        const reference = allocation.projectReference.trim();
        if (!reference || allocation.amount <= 0) continue;
        grouped.set(reference, (grouped.get(reference) ?? 0) + allocation.amount);
    }

    const warnings: ProjectBudgetWarning[] = [];
    for (const [reference, requested] of grouped) {
        const normalized = normalizeReference(reference);
        const position = positionList.positions.find((item) =>
            [item.projectId, item.projectCode, item.projectName].some(
                (value) => normalizeReference(value) === normalized,
            ),
        );
        if (!position || !position.configured || position.available === null) {
            warnings.push({
                projectId: position?.projectId ?? null,
                projectReference: reference,
                projectCode: position?.projectCode ?? null,
                projectName: position?.projectName ?? reference,
                requested: fixed(requested),
                available: null,
                overBy: null,
                reason: "NOT_CONFIGURED" as const,
            });
            continue;
        }
        const available = Number(position.available);
        if (requested <= available) continue;
        warnings.push({
            projectId: position.projectId,
            projectReference: reference,
            projectCode: position.projectCode,
            projectName: position.projectName,
            requested: fixed(requested),
            available: fixed(available),
            overBy: fixed(requested - available),
            reason: "INSUFFICIENT" as const,
        });
    }
    return { year: input.year, warnings };
}

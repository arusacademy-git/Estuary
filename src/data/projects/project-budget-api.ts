import type {
    ProjectBudgetList,
    ProjectBudgetCheckInput,
    ProjectBudgetCheckResult,
    ProjectBudgetPositionList,
    ReplaceProjectBudgetsInput,
} from "@/domain/projects/project-budget-types";

type Envelope<T> = { data?: T; message?: string };

async function read<T>(response: Response) {
    const body = (await response.json().catch(() => null)) as Envelope<T> | null;
    if (!response.ok) {
        throw new Error(
            body?.message ?? `Project budget request failed (${response.status}).`,
        );
    }
    if (!body || body.data === undefined) {
        throw new Error("The Project Budget API returned no data.");
    }
    return body.data;
}

export async function checkProjectBudgets(input: ProjectBudgetCheckInput) {
    return read<ProjectBudgetCheckResult>(
        await fetch("/api/v1/project-budgets/check", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
}

export async function fetchProjectBudgets(
    organizationId: string,
    actorId: string,
    year: number,
) {
    const query = new URLSearchParams({
        organizationId,
        actorId,
        year: String(year),
    });
    return read<ProjectBudgetList>(
        await fetch(`/api/v1/project-budgets?${query}`, { cache: "no-store" }),
    );
}

export async function replaceProjectBudgets(input: ReplaceProjectBudgetsInput) {
    return read<ProjectBudgetList>(
        await fetch("/api/v1/project-budgets", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
        }),
    );
}

export async function fetchProjectBudgetPositions(
    organizationId: string,
    actorId: string,
    year: number,
) {
    const query = new URLSearchParams({
        organizationId,
        actorId,
        year: String(year),
    });
    return read<ProjectBudgetPositionList>(
        await fetch(`/api/v1/project-budgets/position?${query}`, {
            cache: "no-store",
        }),
    );
}

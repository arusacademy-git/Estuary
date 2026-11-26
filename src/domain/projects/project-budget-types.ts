export type ProjectBudgetRecord = {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  year: number;
  amount: string;
  updatedAt: string;
};

export type ProjectBudgetList = {
  year: number;
  budgets: ProjectBudgetRecord[];
};

export type ReplaceProjectBudgetsInput = {
  organizationId: string;
  actorId: string;
  year: number;
  budgets: Array<{
    projectId: string;
    amount: string;
  }>;
};

export type ProjectBudgetPosition = {
  projectId: string;
  projectCode: string;
  projectName: string;
  configured: boolean;
  budget: string | null;
  spent: string;
  committed: string;
  available: string | null;
  overBudget: boolean;
};

export type ProjectBudgetPositionList = {
  year: number;
  positions: ProjectBudgetPosition[];
  totals: {
    budget: string;
    spent: string;
    committed: string;
    available: string;
  };
};

export type ProjectBudgetCheckInput = {
  organizationId: string;
  actorId: string;
  year: number;
  allocations: Array<{ projectReference: string; amount: number }>;
};

export type ProjectBudgetWarning = {
  projectId: string | null;
  projectReference: string;
  projectCode: string | null;
  projectName: string;
  requested: string;
  available: string | null;
  overBy: string | null;
  reason: "NOT_CONFIGURED" | "INSUFFICIENT";
};

export type ProjectBudgetCheckResult = {
  year: number;
  warnings: ProjectBudgetWarning[];
};

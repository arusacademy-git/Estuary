CREATE TABLE "project_budgets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_budgets_project_id_year_key"
ON "project_budgets"("project_id", "year");

CREATE INDEX "project_budgets_project_id_idx"
ON "project_budgets"("project_id");

CREATE INDEX "project_budgets_year_idx"
ON "project_budgets"("year");

ALTER TABLE "project_budgets"
ADD CONSTRAINT "project_budgets_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Manager authority belongs to a project assignment, not an organization role.
CREATE TABLE "project_manager_assignments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_manager_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_manager_assignments_project_id_membership_id_key"
ON "project_manager_assignments"("project_id", "membership_id");

CREATE INDEX "project_manager_assignments_membership_id_is_active_idx"
ON "project_manager_assignments"("membership_id", "is_active");

ALTER TABLE "project_manager_assignments"
ADD CONSTRAINT "project_manager_assignments_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_manager_assignments"
ADD CONSTRAINT "project_manager_assignments_membership_id_fkey"
FOREIGN KEY ("membership_id") REFERENCES "user_org_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

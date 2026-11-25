-- Preserve configured beta programme Managers in the project-scoped tables.
-- Beta requests currently use beta-arus-org; other organizations manage their
-- own ProjectManagerAssignment rows independently.
ALTER TABLE "projects" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "projects" ("id", "organization_id", "code", "name", "is_active", "created_at")
SELECT 'programme-' || md5(p."organization_id" || ':' || b."code"),
       p."organization_id", b."code", b."name", b."is_active", CURRENT_TIMESTAMP
FROM (SELECT "id" AS "organization_id" FROM "organizations" WHERE "id" = 'beta-arus-org') p
CROSS JOIN "beta_programmes" b
ON CONFLICT ("organization_id", "code")
DO UPDATE SET "name" = EXCLUDED."name", "is_active" = EXCLUDED."is_active";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "beta_programmes" b
    WHERE b."manager_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "user_org_memberships" m
        WHERE m."organization_id" = 'beta-arus-org' AND m."user_id" = b."manager_id"
      )
  ) THEN
    RAISE EXCEPTION 'A beta programme Manager has no beta-arus-org membership; preserve that assignment before dropping beta_programmes';
  END IF;
END $$;

UPDATE "project_manager_assignments" a SET "is_active" = false, "updated_at" = CURRENT_TIMESTAMP
WHERE a."project_id" IN (
  SELECT p."id" FROM "projects" p
  JOIN "beta_programmes" b ON b."code" = p."code"
  WHERE p."organization_id" = 'beta-arus-org'
);

INSERT INTO "project_manager_assignments"
  ("id", "project_id", "membership_id", "is_active", "effective_from", "created_at", "updated_at")
SELECT 'pma-' || md5(p."id" || ':' || m."id"), p."id", m."id", true,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "beta_programmes" b
JOIN "projects" p ON p."organization_id" = 'beta-arus-org' AND p."code" = b."code"
JOIN "user_org_memberships" m ON m."organization_id" = p."organization_id" AND m."user_id" = b."manager_id"
WHERE b."manager_id" IS NOT NULL
ON CONFLICT ("project_id", "membership_id")
DO UPDATE SET "is_active" = true, "effective_from" = CURRENT_TIMESTAMP,
              "effective_until" = NULL, "updated_at" = CURRENT_TIMESTAMP;

DROP TABLE "beta_programmes";

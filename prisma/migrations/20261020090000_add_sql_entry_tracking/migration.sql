-- CreateEnum
CREATE TYPE "SqlEntryStatus" AS ENUM ('PENDING_ENTRY', 'RECORDED_IN_SQL_SYSTEM', 'NEEDS_CORRECTION', 'NOT_REQUIRED');

-- CreateTable
CREATE TABLE "sql_entry_tracking" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "status" "SqlEntryStatus" NOT NULL DEFAULT 'PENDING_ENTRY',
    "sql_reference" VARCHAR(100),
    "recorded_at" TIMESTAMP(3),
    "notes" VARCHAR(500),
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sql_entry_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sql_entry_tracking_submission_id_key" ON "sql_entry_tracking"("submission_id");

-- CreateIndex
CREATE INDEX "sql_entry_tracking_status_idx" ON "sql_entry_tracking"("status");

-- CreateIndex
CREATE INDEX "sql_entry_tracking_recorded_at_idx" ON "sql_entry_tracking"("recorded_at");

-- CreateIndex
CREATE INDEX "sql_entry_tracking_updated_by_id_idx" ON "sql_entry_tracking"("updated_by_id");

-- AddForeignKey
ALTER TABLE "sql_entry_tracking" ADD CONSTRAINT "sql_entry_tracking_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sql_entry_tracking" ADD CONSTRAINT "sql_entry_tracking_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "payment_request_drafts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "payment_type" TEXT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_request_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_request_drafts_organization_id_requester_id_payment_key" ON "payment_request_drafts"("organization_id", "requester_id", "payment_type");

-- CreateIndex
CREATE INDEX "payment_request_drafts_requester_id_updated_at_idx" ON "payment_request_drafts"("requester_id", "updated_at");

-- AddForeignKey
ALTER TABLE "payment_request_drafts" ADD CONSTRAINT "payment_request_drafts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_drafts" ADD CONSTRAINT "payment_request_drafts_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

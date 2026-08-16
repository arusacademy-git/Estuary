-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'FINANCE_ADMIN', 'DIRECTOR', 'MANAGER', 'STAFF', 'PETTY_CASH_CUSTODIAN');

-- CreateEnum
CREATE TYPE "StateGroup" AS ENUM ('DRAFT', 'IN_REVIEW', 'AWAITING_DOCUMENT', 'AWAITING_EXTERNAL_ACTION', 'PENDING_VERIFICATION', 'COMPLETE', 'REJECTED', 'OVERDUE', 'VOIDED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('INTERNAL_USER', 'EXTERNAL_RECIPIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PAYMENT_VOUCHER', 'INVOICE_PAYMENT', 'CASH_ADVANCE', 'TRAVEL_ALLOWANCE', 'EXPENSE_CLAIM', 'PETTY_CASH_TOPUP');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'IBG', 'DUITNOW');

-- CreateEnum
CREATE TYPE "SignatureMethod" AS ENUM ('DIGITAL', 'UPLOAD');

-- CreateEnum
CREATE TYPE "ReconOutcome" AS ENUM ('EXACT', 'UNDERSPEND', 'OVERSPEND');

-- CreateEnum
CREATE TYPE "PettyCashEntryType" AS ENUM ('DISBURSEMENT', 'TOPUP', 'RECONCILIATION');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registration_no" TEXT NOT NULL,
    "registered_address" TEXT NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'MYR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_org_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "membership_status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "agent_id" TEXT,
    "default_area_id" TEXT,
    "signature_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_org_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_org_roles" (
    "id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_org_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "admin_next_sequence" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "current_state_code" TEXT NOT NULL DEFAULT 'BATCH_DRAFT',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" TEXT NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_states" (
    "id" TEXT NOT NULL,
    "workflow_definition_id" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "state_group" "StateGroup" NOT NULL,
    "label" TEXT NOT NULL,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transition_rules" (
    "id" TEXT NOT NULL,
    "workflow_definition_id" TEXT NOT NULL,
    "from_state_code" TEXT NOT NULL,
    "action_code" TEXT NOT NULL,
    "to_state_code" TEXT NOT NULL,
    "allowed_actor_type" "ActorType" NOT NULL,
    "allowed_role" "OrgRole",
    "requires_reason" BOOLEAN NOT NULL DEFAULT false,
    "requires_document" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "workflow_transition_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "payment_type" "PaymentType" NOT NULL,
    "workflow_definition_id" TEXT,
    "current_state_code" TEXT NOT NULL DEFAULT 'DRAFT_INITIALIZING',
    "current_state_group" "StateGroup" NOT NULL DEFAULT 'DRAFT',
    "current_assignee_id" TEXT,
    "submission_number" TEXT,
    "submitted_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "agent_id" TEXT,
    "area_id" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_lines" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "gl_account_id" TEXT,
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_transitions" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "from_state_code" TEXT NOT NULL,
    "action_code" TEXT NOT NULL,
    "to_state_code" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_user_id" TEXT,
    "actor_membership_id" TEXT,
    "reason_text" TEXT,
    "request_ip" TEXT,
    "request_user_agent" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_evidence" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "evidence_type_code" TEXT NOT NULL,
    "source_transition_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_voucher_details" (
    "submission_id" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_ic" TEXT,
    "recipient_email" TEXT NOT NULL,
    "recipient_phone" TEXT,
    "recipient_bank_name" TEXT,
    "recipient_bank_account" TEXT,
    "payment_mode" "PaymentMode" NOT NULL DEFAULT 'BANK_TRANSFER',
    "paid_at" TIMESTAMP(3),
    "paid_reference" TEXT,
    "payment_proof_document_id" TEXT,
    "being_text" TEXT,
    "issued_document_id" TEXT,
    "signed_document_id" TEXT,
    "signature_method" "SignatureMethod",
    "signature_requested_at" TIMESTAMP(3),
    "signature_collected_at" TIMESTAMP(3),
    "signature_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_voucher_details_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "cash_advance_details" (
    "submission_id" TEXT NOT NULL,
    "purpose_text" TEXT,
    "manager_user_id" TEXT,
    "director_user_id" TEXT,
    "payment_mode" "PaymentMode",
    "paid_at" TIMESTAMP(3),
    "paid_reference" TEXT,
    "reconciliation_due_at" TIMESTAMP(3),
    "current_checkpoint_number" INTEGER,
    "reconciliation_outcome" "ReconOutcome",
    "reconciliation_closed_at" TIMESTAMP(3),
    "parent_submission_id" TEXT,
    "child_submission_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_advance_details_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "travel_allowance_details" (
    "submission_id" TEXT NOT NULL,
    "purpose_text" TEXT,
    "travel_start_date" TIMESTAMP(3),
    "travel_end_date" TIMESTAMP(3),
    "manager_user_id" TEXT,
    "director_user_id" TEXT,
    "payment_mode" "PaymentMode",
    "paid_at" TIMESTAMP(3),
    "paid_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_allowance_details_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "invoice_payment_details" (
    "submission_id" TEXT NOT NULL,
    "vendor_name" TEXT,
    "invoice_number" TEXT,
    "invoice_date" TIMESTAMP(3),
    "payment_mode" "PaymentMode",
    "paid_at" TIMESTAMP(3),
    "paid_reference" TEXT,
    "payment_proof_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payment_details_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "expense_claim_details" (
    "submission_id" TEXT NOT NULL,
    "claim_period_start" TIMESTAMP(3),
    "claim_period_end" TIMESTAMP(3),
    "claim_notes" TEXT,
    "payment_mode" "PaymentMode",
    "paid_at" TIMESTAMP(3),
    "paid_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_claim_details_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "petty_cash_topup_details" (
    "submission_id" TEXT NOT NULL,
    "petty_cash_float_id" TEXT NOT NULL,
    "manager_user_id" TEXT,
    "director_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petty_cash_topup_details_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "required_role" "OrgRole" NOT NULL,
    "assigned_user_id" TEXT,
    "status_code" TEXT NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decisions" (
    "id" TEXT NOT NULL,
    "approval_step_id" TEXT NOT NULL,
    "decision_code" TEXT NOT NULL,
    "decided_by_user_id" TEXT NOT NULL,
    "reason_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "storage_bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "sha256_hash" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_events" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "signature_method" "SignatureMethod" NOT NULL,
    "signer_name" TEXT NOT NULL,
    "signer_email" TEXT NOT NULL,
    "consent_text" TEXT NOT NULL,
    "document_hash" TEXT,
    "request_ip" TEXT,
    "request_user_agent" TEXT,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "verified_by_user_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_action_tokens" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_type" TEXT NOT NULL,
    "bound_email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_queue" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "job_type" TEXT NOT NULL,
    "dedupe_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduled_for" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "payload_json" JSONB NOT NULL,
    "last_error_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "submission_id" TEXT,
    "channel" TEXT NOT NULL,
    "template_code" TEXT NOT NULL,
    "recipient_address" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "submission_id" TEXT,
    "event_type" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_user_id" TEXT,
    "payload_json" JSONB,
    "request_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "severity" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "export_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_by_id" TEXT NOT NULL,
    "filter_json" JSONB,
    "reason_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "export_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_batch_items" (
    "id" TEXT NOT NULL,
    "export_batch_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_files" (
    "id" TEXT NOT NULL,
    "export_batch_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "file_role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_floats" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "custodian_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ceiling_amount" DECIMAL(10,2) NOT NULL,
    "low_threshold" DECIMAL(10,2) NOT NULL,
    "current_balance" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petty_cash_floats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_entries" (
    "id" TEXT NOT NULL,
    "float_id" TEXT NOT NULL,
    "entry_type" "PettyCashEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "gl_account_id" TEXT,
    "project_id" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "receipt_url" TEXT,
    "topup_submission_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petty_cash_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_org_memberships_user_id_organization_id_key" ON "user_org_memberships"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_org_roles_membership_id_role_key" ON "user_org_roles"("membership_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "gl_accounts_organization_id_code_key" ON "gl_accounts"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "agents_organization_id_code_key" ON "agents"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "areas_organization_id_code_key" ON "areas"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_code_key" ON "projects"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_organization_id_payment_type_year_month_key" ON "document_sequences"("organization_id", "payment_type", "year", "month");

-- CreateIndex
CREATE INDEX "batches_organization_id_current_state_code_idx" ON "batches"("organization_id", "current_state_code");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_payment_type_version_key" ON "workflow_definitions"("payment_type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_states_workflow_definition_id_state_code_key" ON "workflow_states"("workflow_definition_id", "state_code");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transition_rules_workflow_definition_id_from_state_key" ON "workflow_transition_rules"("workflow_definition_id", "from_state_code", "action_code", "allowed_actor_type", "allowed_role");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_submission_number_key" ON "submissions"("submission_number");

-- CreateIndex
CREATE INDEX "submissions_organization_id_payment_type_current_state_code_idx" ON "submissions"("organization_id", "payment_type", "current_state_code");

-- CreateIndex
CREATE INDEX "submissions_organization_id_current_state_group_idx" ON "submissions"("organization_id", "current_state_group");

-- CreateIndex
CREATE INDEX "submissions_organization_id_submitted_by_id_idx" ON "submissions"("organization_id", "submitted_by_id");

-- CreateIndex
CREATE INDEX "submissions_organization_id_submitted_at_idx" ON "submissions"("organization_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "submission_lines_submission_id_line_number_key" ON "submission_lines"("submission_id", "line_number");

-- CreateIndex
CREATE INDEX "submission_transitions_submission_id_created_at_idx" ON "submission_transitions"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "submission_transitions_actor_user_id_created_at_idx" ON "submission_transitions"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "submission_evidence_submission_id_idx" ON "submission_evidence"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_submission_id_step_number_key" ON "approval_steps"("submission_id", "step_number");

-- CreateIndex
CREATE UNIQUE INDEX "approval_decisions_approval_step_id_key" ON "approval_decisions"("approval_step_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_document_type_idx" ON "documents"("organization_id", "document_type");

-- CreateIndex
CREATE INDEX "signature_events_submission_id_idx" ON "signature_events"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_action_tokens_token_hash_key" ON "external_action_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "external_action_tokens_submission_id_idx" ON "external_action_tokens"("submission_id");

-- CreateIndex
CREATE INDEX "job_queue_status_available_at_idx" ON "job_queue"("status", "available_at");

-- CreateIndex
CREATE INDEX "job_queue_organization_id_job_type_idx" ON "job_queue"("organization_id", "job_type");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_submission_id_idx" ON "notification_deliveries"("submission_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_created_at_idx" ON "notification_deliveries"("status", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_created_at_idx" ON "audit_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_submission_id_created_at_idx" ON "audit_events"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "system_events_severity_created_at_idx" ON "system_events"("severity", "created_at");

-- CreateIndex
CREATE INDEX "system_events_component_created_at_idx" ON "system_events"("component", "created_at");

-- CreateIndex
CREATE INDEX "export_batches_organization_id_export_type_idx" ON "export_batches"("organization_id", "export_type");

-- CreateIndex
CREATE UNIQUE INDEX "export_batch_items_export_batch_id_submission_id_key" ON "export_batch_items"("export_batch_id", "submission_id");

-- AddForeignKey
ALTER TABLE "user_org_memberships" ADD CONSTRAINT "user_org_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_org_memberships" ADD CONSTRAINT "user_org_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_org_memberships" ADD CONSTRAINT "user_org_memberships_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_org_memberships" ADD CONSTRAINT "user_org_memberships_default_area_id_fkey" FOREIGN KEY ("default_area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_org_roles" ADD CONSTRAINT "user_org_roles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "user_org_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transition_rules" ADD CONSTRAINT "workflow_transition_rules_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_current_assignee_id_fkey" FOREIGN KEY ("current_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_lines" ADD CONSTRAINT "submission_lines_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_lines" ADD CONSTRAINT "submission_lines_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_lines" ADD CONSTRAINT "submission_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_transitions" ADD CONSTRAINT "submission_transitions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_voucher_details" ADD CONSTRAINT "payment_voucher_details_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advance_details" ADD CONSTRAINT "cash_advance_details_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_allowance_details" ADD CONSTRAINT "travel_allowance_details_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment_details" ADD CONSTRAINT "invoice_payment_details_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_claim_details" ADD CONSTRAINT "expense_claim_details_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_topup_details" ADD CONSTRAINT "petty_cash_topup_details_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_topup_details" ADD CONSTRAINT "petty_cash_topup_details_petty_cash_float_id_fkey" FOREIGN KEY ("petty_cash_float_id") REFERENCES "petty_cash_floats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_step_id_fkey" FOREIGN KEY ("approval_step_id") REFERENCES "approval_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_action_tokens" ADD CONSTRAINT "external_action_tokens_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_queue" ADD CONSTRAINT "job_queue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_events" ADD CONSTRAINT "system_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_batches" ADD CONSTRAINT "export_batches_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_batch_items" ADD CONSTRAINT "export_batch_items_export_batch_id_fkey" FOREIGN KEY ("export_batch_id") REFERENCES "export_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_files" ADD CONSTRAINT "export_files_export_batch_id_fkey" FOREIGN KEY ("export_batch_id") REFERENCES "export_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_files" ADD CONSTRAINT "export_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_floats" ADD CONSTRAINT "petty_cash_floats_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_float_id_fkey" FOREIGN KEY ("float_id") REFERENCES "petty_cash_floats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "gl_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_entries" ADD CONSTRAINT "petty_cash_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

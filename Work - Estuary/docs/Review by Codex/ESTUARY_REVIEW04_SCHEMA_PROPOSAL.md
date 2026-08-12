# Estuary Review 04 - Schema Proposal

**Purpose:** Propose a cleaner relational schema aligned with stricter workflow and evidence controls  
**Date:** 2026-04-12  
**Source context:** `ESTUARY_REVIEW01_CODEX.md`, `ESTUARY_REVIEW02_REVISED_ARCHITECTURE.md`, `ESTUARY_REVIEW03_IMPLEMENTATION_PLAN.md`

## Design Goals

The schema should satisfy five requirements:

- unified reporting across payment types
- strict data integrity for each workflow type
- durable workflow transition history
- defensible evidence and document storage
- clean expansion path for later modules

The main structural choice is:

- one shared `submissions` header table
- one shared `submission_lines` table
- separate detail tables per payment type
- separate workflow, approval, document, and async infrastructure tables

## Naming and Structural Rules

- Use plural snake_case table names.
- Use `id` as the primary key on every table.
- Use `organization_id` on all organization-scoped business tables.
- Keep current state on the primary entity, but keep transition history in separate append-only tables.
- Avoid nullable columns when a field applies only to one payment type; move it to the type-specific table instead.
- Track `created_at` and `updated_at` consistently.

## Core Identity and Access Tables

### `users`

Purpose:

- one user record per person

Fields:

- `id`
- `email`
- `name`
- `avatar_url`
- `created_at`
- `updated_at`

Constraints:

- unique `email`

### `organizations`

Purpose:

- one legal or operating entity

Fields:

- `id`
- `name`
- `registration_no`
- `registered_address`
- `currency_code`
- `is_active`
- `created_at`
- `updated_at`

### `user_org_memberships`

Purpose:

- join user to organization with approval state and defaults

Fields:

- `id`
- `user_id`
- `organization_id`
- `membership_status`
- `default_agent_id`
- `default_area_id`
- `signature_document_id`
- `is_active`
- `created_at`
- `updated_at`

Constraints:

- unique `(user_id, organization_id)`

### `user_org_roles`

Purpose:

- assign one or more roles within one organization membership

Fields:

- `id`
- `membership_id`
- `role_code`
- `created_at`

Constraints:

- unique `(membership_id, role_code)`

## Reference Data Tables

### `agents`

Fields:

- `id`
- `organization_id`
- `code`
- `name`
- `description`
- `is_active`
- `created_at`

Constraints:

- unique `(organization_id, code)`

### `areas`

Fields:

- `id`
- `organization_id`
- `code`
- `name`
- `description`
- `is_active`
- `created_at`

Constraints:

- unique `(organization_id, code)`

### `projects`

Fields:

- `id`
- `organization_id`
- `code`
- `name`
- `description`
- `is_active`
- `created_at`

Constraints:

- unique `(organization_id, code)`

### `gl_accounts`

Fields:

- `id`
- `organization_id`
- `code`
- `name`
- `description`
- `is_active`
- `created_at`

Constraints:

- unique `(organization_id, code)`

## Submission Core

### `submissions`

Purpose:

- shared header for all workflow instances

Fields:

- `id`
- `organization_id`
- `payment_type`
- `submission_number`
- `submitted_by_user_id`
- `current_state_code`
- `current_state_group`
- `current_assignee_user_id`
- `agent_id`
- `area_id`
- `total_amount`
- `currency_code`
- `submitted_at`
- `closed_at`
- `is_voided`
- `void_reason`
- `created_at`
- `updated_at`

Notes:

- `current_state_code` is the workflow state shown to the app.
- `current_state_group` is a reporting helper such as `DRAFT`, `IN_REVIEW`, `AWAITING_EXTERNAL_ACTION`, `COMPLETE`, `REJECTED`, `OVERDUE`.
- `submission_number` can be null until a legally meaningful issuance point if numbering policy requires that.

Indexes:

- `(organization_id, payment_type, current_state_code)`
- `(organization_id, submitted_by_user_id)`
- `(organization_id, submitted_at)`

### `submission_lines`

Purpose:

- accounting and amount lines shared across workflow types

Fields:

- `id`
- `submission_id`
- `line_number`
- `description`
- `amount`
- `gl_account_id`
- `project_id`
- `created_at`
- `updated_at`

Constraints:

- unique `(submission_id, line_number)`

## Type-Specific Detail Tables

### `payment_voucher_details`

Fields:

- `submission_id`
- `recipient_name`
- `recipient_identity_no`
- `recipient_email`
- `recipient_phone`
- `recipient_bank_name`
- `recipient_bank_account`
- `payment_mode_code`
- `document_description`
- `issued_document_id`
- `signed_document_id`
- `signature_method_code`
- `signature_requested_at`
- `signature_collected_at`
- `signature_verified_at`
- `paid_at`
- `paid_reference`
- `payment_proof_document_id`
- `created_at`
- `updated_at`

Constraints:

- primary key `submission_id`

### `cash_advance_details`

Fields:

- `submission_id`
- `purpose_text`
- `manager_user_id`
- `director_user_id`
- `reconciliation_due_at`
- `current_checkpoint_number`
- `reconciliation_outcome_code`
- `reconciliation_closed_at`
- `parent_submission_id`
- `child_submission_id`
- `created_at`
- `updated_at`

Constraints:

- primary key `submission_id`

### `travel_allowance_details`

Fields:

- `submission_id`
- `purpose_text`
- `travel_start_date`
- `travel_end_date`
- `manager_user_id`
- `director_user_id`
- `created_at`
- `updated_at`

### `invoice_payment_details`

Fields:

- `submission_id`
- `vendor_name`
- `invoice_number`
- `invoice_date`
- `payment_mode_code`
- `paid_at`
- `paid_reference`
- `payment_proof_document_id`
- `created_at`
- `updated_at`

### `expense_claim_details`

Fields:

- `submission_id`
- `claim_period_start`
- `claim_period_end`
- `claim_notes`
- `created_at`
- `updated_at`

### `petty_cash_topup_details`

Fields:

- `submission_id`
- `petty_cash_float_id`
- `manager_user_id`
- `director_user_id`
- `created_at`
- `updated_at`

## Workflow and Approval Tables

### `workflow_definitions`

Purpose:

- define workflow family per payment type

Fields:

- `id`
- `payment_type`
- `workflow_version`
- `is_active`
- `created_at`

### `workflow_states`

Fields:

- `id`
- `workflow_definition_id`
- `state_code`
- `state_group`
- `label`
- `is_terminal`
- `sort_order`

Constraints:

- unique `(workflow_definition_id, state_code)`

### `workflow_transition_rules`

Fields:

- `id`
- `workflow_definition_id`
- `from_state_code`
- `action_code`
- `to_state_code`
- `allowed_actor_type`
- `allowed_role_code`
- `requires_reason`
- `requires_document`
- `is_active`

Constraints:

- unique `(workflow_definition_id, from_state_code, action_code)`

### `submission_transitions`

Purpose:

- append-only history of actual transitions

Fields:

- `id`
- `submission_id`
- `from_state_code`
- `action_code`
- `to_state_code`
- `actor_user_id`
- `actor_type`
- `actor_membership_id`
- `reason_text`
- `request_ip`
- `request_user_agent`
- `metadata_json`
- `created_at`

Indexes:

- `(submission_id, created_at)`
- `(actor_user_id, created_at)`

### `approval_steps`

Purpose:

- stores approval plan for a submission

Fields:

- `id`
- `submission_id`
- `step_number`
- `required_role_code`
- `assigned_user_id`
- `status_code`
- `due_at`
- `created_at`
- `updated_at`

Constraints:

- unique `(submission_id, step_number)`

### `approval_decisions`

Purpose:

- immutable decisions attached to approval steps

Fields:

- `id`
- `approval_step_id`
- `decision_code`
- `decision_by_user_id`
- `reason_text`
- `created_at`

## Document and Evidence Tables

### `documents`

Purpose:

- metadata for stored files

Fields:

- `id`
- `organization_id`
- `document_type_code`
- `storage_bucket`
- `storage_key`
- `original_file_name`
- `mime_type`
- `file_size_bytes`
- `sha256_hash`
- `uploaded_by_user_id`
- `created_at`

### `submission_evidence`

Purpose:

- join documents to submissions and workflow events

Fields:

- `id`
- `submission_id`
- `document_id`
- `evidence_type_code`
- `source_transition_id`
- `created_at`

### `signature_events`

Purpose:

- capture signature-specific evidence

Fields:

- `id`
- `submission_id`
- `document_id`
- `signature_method_code`
- `signer_name`
- `signer_email`
- `consent_text`
- `request_ip`
- `request_user_agent`
- `signed_at`
- `verified_by_user_id`
- `verified_at`
- `created_at`

### `external_action_tokens`

Purpose:

- tokenized access for recipient signature or other external actions

Fields:

- `id`
- `submission_id`
- `token_hash`
- `token_type_code`
- `bound_email`
- `expires_at`
- `used_at`
- `revoked_at`
- `created_at`

Constraints:

- unique `token_hash`

## Async and Notification Tables

### `job_queue`

Fields:

- `id`
- `job_type_code`
- `dedupe_key`
- `status_code`
- `scheduled_for`
- `available_at`
- `locked_at`
- `locked_by`
- `attempt_count`
- `max_attempts`
- `payload_json`
- `last_error_text`
- `created_at`
- `updated_at`

### `outbox_events`

Fields:

- `id`
- `event_type_code`
- `aggregate_type`
- `aggregate_id`
- `payload_json`
- `published_at`
- `created_at`

### `notification_deliveries`

Fields:

- `id`
- `organization_id`
- `submission_id`
- `channel_code`
- `template_code`
- `recipient_address`
- `provider_message_id`
- `status_code`
- `sent_at`
- `failed_at`
- `error_text`
- `created_at`

## Export and Sequence Tables

### `document_sequences`

Fields:

- `id`
- `organization_id`
- `sequence_type_code`
- `sequence_year`
- `sequence_month`
- `next_number`
- `created_at`
- `updated_at`

Constraints:

- unique `(organization_id, sequence_type_code, sequence_year, sequence_month)`

### `export_batches`

Fields:

- `id`
- `organization_id`
- `export_type_code`
- `status_code`
- `requested_by_user_id`
- `filter_json`
- `reason_text`
- `created_at`
- `completed_at`

### `export_batch_items`

Fields:

- `id`
- `export_batch_id`
- `submission_id`
- `snapshot_json`
- `created_at`

Constraints:

- unique `(export_batch_id, submission_id)`

### `export_files`

Fields:

- `id`
- `export_batch_id`
- `document_id`
- `file_role_code`
- `created_at`

## Audit and Operations Tables

### `audit_events`

Purpose:

- business and control event log

Fields:

- `id`
- `organization_id`
- `submission_id`
- `event_type_code`
- `actor_user_id`
- `actor_type`
- `payload_json`
- `created_at`

### `system_events`

Purpose:

- operational failures and worker/system diagnostics

Fields:

- `id`
- `severity_code`
- `component_code`
- `event_type_code`
- `payload_json`
- `created_at`

## Enums and Codes To Standardize Early

- `payment_type`
- `membership_status`
- `role_code`
- `payment_mode_code`
- `document_type_code`
- `signature_method_code`
- `actor_type`
- `decision_code`
- `approval_step_status_code`
- `job_type_code`
- `job_status_code`
- `event_type_code`
- `export_type_code`

## Relationship Summary

- one `organization` has many `memberships`, `reference records`, `submissions`, `documents`, `jobs`, `exports`
- one `submission` has many `submission_lines`, `transitions`, `evidence items`, `approval steps`
- one `submission` has one type-specific detail row
- one `approval_step` can have one terminal decision record
- one `export_batch` has many `export_batch_items` and one or more `export_files`

## Schema Decisions I Would Change From The Original Proposal

- replace one giant `Submission` table with typed detail tables
- replace loose status slots with normalized workflow tables
- split approval planning from approval decisions
- add explicit external token table instead of embedding token fields on the business record
- add explicit async tables for jobs and outbox publishing
- add explicit signature evidence table

## MVP Cut Line

For MVP, only these tables are truly required:

- identity and access tables
- reference data tables
- `submissions`
- `submission_lines`
- `payment_voucher_details`
- `workflow_states`
- `workflow_transition_rules`
- `submission_transitions`
- `approval_steps`
- `approval_decisions`
- `documents`
- `submission_evidence`
- `signature_events`
- `external_action_tokens`
- `job_queue`
- `outbox_events`
- `notification_deliveries`
- `document_sequences`
- `audit_events`

# Estuary — Database Schema (Prisma SDL)

- Version: 2.2
- Status: Proposed — pending David review
- Author: ALAKAZAM01
- Date: 2026-04-12
- Integrates: Codex reviews 01–06 (ESTUARY_REVIEW01–06) + Codex Review V2 (ESTUARY_REVIEW_V2_CODEX)

---

## What Changed from v1.4 → v2.0

This is a significant revision. Changes fall into five categories:

### 1. Submission table slimmed down
All payment-type-specific fields removed from `Submission` and moved to dedicated per-type
detail tables: `PaymentVoucherDetail`, `CashAdvanceDetail`, `TravelAllowanceDetail`,
`InvoicePaymentDetail`, `ExpenseClaimDetail`, `PettyCashTopupDetail`.

**Why:** nullable field sprawl on the main submission row weakens schema integrity and makes
validation logic harder to enforce. Each payment type now has its own mandatory/optional
contract enforced at the schema level.

### 2. Status model replaced with workflow transitions
The two-layer status model (`base_status` + three named string slots) is replaced by:
- `current_state_code String` — specific workflow state, e.g. `"PV_DRAFT"`, `"CA_OVERDUE"`
- `current_state_group StateGroup` — stable reporting enum for dashboard queries
- `SubmissionTransition` — append-only history of every state change (replaces the string slots)
- `WorkflowDefinition`/`WorkflowState`/`WorkflowTransitionRule` — seeded workflow definitions

**Why:** the three string slots allowed invalid combinations and buried the audit trail in
application logic. Transition history is now a first-class database record.

### 3. Internal approval tokens removed
`ApprovalStep.token` and `ApprovalStep.token_expires_at` are removed. Internal approvers
(Director, Manager) must use SSO-authenticated session. Email notifications deep-link to the
approval page but are NOT the auth mechanism. Token links are reserved for
external recipients only, via the new `ExternalActionToken` table.

**Why:** forwarded email equals delegated approval authority. Mailbox compromise equals
silent financial authorization. Internal financial approvals require identity binding.

### 4. Background infrastructure added
New tables: `JobQueue`, `OutboxEvent`, `NotificationDelivery`.
Every deferred side effect (reminders, PDF generation, email dispatch, overdue detection,
token expiry) goes through the job queue with idempotency keys, retry rules, and
operator-visible failure state.

**Why:** the original design had no async infrastructure. Reminders and expiry logic
implemented as request-time side effects will degrade silently in production.

### 5. Evidence and document handling strengthened
- `Document` no longer FK-linked directly to submissions; the new `SubmissionEvidence` join
  table links documents to both submissions and the specific workflow transition that
  produced them.
- `SignatureEvent` captures full evidence (consent text, IP, user agent, document hash,
  signer email) as an immutable record.
- `ExternalActionToken` stores the token hash (never plaintext) separately from submission data.
- `Document` gains `storage_key`, `storage_bucket`, `sha256_hash` for integrity and access control.
- `SystemEvent` added for operational/worker events, separate from business `AuditEvent`.
- `ExportBatch`/`ExportBatchItem`/`ExportFile` added for Phase 4 accounting export.

---

## Design Principles

- `Organization` is the top-level partition. Every financial record belongs to one org.
- Users sign in via Google SSO. Org membership starts as PENDING until an admin approves.
- A user can hold multiple roles in the same org (MANAGER + PETTY_CASH_CUSTODIAN is valid).
- Internal approvals (Director, Manager) require an SSO-authenticated session. No token links.
- External recipient actions (signature collection) use `ExternalActionToken` — one-use, hashed, bound to email, expiring.
- Workflow state is `current_state_code` (String) + `current_state_group` (StateGroup enum).
  State codes are payment-type-prefixed: `PV_DRAFT`, `CA_PENDING_MANAGER_APPROVAL`, etc.
- Every workflow state change writes one immutable `SubmissionTransition` row.
- Every submission has a shared header (`Submission`) plus one type-specific detail row.
- Submission lines carry GL Code and Project (line-level). Agent and Area are header-level.
- PV and Invoice default to 1 line (UX default). Schema supports N lines for all types.
- Document number is null until issuance (after approval). Assigned via `DocumentSequence` SELECT FOR UPDATE (prevents duplicates; gaps on rollback/void are expected and acceptable).
- All files stored privately in S3. Access is always via signed URL (never public).
- `Document` stores `storage_key` (S3 key), never the full pre-signed URL.
- `AuditEvent` captures business events only. `SystemEvent` captures worker/job operational events.
- All deferred work (email, reminders, PDFs, expiry, exports) runs through `JobQueue`.
- All amounts: `Decimal(12, 2)` — supports up to RM 9,999,999,999.99.

---

## Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// IDENTITY AND ACCESS
// ─────────────────────────────────────────────

model Organization {
  id                 String   @id @default(cuid())
  name               String                           // e.g. "Arus Education Sdn Bhd"
  registration_no    String                           // e.g. "1177232-U"
  registered_address String                           // printed on all PV PDFs
  currency_code      String   @default("MYR")
  is_active          Boolean  @default(true)
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  memberships        UserOrgMembership[]
  gl_accounts        GlAccount[]
  agents             Agent[]
  areas              Area[]
  projects           Project[]
  submissions        Submission[]
  batches            Batch[]
  document_sequences DocumentSequence[]
  petty_cash_floats  PettyCashFloat[]
  documents          Document[]
  audit_events       AuditEvent[]
  system_events      SystemEvent[]
  job_queue          JobQueue[]
  export_batches     ExportBatch[]

  @@map("organizations")
}

model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  avatar_url String?
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  memberships               UserOrgMembership[]
  submitted_submissions     Submission[]         @relation("Submitter")
  assigned_submissions      Submission[]         @relation("CurrentAssignee")
  created_batches           Batch[]              @relation("BatchCreator")
  approval_decisions        ApprovalDecision[]   @relation("ApprovalDecider")
  verified_signature_events SignatureEvent[]     @relation("SignatureVerifier")
  audit_events              AuditEvent[]         @relation("AuditActor")
  uploaded_documents        Document[]           @relation("DocumentUploader")
  export_batches            ExportBatch[]        @relation("ExportRequester")

  @@map("users")
}

model UserOrgMembership {
  id                String           @id @default(cuid())
  user_id           String
  organization_id   String
  membership_status MembershipStatus @default(PENDING)
  // PENDING:   first SSO login; awaiting org admin approval
  // ACTIVE:    approved; can access org data
  // SUSPENDED: access revoked; record kept for audit
  agent_id          String?          // FK → Agent: default SQL Account agent for this user in this org
  default_area_id   String?          // FK → Area: pre-fills Area on new submissions
  signature_url     String?          // S3 key of approver's signature image (renders on PV PDF)
  is_active         Boolean          @default(true)
  created_at        DateTime         @default(now())
  updated_at        DateTime         @updatedAt

  user         User         @relation(fields: [user_id], references: [id])
  organization Organization @relation(fields: [organization_id], references: [id])
  agent        Agent?       @relation(fields: [agent_id], references: [id])
  default_area Area?        @relation("DefaultArea", fields: [default_area_id], references: [id])
  roles        UserOrgRole[]

  @@unique([user_id, organization_id])
  @@map("user_org_memberships")
}

enum MembershipStatus {
  PENDING
  ACTIVE
  SUSPENDED
}

// A user can hold multiple roles in the same org simultaneously.
// e.g. MANAGER + PETTY_CASH_CUSTODIAN is a valid combination.

model UserOrgRole {
  id            String            @id @default(cuid())
  membership_id String
  role          OrgRole
  created_at    DateTime          @default(now())

  membership UserOrgMembership @relation(fields: [membership_id], references: [id], onDelete: Cascade)

  @@unique([membership_id, role])
  @@map("user_org_roles")
}

enum OrgRole {
  OWNER
  FINANCE_ADMIN
  DIRECTOR
  MANAGER
  STAFF
  PETTY_CASH_CUSTODIAN
}

// ─────────────────────────────────────────────
// DIMENSION REFERENCE TABLES (per org)
// Mirror SQL Account's 4 transaction dimensions.
//   Agent + Area  → header-level on Submission
//   GL Code + Project → line-level on SubmissionLine
// ─────────────────────────────────────────────

model GlAccount {
  id              String   @id @default(cuid())
  organization_id String
  code            String
  name            String
  description     String?
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())

  organization       Organization     @relation(fields: [organization_id], references: [id])
  submission_lines   SubmissionLine[]
  petty_cash_entries PettyCashEntry[]

  @@unique([organization_id, code])
  @@map("gl_accounts")
}

model Agent {
  id              String   @id @default(cuid())
  organization_id String
  code            String
  name            String
  description     String?
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())

  organization Organization        @relation(fields: [organization_id], references: [id])
  memberships  UserOrgMembership[]
  submissions  Submission[]

  @@unique([organization_id, code])
  @@map("agents")
}

model Area {
  id              String   @id @default(cuid())
  organization_id String
  code            String
  name            String
  description     String?
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())

  organization Organization        @relation(fields: [organization_id], references: [id])
  default_for  UserOrgMembership[] @relation("DefaultArea")
  submissions  Submission[]

  @@unique([organization_id, code])
  @@map("areas")
}

model Project {
  id              String   @id @default(cuid())
  organization_id String
  code            String
  name            String
  description     String?
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())

  organization       Organization     @relation(fields: [organization_id], references: [id])
  submission_lines   SubmissionLine[]
  petty_cash_entries PettyCashEntry[]

  @@unique([organization_id, code])
  @@map("projects")
}

// ─────────────────────────────────────────────
// DOCUMENT SEQUENCE
// One row per org + payment_type + year + month.
// SELECT FOR UPDATE lock during number assignment; prevents duplicate numbers under concurrency.
// Gaps are possible and expected: they occur on transaction rollback after counter increment,
// or when a document is voided after issuance. Voided records remain in history with their number.
// This is standard practice for financial document numbering (no duplicate = the hard guarantee).
// Format: {PREFIX}-{YYYY}-{MM}-{ZZ}, ZZ resets to 01 each month.
// Examples: PV-2025-04-08, CA-2025-04-01, INV-2025-04-03
// admin_next_sequence: admin override; consumed once, then cleared to NULL.
// ─────────────────────────────────────────────

model DocumentSequence {
  id                  String      @id @default(cuid())
  organization_id     String
  payment_type        PaymentType
  year                Int
  month               Int         // 1–12
  prefix              String      // configurable per org per type
  last_sequence       Int         @default(0)
  admin_next_sequence Int?        // admin override; cleared after use
  created_at          DateTime    @default(now())
  updated_at          DateTime    @updatedAt

  organization Organization @relation(fields: [organization_id], references: [id])

  @@unique([organization_id, payment_type, year, month])
  @@map("document_sequences")
}

// ─────────────────────────────────────────────
// BATCH (mass PV creation — first-class entity)
// One batch → one approval decision → N submissions → N recipient emails.
// ─────────────────────────────────────────────

model Batch {
  id                 String   @id @default(cuid())
  organization_id    String
  name               String   // e.g. "April Teacher Transport Claims"
  payment_type       PaymentType
  current_state_code String   @default("BATCH_DRAFT")
  created_by_id      String
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  organization Organization @relation(fields: [organization_id], references: [id])
  created_by   User         @relation("BatchCreator", fields: [created_by_id], references: [id])
  submissions  Submission[]

  @@index([organization_id, current_state_code])
  @@map("batches")
}

// ─────────────────────────────────────────────
// WORKFLOW ENGINE TABLES
//
// For MVP: workflow rules are code-first (seeded into DB at startup).
//          No admin UI to reconfigure transitions at MVP.
//          Transition history (submission_transitions) is always stored.
//
// WorkflowDefinition: one per payment type (one active at a time, app-enforced).
//   "One active at a time" is enforced in the domain service when activating a new version
//   (set is_active = false on previous). Not enforced at DB level (no partial unique index in Prisma SDL).
// WorkflowState:      all valid states for a definition.
// WorkflowTransitionRule: all allowed (from_state + action → to_state) pairs.
// Each Submission.workflow_definition_id pins the submission to a specific definition version,
//   so in-flight submissions are unaffected by future workflow rule changes.
// ─────────────────────────────────────────────

model WorkflowDefinition {
  id           String      @id @default(cuid())
  payment_type PaymentType
  version      Int         @default(1)
  is_active    Boolean     @default(true)
  created_at   DateTime    @default(now())

  states           WorkflowState[]
  transition_rules WorkflowTransitionRule[]
  submissions      Submission[]

  @@unique([payment_type, version])
  @@map("workflow_definitions")
}

model WorkflowState {
  id                    String     @id @default(cuid())
  workflow_definition_id String
  state_code            String     // e.g. "PV_DRAFT", "PV_PENDING_DIRECTOR_APPROVAL"
  state_group           StateGroup // reporting bucket
  label                 String     // human-readable UI label
  is_terminal           Boolean    @default(false)
  sort_order            Int

  definition WorkflowDefinition @relation(fields: [workflow_definition_id], references: [id], onDelete: Cascade)

  @@unique([workflow_definition_id, state_code])
  @@map("workflow_states")
}

// StateGroup: stable enum used for dashboard queries and cross-type reporting.
// current_state_code is type-specific (e.g. "PV_DRAFT");
// current_state_group is the universal bucket (e.g. DRAFT).
enum StateGroup {
  DRAFT
  IN_REVIEW
  AWAITING_DOCUMENT
  AWAITING_EXTERNAL_ACTION
  PENDING_VERIFICATION
  COMPLETE
  REJECTED
  OVERDUE
  VOIDED
}

model WorkflowTransitionRule {
  id                    String    @id @default(cuid())
  workflow_definition_id String
  from_state_code       String
  action_code           String    // e.g. "APPROVE", "REJECT", "SUBMIT_FOR_APPROVAL"
  to_state_code         String
  allowed_actor_type    ActorType
  allowed_role          OrgRole?  // null when actor_type = SYSTEM or EXTERNAL_RECIPIENT
  requires_reason       Boolean   @default(false)
  requires_document     Boolean   @default(false)
  is_active             Boolean   @default(true)

  definition WorkflowDefinition @relation(fields: [workflow_definition_id], references: [id], onDelete: Cascade)

  @@unique([workflow_definition_id, from_state_code, action_code, allowed_actor_type, allowed_role])
  @@map("workflow_transition_rules")
}

// ActorType: who is performing the transition.
// INTERNAL_USER:      SSO-authenticated org member (all internal approvals use this).
// EXTERNAL_RECIPIENT: token-authenticated external party (signature collection only).
// SYSTEM:             worker process, scheduled job, or automated rule engine.
enum ActorType {
  INTERNAL_USER
  EXTERNAL_RECIPIENT
  SYSTEM
}

// ─────────────────────────────────────────────
// SUBMISSION (shared header for all payment types)
//
// Type-specific fields are in per-type detail tables (1:1 with submission_id as PK).
// current_state_code: plain String, app-validated against WorkflowTransitionRule.
//   Uses payment-type prefix: "PV_DRAFT", "CA_PENDING_MANAGER_APPROVAL", etc.
// current_state_group: DB enum — stable reporting bucket.
// submission_number: null until document issuance (assigned via DocumentSequence lock).
// ─────────────────────────────────────────────

model Submission {
  id              String     @id @default(cuid())
  organization_id String
  batch_id        String?
  payment_type    PaymentType

  // Workflow state
  // workflow_definition_id: pinned to the active WorkflowDefinition at submission creation.
  // Transitions are validated against this specific definition, not the current active one.
  // This means in-flight submissions are unaffected by workflow rule changes.
  workflow_definition_id String?
  current_state_code     String     @default("DRAFT_INITIALIZING") // set to type-specific initial state on creation
  current_state_group    StateGroup @default(DRAFT)
  current_assignee_id    String?    // who is expected to act next; set by workflow engine

  // Document number — null until document generation; globally unique when set
  submission_number String? @unique // e.g. "PV-2025-04-08"

  // Submitter and timing
  submitted_by_id String
  submitted_at    DateTime?
  closed_at       DateTime? // set when submission reaches any terminal state

  // Accounting dimensions (header-level for all payment types)
  // Defaults from submitter's UserOrgMembership; overridable at submission time
  agent_id String?
  area_id  String?

  // Totals (must equal sum of SubmissionLines)
  total_amount Decimal @db.Decimal(12, 2)
  currency     String  @default("MYR")

  // Description / purpose ("Being" on PV PDF; purpose text on other types)
  description String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  // Relations
  organization         Organization         @relation(fields: [organization_id], references: [id])
  workflow_definition  WorkflowDefinition?  @relation(fields: [workflow_definition_id], references: [id])
  submitted_by         User                 @relation("Submitter", fields: [submitted_by_id], references: [id])
  current_assignee  User?                @relation("CurrentAssignee", fields: [current_assignee_id], references: [id])
  agent             Agent?               @relation(fields: [agent_id], references: [id])
  area              Area?                @relation(fields: [area_id], references: [id])
  batch             Batch?               @relation(fields: [batch_id], references: [id])
  lines             SubmissionLine[]
  transitions       SubmissionTransition[]
  evidence          SubmissionEvidence[]
  approval_steps    ApprovalStep[]
  external_tokens   ExternalActionToken[]

  // Type-specific detail (at most one per payment type)
  pv_detail         PaymentVoucherDetail?
  ca_detail         CashAdvanceDetail?
  travel_detail     TravelAllowanceDetail?
  invoice_detail    InvoicePaymentDetail?
  claim_detail      ExpenseClaimDetail?
  petty_cash_detail PettyCashTopupDetail?

  @@index([organization_id, payment_type, current_state_code])
  @@index([organization_id, current_state_group])
  @@index([organization_id, submitted_by_id])
  @@index([organization_id, submitted_at])
  @@map("submissions")
}

enum PaymentType {
  PAYMENT_VOUCHER
  INVOICE_PAYMENT
  CASH_ADVANCE
  TRAVEL_ALLOWANCE
  EXPENSE_CLAIM
  PETTY_CASH_TOPUP
}

enum PaymentMode {
  BANK_TRANSFER
  CASH
  CHEQUE
  IBG
  DUITNOW
}

enum SignatureMethod {
  DIGITAL  // in-browser canvas pad; system generates signed PDF
  UPLOAD   // recipient uploads scanned copy; requires staff verification
}

enum ReconOutcome {
  EXACT       // all money spent; docs submitted; closed
  UNDERSPEND  // balance returned; confirmed; docs submitted; closed
  OVERSPEND   // child CA created for overspent amount; original held until child closes
}

// ─────────────────────────────────────────────
// SUBMISSION LINES
// Agent + Area: always header-level (never per-line).
// GL Code + Project: always line-level.
// PV, Invoice: default 1 line (UX default; schema supports N).
// CA, Travel, Claims: multi-line.
// ─────────────────────────────────────────────

model SubmissionLine {
  id            String   @id @default(cuid())
  submission_id String
  line_number   Int      // 1-based display order
  description   String?
  amount        Decimal  @db.Decimal(12, 2)
  gl_account_id String?
  project_id    String?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)
  gl_account GlAccount? @relation(fields: [gl_account_id], references: [id])
  project    Project?   @relation(fields: [project_id], references: [id])

  @@unique([submission_id, line_number])
  @@map("submission_lines")
}

// ─────────────────────────────────────────────
// SUBMISSION TRANSITIONS (append-only; never updated or deleted)
//
// Every workflow state change writes one row here.
// This is the authoritative record of what happened, who did it, and when.
// The current state on Submission is derived from (or consistent with) the latest transition.
// ─────────────────────────────────────────────

model SubmissionTransition {
  id                  String    @id @default(cuid())
  submission_id       String
  from_state_code     String
  action_code         String    // e.g. "APPROVE", "REJECT", "SUBMIT_FOR_APPROVAL", "VOID"
  to_state_code       String
  actor_type          ActorType
  actor_user_id       String?   // null if SYSTEM; present for INTERNAL_USER and EXTERNAL_RECIPIENT (if registered)
  actor_membership_id String?   // snapshot of membership_id at time of action (for audit)
  reason_text         String?   // mandatory for REJECT, VOID, OVERRIDE actions
  request_ip          String?
  request_user_agent  String?
  metadata_json       Json?     // additional context (e.g. token_id for external actions)
  created_at          DateTime  @default(now())

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@index([submission_id, created_at])
  @@index([actor_user_id, created_at])
  @@map("submission_transitions")
}

// ─────────────────────────────────────────────
// SUBMISSION EVIDENCE
// Join table: links a Document to a Submission and optionally to the
// specific workflow transition that produced or required it.
//
// evidence_type_code values:
//   "SUPPORTING_DOC", "GENERATED_PDF", "SIGNED_DOCUMENT",
//   "RECONCILIATION_DOC", "PAYMENT_PROOF", "SIGNATURE_IMAGE"
// ─────────────────────────────────────────────

model SubmissionEvidence {
  id                   String   @id @default(cuid())
  submission_id        String
  document_id          String
  evidence_type_code   String
  source_transition_id String?  // which transition produced or required this evidence (plain field)
  created_at           DateTime @default(now())

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)
  document   Document   @relation(fields: [document_id], references: [id])

  @@index([submission_id])
  @@map("submission_evidence")
}

// ─────────────────────────────────────────────
// PER-TYPE DETAIL TABLES
//
// One row per submission, keyed by submission_id (1:1, submission_id is the PK).
// Contains ONLY fields specific to that payment type.
// References to Document records use plain String? IDs; full evidence trail via SubmissionEvidence.
// ─────────────────────────────────────────────

// Payment Voucher Detail
// Contains: recipient info, payment method, document/signature references.
// Recipient fields are sensitive — masked in UI, redacted in logs.

model PaymentVoucherDetail {
  submission_id String @id

  // Recipient (sensitive fields)
  recipient_name         String
  recipient_ic           String?  // Malaysian IC or passport number — masked in UI
  recipient_email        String   // used for signature request email and reminders
  recipient_phone        String?  // for future reminder channels
  recipient_bank_name    String?  // sensitive
  recipient_bank_account String?  // sensitive — masked in UI

  // Payment — defaults to BANK_TRANSFER; overridable at submission time
  payment_mode   PaymentMode @default(BANK_TRANSFER)
  paid_at        DateTime?
  paid_reference String?   // bank reference number
  payment_proof_document_id String? // Document.id of bank transfer proof

  // Document content
  being_text String? // "Being: ___" description on the PV PDF

  // Document references (convenience denormalization; full trail in SubmissionEvidence)
  issued_document_id    String? // Document.id of unsigned generated PDF
  signed_document_id    String? // Document.id of final signed artifact

  // Signature
  signature_method       SignatureMethod?
  signature_requested_at DateTime?
  signature_collected_at DateTime? // set when DIGITAL signed or UPLOAD received
  signature_verified_at  DateTime? // set for UPLOAD after staff verification

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@map("payment_voucher_details")
}

// Cash Advance Detail
// Contains: approval assignments, reconciliation state, overspend parent-child link.
// parent_submission_id and child_submission_id are plain String? IDs (no Prisma FK)
// to avoid circular reference complexity. Application handles these joins.

model CashAdvanceDetail {
  submission_id String @id

  purpose_text              String?
  manager_user_id           String?   // assigned manager approver at submission time
  director_user_id          String?   // assigned director approver
  payment_mode              PaymentMode?
  paid_at                   DateTime?
  paid_reference            String?
  reconciliation_due_at     DateTime? // set to paid_at + 14 days
  current_checkpoint_number Int?      // 1, 2, or 3 (2w/3w/4w)
  reconciliation_outcome    ReconOutcome?
  reconciliation_closed_at  DateTime?
  parent_submission_id      String?   // this CA is an overspend child of the referenced CA
  child_submission_id       String?   // set when overspend creates a child CA

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@map("cash_advance_details")
}

// Travel Allowance Detail

model TravelAllowanceDetail {
  submission_id String @id

  purpose_text      String?
  travel_start_date DateTime?
  travel_end_date   DateTime?
  manager_user_id   String?
  director_user_id  String?
  payment_mode      PaymentMode?
  paid_at           DateTime?
  paid_reference    String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@map("travel_allowance_details")
}

// Invoice Payment Detail

model InvoicePaymentDetail {
  submission_id String @id

  vendor_name    String?
  invoice_number String?
  invoice_date   DateTime?
  payment_mode   PaymentMode?
  paid_at        DateTime?
  paid_reference String?
  payment_proof_document_id String? // Document.id of payment proof

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@map("invoice_payment_details")
}

// Expense Claim Detail

model ExpenseClaimDetail {
  submission_id String @id

  claim_period_start DateTime?
  claim_period_end   DateTime?
  claim_notes        String?
  payment_mode       PaymentMode?
  paid_at            DateTime?
  paid_reference     String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@map("expense_claim_details")
}

// Petty Cash Top-up Detail

model PettyCashTopupDetail {
  submission_id String @id

  petty_cash_float_id String
  manager_user_id     String?
  director_user_id    String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  submission       Submission     @relation(fields: [submission_id], references: [id], onDelete: Cascade)
  petty_cash_float PettyCashFloat @relation(fields: [petty_cash_float_id], references: [id])

  @@map("petty_cash_topup_details")
}

// ─────────────────────────────────────────────
// APPROVAL STEPS + DECISIONS
//
// ApprovalStep: the plan — who must approve, in what order.
// ApprovalDecision: the immutable record of what was decided.
//
// Internal approvers (Director, Manager) must use SSO-authenticated session.
// Token links are NOT used for internal approvals.
// Email notifications deep-link to the approval page — the page still requires session auth.
// ─────────────────────────────────────────────

model ApprovalStep {
  id               String   @id @default(cuid())
  submission_id    String
  step_number      Int      // 1 = first approver, 2 = second
  required_role    OrgRole  // MANAGER or DIRECTOR
  assigned_user_id String?  // set when step becomes active
  status_code      String   @default("PENDING")  // PENDING, ACTIVE, COMPLETE, BYPASSED
  due_at           DateTime? // SLA deadline for this step
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

  submission Submission        @relation(fields: [submission_id], references: [id], onDelete: Cascade)
  decision   ApprovalDecision?

  @@unique([submission_id, step_number])
  @@map("approval_steps")
}

// One terminal decision per step (UNIQUE on approval_step_id).
// decided_by_user_id must be the SSO-authenticated session user; enforced at API layer.

model ApprovalDecision {
  id                 String   @id @default(cuid())
  approval_step_id   String   @unique  // one decision per step; immutable once created
  decision_code      String   // "APPROVED" or "REJECTED"
  decided_by_user_id String   // SSO-authenticated user
  reason_text        String?  // mandatory when decision_code = "REJECTED"
  created_at         DateTime @default(now())

  approval_step ApprovalStep @relation(fields: [approval_step_id], references: [id])
  decided_by    User         @relation("ApprovalDecider", fields: [decided_by_user_id], references: [id])

  @@map("approval_decisions")
}

// ─────────────────────────────────────────────
// DOCUMENTS (file metadata store)
//
// All files are stored privately in S3.
// Access is always via signed URL generated from storage_key (never stored pre-signed).
// Documents can be org-level (signature images) or evidence-linked (via SubmissionEvidence).
// ─────────────────────────────────────────────

model Document {
  id               String   @id @default(cuid())
  organization_id  String
  document_type    String   // "SUPPORTING_DOC" | "GENERATED_PDF" | "SIGNED_DOCUMENT" |
                             // "RECONCILIATION_DOC" | "PAYMENT_PROOF" | "SIGNATURE_IMAGE"
  storage_bucket   String   // S3 bucket name
  storage_key      String   // S3 object key — used to generate signed URLs; never exposed directly
  original_file_name String
  mime_type        String?
  file_size_bytes  Int?
  sha256_hash      String?  // SHA-256 of file contents; used for integrity verification
  uploaded_by_id   String?  // null for system-generated documents (PDFs)
  created_at       DateTime @default(now())

  organization     Organization        @relation(fields: [organization_id], references: [id])
  uploaded_by      User?               @relation("DocumentUploader", fields: [uploaded_by_id], references: [id])
  evidence         SubmissionEvidence[]
  signature_events SignatureEvent[]
  export_files     ExportFile[]

  @@index([organization_id, document_type])
  @@map("documents")
}

// ─────────────────────────────────────────────
// SIGNATURE EVENTS
//
// Full evidence capture for every signature action.
// One row per signature attempt (digital signing or verified upload).
// Captures the exact context at the moment of signing for evidentiary purposes.
// ─────────────────────────────────────────────

model SignatureEvent {
  id                  String          @id @default(cuid())
  submission_id       String          // plain field; join via application code
  document_id         String          // the document that was signed
  signature_method    SignatureMethod
  signer_name         String
  signer_email        String
  consent_text        String          // exact consent text shown to the signer
  document_hash       String?         // SHA-256 of document content at signing time
  request_ip          String?
  request_user_agent  String?
  signed_at           DateTime
  verified_by_user_id String?         // set for UPLOAD method after staff verification
  verified_at         DateTime?
  created_at          DateTime        @default(now())

  document     Document @relation(fields: [document_id], references: [id])
  verified_by  User?    @relation("SignatureVerifier", fields: [verified_by_user_id], references: [id])

  @@index([submission_id])
  @@map("signature_events")
}

// ─────────────────────────────────────────────
// EXTERNAL ACTION TOKENS
//
// For external recipients only (signature collection).
// Internal approvers use SSO session — NOT tokens.
//
// token_hash: stored as SHA-256 of the raw token; never stored plaintext.
// bound_email: validated before rendering the signature page.
// used_at: set on first valid use (one-time use).
// revoked_at: set when a new token is issued for the same submission (re-send).
// ─────────────────────────────────────────────

model ExternalActionToken {
  id            String    @id @default(cuid())
  submission_id String
  token_hash    String    @unique // SHA-256 of raw token; never stored plaintext
  token_type    String    // "SIGNATURE_REQUEST"
  bound_email   String    // email the token was issued to; validated on access
  expires_at    DateTime
  used_at       DateTime? // set on first valid use; prevents re-use
  revoked_at    DateTime? // set when superseded by a new token (re-send)
  created_at    DateTime  @default(now())

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@index([submission_id])
  @@map("external_action_tokens")
}

// ─────────────────────────────────────────────
// BACKGROUND JOB INFRASTRUCTURE
//
// Postgres-backed job queue.
// Worker polls via: SELECT ... WHERE status = 'PENDING' AND available_at <= NOW()
//                   FOR UPDATE SKIP LOCKED
//
// dedupe_key: idempotency key — NOT globally unique. Uniqueness is enforced at the
//   application layer (domain service checks for existing PENDING/RUNNING jobs with the
//   same key before enqueuing). A COMPLETE or DEAD_LETTER job with the same key does not
//   block future work.
//
// Per-job-type dedupe key strategy:
//   One-time jobs (generate PDF, expire token):  "{job_type}:{submission_id}"
//   Scheduled reminders:                          "{job_type}:{submission_id}:{iso_date}"
//   Overdue evaluation:                           "{job_type}:{organization_id}:{iso_date}"
//   Export generation:                            "{job_type}:{export_batch_id}"
// ─────────────────────────────────────────────

model JobQueue {
  id              String    @id @default(cuid())
  organization_id String?   // null for system-wide jobs
  job_type        String    // "SEND_APPROVAL_EMAIL" | "SEND_SIGNATURE_REQUEST" |
                             // "SEND_REMINDER" | "EXPIRE_TOKEN" | "GENERATE_PDF" |
                             // "EVALUATE_OVERDUE" | "CREATE_RECON_CHECKPOINT" | "GENERATE_EXPORT"
  dedupe_key      String?   // idempotency key; see strategy note above; NOT a DB unique constraint
  status          String    @default("PENDING")  // PENDING | RUNNING | COMPLETE | FAILED | DEAD_LETTER
  scheduled_for   DateTime  @default(now())
  available_at    DateTime  @default(now())      // honour delay (e.g. reminder in 3 days)
  locked_at       DateTime?
  locked_by       String?   // worker instance ID
  attempt_count   Int       @default(0)
  max_attempts    Int       @default(3)
  payload_json    Json
  last_error_text String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  organization Organization? @relation(fields: [organization_id], references: [id])

  @@index([status, available_at]) // worker poll index
  @@index([organization_id, job_type])
  @@map("job_queue")
}

// ─────────────────────────────────────────────
// OUTBOX EVENTS (transactional outbox pattern)
//
// Events written in the same DB transaction as the state change.
// Worker reads unpublished events and dispatches them.
// published_at: null until processed; indexed for worker polling.
// ─────────────────────────────────────────────

model OutboxEvent {
  id             String    @id @default(cuid())
  event_type     String    // "submission.submitted" | "approval.approved" | ...
  aggregate_type String    // "Submission" | "Organization"
  aggregate_id   String
  payload_json   Json
  published_at   DateTime? // null until dispatched by worker
  created_at     DateTime  @default(now())

  @@index([published_at])
  @@map("outbox_events")
}

// ─────────────────────────────────────────────
// NOTIFICATION DELIVERIES
// Tracks every outbound notification attempt and its outcome.
// ─────────────────────────────────────────────

model NotificationDelivery {
  id                  String    @id @default(cuid())
  organization_id     String?
  submission_id       String?   // plain field; join via application code
  channel             String    // "EMAIL" | "SLACK" (future)
  template_code       String    // "APPROVAL_REQUEST" | "SIGNATURE_REQUEST" | "REMINDER" | "OVERDUE"
  recipient_address   String
  provider_message_id String?   // AWS SES message ID
  status              String    @default("PENDING")  // PENDING | SENT | FAILED
  sent_at             DateTime?
  failed_at           DateTime?
  error_text          String?
  created_at          DateTime  @default(now())

  @@index([submission_id])
  @@index([status, created_at])
  @@map("notification_deliveries")
}

// ─────────────────────────────────────────────
// AUDIT EVENTS (business and control events only; append-only)
//
// Covers: memberships, submissions, approvals, documents, signatures, exports.
// actor_type: distinguishes human, system, API client, MCP agent.
// submission_id is a plain field (not a Prisma FK) to allow audit events to outlive
// the submissions they reference if submissions are ever purged.
// payload_json should capture a before/after snapshot for any sensitive field changes.
// ─────────────────────────────────────────────

model AuditEvent {
  id              String    @id @default(cuid())
  organization_id String
  submission_id   String?   // plain field; query by ID in application code
  event_type      String    // "membership.approved" | "submission.submitted" | "approval.rejected" | ...
  actor_type      ActorType
  actor_user_id   String?   // null for SYSTEM events
  payload_json    Json?     // context snapshot at time of event; sensitive values must be redacted
  request_ip      String?
  created_at      DateTime  @default(now())

  organization Organization @relation(fields: [organization_id], references: [id])
  actor        User?        @relation("AuditActor", fields: [actor_user_id], references: [id])

  @@index([organization_id, created_at])
  @@index([submission_id, created_at])
  @@map("audit_events")
}

// ─────────────────────────────────────────────
// SYSTEM EVENTS (operational/worker events; separate from business audit trail)
// ─────────────────────────────────────────────

model SystemEvent {
  id              String   @id @default(cuid())
  organization_id String?
  severity        String   // "INFO" | "WARN" | "ERROR" | "CRITICAL"
  component       String   // "worker" | "api" | "pdf_generator" | "email_sender" | ...
  event_type      String
  payload_json    Json?
  created_at      DateTime @default(now())

  organization Organization? @relation(fields: [organization_id], references: [id])

  @@index([severity, created_at])
  @@index([component, created_at])
  @@map("system_events")
}

// ─────────────────────────────────────────────
// ACCOUNTING EXPORT (Phase 4)
// Do not build application logic until real SQL Account CSV samples exist (OQ-5).
//
// Every export is a controlled, durable batch:
// - deterministic composition (same filter → same output)
// - snapshot_json captures values at export time (immutable record of what was exported)
// - re-export requires reason_text (audit requirement)
// ─────────────────────────────────────────────

model ExportBatch {
  id              String    @id @default(cuid())
  organization_id String
  export_type     String    // "ACCOUNTING_CSV" | "BANK_BATCH"
  status          String    @default("PENDING")  // PENDING | GENERATING | COMPLETE | FAILED
  requested_by_id String
  filter_json     Json?     // date range, payment type, etc.
  reason_text     String?   // mandatory for re-exports
  created_at      DateTime  @default(now())
  completed_at    DateTime?

  organization Organization    @relation(fields: [organization_id], references: [id])
  requested_by User            @relation("ExportRequester", fields: [requested_by_id], references: [id])
  items        ExportBatchItem[]
  files        ExportFile[]

  @@index([organization_id, export_type])
  @@map("export_batches")
}

model ExportBatchItem {
  id              String   @id @default(cuid())
  export_batch_id String
  submission_id   String   // plain field; join via application code
  snapshot_json   Json     // submission values at export time — immutable
  created_at      DateTime @default(now())

  export_batch ExportBatch @relation(fields: [export_batch_id], references: [id])

  @@unique([export_batch_id, submission_id])
  @@map("export_batch_items")
}

model ExportFile {
  id              String   @id @default(cuid())
  export_batch_id String
  document_id     String
  file_role       String   // "PRIMARY" | "BANK_BATCH"
  created_at      DateTime @default(now())

  export_batch ExportBatch @relation(fields: [export_batch_id], references: [id])
  document     Document    @relation(fields: [document_id], references: [id])

  @@map("export_files")
}

// ─────────────────────────────────────────────
// PETTY CASH — Phase 3
// Imprest float ledger model.
// OQ-PettyCashConfirm: confirm model with David before building application logic.
// ─────────────────────────────────────────────

model PettyCashFloat {
  id              String   @id @default(cuid())
  organization_id String
  custodian_id    String   // user_id of assigned custodian (plain field)
  name            String   // e.g. "Penang Office Petty Cash"
  ceiling_amount  Decimal  @db.Decimal(10, 2)
  low_threshold   Decimal  @db.Decimal(10, 2)
  current_balance Decimal  @db.Decimal(10, 2)
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  organization  Organization          @relation(fields: [organization_id], references: [id])
  entries       PettyCashEntry[]
  topup_details PettyCashTopupDetail[]

  @@map("petty_cash_floats")
}

model PettyCashEntry {
  id                  String             @id @default(cuid())
  float_id            String
  entry_type          PettyCashEntryType
  amount              Decimal            @db.Decimal(10, 2)
  description         String
  gl_account_id       String?
  project_id          String?
  recorded_by_id      String             // user_id of custodian (plain field)
  receipt_url         String?            // S3 key of receipt
  topup_submission_id String?            // Submission.id if entry is a top-up (plain field)
  created_at          DateTime           @default(now())

  float      PettyCashFloat @relation(fields: [float_id], references: [id])
  gl_account GlAccount?     @relation(fields: [gl_account_id], references: [id])
  project    Project?       @relation(fields: [project_id], references: [id])

  @@map("petty_cash_entries")
}

enum PettyCashEntryType {
  DISBURSEMENT    // money out; decrements balance; receipt attached
  TOPUP           // money in; increments balance; linked to approved submission
  RECONCILIATION  // periodic physical count; records discrepancy if any
}
```

---

## Key Design Decisions

### Per-type detail tables (change from v1.4)
The original design used one giant `Submission` table with many nullable fields.
v2.0 moves all payment-type-specific fields into six 1:1 detail tables.
The `Submission` header retains only truly universal fields.

Trade-off accepted: slightly more complex queries for full submission reads
(require join to detail table). Benefit: schema enforces per-type structure;
nullable sprawl eliminated; the 1:1 PK constraint prevents duplicate detail rows.

Note on integrity: the DB enforces "at most one detail row per type per submission"
(via the 1:1 PK). It does NOT enforce "a PAYMENT_VOUCHER submission must have a
PaymentVoucherDetail and no other detail row" — that is application-enforced in the
domain service (`src/domain/submission/create.ts`). This is deliberate: adding
cross-table check constraints or triggers for this would be over-engineering at
current scale. The domain service is the integrity boundary.

### current_state_code (change from v1.4)
Replaces the two-layer status model (`base_status` + three named string slots).
- `current_state_code`: plain String, type-prefixed (e.g. `"PV_DRAFT"`); app-validated
- `current_state_group`: StateGroup DB enum for dashboard/reporting queries
- `SubmissionTransition`: append-only history of every state change

The string slots (`workflow_status`, `document_status`, `finance_status`) are removed.
The workflow transition tables define what states are valid for each payment type.
The TypeScript state machine (`src/lib/stateMachine.ts`) enforces transitions at runtime.

### No tokens for internal approvals (change from v1.4)
`ApprovalStep.token` and `ApprovalStep.token_expires_at` are removed.
Internal approvals (Director, Manager) require an active SSO-authenticated session.
The email notification sends a deep-link to the approval page; the page requires session auth.
`ExternalActionToken` is used only for external recipients (signature collection).

Rationale: forwarded email equals delegated approval. Mailbox compromise equals silent
financial authorization. Token links are adequate for non-repudiation of external recipients
but not for internal financial decision makers.

### ApprovalDecision split from ApprovalStep (change from v1.4)
`ApprovalStep` defines the approval plan (who, which role, what order).
`ApprovalDecision` is the immutable record of what was decided (by whom, when, why).
One step can have at most one decision. A rejected submission resubmitted creates new steps.
The original design embedded action, notes, and actioned_at directly on the step row, which
made it harder to query approval history cleanly.

### ExternalActionToken table (change from v1.4)
Token fields previously embedded on `Submission` (7 fields) are replaced by a separate
`ExternalActionToken` table. Benefits:
- Multiple tokens per submission possible (for re-send without overwriting history)
- Revocation history preserved (revoked_at without deleting the row)
- token_hash stored (never plaintext); consistent with security best practices
- Clean separation: `Submission` is not polluted with token lifecycle fields

### Document storage model (change from v1.4)
`Document` no longer FK-linked directly to a submission.
`SubmissionEvidence` is the canonical join (submission ↔ document ↔ workflow event).
`Document` stores `storage_key` (S3 object key) and `storage_bucket` — never a pre-signed URL.
Pre-signed URLs are generated on demand with short TTL (enforced in application code).
`sha256_hash` added for content integrity verification.

### Job queue and outbox (new in v2.0)
Every deferred side effect (reminders, PDF generation, email dispatch, overdue detection,
token expiry) is queued as a `JobQueue` row. The worker processes jobs with:
- `dedupe_key` for idempotency (prevents duplicate sends)
- `available_at` for delay/scheduling
- `SELECT FOR UPDATE SKIP LOCKED` for concurrent worker safety
- `max_attempts` + `DEAD_LETTER` status for visibility on permanent failures

`OutboxEvent` uses the transactional outbox pattern: event rows written in the same
transaction as the state change, then dispatched by the worker. Prevents lost events
when the application crashes between the state change and the notification send.

`JobQueue.dedupe_key` is NOT a DB-level unique constraint. Uniqueness among active
(PENDING/RUNNING) jobs is enforced by the domain service at enqueue time. This allows
legitimate repeated work — e.g., a second reminder for the same submission on a later
date uses a different key (includes the date), not the same key. Per-job-type key
strategy is documented in the `job_queue` model comment.

### RETRACTED removed (change from v1.4)
`RETRACTED` as a `BaseStatus` value is replaced by a workflow transition in the
`WorkflowTransitionRule` table. The action `"RETRACT"` is a first-class transition
from submitter-editable states back to `DRAFT` state for the relevant payment type.
This keeps retraction logic consistent with the rest of the workflow engine.

### Workflow tables seeded, not admin-configured (MVP)
`WorkflowDefinition`, `WorkflowState`, and `WorkflowTransitionRule` rows are seeded at
application startup from code-defined constants (in `src/lib/workflowSeed.ts`).
No admin UI is required to configure transitions in the MVP phase.
The tables enable future admin configurability without a schema migration.

Each `Submission` stores `workflow_definition_id` — a FK pointing to the specific
`WorkflowDefinition` version that was active when the submission was created. This means:
- Transitions are validated against the bound definition, not the currently active one.
- In-flight submissions are unaffected if workflow rules are updated mid-operation.
- "One active definition per payment type" is enforced by the domain service at activation
  time (no DB partial unique index, as Prisma SDL does not support them). Application sets
  `is_active = false` on the previous version when activating a new one.

### Petty Cash and Export (unchanged from v1.4)
`PettyCashFloat` and `PettyCashEntry` remain in the schema, gated behind OQ-PettyCashConfirm.
`ExportBatch`/`ExportBatchItem`/`ExportFile` are in the schema but gated behind OQ-5
(SQL Account CSV sample). No application logic should be built against these until
the respective open questions are resolved.

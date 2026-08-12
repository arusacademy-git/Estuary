# Estuary — Master Review Document

> **SUPERSEDED — DO NOT USE AS REFERENCE**
> This document was the submission package sent to Codex for independent review.
> It reflects the pre-review design (Schema v1.4, two-layer status model, embedded approval tokens).
> The authoritative current design is in:
> - `docs/SCHEMA.md` v2.2
> - `docs/SOFTWARE_SCOPE.md` v0.8
> - `PROJECT_ROADMAP.md`
> - `docs/Review by Codex/` and `docs/Review 2 by Codex/` (Codex findings)
> Kept for historical reference only.

---

**Prepared for:** Independent technical review (ChatGPT Codex)
**Prepared by:** ALAKAZAM01 (Architect)
**Date:** 2026-04-12
**Status:** Pre-scaffold. No code exists yet. This document covers product scope, architecture decisions, tech stack, database schema, and implementation plan.

---

## 1. What Is Estuary?

Estuary is an internal finance operations hub for **Arus Education Sdn Bhd** (a Malaysian education company operating across Kuala Lumpur and Penang). It replaces a fragmented set of Google Forms, Google Sheets (Apps Script), Kakitangan HR software, and manual processes with a single web application that owns the full money-out lifecycle.

The system is designed from day one to be:
- **Multi-entity** — built for a group of companies, not a single entity
- **API-first** — every action is a REST endpoint; the web UI is one consumer, not the only one
- **MCP-capable** — an MCP server wraps the REST API so AI agents can interact with Estuary programmatically
- **Extensible** — commercialization path is an explicit design constraint; Docker from day one

---

## 2. The Problem Being Solved

Current state (before Estuary):

| Problem | Impact |
|---------|--------|
| Payment vouchers generated via Google Sheets Apps Script | Silent failures; no error visibility; no version control |
| Signed PVs collected manually by staff | PVs go uncollected for weeks; no automated chase |
| GL/CoA coding done by finance staff after the fact | Finance staff lack ground context; codes are wrong or late |
| Every money-out event touches 2–4 disconnected systems | High human error rate; stale records; unauditable |
| Cash advance reconciliation tracked in spreadsheets | Multi-checkpoint process not enforced; overdue advances not flagged |
| Petty cash is a physical box + spreadsheet | No GL coding; no audit trail; no alerts |
| 4 admin staff with overlapping job scopes | Redundancy; error-prone manual re-entry |

Target state (with Estuary): one system owns the full lifecycle. Finance headcount reduced. Auditing is reading an event log, not reconciling stale copies.

---

## 3. User Personas

| Persona | Auth Method | Key Capabilities |
|---------|-------------|-----------------|
| **Submitter** | Google OAuth (SSO) | Submit any payment type; track own submissions |
| **Manager** | Google OAuth (SSO) | First-level approver for CA and Travel Allowance |
| **Director** | Google OAuth (SSO) | Final approver for PV, CA, Travel Allowance |
| **Petty Cash Custodian** | Google OAuth (SSO) | Record disbursements; submit top-up requests |
| **Finance Admin** | Google OAuth (SSO) | Process payments; manage overdue dashboard; export to accounting |
| **Owner/Operator** | Google OAuth (SSO) | Cross-entity view; system config; audit access |
| **External Recipient** | Tokenised email link (no login) | Sign PVs via in-browser canvas or file upload |
| **API / MCP Client** | API key (`X-API-Key` header) | Programmatic access to all endpoints |

New users sign in via Google SSO and receive `MembershipStatus = PENDING`. An org admin (OWNER or FINANCE_ADMIN) approves them to `ACTIVE`. PENDING users see no org data.

A user can hold **multiple roles simultaneously** in the same org (e.g. MANAGER + PETTY_CASH_CUSTODIAN).

---

## 4. Payment Types

Six payment types share a common data model (one `Submission` table), each with its own approval chain and lifecycle variations.

| Payment Type | Approval | Signed Doc? | Reconciliation? |
|-------------|----------|-------------|-----------------|
| **Payment Voucher** | Director (1 step) | Yes — external recipient | No |
| **Invoice Payment** | None | Optional | No |
| **Cash Advance** | Manager → Director (2 steps) | No | Yes — 3-checkpoint (2w/3w/4w) |
| **Travel Allowance** | Manager → Director (2 steps) | No | No |
| **Expense Claim** | None | No | No |
| **Petty Cash Top-up** | Manager → Director (same as CA) | No | No (replenishment, not advance) |

**Manager and Director can be the same person** — configured per organization.

---

## 5. Status Model

Every submission has a **two-layer status**:

### Layer 1 — `base_status` (PostgreSQL enum, universal)

Applies to all payment types. Drives cross-type Finance Admin dashboards.

| Value | Who Sets It | Meaning |
|-------|-------------|---------|
| `DRAFT` | System | Saved but not submitted |
| `SUBMITTED` | Staff | Submitted; pending review or approval |
| `PROCESSED` | Finance Admin | Payment made; bank transfer proof attached |
| `REJECTED` | Finance or Approver | Turned down; returns to DRAFT for amendment |
| `ERROR` | System | Processed but bank transfer failed |
| `RETRACTED` | Submitter | Staff pulls back own submission after submitting; can revert to DRAFT |

### Layer 2 — Three named extended slots (plain strings, app-validated)

Not DB enums. Adding new values requires only a code change to the state machine — no migration.

| Field | Covers | Current valid values per type |
|-------|--------|-------------------------------|
| `workflow_status` | Approval/processing position | `PENDING_APPROVAL` (PV, CA, Travel) |
| `document_status` | Document and signature state | `RECIPIENT_COPY_RETURNED` (PV) |
| `finance_status` | Finance-side closure | `RECONCILED` (CA), `COMPLETE` (all types) |

UI reads extended slots first; falls back to `base_status` when all three are null.

State machine config lives at `src/lib/stateMachine.ts`.

---

## 6. Transaction Dimensions (SQL Account Alignment)

Every transaction carries four dimensions that mirror SQL Account's structure. These appear on every line of the accounting CSV export.

| Dimension | Level | Behavior |
|-----------|-------|----------|
| **Agent** | Header | Auto-populated from submitter's org profile; overridable |
| **Area** | Header | Auto-populated from submitter's default office (KL/Penang); overridable. **Never printed on PV PDF** — for accounting only |
| **GL Code** | Line | Selected per line from org's GL code list |
| **Project** | Line | Selected per line from org's project list |

### Line count rules by payment type

| Type | GL / Project per | Lines |
|------|-----------------|-------|
| Payment Voucher | Per document | Default 1 (schema supports N) |
| Invoice Payment | Per document | Default 1 (schema supports N) |
| Cash Advance | Per line | 1..N |
| Travel Allowance | Per line | 1..N |
| Expense Claim | Per line | 1..N |

Each `SubmissionLine` generates one row in the SQL Account CSV export.

---

## 7. Payment Voucher Details

Key fields from the current physical PV (Arus Education Sdn Bhd):

| Field | Source |
|-------|--------|
| PV number | `document_number` — format `PV-YYYY-MM-ZZ`, resets monthly |
| Company header | `Organization.name`, `Organization.registration_no`, `Organization.address` |
| Date | `document_generated_at` |
| Amount | `total_amount` |
| Amount in words | Auto-generated in Malay (Ringgit Malaysia format) |
| Mode of payment | `payment_mode` |
| Bank name + account | `recipient_bank_name`, `recipient_bank_account` |
| To whom (name + IC) | `recipient_name`, `recipient_ic` |
| "Being" description | `description` |
| Payee name | `recipient_name` |
| Approved by + signature | Approver's name + `UserOrgMembership.signature_url` (pre-stored image) |
| Paid by + date + reference | `Organization.name`, `paid_at`, `paid_reference` |
| "Received by" box | Blank on outgoing PDF — filled by signature collection module |

### PV Signature Collection — Two Methods

**DIGITAL (preferred):**
- Recipient receives tokenised email link bound to their email address
- Opens page, signs via in-browser canvas pad (draw, type, or upload image)
- System generates signed PDF server-side
- Legally valid under Malaysia's Electronic Commerce Act 2006
- Status: `SIGNATURE_COLLECTED` → automatically `SIGNATURE_VERIFIED`

**UPLOAD (fallback):**
- Same tokenised link; recipient downloads, prints, signs, scans, uploads
- Issuing staff manually reviews the uploaded scan in Finance Admin UI
- Staff marks verified or re-requests
- Status: `SIGNATURE_COLLECTED` → `SIGNATURE_PENDING_VERIFICATION` → `SIGNATURE_VERIFIED`

Token is bound to `signature_token_email`. Token has an expiry. Expired links show a message; staff re-sends from overdue dashboard.

### Batch (Mass) PV Creation

A `Batch` is a first-class entity grouping N submissions.
- One approval action covers the entire batch
- N PVs generated with sequential `document_number` values
- N signature request emails fired automatically
- API: `POST /api/v1/batches` — primary migration path from Google Sheets PV system

---

## 8. Cash Advance Reconciliation

The most complex lifecycle in the system.

```
After PAYMENT_PROCESSED:

[Checkpoint 1 — 2 weeks]
  Staff submits reconciliation:
    Outcome A (exact spend)   → upload docs → finance_status = COMPLETE
    Outcome B (underspend)    → confirm balance returned → upload docs → COMPLETE
    Outcome C (overspend)     → submit new linked CA for overspent amount
                                original held in workflow_status = PENDING_CHILD_CLOSURE
                                when child CA reaches COMPLETE → original COMPLETE

[Checkpoint 2 — 3 weeks, if not yet closed]
  Same outcomes

[Checkpoint 3 — 4 weeks, mandatory]
  Same outcomes
  If still unreconciled: base_status remains SUBMITTED, finance_status = OVERDUE
  → Submitter BLOCKED from new CA submissions (enforced in API layer)
  → Finance Admin + Owner alerted
```

- Automated email reminders to submitter at each checkpoint (same engine as PV collection)
- Unified overdue dashboard: signed PVs + CA reconciliations in one view
- All reconciliation outcomes require full supporting documentation at close-out
- Overspend child CA has `parent_submission_id` FK to original; original cannot close while child is open

---

## 9. Petty Cash (Phase 3 — proposed model, pending confirmation)

**Imprest float ledger model:**

- Each physical cash box is a `PettyCashFloat` record with a custodian, ceiling (e.g. RM500), and low-balance threshold
- `current_balance` is the source of truth; physical cash should match it
- Disbursements recorded by custodian — no approval; custodian is the control point; receipt attached; GL and Project coded per entry
- When balance drops below threshold → custodian submits a top-up request → flows through CA approval chain (Manager → Director); no reconciliation leg
- Monthly reconciliation: custodian submits physical count vs. system balance; discrepancies flagged to Finance Admin
- All disbursements flow into the accounting export

---

## 10. Tech Stack

All decisions are locked.

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14+ (TypeScript) | Full-stack; SSR for PDF rendering; same language as MCP server |
| REST API | Next.js API routes under `/api/v1/` | API-first; versioned from day one |
| MCP Server | `@modelcontextprotocol/sdk` (TypeScript) | Official SDK; same monorepo; shared types with REST API |
| Database | PostgreSQL 15 (AWS RDS db.t4g.micro, locally via Docker) | Relational integrity for financial records; ACID transactions; PITR on RDS |
| ORM | Prisma | Type-safe schema; migration history; readable query layer |
| Auth — web users | NextAuth.js v5 + Google OAuth provider | SSO; matches existing Google Workspace identity |
| Auth — API/MCP | API keys (`X-API-Key` header, scoped, revocable) | Programmatic access |
| Email | AWS SES (domain already verified) | Already configured; same billing account |
| File storage | AWS S3 | Documents, PV PDFs, signed documents |
| PDF generation | React-PDF or Puppeteer (TBD at implementation) | Server-side PV PDF generation |
| Containerization | Docker (Compose for local dev) | Portable; Lightsail now → ECS when commercializing; zero code changes |
| Local deployment | Docker Compose (PostgreSQL + app) | Development environment |
| Production deployment | AWS Lightsail (2GB instance) + RDS + S3 + SES | ~$26–30/month |

### Why not PHP / shared hosting
MCP servers are persistent processes. Shared hosting (cPanel) cannot run persistent Node.js processes. PHP has no mature MCP SDK. Stack is ruled out by the MCP requirement.

### Why RDS over self-managed PostgreSQL
Financial records require point-in-time recovery (PITR), not just periodic pg_dump snapshots. PITR requires WAL archiving; RDS provides this natively. At $13/month it is non-negotiable for a finance system.

### API design principles
- All endpoints under `/api/v1/`
- Bearer token for web sessions; `X-API-Key` for programmatic clients
- Response envelope: `{ data }` on success, `{ error: { code, message, details } }` on failure
- Cursor-based pagination on all list endpoints
- OpenAPI spec generated from code

### MCP tool surface (illustrative)
```
list_pending_approvals()
approve_submission(submission_id, notes)
reject_submission(submission_id, reason)
create_payment_voucher_batch(name, recipients[])
get_overdue_pvs()
get_overdue_reconciliations()
get_submission_status(submission_id)
generate_accounting_export(date_from, date_to)
list_coa_codes()
get_audit_log(filters)
```

---

## 11. Database Schema (Prisma SDL)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// MULTI-ENTITY FOUNDATION
// ─────────────────────────────────────────────

model Organization {
  id               String   @id @default(cuid())
  name             String
  registration_no  String
  address          String   // registered address — printed on all PV PDFs
  currency         String   @default("MYR")
  is_active        Boolean  @default(true)
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  memberships        UserOrgMembership[]
  gl_accounts        GlAccount[]
  agents             Agent[]
  areas              Area[]
  projects           Project[]
  submissions        Submission[]
  batches            Batch[]
  document_sequences DocumentSequence[]
  petty_cash_floats  PettyCashFloat[]
  audit_events       AuditEvent[]

  @@map("organizations")
}

model User {
  id         String   @id @default(cuid())
  email      String   @unique
  name       String
  avatar_url String?
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  memberships    UserOrgMembership[]
  submissions    Submission[]        @relation("Submitter")
  approval_steps ApprovalStep[]
  audit_events   AuditEvent[]

  @@map("users")
}

model UserOrgMembership {
  id              String           @id @default(cuid())
  user_id         String
  organization_id String
  status          MembershipStatus @default(PENDING)
  agent_id        String?          // FK → Agent (SQL Account agent code for this user in this org)
  default_area_id String?          // FK → Area (pre-fills Area on submissions)
  signature_url   String?          // S3 URL — Directors/Managers; rendered on approved PV PDFs
  is_active       Boolean          @default(true)
  created_at      DateTime         @default(now())
  updated_at      DateTime         @updatedAt

  user         User         @relation(fields: [user_id], references: [id])
  organization Organization @relation(fields: [organization_id], references: [id])
  agent        Agent?       @relation(fields: [agent_id], references: [id])
  default_area Area?        @relation("DefaultArea", fields: [default_area_id], references: [id])
  roles        UserOrgRole[]

  @@unique([user_id, organization_id])
  @@map("user_org_memberships")
}

enum MembershipStatus {
  PENDING    // SSO authenticated; awaiting org admin approval
  ACTIVE     // approved; full org access
  SUSPENDED  // access removed; record retained for audit
}

model UserOrgRole {
  id            String    @id @default(cuid())
  membership_id String
  role          OrgRole
  created_at    DateTime  @default(now())

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
// All: code, name, description, is_active.
// ─────────────────────────────────────────────

model GlAccount {
  id              String   @id @default(cuid())
  organization_id String
  code            String   // e.g. "5100"
  name            String   // e.g. "Transport Expenses"
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
  code            String   // e.g. "KL", "PENANG"
  name            String
  description     String?  // e.g. full office address
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
// DOCUMENT SEQUENCE (universal serial numbering)
// ─────────────────────────────────────────────
// Format: {PREFIX}-{YYYY}-{MM}-{ZZ}
// ZZ resets to 01 each month.
// Examples: PV-2025-04-08, CA-2025-04-01, INV-2025-04-03
// Row is SELECT FOR UPDATE-locked during generation — no gaps under concurrency.
// admin_next_sequence: admin override; consumed once then cleared to NULL.

model DocumentSequence {
  id                  String      @id @default(cuid())
  organization_id     String
  payment_type        PaymentType
  year                Int
  month               Int         // 1–12
  prefix              String      // configurable per org per type
  last_sequence       Int         @default(0)
  admin_next_sequence Int?        // admin override; cleared after use

  organization Organization @relation(fields: [organization_id], references: [id])

  @@unique([organization_id, payment_type, year, month])
  @@map("document_sequences")
}

// ─────────────────────────────────────────────
// BATCH (mass creation — primarily PV)
// ─────────────────────────────────────────────

model Batch {
  id              String      @id @default(cuid())
  organization_id String
  name            String      // e.g. "April Teacher Transport Claims"
  payment_type    PaymentType
  status          BatchStatus @default(DRAFT)
  created_by_id   String
  created_at      DateTime    @default(now())
  updated_at      DateTime    @updatedAt

  organization Organization @relation(fields: [organization_id], references: [id])
  submissions  Submission[]

  @@map("batches")
}

enum BatchStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  PROCESSING
  COMPLETE
  VOIDED
}

// ─────────────────────────────────────────────
// SUBMISSION (parent archetype — all payment types)
// ─────────────────────────────────────────────

model Submission {
  id              String      @id @default(cuid())
  organization_id String
  batch_id        String?
  payment_type    PaymentType

  // ── Two-layer status ──────────────────────────────────────────────────────
  // base_status: universal DB enum; drives cross-type queries and dashboards
  // workflow_status / document_status / finance_status: plain strings, per-type,
  //   app-validated in src/lib/stateMachine.ts. Not DB enums — new values = code change only.
  //
  // Current valid extended values:
  //   workflow_status: PENDING_APPROVAL (PV, CA, Travel)
  //   document_status: RECIPIENT_COPY_RETURNED (PV)
  //   finance_status:  RECONCILED (CA) | COMPLETE (all) | OVERDUE (CA)
  // ─────────────────────────────────────────────────────────────────────────
  base_status     BaseStatus @default(DRAFT)
  workflow_status String?
  document_status String?
  finance_status  String?

  // Universal serial number e.g. PV-2025-04-08
  document_number       String?   @unique
  document_generated_at DateTime?
  document_pdf_url      String?   // S3 URL of unsigned document PDF

  // Submitter
  submitted_by_id String
  submitted_at    DateTime?

  // Accounting dimensions — header-level; from submitter's org profile; overridable
  // Area: for accounting/export only — NEVER printed on PV PDF
  agent_id String?
  area_id  String?

  // Totals
  total_amount Decimal     @db.Decimal(12, 2)  // sum of SubmissionLines
  currency     String      @default("MYR")

  // Description ("Being" field on PV; purpose on other types)
  description String?

  // Payment method — non-nullable; required for bank batch export
  payment_mode PaymentMode

  // Recipient (PV, Invoice; optional on others)
  recipient_name         String?
  recipient_ic           String?   // Malaysian IC or passport number
  recipient_email        String?   // for signature request emails and reminders
  recipient_phone        String?   // for future WhatsApp/SMS channel
  recipient_bank_name    String?
  recipient_bank_account String?

  // Signature collection
  // DIGITAL: in-browser canvas; system generates signed PDF; auto-verified
  // UPLOAD:  recipient uploads scan; staff manually verifies
  // Token is bound to signature_token_email; validated before page renders
  signature_method           SignatureMethod?
  signature_token            String?          @unique
  signature_token_email      String?
  signature_token_expires_at DateTime?
  signature_requested_at     DateTime?
  signature_collected_at     DateTime?
  signed_document_url        String?

  // Upload verification (UPLOAD method only; DIGITAL skips this)
  signature_verified_by_id String?
  signature_verified_at    DateTime?

  // Payment
  paid_at                 DateTime?
  paid_reference          String?
  bank_transfer_proof_url String?   // Google Drive link; set when base_status = PROCESSED

  // CA: overspend parent-child link
  parent_submission_id String?
  parent_submission    Submission?  @relation("CaOverspend", fields: [parent_submission_id], references: [id])
  child_submissions    Submission[] @relation("CaOverspend")

  // CA: reconciliation
  recon_due_at     DateTime?     // paid_at + 14 days
  recon_checkpoint Int?          // 1 (2w) | 2 (3w) | 3 (4w)
  recon_outcome    ReconOutcome?
  recon_closed_at  DateTime?
  // OVERDUE (checkpoint 3, unreconciled): submitter blocked from new CAs — enforced in API

  // Accounting export
  exported_at      DateTime?
  export_batch_ref String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  organization   Organization     @relation(fields: [organization_id], references: [id])
  submitted_by   User             @relation("Submitter", fields: [submitted_by_id], references: [id])
  agent          Agent?           @relation(fields: [agent_id], references: [id])
  area           Area?            @relation(fields: [area_id], references: [id])
  batch          Batch?           @relation(fields: [batch_id], references: [id])
  lines          SubmissionLine[]
  approval_steps ApprovalStep[]
  documents      Document[]
  audit_events   AuditEvent[]

  @@index([organization_id, base_status])
  @@index([organization_id, payment_type])
  @@index([organization_id, workflow_status])
  @@index([document_number])
  @@index([organization_id, submitted_by_id])
  @@map("submissions")
}

enum PaymentType {
  PAYMENT_VOUCHER
  INVOICE_PAYMENT
  CASH_ADVANCE
  TRAVEL_ALLOWANCE
  EXPENSE_CLAIM
  PETTY_CASH_TOPUP  // CA approval chain; no reconciliation leg
}

enum BaseStatus {
  DRAFT
  SUBMITTED
  PROCESSED
  REJECTED
  ERROR
  RETRACTED  // staff-initiated; reverts to DRAFT; only before Finance acts
}

enum PaymentMode {
  BANK_TRANSFER
  CASH
  CHEQUE
  IBG
  DUITNOW
}

enum SignatureMethod {
  DIGITAL
  UPLOAD
}

enum ReconOutcome {
  EXACT
  UNDERSPEND
  OVERSPEND
}

// ─────────────────────────────────────────────
// SUBMISSION LINES
// Agent + Area: header only. GL Code + Project: always line-level.
// PV and Invoice default to 1 line (UX default, not DB constraint).
// ─────────────────────────────────────────────

model SubmissionLine {
  id            String   @id @default(cuid())
  submission_id String
  line_number   Int      // 1-based display order
  description   String?
  amount        Decimal  @db.Decimal(12, 2)
  gl_account_id String?
  project_id    String?

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)
  gl_account GlAccount? @relation(fields: [gl_account_id], references: [id])
  project    Project?   @relation(fields: [project_id], references: [id])

  @@unique([submission_id, line_number])
  @@map("submission_lines")
}

// ─────────────────────────────────────────────
// APPROVAL STEPS
// PV: 1 step (Director). CA + Travel: 2 steps (Manager → Director).
// Invoice + Claims: 0 steps.
// Mass approval: POST /api/v1/approvals/bulk — no schema change.
// Tokens are single-use, no-login-required email links.
// ─────────────────────────────────────────────

model ApprovalStep {
  id               String          @id @default(cuid())
  submission_id    String
  step_number      Int
  required_role    ApprovalRole
  approver_id      String?
  token            String?         @unique
  token_expires_at DateTime?
  action           ApprovalAction?
  notes            String?         // mandatory on REJECTED
  actioned_at      DateTime?
  created_at       DateTime        @default(now())

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)
  approver   User?      @relation(fields: [approver_id], references: [id])

  @@unique([submission_id, step_number])
  @@map("approval_steps")
}

enum ApprovalRole {
  MANAGER
  DIRECTOR
}

enum ApprovalAction {
  APPROVED
  REJECTED
}

// ─────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────

model Document {
  id              String       @id @default(cuid())
  submission_id   String
  document_type   DocumentType
  file_name       String
  file_url        String       // S3 URL
  file_size_bytes Int?
  uploaded_by_id  String?      // null for system-generated PDFs
  uploaded_at     DateTime     @default(now())

  submission Submission @relation(fields: [submission_id], references: [id], onDelete: Cascade)

  @@map("documents")
}

enum DocumentType {
  SUPPORTING_DOC      // receipts, invoices — uploaded at submission
  GENERATED_PDF       // system-generated unsigned document
  SIGNED_DOCUMENT     // final signed document (digital or uploaded scan)
  RECONCILIATION_DOC  // CA close-out supporting docs
}

// ─────────────────────────────────────────────
// AUDIT TRAIL (append-only — never updated or deleted)
// ─────────────────────────────────────────────

model AuditEvent {
  id              String         @id @default(cuid())
  organization_id String
  submission_id   String?
  actor_id        String?        // null for system events
  actor_type      AuditActorType @default(USER)
  event_type      String         // dot-namespaced: e.g. submission.submitted, approval.approved
  payload         Json?          // context snapshot at time of event
  ip_address      String?
  created_at      DateTime       @default(now())

  organization Organization @relation(fields: [organization_id], references: [id])
  submission   Submission?  @relation(fields: [submission_id], references: [id])
  actor        User?        @relation(fields: [actor_id], references: [id])

  @@index([organization_id, created_at])
  @@index([submission_id, created_at])
  @@map("audit_events")
}

enum AuditActorType {
  USER
  SYSTEM
  API_CLIENT
  MCP_AGENT
}

// ─────────────────────────────────────────────
// PETTY CASH (Phase 3 — model pending final confirmation)
// ─────────────────────────────────────────────

model PettyCashFloat {
  id              String   @id @default(cuid())
  organization_id String
  custodian_id    String
  name            String
  ceiling_amount  Decimal  @db.Decimal(10, 2)
  low_threshold   Decimal  @db.Decimal(10, 2)
  current_balance Decimal  @db.Decimal(10, 2)
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  organization Organization     @relation(fields: [organization_id], references: [id])
  entries      PettyCashEntry[]

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
  recorded_by_id      String
  receipt_url         String?
  topup_submission_id String?
  created_at          DateTime           @default(now())

  float      PettyCashFloat @relation(fields: [float_id], references: [id])
  gl_account GlAccount?     @relation(fields: [gl_account_id], references: [id])
  project    Project?       @relation(fields: [project_id], references: [id])

  @@map("petty_cash_entries")
}

enum PettyCashEntryType {
  DISBURSEMENT
  TOPUP
  RECONCILIATION
}
```

---

## 12. Key Design Decisions

### Single Submission table for all payment types
All six payment types share one table, distinguished by `payment_type`. 80% of fields are identical across types. Type-specific fields (recon fields, signature fields) are nullable where they don't apply. Benefits: unified reporting, single overdue dashboard, consistent audit trail, simpler API surface.

### Two-layer status with three extended slots
`base_status` is a small DB enum — fast to index, universal. Three named string slots (`workflow_status`, `document_status`, `finance_status`) add type-specific state without DB migrations. Named slots give semantic clarity; plain strings mean new states are a code change only.

### RETRACTED vs REJECTED
- `RETRACTED`: staff-initiated before Finance acts. Reverts to DRAFT.
- `REJECTED`: Finance or approver-initiated. Reason recorded in `ApprovalStep.notes`. Reverts to DRAFT.

### Universal document serial numbering
`DocumentSequence`: one row per org + type + year + month. Format `PREFIX-YYYY-MM-ZZ`. ZZ resets monthly. `SELECT FOR UPDATE` lock prevents gaps under concurrency. `admin_next_sequence` supports migration continuity.

### Roles as a join table
`UserOrgRole` is a M:M join — one person can hold MANAGER + PETTY_CASH_CUSTODIAN simultaneously. Role checks query `UserOrgRole` rows.

### SSO + manual membership approval
New users arrive as `MembershipStatus.PENDING`. Org admin promotes to `ACTIVE`. PENDING users are blocked at middleware. No org data visible until approved.

### Approval tokens are single-use, no-login
Each `ApprovalStep` has a token sent by email. Token is valid for one action. After use, `actioned_at` is set and token is inert. Rejection creates new `ApprovalStep` rows on resubmission.

### payment_mode is non-nullable
Every submission declares payment method. Required for bank batch export — you cannot include a CASH payment in a bank transfer file.

### PV address is always the registered company address
`Organization.address` is on every PV regardless of which office the submitter belongs to. `area` on the submission header is for accounting and export only — never rendered on PDF.

---

## 13. Implementation Plan

### Phase 1 — Payment Voucher System (Most Urgent — replaces Google Sheets Apps Script)

**Infrastructure:**
- Docker Compose: PostgreSQL 15 + Next.js app for local development
- AWS: Lightsail (2GB) + RDS PostgreSQL (db.t4g.micro) + S3 + SES

**Scaffold:**
- Next.js 14 (App Router, TypeScript)
- Prisma schema migration (Phase 1 tables only: Organization through ApprovalStep)
- NextAuth.js v5 with Google OAuth provider
- Organization switcher UI (Xero model)
- Membership approval flow (admin approves PENDING users)

**Payment Voucher features:**
- PV submission form (single-line, Director approval)
- Director approval via tokenised email link (no login)
- PV PDF generation with approver signature image
- `DocumentSequence` locking for PV-YYYY-MM-ZZ numbering
- Signed PV collection: tokenised link to recipient, DIGITAL + UPLOAD methods
- Automated reminder engine (configurable cadence)
- Overdue PV dashboard for Finance Admin
- Batch (mass) PV creation: `POST /api/v1/batches`
- Audit trail: every state transition

**API:**
- `POST /api/v1/submissions` — create submission
- `GET /api/v1/submissions` — list with filters
- `GET /api/v1/submissions/:id` — single submission
- `POST /api/v1/submissions/:id/approve` — process approval step
- `POST /api/v1/batches` — create batch
- `GET /api/v1/batches/:id` — batch status
- `POST /api/v1/approvals/bulk` — mass approve

**MCP stubs:**
- `list_pending_approvals()`
- `approve_submission(submission_id, notes)`
- `get_overdue_pvs()`
- `create_payment_voucher_batch(name, recipients[])`

---

### Phase 2 — Invoice, Cash Advance, Travel Allowance

- Invoice submission (no approval; direct to PROCESSED)
- Cash Advance: 2-step approval + 3-checkpoint reconciliation engine
- Travel Allowance: 2-step sequential approval
- Unified overdue dashboard (PVs + CA reconciliations)
- Extended API surface for new types

---

### Phase 3 — Petty Cash + Expense Claims

- Petty Cash float ledger (PettyCashFloat + PettyCashEntry)
- Disbursement recording; top-up requests; monthly reconciliation
- Expense Claim submission (no approval)
- Kakitangan deprecation for claims

---

### Phase 4 — Accounting Export

- CoA / GL management UI
- SQL Account CSV export — **requires a real sample import file before building**
- Export idempotency and re-export flagging
- Bank payment batch CSV export (Maybank2U Business format)

---

### Phase 5 — Scale-Down Admin + Configuration

- Approval chain configuration UI per payment type per org
- Email template management UI
- PV template configuration per org
- Reporting: spend by GL, type, period, org
- Full audit trail search and export

---

### Phase 6 — Future

- Direct bank payment API (Maybank2U / DuitNow)
- WhatsApp/Telegram channel for signature collection and approvals (MCP layer already extensible)
- Expanded MCP tool surface as modules ship
- Commercialization: migrate from Lightsail to ECS + RDS Multi-AZ

---

## 14. What This Replaces

| Current System | Replaced By | Phase |
|---------------|-------------|-------|
| Google Sheets Apps Script PV system | PV Engine + Signature Collection | Phase 1 |
| Google Forms (invoice, cash advance, travel) | Submission Portal + Approval Workflow | Phase 2 |
| Petty cash spreadsheet | Petty Cash Float Ledger | Phase 3 |
| Expense claims via Kakitangan | Submission Portal | Phase 3 |
| Manual accounting entry | SQL Account CSV Export | Phase 4 |

---

## 15. Open Questions (Not Blocking Phase 1 or 2)

| # | Question | Blocks |
|---|----------|--------|
| OQ-PettyCashConfirm | Is the imprest float ledger model correct for petty cash? | Phase 3 design |
| OQ-5 | SQL Account CSV sample import file required before building export | Phase 4 build |

---

## 16. Estimated Monthly AWS Cost (Production)

| Service | Cost |
|---------|------|
| Lightsail 2GB instance | $10 |
| RDS db.t4g.micro PostgreSQL | $13 |
| S3 (small document volume) | ~$2–5 |
| SES (domain already configured) | ~$0 |
| Route 53 (domain already owned) | ~$0.50 |
| **Total** | **~$26–30/month** |

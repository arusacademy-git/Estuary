# Estuary — Software Scope

- Version: 0.8
- Status: Draft — pending OQ-PettyCashConfirm (Phase 5 only) and OQ-5 (Phase 6 only). Phases 0–2 unblocked.
- Author: ALAKAZAM01
- Date: 2026-04-12

---

## 1. Problem Statement

Arus currently operates its internal finance function across four disconnected systems:
Google Forms, Google Sheets (Apps Script), Kakitangan, and SQL Account. Each system
handles a fragment of the payment lifecycle. No system owns the full picture. The gaps
between them are filled by admins performing manual data re-entry, manual vetting,
manual document chasing, and manual accounting entries — all high-error, unauditable,
and unscalable.

Specific failure modes:
- Signed payment vouchers go uncollected for extended periods; no automated chase.
- CoA coding is applied late, by finance staff who lack ground-level context.
- Apps Script silently fails in ways invisible until someone notices a missing PV.
- Every money-out event requires at least two humans to touch it in different systems.
- Auditing requires manual reconciliation across multiple stale copies of the same record.
- Cash advance reconciliation tracked in spreadsheets; multi-checkpoint process not enforced.
- Overspent cash advances require a follow-up advance with no formal linkage to the original.
- Petty cash is a physical box with a spreadsheet; no CoA coding, no audit trail, no alerts.

---

## 2. Goals

| Priority | Goal |
|----------|------|
| P0 | Single source of truth for all money-out events |
| P0 | Automated signed PV collection via email (no human chasing) |
| P0 | CoA-tagged CSV export compatible with SQL Account import format |
| P1 | Full lifecycle tracked in one place: submission → approval → payment → document collection |
| P1 | Cash advance multi-checkpoint reconciliation with automated enforcement |
| P1 | Eliminate redundant admin handoffs; reduce headcount required to operate finance |
| P1 | API-first: every action addressable as a REST API endpoint for automation |
| P1 | MCP server layer: AI agents can interact with Estuary as a set of callable tools |
| P2 | Bank payment CSV export (bulk payment format) |
| P3 | Direct bank payment integration |
| P3 | Replace Kakitangan for HR expense claims |

---

## 3. Non-Goals (this version)

- Payroll processing (SQL HR module stays)
- Real-time GL sync with SQL Account (CSV import is sufficient)
- Accounts receivable / invoicing out to customers
- Multi-currency (single MYR per organization unless expanded)
- Mobile app (responsive web is sufficient)

---

## 4. User Personas

| Persona | Description | Auth |
|---------|-------------|------|
| **Submitter** | Internal staff submitting any payment type | Google OAuth (SSO) |
| **Manager** | First-level approver for Cash Advance and Travel Allowance | Google OAuth (SSO) |
| **Director** | Final approver for PV, Cash Advance, Travel Allowance | Google OAuth (SSO) |
| **Petty Cash Custodian** | Records petty cash disbursements; submits top-up requests | Google OAuth (SSO) |
| **Finance Admin** | Processes payments, exports, monitors overdue items | Google OAuth (SSO) |
| **Owner/Operator** | David — cross-entity view, system config, audit access | Google OAuth (SSO) |
| **External Recipient** | Teacher, contractor, vendor receiving a PV for signature | Tokenised email link — no login |
| **API / Agent Client** | Automation scripts, AI agents via MCP | API key (scoped) |

---

## 5a. Transaction Dimensions (SQL Account Alignment)

Every transaction in Estuary carries four dimensions that mirror SQL Account's coding system.
These flow into every accounting export line and into the transaction ledger.

| Dimension | SQL Account Field | Description | Default Behavior |
|-----------|------------------|-------------|-----------------|
| **GL Code** | Account / GL Code | What type of transaction (transport, supplies, salary, etc.) | Selected at submission from org's GL code list |
| **Agent** | Agent | Who submits / who the transaction is for | Auto-populated from submitter's agent code; overridable |
| **Area** | Department / Cost Center | Which office location | Auto-populated from submitter's area default; overridable |
| **Project** | Project | Which project this is tagged to | Selected at submission from org's project list; optional |

### Reference Tables (per organization)
- `gl_accounts`: code, name, description, is_active
- `agents`: code, name — each staff member has an agent code in their org membership profile
- `areas`: code, name — e.g. `KL`, `PENANG`
- `projects`: code, name, description, is_active

### User-Level Defaults
Each user's org membership record carries:
- `default_area_code` — their home office; pre-fills the Area field on all their submissions
- `agent_code` — their SQL Account agent code; auto-populates the Agent field

Both can be overridden at submission time for edge cases (e.g. KL staff submitting on behalf of Penang).

### Multi-Line Submission Model
Every submission has a **header** and one or more **line items**.

**Header** (submission-level) — all types:
- Total amount (sum of lines)
- Agent — always the submitter's agent code (from their org profile); overridable
- Area — always the submitter's home office (from their org profile); overridable
- Recipient, description, payment method, supporting documents

**Line items** — dimension rules vary by payment type:

| Payment Type | GL Code | Project | Max Lines |
|-------------|---------|---------|-----------|
| Payment Voucher | Per PV (1 line) | Per PV (1 line) | 1 |
| Invoice Payment | Per invoice (1 line) | Per invoice (1 line) | 1 |
| Cash Advance | Per line | Per line | N |
| Travel Allowance | Per line | Per line | N |
| Expense Claim | Per line | Per line | N |

Agent and Area are **always header-level** — they never vary per line within one document.
GL Code and Project are **always line-level** — even for single-line types.

**PV address note:** Area on the submission header is for accounting and export only.
It is never printed on the PV PDF. The PV PDF always shows the registered company address
from the Organization record — regardless of which office the submitter belongs to.

This matches SQL Account's document structure: one document number, multiple GL lines.
Each submission line appears as a separate row in the SQL Account CSV export.

### Export Note
The SQL Account CSV import expects all four dimensions as columns on every transaction line.
Each submission line generates one export row.
The exact column names and format are locked to a real sample import file (OQ-5).
Do not build the export module until that sample is in hand.

---

## 5. Payment Types, Approval Matrix, and Lifecycles

### Approval Matrix

| Payment Type | Approval Steps | Notes |
|-------------|---------------|-------|
| Invoice Payment | None | Staff submit; finance processes directly |
| Expense Claim | None | Staff submit; finance processes directly |
| Payment Voucher | Director (1 step) | External recipient receives signed PV request |
| Cash Advance | Manager → Director (2 steps, sequential) | Multi-checkpoint reconciliation after payment |
| Travel Allowance | Manager → Director (2 steps, sequential) | Can be same person |
| Petty Cash Disbursement | None | Custodian records; no approval |
| Petty Cash Top-up | Manager → Director (same as Cash Advance) | Top-up treated as Cash Advance to custodian |

Note: Manager and Director can be the same person, configured per organization.

### Common Lifecycle Spine

Workflow states are type-prefixed strings (e.g. `PV_DRAFT`, `CA_PENDING_MANAGER_APPROVAL`).
Every state change writes an immutable `SubmissionTransition` row — no state is ever mutated in place.

```
[All types]  DRAFT → submit → PENDING_[ROLE]_APPROVAL
             REJECTED → amend and resubmit → PENDING_[ROLE]_APPROVAL

[PV]         PENDING_DIRECTOR_APPROVAL → approve → APPROVED_PENDING_DOCUMENT
             → PENDING_RECIPIENT_SIGNATURE → sign → SIGNATURE_COMPLETE
             → PROCESSED → COMPLETE

[CA/Travel]  PENDING_MANAGER_APPROVAL → approve → PENDING_DIRECTOR_APPROVAL
             → approve → APPROVED_PENDING_PAYMENT → PROCESSED_PENDING_RECONCILIATION
             → reconciliation leg (see below)

[Invoice/Claim]  no approval; submit → PENDING_PAYMENT → PROCESSED → COMPLETE
```

Internal approvals require SSO-authenticated session.
External signature collection uses one-time token links (no login for recipients).
VOIDED is terminal; void reason required; record remains in history.
Full state tables per payment type are defined in `docs/Review by Codex/ESTUARY_REVIEW05_WORKFLOW_SPEC.md`
and enforced via `WorkflowTransitionRule` rows in the database.

---

### Cash Advance Reconciliation Leg

Cash Advance has the most complex lifecycle. After PAYMENT_PROCESSED:

```
PAYMENT_PROCESSED
  → RECON_PENDING

  [Checkpoint 1 — 2 weeks post-payment]
  → RECON_SUBMITTED
    → Outcome A (exact spend): submit docs → CLOSED
    → Outcome B (underspend): confirm balance returned → submit docs → CLOSED
    → Outcome C (overspend): submit new linked Cash Advance for overspent amount
                             → original stays in RECON_PENDING_CHILD_CLOSURE
                             → when child CA closes via Outcome A → original CLOSED

  [Checkpoint 2 — 3 weeks post-payment, if not yet closed]
  → Same outcomes as Checkpoint 1

  [Checkpoint 3 — 4 weeks post-payment, mandatory close]
  → Same outcomes — reconciliation is mandatory at this point
  → If still unreconciled after Checkpoint 3: RECON_OVERDUE → escalation (see OQ-CashAdvanceEscalation)
```

**Overspend parent-child link:**
The overspend Cash Advance carries a `parent_submission_id` reference to the original.
The original CA cannot reach CLOSED while a child overspend CA is open.
Child CA follows the same approval and reconciliation flow.

**Supporting documentation:**
All reconciliation outcomes require full supporting documentation uploaded at close-out.

**Automated reminders:**
The same reminder engine used for signed PV collection drives CA reconciliation nudges.
Reminders sent to submitter at week 2, week 3, and week 4. Finance Admin sees overdue
reconciliations in the unified overdue dashboard alongside overdue signed PVs.

---

### Petty Cash — Imprest Float Ledger Model

The physical cash box is modeled as an imprest float ledger in Estuary.

**Float account:**
- Each box has a custodian, a float ceiling (e.g. RM500), and a low-balance threshold
- The float balance is the source of truth; physical cash should match it at all times

**Disbursement (no approval):**
- Custodian records each disbursement: amount, recipient, purpose, CoA code, date
- Balance is decremented automatically
- No formal approval required — the custodian is the control point
- Receipts attached at disbursement time (not at reconciliation)

**Top-up request (approval required):**
- When balance falls below the threshold, custodian submits a top-up request
- Top-up flows through the Cash Advance approval chain (Manager → Director)
- On payment, balance is replenished
- No reconciliation leg for top-ups (they are replenishments, not advances)

**Monthly reconciliation:**
- Custodian submits a periodic reconciliation: physical cash count vs. system balance
- Any discrepancy is flagged to Finance Admin
- Reconciliation record stored with supporting documentation

**CoA integration:**
- Each disbursement carries a CoA code
- All disbursements flow into the accounting export like any other payment type

This collapses Petty Cash into the existing system:
- Disbursements = lightweight Petty Cash transaction type
- Top-ups = Cash Advance with no reconciliation leg (variant subtype)
- Monthly reconciliation = a structured submission type

---

## 6. Core Modules

### Module 1 — Submission Portal
- Internal staff web interface
- Submission forms per payment type
- CoA code picker at submission (validated list per org)
- Supporting document upload
- Submission status tracking per submitter

### Module 2 — Approval Workflow
- Per-payment-type approval chain (configured per org)
- Sequential multi-step approvals (Manager → Director)
- Internal approvers (Director, Manager) must use SSO-authenticated session
- Email notification deep-links to the approval page; the page requires login — email is notification only, not auth
- Rejection requires a reason; returns to DRAFT for amendment and resubmission
- Every approval or rejection writes an immutable transition record

### Module 3 — Payment Voucher Engine
- Auto-generate PV PDF on final approval
- Sequential PV numbering per org (no duplicate numbers; gaps on transaction rollback or void are expected and documented)
- PV template configurable per org
- Replaces Google Sheets Apps Script PV system entirely
- **Batch (mass) creation**: a batch is a first-class entity grouping N submissions
  - One batch → N PVs with sequential numbering
  - One approval action covers the entire batch
  - N signature request emails fired automatically on batch approval
  - Batch status view shows all PVs and their individual collection status
  - API endpoint: `POST /api/v1/batches` accepting an array of submission payloads
  - MCP tool: `create_payment_voucher_batch(name, recipients[])` for programmatic generation
  - Migration path from Google Sheets: export data → call batch API → done

### Module 4 — Signed Document Collection
- Auto-send email to recipient with tokenised upload link on payment confirmation
- No login for external recipients
- Automated reminder schedule per org
- Overdue dashboard (Finance Admin)
- Recipient uploads signed copy; system marks collected
- Email-only channel now; extensible to WhatsApp/Telegram via MCP later

### Module 5 — Cash Advance Reconciliation
- 3-checkpoint system (2w, 3w, 4w post-payment)
- Automated reminders to submitter at each checkpoint
- 3 reconciliation outcomes: exact close / underspend return / overspend child CA
- Parent-child CA linkage for overspend path
- Mandatory close-out with full supporting documentation
- Overdue escalation after Checkpoint 3 (behaviour pending OQ-CashAdvanceEscalation)
- Unified overdue dashboard with signed PVs

### Module 6 — Petty Cash Float Ledger
- Float account per custodian (configurable ceiling and low-balance threshold)
- Disbursement entry (custodian-only, no approval, CoA-coded, receipt attached)
- Running balance with automatic decrement
- Top-up request flow (triggers Cash Advance approval chain, no reconciliation leg)
- Monthly reconciliation submission (physical count vs. system balance)
- Discrepancy flagging to Finance Admin

### Module 7 — Accounting Export
- All transactions tagged with 4 SQL Account dimensions (see Section 5a)
- Ledger view filterable by any dimension combination
- CSV export in SQL Account import format (all 4 dimensions as columns)
- Filter by date range, payment type, GL code, agent, area, project, org
- Export idempotency: mark as exported, flag re-exports
- SQL Account CSV column names and order locked to a real sample file (OQ-5, pre-Phase 4 blocker)

### Module 8 — Bank Payment Export
- Phase 1: CSV in bulk payment format (Maybank2U Business or equivalent)
- Phase 2: Direct bank API integration
- Payment batch management

### Module 9 — Audit Trail
- Immutable event log: every state transition, actor, timestamp, delta
- Searchable by submitter, payment type, date range, CoA, PV number, org
- Document version history

### Module 10 — Configuration
- GL code list per org (maps to SQL Account chart of accounts)
- Agent code list per org (maps staff to their SQL Account agent codes)
- Area list per org (e.g. KL, Penang)
- Project list per org (active projects for tagging)
- User defaults: each user has a default area and an agent code per org
- User and role management per org
- Approval chain configuration per payment type per org
- Email template management
- PV template per org
- Petty cash float settings per custodian

---

## 7. Multi-Entity Architecture

- `Organization` is the top-level partition for all financial data
- Users exist globally; belong to one or more orgs with a role per org
- Single SSO via Google OAuth; organization switcher in UI (Xero model)
- Each org has independent: CoA tree, PV number sequence, approval chains,
  email templates, PV template, petty cash floats, accounting exports
- Owner/Operator has cross-organization visibility

---

## 8. Integration Points

| System | Integration Type | Direction | Notes |
|--------|-----------------|-----------|-------|
| SQL Account | CSV file export | Outbound | Format locked to real sample — OQ-5 |
| Google OAuth | Authentication | Inbound | Internal staff; SSO |
| AWS SES | Email | Outbound | Already configured and domain-verified |
| AWS S3 | File storage | Outbound | Docs, PV PDFs, reconciliation uploads |
| Bank | CSV / API | Outbound | Phase 1 CSV; Phase 2 direct API |
| Kakitangan | None initially | — | Replaced in Phase 3 |
| External automation clients | REST API `/api/v1/` | Inbound | API key, scoped |
| AI agents | MCP server | Inbound | Wraps REST API; same auth rules |

---

## 9. Tech Stack (Locked)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (TypeScript) |
| REST API | Next.js API routes, `/api/v1/`, versioned |
| MCP Server | `@modelcontextprotocol/sdk` (TypeScript), same monorepo |
| Database | PostgreSQL on AWS RDS (db.t4g.micro) |
| ORM | Prisma |
| Auth — web | NextAuth.js + Google OAuth (SSO, org switcher) |
| Auth — API/MCP | API keys (`X-API-Key`, scoped, revocable) |
| Email | AWS SES (domain already configured) |
| File Storage | AWS S3 |
| PDF Generation | React-PDF or Puppeteer (server-side) |
| Containerization | Docker (day one — Lightsail now, ECS when commercializing) |
| Deployment | AWS Lightsail (2GB) ~$10/month |

**Estimated AWS cost: ~$26–30/month**
(Lightsail $10 + RDS $13 + S3 ~$2–5 + SES ~$0 + Route 53 ~$0.50)

---

## 10. Phasing

API endpoints and MCP tool stubs are built alongside every phase — not a final phase.
See `PROJECT_ROADMAP.md` for the full detailed task breakdown per phase.

### Phase 0 — Validation and Infrastructure Setup
- Process mapping, approval matrix, exception policy — define before coding
- AWS infra (Lightsail, RDS, S3, SES, Docker), Next.js + Prisma scaffold, test harness

### Phase 1 — Foundation
- Google OAuth SSO, org membership approval, org switcher
- Reference data (GL accounts, agents, areas, projects)
- Workflow engine skeleton + job queue + worker process

### Phase 2 — Payment Voucher MVP (first production workflow)
- Full PV lifecycle: draft → director approval (SSO) → PDF generation → external signature → payment
- Background jobs: reminders, overdue detection, token expiry
- Security hardening: upload validation, masking, log redaction, signed URLs
- Known gap: field-level encryption for IC/bank data deferred to Phase 3

### Phase 3 — Hardening + Batch PV
- Field-level encryption, observability, operator diagnostics, DR test
- Batch (mass) PV creation — only after core PV lifecycle has survived real use

### Phase 4 — Cash Advance and Travel Allowance
- 2-step approval, CA 3-checkpoint reconciliation, overdue blocking, overspend child CA

### Phase 5 — Additional Workflows
- Invoice Payment, Expense Claims, Petty Cash (OQ-PettyCashConfirm required)
- Kakitangan deprecation for claims

### Phase 6 — Accounting Export
- SQL Account CSV export (OQ-5 sample required before build begins)
- Bank payment batch CSV export

### Phase 7 — Configuration UI + Reporting
- Approval chain config UI, email templates, PV templates, analytics, audit search

### Phase 8 — Future
- Direct bank API, WhatsApp/Telegram bot (via MCP), multi-currency
- Commercialization: migrate to ECS + RDS Multi-AZ

---

## 11. Open Questions

| # | Question | Blocking |
|---|----------|---------|
| ~~OQ-CashAdvanceEscalation~~ | **Resolved**: After Checkpoint 3, submitter is blocked from all new Cash Advance submissions until the open CA is reconciled. Finance Admin + Owner/Operator also alerted. | — |
| OQ-PettyCashConfirm | Petty Cash proposed as imprest float ledger (see Section 5). Does this model match what you want? Any adjustments? | Phase 3 design |
| OQ-5 | SQL Account CSV import sample | Phase 4 build |

---

## 12. What This Replaces

| Current System | Replaced By | Phase |
|---------------|-------------|-------|
| Google Sheets Apps Script PV system | Module 3 + 4 | Phase 1 |
| Google Forms (invoice, cash advance, travel) | Module 1 + 2 | Phase 2 |
| Petty cash spreadsheet | Module 6 | Phase 3 |
| Expense claims via Kakitangan | Module 1 | Phase 3 |
| Manual accounting entry | Module 7 | Phase 4 |

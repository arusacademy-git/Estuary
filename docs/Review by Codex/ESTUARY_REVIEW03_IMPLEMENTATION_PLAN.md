# Estuary Review 03 - Implementation Plan

**Purpose:** Translate the revised architecture into a buildable engineering plan  
**Date:** 2026-04-12  
**Source context:** `ESTUARY_REVIEW.md`, `ESTUARY_REVIEW01_CODEX.md`, `ESTUARY_REVIEW02_REVISED_ARCHITECTURE.md`

## Objective

Build Estuary as a workflow-controlled finance operations platform, starting with payment vouchers and expanding only after the workflow engine, evidence model, and background processing model are stable.

This document is not a product pitch. It is a delivery plan.

## Build Principles

- Start with the workflow engine, not the screen count.
- Build one defensible money-out path before adding more process types.
- Keep transport layers thin and domain logic centralized.
- Treat async side effects as first-class infrastructure.
- Make evidence and auditability part of the core model, not afterthoughts.
- Keep policy configurable where operational reality varies by org.

## Recommended System Shape

### Core application layers

The system should be separated into these layers:

1. `web`
- Next.js application for authenticated user flows
- admin UI
- submitter UI
- approver UI
- recipient signature UI

2. `api`
- REST endpoints under `/api/v1/`
- request validation
- auth and authorization checks
- thin request-to-domain orchestration

3. `domain`
- submission creation rules
- workflow transition rules
- approval policy rules
- document numbering rules
- reconciliation rules
- export rules

4. `worker`
- reminders
- email sending
- token expiry handling
- overdue detection
- PDF generation
- reconciliation checkpoint scheduling
- export generation

5. `data`
- Prisma models
- repositories / query layer
- transaction boundaries

6. `integration`
- Google OAuth / auth provider integration
- email provider integration
- object storage integration
- MCP adapter
- future accounting export adapter

The main rule is simple: business decisions belong in `domain`, not in API routes, React components, or worker handlers.

## Module Breakdown

### Module 1 - Identity and organization access

Responsibilities:

- Google SSO login
- membership creation on first login
- membership approval flow
- role assignment
- organization switcher
- access scoping by organization

Core records:

- `users`
- `organizations`
- `user_org_memberships`
- `user_org_roles`

Key rules:

- new memberships start as `PENDING`
- no org data visible until approved
- all queries scoped by active organization membership
- internal approvals require authenticated session

### Module 2 - Submission core

Responsibilities:

- create submission header
- attach lines
- attach evidence documents
- calculate totals
- validate payment-type-specific rules

Recommended records:

- `submissions`
- `submission_lines`
- `submission_evidence`
- per-type detail tables

Submission header should contain:

- org reference
- payment type
- submitter
- current state
- total amount
- currency
- top-level accounting dimensions where applicable

Per-type detail tables should contain:

- payment voucher recipient and payment fields
- cash advance reconciliation fields
- travel-specific detail
- invoice-specific detail
- claim-specific detail
- petty cash top-up detail

### Module 3 - Workflow engine

Responsibilities:

- define allowed states
- define allowed transitions
- enforce actor permissions
- enforce required reasons
- enforce required evidence
- persist every transition

Recommended records:

- `workflow_definitions`
- `workflow_transition_rules`
- `submission_transitions`
- `submission_assignments`

If storing workflow definitions in code first, that is acceptable for MVP, but transition history must still be stored in the database.

Each transition record should include:

- submission id
- from state
- to state
- actor id
- actor type
- action taken
- reason text if required
- request metadata
- created timestamp

### Module 4 - Approval system

Responsibilities:

- assign approvers
- expose pending approvals
- record approval or rejection
- enforce policy thresholds
- support same-person exception logic if allowed

Recommended split:

- internal approvals: SSO required
- external acknowledgements: token link allowed

Recommended records:

- `approval_policies`
- `approval_steps`
- `approval_decisions`

Avoid using raw email tokens as the only proof of internal financial authorization.

### Module 5 - Document and evidence management

Responsibilities:

- upload supporting documents
- generate PDFs
- store signed documents
- maintain evidence metadata
- enforce private access rules

Recommended records:

- `documents`
- `document_versions`
- `signature_events`

Each evidence item should track:

- document type
- storage key
- uploaded by
- source workflow event
- file hash if applicable
- created timestamp

For signatures, capture:

- document hash signed
- signer email
- consent text shown
- IP address
- user agent
- signed timestamp

### Module 6 - Background jobs and scheduling

Responsibilities:

- deliver all deferred side effects reliably
- retry failed work
- surface failed jobs to operators

Recommended records:

- `job_queue`
- `outbox_events`
- `job_attempts`

Minimum job types:

- send approval email
- send signature request email
- send reminder email
- expire token
- generate PDF
- evaluate overdue items
- create reconciliation checkpoint
- generate export file

Key requirements:

- idempotency key per job
- retry count and next run time
- dead-letter state
- operator-visible failure reason

### Module 7 - Overdue and reconciliation engine

Responsibilities:

- compute due dates
- detect overdue items
- block new cash advance submissions when policy requires
- schedule and enforce reconciliation checkpoints

Recommended records:

- `cash_advance_details`
- `reconciliation_checkpoints`
- `policy_blocks`

Do not bury this logic in controllers. It is domain logic with real business consequences.

### Module 8 - Accounting export module

Responsibilities:

- build export batches
- snapshot exported values
- generate files deterministically
- track export status and re-export reason

Recommended records:

- `export_batches`
- `export_batch_items`
- `export_files`

Do not implement this until real import samples exist.

### Module 9 - Audit and observability

Responsibilities:

- track critical user and system events
- expose operator diagnostics
- support investigation of failures

Recommended records:

- `audit_events`
- `system_events`
- `operator_notes`

Audit events should focus on business and control actions. System events should focus on operational failures and job execution.

## Suggested Data Model Direction

The schema should be normalized around a shared submission header plus typed detail tables.

### Suggested core tables

- `users`
- `organizations`
- `user_org_memberships`
- `user_org_roles`
- `agents`
- `areas`
- `projects`
- `gl_accounts`
- `submissions`
- `submission_lines`
- `submission_evidence`
- `submission_transitions`
- `submission_assignments`
- `approval_steps`
- `approval_decisions`
- `documents`
- `signature_events`
- `job_queue`
- `outbox_events`
- `audit_events`

### Suggested per-type tables

- `payment_voucher_details`
- `cash_advance_details`
- `travel_allowance_details`
- `invoice_payment_details`
- `expense_claim_details`
- `petty_cash_topup_details`

### Suggested integration tables

- `document_sequences`
- `export_batches`
- `export_batch_items`
- `api_clients`
- `api_keys`

## API Boundary Plan

Keep the REST API narrow and contract-first.

### MVP endpoint groups

1. Auth and session
- sign in
- sign out
- current session

2. Membership and org access
- list memberships
- approve membership
- switch organization context

3. Payment vouchers
- create draft
- update draft
- submit
- list
- get single
- approve
- reject

4. Signature collection
- open recipient link
- submit signature
- upload signed copy

5. Dashboard
- list pending approvals
- list overdue items

6. Documents
- upload
- list by submission
- retrieve secure access URL

7. Admin configuration
- approver assignment
- template config
- org reference data

Do not expose broad MCP tools until the REST behavior is stable and properly permissioned.

## UI Plan

The MVP UI should prioritize workflow clarity over visual breadth.

### MVP surfaces

1. Submitter portal
- create and edit draft PV
- submit PV
- see current status
- see requested corrections or rejection reason

2. Approver portal
- list pending approvals
- review submission details and evidence
- approve or reject with required notes where needed

3. Finance admin portal
- overdue dashboard
- signature collection status
- document generation status
- membership approval
- reference data configuration

4. External signature page
- token-bound access
- document preview or acknowledgement context
- signature capture or upload flow
- expiry and retry messaging

This is enough for MVP. Avoid broader dashboard ambition at first.

## Security and Control Plan

### Must-have controls for MVP

- SSO for all internal actors
- organization scoping on every read and write
- role-based authorization checks
- signed URLs for private files
- sensitive-value masking in UI
- structured audit for approvals, rejections, submissions, and document events
- reason capture for rejection and override actions

### Should-have controls early

- field-level encryption for highest-risk sensitive values
- log redaction for bank account and identity data
- upload validation and malware scanning
- rate limiting on token-driven public endpoints
- token expiry and one-time-use enforcement for external flows

## Testing Plan

### Level 1 - Domain tests

Test:

- valid and invalid transitions
- approval policy logic
- sequence generation behavior
- overdue and reconciliation logic
- export idempotency logic

### Level 2 - API tests

Test:

- auth behavior
- org scoping
- validation behavior
- error envelope consistency
- endpoint permissions

### Level 3 - Worker tests

Test:

- retry logic
- duplicate job suppression
- overdue job behavior
- reminder scheduling behavior
- PDF generation handoff

### Level 4 - End-to-end tests

Test the actual workflow:

- submit PV
- approve PV
- generate PDF
- send recipient signature request
- collect signature
- mark overdue if not completed

### Manual QA focus

- approval edge cases
- same-person role edge cases
- file upload failures
- expired tokens
- duplicate reminders
- organization-scoping mistakes

## Delivery Sequence

### Phase 0 - Discovery and control definition

Output:

- real process maps
- real document samples
- accounting file samples
- approval matrix
- exception matrix
- evidence requirements
- retention rules

Engineering work:

- repo setup
- local Docker environment
- base Next.js app
- Prisma setup
- linting and test harness

### Phase 1 - Foundation

Build:

- auth
- membership
- org context
- reference tables
- base submission schema
- workflow engine skeleton
- audit event framework
- document storage abstraction
- worker skeleton

Deliverable:

- authenticated multi-org shell with core domain plumbing

### Phase 2 - Payment Voucher MVP

Build:

- PV draft and submit flow
- approval flow
- PDF generation
- document sequencing
- recipient signature flow
- reminder jobs
- overdue dashboard

Deliverable:

- end-to-end payment voucher workflow in production shape

### Phase 3 - Hardening

Build:

- observability improvements
- operator diagnostics
- policy exception handling
- better evidence packaging
- stronger sensitive-data protections

Deliverable:

- MVP hardened enough for real operational use

### Phase 4 - Cash Advance and Travel

Build:

- multi-step approvals
- reconciliation checkpoints
- overdue blocking
- linked overspend handling

Deliverable:

- second workflow family built on same engine

### Phase 5 - Additional workflows

Build:

- invoice payments
- expense claims
- petty cash

Only after policy is clearly defined.

### Phase 6 - Accounting integration

Build:

- accounting export
- export tracking
- re-export controls
- bank batch export

Only after real sample files and finance acceptance criteria are available.

## Suggested Immediate Next Steps

1. Freeze the control model, not the full implementation stack.
2. Define the workflow states and transitions for payment vouchers in detail.
3. Redesign the schema around shared headers plus typed detail tables.
4. Define the worker and outbox approach before building reminders or expiry logic.
5. Replace internal approval token logic with authenticated approval sessions.
6. Collect real accounting import and current-form samples before any export work begins.

## Bottom Line

If Estuary is built as currently written, it will likely look impressive but carry hidden control and operational debt.

If it is built according to this plan, it has a real chance of becoming a durable internal finance platform:

- strict workflow behavior
- defensible evidence capture
- reliable background operations
- modular expansion path
- safer long-term commercialization option

That is the version worth funding.

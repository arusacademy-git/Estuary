# Estuary Review 02 - Revised Architecture Brief

**Purpose:** Replace critique with a cleaner contractor-grade recommendation  
**Date:** 2026-04-12  
**Source context:** `ESTUARY_REVIEW.md`

## What Is Wrong

The proposal solves the correct business problem, but the architecture is not yet strong enough for a finance operations system.

### 1. Workflow is modeled too loosely

The design relies on one base status plus three string status slots. That is flexible, but it is not strict enough for financial controls.

Main problem:

- invalid state combinations become possible
- reporting logic becomes harder to trust
- permissions become harder to enforce consistently
- exception handling becomes application-code dependent instead of system-enforced

This is acceptable for low-risk business software. It is weak for money-out workflows.

### 2. The data model favors convenience over correctness

Using one giant `Submission` table for all payment types makes early development faster, but it weakens integrity.

Main problem:

- too many nullable fields
- weak schema guarantees
- harder validation per payment type
- invalid record shapes become normal

The platform needs common reporting, but it should not get that by flattening unlike processes into one overly broad row shape.

### 3. Internal approval control is too weak

Internal manager and director approvals via emailed token links are not strong enough for financial authorization.

Main problem:

- forwarded email equals delegated approval
- mailbox compromise equals silent approval authority
- non-repudiation is weak
- high-value internal approvals are reduced to link possession

Token links are acceptable for external recipient acknowledgement. They should not be the primary control for internal financial approval.

### 4. The proposal describes async features without async infrastructure

The document includes reminders, token expiry, overdue detection, PDF generation, email dispatch, and reconciliation checkpoint logic. But it does not define a proper worker or queue model.

Main problem:

- fragile request-time side effects
- weak retry behavior
- poor idempotency
- hard-to-debug failures
- operational invisibility when jobs fail

A workflow-heavy finance app without background job architecture will degrade fast in production.

### 5. Auditability is overstated

An append-only audit table is useful, but it is not the same as a defensible audit system.

Main problem:

- no clear before/after capture for sensitive changes
- no clear evidence immutability strategy
- no strong separation between application write authority and audit write authority
- no explicit evidence packaging for approvals and signatures

The system needs evidence design, not just an event table.

### 6. Sensitive-data handling is under-specified

The proposal stores IC numbers, bank account details, signatures, and supporting documents but does not define the protection model.

Main problem:

- no masking rules
- no log-redaction rules
- no document retention policy
- no explicit encryption strategy for sensitive fields
- no upload scanning or attachment controls

This is a significant omission for finance software.

### 7. Control policy is too casual

The proposal allows same-person manager/director approval and marks some flows as requiring no approval. That may reflect current operations, but it should not be encoded casually.

Main problem:

- weak segregation of duties
- silent acceptance of risky practices
- no threshold-based control logic
- no exception workflow

The software should make weak controls visible and configurable, not normalize them.

### 8. The proposal locks decisions too early

The document says all stack decisions are locked, but several of the highest-risk implementation details are still unproven.

Main problem:

- implementation certainty before workflow validation
- architecture closure before operator feedback
- high chance of building the wrong thing with confidence

The right thing to lock early is the control model and delivery sequence, not every framework-level decision.

## What To Build Instead

Build Estuary as a workflow-controlled finance operations platform with strong state integrity, strong evidence capture, and reliable side-effect processing.

### 1. Use a stricter workflow model

Each payment type should have:

- explicit states
- allowed transitions
- authorized actors
- required evidence per transition
- required reason fields where relevant
- persisted transition history

The current record should show the latest state, but the source of truth should be the transition model.

### 2. Use common headers plus type-specific detail tables

Recommended structure:

- `submissions`
- `submission_lines`
- `payment_voucher_details`
- `cash_advance_details`
- `invoice_payment_details`
- `travel_allowance_details`
- `expense_claim_details`
- `petty_cash_topup_details`

This keeps unified reporting while restoring schema integrity.

### 3. Separate application transport from domain logic

Keep Next.js if desired, but move business rules into a domain layer used by:

- web UI
- REST API
- worker jobs
- MCP adapter

This avoids framework-driven logic sprawl and makes workflow behavior easier to test.

### 4. Add a real background processing model

Use a worker with a durable queue or outbox pattern for:

- email dispatch
- reminders
- token expiry
- overdue detection
- PDF generation
- reconciliation checkpoint creation
- exports

Every job should have retry rules, idempotency, failure visibility, and operator review.

### 5. Tighten approval and signature controls

Recommended rules:

- internal approvals require SSO-authenticated identity
- email links may deep-link but should not replace auth
- external recipient signature flows can use token links
- every signature event captures timestamp, document hash, consent text, and request metadata

This gives the platform a much stronger evidence trail.

### 6. Treat policy as configuration, not code assumption

Examples:

- same-person approver allowed only below threshold
- invoice without approval allowed only for specific cases
- overdue cash advance block can require finance override
- finance override actions always require reason capture

This lets the system reflect real operations without hardcoding weak practices into the core model.

### 7. Treat exports as controlled integration batches

Every export should produce a durable record containing:

- batch identifier
- source filter
- generated file reference
- exported snapshot values
- operator identity
- re-export reason if applicable
- downstream import status if known

Accounting exports should behave like controlled operational events, not disposable CSV downloads.

### 8. Design sensitive-data handling explicitly

Minimum standard:

- private object storage
- signed URLs for document access
- masked display for sensitive values
- redacted logs and audit payloads
- retention and deletion rules
- upload validation and scanning
- tighter admin access boundaries

## What MVP Should Include

The MVP should not try to replace every finance process. It should prove that Estuary can own one high-friction workflow properly.

### MVP scope

- Google SSO
- membership approval
- organization-aware role model
- payment voucher submission
- director approval with authenticated session
- document numbering with explicit void policy
- PDF generation
- external recipient signature collection
- reminder worker
- overdue dashboard
- audit transition history
- private document storage
- minimal admin configuration for approver assignment and template setup

### MVP should not include yet

- full MCP control surface
- petty cash
- expense claims
- accounting export before real sample files are validated
- broad reporting
- policy-heavy exception cases unless already defined
- unnecessary batch complexity unless it is operationally urgent

## Recommended Delivery Sequence

### Phase 0 - Validation

Before core implementation:

- collect real Google Forms / Sheets / current-process samples
- collect real accounting import samples
- define approval matrix
- define exception policy
- define signature evidence requirements
- define sensitive-data rules
- define retention and recovery rules

This is short and prevents expensive misbuilds.

### Phase 1 - Payment Voucher MVP

Build the payment voucher workflow with proper controls first.

Success criteria:

- submission to approval works reliably
- document generation is stable
- external signature collection is usable
- reminders actually run
- overdue records are visible
- audit trail is inspectable

### Phase 2 - Cash Advance and Travel

Only after the workflow engine and worker model are stable:

- sequential approvals
- reconciliation checkpoints
- overdue blocking
- linked overspend handling

### Phase 3 - Other workflows

Only after policy clarification:

- invoice payments
- expense claims
- petty cash

### Phase 4 - Accounting integration

Only after real import samples and acceptance criteria exist:

- accounting CSV export
- bank batch export
- re-export handling
- import-status visibility

## Bottom Line

The proposal has the right destination but the wrong level of architectural confidence.

What should be built is not "one app that replaces several tools." What should be built is a finance workflow system with:

- strict transitions
- durable evidence
- reliable background processing
- stronger approval controls
- clearer policy boundaries

That version of Estuary would be worth building. The current proposal is a strong draft, not a production-ready blueprint.

# Estuary Review 01 - Codex Critical Assessment

**Source reviewed:** `ESTUARY_REVIEW.md`  
**Reviewer stance:** Competing contractor, not validating assumptions by default  
**Date:** 2026-04-12

## Executive Verdict

The proposal identifies a real operational problem, but the current design is too confident in the wrong places and under-specified in the places that matter most for a finance system.

The strongest part of the document is the problem framing: fragmented tools, weak traceability, late GL coding, and manual follow-up are real costs. The weakest part is the assumption that a single Next.js application, a few status fields, token links, and an audit table are enough to turn that mess into a defensible finance platform.

This proposal is not yet at "build" quality. It is at "promising architecture draft with material control gaps."

## What The Proposal Gets Right

- It targets the real root problem: fragmented workflow ownership across Forms, Sheets, email, spreadsheets, and HR software.
- It correctly prioritizes payment vouchers first instead of trying to ship all finance operations at once.
- It chooses a relational database, which is the right default for approvals, auditability, and accounting exports.
- It recognizes that document generation, reminders, approvals, and reconciliation are workflow problems, not just CRUD screens.
- It treats multi-entity support as a first-class concern instead of bolting it on later.

## Critical Findings

### 1. The proposal confuses an application log with an audit system

The document repeatedly implies that "auditing is reading an event log" and that an append-only `AuditEvent` table is enough. It is not.

An audit system for finance needs:

- who performed the action
- under what authority
- what changed before and after
- whether the record can be tampered with later
- whether evidence files are immutable and versioned
- whether restored backups preserve evidentiary integrity

An `AuditEvent` table inside the same application database is useful, but it is not by itself a trustworthy control. If the app can write production data, it can usually also write the audit rows unless permissions are explicitly segmented.

**Recommendation:** keep the audit table, but treat it as one layer only. Add immutable evidence rules, restricted write paths, before/after snapshots for critical transitions, and periodic export or hash-chaining for high-value events.

### 2. The status model is too weak for a finance workflow

The proposal uses one enum plus three free-form string slots: `workflow_status`, `document_status`, `finance_status`. That is flexible, but in a finance system flexibility without hard constraints is a liability.

This design allows invalid combinations unless every code path is perfect. Example problems:

- `base_status = PROCESSED` while signature or reconciliation state is logically incomplete
- undocumented string values introduced by application bugs
- inconsistent reporting queries across workflows
- unclear authority over who may move which status field

For a marketing site, this is fine. For money-out controls, it is too loose.

**Recommendation:** use a formal workflow model with:

- typed transition definitions per payment type
- actor permissions per transition
- validation of allowed source-state to target-state moves
- explicit transition records persisted separately from the submission row

The UI can still show simplified labels, but the system-of-record state machine must be stricter than three nullable strings.

### 3. One giant `Submission` table is convenient, but financially sloppy

A single table for all payment types will make early CRUD faster, but it also creates a long tail of nullable fields, weak invariants, and invalid record shapes.

This is the core flaw: the design optimizes for developer convenience before it optimizes for domain correctness.

Payment vouchers, cash advances, invoice payments, and petty cash top-ups are related, but not identical. Their constraints differ enough that subtype-specific tables are justified.

**Recommendation:** keep a common `submissions` header if desired, but split type-specific detail tables:

- `payment_voucher_details`
- `cash_advance_details`
- `invoice_payment_details`
- `travel_allowance_details`
- `expense_claim_details`
- `petty_cash_topup_details`

That preserves unified reporting while restoring schema-level integrity.

### 4. The operational architecture is missing the actual workflow engine

The document includes reminders, overdue checks, token expiry, PDF generation, email delivery, and chained reconciliation logic. But it does not define the job infrastructure that makes those features reliable.

This is a major omission.

Without a real background job model, this system will become a collection of brittle request-time side effects.

You need at minimum:

- a durable job queue
- an outbox table for email and notification side effects
- retry semantics
- idempotency keys
- a scheduler for timed events
- dead-letter handling and operator visibility

**Recommendation:** define a worker service from day one. Even a simple Postgres-backed queue is better than pretending cron plus API routes is enough.

### 5. Internal approvals via no-login token links are a control loophole

The proposal treats emailed approval tokens as acceptable for director and manager approvals. For external recipients signing receipt, token links are understandable. For internal financial approvers, this is a control weakness.

Problems:

- forwarded email becomes delegated approval
- mailbox compromise becomes silent approval authority
- there is weak non-repudiation for internal decision makers
- high-value approvals are being reduced to possession of an email link

**Recommendation:** internal approvers should authenticate with SSO. Email links may deep-link them into the action, but should not replace identity verification. Reserve no-login tokens for external recipients and low-risk acknowledgement flows.

### 6. The legal conclusion on digital signatures is too casual

Saying the flow is "legally valid under Malaysia's Electronic Commerce Act 2006" is too broad and too confident.

Legal admissibility is not just "capture a signature on a canvas." It depends on evidence quality:

- signer identity binding
- consent capture
- timestamping
- IP / user-agent / request metadata
- document hash before and after signature
- tamper evidence
- clear retention of the signed artifact and audit package

**Recommendation:** do not market this as legally safe until legal counsel or a compliance owner signs off on the evidentiary model. Build the evidence package properly anyway.

### 7. The proposal underestimates sensitive-data risk

IC/passport numbers, bank account details, signature assets, and supporting documents are being stored, but the document does not define:

- field-level encryption strategy
- masking rules in UI
- redaction rules in logs
- document retention rules
- malware scanning on uploaded files
- access review for finance administrators

For a finance system, this omission is not minor.

**Recommendation:** encrypt sensitive fields at the application layer where justified, keep S3 private, use signed URLs, redact audit payloads, and define retention and deletion policy early.

### 8. "All decisions are locked" is not a serious engineering posture

The stack section says all decisions are locked, then immediately leaves PDF generation undecided. That is the smaller contradiction.

The larger issue is cultural: locking architecture before prototype validation, real file samples, operator testing, and control review is how teams create expensive certainty theater.

**Recommendation:** lock principles, not every implementation detail. The right posture is:

- domain constraints locked
- control requirements locked
- delivery sequence locked enough to execute
- implementation choices provisional until proven

### 9. The document treats segregation of duties too lightly

The proposal explicitly allows Manager and Director to be the same person. It also sets invoice payment and expense claims to "no approval."

That may match current reality, but it is also a loophole unless bounded by policy.

**Recommendation:** model approval policy as configuration with exception logging. Add threshold-based controls, for example:

- low-value same-person approval allowed with audit flag
- high-value same-person approval disallowed
- invoice payments without approval allowed only for approved vendors or below threshold

Do not encode weak control practice as a silent default.

### 10. The sequence-number claim is incorrect

The document claims `SELECT FOR UPDATE` prevents gaps in document numbering. It does not guarantee that in the broader business sense.

If a number is reserved and the transaction later fails, or downstream PDF/email generation fails after issuance, gaps can still occur unless the business process accepts voided numbers explicitly.

**Recommendation:** define numbering policy honestly:

- either gaps are acceptable with `VOIDED` records
- or numbers are issued only at a later legally meaningful checkpoint

Do not promise impossible "no gaps" behavior casually.

## Major Missing Pieces

These are not optional polish items. They materially affect whether the build succeeds.

- No migration plan from Google Sheets / Forms / existing records
- No authorization matrix beyond role names
- No testing strategy for workflows, retries, and financial edge cases
- No restore-drill or disaster-recovery process beyond paying for RDS PITR
- No observability plan: alerts, structured logs, failed-job dashboard, operator diagnostics
- No attachment lifecycle design: upload validation, versioning, antivirus scan, max size, duplicate detection
- No accounting reconciliation model between Estuary export state and SQL Account import state
- No explicit idempotency design for exports, approvals, payments, or reminders

## Revised Problem Statement

The real problem is not merely "too many tools."

The real problem is this:

Arus currently has weak workflow ownership, weak state integrity, weak audit evidence, and weak control enforcement across the money-out lifecycle. Replacing many tools with one tool is only useful if the replacement becomes stricter than the current process, not merely more convenient.

That distinction matters. A centralized bad workflow is still a bad workflow.

## Proposed Solution

Build Estuary as a workflow-controlled finance operations platform, not just a full-stack web app.

### Core design principles

- The system of record is the workflow and evidence model, not the UI.
- Financial state transitions must be explicit, validated, and attributable.
- All asynchronous side effects must be durable and retryable.
- Sensitive data must be handled as regulated data even if the company is small.
- Convenience cannot outrank control for approvals and payment evidence.

### Recommended architecture

#### 1. Split transport from domain logic

Keep Next.js for the web app if desired, but do not let API routes become the business layer. Build a domain service layer that both the UI and API use.

Result:

- better testability
- cleaner MCP integration
- less framework lock-in
- easier future extraction if the product commercializes

#### 2. Use header + subtype data modeling

Use:

- `submissions`
- `submission_lines`
- per-type detail tables
- `submission_transitions`
- `submission_assignments`
- `submission_evidence`

This preserves common reporting without sacrificing integrity.

#### 3. Build a real workflow engine

Persist transitions, actor, reason, evidence requirements, and policy checks. Do not rely on free-form status fields as the primary control surface.

#### 4. Add a background worker and outbox pattern

Worker responsibilities:

- reminder scheduling
- token expiry handling
- email sending
- PDF generation
- overdue detection
- reconciliation checkpoint creation
- export file generation

#### 5. Tighten approval and signature security

- Internal approvals: SSO required
- External recipient signing: tokenized links allowed
- Every signature event stores consent text, timestamp, document hash, and request metadata
- Sensitive documents remain private and are delivered by signed URL only

#### 6. Add policy-based controls

Examples:

- same-person approver exception policy
- amount thresholds
- mandatory attachment rules by type and amount
- overdue CA submission block with override path
- finance override actions always require reason

#### 7. Treat accounting export as a controlled integration

Each export needs:

- deterministic file composition
- idempotent export batches
- import-status tracking
- operator-visible re-export reason
- snapshot of exported values at export time

## Recommended Delivery Plan

### Phase 0 - Validation and controls baseline

Before coding the full app:

- capture real sample forms, PDFs, accounting import files, and exception cases
- define approval matrix and exception policy
- define evidence rules for signatures and reconciliations
- define audit payload requirements
- define recovery and retention policy

This is short work, but it prevents building fiction.

### Phase 1 - Payment Voucher MVP with proper controls

Ship:

- SSO
- org membership approval
- PV submission
- director approval with authenticated session
- PDF generation
- external recipient signature flow
- reminder worker
- overdue dashboard
- audit transitions

Do not ship MCP as a broad control surface in this phase unless there is a real consumer ready to use it.

### Phase 2 - Cash Advance and Travel

Only after the worker, transition model, and evidence model are stable:

- manager then director approvals
- reconciliation checkpoints
- overdue blocking
- linked overspend child flow

### Phase 3 - Invoice, claims, petty cash

This phase needs policy review before implementation because "no approval" and petty cash custodian self-recording are both control-sensitive.

### Phase 4 - Accounting integrations

Do this only when real import samples and operator acceptance criteria exist.

## Bottom Line

The proposal is directionally right but not yet defensible enough for a finance system that wants to reduce headcount, centralize trust, and potentially commercialize later.

My recommendation is not to discard Estuary. My recommendation is to harden it before scaffolding:

- stricter workflow model
- subtype-specific data integrity
- real job infrastructure
- stronger approval controls
- explicit sensitive-data handling
- policy-driven exceptions
- less premature certainty

If this were a contract review, I would not reject the project. I would reject the claim that the current design is ready to build without a tighter control architecture.

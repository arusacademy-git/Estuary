# Estuary Review V2 - Codex Assessment

**Reviewed files:**
- `docs/SCHEMA.md`
- `PROJECT_ROADMAP.md`

**Date:** 2026-04-12

## Executive Verdict

Version 2 is materially better than the original proposal.

The biggest improvements are real:

- the giant submission row has been split into per-type detail tables
- internal approval tokens are gone
- workflow transitions are now first-class records
- async infrastructure is finally present
- evidence handling is more serious

That said, the revision still overclaims what the schema guarantees. The remaining issues are no longer broad architectural naivete; they are specific integrity gaps. That is progress. But those gaps still matter, because several of the new v2.0 claims are stronger than what the database and roadmap actually enforce.

## Findings

### 1. The schema does not actually enforce "one correct detail row per payment type"

Severity: High

Relevant sections:

- `SCHEMA.md:431-461`
- `SCHEMA.md:608-740`
- `SCHEMA.md:1140`

The document claims that invalid record shapes are now impossible at the DB level after splitting `Submission` into per-type detail tables. That is not true yet.

What the schema currently allows:

- a `Submission` with `payment_type = PAYMENT_VOUCHER` and no `PaymentVoucherDetail`
- a `Submission` with `payment_type = PAYMENT_VOUCHER` and both `PaymentVoucherDetail` and `CashAdvanceDetail`
- a `Submission` whose detail row does not match `payment_type`

Why this matters:

- the entire point of the split-table refactor was stronger type integrity
- the current design still depends on application discipline to keep payment type and detail rows aligned
- the doc explicitly claims stronger DB guarantees than the schema actually provides

What to change:

- either add database-level enforcement outside Prisma SDL using check constraints and triggers
- or stop claiming DB-level impossibility and describe this honestly as app-enforced integrity

If this is not fixed, the strongest claimed benefit of v2.0 is partially illusory.

### 2. Workflow versioning is incomplete because submissions are not tied to a workflow definition version

Severity: High

Relevant sections:

- `SCHEMA.md:342-400`
- `SCHEMA.md:418-479`
- `SCHEMA.md:1203`

`WorkflowDefinition` is versioned, but `Submission` does not store `workflow_definition_id` or equivalent. That creates a serious lifecycle problem.

Why this matters:

- once workflow rules evolve, an existing submission no longer has a durable pointer to the workflow version it was created under
- transition validation for in-flight submissions becomes ambiguous
- historical interpretation of state becomes dependent on mutable application code and "currently active" workflow rows

The comment says workflow definitions are versioned and seeded, but the business record is not pinned to that version.

What to change:

- add `workflow_definition_id` to `Submission`
- ideally also copy or derive it into `SubmissionTransition`
- validate transitions against the bound definition, not just by payment type and current code

Related issue:

- `SCHEMA.md:337` says "one active at a time" for workflow definitions, but the schema does not enforce that invariant

### 3. The numbering design still makes an incorrect "no gaps" promise

Severity: Medium

Relevant sections:

- `SCHEMA.md:284`
- `SCHEMA.md:78`
- `PROJECT_ROADMAP.md:104`

The design still says `SELECT FOR UPDATE` gives "no gaps under concurrency." It does not.

Even with row locking, gaps still happen if:

- a number is allocated and the surrounding transaction rolls back
- downstream document generation fails after allocation
- business rules require voiding after issuance

Why this matters:

- this is not just a wording nit
- finance teams will treat numbering guarantees as policy guarantees
- incorrect promises here create future reconciliation and audit friction

What to change:

- explicitly allow gaps with void records
- or defer number assignment to a later issuance point
- remove "no gaps" from both schema comments and roadmap language

### 4. Sensitive-data hardening is still scheduled too late

Severity: Medium

Relevant sections:

- `SCHEMA.md:608-627`
- `PROJECT_ROADMAP.md:86-157`
- `PROJECT_ROADMAP.md:159-171`

Phase 2 is clearly intended to be production-shape Payment Voucher MVP, and Phase 2 already includes:

- recipient IC
- bank account data
- signature evidence
- private document storage
- external token flows

But field-level encryption, stronger evidence packaging, upload validation, and disaster recovery testing are deferred to Phase 3.

Why this matters:

- the first real release would already be processing the highest-risk data
- Phase 3 is described as hardening after MVP, which means MVP is expected to exist before some critical controls do
- for this domain, some hardening belongs in MVP, not after MVP

What to change:

Move these into Phase 2 minimum scope:

- upload validation and file-size/type controls
- log redaction
- token endpoint rate limiting
- short-lived signed URL discipline
- clear field masking

Field-level encryption can remain phased if necessary, but the roadmap should state the risk explicitly if it is deferred.

### 5. Some referential-integrity decisions are too loose for business-critical records

Severity: Medium

Relevant sections:

- `SCHEMA.md:313-326`
- `SCHEMA.md:954-966`
- `SCHEMA.md:1065-1073`
- `SCHEMA.md:161`

There are still several places where important business records are stored as plain string IDs or raw storage references even though the design is otherwise trying to become more relational and auditable.

Examples:

- `Batch.created_by_id` is a plain string with no FK
- `NotificationDelivery.submission_id` is a plain string
- `ExportFile.document_id` is described as an FK in comments but is not modeled as one
- approver `signature_url` remains a string on membership instead of using the `Document` model

Not all of these need hard foreign keys, but the current mix is inconsistent.

Why this matters:

- it makes data repair and audit harder
- it weakens confidence in joins for important operational records
- it blurs the line between intentionally decoupled audit data and ordinary business data that should stay relational

What to change:

- keep plain IDs only where long-term decoupling is a deliberate control choice
- for ordinary business records, use actual relations
- especially fix `ExportFile.document_id`, because the comment already assumes it is relational

### 6. The job dedupe design is underspecified and may block legitimate repeated work

Severity: Medium

Relevant sections:

- `SCHEMA.md:902-916`
- `SCHEMA.md:908`

`JobQueue.dedupe_key` is globally unique, and the comment suggests a format like `{job_type}:{aggregate_id}`.

That is too simplistic for several real jobs in this system.

Example problem:

- recurring reminder jobs for the same submission would collide if they reuse the same logical aggregate key
- future reruns or retries of exports could also collide unless the dedupe key encodes run identity carefully

Why this matters:

- the queue exists to support repeated scheduled behavior
- a global uniqueness rule can become an accidental permanent block on legitimate later jobs

What to change:

- define dedupe key strategy per job type
- document which jobs are truly one-per-aggregate and which are one-per-aggregate-per-schedule window
- consider uniqueness on a more specific key shape rather than a broad single-column assumption

## Roadmap Comments

The roadmap is much better than the first version. It is cleaner, more disciplined, and closer to an actual delivery sequence.

What is good:

- Phase 0 is now real and correctly positioned
- Phase 1 and 2 are much more coherent
- hardening is explicitly acknowledged
- CA and Travel are no longer being pulled into MVP

What still needs tightening:

- MCP is still entering the plan earlier than necessary
- Phase 2 still reads like "production" while some control work is deferred to Phase 3
- batch PV creation probably belongs after the core PV lifecycle has survived actual use, not as a same-era enhancement

## What Improved Since The Last Review

This revision fixed several of the most important earlier issues:

- detail-table split is correct directionally
- internal approval auth is stronger
- workflow transitions are much more defensible
- async reliability is now part of the architecture
- external token handling is much cleaner

This is no longer a weak proposal. It is a decent proposal with identifiable schema-control gaps.

## Recommended Next Changes

1. Fix the payment-type/detail-table integrity story.
2. Bind each submission to a workflow definition version.
3. Remove the false "no gaps" claim from numbering.
4. Pull minimum sensitive-data hardening into Phase 2, not Phase 3.
5. Tighten the remaining plain-string references where relational integrity should exist.
6. Define job dedupe rules per job type before worker implementation begins.

## Bottom Line

V2 is clearly stronger than V1. The design is moving in the right direction.

The remaining issue is not that the architecture is naive. The remaining issue is that the schema and roadmap still promise a little more rigor than they actually enforce.

That is fixable. But it should be fixed before implementation starts, because these are exactly the kinds of integrity gaps that become expensive once code and real data exist.

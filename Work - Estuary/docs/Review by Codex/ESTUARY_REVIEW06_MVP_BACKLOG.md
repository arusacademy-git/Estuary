# Estuary Review 06 - MVP Backlog

**Purpose:** Define a practical backlog for delivery of the revised Payment Voucher MVP  
**Date:** 2026-04-12  
**Source context:** `ESTUARY_REVIEW03_IMPLEMENTATION_PLAN.md`, `ESTUARY_REVIEW04_SCHEMA_PROPOSAL.md`, `ESTUARY_REVIEW05_WORKFLOW_SPEC.md`

## Backlog Rules

- The MVP is Payment Voucher only.
- Every ticket should map to one real workflow outcome.
- Infrastructure that makes workflow reliable is in scope.
- Nice-to-have admin polish, reporting breadth, and later modules are out of scope.

## Release Goal

Ship a production-credible Payment Voucher workflow with:

- authenticated internal usage
- director approval
- document generation
- external recipient signature collection
- reminders
- overdue visibility
- auditability

## Epic 1 - Project Foundation

### Ticket 1.1 - Initialize app and repo standards

Deliver:

- Next.js app scaffold
- TypeScript config
- linting
- test harness
- environment variable structure
- local Docker setup

Done when:

- app boots locally
- tests run
- env setup documented

### Ticket 1.2 - Configure database and migrations

Deliver:

- Prisma setup
- initial migration pipeline
- local database container

Done when:

- local migration runs cleanly
- schema can be reset and recreated deterministically

### Ticket 1.3 - Establish app layer boundaries

Deliver:

- route layer conventions
- domain service structure
- repository pattern or equivalent query layer
- worker entrypoint structure

Done when:

- one sample vertical slice uses the intended layering

## Epic 2 - Identity and Organization Access

### Ticket 2.1 - Google SSO login

Deliver:

- sign in
- sign out
- authenticated session

Done when:

- internal user can sign in with Google account

### Ticket 2.2 - Membership provisioning

Deliver:

- create pending membership on first login
- org-aware session context

Done when:

- new user lands as `PENDING`
- user cannot see org data before approval

### Ticket 2.3 - Membership approval admin flow

Deliver:

- finance admin or owner approves membership
- role assignment UI

Done when:

- approved user gains scoped org access

## Epic 3 - Reference Data and Configuration

### Ticket 3.1 - Organization reference data tables

Deliver:

- agents
- areas
- projects
- GL accounts

Done when:

- admin can create and list reference records

### Ticket 3.2 - Approver assignment configuration

Deliver:

- assign director approver per org or policy rule

Done when:

- new PV can resolve valid approver

### Ticket 3.3 - PV template configuration

Deliver:

- registered company header data
- printable layout config if needed

Done when:

- generated PV can use configured org values

## Epic 4 - Submission Core

### Ticket 4.1 - Core submission schema

Deliver:

- `submissions`
- `submission_lines`
- `payment_voucher_details`

Done when:

- migration exists
- create, read, update operations work through domain layer

### Ticket 4.2 - Draft save behavior

Deliver:

- create draft PV
- update draft PV
- calculate totals

Done when:

- submitter can create and reopen own draft

### Ticket 4.3 - Submission validation

Deliver:

- request validation
- domain validation
- required-field checks before submit

Done when:

- invalid PV cannot be submitted

## Epic 5 - Workflow Engine

### Ticket 5.1 - Workflow state and transition model

Deliver:

- seeded PV states
- seeded PV transition rules
- domain service for transition execution

Done when:

- only valid PV transitions can occur

### Ticket 5.2 - Transition history persistence

Deliver:

- `submission_transitions`
- actor and reason capture

Done when:

- every workflow action creates immutable transition history

### Ticket 5.3 - Audit event emission

Deliver:

- audit events for submit, approve, reject, generate document, signature events, process, complete

Done when:

- audit trail can be inspected for one full PV lifecycle

## Epic 6 - Approval Flow

### Ticket 6.1 - Pending approval queue

Deliver:

- approver inbox query
- pending count

Done when:

- director sees assigned PV approvals

### Ticket 6.2 - Authenticated approval action

Deliver:

- approve PV in authenticated session
- enforce role and org scope

Done when:

- director can approve only authorized PVs

### Ticket 6.3 - Rejection action with reason

Deliver:

- reject PV
- require reason
- return item to amendable state

Done when:

- submitter sees rejection reason and can resubmit

## Epic 7 - Document and Storage

### Ticket 7.1 - Private document storage abstraction

Deliver:

- S3 integration
- private storage path rules
- signed URL retrieval

Done when:

- uploaded and generated files are not public

### Ticket 7.2 - Supporting document upload

Deliver:

- upload endpoint
- document metadata persistence
- file type and size validation

Done when:

- submitter can attach supporting docs to draft or submitted PV where policy allows

### Ticket 7.3 - PV PDF generation

Deliver:

- issued voucher PDF generation
- document storage
- document metadata creation

Done when:

- approved PV generates stable printable document

### Ticket 7.4 - Document numbering

Deliver:

- sequence allocation service
- numbering policy handling
- void policy support

Done when:

- generated PV receives correct number under concurrent usage assumptions

## Epic 8 - External Signature Collection

### Ticket 8.1 - External token issuance

Deliver:

- token generation
- token hashing at rest
- expiry handling

Done when:

- approved PV can issue one-time signature access

### Ticket 8.2 - Signature page

Deliver:

- external signature UI
- consent text display
- token validation

Done when:

- external recipient can access valid request safely

### Ticket 8.3 - Digital signature capture flow

Deliver:

- capture signature
- create signed artifact
- persist signature evidence

Done when:

- digital signing reaches complete signature state

### Ticket 8.4 - Signed copy upload flow

Deliver:

- upload signed copy
- store uploaded document
- route to manual verification state

Done when:

- upload fallback flow works

### Ticket 8.5 - Signature verification action

Deliver:

- finance admin can verify or reject uploaded signed copy

Done when:

- verification transitions behave according to workflow rules

## Epic 9 - Worker and Notification Infrastructure

### Ticket 9.1 - Worker process and job queue

Deliver:

- worker runner
- `job_queue`
- job locking and retry behavior

Done when:

- one queued job type executes reliably

### Ticket 9.2 - Outbox and notification plumbing

Deliver:

- `outbox_events`
- SES integration
- delivery logging

Done when:

- one notification path can be triggered through outbox pattern

### Ticket 9.3 - Signature request email

Deliver:

- signature request email template
- job to send it

Done when:

- approved PV sends valid recipient email

### Ticket 9.4 - Reminder scheduling

Deliver:

- reminder job generation
- reminder cadence configuration

Done when:

- stale signature requests create reminder jobs

### Ticket 9.5 - Overdue evaluation job

Deliver:

- periodic overdue scan
- dashboard-ready overdue records

Done when:

- overdue PV items appear without manual marking

## Epic 10 - Finance Admin Operations

### Ticket 10.1 - Overdue dashboard

Deliver:

- list PVs pending recipient action beyond SLA
- list signature uploads pending verification beyond SLA

Done when:

- finance admin can identify stuck PVs quickly

### Ticket 10.2 - Processing action

Deliver:

- mark PV as processed
- capture paid date
- capture payment reference
- attach payment proof if policy requires

Done when:

- finance can close payment stage correctly

### Ticket 10.3 - Completion action

Deliver:

- mark PV complete when closure conditions are met

Done when:

- completed PV exits active queues

## Epic 11 - Security and Controls

### Ticket 11.1 - Authorization enforcement

Deliver:

- org scoping guardrails
- role-based checks for all relevant endpoints

Done when:

- unauthorized actor cannot read or mutate foreign org records

### Ticket 11.2 - Sensitive-value protection

Deliver:

- masking in UI
- log redaction rules
- private file access rules

Done when:

- bank and identity fields are not casually exposed

### Ticket 11.3 - Public endpoint rate limiting and token safety

Deliver:

- rate limiting for external token endpoints
- one-time token use
- expiry and revoke behavior

Done when:

- token abuse surface is materially reduced

## Epic 12 - QA and Production Readiness

### Ticket 12.1 - Domain test suite

Deliver:

- transition tests
- validation tests
- numbering tests

Done when:

- core workflow logic is covered by automated tests

### Ticket 12.2 - API and auth tests

Deliver:

- session tests
- permission tests
- endpoint contract tests

Done when:

- critical API paths are covered

### Ticket 12.3 - End-to-end PV flow test

Deliver:

- submit
- approve
- generate
- sign
- process
- complete

Done when:

- one full PV path passes in realistic test environment

### Ticket 12.4 - Operator diagnostics and failure visibility

Deliver:

- failed jobs visibility
- notification failure logging
- basic operational admin view

Done when:

- common production failures can be diagnosed without database spelunking

## Suggested Build Order

1. Foundation
- tickets 1.1 to 1.3

2. Identity and org access
- tickets 2.1 to 2.3

3. Core data and workflow skeleton
- tickets 3.1, 4.1, 5.1, 5.2

4. Draft and submit flow
- tickets 3.2, 4.2, 4.3, 6.1

5. Approval flow
- tickets 6.2, 6.3, 5.3

6. Document generation and storage
- tickets 7.1 to 7.4

7. Worker and email plumbing
- tickets 9.1 to 9.3

8. External signature flow
- tickets 8.1 to 8.5

9. Finance admin closure and overdue ops
- tickets 9.4, 9.5, 10.1 to 10.3

10. Security hardening and test completion
- tickets 11.1 to 11.3, 12.1 to 12.4

## Explicit Out Of Scope For MVP

- cash advance workflow
- travel allowance workflow
- invoice workflow
- expense claims
- petty cash
- accounting export
- broad MCP tool surface
- advanced reporting
- multi-step configurable approval builder UI

## Acceptance Definition For MVP

The MVP is done when all of the following are true:

- internal users can sign in and be organization-scoped
- submitter can create and submit a Payment Voucher
- director can approve or reject in authenticated session
- approved voucher generates an issued PDF
- recipient can sign digitally or upload signed copy
- finance admin can verify signature where needed
- finance admin can mark processed and complete
- reminders and overdue detection run in background jobs
- audit trail exists for the full workflow
- sensitive files are private and access-controlled

If those are not all true, the MVP is not done, even if the UI appears polished.

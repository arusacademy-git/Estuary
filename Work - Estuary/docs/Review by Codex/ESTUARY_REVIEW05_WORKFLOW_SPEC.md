# Estuary Review 05 - Workflow Specification

**Purpose:** Define concrete workflow behavior for Payment Voucher and Cash Advance flows  
**Date:** 2026-04-12  
**Source context:** `ESTUARY_REVIEW02_REVISED_ARCHITECTURE.md`, `ESTUARY_REVIEW03_IMPLEMENTATION_PLAN.md`, `ESTUARY_REVIEW04_SCHEMA_PROPOSAL.md`

## Scope

This specification covers:

- Payment Voucher workflow
- Cash Advance workflow
- actors
- states
- actions
- transition rules
- evidence requirements
- overdue behavior

The main design rule is:

- state changes happen through explicit transitions
- every transition has an actor, action, timestamp, and rule context
- UI labels can be simplified, but workflow control cannot be

## Actor Model

### Internal actors

- `SUBMITTER`
- `MANAGER`
- `DIRECTOR`
- `FINANCE_ADMIN`
- `OWNER`
- `SYSTEM`

### External actors

- `EXTERNAL_RECIPIENT`

## Global Workflow Rules

1. A workflow begins in `DRAFT`.
2. Only the submitter can edit a draft unless finance creates an administrative amendment path.
3. Submission to review freezes fields except through explicit amendment or rejection handling.
4. Rejection does not silently mutate history. It creates a transition and returns the item to an editable state.
5. Every approval or rejection requires an authenticated internal actor.
6. External token flows are allowed only for non-internal acknowledgement or signature collection.
7. Every terminal or policy-significant transition creates an audit event.
8. Every externally visible document must be tied to a stored document record.

## Payment Voucher Workflow

### Business intent

The Payment Voucher workflow manages:

- draft creation
- internal approval
- document issuance
- external recipient signature collection
- finance completion

### Payment Voucher states

- `PV_DRAFT`
- `PV_PENDING_DIRECTOR_APPROVAL`
- `PV_REJECTED`
- `PV_APPROVED_PENDING_DOCUMENT`
- `PV_PENDING_RECIPIENT_SIGNATURE`
- `PV_SIGNATURE_SUBMITTED_PENDING_VERIFICATION`
- `PV_SIGNATURE_COMPLETE`
- `PV_PROCESSED`
- `PV_COMPLETE`
- `PV_VOIDED`

### State meanings

#### `PV_DRAFT`

- editable by submitter
- not yet submitted for approval

#### `PV_PENDING_DIRECTOR_APPROVAL`

- submitted and awaiting internal director approval
- submitter cannot edit directly

#### `PV_REJECTED`

- rejected by director or finance
- reason is mandatory
- submitter may amend and resubmit

#### `PV_APPROVED_PENDING_DOCUMENT`

- director approved
- system must generate the issued voucher document
- no external signature request may be sent before the document exists

#### `PV_PENDING_RECIPIENT_SIGNATURE`

- signed document request sent to external recipient
- awaiting signature submission or upload

#### `PV_SIGNATURE_SUBMITTED_PENDING_VERIFICATION`

- external party uploaded signed copy requiring manual verification
- digital capture can skip this state if policy allows automatic verification

#### `PV_SIGNATURE_COMPLETE`

- signed artifact accepted as complete
- finance can process payment or mark process complete depending on operating sequence

#### `PV_PROCESSED`

- payment made
- payment proof attached where required

#### `PV_COMPLETE`

- workflow fully closed

#### `PV_VOIDED`

- voucher canceled after issuance
- void reason required
- remains in history and reporting

### Payment Voucher actions

- `SAVE_DRAFT`
- `SUBMIT_FOR_APPROVAL`
- `APPROVE`
- `REJECT`
- `AMEND_AND_RESUBMIT`
- `GENERATE_DOCUMENT`
- `SEND_SIGNATURE_REQUEST`
- `SUBMIT_DIGITAL_SIGNATURE`
- `UPLOAD_SIGNED_COPY`
- `VERIFY_SIGNATURE`
- `REJECT_SIGNATURE`
- `MARK_PROCESSED`
- `MARK_COMPLETE`
- `VOID`

### Payment Voucher transition table

#### Draft transitions

- `PV_DRAFT` + `SAVE_DRAFT` -> `PV_DRAFT`
  Actor: `SUBMITTER`
  Notes: normal draft save

- `PV_DRAFT` + `SUBMIT_FOR_APPROVAL` -> `PV_PENDING_DIRECTOR_APPROVAL`
  Actor: `SUBMITTER`
  Requirements:
  - required fields present
  - at least one submission line
  - total amount greater than zero
  - recipient and payment details valid

#### Approval transitions

- `PV_PENDING_DIRECTOR_APPROVAL` + `APPROVE` -> `PV_APPROVED_PENDING_DOCUMENT`
  Actor: `DIRECTOR`
  Requirements:
  - authenticated session
  - user has approval authority in org

- `PV_PENDING_DIRECTOR_APPROVAL` + `REJECT` -> `PV_REJECTED`
  Actor: `DIRECTOR`
  Requirements:
  - rejection reason required

- `PV_REJECTED` + `AMEND_AND_RESUBMIT` -> `PV_PENDING_DIRECTOR_APPROVAL`
  Actor: `SUBMITTER`
  Requirements:
  - revised fields saved
  - original rejection history retained

#### Document transitions

- `PV_APPROVED_PENDING_DOCUMENT` + `GENERATE_DOCUMENT` -> `PV_PENDING_RECIPIENT_SIGNATURE`
  Actor: `SYSTEM`
  Requirements:
  - issued PDF successfully generated
  - document number assigned according to numbering policy
  - signature request token issued

#### Recipient signature transitions

- `PV_PENDING_RECIPIENT_SIGNATURE` + `SUBMIT_DIGITAL_SIGNATURE` -> `PV_SIGNATURE_COMPLETE`
  Actor: `EXTERNAL_RECIPIENT`
  Requirements:
  - valid unexpired token
  - bound email matches request
  - consent text shown and captured
  - signed document artifact created

- `PV_PENDING_RECIPIENT_SIGNATURE` + `UPLOAD_SIGNED_COPY` -> `PV_SIGNATURE_SUBMITTED_PENDING_VERIFICATION`
  Actor: `EXTERNAL_RECIPIENT`
  Requirements:
  - valid unexpired token
  - uploaded file accepted

- `PV_SIGNATURE_SUBMITTED_PENDING_VERIFICATION` + `VERIFY_SIGNATURE` -> `PV_SIGNATURE_COMPLETE`
  Actor: `FINANCE_ADMIN`
  Requirements:
  - uploaded document reviewed

- `PV_SIGNATURE_SUBMITTED_PENDING_VERIFICATION` + `REJECT_SIGNATURE` -> `PV_PENDING_RECIPIENT_SIGNATURE`
  Actor: `FINANCE_ADMIN`
  Requirements:
  - rejection reason required
  - new request or retry path available

#### Payment completion transitions

- `PV_SIGNATURE_COMPLETE` + `MARK_PROCESSED` -> `PV_PROCESSED`
  Actor: `FINANCE_ADMIN`
  Requirements:
  - paid date captured
  - payment reference captured where applicable
  - payment proof attached if policy requires

- `PV_PROCESSED` + `MARK_COMPLETE` -> `PV_COMPLETE`
  Actor: `FINANCE_ADMIN`
  Requirements:
  - all required documents and payment metadata present

#### Void transitions

- `PV_APPROVED_PENDING_DOCUMENT` + `VOID` -> `PV_VOIDED`
  Actor: `FINANCE_ADMIN` or `OWNER`
  Requirements:
  - void reason required

- `PV_PENDING_RECIPIENT_SIGNATURE` + `VOID` -> `PV_VOIDED`
  Actor: `FINANCE_ADMIN` or `OWNER`
  Requirements:
  - void reason required

### Payment Voucher evidence requirements

At minimum:

- submission data snapshot at submission time
- approval decision record
- issued voucher PDF
- signature evidence package
- signed document artifact
- payment proof if policy requires it

### Payment Voucher overdue logic

Overdue states should not be separate primary states for MVP. They should be derived flags based on timers and open states.

Examples:

- pending director approval beyond SLA
- pending recipient signature beyond SLA
- signature upload pending verification beyond SLA

These should surface in dashboard and reminder logic without multiplying workflow states unnecessarily.

## Cash Advance Workflow

### Business intent

The Cash Advance workflow manages:

- draft creation
- manager approval
- director approval
- payment processing
- reconciliation checkpoints
- overdue enforcement
- overspend child advance handling

### Cash Advance states

- `CA_DRAFT`
- `CA_PENDING_MANAGER_APPROVAL`
- `CA_PENDING_DIRECTOR_APPROVAL`
- `CA_REJECTED`
- `CA_APPROVED_PENDING_PAYMENT`
- `CA_PROCESSED_PENDING_RECONCILIATION`
- `CA_RECONCILIATION_SUBMITTED`
- `CA_PENDING_CHILD_ADVANCE_CLOSURE`
- `CA_COMPLETE`
- `CA_OVERDUE`
- `CA_VOIDED`

### State meanings

#### `CA_DRAFT`

- editable by submitter

#### `CA_PENDING_MANAGER_APPROVAL`

- waiting on first internal approval

#### `CA_PENDING_DIRECTOR_APPROVAL`

- manager approved
- waiting on final internal approval

#### `CA_REJECTED`

- rejected by manager, director, or finance
- reason required

#### `CA_APPROVED_PENDING_PAYMENT`

- fully approved
- awaiting finance payment processing

#### `CA_PROCESSED_PENDING_RECONCILIATION`

- money disbursed
- reconciliation due date active

#### `CA_RECONCILIATION_SUBMITTED`

- submitter provided documents and outcome
- pending finance validation

#### `CA_PENDING_CHILD_ADVANCE_CLOSURE`

- overspend outcome triggered new child advance
- original cannot close until child condition is satisfied

#### `CA_COMPLETE`

- reconciliation accepted and workflow closed

#### `CA_OVERDUE`

- reconciliation not completed by final policy deadline
- submitter block may apply

#### `CA_VOIDED`

- canceled with reason

### Cash Advance actions

- `SAVE_DRAFT`
- `SUBMIT_FOR_MANAGER_APPROVAL`
- `APPROVE`
- `REJECT`
- `AMEND_AND_RESUBMIT`
- `ESCALATE_TO_DIRECTOR`
- `MARK_PROCESSED`
- `SUBMIT_RECONCILIATION_EXACT`
- `SUBMIT_RECONCILIATION_UNDERSPEND`
- `SUBMIT_RECONCILIATION_OVERSPEND`
- `ACCEPT_RECONCILIATION`
- `REJECT_RECONCILIATION`
- `MARK_OVERDUE`
- `LINK_CHILD_ADVANCE`
- `MARK_CHILD_CONDITION_MET`
- `VOID`

### Cash Advance transition table

#### Draft and approval transitions

- `CA_DRAFT` + `SAVE_DRAFT` -> `CA_DRAFT`
  Actor: `SUBMITTER`

- `CA_DRAFT` + `SUBMIT_FOR_MANAGER_APPROVAL` -> `CA_PENDING_MANAGER_APPROVAL`
  Actor: `SUBMITTER`
  Requirements:
  - required fields present
  - at least one line
  - submitter not blocked by overdue policy

- `CA_PENDING_MANAGER_APPROVAL` + `APPROVE` -> `CA_PENDING_DIRECTOR_APPROVAL`
  Actor: `MANAGER`

- `CA_PENDING_MANAGER_APPROVAL` + `REJECT` -> `CA_REJECTED`
  Actor: `MANAGER`
  Requirements:
  - rejection reason required

- `CA_PENDING_DIRECTOR_APPROVAL` + `APPROVE` -> `CA_APPROVED_PENDING_PAYMENT`
  Actor: `DIRECTOR`

- `CA_PENDING_DIRECTOR_APPROVAL` + `REJECT` -> `CA_REJECTED`
  Actor: `DIRECTOR`
  Requirements:
  - rejection reason required

- `CA_REJECTED` + `AMEND_AND_RESUBMIT` -> `CA_PENDING_MANAGER_APPROVAL`
  Actor: `SUBMITTER`

#### Payment and reconciliation transitions

- `CA_APPROVED_PENDING_PAYMENT` + `MARK_PROCESSED` -> `CA_PROCESSED_PENDING_RECONCILIATION`
  Actor: `FINANCE_ADMIN`
  Requirements:
  - paid date captured
  - reconciliation due date created
  - checkpoint schedule created

- `CA_PROCESSED_PENDING_RECONCILIATION` + `SUBMIT_RECONCILIATION_EXACT` -> `CA_RECONCILIATION_SUBMITTED`
  Actor: `SUBMITTER`
  Requirements:
  - reconciliation docs attached

- `CA_PROCESSED_PENDING_RECONCILIATION` + `SUBMIT_RECONCILIATION_UNDERSPEND` -> `CA_RECONCILIATION_SUBMITTED`
  Actor: `SUBMITTER`
  Requirements:
  - reconciliation docs attached
  - returned balance evidence attached if required

- `CA_PROCESSED_PENDING_RECONCILIATION` + `SUBMIT_RECONCILIATION_OVERSPEND` -> `CA_PENDING_CHILD_ADVANCE_CLOSURE`
  Actor: `SUBMITTER`
  Requirements:
  - reconciliation docs attached
  - overspend amount declared

- `CA_RECONCILIATION_SUBMITTED` + `ACCEPT_RECONCILIATION` -> `CA_COMPLETE`
  Actor: `FINANCE_ADMIN`

- `CA_RECONCILIATION_SUBMITTED` + `REJECT_RECONCILIATION` -> `CA_PROCESSED_PENDING_RECONCILIATION`
  Actor: `FINANCE_ADMIN`
  Requirements:
  - rejection reason required

#### Overspend child transitions

- `CA_PENDING_CHILD_ADVANCE_CLOSURE` + `LINK_CHILD_ADVANCE` -> `CA_PENDING_CHILD_ADVANCE_CLOSURE`
  Actor: `SYSTEM` or `FINANCE_ADMIN`
  Notes:
  - stores child reference

- `CA_PENDING_CHILD_ADVANCE_CLOSURE` + `MARK_CHILD_CONDITION_MET` -> `CA_COMPLETE`
  Actor: `FINANCE_ADMIN`
  Requirements:
  - child advance satisfies configured closing rule

#### Overdue transitions

- `CA_PROCESSED_PENDING_RECONCILIATION` + `MARK_OVERDUE` -> `CA_OVERDUE`
  Actor: `SYSTEM`
  Requirements:
  - final checkpoint missed

- `CA_OVERDUE` + `SUBMIT_RECONCILIATION_EXACT` -> `CA_RECONCILIATION_SUBMITTED`
  Actor: `SUBMITTER`

- `CA_OVERDUE` + `SUBMIT_RECONCILIATION_UNDERSPEND` -> `CA_RECONCILIATION_SUBMITTED`
  Actor: `SUBMITTER`

- `CA_OVERDUE` + `SUBMIT_RECONCILIATION_OVERSPEND` -> `CA_PENDING_CHILD_ADVANCE_CLOSURE`
  Actor: `SUBMITTER`

### Cash Advance checkpoint logic

Recommended model:

- checkpoint 1 at day 14
- checkpoint 2 at day 21
- checkpoint 3 at day 28

Behavior:

- checkpoint jobs create reminders, not state changes
- only final missed checkpoint changes workflow state to `CA_OVERDUE`
- dashboard should show current checkpoint and due date

### Cash Advance blocking rule

Default policy:

- if submitter has one or more `CA_OVERDUE` records in the same organization, new CA submission is blocked

Override option:

- finance or owner may create a reasoned override if policy allows it

### Cash Advance evidence requirements

At minimum:

- approval history
- payment processing metadata
- reconciliation documents
- underspend return evidence where relevant
- overspend child linkage where relevant

## Cross-Workflow Policy Rules

### Same-person manager and director rule

Default recommendation:

- allowed only if organization policy explicitly enables it

Preferred control:

- allow below threshold
- require separation above threshold

### Internal approval rule

- internal approvals must use authenticated session
- email links may open the page, but cannot complete the action alone

### Rejection rule

- rejections always require reason text
- resubmission creates a new transition, not silent mutation

### Void rule

- voiding always requires privileged actor and reason
- voided records remain reportable

## Dashboard Derivations

These should be derived from workflow state plus time, not implemented as extra states unless operationally necessary.

- overdue approval
- overdue signature collection
- overdue signature verification
- overdue reconciliation checkpoint
- blocked submitter due to overdue CA

## MVP Workflow Cut

For MVP, fully implement:

- Payment Voucher workflow
- director approval
- recipient signature collection
- processing and completion

For phase after MVP, implement:

- Cash Advance workflow
- checkpoint scheduling
- overdue blocking
- overspend child handling

Do not build every workflow at once. Build one strict workflow end to end, then reuse the engine.

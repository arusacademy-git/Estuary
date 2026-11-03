# PROJECT_MEMORY.md

- 2026-10-21: Role action-queue Month and Exact date filters use the request submission/updated date consistently across Invoice Payment, Cash Advance, Travel Allowance, Claims and Petty Cash; they do not switch semantics to travel, claim or payment dates.

- Public Google Sheet imports can preserve clickable file smart-chip URLs without requiring an API key by combining CSV data with the sheet's public HTML and Visualization HTML representations. This requires “Anyone with the link can view”; an API key is only an optional metadata fallback and does not bypass private-file permissions.

## Shared request UI patterns

- Returned Staff edits for Invoice Payment, Travel Allowance, Claims, Cash
  Advance and Petty Cash use the shared `CorrectionEditLayout`: form content on
  the left, a red Action Required remarks card on the right, and a stacked
  mobile fallback. New-request forms do not render the correction rail.
- Page-level payment loading and unavailable states use `PaymentPageState` so
  headings, explanatory copy and back navigation remain consistent across
  payment types, including Payment Voucher.
- Correction back links always return to the exact request detail route, not
  the payment-type list, and remain visually un-underlined in all link states.

## Durable Lessons

- None recorded yet.

## Reusable Patterns

- Claim form preview/download links use the stable human-facing Claim number
  with the registered Claim endpoint: `/claims/<claim-number>?form=1` for inline
  preview and `&download=1` for attachment delivery. The server repository may
  accept both the Claim number and internal UUID, but UI and batch-download
  links should not expose or depend on the UUID. Do not depend on the nested
  `/claims/[id]/form` route because it may be absent from the running manifest.

## Decision Log

- 2026-11-01: Do not display a role-wide aggregate `Waiting for...` total in Manager, Director or Finance queue heroes, the combined pending sidebar item, or dashboard KPI summaries while those surfaces derive action scope differently. Retain scoped per-payment-type counts and requester-owned My Requests badges because they remain useful navigation signals. Reintroduce a grand total only after every surface consumes one authoritative server-side count definition.
- 2026-10-30: Private Claim uploads must not be written beneath the deployed application directory because hosts may mount `/app` read-only. Resolve local-private Claim storage from `ESTUARY_PRIVATE_STORAGE_ROOT`; use a writable persistent mount in deployed environments. An operating-system temp-directory fallback may prevent a request crash, but it is ephemeral and must not be treated as durable document storage.
- 2026-10-30: Dashboard Next Action routing is requester-first, not role-first. When the signed-in user owns a draft, rejected/returned correction, PV confirmation/signature handoff, or reconciliation task, link to that payment type's My Requests record even if the requester is a Manager, Director, or Finance user. Only assigned review/approval/processing work links to the role's combined pending queue, using both `type` and `request` query parameters so the exact record opens.
- 2026-10-30: Sidebar role queues and dashboard `Need your action` use different scopes because the dashboard may combine assigned role work with requester-owned My Requests work. Do not present either value as one authoritative aggregate; use scoped per-payment-type counts and descriptive guidance instead.
- 2026-08-17: Adopted a lightweight, manual persistent-documentation scaffold without automation or enforcement.
- 2026-09-14: Payment-record references are assigned once at creation using
  `<TYPE PREFIX>-<YEAR>-<SEQUENCE>`. Payment types keep separate annual
  sequences, and the next number is based on the highest stored sequence rather
  than record count so deleted records do not cause reuse.
- 2026-09-14: Travel Allowance replaces the editable Google Sheet link with
  structured Estuary rows and a generated official form. Its intended workflow
  is Staff submission, Project Director approval, Finance verification/payment,
  then Completed; it does not use recipient signing.
- 2026-09-14: Payment Request domain types are organized by payment type under
  `<payment-type>/types.ts`. For the current local prototypes, each module also
  owns and exports its supporting-document type to keep imports self-contained;
  do not rebuild a single large `payment-requests/types.ts` file.
- 2026-10-07: Petty Cash uses manual entry only. Its Google Sheet importer,
  generated PDF, PDF route, template, Payment Records ZIP entries and ledger
  form links were retired. Keep the normal request details and receipt/proof
  links available throughout review, Finance processing and the ledger.
- 2026-10-07: Petty Cash Manager and Director stages are informational previews,
  not approval gates. Every new request enters Finance processing immediately;
  assigned previewers still receive notifications and action counts, and their
  completion timestamps are tracked independently. A Finance requester selects
  a different Finance user, Manager or Director as the independent previewer.
- 2026-09-22: The Beta dashboard uses one normalized cross-payment record model
  and derives `Need your action` from the signed-in role. A failure in one
  payment API must not hide records loaded successfully from other modules.
  Claims now use their dedicated Prisma-backed repository and API. Sidebar
  action counts, dashboard aggregation and Claims Payment Records all use that
  API rather than the prototype endpoint.
- 2026-09-23: Dashboard and sidebar action totals count only work owned by the
  signed-in role. Waiting for a Manager, Director, recipient or Finance must not
  be presented to Staff as a Staff action. Sidebar payment-type bubbles reuse
  those role-specific status rules.
- 2026-10-04: Staff uses the `My Requests` sidebar action badge for work owned
  by the original requester across every payment type. Count Drafts, returned
  corrections, PV recipient handoff/signature steps and Cash Advance
  reconciliation there; keep approval and Finance-processing counts in their
  role queues to avoid duplicate responsibility.
- 2026-10-01: The original role-gated Petty Cash routing decision was superseded
  on 2026-10-07 by direct Finance processing with non-blocking informational
  previews. A Finance requester must still never preview their own request.
- 2026-09-23: The compact right-rail rejection card applies to Payment Voucher
  only. Keep the existing returned-request layouts for Invoice Payment, Travel
  Allowance, Cash Advance and Petty Cash.
- 2026-10-01: Claims routing depends on the claimant role: Staff, Manager and
  Finance claims follow Claimant → Manager review → Director preview → Finance
  processing → Completed. Director claims follow Director claimant → Finance
  processing → Completed. A Finance claimant receives the claim back for the
  Finance-processing stage after Manager and Director review. The Director
  stage is a preview/forward action, while Finance records payment and closes
  the Claim.
  For a Finance claimant, the first reviewer is their selected Finance Manager;
  the Finance claimant cannot review their own Claim. After Director preview,
  Finance processing is assigned back to that original Finance claimant.
- 2026-09-23: A saved Claim Draft is a real Prisma `Submission` in `DRAFT`
  state with a stable CL reference. It must remain unassigned, must not create
  approval steps or consume Medical/Tech policy allowance, and must transition
  the same record/reference into the role workflow when submitted.
- 2026-10-01: After Finance records a Payment Voucher payment, responsibility
  for sending the voucher to the external recipient and confirming the signed
  voucher belongs to the original requester, regardless of whether that
  requester is Staff, Manager or Finance. Use requester identity plus active
  organization membership; do not restrict these actions to the Staff role.
- 2026-10-02: Payment Voucher creation, draft submission and rejected-request
  resubmission are available to active Staff, Manager and Finance members.
  Director is excluded so Director approval remains independent.
- 2026-10-02: Petty Cash is a continuing float by location. Each month's
  closing balance becomes the next month's opening balance, then the new RM500
  allocation is added. Never reset `current_balance` to the monthly allocation.
- 2026-10-02: `My Requests` counts requester-owned actions only. Keep approval,
  preview and Finance-processing actions under their role queues so sidebar
  counts do not duplicate the same responsibility.
- 2026-10-01: Cash Advance reconciliation belongs to the original requester,
  regardless of whether the requester is Staff, Manager, Director or Finance.
  Finance payment assigns reconciliation back to `submitted_by_id`; submission
  authorization uses requester identity plus active organization membership.
  The approval and Finance-completion stages remain unchanged.
- 2026-10-03: Completed-expenditure analytics is an organization-wide management
  view shared by every Director and Finance user. Broaden only the chart dataset;
  keep dashboard records, assigned-action counts and workflow queues role-scoped.

## Known Failure Modes

- None recorded yet.

## Do Not Repeat

- Do not describe advisory ownership notes as enforced locks or manual logs as generated lifecycle records.

# Payment request reference formats

- Payment Voucher keeps its existing reference format.
- New Invoice Payment references use `IVYY-MM-NN`.
- New Cash Advance references use `CAYY-MM-NN`.
- New Travel Allowance references use `TAYY-MM-NN`.
- New Claim references use `CL-MM-NN`; because the year is intentionally not
  displayed, its per-month sequence must not reset each year or references can
  collide.
- New Petty Cash references use `PC-YY-NN` and reset their sequence each year.

## Database-backed incomplete request drafts

- Manual request drafts must persist through Prisma/PostgreSQL, not browser
  `localStorage`, so a requester can continue work across sessions and devices.
- Keep incomplete draft snapshots in the dedicated `PaymentRequestDraft` model
  rather than `Submission`; approval queues and type-specific mappers must only
  receive structurally complete submitted requests.
- Claims retain their established Claims-specific Prisma draft path. The generic
  draft model covers Payment Voucher, Petty Cash, Invoice Payment, Travel
  Allowance and Cash Advance.
# Finance payment proof is a separate persisted step

- Travel Allowance and Cash Advance Finance processing must not require transaction proof when Finance first records a payment.
- The first action validates the payment date/reference plus Finance confirmation and persists `PAYMENT_PROCESSED` while retaining Finance ownership.
- The transaction-proof upload appears only in that state. Travel Allowance completes after upload; Cash Advance proceeds to requester reconciliation.
- Any combined Finance queue, dashboard action predicate, or sidebar count must include `PAYMENT_PROCESSED`, otherwise a record disappears between the two Finance actions.


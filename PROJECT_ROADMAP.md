# PROJECT_ROADMAP.md

> Build roadmap for Estuary. Restructured 2026-07-06 from phase checklists into an ordered build sequence with explicit gates. Old Phase numbers (from `docs/SOFTWARE_SCOPE.md`) are mapped on each block so older documents stay readable.

## Current State (2026-07-06)

Design is complete and locked (SOFTWARE_SCOPE v0.8, SCHEMA v2.2, two Codex review cycles). A browsable local POC proves the full payment-voucher lifecycle and the payment-request lifecycles (invoice, claim, travel allowance, cash advance) end to end — but on a stand-in backbone: JSON files instead of Postgres, dummy sign-in instead of sessions, a file outbox instead of SES, link text instead of S3 uploads.

**Works today (verified green):** routed prototype UI (dashboard, composer, approvals, finance, settings, recipient signing), payment-request module, live PDF generation, lint/typecheck/unit/build/e2e chain, Prisma schema v2.2 with the initial migration authored and proven to apply (`prisma/migrations/20260706000000_init`).

**Not real yet:** database persistence, authentication/sessions, org scoping and role enforcement, SES email, S3 storage, MCP server, deployment.

The build direction is therefore single-minded: **replace the stand-in backbone with the real one without losing the working flows.** No new feature surfaces until B1–B3 are done.

### Repository operations gate
- [x] Install and authenticate GitHub CLI (`gh`) and configure `origin` for `arusacademy-git/Estuary`.
- [x] Publish `agent/normalize-estuary-repository` and open draft PR #1 into `main`.
- [ ] Review and merge PR #1 before starting new feature branches from normalized `main`.
- [ ] Configure GitHub branch protection/rules for `main` to require pull requests and prevent direct pushes.

## Decision Queue (Afiq)

| ID | Decision needed | Blocks |
|----|----------------|--------|
| OQ-LocalPostgres | Docker Desktop is not installed on this machine. Install it (keeps the locked `compose.yaml` path — recommended), or adopt a native/embedded dev Postgres | B1 start |
| Real creds | Google OAuth client + AWS keys (SES, S3) | B2 live OAuth; B3 live email/storage (adapters can be built without them) |
| OQ-PettyCashConfirm | Petty cash model (imprest float ledger) confirmation | B6 petty cash only |
| OQ-5 | Real SQL Account CSV sample file | B7 only |

## Build Sequence

Blocks are ordered; each gates the next unless marked parallel-safe.

### B0 — Environment and contract *(old Phase 0 — DONE except the decision)*
- [x] Next.js/TypeScript scaffold, ESLint, Prettier, Vitest, Playwright
- [x] Docker compose definition, env var structure, layer boundaries (`web`/`api`/`domain`/`worker`/`data`/`integration`)
- [x] Schema v2.2 in Prisma; initial migration authored and verified against a real (embedded) Postgres
- [ ] **Gate:** OQ-LocalPostgres resolved → `prisma migrate deploy` against the persistent local database

### B1 — Real persistence backbone *(old Phase 1, data half)*
Swap file-backed JSON state for Prisma/Postgres behind the existing repository interfaces.
- [ ] Reference data persistence + seeding: staff, GL codes, projects, payment modes, orgs
- [ ] PV workflow state moved from `prototype-state-repository` JSON to Submission + detail + line-item tables
- [ ] Payment-request module moved to the same backbone
- [ ] WorkflowDefinition / WorkflowState / WorkflowTransitionRule seeded for PV; `executeTransition(submissionId, actionCode, actor)` domain path writing immutable `SubmissionTransition` rows
- [ ] Local outbox and export records moved to DB-backed tables (delivery still file-based)
- **Acceptance:** app runs with zero project-local JSON state files; all existing unit + e2e tests pass against Postgres.

### B2 — Sessions, orgs, and roles *(old Phase 1, auth half)*
- [ ] NextAuth session abstraction: local credentials provider now, Google OAuth drop-in when creds arrive
- [ ] Org-aware session context + organization switcher; membership provisioning shell
- [ ] Role checks enforced on every `/api/v1/` route; remove all payload-provided `actorId` trust
- **Acceptance:** no endpoint accepts caller-supplied identity; role/org scoping covered by tests.

### B3 — Production PV path *(old Phase 2 completion)*
- [ ] Email abstraction: file outbox → SES adapter (adapter built now, switched on when creds arrive)
- [ ] S3 receipt/file upload with local-disk adapter for dev; replace receipt-link text
- [ ] `ExternalActionToken` one-use signed links for recipient signature (hashed, expiring)
- [ ] PV PDF layout tightened against the real voucher template
- [x] Automatically generate Malay amount-in-words from the numeric total using Afiq's established Sheet vocabulary
- [ ] Worker polling shell for `job_queue` (reminders, retries)
- [ ] MCP tool shell wrapping the real `/api/v1/` endpoints
- **Acceptance:** full PV lifecycle — issue → director approval → payment → recipient signature → verification → export — runs on the real backbone with every state change audited.

### B4 — Hardening *(old Phase 3)*
- [ ] Sensitive-data masking in UI; log redaction rules
- [ ] Upload validation and malware scanning
- [ ] Observability / failure diagnostics
- [ ] Field-level encryption for highest-risk data
- [ ] Batch (mass) PV creation
- Parallel-safe with B5 once B3 lands.

### B5 — Cash Advance and Travel Allowance completion *(old Phase 4)*
- [x] Manager → Director chain and parent-child overspend linkage (local MVP)
- [ ] Reconciliation checkpoint scheduling (2w/3w/4w) on the real job queue
- [ ] Overdue blocking (unreconciled CA past checkpoint 3 blocks new CAs in that org)
- [ ] MCP surfaces for CA / Travel

### B6 — Additional workflows *(old Phase 5)*
- [x] Invoice Payment and Expense Claim lifecycles (local MVP)
- [ ] Productionize both on the B1–B3 backbone
- [ ] Petty Cash module — **blocked on OQ-PettyCashConfirm**
- [ ] Kakitangan deprecation path (target mid-2027)

### B7 — Accounting integration *(old Phase 6)* — **blocked on OQ-5**
- [ ] SQL Account CSV export locked to the real sample file
- [ ] Export idempotency / re-export reasoning; import-status tracking
- [ ] Bank batch export

### B8 — Deploy, scale, configure *(old Phase 7–8)*
- [ ] Lightsail deployment (Dockerized app + RDS), domain + SES production mode
- [ ] Approval chain / email template / PV template configuration UIs per org
- [ ] Reporting and audit search; expanded MCP tool surface
- [ ] Future: direct bank payment API, WhatsApp/Telegram follow-ups, multi-currency, ECS + RDS Multi-AZ

## Done Log

- 2026-04-10→13: Scope + schema design (SOFTWARE_SCOPE v0.8, SCHEMA v2.2, 2 Codex reviews), stack locked
- 2026-04-14: Phase 0 scaffold (Next.js, Docker, Prisma, bootstrap API, smoke tests)
- 2026-04-15: Routed PV prototype → multi-line composer → CreateSpace design pass → PDF generation → full local MVP workflow with outbox and export
- 2026-04-16: Payment-request module (invoice/claim/travel/CA) with e2e; Playwright stabilized in production mode
- 2026-04-23: Codex close-out and lock release
- 2026-07-06: Lock reacquired (Claude/ALAKAZAM01); baseline re-verified; orphaned April work committed; initial Prisma migration authored + verified; `E2E_PORT` isolation added
- 2026-08-16: Simplified PV lines to Account + Description + Amount for normal use; moved quantity, unit price, and tax into an optional detailed calculation control
- 2026-08-16: Ported Afiq's Ringgit-to-Malay-words formula into the shared calculation layer and made the composer field automatic/read-only

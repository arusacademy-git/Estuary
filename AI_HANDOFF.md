# AI_HANDOFF.md

## Current State
- Project: Estuary
- Summary: Transferred to OpenAI Codex during duplicate-path control-state repair; no Athanor files were changed.
- Current Holder: GitHub issue/branch owner (non-exclusive project model)
- Actor Model: OpenAI Codex
- Assigned Agent:
- Skill Loadout:
- Governance Profile:
- Cast ID:
- Homunculus Memo Path:
- Current Branch: agent/normalize-estuary-repository
- Last Updated: 2026-08-12T16:52:22+08:00

## Handover Status
- Session Status: ACTIVE
- Lock Status: RELEASED / non-blocking compatibility record
- Session Started: 2026-08-12T16:52:22+08:00
- Baseline: full verification chain re-run and passing on 2026-07-06 (see Verification)
- Next Assignee Start Point: run `corepack pnpm install`, then `corepack pnpm lint`, `corepack pnpm test`, and `$env:E2E_PORT='3131'; $env:CI='1'; corepack pnpm test:e2e` before new feature work.

## Current Blockers
- GitHub publishing setup: `origin` targets `arusacademy-git/Estuary`; GitHub CLI is installed and authenticated as `afiq-work`.
- OQ-PettyCashConfirm: Petty Cash model not confirmed. Blocks Phase 5 only.
- OQ-5: SQL Account CSV sample needed before Phase 6 export build. Blocks Phase 6 only.
- Real Google OAuth / AWS creds are still absent, so auth and integration work remains local or stubbed for now.
- OQ-LocalPostgres: Docker Desktop is not installed on this machine, so `compose.yaml` cannot supply the local Postgres. The initial migration is authored and verified (see changelog); applying it to a persistent local database needs Afiq's call on Docker Desktop vs a native/embedded dev Postgres.
- Port 3000 is often held by the Layar project's Next server on this machine; use `E2E_PORT` (e.g. 3131) for Playwright runs.
- Email delivery is still file-backed only; SMTP handoff is intentionally unwired for now.
- Receipt handling is link/reference-based only; actual upload storage is still future work.
- Real auth/session binding is still absent, so API endpoints trust caller-provided `actorId` in payloads (acceptable for local MVP, not acceptable for production).
- Local JSON repositories are still file-write based with no locking/transaction guarantees under concurrent writes.

## Key Decisions (All Sessions)

### Stack
- Next.js (TypeScript, App Router) + PostgreSQL (RDS target) + Prisma + NextAuth + AWS SES + S3 + Docker + Lightsail
- Multi-entity from day one: Organization is the top-level partition; SSO with org switcher
- API-first: every action addressable as REST `/api/v1/`
- MCP server layer: built alongside each phase (not a final phase)
- Docker from day one: Lightsail -> ECS with no code changes when commercializing

### Payment voucher policy now accepted for the POC
- Everyone can submit.
- Submitter selects the approver from the live staff directory.
- Same-person manager/director is allowed.
- Finance admin can override anything.
- If manager approval is blocked, director approval can stand as the fallback.
- Director submitter behavior is toggleable: auto pass-through or require another director.
- Urgent bypass is allowed, but still requires director approval and stays visibly flagged for finance.
- Recipient reminder loop can continue indefinitely; rejected signed PVs return to pending signature.
- Document retention can be treated as permanent.

### Configuration-first implementation rule
- Do not hardcode workflow copy, email wording, or theme direction into rigid code paths.
- Reference data, placeholders, and policy surfaces should remain easy to change.
- The POC should prove architecture and control surfaces, but it must still feel like a real product surface in the browser rather than an internal config sandbox.

## Artifacts Produced
- `README.md` - updated quickstart and POC principles
- `src/app/(prototype)/` - routed prototype pages for dashboard, new voucher, approvals, finance, settings, and voucher detail
- `src/app/_components/prototype-app-shell.tsx` - shared in-app navigation shell with dummy user switching
- `src/app/_components/prototype-screens.tsx` - product-facing MVP screens, including issuing, approval, finance, verification, and export actions
- `src/app/_components/recipient-signature-screen.tsx` - recipient-facing signature capture surface
- `src/app/recipient/[token]/page.tsx` - public local recipient-sign route
- `src/app/api/v1/prototype/payment-voucher-pdf/route.ts` - live PDF generation endpoint for the current draft
- `src/app/api/v1/prototype/workflow/route.ts` - workflow action endpoint for issue / approve / pay / sign / verify / export
- `src/lib/prototype/payment-voucher-pdf.ts` - PDF layout generator for payment vouchers
- `docs/References of existing documents/createspace-DESIGN.md` - design guide now reflected in the shell fonts, color system, and screen styling
- `src/data/prototype/prototype-state-repository.ts` - local filesystem-backed voucher workflow repository, outbox writer, and export handler
- `src/data/prototype/` and `src/domain/prototype/` - config-driven POC model and workspace view
- `src/lib/prototype/voucher-calculations.ts` - shared totals and line-item calculation helpers used by UI and PDF generation
- `src/lib/template/` - placeholder interpolation helper
- `/api/v1/prototype/workspace` - shared API view of the prototype workspace
- Existing bootstrap route remains at `/api/v1/system/bootstrap`
- `docs/References of existing documents/` - legacy PV manual and PV template references
- `tests/e2e/payment-requests.spec.ts` - smoke for browse -> create -> detail on payment-request module routes (currently passing)

## Latest Session Changelog
- 2026-08-12: Normalized the GitHub repository layout on a branch based on `origin/main`. The GitHub upload had placed the real project under `Work - Estuary/` and its history was unrelated to the complete local repository, preventing pull-request comparison. The normalization moves the project to the repository root and overlays the verified current local tree so future branches share GitHub `main` history after merge.
- 2026-08-12: Replaced exclusive project locking for Estuary with GitHub-first collaboration. Issues and assignees own scope, separate branches allow parallel work, and pull requests into protected `main` are the integration path. `PROJECT_LOCK.md` remains only as a non-blocking Ground Control compatibility record.
- 2026-08-12: Repaired duplicate Estuary registration. Ground Control now targets the nested folder that contains the actual Git repository, the misleading wrapper-level lock was removed, and Afiq transferred the canonical project lock from Claude/ALAKAZAM01 to OpenAI Codex without modifying Athanor. Added the standing GitHub close-out policy; first publication remains blocked on missing `gh` and missing remote configuration.
- 2026-04-14: Initial scaffold landed: Next.js, Docker, Prisma bootstrap, bootstrap API, smoke coverage
- 2026-04-15: Ingested the legacy PV manual and template PDF
- 2026-04-15: Converted David's approval and exception answers into a configuration-first local POC
- 2026-04-15: Replaced the single-page workbench with a routed, browser-facing payment-voucher prototype and opened it locally for direct browsing
- 2026-04-15: Upgraded the new-voucher composer from a single summary block into a repeatable line-item table with row add/remove, tax toggles, and calculated totals
- 2026-04-15: Reworked the prototype UI around the provided CreateSpace design guide with new typography, color planes, glass treatment, and higher-contrast shell/screen hierarchy
- 2026-04-15: Reworked the CreateSpace pass again into a restrained light dashboard after the first saturated version overshot the intended visual tone
- 2026-04-15: Added a live payment-voucher PDF generation path from the current draft, exposed through both the composer UI and `/api/v1/prototype/payment-voucher-pdf`
- 2026-04-15: Replaced seeded-only workflow surfaces with a local persisted MVP: issue voucher, director signature approval, finance payment capture, recipient signature route, staff verification, queued local outbox emails, and local-folder export of completed PDFs
- 2026-04-16: Worker C added Playwright integration for payment-request browse/create/detail flow and made home smoke resilient to evolving navigation labels across voucher/request surfaces
- 2026-04-16: Integrated payment-request module from sub-agent outputs: request types, API routes, repository, list/create/detail screens, and nav entry
- 2026-04-16: Fixed payment-request screen hook dependency warning (`useCallback` around request loader) and aligned e2e input selectors with required recipient fields
- 2026-04-16: Stabilized Playwright web server by switching e2e web-server command to production mode (`pnpm build && pnpm start`) to avoid Dropbox/Next-dev `EPERM` rename failures
- 2026-04-23: Closed out session and released project lock for reassignment after updating lock/history/handoff/memory/roadmap documentation
- 2026-07-06: Claude/ALAKAZAM01 reacquired the lock; re-ran the full verification chain (all passing) after the 2.5-month gap
- 2026-07-06: Discovered the entire April payment-request module (~3,900 lines) was never committed; checkpointed it as `feat: add payment-request module with e2e coverage` plus a docs commit for the control files
- 2026-07-06: Made the Playwright port configurable via `E2E_PORT` (port 3000 was held by the Layar dev server); e2e re-verified on port 3131
- 2026-07-06: Authored the initial Prisma migration offline from Schema v2.2 (`prisma migrate diff --from-empty`) and proved it applies cleanly via `prisma migrate deploy` against a throwaway embedded PostgreSQL 18.4 instance; committed as `prisma/migrations/20260706000000_init`
- 2026-07-06: Restructured `PROJECT_ROADMAP.md` from drifted phase checklists into an ordered build sequence (B0–B8) with gates, acceptance criteria, and a David-facing decision queue
- 2026-07-06: Added `docs/ESTUARY_OVERVIEW.html` — self-contained project overview and development-history page for human readers

## Verification
- 2026-08-12 normalization verification:
  - normalized index tree matches verified local commit `72f0178` except for four continuity files documenting the new normalization branch
  - `git diff --cached --check` -> pass
  - lint/typecheck/unit/build attempt -> environment-blocked before scripts ran; the bundled pnpm dependency layer and direct frozen-lockfile install both timed out without progress, while offline install reported missing cached `@pnpm/exe@10.33.0`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm exec playwright install chromium`
- `$env:CI='1'; corepack pnpm test:e2e`
- Prisma schema remains valid with a supplied `DATABASE_URL`
- 2026-04-16 consolidated run results:
  - `corepack pnpm lint` -> pass
  - `corepack pnpm typecheck` -> pass
  - `corepack pnpm test` -> pass (`6 files`, `8 tests`)
  - `corepack pnpm build` -> pass
  - `$env:CI='1'; corepack pnpm test:e2e` -> pass (`2 passed`)
- 2026-07-06 consolidated run results:
  - `corepack pnpm lint` -> pass
  - `corepack pnpm typecheck` -> pass
  - `corepack pnpm test` -> pass (`6 files`, `8 tests`)
  - `corepack pnpm build` -> pass
  - `$env:E2E_PORT='3131'; $env:CI='1'; corepack pnpm test:e2e` -> pass (`2 passed`)
  - `prisma migrate deploy` against embedded PostgreSQL 18.4 -> pass (`20260706000000_init` applied)

## Next Steps
1. Resolve OQ-LocalPostgres (David decision: install Docker Desktop, or adopt a native/embedded dev Postgres), then apply `20260706000000_init` to the persistent local database
2. Move local JSON workflow persistence, outbox files, and export records into the real database/storage architecture
3. Replace dummy sign-in with a real session abstraction while preserving the current role-specific MVP flow
4. Add real receipt upload storage and richer signed-voucher rejection / resend handling
5. Replace the current generic PDF layout with a closer reproduction of the real PV document template once the final layout is confirmed
6. Replace payload-provided `actorId` trust with server-side session identity before productionization
- Latest Deployment At: 2026-08-12T16:52:22+08:00
- Latest Deployment Actor Model: OpenAI Codex
- Latest Deployment Agent:
- Latest Deployment Skill Loadout:

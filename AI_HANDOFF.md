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
- Current Branch: feature/simplify-pv-lines
- Last Updated: 2026-08-16T12:25:00+08:00

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
- 2026-10-10: Added local-only Finance bulk processing for Invoice Payments, Travel Allowances, Claims, Cash Advances and Petty Cash. Each request type has a separate workspace and route, the action button sits below the Finance page description, Claims include a type filter, records require detail review, and processing runs in bounded groups of five. Cash Advances move to reconciliation after payment; Petty Cash requires payment proof before completion. No GitHub, database migration or deployment action was performed.
- 2026-10-09: Restored the missing `exceljs` runtime dependency required by the payment-voucher Excel template generator on branch `agent/fix-missing-exceljs-dependency` under GitHub issue #40. The generator itself was preserved and no database or deployment changes were made.
- 2026-08-16: Ported Afiq's Google Sheets Ringgit-to-Malay-words formula and helper vocabulary into the shared voucher calculation library. The composer now derives a read-only amount-in-words value from the grand total, while voucher issuing and PDF generation independently recalculate it so callers cannot persist or print a mismatched phrase.
- 2026-08-16: Simplified the Payment Voucher composer around the normal reimbursement case. Each voucher line now exposes Account, Description, and a direct Amount field; quantity, unit price, and tax are collapsed under an optional calculation control. One voucher still represents one payee, while multiple lines separate purposes or accounting categories.
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
- 2026-10-10 Finance request bulk processing:
  - targeted ESLint for all added and updated Finance bulk files -> pass
  - `corepack pnpm lint` -> pass
  - `corepack pnpm typecheck` -> pass
  - `corepack pnpm test` -> pass (`7 files`, `15 tests`)
- 2026-10-09 ExcelJS dependency repair:
  - `corepack pnpm install --lockfile-only --frozen-lockfile` -> pass
  - `node -e "console.log(require.resolve('exceljs/package.json'))"` -> pass (`exceljs@4.4.0` resolved)
  - targeted ESLint for `download-payment-voucher-template.ts` -> pass
  - `corepack pnpm typecheck` -> pass
  - `corepack pnpm test` -> pass (`7 files`, `15 tests`)
- 2026-08-16 amount-in-words automation:
  - `corepack pnpm lint` -> pass
  - `corepack pnpm typecheck` -> pass
  - `corepack pnpm test` -> pass (`6 files`, `13 tests`)
  - `corepack pnpm build` -> pass
  - `$env:PLAYWRIGHT_BROWSERS_PATH='0'; $env:E2E_PORT='3131'; $env:CI='1'; corepack pnpm test:e2e` -> pass (`2 passed`)
  - local browser verification -> RM1,250.40 produces `RINGGIT MALAYSIA SATU RIBU DUA RATUS LIMA PULUH DAN SEN EMPAT PULUH SAHAJA`; field is read-only
- 2026-08-16 PV line simplification:
  - `corepack pnpm lint` -> pass
  - `corepack pnpm typecheck` -> pass
  - `corepack pnpm test` -> pass (`6 files`, `8 tests`)
  - `corepack pnpm build` -> pass
  - `$env:PLAYWRIGHT_BROWSERS_PATH='0'; $env:E2E_PORT='3131'; $env:CI='1'; corepack pnpm test:e2e` -> pass (`2 passed`)
  - local browser verification -> direct amount updates totals; optional control reveals quantity, unit price, and tax fields
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

## 2026-10-15 — Monthly Travel Allowance request numbers

- New Travel Allowance request numbers use `TAyy-MM-NN`, for example `TA26-09-01` for the first September 2026 request.
- Numbering continues to use the existing organization/year/month sequence record, so each organization's sequence resets monthly.
- Finance payment references inherit the same stored Travel Allowance number automatically.
- Added a shared formatter plus regression coverage. Four targeted tests, targeted ESLint, and TypeScript checking passed.

## 2026-10-15 — Tech Claim amount tiers and required Manager approval

- Manual and Google Sheet Tech Claims now use the same amount-driven rules: up to RM500 standard; RM500.01–RM1,000 extended with required Manager approval for Staff; above RM1,000 rejected.
- Extended status is normalized on the server instead of trusting a client checkbox. The three-year Tech Claim lock remains active after use of the extended allowance.
- Staff extended Tech Claims enter `PENDING_MANAGER_APPROVAL`, then move to `PENDING_FINANCE_PROCESSING` after approval. Finance single and bulk processing are blocked before that approval, including a server-side guard.
- Updated claimant, Manager, Finance, workflow and notification interfaces to communicate whether Manager action is required or merely informational.
- Verification passed: all 16 Vitest files / 44 tests, targeted ESLint, and TypeScript checking with incremental output disabled.

## 2026-10-15 — Automatic Cash Advance and Petty Cash payment references

- Cash Advance and Petty Cash now use their request numbers as Finance payment references in single and bulk processing.
- References are read-only in the Finance UI and are derived again from `submission_number` in the database operations; clients no longer supply the Cash Advance reference, and the Petty Cash reference is optional/ignored.
- Existing paid or verified records map their displayed reference from the request number, avoiding a data migration while keeping old records consistent.
- Petty Cash payment proof remains mandatory.
- Verification passed: all 16 Vitest files / 46 tests, targeted ESLint, and TypeScript checking with incremental output disabled.

## 2026-10-15 — Cash Advance bulk confirmation spacing

- Added matching bottom spacing to the Cash Advance workflow notice so it no longer touches the confirmation footer in Finance bulk processing.

## 2026-10-16 — Payment Records loading consistency

- Payment Records and My Requests now track loading per payment category, preventing Cash Advance and other cards from briefly showing false zero counts while their API calls are still pending.
- Loading record totals use the same subtle animated placeholder across Payment Voucher, Invoice, Claim, Cash Advance, Travel Allowance, and Petty Cash cards.
- The Cash Advance records loader now uses the shared payment-page state and returns to the correct Payment Records or My Requests scope.

## 2026-10-16 — Automatic Claim payment references

- Claim Finance processing now uses the stored Claim number as the payment reference for both single-record and bulk processing, matching Payment Voucher and Invoice Payment behavior.
- Finance sees the automatic Claim reference in a read-only field and no longer types a separate transaction reference.
- The database derives the reference from `submission_number` and ignores any client-supplied reference, ensuring the saved payment reference always matches the Claim number.
- The Claim Finance API now requires only the Finance user and payment date; the reference is generated internally.
- Verification passed: targeted ESLint and TypeScript checking with incremental output disabled.

## 2026-10-16 — Cash Advance Finance loading screen

- Replaced the plain blue `Loading Cash Advance…` notice on the Finance payment-processing detail page with the shared centered payment-page loading state used by the other payment workflows.
- Initial-load failures now use the same full-page state and include a direct return link to the Finance Cash Advance queue.
- Verification passed: targeted ESLint and TypeScript checking with incremental output disabled.

## 2026-10-16 — Finance Claim table sizing

- Increased the minimum width of the Finance/Director Claim list table and reserved practical widths for Claimant, Role, Claim Type, and Status columns.
- Role values such as Manager and Director no longer wrap into narrow letter stacks; smaller viewports retain horizontal scrolling instead of compressing the columns.
- Verification passed: targeted ESLint and TypeScript checking with incremental output disabled.

## 2026-10-16 — Consistent payment-record Grid/List control

- Added one shared compact segmented Grid/List control matching the approved design: View label, grid/list icons, rounded border, and dark navy active selection.
- Applied it consistently to Payment Voucher, Invoice Payment, Claim, Cash Advance, Travel Allowance, and Petty Cash record pages, including My Requests scope.
- The shared control includes pressed-state semantics and a visible keyboard focus treatment.
- Verification passed: targeted ESLint and TypeScript checking with incremental output disabled.

## 2026-10-16 — Consistent Approval and Processing Grid/List controls

- Extended the shared compact Grid/List segmented control beyond Payment Records into the approval and processing workspaces.
- Standardized Payment Voucher Approval/Finance/Manager queues plus Claim, Travel Allowance, Invoice Payment, Petty Cash, and Cash Advance Manager/Director/Finance queues.
- Removed the remaining unbordered two-button variants so these role-based screens now use the same View label, enclosing border, icons, and navy active state.
- Verification passed: targeted ESLint across all affected queues and TypeScript checking with incremental output disabled.

## 2026-10-16 — Compact Grid/List control sizing

- Reduced the shared Grid/List control height, internal padding, label spacing, font size, and button radius so it remains consistent but occupies less toolbar space across records, approvals, and processing pages.

## 2026-10-16 — Claim table amount width

- Claim approval and Finance/Director processing tables now give the amount column a 120px minimum width and prevent currency values from wrapping.
- Large MYR amounts remain on one line instead of splitting the decimal digits onto a second line.
- Verification passed: targeted ESLint and TypeScript checking with incremental output disabled.

## 2026-10-17 — Public Google Sheet receipt smart-chip links

- The shared Google Sheet endpoint now attempts to recover hyperlinks exposed by a publicly viewable sheet's HTML view, without requiring a Google API key; a configured Sheets API key remains the more reliable fallback for native chip metadata.
- Cash Advance Appendix A retrieval now consumes rich-link metadata instead of discarding it, stores the Drive URL plus the original PDF label, and renders the receipt as a clickable grey document chip in reconciliation review and records.
- Plain URLs continue to work unchanged. If Google exposes only a chip label and no hyperlink, Estuary preserves the label as a non-clickable document chip.
- Added parser regression coverage for resolving a smart-chip label to its Drive URL. Targeted ESLint and TypeScript checking passed; the targeted Vitest command could not load `vitest.config.ts` because the managed Windows sandbox denied traversal outside the live project directory.

## 2026-10-17 — Cash Advance Google Sheet request cleanup

- Tightened the Cash Advance Tab 1 parser so only positive expense rows containing Breakdown or Purpose are imported; TOTALS, signatures, bank metadata, and `For Finance Use Only / Verified by / Date` rows are excluded.
- Removed the cross-row metadata fallback that could incorrectly populate Contact or bank fields from unrelated cells. A blank sheet date is accepted because routing supplies the request date afterward.
- Simplified the retrieved preview to Breakdown request, Purpose, and Amount, with a separate calculated total below the table.
- Reworked routing into two columns: Manager and Director are side by side, Project occupies a full row, the duplicated Purpose field was removed, and extracted Account Holder, Bank Name, and Account Number remain available for confirmation.
- Added regression coverage for the problematic totals/Finance rows, blank date, and bank metadata. Targeted ESLint and TypeScript checking passed.

## 2026-10-17 — Claim purchase-date policy and Sheet total

- Applied one shared purchase-date policy to manual and Google Sheet claims, including server-side validation: Expense, Medical, PD, Tech, and Mileage claims accept submissions through day 30 and reject day 31 onward.
- Internet/Commute claims now require the purchase or bill date and claim date to be in the same calendar month.
- Google Sheet parsing now accepts day/month values without a year, such as `20/9`, using the current year rather than rejecting the row.
- Added a calculated `Total amount requested` summary below the retrieved Google Sheet claim table.
- Targeted ESLint and TypeScript checking passed. Focused Vitest coverage was added, but the managed Windows sandbox could not load `vitest.config.ts` because parent-directory traversal was denied.

## 2026-10-17 — Travel Allowance Sheet date and overall total

- Travel Allowance Google Sheet imports now explicitly accept day-month dates without a year, such as `19-Jan`.
- The parser uses the request date's year when available, so a 2026 request produces `2026-01-19`; otherwise it uses the current year.
- Added an `Overall total amount` summary below the retrieved Travel Allowance entries table.
- Added focused parser coverage for both request-year and current-year fallback behavior. Targeted ESLint and TypeScript checking passed; Vitest remained blocked by the managed Windows sandbox when loading `vitest.config.ts`.

## 2026-10-17 — Petty Cash advance and reconciliation workflow

- Changed Petty Cash below RM300 from reimbursement to an advance workflow. Initial requests no longer require receipt or invoice links in the form, API schema, shared validation, review screens, or Finance bulk processing.
- Made Director approval mandatory before Finance payment for Staff, Manager, Director, and Finance requesters. Staff and Finance may select an optional Manager reviewer; a Director requester must select another Director. Added the previously missing Director approval API route.
- Finance fund release now creates the Money Out transaction and moves the request to `PENDING_RECONCILIATION` instead of closing it.
- The original requester now owns reconciliation after payment, regardless of whether they are Staff, Manager, Director, or Finance. They submit mandatory purchase receipts, actual spending, an optional returned balance, proof when a balance is returned, or a required remark when no balance is returned. Actual spending plus returned balance must equal the released amount.
- Requester submission moves the request to `PENDING_FINANCE_RECONCILIATION`. Finance verifies the submitted evidence; final completion records any returned balance as Money In, updates the float balance, and closes the request as `RECONCILED`.
- Reconciliation amount controls are text inputs with decimal keyboard hints and `0.00` placeholders. The confirmation workflow stays on one desktop track, the secondary create-another button is white, and the Director detail includes the same action-plus-tracker rail used by the other request types.
- Updated confirmations, queues, status badges, Payment Records, and single/bulk Finance interfaces to reflect Director approval and two-stage reconciliation.
- Full-project ESLint and TypeScript checking passed. Focused policy coverage was added for receipt-free requests and mandatory Director routing.

## 2026-10-17 — Petty Cash reconciliation preview and shared pagination repair

- Added spacing between Petty Cash action-success banners and the detail card.
- Replaced Finance reconciliation receipt URLs with document cards that open PDFs and images in an in-page preview modal without navigating or refreshing.
- Rebuilt the Director Petty Cash queue to match the Manager workspace with summary cards, search, pending/approved/all filters, Grid/List views, and shared pagination.
- Fixed the shared pagination hook so render-created filtered arrays no longer reset the current page immediately after Next is clicked. The default page size is now 10 records across Payment Voucher and payment-request queues using this shared control.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-17 — Requester action-count refresh

- Added requester-owned Petty Cash reconciliation to the Payment Records attention total and Petty Cash type-card badge. A paid request in `PENDING_RECONCILIATION` counts as one action for its original requester and stops counting after submission to Finance.
- Kept action counting record-based so overlapping requester and role conditions do not duplicate the My Requests badge.
- Made sidebar action counts refresh on navigation, window focus, a shared action-change event, and a 15-second fallback interval. Petty Cash reconciliation submission emits the event immediately.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-17 — Dashboard redesign reverted

- Restored the original dashboard interface with four summary cards: Visible records, Need your action, In progress, and Completed.
- Removed the temporary prominent action row and five role-specific KPI layout at the user's request. Payment portfolio, Director/Finance expenditure analytics, and recent activity remain in their original positions.
- This reversal is limited to the dashboard redesign; the earlier requester action-count, Petty Cash, receipt-preview, Director queue, and pagination fixes remain in place.

## 2026-10-18 — Cash Advance Manager and Director loading interface

- Replaced the full-width `Loading Cash Advance…` notice in Manager and Director detail pages with the shared centered `PaymentPageState` used by Invoice and Travel.
- Both roles now show `Loading request`, `Reading the Cash Advance details…`, and a role-correct `Back to Cash Advances` link. Initial-load errors use the same consistent presentation.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-18 — Role-accurate dashboard action panel and drawer

- Implemented the approved Option C dashboard hierarchy with a prominent `Need your action` panel, payment-type action buttons, compact role-specific KPIs, and the existing payment portfolio below.
- Added a right-side action drawer. It shows up to ten oldest pending records for the selected payment type, links each record to its correct action/detail page, supports backdrop and Escape dismissal, and includes a role-aware `View all` queue link. It becomes full-width on mobile.
- Staff wording focuses on personal submissions, progress, completion, corrections, confirmations and reconciliation. Manager wording focuses on assigned review/preview work; Director wording focuses on approvals and exceptions; Finance wording focuses on verification, payment processing and final reconciliation.
- Tightened dashboard action eligibility using requester ownership, current assignee, approval membership and recorded previews. `RECONCILED` now counts as completed, and requester-owned Petty Cash actions route to Payment Records even when the requester is a Manager, Director or Finance user.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-18 — Dashboard drawer status colors and action-card sizing

- Changed dashboard action-drawer status badges from a single amber treatment to semantic colors shared with dashboard statuses: red for rejected/returned, amber for pending action, blue for active progress, green for completed, and grey for neutral states.
- Increased each payment-type action card to a 68px minimum height with more vertical spacing so the six-card action row is easier to scan and click.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-18 — Dashboard action-drawer direct routing

- Corrected dashboard action-drawer record links so role-owned tasks open directly in the appropriate Manager/Director approval or Finance processing page instead of detouring through Payment Records.
- Payment Records remains the destination only for requester-owned work such as drafts, corrections, confirmations, signed-PV uploads and reconciliation. This also handles Finance/Manager/Director users who submitted their own request without overriding their separate role action routes.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-18 — ARUS payment-type dashboard colors

- Applied the requested ARUS payment-type palette throughout the dashboard action cards, portfolio code badges and action-drawer header: Payment Voucher `#07456b`, Invoice Payment `#0c6f50`, Travel Allowance `#f29221`, Cash Advance `#db224a`, Claims `#000000`, and Petty Cash `#ffffff`.
- Petty Cash uses a dark outline and text so its white marker remains visible on white cards. Action cards use compact colored markers; portfolio and drawer codes use solid branded badges.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-18 — Payment Records ARUS category colors

- Extended the ARUS payment-type palette to the shared category cards used by both Payment Records and My Requests.
- Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance and Claims use their assigned solid colors; Petty Cash remains white with a dark outline and text for contrast.
- Full-project ESLint passed; TypeScript checking completed without reporting an error.

## 2026-10-18 — Expenditure graph ARUS colors

- Updated the dashboard expenditure legend and stacked monthly graph to use the same ARUS payment-type palette as the dashboard, Payment Records and My Requests.
- Petty Cash uses white with a dark inset outline so its legend marker and chart segments remain visible against light backgrounds.
- Dashboard ESLint and full TypeScript checking passed.

## 2026-10-18 — Director Administration workspace

- Added a restricted Administration workspace visible only in the Director sidebar for the current beta identity model. Direct navigation also checks the signed-in role and shows an access-required state to other users.
- Added programme CRUD with active/inactive state and Manager assignment, plus accounting-code CRUD with descriptions and active/inactive state.
- Connected active administrator-managed accounting codes to single and bulk Payment Vouchers, Claims, Cash Advance requests and Cash Advance reconciliation. Inactive codes are excluded from new selections while previously saved values remain intact.
- The beta implementation persists administration settings in browser storage. The access helper is intentionally isolated so the future Admin and IT roles can move to a dedicated `ADMIN_ACCESS` permission and database-backed API without redesigning the page.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-18 — Administration prototype alignment and claim entitlements

- Reworked Administration to match the approved directory prototype: full-width data tables, text-only search fields, status/role/manager filters, ten-row pagination and centered modal overlays for all Add/Edit actions.
- Added an Employees directory with role, programme, joining date and active status. Joining date supplies the source data required for employee-based claim proration.
- Added a Claim entitlements tab showing Medical and PD annual allowances (RM500 each by default), a proration setting, the proration rule, and each active employee's calculated annual entitlement.
- Administration data remains browser-local in the beta. Claim-policy storage and calculations are represented in the admin workspace; production enforcement still requires database-backed policy APIs and authenticated employee records.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-18 — Administration table and control refinement

- Removed the temporary New badges from the Employees and Claim entitlements tabs.
- Reduced the Administration directory primary-button and row-action sizing.
- Restyled Administration tables to match the Payment Voucher table system with an inset rounded wrapper, fixed layout, PV header typography, compact cell spacing, wrapping content and row hover feedback.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-18 — Administration typography and entitlement-table consistency

- Reduced typography and vertical spacing across the Administration header, tabs, notice, filters, directory headings, policy cards, tables and modal headings.
- Aligned the Claim entitlements employee table with the other Administration directories and added the same record-count footer treatment.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-18 — Administration modal checkbox spacing

- Standardized checkbox sizing, alignment and label spacing across Programme, Accounting Code, Employee and Claim Entitlement modal overlays.

## 2026-10-19 — Medical and PD annual entitlement enforcement

- Changed PD from a standalone RM500-per-claim ceiling to a cumulative RM500-per-employee calendar-year entitlement, parallel to Medical.
- Added employee joining-month proration for both Medical and PD; the joining month is included in the eligible-month calculation.
- Claim policy context now returns separate annual entitlements, used amounts and remaining balances. Draft, rejected and voided records are excluded by the repository query.
- Updated the Claim form policy bar to show used, prorated entitlement and remaining balance for both types.
- Submission is revalidated inside the database transaction using the same context, preventing form-only bypasses.
- Focused Claims policy tests passed (8/8); focused ESLint and full TypeScript checking passed.

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

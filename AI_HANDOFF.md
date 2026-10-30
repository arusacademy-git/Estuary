# AI_HANDOFF.md

## Project Handoff Baseline

- Project: Estuary
- Summary: The copy-ready request flows now include compact two-column Invoice Payment, Cash Advance, Claims, Petty Cash and Payment Voucher amendment review screens. Invoice Finance processing is stage-aware: payment information is verified first, transaction proof is uploaded second, and completion is explicit; intermediate Finance states remain visible in the combined queue and filters. The Finance sidebar count now loads actionable request sources directly in parallel. The Finance Payment Voucher signing/archive flow remains stage-aware. Claims and Petty Cash preserve decimal entry, and Invoice Payment, Cash Advance, Petty Cash and Claims accept signed-in Staff, Manager, Director and Finance requesters. Returned Payment Vouchers can be amended and resubmitted without changing their PV number, including legacy account-code snapshots. Live-project copying and end-to-end verification remain external to this manual scaffold.
- Current Holder: GitHub issue/branch owner (non-exclusive project model)
- Actor Model: OpenAI Codex
- Assigned Agent:
- Skill Loadout:
- Governance Profile:
- Cast ID:
- Homunculus Memo Path:
- Current Branch: agent/reduce-beta-sidebar-traffic
- Last Updated: 2026-10-30
- Session Status: ACTIVE
- Lock Status: RELEASED / non-blocking compatibility record
- Session Started: 2026-08-12T16:52:22+08:00
- Baseline: full verification chain re-run and passing on 2026-07-06 (see Verification)
- Next Assignee Start Point: run `corepack pnpm install`, then `corepack pnpm lint`, `corepack pnpm test`, and `$env:E2E_PORT='3131'; $env:CI='1'; corepack pnpm test:e2e` before new feature work.
- GitHub publishing setup: origin targets `arusacademy-git/Estuary`; GitHub CLI is installed and authenticated as `afiq-work`.
- OQ-PettyCashConfirm: Petty Cash model not confirmed. Blocks Phase 5 only.
- OQ-5: SQL Account CSV sample needed before Phase 6 export build. Blocks Phase 6 only.
- Real Google OAuth / AWS creds are still absent, so auth and integration work remains local or stubbed for now.
- OQ-LocalPostgres: Docker Desktop is not installed on this machine, so `compose.yaml` cannot supply the local Postgres. The initial migration is authored and verified (see changelog); applying it to a persistent local database needs Afiq's call on Docker Desktop vs a native/embedded dev Postgres.
- Port 3000 is often held by the Layar project's Next server on this machine; use `E2E_PORT` (e.g. 3131) for Playwright runs.
- Email delivery is still file-backed only; SMTP handoff is intentionally unwired for now.
- Receipt handling is link/reference-based only; actual upload storage is still future work.
- Real auth/session binding is still absent, so API endpoints trust caller-provided `actorId` in payloads (acceptable for local MVP, not acceptable for production).
- Local JSON repositories are still file-write based with no locking/transaction guarantees under concurrent writes.
- Next.js (TypeScript, App Router) + PostgreSQL (RDS target) + Prisma + NextAuth + AWS SES + S3 + Docker + Lightsail
- Multi-entity from day one: Organization is the top-level partition; SSO with org switcher.
- API-first: every action addressable as REST `/api/v1/`.

## Current Session Log — 2026-10-30

- Penang performance check: the finance dashboard loaded in roughly 0.6 seconds over NetBird and 2.5–3.5 seconds through the temporary Cloudflare tunnel. The server itself was lightly loaded. Browser inspection found the finance sidebar fetching six full payment lists every 15 seconds and Next.js prefetching many unopened destinations through the tunnel. Issue #86 tracks a 60-second visible-tab polling interval and disabled dashboard, sidebar, and header route prefetch; action-count events and tab focus still trigger refreshes. Local production browser test reduced dashboard prefetch requests from 15 to 0; eight initial Finance API reads remain. Lint, TypeScript check, and production build passed. The change awaits GitHub publishing and Penang deployment before live speed can be retested.
- Penang remains on commit `61eb398`. GitHub `main` advanced to `a518ce6`, but local release checks found a missing shared bulk stylesheet and 15 failing tests. Deployment was held before changing the server.
- Restored the shared bulk stylesheet used by still-active pages. Reinstated documented Claim purchase-date and smart-chip reference parsing, accepted account-code-only Cash Advance sheet cells by mapping them to the canonical account option, and updated tests for the intentional Claims/Petty Cash approval workflow changes.
- Full suite: 69/69 tests passed. Production build passed after clearing stale generated development route types. Lint passed with no errors; the remaining unused-parameter warning was removed in this branch. GitHub issue #84 tracks the release fix.

## Previous Session Log — 2026-10-29

- Repaired the three reported compile failures:
  - Payment Voucher Finance information now derives its payment reference from the stored PV number instead of accepting an optional client value that conflicts with the repository contract.
  - The legacy Finance bulk Invoice branch now uses the staged `processInvoicePaymentByFinance(id, financeId, paymentDate, paymentReference)` action instead of calling the two-argument completion action with three arguments.
  - Cash Advance `parseSummary` is exported and supports Google Drive smart-chip labels, resolved public URLs and normalized dash variants; a three-case unit-test copy is included.
- Rebuilt the returned Payment Voucher amendment review into the approved compact two-column hierarchy. Corrected request details, recipient information, payment information, breakdown and documents remain on the left. Voucher total, amount in words, assigned Director, amendment note and resubmission actions remain visible in the right rail.
- Fixed the returned-PV resubmission failure for legacy account codes such as `917-000`. Initial creation already permits a missing optional GL relation while preserving the displayed account code in the immutable snapshot; resubmission now follows the same rule instead of throwing `GL account ... was not found for this organization.`
- Preserved the important amendment guards: only a rejected PV can be amended, the original requester and organization cannot change, the assigned Director must remain valid, and the existing PV number is reused.
- Updated the primary continuity file after each meaningful fix. Copy-ready files remain under `generated`; the separate live Next.js project must receive those copies before its complete verification chain can validate them.

## Verification

- 2026-10-29 Payment Voucher amendment review and resubmission:
  - Focused `generated/tsconfig.pv-database.json` TypeScript check -> pass
  - ESLint for Payment Voucher review, Prisma repository, resubmit route and create flow -> pass
- 2026-10-29 three-file compile cleanup:
  - Focused `generated/tsconfig.cash-advance.json` TypeScript check -> pass
  - Focused `generated/tsconfig.pv-database.json` TypeScript check -> pass
  - Live-project ESLint before preparing the copy-ready corrections -> pass
  - Full live-project typecheck must be rerun after copying the staged files and applying `generated/FINANCE_BULK_TYPECHECK_FIX.md`
- 2026-10-29 Finance queue and Invoice Payment stage repair:
  - `generated/tsconfig.invoice-payment.json` -> pass
  - `generated/tsconfig.sidebar.json` -> pass
  - `generated/tsconfig.finance-database.json` -> pass
- 2026-10-29 requester review repairs:
  - `generated/tsconfig.invoice-payment.json` -> pass
  - `generated/tsconfig.cash-advance.json` -> pass
  - `generated/tsconfig.claims.json` -> pass
  - `generated/tsconfig.petty-cash.json` -> pass
- 2026-10-21 SQL entry tracking schema:
  - `prisma validate` -> pass
  - Prisma schema diff -> exactly matches `20261020090000_add_sql_entry_tracking/migration.sql`
  - full `prisma migrate deploy` chain against disposable PostgreSQL 18.4 -> pass
  - Prisma Client generation -> pass
  - ESLint -> pass
  - TypeScript typecheck -> pass
  - Vitest -> pass (`16 files`, `46 tests`)
- 2026-10-10 Finance request bulk processing:
  - historical verification marker retained; consult the corresponding timeline entry before claiming a current full-project pass

## 2026-10-29 — Finance queue and Invoice Payment stage repair

- Split Invoice Payment Finance work into three persisted states instead of completing everything atomically: `PENDING_FINANCE_REVIEW → PAYMENT_PROCESSED → TRANSACTION_PROOF_UPLOADED → COMPLETED`.
- Finance now verifies the auto-filled payment reference and date first, uploads the transaction receipt/proof in the next stage, and explicitly marks the record complete only after the proof exists.
- Updated the Invoice repository mapping so payment date/reference are read from the payment transition and proof is read from the proof-upload transition.
- Kept Invoice Payment records visible in the combined Finance queue while they are pending verification, payment processed, or proof uploaded. Travel Allowance, Cash Advance and Petty Cash queue filters also retain their transaction-proof-uploaded state.
- Added immediate queue and sidebar-count refresh events after Invoice Finance actions so records move between filters without disappearing or waiting for the polling interval.
- Fixed the broken Invoice Finance controls by applying consistent CSS to date, file and read-only payment-reference fields, plus recorded-payment and proof-preview surfaces.
- Optimized the Finance sidebar count path: it now skips unrelated dashboard and manual-draft requests and loads the six Finance sources in one parallel request group. Counts use the same actionable status sets as the combined queue.
- Verification: `generated/tsconfig.invoice-payment.json`, `generated/tsconfig.sidebar.json`, and `generated/tsconfig.finance-database.json` pass TypeScript.

## 2026-10-29 — Travel Allowance approval amount repair

- Fixed the combined Manager Pending Approvals Travel Allowance review so every breakdown row uses the canonical `travelLineTotal()` calculation (meal rates plus special allowance) instead of omitting the amount.
- Fixed the combined Director Pending Approvals Travel Allowance review so ordinary meal requests no longer display `RM 0.00`; the previous mapping incorrectly used only `specialAllowance`.
- Director Travel Allowance details now group repeated lines by employee, merge distinct travel dates into a first-to-last date range, combine project/reason/meal context, show the number of underlying entries, and display the employee subtotal.
- Changed the manual Travel Allowance `Special allowance (RM)` control from a browser spinner number field to a decimal text field with a `0.00` placeholder. It accepts at most two decimal places while continuing to store a non-negative numeric value in the request model.
- The request overview continues to show the complete Travel Allowance grand total from the persisted record.
- Verification: `generated/tsconfig.manager-ui.json` passes TypeScript. The broader Travel Allowance config reaches unrelated pre-existing errors in the Google Sheet route (`exceljs` unavailable in this manual scaffold) and the legacy finance-complete copy file; no new error was reported for the changed approval components.

## 2026-10-29 — Payment Voucher Finance signing and archive flow

- Kept Payment Voucher ownership inside `payment-voucher/components/finance/finance-payment-panel.tsx`; the combined Finance Pending Processing queue only imports `FinanceProcessingPanel` from that file. Removed the redundant `finance-processing-panel.tsx`/CSS pair from the copy-ready tree.
- Corrected the unified Finance Pending Processing PV overlay so `Generate PV` is shown only for `APPROVED_FOR_PAYMENT` and `FINANCE_PROCESSING`.
- The signing stages are now read-only for Finance and explain whether the external recipient must sign or the original requester must verify the signed PV.
- `PENDING_FINANCE_VERIFICATION` now displays signed-PV metadata and a signed-PV download action, requires a PDF/JPG/PNG transaction proof (maximum 10 MB), and requires an explicit archive/lock confirmation.
- `Archive and complete PV` stores the transaction-proof filename, calls the existing Finance completion endpoint, notifies the requester and explains that the completed record is available in Payment Records.
- Finance can return an invalid signed PV with mandatory correction remarks. Existing bank-rejection behavior remains on the initial generation stage.
- The signed-PV filename in final Finance verification is a blue document chip. It opens the stored signed PDF URL in a new tab, while the separate Download signed PV action remains available.
- Fixed the final Finance archive guard: `PENDING_FINANCE_VERIFICATION` may now append transaction-proof metadata and remarks without reopening or modifying the locked payment date/reference. Both Prisma and local fallback repositories require proof before completion.
- Recipient reference now follows the assigned PV number for new, amended and mapped historical records. Finance can preview both uploaded and digitally generated signed PDFs by clicking the filename chip; archival confirmation remains disabled until that preview succeeds.
- Intended workflow: `Finance generates PV and payment reference → requester sends PV externally → external recipient signs → original requester verifies and returns it → Finance downloads/verifies signed PV and uploads transaction proof → Finance completes, archives and locks the PV`.
- MCP server layer: built alongside each phase (not a final phase).
- Docker from day one: Lightsail -> ECS with no code changes when commercializing.
- Everyone can submit.
- Submitter selects the approver from the live staff directory.
- Same-person manager/director is allowed.
- Finance admin can override anything.
- If manager approval is blocked, director approval can stand as the fallback.
- Director submitter behavior is toggleable: auto pass-through or require another director.
- Urgent bypass is allowed, but still requires director approval and stays visibly flagged for finance.
- Recipient reminder loop can continue indefinitely; rejected signed PVs return to pending signature.
- Document retention can be treated as permanent.
- Do not hardcode workflow copy, email wording, or theme direction into rigid code paths.
- Reference data, placeholders, and policy surfaces should remain easy to change.
- The POC should prove architecture and control surfaces, but it must still feel like a real product surface in the browser rather than an internal config sandbox.

### Testing Tracker Update (2026-10-29)

- Updated workbook: `outputs/estuary-testing-tracker/Estuary_Testing_Tracker_Updated.xlsx`.
- Added explicit numbered test steps and measurable expected results for every functional test case.
- Functional coverage now contains 128 tests: Payment Voucher 27, Invoice Payment 18, Travel Allowance 19, Cash Advance 25, Petty Cash 19, and Claims 20.
- Added the multiple-Payment-Voucher manual-entry flow to the Payment Voucher tab. The new cases cover building several independent vouchers in one session, saving and restoring the correct multiple-entry draft mode, validating each voucher during review, and submitting separate PV workflow records for Staff, Manager and Finance requesters.
- Added a dedicated `Non-Functional` tab with 24 cases covering performance, page/modal load time, larger data volumes, reliability, security, accessibility, responsive layout, browser compatibility, uploads, observability, concurrency, scalability, and privacy.
- Updated the Overview formulas and totals, preserved the Bug Log, and retained status/severity dropdowns and conditional formatting.
- Verification: recalculated and exported the workbook, confirmed the Payment Voucher total of 27 and Overview total of 128 functional tests, scanned formulas with zero formula errors, and visually reviewed the updated Payment Voucher sheet.
- Travel Allowance clarification: only Managers may create Travel Allowance requests. The tracker now uses Manager for every requester/form case, covers both single-employee and multi-employee submission, and contains no Staff requester role for Travel Allowance.
- Requester-role coverage is split into separate test rows for easier defect tracking. Payment Voucher covers Staff, Manager and Finance requesters. Invoice Payment, Cash Advance, Petty Cash and Claims cover Staff, Manager, Director and Finance requesters. Claims requester cases explicitly verify direct routing to Finance Verifying.

### Request Review And Requester Access Update (2026-10-29)

- Rebuilt the Invoice Payment pre-submission review as a compact two-column surface: request, payment and document details remain on the left; the requested amount, next-step explanation and submission actions are on the right.
- Rebuilt the Cash Advance review with the same hierarchy: request, approval, payment account and line items on the left; total, signature declaration, confirmation and actions on the right.
- Removed stale Staff-only client validation from Invoice Payment and Cash Advance. The Cash Advance database path now accepts any active organization member while still requiring the active signature and configured approvers.
- Added requester-role data to new Invoice Payment and Cash Advance submissions. Petty Cash and Claims already persist the signed-in requester role; Petty Cash now explicitly validates the Director requester path.
- Verification in this scaffold: `tsconfig.invoice-payment.json` passed and `tsconfig.cash-advance.json` passed. This workspace remains copy-ready only; no browser or database end-to-end run was available here.
- Follow-up CSS Module repair: replaced the pure `dt` and `dd` selectors in `invoice-payment-review.module.css` with `.grid dt`, `.terms dt`, `.grid dd` and `.terms dd`. The Invoice Payment TypeScript check still passes and the stylesheet no longer contains those pure selectors.

### Claims And Petty Cash Review Repair (2026-10-29)

- Rebuilt the Claims and Petty Cash pre-submission reviews as compact two-column cards matching the approved prototype hierarchy. Request summaries and line-item tables are on the left; totals, workflow guidance and actions remain visible on the right.
- Replaced immediate numeric coercion in Claims amount/mileage and Petty Cash amount inputs with decimal text controls. Intermediate decimal input such as `35.` is preserved while typing, so `35.50` no longer collapses into `3550`.
- Refined the Petty Cash policy total: the neutral total bar remains unchanged when the RM300 limit is exceeded, only the monetary total becomes red, and the misleading green success check was removed.
- Removed synchronous state updates from the Claims and Petty Cash decimal-control effects. Decimal text remains locally controlled without triggering the `react-hooks/set-state-in-effect` ESLint rule.
- Aligned the Petty Cash API schema with the visible form and domain policy: requester position and the legacy hidden supplier field are no longer mandatory. Required contact, routing, expense details, account, division, amount and role-aware approver checks remain enforced.
- Confirmed the existing requester routing accepts Staff, Manager, Director and Finance for both Claims and Petty Cash. Petty Cash continues to require an independent reviewer when submitted by Finance.
- Verification in this copy-ready scaffold: `tsconfig.claims.json` passed and `tsconfig.petty-cash.json` passed. Browser submission and database verification remain for the live Next.js project after copying.

### Payment Voucher Inline Identity Validation (2026-10-29)

- Moved single-PV IC/identity and bank-account validation messages from the page alert to the corresponding fields. Invalid controls now receive `aria-invalid`, a red border and an accessible inline error message.
- Applied the same field-level treatment to every manually entered voucher in the multiple-PV accordion. Identity/account errors are removed from the general voucher error list so they are not duplicated above or below the form.
- General validation and submission failures remain in their existing page/card notices because they cannot be assigned to one identity field.
- Updated the external recipient Payment Voucher action label from `Download PDF` to `Download PV`; its existing download behavior is unchanged.

### Baseline Files and Routes

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

## Current State — 2026-10-28 drafts inside payment-type records

- Fixed missing owner drafts caused by depending on the optional `?scope=mine` query string. Payment Voucher, Invoice Payment, Cash Advance and Petty Cash now load the signed-in requester's Prisma draft on their payment-type record pages even when that query string is absent. Travel Allowance uses the same robust behavior when a Manager has a draft.
- Confirmed the live draft API currently returns the requester's four saved drafts: Payment Voucher, Invoice Payment, Cash Advance and Petty Cash.
- Removed the separate yellow `Saved drafts` section from the My Requests landing page.
- Prisma-backed manual drafts now appear inside their corresponding Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance or Petty Cash record list, matching the existing Claim draft experience.
- The existing Status filter shows these records for `All statuses` or `Draft`; Search, Month and Exact date filters also apply to drafts.
- List view uses one combined table and one header for draft and submitted records across Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance and Petty Cash; no second draft table is rendered.
- Grid view now places draft cards in the same two-column grid as submitted cards, with matching card sizing. Invoice, Travel Allowance, Cash Advance and Petty Cash use four desktop summary cards in one row, and draft action cells prevent `Continue draft` from wrapping or overlapping.
- Fixed the Payment Voucher grid wrapper so its draft card is a direct child of the same two-column grid as submitted PV cards; it no longer expands across the full records container.
- Standardized draft-card hierarchy across Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance and Petty Cash: pending reference/status header, payment-type title and explanation, a shaded Updated/Status details panel, and a bottom-aligned Continue draft action.
- The shared Continue draft action is now right-aligned and uses a smaller font across all five payment types. Draft list timestamps consistently show the date on the first line and time beneath it, matching the Payment Voucher list hierarchy.
- Invoice, Travel Allowance, Cash Advance and Petty Cash list tables now use the available card width with fixed-layout columns, wrapping content where necessary instead of forcing desktop horizontal scrolling. Draft action cells were narrowed so Continue draft fits within the table.
- Matched the non-PV action columns to the organized Payment Voucher table: Invoice, Travel Allowance, Cash Advance and Petty Cash now reserve 150px for the final action, keep its horizontal padding inside that width and constrain both Continue draft and submitted-record buttons to the cell so they cannot clip at the right border.
- Payment Records status badges for Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance and Petty Cash now keep all label text inside a fully rounded pill, including long Finance and approval labels.
- Payment Voucher Continue draft links now include an explicit draft mode. Single-form snapshots open `/beta/payment-vouchers/new?draft=1&mode=single` directly in the restored single editor; snapshots carrying bulk/manual rows or a spreadsheet/manual entry mode open the multiple-PV workspace instead. Existing submitted bulk draft records remain separate Payment Voucher records and continue through their record-specific links.
- Separated fresh requests from draft continuation across all manual forms. Ordinary `/new` routes no longer auto-restore a saved Prisma draft, so a requester can keep one draft and start/submit a separate clean request. Continue draft links now carry `?draft=1`; only that explicit route restores the snapshot. A fresh request does not receive the existing draft ID, so submitting it does not delete the retained draft.
- Draft rows/cards show `Continue draft` and return the requester to the correct form. Manager Travel Allowance drafts retain their Manager-specific form route.
- Per-type visible-record, draft and attention totals include the saved draft. Empty and pagination states no longer conflict when a filtered result contains only a draft.
- Claims were not changed because Claim drafts are already stored and displayed as native Claim records.
- Copy manifest: `generated/PAYMENT_TYPE_DRAFT_RECORDS_COPY_FILES.md`.
- Verification: focused TypeScript and ESLint checks pass.

## Current State — 2026-10-28 Cash Advance bank options

- Replaced both Cash Advance Bank name free-text fields with a standardized dropdown sourced from `shared/constants/payment-options.ts` via `BANK_NAME_SELECT_OPTIONS`.
- Existing records, restored Prisma drafts and Google Sheet values are normalized case-insensitively to the shared bank option value, so legacy values such as `Maybank` restore as `MAYBANK` instead of appearing blank.
- The dropdown is applied consistently to the manual form and the Google Sheet review/edit state.

## Current State — 2026-10-28 amount input presentation

- Claims Amount (RM) and Petty Cash Estimated amount (RM) now use decimal text inputs instead of browser number controls.
- Both fields display the `0.00` placeholder, retain numeric conversion for existing totals/validation, and use `inputMode="decimal"` to show an appropriate mobile keyboard without spinner arrows.
- The Claims mileage kilometre field follows the same spinner-free decimal text-input pattern and displays the `0.1` placeholder while retaining the existing mileage calculation.

## Current State — 2026-10-28 Finance pending-count synchronization

- Fixed the stale Finance `Pending Processing` sidebar badge and `Waiting for Finance` hero total.
- Both totals now use the same live queue rules as the six tabs: Payment Voucher, Petty Cash, Invoice Payment, Travel Allowance, Cash Advance and Claims.
- The displayed total is the sum of the visible per-type tab counts; for the reported data this is `5 + 3 + 1 + 2 + 1 + 53 = 65`, rather than the stale dashboard-summary value of `44`.
- The hero count remains a placeholder until both Payment Voucher and non-PV requests finish loading, avoiding a temporary partial count.
- Copy manifest: `generated/FINANCE_PENDING_COUNT_SYNC_COPY_FILES.md`.

## Current State — 2026-10-28 Finance actions from Payment Records

- Finance users now receive the shared yellow `Action required` card in Payment Records whenever the current status belongs to Finance.
- Added the missing Payment Voucher integration and recognized `FINANCE_PROCESSING` as Finance-owned work.
- The `Pending Processing` button routes with `type` and `request` query parameters; the combined Finance queue automatically selects the correct payment type and opens the specific record overlay.
- Completed records and records owned by another role do not show the Finance action card.
- Copy manifest: `generated/FINANCE_PAYMENT_RECORD_ACTION_COPY_FILES.md`.
- Verification: focused Payment Records TypeScript check passes.

## Current State — 2026-10-28 Google Drive receipt chips

- Standardized Claim and Cash Advance reconciliation receipt references with the shared `DocumentReferenceChip` UI.
- Google Sheets import accepts both plain Google Drive URLs and converted smart chips.
- For smart chips, the visible chip text is preserved while clicking opens the resolved underlying Google Drive URL; plain URLs remain valid and clickable.
- Uploaded Claim receipt documents also use the same chip presentation with their filename.
- Copy manifest: `generated/GOOGLE_DRIVE_RECEIPT_CHIP_COPY_FILES.md`.
- Verification: focused Cash Advance and Claims TypeScript checks both pass.

## Current State — 2026-10-28 Payment Records status layout

- Removed status-dot bullets from Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance, Claims and Petty Cash Payment Records list badges.
- Reserved independent status and action column widths, constrained long badges to their own cells and enabled horizontal table overflow where necessary.
- This prevents long status labels from overlapping or being hidden underneath `View record`, `Open action` or equivalent action buttons.
- Copy manifest: `generated/PAYMENT_RECORD_STATUS_LAYOUT_COPY_FILES.md`.

## Current State — 2026-10-28 Cash Advance typecheck synchronization

- Fixed the 25 reported TypeScript errors across the legacy bulk components and Cash Advance UI by synchronizing the shared domain/API contracts.
- Restored typed compatibility fields for Cash Advance account codes, reconciliation receipt labels, requester role and optional Manager preview timestamp.
- Added Travel Allowance supporting-document links and approval-only query typing for Invoice Payment and Travel Allowance.
- Added safe legacy Finance bulk guards: Invoice Payment, Travel Allowance and Cash Advance cannot be completed without the required transaction proof and direct users to the combined Finance Pending Processing queue.
- Copy manifest: `generated/CASH_ADVANCE_TYPECHECK_FIX_COPY_FILES.md`.
- Verification: the exact live source tree was typechecked using path overrides to these five corrected files; TypeScript completed with zero errors.

## Current State — 2026-10-28 non-PV confirmation trackers

- Standardized the requester submission confirmation card to a white background for Invoice Payment, Travel Allowance, Cash Advance, Petty Cash and Claims; Payment Voucher is intentionally unchanged.
- Updated each confirmation workflow tracker to show `Payment transaction proof uploaded` before final completion or reconciliation.
- Cash Advance now shows proof upload before reconciliation; Petty Cash shows proof upload, requester reconciliation and Finance completion as separate stages.
- Copy manifest: `generated/NON_PV_CONFIRMATION_TRACKING_COPY_FILES.md`.
- Verification was limited to source inspection because this manual scaffold has no dependency manifest or runnable lint/typecheck command.

## Current State — 2026-10-28 Cash Advance reconciliation drafts

- Added a Prisma-backed `Save as draft` action to Cash Advance reconciliation, using `SAVE_RECONCILIATION_DRAFT` transition metadata on the specific Cash Advance submission.
- Only the latest draft is retained per request, it restores when reconciliation is reopened, and it is removed when the requester submits reconciliation to Finance.
- Draft reconciliation content is excluded from submitted-detail, progress and PDF-form displays.
- Restyled the requester reconciliation `Action required` card in yellow and changed `Start reconciliation` to a white button.
- Copy manifest: `generated/CASH_ADVANCE_RECONCILIATION_DRAFT_COPY_FILES.md`.
- Verification was limited to source and route inspection because this manual scaffold has no dependency manifest or runnable lint/typecheck command.

## Current State — 2026-10-28 Claims proof-upload and completion split

- Claims retain their agreed routing for every requester role: submission goes directly to Finance verification, then to the assigned Director for approval/rejection, then back to Finance for payment.
- Separated `Payment transaction proof has been uploaded` from final `Completed` in the Claim workflow and requester-visible progress tracker.
- Changed the requester confirmation and six-stage tracking card to a consistent white background.
- Removed the obsolete shared role queue component from the generated copy and redirected the legacy Director/Finance Claims index routes to `?type=CL` in their combined queues.
- Uploading Finance transaction proof now records an `UPLOAD_TRANSACTION_PROOF` transition to `TRANSACTION_PROOF_UPLOADED`, followed by a `COMPLETE` transition to `COMPLETED`.
- Existing closed Claims carrying the former terminal `TRANSACTION_PROOF_UPLOADED` state are normalized as completed for backward compatibility.
- Updated Claim queue processed counts, Payment Records completion/download logic, status styling and SQL Entry Tracker completion filtering.
- Copy manifest: `generated/CLAIMS_TRANSACTION_PROOF_WORKFLOW_COPY_FILES.md`.
- Verification was limited to source and call-path inspection because this manual scaffold has no dependency manifest or runnable lint/typecheck command.

## Current State — 2026-10-28 Transaction-proof workflow milestone

- Added the standardized `TRANSACTION_PROOF_UPLOADED` status compatibility to Invoice Payment, Travel Allowance, Cash Advance and Petty Cash.
- Invoice Payment, Travel Allowance and Cash Advance Finance actions now require a PDF/JPG/PNG transaction proof, persist it in workflow transition metadata and record the standardized proof-upload transition before the next/final state.
- Petty Cash reuses its existing mandatory Finance payment-receipt upload and `FINANCE_VERIFIED` workflow state for this milestone; no duplicate upload control was added.
- Added `Payment transaction proof uploaded` immediately before final completion in requester-visible Payment Records progress trackers.
- Cash Advance places the milestone after Finance Payment and before Reconciliation. Petty Cash maps its existing `FINANCE_VERIFIED` stage to the proof-upload milestone before reconciliation.
- Updated status badge styling and role-action detection for the new stage.
- Claims and Payment Voucher were deliberately left unchanged for the later Claims workflow revision and the existing PV-specific flow.
- Copy manifest: `generated/TRANSACTION_PROOF_WORKFLOW_COPY_FILES.md`.
- Source inspection confirmed the updated API call signatures and Finance UI call sites. Full lint/typecheck verification is unavailable because this manual scaffold has no dependency manifest or runnable verification command.

## Current State — 2026-10-28 Payment Records role action routing

- Added a shared, role-aware Payment Records action card under `generated/src/features/payment-records/components/shared`.
- Integrated it into Invoice Payment, Travel Allowance, Cash Advance, Claim and Petty Cash record detail views.
- The card appears only when the signed-in Manager, Director or Finance user owns the record's current pending stage. Completed and non-owned stages remain informational and show no action card.
- Manager and Director assignment IDs are respected. Finance actions are limited to standardized Finance workflow statuses.
- Each CTA deep-links to the relevant combined queue and auto-opens the matching request using `?type=...&request=...`.
- Existing requester correction/reconciliation actions remain intact.
- Payment Voucher retains its existing direct role-action panels because its record detail is served by the separate Payment Voucher detail workflow.
- Copy manifest: `generated/PAYMENT_RECORD_ACTION_CARD_COPY_FILES.md`.
- Verification in this manual scaffold was limited to source inspection and route/query consistency; this workspace has no dependency manifest or runnable typecheck/lint command.

## Current State — 2026-10-27 (Latest Session)

### Draft action styling and Cash Advance form hierarchy

- Standardized the manual-form draft action rows across Payment Voucher,
  Invoice Payment, Travel Allowance, Cash Advance, Petty Cash and Claims.
- `Save as draft` now uses a white background, bordered secondary treatment and
  no shadow; action rows use a visible 12px gap before the primary Continue
  button.
- Cash Advance now follows the Travel Allowance page hierarchy: request title
  and description first, Manual form / Google Sheet link tabs second, and the
  selected form content below.
- The Cash Advance heading is now presented directly on the page, matching the
  simpler Claims composition. The separate hero-card border/background and
  form-card shadow were removed so the page reads as one main form surface with
  section dividers instead of stacked cards.
- Cash Advance Director approver fields now span the full form width in manual
  and Google Sheet-assisted entry. The form-specific draft action keeps a white
  background even against later compact-form CSS overrides.
- Payment Voucher manual-form footer buttons now use smaller 12px typography,
  reduced padding and a 40px minimum height.
- Cash Advance required fields now show red asterisks. Claims contact and final
  approving Director now share one row and show red required markers. Petty
  Cash's Staff manager reviewer spans the full form width, while Travel
  Allowance manager reviewer and Project Director share one row.
- Copy the updated Cash Advance form plus the affected payment-type CSS modules.

### Cash Advance review prop alignment

- Fixed the Cash Advance form's review component call to pass
  `requesterName` instead of the removed `staffName` prop, matching the current
  `CashAdvanceReview` interface and resolving TS2322.
- Copy the updated Cash Advance Staff form.

### Prisma draft reminders in My Requests

- Generic Prisma-backed drafts now increase the requester's `My Requests`
  sidebar badge immediately after Save as draft; deleting the draft after final
  submission refreshes and reduces the count.
- The My Requests landing page now contains a Saved drafts panel with payment
  type, last-saved time and a direct Continue draft link. Drafts are also
  included in personal payment-type totals and attention counts.
- Claims continue to use their existing Submission-backed Draft records and are
  not duplicated in the generic draft count.
- The manual-drafts GET endpoint can now list every generic draft for one
  organization/requester while retaining the existing single-type restore mode.
- Copy the updated manual draft API/repository/hook, sidebar action-count source,
  My Requests page and Payment Records CSS listed in the manual draft guide.
- The current live-owned single Payment Voucher form and create flow were copied
  into the generated package and integrated with the shared Prisma draft hook.
  Payment Voucher text fields and voucher lines restore from the draft; browser
  file inputs must be reselected. The create flow deletes the draft only after
  final submission succeeds, not when entering preview.

### Cash Advance reconciliation entry choice

- Added a centered `OR` divider between the manual Summary of Cash Spent table
  and the Appendix A Google Sheet retrieval panel.
- The divider communicates that requesters may either enter reconciliation
  expenses manually or retrieve them from the sheet; the retrieved rows replace
  the current manual expense rows through the existing Apply action.
- Copy the updated Cash Advance reconciliation component and shared Cash Advance
  CSS file.

### Payment Voucher Google Sheet progressive action

- The bulk Payment Voucher `Continue to preview` action is now hidden while no
  validated sheet data is loaded.
- It appears only after `Load Google Sheet` successfully returns and produces at
  least one parsed Payment Voucher row. Editing the URL clears the loaded rows
  and hides the action again, preventing requesters from advancing with stale
  sheet data.
- Copy `generated/bulk-csv-upload-panel.tsx` to the live Payment Voucher bulk
  component path.

### Claims Google Sheet layout refinement

- Moved the Manual form / Google Sheet link selector below the New Claim Request
  title and description so the page hierarchy matches the Payment Voucher entry
  interface.
- Changed only Google Sheet Step 2 (Paste the matching completed sheet) to a
  white background while preserving its border, spacing and numbered badge.
- Copy the updated `claim-form.tsx`, `claim-google-sheet.tsx` and
  `claims.module.css` files from the generated Claims component folder.

### Manual payment-request Save as draft package

- Added `generated/MANUAL_FORM_DRAFT_COPY_FILES.md`, a reusable `use-manual-form-draft.ts` hook, a manual-draft API/repository and a dedicated Prisma model/migration.
- Invoice Payment, Travel Allowance, Cash Advance and Petty Cash now show `Save as draft` beside `Continue to review`, restore requester/type-scoped drafts from PostgreSQL and clear them only after successful submission.
- Petty Cash and Claims now have an explicit review step before final submission. Claims continue using the existing database-backed Claim draft API.
- The initial browser-local implementation was replaced after confirming that drafts must work through Prisma. The new `PaymentRequestDraft` model stores incomplete JSON snapshots outside `Submission`, preventing drafts from entering approval queues or breaking type-specific queue mappers.
- The included `20261027_payment_request_drafts` migration creates one draft per organization, requester and payment type. Afiq or another authorized database operator must deploy it and regenerate Prisma Client; no migration was executed from this manual workspace.
- The generated scaffold does not contain the live Payment Voucher manual form. The copy guide includes the exact shared-hook integration pattern, but the live Payment Voucher form still requires a targeted edit before this behavior is complete across all six types.
- Claims remain on their existing Prisma draft path rather than duplicating data in the generic table. Full live-project Prisma generation, typecheck, lint and browser/database testing remain required after copying.

### Administration database change request for the authorized DBA

- Added `generated/ADMINISTRATION_PRISMA_DATABASE_CHANGE_REQUEST.md` as the detailed handoff for Afiq or another authorized database administrator.
- The document separates Prisma model additions, the SQL migration, initial claim-policy seeding, existing employee/programme/accounting-code mapping, administrator authorization, deployment order, read-only validation queries and required deployment evidence.
- It makes clear that only `admin_claim_policies` is a new table; employee, programme and accounting data continue to use the existing `User`/membership/role, `Project` and `GlAccount` models.
- No migration was run from this workspace and no database data was changed.

### Estuary testing tracker workbook

- Created `outputs/estuary-testing-tracker/Estuary_Testing_Tracker.xlsx` as the project-specific manual QA tracker.
- The workbook contains 125 test cases across authentication, authorization, combined role navigation and deep links, Manager/Director/Finance overlays, all six payment types, Claims workflow, Payment Voucher proof and bank-rejection handling, Petty Cash reconciliation, Travel Allowance multi-employee rules, records, requests, Prisma-backed Administration, notifications, documents, responsive UI, accessibility, performance, build quality and regression.
- Included a formula-driven Dashboard, controlled dropdowns and conditional formatting, a 100-row Defects register, release gates and reusable controlled lists. All cases start as `Not Started`; the dashboard currently shows 125 total tests and zero logged defects.
- Export and formula inspection completed successfully with no spreadsheet formula errors. Every worksheet was rendered and visually checked for readable headers, widths and layout.

### Prisma-backed System Administration copy package

- Added `generated/ADMINISTRATION_PRISMA_COPY_FILES.md` and seven copy-ready implementation files for moving Administration away from hardcoded constants, `betaAccounts` directory data and browser `localStorage` persistence.
- Reused the existing Prisma data model instead of duplicating master data: programmes map to `Project`, accounting codes to `GlAccount`, and employees to `User` + `UserOrgMembership` + `UserOrgRole`.
- Extended membership data with the employee joining date and primary programme, extended projects with an assigned manager, and added one organization-level `AdminClaimPolicy` model for Medical/PD limits and proration.
- Added a migration, Prisma repository and `/api/v1/administration/settings` GET/PUT route. Writes are restricted to active OWNER or DIRECTOR memberships and directory removals suspend/deactivate records rather than deleting historical references.
- Updated the copy-ready Administration page and client data layer to load/save through the API. Accounting option consumers can continue using `useAdminAccountingOptions`, which now reads active database GL accounts.
- The live project was not modified for this feature because the user requested manual-copy files. Prisma formatting and validation passed, Prettier completed, and syntax transpilation passed for all five TypeScript/TSX implementation files. Run Prisma Client generation, migration deployment, full typecheck and lint after copying.

### Live-project typecheck recovery

- Removed the obsolete `showProcessingDetail` callback from the legacy Finance page after its `onProcessingStarted` prop was removed. Focused ESLint and the full TypeScript check both pass with zero diagnostics.
- Fixed all 44 TypeScript errors reported by the live project at `C:\Users\hp\OneDrive\Documents\Estuary-main`.
- Regenerated Next.js route types with `next typegen`, clearing 20 stale validator imports for legacy pages and API routes that had already been removed.
- Corrected Cash Advance Manager preview persistence and queue scope typing, including the `approvalOnly` query contract.
- Aligned Claims with its current Finance verification → Director decision → Finance payment statuses, restored the compatibility policy surface used by remaining legacy screens/tests and restored exported Google Sheet parsing with smart-chip URL resolution.
- Aligned Petty Cash Finance inputs so payment reference is required while payment proof remains optional at the initial Finance verification stage.
- Updated the legacy Finance PV page to use the current `FinanceProcessingPanel` export and corrected remaining bulk-processing call signatures.
- Synchronized the 13 affected files that exist in `generated/src` so the copy-ready scaffold matches the verified live source. The two legacy bulk components changed only in the live project and remain cleanup candidates rather than new generated copy files.
- Verification passed on 26 October 2026: `next typegen` completed successfully and `tsc --noEmit --pretty false` exited with code 0 and no diagnostics.

### Obsolete payment workflow file audit

- Added `generated/OBSOLETE_PAYMENT_WORKFLOW_FILES.md` with a conservative cleanup inventory for the merged Manager, Director and Finance navigation.
- Old role-specific list routes and their queue components are cleanup candidates after all links move to the unified routes. Old PV bulk routes/components are also candidates after bulk URL references are removed.
- The requested deletion list covers 15 old role-specific queue pages, their dedicated queue components, the shared Claims role queue after both remaining Claims list pages are gone, and the three legacy PV bulk workflows with their shared bulk CSS.
- The three older PV landing pages still have known internal links and should be converted to redirects before deletion.
- Payment-specific Finance review components must remain because the unified Finance overlay imports them directly. Dynamic detail routes should remain until notification and deep-link auditing is complete.
- No source files were deleted during this audit.

### Payment Voucher next-process description colour

- Changed the Payment Voucher Current Next Process description (`Record the payment…`) to neutral grey `#71839a`, normal casing and medium weight. The process title remains dark navy.
- Increased selector specificity and added explicit typography overrides because a global action-panel rule prevented local font-size changes from taking effect. The description now renders at `10px` with a `1.4` line height.
- Copy the updated `finance-payment.module.css` from the Finance Pending Processing copy guide.

### Finance labels, PV confirmation and legacy Claims visibility

- The Payment Voucher processed-payment checkbox and sentence now use a centered, non-wrapping row so the confirmation stays on one line.
- Finance queue filters now say `Finance processing`, `Finance verifying`, `Finance reconciliation`, `Finance payment is processed`, and `Finance payment transaction proof has been uploaded`.
- The shared standardized status vocabulary now prefixes the processed and proof-uploaded labels with `Finance` for clearer ownership.
- Claims missing from Finance Pending Processing were traced to workflow migration and stale assignment: legacy `PENDING_MANAGER_APPROVAL` and `PENDING_FINANCE_PROCESSING` states are normalized to `PENDING_FINANCE_VERIFICATION`; legacy `PAID` and `COMPLETED` are normalized to their current equivalents.
- Finance Claim queries include active Finance workflow states regardless of a stale legacy assignee. Claims with uploaded transaction proof can be identified by the new Finance proof-uploaded filter.
- Copy the updated Finance queue, PV CSS and standardized status file from `generated/FINANCE_PENDING_PROCESSING_COPY_FILES.md`, plus the Claims Prisma repository from `generated/CLAIMS_FINANCE_DIRECTOR_WORKFLOW_COPY_FILES.md`.
- Prettier and focused TypeScript syntax transpilation passed. Full live-project lint, database migration verification and browser testing remain required after copying.

### Petty Cash reconciliation evidence and balance confirmation

- Petty Cash continues to use its two-stage evidence model: Finance payment proof when funds are released, followed by the requester's multiple purchase receipts and optional returned-balance transaction proof during reconciliation.
- The Finance detail view now labels and lists all purchase receipts separately and identifies the returned-balance proof explicitly.
- When the requester reports a positive returned balance, Finance must tick a confirmation that the money was received before `Verify and complete` becomes available. The same validation is enforced in the action handler.
- When the returned balance is RM0, no receipt-of-balance checkbox is required; Finance instead sees guidance to review the no-balance declaration and purchase receipts.
- Invoice Payment, Travel Allowance and Claims retain their existing payment-reference and transaction-proof flow. Cash Advance retains its separate reconciliation workflow.
- Copy the updated Petty Cash Finance review and CSS listed in `generated/PETTY_CASH_IMPLEMENTATION_FILES.md`. Prettier and focused TypeScript syntax transpilation passed.

### Payment Voucher proof-upload separation

- Removed Upload payment receipt from the Payment Voucher Generate PV panel. PV generation now requires the payment date and explicit processed-payment confirmation, while the payment reference remains auto-filled from the PV number.
- The Finance queue Transaction Proof column now owns the PV receipt action. It shows `Upload receipt` after generation, displays the recorded filename after upload and provides `Replace receipt` for corrections.
- Updated the current-next-process copy to tell Finance that transaction proof is uploaded from the queue when available.
- Copy the updated Finance queue component, Payment Voucher Finance panel and shared filter CSS listed in `generated/FINANCE_PENDING_PROCESSING_COPY_FILES.md`.
- Prettier and focused TypeScript syntax transpilation completed successfully. Full live-project lint, persistence and browser verification remain required after copying.

### Claims notification build fix

- Removed the obsolete `requiresTechManagerApproval` dependency from the Claims notification path; that helper was intentionally removed when all Claims began bypassing Manager approval.
- Claims submission notifications now target Finance verification, while Director approval notifies both the requester and Finance that payment processing can begin.
- Updated notification wording for Director rejection and Finance payment processing to match the standardized Claims statuses.
- Copy `claim-notifications.ts` from the Claims Finance → Director → Finance workflow copy guide. Prettier and focused TypeScript syntax transpilation passed.

### Travel Allowance single-project rule

- A Travel Allowance request now supports exactly one project, including Manager-created requests with multiple selected employees.
- The per-employee `Assign different projects` link, modal, state and CSS were removed after confirming that a different project must be submitted as a new request.
- Changing Project Name updates every entry in the current request, and Add entry inherits the existing project. Google Sheet imports with multiple projects are rejected with an instruction to create separate requests.
- Add entry remains necessary for different travel dates, reasons or meal combinations within the same project. Duplicate remains as a convenience for similar entries and does not create a separate project assignment.
- Copy the updated form and CSS listed in `generated/TRAVEL_ALLOWANCE_MULTI_EMPLOYEE_COPY_FILES.md`.
- Prettier and focused TypeScript syntax transpilation completed successfully. Full live-project lint and browser verification remain required after copying.

### Unified Manager detail and action overlay

- Manager Pending Approvals now follows the same two-column review pattern as Director and Finance: complete request details, request breakdowns and supporting-document links appear on the left, while the Manager action appears in a dedicated panel on the right.
- Invoice Payment and Travel Allowance show the required `Review and continue` action. Payment Voucher, Petty Cash and Cash Advance keep their non-blocking informational behavior and use `Mark as previewed`.
- The Manager queue and per-type counters now include only outstanding Manager work. Required approvals disappear after forwarding; optional previews disappear after review, return or a terminal status.
- The status filter now focuses on `All pending actions`, `Approval required` and `Optional preview`; historical and downstream records belong in Payment Records rather than Pending Approvals.
- Previous, Next and Close remain in the fixed modal footer; the workflow action was removed from the footer to keep navigation separate from the decision area.
- Copy the updated Manager component and shared filter CSS listed in `generated/MANAGER_PENDING_APPROVALS_COPY_FILES.md`.
- Prettier and focused TypeScript syntax transpilation completed successfully. Full live-project lint and browser verification remain required after copying.

### Unified Director detail and action overlay

- Director Pending Approvals now uses the same two-column interaction pattern as Finance Pending Processing: full payment/request details on the left and a Director action panel on the right.
- Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance and Claims provide Approve/Reject actions. Rejection continues to require remarks before submission.
- Claims label the primary action `Approve for payment`, matching the corrected Finance verification → Director decision → Finance payment workflow.
- Petty Cash is explicitly an optional, non-blocking Director preview. Its action panel shows only `Mark as previewed`; Finance processing continues independently and the Director cannot reject it from this overlay.
- The unified row mapping now carries more requester, contact, project/programme, bank/payment and supporting-document summary fields into the detail view.
- Copy the updated Director component and shared Manager queue styles listed in `generated/DIRECTOR_PENDING_APPROVALS_COPY_FILES.md`.
- Prettier and a focused TypeScript syntax transpilation completed successfully. Full live-project lint and browser verification remain required after copying.
- Removed the obsolete `record` parameter from the shared Claims workflow-stage helper, resolving the reported `@typescript-eslint/no-unused-vars` warning in `claim-review-shared.tsx`.
- Flattened the Director action buttons by explicitly removing inherited shadows, filters and transforms and by setting solid one-pixel Reject/Approve borders. Hover colours remain, but the buttons no longer display the browser/global raised-button edge.
- Director action buttons and modal navigation controls now use a soft `9px` radius and medium `14px` text for a consistent appearance across Mark as previewed, Approve/Reject, Previous, Next and Close.
- The unified Director overlay now renders actual supporting-document links instead of only a document count. Invoice Payment, Travel Allowance and Cash Advance expose their uploaded files; Petty Cash exposes line proof links; Claims exposes secured uploaded receipts or external receipt links. The Director can preview or download each available document before deciding.

### Claims workflow correction

- Claims now bypass Manager approval for every requester role: Staff, Manager, Director and Finance submissions route directly to Finance verification.
- Every submitted Claim must identify a final approving Director. A Director claimant cannot select themselves.
- The implemented state order uses the shared standardized payment-status file: `DRAFT` → `PENDING_FINANCE_VERIFICATION` → `PENDING_DIRECTOR_APPROVAL` → `APPROVED_FOR_PAYMENT` → `PAYMENT_PROCESSED` → `TRANSACTION_PROOF_UPLOADED`.
- Finance verification checks the Claim and sends it to the assigned Director; it does not process payment at this stage.
- The assigned Director now makes a required final approve/reject decision. Approval returns the Claim to Finance; rejection requires remarks and closes it as `PAYMENT_REJECTED`.
- Finance can record payment only after Director approval. The Claim remains in Finance Pending Processing until Finance uploads a PDF/JPG/PNG transaction proof, which completes the workflow.
- Claims were removed from the Manager Pending Approvals data source and action count. Director Pending Approvals includes a Claim only while its status is `PENDING_DIRECTOR_APPROVAL`.
- Copy destinations and the workflow summary are listed in `generated/CLAIMS_FINANCE_DIRECTOR_WORKFLOW_COPY_FILES.md`.
- Prettier completed for the changed Claims domain, repository, API, interface and documentation files. The live project's ESLint installation ignores files outside its own base path, while this manual workspace has no independent lint/runtime setup; run the normal live-project lint and database verification after copying.

## Timeline — Current State Through 2026-10-25

### Handoff scope

- This handoff includes implementation work through the latest Petty Cash request-field alignment.
- The later conversational explanation of Payment Records versus My Requests is intentionally excluded because it did not change the implementation or establish a final product decision.

### Delivery model

- Estuary is currently maintained in this lightweight manual handoff workspace. Copy-ready Next.js files live under `generated/src` and mirror their destinations in the separate live project.
- This workspace has no independent dependency manifest, runtime, database or Git metadata. It is a source handoff, not a directly deployable application.
- Use `generated/FINANCE_PENDING_PROCESSING_COPY_FILES.md` for the complete unified Finance copy list.

### Unified Finance Pending Processing

- Finance uses one `Pending Processing` workspace for Payment Voucher, Petty Cash, Invoice Payment, Travel Allowance, Cash Advance and Claims.
- Each payment type opens inside the shared modal overlay using its dedicated Finance review component. The shared queue passes its already-loaded record into those reviews to avoid a second request and the previous full-screen loading state.
- Payment Voucher uses its dedicated `FinanceProcessingPanel`; the other five payment types retain their existing payment-specific Finance review files. Those review components must not be deleted while the unified overlay imports them.
- Single and multi-selection use the shared review flow. Completed records remain in Payment Records rather than the pending queue.

### Latest Finance payment rule

- All six payment types now show an automatically filled, read-only payment reference based on the payment/request number.
- Payment Voucher, Travel Allowance, Cash Advance, Petty Cash and Claims persist the reference through their existing Finance operations. Invoice Payment displays its request number consistently, but its current completion API does not accept separate Finance payment metadata.
- The primary Finance action is disabled until required fields are complete and Finance selects `I confirm that this payment has been processed`.
- Handler-level guards protect Payment Voucher, Travel Allowance, Cash Advance, Petty Cash and Claims from bypassing the disabled interface action.
- Petty Cash additionally requires a payment receipt before `Verify payment information` becomes available.
- Cash Advance reads its saved payment date from `CashAdvanceRecord.financePaidAt`, sliced to `YYYY-MM-DD`. The invalid `financePaymentDate` references were removed.

### Latest interface fixes

- The Cash Advance confirmation row has `10px` spacing above and `14px` below through `.financePaymentConfirmation`.
- Claims, Travel Allowance, Petty Cash and Invoice Payment now enforce a compact 16px Finance confirmation checkbox instead of inheriting full-width input styling.
- Claims and Travel Allowance explicitly override their generic vertical label layout with a horizontal flex row, keeping the checkbox and confirmation sentence aligned together.
- Invoice Payment's read-only reference uses the same bordered field treatment as the other Finance forms.

### Verification and copy files

- Focused TSX syntax checks passed for the changed Finance review and Payment Voucher panel files.
- Prettier checks passed for the latest TSX and CSS changes.
- Copy the files listed in `generated/FINANCE_PENDING_PROCESSING_COPY_FILES.md`, including the Petty Cash and Claims stylesheets added during this session.

### Immediate follow-up

- Copy the current generated Finance files into the matching live-project paths and visually verify each payment type in the unified modal at desktop and narrow widths.
- If Invoice Payment must persist payment date/reference like the other types, extend its Finance completion API and repository before relying on that metadata outside the interface.

### Latest Manager build fix

- Resolved the unified Manager queue's missing `previewCashAdvanceByManager` export handoff. The generated Cash Advance browser API already exposes the preview helper and calls the existing `manager-approve` preview endpoint with `managerId` only, matching the live route's informational Cash Advance workflow.
- Added `src/data/payment-requests/cash-advance/cash-advance-api.ts` to `generated/MANAGER_PENDING_APPROVALS_COPY_FILES.md`. Copying this file fixes both the unified Manager Pending Approvals import and the existing Cash Advance Manager review import without converting the preview into a signature-based approval.

### Dashboard links to unified pending workspaces

- Updated the current dashboard replacement so Manager, Director and Finance payment-type cards and action-drawer `View all` links open their unified Pending Approvals/Pending Processing route with the matching `type` query (`PV`, `PC`, `INV`, `TA`, `CA` or `CL`).
- Action-drawer record links now add the record ID through `request`, so the destination activates the correct payment tab and opens that record in the existing detail modal rather than navigating to a removed payment-specific queue.
- Manager, Director and Finance unified components now read the `type` query on entry. They also resolve the optional `request` query after their records load and open the matching Manager review, Director decision or Finance processing overlay.
- Staff category and Payment Records destinations remain unchanged. Copy instructions are in `generated/DASHBOARD_PENDING_NAV_LINKS_COPY_FILES.md`.
- Staff action-drawer record links now deep-link to the specific task screen. Returned Invoice, Travel Allowance and Claim records open their correction editor; Petty Cash opens its action detail; Cash Advance opens its detail with `view=reconciliation` for reconciliation statuses; Payment Voucher opens its detail workflow. Staff `View all` links continue to open the relevant record category.

### Finance unified-link ESLint fix

- Refactored the Finance Pending Processing query handling to satisfy `react-hooks/set-state-in-effect`.
- The initial Finance payment type is now derived lazily from the URL when `activeType` state is created, removing the synchronous URL-to-state effect.
- Deep-linked record opening is scheduled with a cancellable callback after queue records load; record matching uses the row key or reference rather than a nonexistent `Row.id` property.
- The generated Finance component passes the live project's ESLint configuration with no reported errors.

### Travel Allowance multi-employee and Finance summary

- The Manager Travel Allowance form now supports selecting one or several employees from a checkbox picker. Selected employees appear as removable chips in one shared entry card.
- Shared travel details are still expanded into one saved `TravelAllowanceLine` per employee. This preserves the existing API, calculations, approval flow and PDF generation without a schema change.
- Managers can still create a single-employee entry, add a separate entry for different travel details or duplicate a grouped entry when useful.
- The Finance Travel Allowance review now merges lines by employee. Each Finance row shows the employee, first-to-last travel date (or one date), number of entries, combined projects/reasons/meals and the employee's overall requested total.
- Formatting and focused ESLint checks passed with no errors. Copy instructions are in `generated/TRAVEL_ALLOWANCE_MULTI_EMPLOYEE_COPY_FILES.md`.
- The Manager form now treats the main Project selector as a shared project for all selected employees. For mixed assignments, an `Assign different projects` action opens a responsive modal with one project selector per employee, including `Other` project text entry.
- Employee picker typography and its CSS chevron now match the standard Project selector, and required asterisks in this entry section are red.

### Claims Google Sheet numbered guidance

- The Claims Google Sheet flow now presents two numbered steps: first choose the correct Claim type/template, then paste and retrieve the matching completed worksheet.
- Changing the Claim type clears any previously pasted URL, retrieved data and error so a link from another template cannot silently carry into the new selection.
- Added responsive numbered-step styling with a blue step badge. Focused formatting and ESLint checks passed without errors.
- Restored the current Claims form header styles: `.pageHeader` now formats the breadcrumb, title, description and Draft/Correction pill. The entry-mode tab CSS now supports the JSX's `data-active="true"` attribute, restoring the dark-navy selected tab while retaining the older class selector for compatibility.

### Petty Cash request-field alignment

- Reordered the Petty Cash routing fields and removed the Director previewer's full-width class so Location and Director Previewer share one two-column row for Staff and Manager requests.
- Finance retains the same grid behavior with Location beside Independent Previewer. Existing responsive CSS still stacks the fields on narrow screens.
- The updated Petty Cash form passed focused ESLint without errors.

### Payment Voucher Google Sheet numbered guidance

- The Multiple Payment Voucher Google Sheet import now follows the same numbered guidance pattern as Claims: Step 1 opens/copies the official PV template, Step 2 attaches the completed working-copy link and Step 3 reviews loaded rows.
- Added the official template callout and its environment-backed `NEXT_PUBLIC_PAYMENT_VOUCHER_TEMPLATE_SHEET_URL` link to the generated uploader.
- The completed-sheet attachment card explicitly retains a white background; only the official-template callout uses the pale-blue background.
- The updated uploader and stylesheet are responsive, formatted and pass focused ESLint without errors.

---

> Preserved from the user-supplied handoff. Later changes are summarized in the consolidated current state immediately below this imported baseline.

## Imported Baseline Current State — supplied history

- Project: Estuary
- Summary: Manual documentation scaffold initialized; the repository has no documented implementation or product purpose yet.
- Current Worker:
- Current Branch: Not established
- Last Updated: 2026-09-22

## Current Blockers And Quirks

- Product purpose, stack, runtime, and verification workflow are not yet documented.
- No Git metadata was present when this scaffold was initialized.

## Latest Session Changelog

- Organized the user-supplied stylesheet as `output/organized.css` without changing selectors or declarations.
- Consolidated repeated responsive rules into one media block per breakpoint, reducing 15 media blocks to 9.
- Created `output/infographics/payment-voucher-life-cycle-swimlane.png`, a landscape swimlane flowchart based on the supplied payment voucher lifecycle reference.
- The infographic uses five lifecycle stages and role-labelled lanes, with no legend or ARUS logo.
- Generated `generated/local-payment-voucher-store.ts` from the user's current 2,340-line store, adding explicit manual/digital recipient signature selection, recipient manual-PDF upload, Staff manual-PDF upload and confirmation, reset handling, and Finance completion validation.
- Verified that the generated store transpiles without TypeScript syntax errors and that each new exported signature function appears once.
- Generated full replacement files `generated/recipient-signature-panel.tsx` and `generated/recipient-payment-voucher.module.css` for recipient digital/manual signing. The TSX syntax check passed and CSS braces were verified balanced.
- Generated `generated/payment-voucher-detail.tsx` with Staff manual signed-PV upload, confirmation, Finance notification, manual-PDF download, and signature-method/source audit display. TSX syntax transpilation passed.
- Generated `generated/payment-voucher.module.css` from the current full stylesheet with responsive Staff manual-upload card styles; verified 496 opening and 496 closing braces.
- Revised the chosen manual-signature UX by generating `generated/recipient-link-panel.tsx` and its full CSS: manual signed-PV upload now opens in a modal from the existing Staff recipient panel, while the secure recipient link is described as digital signing. TSX syntax and CSS brace checks passed.
- Generated the complete `generated/bulk-csv-upload-panel.tsx` replacement. It downloads the formatted `.xlsx` template through `download-payment-voucher-template.ts`, accepts both `.xlsx` and `.csv`, converts Excel cell values safely (including dates, formulas, rich text, IC numbers, and bank account values), and reuses the existing bulk row validation. A TypeScript project check using the generated file as an overlay reported zero errors in the uploader.
- Generated complete replacements for `generated/bulk-payment-voucher-create-flow.tsx` and `generated/bulk-preview-panel.tsx`. The visible bulk-import terminology now consistently says Spreadsheet Upload / Excel or CSV, while retaining draft creation, draft selection, and submission to assigned Directors. A combined TypeScript overlay check of these files plus the updated uploader reported zero errors.
- Generated `generated/finance-page.tsx` and `generated/finance-payment.module.css` with an accessible Grid/List view toggle beside the Finance queue result count. List view is the default and presents compact PV number, Staff, recipient, division, amount, status, update date, and View details columns; Grid view retains the existing full Finance action panels. The page passed a TypeScript overlay check with zero errors, and the stylesheet has balanced braces.
- Extended the generated Finance Grid/List replacements so List-view `View details` opens a responsive modal containing the live `FinancePaymentPanel`. Finance can perform each currently available action without leaving the queue; the modal follows store updates and displays the new status/action. Added Escape, backdrop, and close-button dismissal plus body scroll locking. Also added the current `AWAITING_RECIPIENT_SIGNATURE` and `AWAITING_STAFF_CONFIRMATION` statuses to the Finance queue/waiting filter. TypeScript reports zero target errors and CSS braces remain balanced.
- Refreshed `generated/payment-voucher-detail.tsx` from the current project and made its back navigation role-aware for Finance: Finance users now see `Back to payment processing` linking to `/beta/finance`; Director and Staff destinations remain unchanged. TypeScript reports zero target errors.
- Generated `generated/payment-vouchers-page.tsx`, `generated/payment-voucher-record-list.tsx`, and an updated `generated/payment-voucher.module.css` to add a shared Grid/List toggle to Payment Records for every role. The list table shows PV number, creator, recipient, division, amount, status, PV date, updated date, and View details. Modern workflow statuses were added to filters and Finance visibility. Both TypeScript targets report zero errors and the stylesheet has balanced braces.
- Generated `generated/approvals-page.tsx` for the redesigned Director workspace. It separates Pending approvals and Approval history, supplies Grid/List controls, history filters, bulk approval access, and a live modal using `PaymentVoucherDetail` for decision-making or read-only review. Prepared callback-compatible updates to the generated shared record list/card for the next handoff. The page and both dependencies pass a combined TypeScript overlay check with zero errors. Approval history is currently derived from voucher state until an immutable decision-event store is added.
- Completed the three Director-workspace dependencies: `generated/payment-voucher-record-list.tsx`, `generated/payment-voucher-record-card.tsx`, and `generated/payment-voucher.module.css`. The shared Grid/List components now support modal callbacks and custom action labels; the stylesheet includes the Director tabs, view selector, responsive review modal, and button normalization. All 43 CSS-module selectors used across the Director page and its two list components are present, and the stylesheet has 551 balanced rule braces.
- Updated the generated shared voucher list CSS so List view is fixed within its container instead of horizontally scrollable. The table now uses a fixed layout and explicit column widths, wraps long content, constrains status badges, and progressively hides secondary columns on narrower screens. The generated stylesheet has 562 balanced braces and no horizontal-auto overflow on the table wrapper.
- Refined the fixed voucher list so status badges remain on one line. The status column now receives 18% width, the recipient column 15%, and table badges use compact padding/font sizing with `white-space: nowrap`.
- Aligned the shared voucher List view with the Finance queue: it now uses the compact eight-column layout (PV number, Staff, recipient, division, amount, status, updated, action), removes the separate PV-date column, and uses Finance-style white outline action buttons with a blue hover state. Column widths and responsive hiding rules were recalibrated while retaining the fixed, non-horizontal-scroll layout.
- Aligned `generated/finance-payment.module.css` with the Director table behavior. The Finance table no longer has horizontal scrolling or a forced minimum width, uses a fixed eight-column layout, preserves the right-side action button, and hides secondary columns at narrower breakpoints. Shared status badges now default to a single line. Both generated stylesheets have balanced braces.
- Updated the generated Finance List view after removing the Updated column. `generated/finance-page.tsx` now renders seven matching columns, while `generated/finance-payment.module.css` redistributes the table widths and gives the action cell 16px left/20px right padding so the outline button no longer touches the table edge. Responsive rules no longer hide the seventh-column action. The table structure validates as seven headers/seven cells and CSS braces remain balanced.
- Redesigned the generated Payment Voucher detail UI to follow the user's cleaner prototype while preserving workflow behavior. `generated/payment-voucher-detail.tsx` now places the title and current-action banner above the two-column content/tracker layout, groups the information sections into one bordered card, adds Print and context-aware PV download actions to the banner, and retains Staff/Director/Finance panels. `generated/payment-voucher.module.css` adds compact information typography, consolidated-card styling, a denser sticky tracker, responsive stacking, and print rules. TSX transpilation reports zero diagnostics, all 34 referenced CSS-module classes exist, and CSS has 621 balanced braces.
- Refined the PV detail replacement to match the two-card wireframe precisely: one consolidated Details card and one tracker card. Removed the duplicate external tracker heading, added the blue current-action icon, exact Print Voucher/Download Signed PV button treatment with icons, Recipient Details and verification badges, itemized breakdown metadata plus subtotal/tax/amount-in-words/grand-total summary, and Finance audit verification styling. TSX transpilation still reports zero diagnostics; all 38 CSS classes exist and CSS has 642 balanced braces.
- Relaxed the Director/shared eight-column list table spacing in `generated/payment-voucher.module.css`: row cell padding increased to 16px/12px, the action column increased from 9% to 13%, and its cell now has 16px left/20px right padding. Other columns were proportionally rebalanced to retain a 100% fixed, non-scrollable layout, including a 21% single-line status column.
- Strengthened the PV detail prototype styling so legacy beta rules cannot visually override it: the full Details card now has a visible outer border and section separators, Payment Details includes the requested thin divider, the layout uses an approximately 2:1 details/tracker split, and the action banner enforces a pale-blue background, blue square icon, white Print button, and bright-blue Download button. Validation remains clean with zero TSX diagnostics, no missing classes, and 646 balanced CSS braces.
- Recalibrated the final PV detail CSS directly from the user-supplied Tailwind prototype HTML. The generated view now maps the prototype's 20px action-card padding, 40px icon, 16px action title, 12px description/buttons, 24px lower-grid gap with an 8/4-equivalent split, 24–32px detail section padding, 10px labels/12px values, and 24px tracker markers with 12px/11px step typography. Replaced temporary Unicode action symbols with the prototype's inline SVG check, printer, and download icons. Validation reports zero TSX diagnostics, no missing styles, and 715 balanced CSS braces.
- Added a final high-specificity PV detail prototype block to `generated/payment-voucher.module.css` that explicitly enforces the requested three-card composition: one full-width Current Action card, then a two-column row containing the full Details card and Payment Progress card. It locks card borders/backgrounds, internal thin separators, compact typography, exact print/download hierarchy, 2:0.96 lower-grid proportions, a dense tracker, and responsive one-column stacking. The TSX still has zero syntax diagnostics, all CSS-module classes resolve, and the stylesheet has 705 balanced braces.
- Removed duplicate action icons defensively. The latest TSX contains only the prototype SVG icons, and the CSS now suppresses any legacy `aria-hidden` text-icon spans left in a manually merged copy; the action-icon container also uses zero font size so a leftover check character cannot render beside its SVG. CSS has 717 balanced braces.
- Simplified shared voucher grid cards: `generated/payment-voucher-record-card.tsx` no longer renders the Next Action block for rejected vouchers, leaving only the Director's remarks. `generated/payment-voucher.module.css` replaces the Next Action block's blue left indicator with a neutral one-pixel border for all other statuses. TSX transpilation reports zero diagnostics and CSS remains balanced.
- Removed the dark-red left indicator from `.notice` in the generated Payment Voucher stylesheet. Amendment/error notices now use a consistent thin `#fecaca` border on all four sides while retaining the light-red background and readable dark-red text. CSS remains balanced at 735 rules braces.
- Redesigned the rejected/amendment state in the generated PV detail files. A rejected voucher now uses one compact red Action Required banner containing the rejecting Director, amendment guidance, a dated remarks box, and the sole Amend Payment Voucher link. The previous separate rejection notice was removed, eliminating duplicated messaging/actions. Print Voucher was removed from every status; non-rejected records retain only the context-appropriate PV download action. TSX transpilation reports zero diagnostics, only one Amend label remains, no Print action remains, all CSS classes resolve, and CSS has 735 balanced braces.
- Generated `generated/role-sidebar.tsx` and `generated/beta.module.css` for the first Payment Request navigation step. After reviewing the Prisma schema, the Staff sidebar now shows three clean entries: Payment Voucher, Payment Request, and Petty Cash Top-up. Payment Request links to the single shared `/beta/payment-requests/new` form; its four Prisma-backed types belong in that form's dropdown rather than as sidebar children. Petty Cash remains clearly marked Soon, while other roles and Records navigation are preserved. The provisional Staff → Manager → Director → Google Form → Finance flow is intentionally not implemented until Finance confirms it.
- Generated `generated/payment-requests-new-page.tsx` as the complete replacement for the currently empty beta Payment Request creation page. After correcting an initial prototype-styled draft, the page now reuses the established Beta Payment Voucher CSS module and its panel, form-section, responsive line-entry, summary, notice, and action patterns. Its dropdown values remain compile-time checked against Prisma's `PaymentType` enum, while draft saving temporarily uses the existing prototype API until Prisma persistence and the final workflow are confirmed.
- Began the Payment Voucher PostgreSQL migration with a database-backed vertical slice. Generated a singleton Prisma client, a Payment Voucher Prisma repository, real collection/detail API routes, a browser API client, an async database-backed `usePaymentVouchers` hook, and a database-backed Staff creation flow. Creation now atomically allocates a monthly PV number and writes `Submission`, `PaymentVoucherDetail`, `SubmissionLine`, `ApprovalStep`, `SubmissionTransition`, and `AuditEvent` records in one transaction. Compatibility-only UI fields that are absent from the normalized schema are kept in the immutable CREATE transition snapshot. Approval, amendment, Finance processing, binary document storage, external signature tokens, and existing browser data migration remain follow-up phases; the generated creation flow explicitly prevents a rejected amendment from silently falling back to localStorage.
- Verified the six-file PostgreSQL vertical slice with the project's TypeScript compiler; it reports zero errors. A live `prisma migrate status` check resolved the configured datasource as PostgreSQL database `estuary` on `localhost:5432` but failed at the schema engine because no process is listening on port 5432. Database runtime verification and migration status remain blocked until PostgreSQL is started locally or `DATABASE_URL` is changed to the reachable server address.
- Generated `generated/seed.ts`, a rerunnable Prisma seed for the database-backed Payment Voucher slice. It creates the `beta-arus-org` organization, all IDs used by the Beta accounts, active memberships and roles, GL accounts 5100/5200/5300, reference areas/projects, and Payment Voucher workflow version 1 with the current ten states and eleven transition rules. It deliberately creates no dummy Payment Vouchers.
- Diagnosed the first live database test. The one-off migration-status command connected successfully through `127.0.0.1:15432`, but its temporary `DATABASE_URL` was removed afterward, so Prisma Studio/app processes still need the same working URL in their own environment. The actual `src/app/api/v1/payment-vouchers/route.ts` was also inspected and remains the original `betaNotImplemented` stub; this directly explains the UI message “Create Payment Voucher is scaffolded but not connected to the database yet.” The generated collection route still needs to replace that exact file, followed by a dev-server restart.
- Extended the generated Beta Payment Request page with supporting-document selection. Staff can select up to ten PDF/PNG/JPG files of at most 10 MB each, see file names and sizes, avoid duplicates, remove individual files, and send their filenames in the draft payload. The current JSON API does not persist binary file contents, so a multipart/object-storage endpoint plus Prisma `Document` and `SubmissionEvidence` writes remain required for real uploads.
- Diagnosed the Director approval failure after database-backed PV creation: `payment-voucher-detail.tsx` was still calling the old localStorage approve/reject functions, while both action API routes remained placeholders. Generated database-backed approve/reject repository operations, real action routes, browser API methods, and an updated async detail handler. The transaction validates the assigned active Director, records `ApprovalDecision`, `SubmissionTransition`, `AuditEvent`, updates the approval step and current submission state, and maps the stored signature key. All generated database files pass the project TypeScript compiler.
- Changed the generated PostgreSQL Payment Voucher numbering from the date-like monthly format `PV-YYYY-MM-NN` to the requested annual sequence `PV-YYYY-NNNN`. `DocumentSequence.month = 0` is reserved internally for the yearly PV counter, allowing numbers such as `PV-2026-0001` and `PV-2026-0002` without a Prisma schema migration. Existing issued voucher numbers are intentionally left unchanged. The complete database overlay still passes TypeScript validation.
- Generated the database-backed Project Manager preview slice. The repository now validates the assigned active Manager, writes an idempotent informational `MANAGER_PREVIEW` submission transition plus audit event, and leaves the workflow state unchanged. Added the real manager-preview API route and browser method, updated the Manager card to await the database action, and updated the Manager page to refresh counts/queues afterward. The complete database overlay passes TypeScript validation.
- Rebuilt the single Payment Voucher creation form styling inside the user-supplied shared `payment-voucher.module.css`, aligned with the clean receipt-style review page without changing the sidebar or form data/validation. The form uses a unique `formPanel` root so its overrides do not leak to other components. Removed the obsolete legacy review-page selectors from the shared stylesheet because the review screen now owns its separate `payment-voucher-review.module.css`; no extra form CSS file remains. The PV-specific Voucher Lines breakdown, responsive layout, summary, amount in words and navy grand-total bar remain. TypeScript passes, all form CSS-module references resolve, no legacy review-only selectors remain, and CSS braces are balanced.
- Rebuilt the single-PV Step 2 review as an isolated receipt-style page using `generated/payment-voucher-review.tsx` and a new review-only CSS module. It follows the supplied prototype without changing the sidebar or shared PV pages. Added review-step reporting from `PaymentVoucherCreateFlow` to `PaymentVoucherCreateWorkspace`, allowing the workspace to hide the redundant Creation Method / Single payment voucher toolbar only while Step 2 is visible. The combined generated overlay passes TypeScript validation.
- Rebuilt the Staff Payment Voucher review step from the supplied HTML prototype without changing the sidebar or other screens. `generated/payment-voucher-review.tsx` now presents a compact Step 2 header and one unified receipt-style card containing general, recipient, and payment information, a responsive itemized breakdown with aligned totals, amount in words, supporting documents, and a quiet footer action row. Added the isolated `generated/payment-voucher-review.module.css` so the redesign cannot alter the form, records, details, Director, Finance, or sidebar UI. Existing amendment and submission behavior is preserved. TypeScript passes, all 32 referenced CSS classes exist, and CSS braces are balanced.
- Restyled only the Payment Breakdown inside the generated creation form to match the compact light wireframe. Voucher Lines now shows an item-count badge and a small pale-blue Add line button; the line-entry grid uses a subtle table header and denser controls; and the amount-in-words, subtotal, tax, and grand total share a light two-column summary with no navy total bar. Payment Voucher fields and calculations are unchanged, responsive stacking is retained, the existing shared stylesheet remains the sole form CSS file, TypeScript passes, and CSS braces are balanced at 761/761.
- Corrected the Payment Voucher form scope after the user clarified that the supplied shared module's screen width must remain unchanged. Rebuilt `generated/payment-voucher.module.css` from the latest supplied module, removed obsolete legacy Staff review rules now owned by `payment-voucher-review.module.css`, restored `generated/payment-voucher-form.tsx` to the original full-width `.panel` wrapper with no review-like form-card header, and limited the visual redesign to Payment Breakdown. TypeScript passes, all form CSS classes resolve, no `.formPanel` or legacy review selectors remain, and CSS braces are balanced at 696/696.
- Increased only the compact Payment Breakdown typography for readability: column labels, line inputs, totals, amount-in-words text, item badge, and Add line button are now slightly larger, with Grand total increased to 20px. Layout dimensions and the rest of the form remain unchanged; CSS braces remain balanced at 696/696.
- Located the Beta Payment Request form, which was implemented directly in `src/app/beta/payment-requests/new/page.tsx` rather than under `features`. Generated a clean feature split: `payment-request-form.tsx`, its isolated `payment-request-form.module.css`, and a thin `payment-requests-new-page.tsx` route. The form now follows the supplied unified-card wireframe with Request Overview, Recipient/Vendor, supporting-document upload, Approver Workflow, compact Payment Breakdown, amount-in-words, totals, and a dark action footer. Existing four Prisma-backed Payment Request types, validation, file checks, and prototype draft API behavior are retained; Petty Cash remains separate. TypeScript passes, all 33 CSS-module classes resolve, and CSS braces are balanced at 91/91.
- Increased typography consistently across the generated Payment Request form for parity with the Payment Voucher form. Section headings are now 18px, descriptive text 13–14px, labels 12px, main inputs 14px, breakdown inputs 13px, row totals 14px, final total 18px, and the primary action 13px. Widths, spacing structure, responsive layout, and behavior are unchanged; TypeScript still passes and CSS remains balanced at 91/91.
- Enabled Add line for every Payment Request type, including Invoice. Removed the disabled button condition and handler guard, stopped request-type changes from collapsing Invoice back to one line, and clarified that Invoice starts with one line but may be split across accounts. TypeScript validation passes.
- Fixed duplicate Payment Request line React keys after removing and re-adding lines. Line IDs no longer derive from `current.length + 1`; a monotonic `useRef` counter now issues each new line number once for the component session. TypeScript validation passes. Existing duplicate state from hot reload requires one browser refresh after copying the replacement.
- Diagnosed the Manager-preview missing-export errors as file-placement issues, not missing implementation. The completed browser API was copied under `src/domain/payment-vouchers/payment-voucher-api.ts` instead of `src/data/payment-vouchers/payment-voucher-api.ts`, and the completed repository was placed under `src/domain` with the misspelled filename `prisma-payment-voucher-respository.ts`. The correct `src/data` files still lack the Manager exports, and the actual `[id]/manager-preview/route.ts` is zero bytes. The existing generated API, repository, and manager-preview route form a complete validated replacement set and expose both required Manager functions.
- Diagnosed “records disappear after reopening” as a database-read failure rather than data loss. PostgreSQL at `127.0.0.1:15432` is reachable, but the `DATABASE_URL` currently loaded from the project's `.env` fails authentication for `adlina_dev`. The supplied runtime trace confirms Prisma authentication failure in `listPaymentVouchersFromDatabase`. Prisma Studio was launched from a separate PowerShell session containing the valid temporary URL, while the dev server was launched from VS Code's separate terminal, which did not inherit that variable. `usePaymentVouchers` catches the failed GET and resets records to `[]`, while the records page ignores the hook's `error`, making the failure look like an empty database. The environment variables and `pnpm dev` must be run in the same terminal; later, surface the hook error in the page UI.
- Confirmed the project `.gitignore` contains `.env*`, so a correct local `.env` can persist the database URL across terminal and app restarts without being committed to Git. This stores the credential locally (and potentially in the user's OneDrive-synced project), so it should only be used if allowed by the team's secret-handling policy. The `127.0.0.1:15432` tunnel/server connection may still need to be started separately whenever it is unavailable.
- Diagnosed the empty Project Manager Payment Voucher queue as an identifier mismatch. The Manager page filters by the signed-in beta account ID `nadia-hassan`, while the Staff form was storing the placeholder `operations-manager`. Updated `generated/payment-voucher-form.tsx` so new vouchers store `nadia-hassan`, and updated the generated Prisma repository to normalize the old placeholder for existing vouchers both when listing and recording Manager preview. The complete Payment Voucher database overlay passes TypeScript validation.
- Fixed the Project Manager list view's clipped `View details` button by expanding the action column to 14%, rebalancing the other desktop columns, reducing action-cell side padding, and constraining the button to its available cell width. CSS remains balanced at 122/122 rule braces.
- Added Finance/Director-style Grid and List modes to the generated Project Manager Payment Voucher queue. List is the default and shows PV number, recipient, division, amount, workflow status, preview status, and a View details action. The action opens a responsive modal containing the existing live Manager preview card, so Mark as viewed still refreshes the queue and counts. Added Escape/backdrop/close dismissal and body scroll locking. The isolated Manager UI TypeScript check passes; all 39 CSS-module classes resolve and the stylesheet has balanced braces.

- Generated the first database-backed Finance Payment Voucher slice. Added active `FINANCE_ADMIN` membership validation, an idempotent `APPROVED_FOR_PAYMENT` to `FINANCE_PROCESSING` transition, durable payment date/reference/remarks/actor persistence, append-only `RECORD_PAYMENT` transition metadata, and audit events. Added two real Finance API routes and browser API methods, then updated the Finance panel/page to await the server actions and refresh PostgreSQL-backed records. Payment-proof filenames are recorded as pending metadata only; actual proof bytes and generated PDFs remain blocked on the existing S3 storage stub and are intentionally the next document-storage phase. The isolated Finance database overlay passes TypeScript validation.

- Diagnosed the Next-generated `.estuary-next/dev/types/validator.ts` errors after adding Finance routes. Both Finance source routes now exist and contain valid code, so their validator diagnostics are stale generated-cache output. A separate real error remains: `src/app/beta/payment-requests/[requestId]/page.tsx` is a zero-byte file. Generated `payment-request-detail-page.tsx` to restore that beta route using the existing `PaymentRequestDetailScreen`. Stop Next, remove only `.estuary-next`, restart the dev server, and restart the VS Code TypeScript server; never edit generated validator files.

- Added `generated/start-estuary.ps1` to prevent repeated empty-record symptoms caused by launching Next.js without the temporary database environment. The script stores no password, checks the `127.0.0.1:15432` tunnel, prompts securely, sets `DATABASE_URL`/`DIRECT_URL` only in its process, verifies Prisma migration connectivity, and launches the development server in that same process. PowerShell parser validation reports no syntax errors.

- Fixed the database-backed Finance PDF action while preserving the already-working client-side PDF builder/download. Finance now downloads the PDF in the browser, then calls a real POST `/api/v1/payment-vouchers/[id]/pdf` route instead of the localStorage `generatePaymentVoucherPdf()` operation. The repository validates saved payment information and active Finance membership, records the annual PV filename and client-download mode in the transition/audit trail, and moves `FINANCE_PROCESSING` to `AWAITING_RECIPIENT_SIGNATURE`. Mapping supports the generated filename/time without pretending that PDF bytes exist in S3. Also aligned new Finance-start transitions with the seeded `START_FINANCE_REVIEW` action while retaining fallback mapping for earlier beta rows. The Finance/PDF database overlay passes TypeScript validation.

## Next Recommended Step

- Copy and test the generated Finance start-processing/payment-information slice. After those values survive a restart, connect the S3-backed payment-proof upload and generated Payment Voucher PDF lifecycle.

---

## Current State — 2026-10-24

### Latest session — unified Finance payment confirmation

- Standardised the Finance payment action across all six payment types. Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance, Petty Cash and Claims now show an auto-filled, read-only reference based on the payment/request number and require an explicit `I confirm that this payment has been processed` checkbox before the primary Finance action is enabled.
- Preserved saved Finance references when they already exist; Travel Allowance, Petty Cash and Claims fall back to their request number and continue persisting the reference through their existing Finance APIs. Payment Voucher already persists its voucher number. Invoice Payment displays its request number while retaining its existing completion API, which does not currently accept separate Finance payment metadata.
- Added handler-level guards as well as disabled-button conditions, so Travel Allowance, Petty Cash, Claims and Payment Voucher cannot bypass the confirmation through a direct click/action call. Petty Cash still requires a payment receipt in addition to date, reference and confirmation.
- Added the Petty Cash and Claims stylesheets to `generated/FINANCE_PENDING_PROCESSING_COPY_FILES.md`. Focused TSX syntax validation passed for all five changed Finance review/panel files.
- Corrected the Cash Advance Finance review to read its persisted payment date from the actual `CashAdvanceRecord.financePaidAt` field rather than the nonexistent `financePaymentDate` field. ISO timestamps are sliced to `YYYY-MM-DD` for the date input.
- Added vertical spacing around the Cash Advance Finance processed-payment confirmation using `.financePaymentConfirmation { margin: 10px 0 14px; }`, separating it from both the payment-reference input and Confirm payment button.
- Fixed the processed-payment confirmation styling for Travel Allowance, Claims, Petty Cash and Invoice Payment. Higher-specificity checkbox selectors now override each action panel's generic full-width input rules, enforcing a compact 16px checkbox, left alignment and consistent spacing. The Invoice read-only payment reference now uses the same bordered input treatment as the other Finance forms.
- Corrected Claims and Travel Allowance confirmation alignment by overriding their generic vertical label layout with an explicit horizontal flex row. The checkbox and confirmation sentence now remain together on one line where space allows.
- Locked the Claims and Travel Allowance processed-payment confirmation sentence to one line with `white-space: nowrap` and a scoped 11px label size, without changing other Finance-panel typography.

### Workspace and delivery model

- This repository is a lightweight, manual handoff workspace. Copy-ready Next.js source lives under `generated/src` and mirrors paths in the separate live Estuary project.
- The workspace has no independent package manifest, runtime, database or Git metadata. Do not describe it as directly deployable, and do not invent run, test or lint commands for it.
- Use the relevant `generated/*_COPY_FILES.md` manifest when moving a completed feature into the live project. The current unified Finance manifest is `generated/FINANCE_PENDING_PROCESSING_COPY_FILES.md`.

### Unified role queues

- Manager approvals are combined under one `Pending Approvals` navigation item for Payment Voucher, Petty Cash, Invoice Payment, Travel Allowance, Cash Advance and Claims. The queue retains payment-type tabs, appropriate filters, selection, overlay review and bulk confirmation.
- Director approvals are also combined under one pending-only `Pending Approvals` destination. Each opened request requires an explicit Approve or Reject decision; rejection requires remarks. Approved, forwarded and completed records belong in Payment Records rather than the pending queue.
- Finance processing is combined under one `Pending Processing` destination. The queue contains only records that still require Finance action and supports Payment Voucher, Petty Cash, Invoice Payment, Travel Allowance, Cash Advance and Claims.
- The unified Finance table includes payment reference and transaction-proof state. Claims additionally provide a Claim type filter. Multi-selection opens an overlay with Previous, Next and Close controls instead of navigating to the legacy bulk page.
- Payment-type tab count badges use a pale amber background with dark amber text to communicate pending work. The rendered count element is `<b>`, so the effective selector is `.tabs button b` rather than `.typeTabs button span`.

### Current Finance overlay architecture

- `generated/src/features/payment-request/components/finance-pending-processing/finance-pending-processing.tsx` owns the combined queue, filters, selection, shared overlay shell and navigation between selected records.
- Payment-specific detail and action implementations remain in their own feature folders and are imported by the unified queue. Invoice Payment, Travel Allowance, Cash Advance, Petty Cash and Claims are imported directly, and the unified queue passes each already-loaded request into its Finance review as `initialRecord`. This removes the lazy-chunk placeholder and redundant detail fetch so opening an overlay is immediate; the accepted tradeoff is a larger initial Finance page bundle.
- Those payment-specific `*-finance-review.tsx` files are still active dependencies and must not be deleted merely because their old queue navigation was merged.
- Normalized embedded review presentation: Cash Advance now receives the same 20px left/right overlay inset as the `<main>`-rooted Invoice, Travel, Petty Cash and Claims reviews. Invoice Payment uses its green ARUS top indicator and Travel Allowance uses its orange ARUS top indicator, matching the existing Cash Advance red and Claims dark indicators.
- Aligned Finance action gating across payment types. Cash Advance `Confirm payment` is disabled until payment date and bank reference are present, and `Return to Staff` requires at least three characters of remarks. Invoice `Verify and mark as completed` now requires an explicit reviewed-invoice/approvals/documents confirmation checkbox; handler-level guards mirror all disabled-button rules.
- Revised Cash Advance payment recording: Payment reference is read-only and automatically uses the saved Finance reference when present or otherwise the Cash Advance request number. Finance must tick `I confirm that this payment has been processed` before `Confirm payment` becomes enabled; the handler enforces the same requirement. Return-to-Staff remarks validation remains unchanged.
- Increased embedded Cash Advance detail typography to a medium scale (18px section headings, 12px labels/table headers and 14px values/table cells) and standardized every shared Current next process card at 11px label, 16px title and 13px description.
- Added an inline Invoice e-invoice preview below the existing external link. Direct image/data URLs render as contained images; other links use a lazy embedded frame and retain the external link as fallback for sources that block framing.
- Payment Voucher now follows the same separation. Its Finance workflow and prototype layout live in `generated/src/features/payment-voucher/components/finance/finance-processing-panel.tsx`, with styles in `finance-processing-panel.module.css`. The unified queue imports `FinanceProcessingPanel`; it no longer contains inline PV-specific state, API calls, markup or styling.

### Payment Voucher Finance design and behaviour

- The PV overlay matches the supplied prototype: a single rounded two-column workspace beneath the shared modal header and above the shared Previous/Next/Close footer.
- The left column is one consolidated details surface containing Payment details, Recipient information and the complete Payment breakdown with grand total.
- The right pale Finance rail contains payment date, a read-only payment reference automatically set to the PV number, payment-receipt upload, optional Finance remarks, the navy Generate PV action, signed-PV download when available and a compact Current next process card at the bottom.
- Generate PV records Finance payment information, marks the PV as generated and notifies the requester to deliver it to the external recipient for signing. It does not force a browser download.
- The PV Finance rail exposes the established bank-rejection/inactive workflow as a visible red-outlined `Bank rejected` button beside `Generate PV`. Opening it requires remarks before `Mark PV as bank rejected`; the action locks the original PV and notifies Staff to create a new voucher when another payment attempt is required.
- The unified overlay now uses a fixed flex-column modal frame so the Previous, Next and Close footer remains visible while only the detail body scrolls. Disabled navigation buttons retain readable contrast.

### Petty Cash Finance lifecycle

- Petty Cash is an advance workflow. Finance releases funds first; the requester later submits purchase receipts and reconciliation information.
- Purchase receipts are mandatory. A positive remaining balance requires return details and proof; zero balance requires the no-balance declaration or explanatory remark defined by the current form.
- Finance verifies the reconciliation or returns it with correction remarks. A completed reconciliation records returned money where applicable and closes the request as `RECONCILED`.

### Cleanup and verification notes

- Old payment-specific queue and bulk-route files are cleanup candidates only after checking all sidebar links, direct routes, back links and imports. Do not delete payment-specific Finance review components currently embedded by the unified queue.
- Formatting passes for the latest extracted PV panel and unified queue changes.
- A complete project TypeScript/build verification cannot run from this handoff scaffold because it has no independent dependencies. Copy the files into the live project and run that project's verified checks there. A direct standalone check currently stops at expected missing React, alias and CSS-module resolution.

# Historical Timeline

## 2026-10-22 — Standardized payment-status source implementation

- Corrected an initial misunderstanding: the Excel testing tracker was restored to its prior 89-test content. The status amendment belongs in the application source, not the tracker.
- Added a shared `standard-payment-status.ts` mapper for Invoice Payment, Travel Allowance, Cash Advance, Claims and Petty Cash. Payment Voucher remains unchanged.
- Standardized the affected queues, status badges, confirmations and primary review screens to the requested user-facing labels: Draft, Submitted, Pending Manager Approval, Pending Director Approval, Payment Rejected, Finance Verifying, Payment is processed, and Payment transaction proof has been uploaded.
- Preserved existing internal status enums and Cash Advance reconciliation routing. Existing rejection-reason fields remain visible on rejected detail/review screens.
- Focused TypeScript and ESLint validation passed for the generated copy-ready source.
- Added `generated/STANDARD_PAYMENT_STATUS_COPY_FILES.md` as the complete copy manifest. It lists every copy-ready source file, its matching live-project destination and the required copy order.
- Packaged all 24 complete updated source files under `outputs/standard-payment-status-copy/src` with their exact live-project folder structure, plus `outputs/standard-payment-status-copy.zip` for one-step copying.

## 2026-10-22 — Testing tracker Google Sheet and workflow coverage

- Expanded `outputs/estuary-testing-tracker/Estuary_Testing_Tracker.xlsx` from 72 to 89 workflow tests.
- Added valid and invalid Google Sheet Link coverage for bulk Payment Vouchers and Travel Allowances.
- Added Cash Advance Google Sheet coverage for both request entry and reconciliation, plus returned-reconciliation correction, resubmission and Finance completion.
- Added Claims Google Sheet coverage for all six Claim types: Expense, Internet / commute, Medical, Mileage, PD and Tech. Also added mismatched Claim-type and inaccessible-link validation cases.
- Preserved the existing workbook tabs, formatting, validations, conditional formatting and formula-driven Overview. The final formula-error scan returned no matches.

## 2026-10-21 — Cross-payment queue-filter date decision

- Confirmed that Manager, Director and Finance queue filters for Invoice Payment, Cash Advance, Travel Allowance, Claims and Petty Cash should use the request submission/updated date for Month and Exact date.
- This keeps filter behaviour consistent across payment types instead of changing to travel, claim or payment dates.

## 2026-10-21 — Intermittent local PostgreSQL outage diagnosis

- The recurring Prisma `Can't reach database server at 127.0.0.1:15432` failure occurs because no process is listening on the configured database port when the error appears.
- This is database-process availability, not a query, migration, dashboard, or connection-limit error. Restarting temporarily helps only because the local database launcher is also being restarted or becomes available again.
- The documented setup still refers to Docker, but this machine has no persistent Docker/PostgreSQL process detected. Development should use a persistent PostgreSQL Windows service/container rather than a temporary embedded instance.

## 2026-10-21 — Director Payment Voucher filter card

- Added the missing Director approvals page and its Payment Voucher stylesheet to the generated copy workspace.
- Added the standalone Search, Status, Month, Exact date and Sort filter card between the four Director statistics and approval records.
- Replaced the visible Pending/History and history-filter tab rows with the Status dropdown, while preserving their underlying filtering behaviour.
- Focused ESLint and strict TypeScript validation passed.

## 2026-10-21 — Manager duplicate tabs and ESLint cleanup

- Removed the visible Manager Payment Voucher queue-tab row because status selection is handled by the standalone filter card.
- Replaced synchronous session state updates inside the Manager page effect with lazy account initialization, preserving the unauthenticated redirect without cascading renders.
- Focused ESLint and strict TypeScript validation passed.

## 2026-10-21 — Finance duplicate queue tabs removed

- Removed the visible Finance Payment Voucher queue-tab row because status selection is now handled by the standalone filter card.
- The records panel now moves directly from its heading to the result count and Grid/List controls.

## 2026-10-21 — Standalone Payment Voucher filter cards

- Reworked the Finance and Manager Payment Voucher pages to match the supplied wireframe: statistics, a standalone filter card, then a separate records card containing the queue tabs.
- Added Search, Status, Month, Exact date, Sort and Clear filters. Sorting supports newest, oldest waiting, highest amount and lowest amount.
- Added responsive two-column and single-column filter layouts.
- The generated scaffold does not currently contain the main Director `approvals/page.tsx`; the same treatment remains to be applied when that source is added to the copy workspace.
- Focused strict TypeScript checking passed.

## 2026-10-21 — Finance page unused helper cleanup

- Removed the unused `formatDate` helper from the Finance Payment Voucher page after the filter-card refactor, clearing the `@typescript-eslint/no-unused-vars` warning.

## 2026-10-21 — Finance page effect lint fix

- Removed synchronous React state updates from the Finance page effects to satisfy the cascading-render lint rule.
- The signed-in account now uses lazy state initialization, while URL-driven queue/modal state is scheduled after the effect with cancellation protection.
- Preserved the existing redirect, processing-queue selection, voucher opening and transition-message behaviour.

## 2026-10-21 — Finance Payment Voucher filter-card placement

- Added the Payment Records-style filter card to the actual main Finance Payment Vouchers page rather than only the separate bulk-processing component.
- Positioned it between the four Finance statistics and the Payment Voucher results panel, with search, queue-status tabs and a Clear filters action.
- Kept the records in a separate `Finance Payment Vouchers` panel below the filter card.
- Focused strict TypeScript checking passed.

## 2026-10-21 — Role action-queue filter cards

- Standardised Finance, Manager and Director action queues with a Payment Records-style filter-card surface around their existing search, status and view controls.
- Applied the shared visual treatment to Invoice Payment, Travel Allowance, Cash Advance, Petty Cash and Claims queues without changing their role-specific workflow rules.
- Added the previously missing Payment Voucher search for Finance processing and Manager preview, matching PV number, recipient, requester, purpose and division.
- Focused strict TypeScript checking passed for the changed Payment Voucher queue components.

## 2026-10-21 — SQL Tracker terminal-status eligibility

- Tightened SQL Entry Tracker eligibility so records appear only after their payment workflow reaches its terminal paid/completed status.
- Payment Vouchers, Invoice Payments, Travel Allowances and Cash Advances now require `COMPLETED`; Petty Cash and Claims require `PAID`.
- Removed date-field shortcuts that could expose records while approval, payment processing or reconciliation was still underway.

## 2026-10-21 — Brighter expenditure graph palette

- Changed only the dashboard expenditure graph and its summary legend to a brighter visualisation palette: Payment Voucher blue, Invoice green, Travel Allowance purple, Cash Advance amber, Petty Cash teal and Claims pink.
- Other dashboard components retain the established ARUS category colours.

## 2026-10-21 — Dashboard cards returned to white

- Removed the payment-category gradients from the dashboard portfolio cards and restored a clean white card background.
- Retained the ARUS category colours on the payment-type badges so each category remains easy to identify without tinting the full card.

## 2026-10-21 — SQL Entry Tracker status-card dashboard

- Replaced the compact pending, recorded and correction legend with three dashboard summary cards matching the approved prototype.
- Pending SQL Entry now uses an amber-tinted card and amber text; Recorded uses green and Need correction uses red/pink styling.
- Kept the completion percentage and full-width progress bar, with the status cards stacking into one column on small screens.
- Focused strict TypeScript checking passed.

## 2026-10-21 — Finance SQL Entry Tracker bulk selection

- Added row selection, select-all for the currently visible filtered records, a sticky selection summary and a bulk-update modal to the Finance SQL Entry Tracker.
- Bulk updates support all four SQL statuses. Recorded entries require a shared recorded date plus a separate SQL reference for every selected payment; correction updates require notes.
- Each selected payment is persisted through the existing Finance-authorised Prisma save operation, preserving per-submission organisation checks and independent SQL references.
- Moved Finance `SQL Entry Tracker` out of `Payment processing` into its own `SQL system` sidebar group to match the approved wireframe.
- Focused strict TypeScript checking passed. Copy destinations are listed in `generated/SQL_ENTRY_TRACKER_BULK_COPY_FILES.md`.

## 2026-10-21 — Dashboard ARUS card gradients

- Added subtle ARUS-colour gradients to the six dashboard payment portfolio cards, fading each category tint into white to preserve contrast and readability.
- Payment Voucher uses navy, Invoice green, Travel orange, Cash Advance red, Claims black/grey, and Petty Cash a very light navy tint so its white identity remains visible.
- The change is CSS-only; copy instructions are in `generated/DASHBOARD_PAYMENT_GRADIENT_COPY_FILES.md`.

## 2026-10-21 — Compact prototype sidebar and record-card actions

- Restyled the shared Beta sidebar to follow the compact prototype: dark navy surface, white Estuary identity, muted uppercase role/group labels, grouped translucent navigation panels and a clearer slate active state.
- Changed the shared Payment Records/My Requests category-card action from a large solid bar to a compact white outlined `View records →` button with a dark hover state.
- The changes are CSS-only and therefore apply across every role and both record scopes without duplicating component logic. Copy destinations are listed in `generated/SIDEBAR_AND_RECORD_BUTTON_COPY_FILES.md`.
- Refined sidebar action-count badges into fixed solid-red circles with centred white numbers for stronger contrast on the dark navigation.

## 2026-10-21 — ExcelJS Buffer type compatibility fix

- Fixed the Google Sheet XLSX smart-chip reader's TypeScript failure under the live project's newer Node Buffer typings.
- The route still creates a real Node `Buffer` at runtime, but now narrows it to ExcelJS's declared `load` parameter type to bridge the dependency typing mismatch safely.
- The updated route passed the focused strict TypeScript check together with the Prisma-backed SQL Entry Tracker integration.

## 2026-10-21 — Prisma-backed Finance SQL Entry Tracker integration

- Replaced the SQL Entry Tracker's browser-only persistence with a Finance-authorised API backed by Afiq's approved `SqlEntryTracking` Prisma model.
- Added list and upsert repository operations scoped to the signed-in Finance user's active organisation membership. The server verifies the `FINANCE_ADMIN` role, prevents cross-organisation submission updates, and requires an SQL reference and recorded date for `RECORDED_IN_SQL_SYSTEM`.
- Added client API helpers and changed the tracker to merge shared database entries into paid/completed records across all six payment types. The update modal now saves through the API, and the interface identifies the tracker as shared database data instead of an interface preview.
- No schema or migration was added or changed. Copy instructions are in `generated/SQL_ENTRY_TRACKER_PRISMA_COPY_FILES.md`.
- The five-file integration passed a focused strict TypeScript check against the live project's newly generated Prisma Client.

## 2026-10-20 — Dashboard database loading diagnosis

- Confirmed the dashboard fallback message is unrelated to the removed SQL Tracker migration. `/api/v1/dashboard/records` fails on the existing `prisma.submission.findMany()` call before SQL Tracker state is involved.
- The live project's generated Prisma Client reports `copyEngine: false`, meaning it was generated in no-engine/Accelerate mode. Estuary supplies a normal PostgreSQL `DATABASE_URL`, so that client rejects it and asks for a `prisma://` or `prisma+postgres://` URL.
- The live schema still uses the standard PostgreSQL provider. Regenerate Prisma Client normally (without `--no-engine` or `PRISMA_GENERATE_NO_ENGINE`) and restart the Next.js development server; do not convert the existing database URL to an Accelerate URL unless the project intentionally adopts Prisma Accelerate.

## 2026-10-20 — Estuary testing tracker workbook

- Created `outputs/estuary-testing-tracker/Estuary_Testing_Tracker.xlsx` for UAT tracking.
- The workbook contains an automatic Overview, separate tabs for all six payment types, role-based workflow test cases, status and severity dropdowns, conditional status colours, frozen headers, filters, evidence fields, and a central Bug Log.
- Seeded 72 workflow tests covering Staff, Manager, Director and Finance actions from draft and validation through approval, return/rejection, payment, completion and reconciliation where applicable.
- Verified all eight worksheet layouts and scanned the workbook formulas with no spreadsheet errors found.

## 2026-10-19 — Preserve smart-chip label through Finance handoff

- Fixed Claim persistence so a retrieved smart chip keeps its display filename, MIME metadata and file-size metadata when the receipt is a linked Drive document rather than an uploaded file.
- Previously the database save retained `receiptLink` but reset `receiptFileName` to an empty string, causing Finance to see the long URL as the chip label.
- New submissions now preserve the same `display label + clickable URL` pair from Staff retrieval through Manager, Director and Finance review screens.
- All 18 focused document-reference tests passed; focused ESLint and TypeScript checking also passed.

## 2026-10-19 — No-key extraction of renamed Google Drive smart chips

- Added public XLSX workbook retrieval to the shared Google Sheet route. XLSX retains both sides of a renamed Google Drive smart chip: its visible filename and original hyperlink.
- Estuary now merges XLSX hyperlinks with public HTML links and optional Google Sheets API metadata before parsing Claim and Cash Advance receipt rows.
- This provides reliable no-key extraction for sheets shared as “Anyone with the link can view”; private sheets still require authenticated Google access.
- All 18 focused document-reference and Google Sheet tests passed, along with focused ESLint, TypeScript checking and the Next.js production build.

## 2026-10-19 — Lenient raw URL and smart-chip document references

- Document chips now accept both raw web URLs and Google Sheet smart-chip filenames resolved through rich-link metadata.
- Added safe repairs for common pasted-link formats such as `https//drive.com`, `http//...`, and `www.example.com/...`; ordinary filenames such as `receipt.pdf` are not misclassified as URLs.
- Applied normalized URL storage to Claim and Cash Advance reconciliation sheet imports, and the shared chip renderer now uses the repaired URL when opening a document.
- All 17 focused document-reference and Google Sheet tests passed; focused ESLint and TypeScript checking also passed.

## 2026-10-19 — Smart-chip clickability label-matching fix

- Fixed a case where a retrieved smart chip rendered as a non-clickable grey chip because the CSV filename and public HTML link label used different Unicode dash or whitespace characters.
- Added normalized rich-link matching for Google Sheet document labels and applied it to Claims and Cash Advance reconciliation imports.
- Existing records that were previously saved with only a filename still need to be retrieved from the sheet and submitted again because they contain no stored URL to open.
- All 14 focused Google Sheet and smart-chip tests passed; focused ESLint and TypeScript checking also passed.

## 2026-10-19 — Clickable Google Sheets smart chips without a required API key

- Strengthened the shared Google Sheet retrieval route so publicly shared sheets are checked through both Google HTML view and Google Visualization HTML output, in addition to CSV.
- The hidden URL behind a file smart chip is preserved and submitted with its visible label, allowing Staff and later reviewers to click the rendered document chip without requiring a Google API key.
- `GOOGLE_SHEETS_API_KEY` remains an optional fallback. A no-key sheet must be shared as “Anyone with the link can view”; private Google files still enforce their own access permissions when opened.
- Added coverage for direct Drive smart-chip anchors and Google redirect links. Smart-chip tests, focused ESLint and TypeScript checking passed.

## 2026-10-19 — Direct styling coverage for every Payment Request type

- Added the compact review/detail treatment directly to the individual Payment Voucher, Travel Allowance, Cash Advance, Petty Cash and Claims style modules; Invoice Payment retains its earlier direct implementation.
- Each request type now owns its ARUS-coloured top indicator instead of relying only on the beta-shell selector: PV navy, Travel orange, Cash Advance red, Claims black, and Petty Cash white with a dark inset edge.
- Kept workflow/progress rails in normal document flow and removed constrained internal scrolling from the affected request modules.
- TypeScript, focused ESLint and the Next.js production build passed.

## 2026-10-19 — Unified Payment Request review styling

- Applied the ARUS payment-type indicator to request review/detail surfaces across Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance, Petty Cash and Claims.
- Kept review-page headings compact and updated the Invoice staff-review badge to “Review & Verification Stage”.
- Removed sticky and independently scrolling behavior from request workflow/progress rails so they remain static in the page layout and the main page performs the scrolling.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-19 — Detail-card payment-type indicator placement

- Moved the route-aware ARUS payment-type indicator from a separate chip beneath the global header onto the top edge of the main request detail card, matching the supplied Invoice prototype.
- Invoice detail pages now show the green `#0c6f50` top edge; the same route-level mapping retains the defined colors for Payment Voucher, Travel Allowance, Cash Advance, Claims and Petty Cash.
- Petty Cash keeps a subtle dark inset edge so its white category color remains visible on the white card.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-08 — Claims detail button hover refinement

- Changed the Claims record-detail hover from solid dark navy to a soft
  light-blue fill with blue text and a gentler blue shadow, matching the user's
  preferred outlined-button reference.
- Added a slightly stronger light-blue pressed state while retaining the compact
  sizing, border, lift and keyboard focus behavior.

## 2026-10-08 — Claims record-detail button styling

- Standardized Claims record-detail links in the live Claims stylesheet using
  a scoped URL selector under the Claims page.
- Buttons now use compact white/blue styling by default and transition to a
  dark navy background with white text, a subtle lift and shadow on hover.
- Added matching active and keyboard focus-visible states without affecting
  Claims back-navigation or unrelated links.

## 2026-10-08 — Beta shell hydration-safe session state

- Replaced the live Beta shell's render-time `localStorage` session read with
  `useSyncExternalStore` and an explicit server snapshot.
- The server and initial hydration render now both use the loading state; the
  authenticated shell appears only after the browser session snapshot is
  available, preventing the reported `<main>` versus `<div>` mismatch.
- Added storage/custom-event subscriptions and dispatch the custom event during
  sign-out, without adding synchronous state setters to an effect.
- The local process launcher remained unavailable, so focused ESLint and
  TypeScript verification could not be executed.

## 2026-10-08 — Cash Advance repository unused metadata cleanup

- Removed the unused `financeMetadata` declaration from the live Prisma Cash
  Advance repository, resolving `@typescript-eslint/no-unused-vars` without
  changing record mapping or Finance payment behavior.
- The generated repository copy was already clean. The local process launcher
  remained unavailable, so focused ESLint execution could not be run.

## 2026-10-08 — Bulk manual-entry expansion effect cleanup

- Updated the live bulk Payment Voucher manual-entry panel so its automatic
  first-row expansion is scheduled from a timer callback rather than calling
  `setExpandedRowId` synchronously in the effect body.
- Preserved the existing behavior when the current expanded row is no longer
  available while resolving `react-hooks/set-state-in-effect` at the reported
  line.
- The local process launcher remained unavailable, so focused ESLint execution
  could not be run.

## 2026-10-08 — Unused ESLint directive warning policy

- Updated the active ESLint 9 flat configuration to set
  `reportUnusedDisableDirectives` to `off`.
- Existing image-rule suppression comments in the Finance Processing and
  Recipient Payment Voucher components therefore no longer produce warnings
  after `@next/next/no-img-element` was disabled centrally.
- Kept all substantive React, TypeScript, Next.js and accessibility rules
  active. Updated both the live project and repository config copies.
- The local process launcher remained unavailable, so the zero-warning lint
  command could not be rerun in this session.

## 2026-10-08 — Finance payment image directive cleanup

- Removed the obsolete inline `@next/next/no-img-element` disable comment from
  the live Finance Payment panel now that the rule is disabled centrally.
- This resolves ESLint's unused-disable-directive warning without changing the
  rendered image or Finance workflow.
- The local process launcher remained unavailable, so focused zero-warning
  ESLint execution was not run.

## 2026-10-08 — Travel Allowance correction effect cleanup

- Updated the live Staff Travel Allowance edit component to read the beta
  account through lazy state initialization and derive access/error/checked
  defaults before the loading effect runs.
- The effect now only performs asynchronous loading and guarded callback state
  updates, with cleanup preventing updates after unmount.
- This removes the direct `setError` and `setChecked` calls that triggered
  `react-hooks/set-state-in-effect`. The local process launcher remained
  unavailable, so focused ESLint execution was not run.

## 2026-10-08 — Travel Allowance Manager queue effect cleanup

- Updated the live Travel Allowance Manager queue to initialize its beta
  account lazily rather than calling `setAccount` inside an effect.
- Initialized checked state for invalid sessions and changed the loading effect
  to use the stable account value; remaining state updates occur only from the
  asynchronous request callbacks.
- Added the account dependency to the loading effect. The local process launcher
  remained unavailable, so focused zero-warning ESLint execution was not run.

## 2026-10-08 — Claim role queue session and prop cleanup

- Updated the live role-based Claim queue to initialize its account lazily and
  removed the synchronous `setAccount` effect update.
- Initialized the checked state for invalid sessions and kept subsequent state
  changes in asynchronous request callbacks.
- Removed the now-unused `pendingStatus` destructuring binding left behind after
  the earlier manual-memoization removal; the prop type remains compatible with
  existing callers.
- The local process launcher remained unavailable, so focused ESLint execution
  could not be performed in this session.

## 2026-10-08 — Claim queue memoization error cleanup

- Removed the unnecessary `useMemo` wrapper from the live role-based Claim
  queue's inexpensive record filter.
- This removes the React Compiler dependency mismatch involving `needsAction`
  while preserving the same filtering, searching and sorting result.
- Removed the now-unused `useMemo` import. The local process launcher remained
  unavailable, so focused ESLint verification could not be executed.

## 2026-10-08 — Claim form unused setter cleanup

- Removed the unused `setSheetMessage` binding from the live Claim form while
  retaining the existing `sheetMessage` value consumed by the rendered form.
- This resolves both TypeScript `ts(6133)` and
  `@typescript-eslint/no-unused-vars` diagnostics shown by the editor.
- The local process launcher remained unavailable, so the focused zero-warning
  ESLint command could not be rerun in this session.

## 2026-10-08 — Cash Advance Finance queue effect cleanup

- Updated the live Cash Advance Finance queue to initialize its beta account
  lazily instead of calling `setAccount` synchronously inside an effect.
- Derived the unauthorized-account error from the initial session and left the
  data effect responsible only for asynchronous Cash Advance loading.
- Changed filter/search pagination reset to a cancellable timer callback,
  removing the second direct state update from the effect while preserving the
  reset-to-page-one behavior.
- The local execution helper still fails before processes start, so the focused
  `eslint --max-warnings 0` verification could not be executed in this session.

## 2026-10-08 — Native image ESLint allowance

- Disabled `@next/next/no-img-element` in the active ESLint 9 flat config so
  native `<img>` and Next.js `<Image>` are both accepted project-wide.
- Kept image accessibility and all unrelated Next.js, React and TypeScript lint
  rules enabled.
- Updated both the live project config and its repository copy. The local
  command runner remained unavailable, so `eslint . --max-warnings 0` could not
  be rerun in this session.

## 2026-10-08 — Director signature image lint cleanup

- Replaced the raw HTML signature `<img>` in the live Director signature upload
  component with Next.js `Image`.
- Added explicit intrinsic dimensions and `unoptimized` for the dynamic
  signature source, resolving `@next/next/no-img-element` without suppressing
  the rule.
- The command execution helper was unavailable after the edit, so the focused
  zero-warning ESLint command could not be rerun in this session.

## 2026-10-08 — Lenient ESLint identifier naming

- Updated the ESLint 9 flat configuration so the core `camelcase` rule is off
  globally, allowing both camelCase application identifiers and snake_case
  Prisma/database identifiers without per-file suppression comments.
- Kept `new-cap` and the Next.js/TypeScript rule sets active; only identifier
  naming was relaxed.
- Kept the legacy `.eslintrc.json` fallback aligned with `eslint.config.mjs` and
  copied both configurations to the live Estuary project.

## 2026-10-07 — Full attached lint report cleanup

- Cleared all 719 diagnostics from the pasted report across the Prisma seed,
  Dashboard and payment-request repositories, beta role pages, Signature
  Settings, Payment Records and shared list pagination.
- Added documented file-scoped `camelcase` exceptions only where identifiers
  must match the existing snake_case Prisma schema; removed the unused Cash
  Advance metadata value without changing repository behavior.
- Reworked beta-session initialization and URL-derived Finance state so effects
  only redirect, synchronize browser history or apply asynchronous results.
  Pagination now resets through derived state rather than a synchronous effect.
- Updated all 17 affected files in the live project and mirrored the available
  generated seed, Dashboard and Cash Advance repository copies.
- Verified the entire live project: `pnpm lint` passes, and
  `tsc --noEmit --incremental false` passes.

## 2026-10-07 — Prisma adapters and Cash Advance records lint cleanup

- Added documented, file-scoped `camelcase` exceptions to the Petty Cash,
  Travel Allowance and Payment Voucher Prisma repositories because their field
  names intentionally mirror the existing snake_case Prisma/database schema.
- Updated the Cash Advance Payment Records list to initialize its beta session
  lazily and guard asynchronous loading updates during effect cleanup.
- Mirrored all available source copies, including the standalone generated
  Payment Voucher Prisma repository.
- The focused lint run now passes with zero diagnostics (resolving the pasted
  set of 888 errors). Petty Cash, Travel Allowance and Cash Advance generated
  TypeScript checks and the full live TypeScript compilation all pass.

## 2026-10-07 — Prisma signature repository camelcase lint fix

- Added a documented, file-scoped `camelcase` exception to the Prisma signature
  repository because its field and compound-key identifiers intentionally match
  the existing snake_case Prisma/database schema.
- Preserved every query and database field name, avoiding a breaking schema or
  migration change. Updated both live and generated copies.
- Focused repository ESLint and the full live TypeScript compilation with
  incremental output disabled both pass.

## 2026-10-07 — Signature and PV service-stub lint cleanup

- Updated both signature upload components so object URLs are created by file
  selection handlers and effects only revoke them during cleanup; successful
  saves also clear the preview.
- Replaced raw signature `<img>` elements with explicit, unoptimized Next.js
  `Image` components and switched the legacy Director upload screen to the
  existing shared `useUserSignature` hook, removing its missing-hook type error.
- Marked the intentionally unused notification, beta-PDF and storage adapter
  inputs as consumed while retaining their explicit not-yet-connected errors.
- Mirrored the shared signature upload changes in generated source. Focused
  ESLint passes with zero diagnostics. Full live TypeScript compilation passes
  with incremental output disabled; the package script itself remains unable to
  write OneDrive's `tsconfig.tsbuildinfo` because of `EPERM`.

## 2026-10-07 — Petty Cash, Travel Allowance and bulk PV lint cleanup

- Updated Petty Cash Director, Finance and Manager queues plus the Staff detail
  page to initialize sessions lazily and guard asynchronous state updates during
  effect cleanup.
- Updated the Petty Cash ledger so filter handlers establish loading/error state
  while its effect only performs the external fetch and guarded callbacks.
- Applied the same session and request-loading pattern to the Travel Allowance
  Director, Finance and Manager queues and the Staff correction page. Finance
  month changes now reset loading state in the input handler.
- Replaced the bulk Payment Voucher row-repair effect with a derived active row
  identifier, preserving the first-row fallback without synchronous effect state.
- Mirrored changes in live and generated source. Focused ESLint passes with zero
  diagnostics, and the Petty Cash, Travel Allowance and bulk Payment Voucher
  TypeScript configurations all pass.

## 2026-10-07 — Claims and Invoice Payment request lint cleanup

- Removed the unused Claims Google Sheet success-message state and initialized
  the Claim form session lazily.
- Updated Claims Manager/role queues to initialize session/loading state without
  synchronous effect setters, guard asynchronous request updates during cleanup,
  and move action predicates outside component memoization so React Compiler can
  preserve the queue filters.
- Updated Invoice Payment Director, Finance and Manager queues plus the Staff
  correction editor with lazy session state and cancellation-safe fetch effects.
- Mirrored the changes in live and generated source. Focused ESLint passes with
  zero errors or warnings; focused Claims and Invoice Payment TypeScript checks
  also pass.

## 2026-10-07 — Travel Allowance and Cash Advance lint cleanup

- Updated Travel Allowance record detail/list loading to initialize the beta
  account lazily and keep `useEffect` state updates inside guarded asynchronous
  callbacks with cleanup cancellation.
- Updated the Cash Advance Director, Finance, Manager and Staff queues to avoid
  synchronous effect state changes. Search/filter handlers now reset pagination
  directly instead of using a pagination-reset effect.
- Initialized the Cash Advance request account and default account-holder name
  without an effect, and replaced three raw signature images with unoptimized
  Next.js `Image` components carrying explicit dimensions.
- Mirrored all changes in live and generated source. Focused ESLint for both
  feature folders and focused TypeScript compilation for both generated feature
  configurations pass with no diagnostics.

## 2026-10-07 — Invoice and Petty Cash records effect lint fixes

- Updated the Invoice Payment record detail/list and Petty Cash records list to
  initialize the beta account lazily instead of synchronously setting it inside
  `useEffect`.
- Loading effects now perform only asynchronous repository calls, guard all
  promise-driven state updates, and cancel updates after cleanup. Updated both
  live and generated copies.

## 2026-10-07 — Claims Payment Records effect lint fixes

- Updated both the Claims records list and record-detail components to read the
  beta session through lazy state initialization instead of calling account and
  checked-state setters synchronously inside `useEffect`.
- Their effects now contain only asynchronous Claim loading, with guarded
  promise callbacks and cleanup cancellation. Updated live and generated files.

## 2026-10-07 — Cash Advance record-detail lint fix

- Removed the unused live Cash Advance records stylesheet import.
- Read the signed-in account through lazy state initialization instead of
  synchronously setting account/error state inside `useEffect`.
- The request-loading effect now performs only the external fetch and updates
  state from its promise callbacks, with cancellation protection during
  unmount or request changes. Updated live and generated source.

## 2026-10-07 — Notification hook effect lint fix

- Fixed `react-hooks/set-state-in-effect` in `use-notifications.ts` by keeping
  the external-store subscription synchronous while scheduling the initial
  `refresh` for the next event-loop turn.
- Cleanup now cancels the pending initial refresh and unsubscribes from both
  notification events. Updated the live and generated copies.

## 2026-10-07 — Director Petty Cash route 404 fix

- Added the missing Director Petty Cash queue route at
  `/beta/director/payment-requests/petty-cash` and the dynamic preview route at
  `/beta/director/payment-requests/petty-cash/[requestId]` in both generated and
  live source.
- The existing sidebar, notification and queue links now resolve to the
  Director queue and `PettyCashDirectorReview` instead of reaching Next.js 404.
- Added both pages to the Petty Cash implementation copy map.

## 2026-10-07 — Non-blocking Petty Cash previews

- Changed all new Petty Cash submissions to enter `PENDING_FINANCE_PAYMENT`
  immediately. Manager, Director and Finance-peer preview steps remain durable
  approval-step assignments but no longer control the request state or Finance
  assignee.
- Staff requests notify both assigned previewers and Finance; Manager requests
  notify the Director and Finance; Director requests notify Finance; Finance
  requests support a different Finance user, Manager or Director as the
  independent previewer while still notifying Finance for processing.
- Manager and Director queues now count missing preview timestamps rather than
  legacy pending-approval states. Their detail screens record informational
  previews only and no longer expose return controls.
- Updated confirmation and Payment Records tracking to show Finance as active
  immediately while unfinished previews remain informational instead of being
  falsely marked complete. Dashboard/sidebar action rules now count assigned
  Petty Cash previews independently from Finance status.
- Updated both copy-ready and live source. Focused Petty Cash TypeScript
  compilation passes. The live compiler reached only the existing unrelated
  missing `use-director-signature` module, and OneDrive blocked writing
  `tsconfig.tsbuildinfo`.

## 2026-10-07 — Petty Cash manual-entry-only cleanup

- Kept the existing Petty Cash manual-entry request, correction, approval,
  Finance, Payment Records and ledger workflows unchanged.
- Removed the Petty Cash Google Sheet entry tab, importer component and
  Sheet-specific submission path. The shared Google Sheet API remains because
  other payment types still use it.
- Removed the generated Petty Cash PDF card from Staff, Manager, Director and
  Finance details; removed Payment Records form ZIP entries and the ledger form
  preview link while preserving receipt/proof links.
- Deleted the Petty Cash PDF component, builder, API route, live PDF template
  and the corresponding now-empty PDF/route directories from both generated
  and live source where applicable.
- Removed the obsolete Petty Cash Google Sheet copy map and updated the Petty
  Cash implementation map, bulk-download notes, README, roadmap and durable
  project memory.
- Verification: `generated/tsconfig.petty-cash.json` passes with zero errors;
  repository searches find no remaining Petty Cash Google Sheet/PDF imports or
  URLs. Live full-project checking was attempted but was blocked by a stale
  `.estuary-next` route validator, an existing unrelated missing signature-hook
  import, and an EPERM write to `tsconfig.tsbuildinfo`. The local dev server was
  not running for an HTTP smoke test.

## 2026-10-06 — Claim PDF route-level 404 follow-up

- Confirmed the running Next.js manifest did not register the newer nested
  `/api/v1/payment-requests/claims/[id]/form` route, which caused the generic
  Next.js 404 before any Claim lookup or PDF generation occurred.
- Added Claim PDF preview/download handling to the already-registered
  `/api/v1/payment-requests/claims/[id]` endpoint behind `?form=1`; use
  `&download=1` for attachment delivery.
- Updated Claim detail preview/download buttons and Claims Payment Records ZIP
  entries to use the stable Claim number with the registered endpoint.
- Applied the change to both `generated/src` and the live Next.js source.
- Live verification against `localhost:3000` for Claim `CL26-10-03`:
  preview returned HTTP 200, `application/pdf`, inline disposition; download
  returned HTTP 200, `application/pdf`, attachment disposition. Focused Claims
  TypeScript compilation also passed.

## 2026-10-06 — Stable Claim form preview and download URLs

- Fixed Claim form Preview, direct PDF Download and Payment Records ZIP entries
  to address the form API with the stable Claim number rather than the internal
  database UUID. The Claims repository already resolves either identifier, so
  this also remains compatible with existing records.
- Applied the fix to both `generated/src` and the live Next.js source under
  `C:/Users/hp/OneDrive/Documents/Estuary-main/src`.
- Confirmed the Next.js development manifest registers the dynamic Claim form
  route at `/api/v1/payment-requests/claims/[id]/form`.
- Verified all six configured Claim templates (Expense, Internet / commute,
  Medical, Mileage, PD and Tech) are present and readable one-page PDF files.
- Focused Claims TypeScript compilation passes. A direct TSX PDF-generation
  smoke test could not start because the local Node runtime failed in
  `os.userInfo()` with `uv_os_get_passwd ENOMEM`; this occurred before project
  code loaded and is an environment limitation, not an application diagnostic.

## 2026-10-06 — Claim type filters for approval and processing queues

- Added a reusable Claim type dropdown beside Search in the Manager, Director
  and Finance Claims queues. The options come from the shared `CLAIM_TYPES`
  domain constant and default to `All Claim types`.
- Combined the type selection with the existing status tabs and text search in
  both grid and list views. Pagination resets automatically when the filtered
  result set changes through the existing list-pagination hook.
- Added responsive queue-filter styling: type and search remain side by side on
  wider screens and stack on small mobile screens.
- Updated both `generated/src` and the live Next.js source under
  `C:/Users/hp/OneDrive/Documents/Estuary-main/src`.
- Verification: focused Claims TypeScript compilation passed with
  `repository/node_modules/.bin/tsc.CMD --noEmit -p generated/tsconfig.claims.json`;
  generated and live Claims CSS each have balanced braces (151/151).

## 2026-09-30 — Consistent correction forms and loading states

- Added one reusable correction-edit layout for Invoice Payment, Travel
  Allowance, Claims, Cash Advance and Petty Cash. Returned remarks now appear
  in a red Action Required card on the right of the form, with a single-column
  responsive fallback.
- Placed the reusable correction and loading files directly in the existing
  `src/shared` folder. No additional `components/shared` folder is required.
- Standardized edit headings to use the record reference (`Edit IV/TA/CL/CA/PC
…`) and added a back link to the matching payment-type record list.
- Left new-request layouts and workflows unchanged; the correction rail is
  rendered only when an existing record is being edited.
- Added a reusable centered loading state and applied it to the available
  Invoice, Travel, Claim, Cash Advance, Petty Cash and Payment Voucher detail
  or amendment loaders. The existing record-list loaders already use this
  Cash Advance-style pattern.
- Left-aligned the Cash Advance reconciliation receipt/proof Drive-link header
  and input within its scrollable column.
- Added `updated-files/EDIT_FORM_AND_LOADING_COPY_FILES.md` with the full copy
  map. Focused TSX syntax validation passes for all 15 changed TSX files. A
  full project type-check remains unavailable in this scaffold because it does
  not contain the complete live alias/dependency tree.

### Correction navigation and typography follow-up

- Reduced the red correction card typography and spacing to the same compact
  scale as the yellow Action Required cards.
- Changed all five correction-form back links to return to the exact Invoice,
  Travel, Claim, Cash Advance or Petty Cash detail record rather than its list.
- Removed underline styling from correction and loading-state back links in
  normal, hover, focus, active and visited states.
- Replaced the Invoice, Travel, Claim, Cash Advance and Petty Cash correction
  loaders with the shared centered loading state. Returned Claims are now
  accepted by the Claim editor in addition to saved Drafts.

## 2026-09-30 — Dedicated Cash Advance reconciliation form

- Removed the View Request/Reconciliation tab switcher from the Staff Cash
  Advance record flow. The Start/Continue Reconciliation action now opens only
  the reconciliation form when the reconciliation view is requested.
- Updated the dynamic Cash Advance route to read `?view=reconciliation` and
  pass that view to the Staff detail component. The previous live route ignored
  query parameters and therefore continued opening the details view.
- Added a client-side `useSearchParams` fallback in the Staff detail component,
  so the reconciliation form still opens from the URL even when an older route
  page is still installed and does not forward the query value.
- Added a `Back to view details` link that returns to the same Cash Advance
  Payment Records detail page without the reconciliation query, restoring the
  yellow Start Reconciliation action card.
- Reworked the reconciliation form and review step to use the same page order
  as the other request forms: back navigation, unboxed page heading with status
  badge, then one bordered form card.
- Preserved the existing expense, Google Sheet, participant allowance, balance
  return, validation, review and submission behavior.
- Made the Cash Spent Summary horizontally scrollable with stable column widths
  and expanded the final field label/help text to clearly request a shareable
  Google Drive receipt or proof link.
- Added complete copy-ready components and stylesheet updates under
  `updated-files`; focused TypeScript and CSS structure checks pass. No
  generated source was changed.

## 2026-09-30 — White correction buttons across Payment Requests

- Standardized the staff-facing correction buttons for Travel Allowance, Petty
  Cash, Invoice Payment and Claims to use a white background, navy text and a
  subtle border by default.
- Added a dark-navy background with white text on hover, matching the Payment
  Voucher and Cash Advance action-card treatment.
- Updated both current combined return-card selectors and older correction-card
  variants where present. Approval, submission and Finance buttons are
  unaffected.
- Updated only complete copy-ready stylesheets under `updated-files`; CSS
  structure checks pass and no generated source was changed.

## 2026-09-30 — Yellow Payment Voucher and Cash Advance action cards

- Changed the rejected Payment Voucher correction card from red to the shared
  yellow Action Required treatment used by returned Payment Requests.
- Changed the Cash Advance Start Reconciliation card to the same yellow visual
  treatment without affecting Manager, Director or Finance action panels.
- Changed the amendment, reconciliation and returned-reconciliation links to
  white buttons with navy text; hover changes them to dark navy with white text.
- Delivered the complete copy-ready files under `updated-files`; no generated
  source was changed. Focused TypeScript and CSS structure checks pass.

## 2026-09-30 — Travel-style request layout for Claims, Cash Advance and Petty Cash

- Reorganized all three request forms to match the Travel Allowance page order:
  page heading and Draft/Correction badge first, Manual/Google Sheet tabs
  second, and the bordered form or Sheet card below.
- Standardized the page labels, active tab styling, spacing and mobile heading
  behavior while preserving each form's existing fields and workflow.
- Hid entry-method tabs during correction flows so returned requests stay on
  their intended amendment form.
- Updated only the complete copy-ready TSX and CSS files under `updated-files`;
  no generated source was changed. The focused TypeScript check passes.

## 2026-09-29 — Payment Voucher submitter action moved to right rail

- Kept the full-width Current Next Action banner as an informational summary,
  but removed the draft submission button and its feedback messages from it.
- Added a dedicated `Submitter action` card at the top of the right-hand column
  with the `Submit to Director` button and submission error/success feedback.
- The right rail now stacks Submitter Action first, any correction/director
  actions next, and Payment Progress below. At narrower widths it follows the
  existing single-column responsive layout.
- Updated both complete detail-source mirrors and the Payment Voucher stylesheet.
  The focused detail TypeScript check passes, CSS blocks are balanced and the
  `updated-files` delivery copies match.

## 2026-09-29 — Dark navy Payment Voucher bulk actions

- Changed the shared bulk Payment Voucher `.primaryButton` from bright blue to
  the existing Estuary navy token (`--bulk-navy`, `#0f2f57`).
- Applied a darker `#0b2443` hover state. This covers both `Continue to preview`
  and `Submit selected`; secondary white actions remain unchanged.
- The complete bulk stylesheet is available under `updated-files`; CSS balance
  and delivery-copy verification pass.

## 2026-09-29 — Payment Voucher detail back-link consistency

- Restyled the Payment Voucher detail back link to match Invoice Payment:
  muted `#526987`, 13px text, 700 weight and no underline.
- Removed the bright-blue/underlined hover treatment so it no longer looks like
  a prominent hyperlink. Navigation behavior and destination are unchanged.
- The complete override stylesheet is available under `updated-files`; CSS
  balance and copy verification pass.

## 2026-09-29 — Payment Records action and Travel status alignment

- Changed the Petty Cash Payment Records list `View record` button to the same
  white background, blue-grey border and navy text used by the other records.
  The override is scoped to Payment Records so workflow action buttons retain
  their existing styling.
- Increased the Travel Allowance list table minimum width and reserved separate
  Status and Action column widths. The long `Pending Finance Verification`
  badge now stays inside its own column instead of extending underneath the
  `View record` button.
- Both complete stylesheets were copied to `updated-files`; CSS block balance
  checks pass.

## 2026-09-29 — Compact Payment Voucher record cards

- Reduced Payment Voucher record-card padding, gaps, radius, title, amount,
  metadata, status, next-action and button sizing to align with the more compact
  Invoice Payment and Travel Allowance record grids.
- Preserved the existing two-column grid, card information and Grid/List
  controls. Only sizing and spacing changed.
- Matched the rejected card's Director Remarks panel to the compact Next Action
  panel using the same padding, radius and label/body typography scale.
- Delivered the complete stylesheet under
  `updated-files/src/features/payment-voucher/components/`. CSS braces are
  balanced and the delivery copy matches the updated source.

## 2026-09-29 — Travel Allowance employee dropdown for every entry

- Removed the Manager-only visibility condition from the Travel Allowance
  Employee Name selector. Every manual Travel Allowance entry now displays the
  Staff dropdown regardless of which form mode rendered the page.
- Removed automatic Staff self-assignment so the dropdown remains usable, and
  kept a compatibility option for previously saved employee IDs that are not in
  the temporary four-person list.
- The change is isolated to Travel Allowance. Its focused TypeScript check
  passes with zero errors.

## 2026-09-29 — Temporary Manager Travel Allowance Staff list

- Added four temporary Staff options to the Manager-only Travel Allowance manual
  form so a Manager can choose an employee when submitting on their behalf.
- Kept the options in `MANAGER_TRAVEL_EMPLOYEES` at the top of
  `travel-allowance-form.tsx` so the official names, IDs and positions can be
  replaced without changing the dropdown implementation.
- The Staff Travel Allowance form is unchanged. The focused Travel Allowance
  TypeScript check passes with zero errors.

## 2026-09-29 — Google Sheet same-page request routing

- Updated Travel Allowance, Cash Advance, Claims and Petty Cash so a retrieved
  Google Sheet no longer sends the requester back to the manual-entry form just
  to select routing information.
- Travel Allowance and Cash Advance now collect their required Manager and
  Director choices in the retrieved-sheet panel and continue directly to their
  existing review screens.
- Claims now collects role-aware reviewers, contact, date, notes and declaration
  in the sheet panel and submits the imported claim directly after policy
  validation.
- Petty Cash now collects date, contact, location, Manager, notes and declaration
  in the sheet panel and submits directly to Manager. It remains Manager-only
  because the existing Petty Cash workflow has no Director approval field.
- Sheet metadata populates the visible same-page controls immediately after
  retrieval, while allowing the requester to correct those values before the
  next action.
- Compacted the Travel Allowance and Petty Cash retrieval summary cards into a
  four-column desktop row with smaller typography and responsive fallbacks.
- Added `generated/GOOGLE_SHEET_SAME_PAGE_ROUTING_COPY_FILES.md`. Focused
  TypeScript checks for Travel Allowance, Cash Advance, Claims and Petty Cash
  pass with zero errors using the repository TypeScript binary.

## 2026-09-27 — Travel Allowance Google Sheet retrieval

- Left Invoice Payment unchanged and implemented the agreed Google Sheet flow for Travel Allowance first.
- Added `Manual form` and `Google Sheet Link` modes. A user may paste any shared Google Sheet URL; one sheet represents one request and every populated row becomes one travel entry.
- The importer validates request date/contact/reviewer emails, travel date/project/reason, meal or special allowance selection, special-allowance reasons and HTTPS supporting-document links. It resolves Manager, Director and Staff emails against Estuary accounts before applying data.
- Retrieved entries, reviewer assignments, request information, remarks and unique Google Drive links populate the normal form. The user must still review the existing form and confirmation screen before submission.
- Added optional `supportingDocumentLinks` to the Travel Allowance snapshot contract and both create/resubmit API schemas. Manager and Director review screens expose those links in Supporting Information. No Prisma migration is required.
- Added `generated/TRAVEL_ALLOWANCE_GOOGLE_SHEET_COPY_FILES.md` with the copy map and exact headings. Focused TypeScript validation passes with zero errors.

## 2026-09-27 — Bulk Payment Voucher Google Sheets link import

- Replaced the bulk Excel/CSV template download and file-upload UI with a single Google Sheets sharing-link field.
- Added a server-side Google Sheet reader that accepts only standard HTTPS `docs.google.com/spreadsheets/d/...` links, preserves the selected numeric `gid`, fetches the CSV export and rejects inaccessible HTML, empty sheets and responses above 2 MB.
- The linked rows are parsed through the existing Payment Voucher header aliases and validation rules, then displayed immediately in a table with amount and valid/issue status before continuing to the existing full preview and draft-creation workflow.
- Renamed the visible tab to `Google Sheet Link` and removed all visible Excel/CSV upload and template-download language. Internal `spreadsheet` source values remain for compatibility with the existing preview state.
- Added `generated/GOOGLE_SHEET_BULK_PV_COPY_FILES.md`. Focused TypeScript validation passes with zero errors.
- Diagnosed the subsequent missing-export error: the live `bulk-payment-voucher-create-flow.tsx` was accidentally replaced with the `BulkPreviewPanel` source, so it no longer exported `BulkPaymentVoucherCreateFlow`. The generated flow file is correct; the copy guide now includes an explicit wrong-file troubleshooting check.
- Fixed shared Google Sheet links without a `gid`: the API no longer forces worksheet ID `0`, which can fail after the original first tab is deleted. It now omits `gid` for the default worksheet and retries through Google's public `gviz` CSV endpoint, while returning the attempted HTTP/sign-in failure details when both methods fail.

## 2026-09-27 — Payment Voucher bulk Manager, Finance and signed downloads

- Added a Manager bulk-preview route that reuses the Director full-detail review modal, requires every selected voucher to be reviewed and records only `projectManagerViewedAt`; it does not approve or move the Payment Voucher workflow.
- Added a Finance bulk-processing route for Director-approved vouchers. Finance reviews every selected record, supplies one payment date and a unique payment reference per voucher, then starts and saves the records sequentially with partial-failure reporting.
- Kept payment proof, PDF generation, recipient signing and final Finance verification individual because those artifacts and outcomes can differ per voucher.
- Added role-aware Manager and Finance bulk workflow links to Payment Voucher Payment Records.
- Added a dependency-free ZIP download for completed signed Payment Vouchers. It supports manually uploaded signed PDFs and digitally signed generated PDFs, and only includes records already visible to the signed-in role and matching the active filters.
- Added `generated/PAYMENT_VOUCHER_BULK_WORKFLOWS_COPY_FILES.md` and a focused TypeScript configuration. The focused check passes with zero errors; no Prisma change is required.
- Placement correction: removed Manager and Finance bulk workflow links from Payment Records. The Manager button now appears in the Payment Voucher preview/Pending Approvals workspace, the Finance button appears in Payment processing, and Payment Records retains only the signed-PV ZIP download.
- Payment Records visual follow-up: forced the five Payment Voucher filters into one desktop row with responsive two-column/mobile fallbacks, and restyled the signed-PV ZIP action as a navy download button with an 18px gap before the Grid/List selector. Focused TypeScript validation passes and the override stylesheet has balanced braces.
- Removed the `Create Payment Voucher` button from Payment Voucher Payment Records. Voucher creation remains available through the role sidebar's Create Payments workflow instead of the records archive.

## 2026-09-22 — Petty Cash Division selector fix

- Added the supplied `DIVISION_TYPES` list to the Petty Cash domain constants
  and changed the expense-row Division field from free text to a dropdown.
- Fixed the controlled select binding from `value={line.accountType}` to
  `value={line.division}`; selections now remain visible after being chosen.
- Focused TypeScript validation passes.

## 2026-09-22 — Consolidated Petty Cash ledger navigation

- Removed the redundant Transactions submenu and route. Director and Finance
  now have only Petty Cash → Overview.
- Overview remains the shared screen for both roles and already contains the
  complete filterable transaction ledger, so no data or visibility was lost.
- Removed the obsolete transaction page/component and Director wrapper from
  the copy-ready implementation map.

## 2026-09-22 — Role sidebar prototype alignment

- Reworked both copy-ready `role-sidebar.tsx` files into four role-specific
  sidebars using separate Dashboard, Create payments, Approvals/Processing,
  Petty cash and Records sections where applicable.
- The labelled sections now render as pale blue-grey cards with compact
  uppercase labels, medium blue-grey navigation text and a dark navy active
  item, matching the supplied prototype while preserving the existing Estuary
  identity header.
- Payment Request is the expandable request-type menu. Claims is included in
  that submenu for every role. Staff and Manager retain Payment Voucher creation; Manager also
  retains Staff voucher preview. Director and Finance receive Payment Voucher
  only in their approval/processing queues.
- Staff has Petty Cash creation. Manager and Finance have its workflow queues;
  Director and Finance have Petty Cash Overview and Transactions. All links
  point to the existing copy-ready routes.
- Focused TypeScript validation through
  `generated/tsconfig.petty-cash.json` passes with zero errors.

## 2026-09-22 — Petty Cash Payment Records grid alignment

- Updated the Petty Cash Payment Records grid to match Invoice Payment: two
  equal columns, larger card typography, blue reference text, top-right status,
  a shaded two-column details panel and a bordered bottom-right View record
  button.
- Retained responsive two-column and single-column breakpoints and added the
  same accessible pressed-state semantics to the Grid/List control.

## 2026-09-22 — Petty Cash Manager queue redesign

- Rebuilt the Manager Petty Cash queue to match the Invoice Payment review
  workspace: account hero, three summary cards, pending/forwarded/all tabs,
  search, Grid/List switch, empty state and pagination.
- Added a Payment Voucher-style list table with a tinted uppercase header,
  bordered rounded table, vertically aligned status pills and right-aligned
  Review request/View details buttons. The optional grid view uses the same
  two-column request cards as the other payment workflows.
- The queue now filters to the signed-in Manager's assignments, defaults to
  records requiring review and treats requests moved beyond Manager approval
  as forwarded to Finance. Focused TypeScript and CSS validation pass.

## 2026-09-22 — Petty Cash Manager approval detail redesign

- Rebuilt the individual Manager approval screen into the same two-column
  hierarchy as Invoice Payment: complete request information and expense table
  on the left, with the Manager decision card and payment-progress tracker
  stacked on the right.
- The left document now contains the request total header, overview fields,
  receipt-linked expense breakdown, total and notes. The action card supports
  approval to Finance or return-to-Staff remarks and changes to a read-only
  result after action.
- Added a four-stage Petty Cash tracker (Submitted, Manager Approval, Finance
  Processing, Paid), assignment checks, loading/access/not-found states,
  feedback notices and responsive single-column behavior. Focused TypeScript
  and CSS validation pass.

## 2026-09-22 — Petty Cash Finance queue and processing redesign

- Rebuilt the Finance Petty Cash queue using the Invoice Payment workspace
  structure: Finance identity hero, three summary cards, processing/paid/all
  tabs, search, Grid/List modes and pagination.
- The Finance list uses the Payment Voucher table treatment with a rounded
  bordered table, tinted uppercase header, status pills and right-aligned
  Process payment/View details actions.
- Rebuilt the Finance processing detail as a left request document with a
  stacked Finance action card and four-stage tracker on the right. Finance must
  verify the date/reference/proof first, then explicitly Mark as Paid to create
  the Money Out ledger entry. Return-to-Staff remains available before payment.
- Focused TypeScript validation passes and the shared Petty Cash stylesheet is
  balanced.

## 2026-09-22 — Finance payment receipt upload

- Replaced the Finance Petty Cash payment-proof URL input with a single receipt
  upload accepting PDF, JPG and PNG up to 2.5 MB. The UI shows the selected
  filename and supports Preview and Remove before verification.
- Kept the existing `paymentProofLink` transport/storage field for compatibility
  but now sends the uploaded file as a data URL. The Finance verification API
  accepts supported receipt data URLs while retaining URL compatibility for
  older records.
- Focused TypeScript and CSS validation pass.

## 2026-09-22 — Shared Petty Cash overview ledger

- Completed the `/beta/petty-cash` and `/beta/petty-cash/transactions` page
  components so empty route files no longer trigger Next.js default-export
  errors. Both routes allow only Director and Finance and render the same
  shared ledger data.
- Expanded Overview into a monthly dashboard with money-in, money-out and
  balance totals plus a complete table for Date, Name, Location, Money In,
  Money Out, Balance, Proof and Notes. Added location, month and search filters,
  loading/empty/error states and a link to the dedicated Transactions view.
- Focused TypeScript and CSS validation pass.

## 2026-09-22 — Petty Cash ledger spacing and notes cleanup

- Added a 22px gap between the Transactions filters and ledger table.
- New paid-request ledger entries now store only the optional Finance note in
  the Notes column instead of generating `request number · requester name`.
  Overview and Transactions also hide that legacy generated value for existing
  rows, displaying an em dash when no genuine note exists.
- Focused TypeScript validation passes.

## 2026-09-21 — Petty Cash feature implementation

- Added the complete no-PDF Petty Cash vertical slice under `generated/src`:
  domain types/policy, browser API, Prisma repository, API routes, Staff form
  and detail, Manager queue/review, Finance queue/review, Director read-only
  wrappers, shared ledger views and Payment Records.
- Workflow is Staff submit (< RM300) → Manager approve/return → Finance verify
  payment → Mark as Paid. The final action locks the location float, checks for
  an existing source-submission disbursement, ensures the RM500 monthly opening
  entry, creates Money Out and decrements the balance transactionally.
- Penang and Kuala Lumpur are independent ledgers. Overview and transactions
  provide location/month filters; the transaction table shows Date, Name,
  Money In, Money Out, Balance, Proof and Notes.
- Enabled Staff New Request → Petty Cash, Manager Pending Approval → Petty Cash,
  Finance Pending Processing → Petty Cash, and Director/Finance Petty Cash
  Overview/Transactions. Integrated Petty Cash into Payment Records.
- Added `generated/PETTY_CASH_IMPLEMENTATION_FILES.md` with every copy path and
  `generated/tsconfig.petty-cash.json` for focused validation. The focused
  TypeScript check passes with zero errors. Runtime database testing remains a
  live-project step. PDF generation is explicitly deferred.

## 2026-09-21 — Petty Cash requirements and architecture

- Captured the proposed Petty Cash feature in
  `generated/PETTY_CASH_REQUIREMENTS.md`: Staff requests below RM300, Manager
  approval, Finance verification/payment, idempotent Mark as Paid, automatic
  money-out entry and balance recalculation.
- Penang and Kuala Lumpur are separate RM500 monthly funds. Director and Finance
  share a read-only ledger presentation with location/month filters; Finance
  retains mutation controls.
- Agreed to reuse the existing Prisma schema without a migration. The legacy
  `PETTY_CASH_TOPUP`/`PettyCashTopupDetail` names remain internal compatibility
  names for the request; `PettyCashFloat` represents the Penang/KL funds and
  `PettyCashEntry` stores monthly opening top-ups and paid disbursements.
  Mark as Paid must lock the float row and check the source submission inside
  one transaction to prevent duplicate money-out entries.
- Documented the required domain, data, component, API and page-route folder
  structure. Four policy assumptions remain to confirm: strict total below
  RM300, no monthly carry-forward, proof required before payment, and Director
  read-only access.
- Added the explicit Director component folder for thin read-only wrappers over
  the shared ledger components. Standardized Staff, Manager and Finance Petty
  Cash beta detail routes on `[requestId]`; their page props must read
  `params.requestId`. API routes retain `[id]`.

## 2026-09-21 — Role sidebar refinement

- Reworked both copy-ready `role-sidebar.tsx` files around the requested role
  navigation. Staff receives Dashboard, Payment Voucher and Payment Request;
  Manager adds Approvals and Payment Records; Director adds Approvals, Petty
  Cash and Payment Records; Finance adds Payment Processing, Petty Cash and
  Payment Records.
- Every role can open New Request and choose Invoice Payment, Travel Allowance,
  Cash Advance or one Claims link. Claims opens the shared form in Expense
  Claim mode; the form itself contains the Internet / Commute, Medical,
  Mileage, PD and Education Tech claim-type selector. My Requests points to
  `/beta/payment-records?scope=mine` so it remains distinct from the full
  Payment Records link.
- Pending Approval and Pending Processing retain nested request-type links to
  the existing role queues. Petty Cash Overview and Transactions are visible
  but disabled as `Soon` because no corresponding routes exist in this
  copy-ready workspace.
- Refined sidebar hover/expanded backgrounds and spacing in
  `generated/beta.module.css`. This workspace has no runnable app or dependency
  manifest, so runtime verification remains a live-project copy-and-check step.
- Revised Payment Voucher role access: only Staff and Manager receive the
  `/beta/payment-vouchers/new` creation link and pass the single/bulk form role
  checks. Director sees Payment Voucher under Approvals → Pending Approval,
  linked to `/beta/approvals`; Finance sees it under Payment Processing →
  Pending Processing, linked to `/beta/finance`. Requester-side amendment and
  follow-up actions continue to use the original submitter's ID. Payment
  Voucher records include records created by the current user, and `scope=mine`
  filters the list to that user's submissions.
- Restored the existing Manager Payment Voucher preview responsibility without
  removing Manager creation access. Approvals → Pending Approval now includes
  `Payment Voucher Preview`, linked to
  `/beta/project-manager/payment-vouchers`, where the Manager can preview Staff
  vouchers as before.

## Current State

- Project: Estuary
- Summary: Manual documentation scaffold initialized; the repository has no documented implementation or product purpose yet.
- Current Worker:
- Current Branch: Not established
- Last Updated: 2026-09-22

## Current Blockers And Quirks

- Product purpose, stack, runtime, and verification workflow are not yet documented.
- No Git metadata was present when this scaffold was initialized.

## Latest Session Changelog

- Organized the user-supplied stylesheet as `output/organized.css` without changing selectors or declarations.
- Consolidated repeated responsive rules into one media block per breakpoint, reducing 15 media blocks to 9.
- Created `output/infographics/payment-voucher-life-cycle-swimlane.png`, a landscape swimlane flowchart based on the supplied payment voucher lifecycle reference.
- The infographic uses five lifecycle stages and role-labelled lanes, with no legend or ARUS logo.
- Generated `generated/local-payment-voucher-store.ts` from the user's current 2,340-line store, adding explicit manual/digital recipient signature selection, recipient manual-PDF upload, Staff manual-PDF upload and confirmation, reset handling, and Finance completion validation.
- Verified that the generated store transpiles without TypeScript syntax errors and that each new exported signature function appears once.
- Generated full replacement files `generated/recipient-signature-panel.tsx` and `generated/recipient-payment-voucher.module.css` for recipient digital/manual signing. The TSX syntax check passed and CSS braces were verified balanced.
- Generated `generated/payment-voucher-detail.tsx` with Staff manual signed-PV upload, confirmation, Finance notification, manual-PDF download, and signature-method/source audit display. TSX syntax transpilation passed.
- Generated `generated/payment-voucher.module.css` from the current full stylesheet with responsive Staff manual-upload card styles; verified 496 opening and 496 closing braces.
- Revised the chosen manual-signature UX by generating `generated/recipient-link-panel.tsx` and its full CSS: manual signed-PV upload now opens in a modal from the existing Staff recipient panel, while the secure recipient link is described as digital signing. TSX syntax and CSS brace checks passed.
- Generated the complete `generated/bulk-csv-upload-panel.tsx` replacement. It downloads the formatted `.xlsx` template through `download-payment-voucher-template.ts`, accepts both `.xlsx` and `.csv`, converts Excel cell values safely (including dates, formulas, rich text, IC numbers, and bank account values), and reuses the existing bulk row validation. A TypeScript project check using the generated file as an overlay reported zero errors in the uploader.
- Generated complete replacements for `generated/bulk-payment-voucher-create-flow.tsx` and `generated/bulk-preview-panel.tsx`. The visible bulk-import terminology now consistently says Spreadsheet Upload / Excel or CSV, while retaining draft creation, draft selection, and submission to assigned Directors. A combined TypeScript overlay check of these files plus the updated uploader reported zero errors.
- Generated `generated/finance-page.tsx` and `generated/finance-payment.module.css` with an accessible Grid/List view toggle beside the Finance queue result count. List view is the default and presents compact PV number, Staff, recipient, division, amount, status, update date, and View details columns; Grid view retains the existing full Finance action panels. The page passed a TypeScript overlay check with zero errors, and the stylesheet has balanced braces.
- Extended the generated Finance Grid/List replacements so List-view `View details` opens a responsive modal containing the live `FinancePaymentPanel`. Finance can perform each currently available action without leaving the queue; the modal follows store updates and displays the new status/action. Added Escape, backdrop, and close-button dismissal plus body scroll locking. Also added the current `AWAITING_RECIPIENT_SIGNATURE` and `AWAITING_STAFF_CONFIRMATION` statuses to the Finance queue/waiting filter. TypeScript reports zero target errors and CSS braces remain balanced.
- Refreshed `generated/payment-voucher-detail.tsx` from the current project and made its back navigation role-aware for Finance: Finance users now see `Back to payment processing` linking to `/beta/finance`; Director and Staff destinations remain unchanged. TypeScript reports zero target errors.
- Generated `generated/payment-vouchers-page.tsx`, `generated/payment-voucher-record-list.tsx`, and an updated `generated/payment-voucher.module.css` to add a shared Grid/List toggle to Payment Records for every role. The list table shows PV number, creator, recipient, division, amount, status, PV date, updated date, and View details. Modern workflow statuses were added to filters and Finance visibility. Both TypeScript targets report zero errors and the stylesheet has balanced braces.
- Generated `generated/approvals-page.tsx` for the redesigned Director workspace. It separates Pending approvals and Approval history, supplies Grid/List controls, history filters, bulk approval access, and a live modal using `PaymentVoucherDetail` for decision-making or read-only review. Prepared callback-compatible updates to the generated shared record list/card for the next handoff. The page and both dependencies pass a combined TypeScript overlay check with zero errors. Approval history is currently derived from voucher state until an immutable decision-event store is added.
- Completed the three Director-workspace dependencies: `generated/payment-voucher-record-list.tsx`, `generated/payment-voucher-record-card.tsx`, and `generated/payment-voucher.module.css`. The shared Grid/List components now support modal callbacks and custom action labels; the stylesheet includes the Director tabs, view selector, responsive review modal, and button normalization. All 43 CSS-module selectors used across the Director page and its two list components are present, and the stylesheet has 551 balanced rule braces.
- Updated the generated shared voucher list CSS so List view is fixed within its container instead of horizontally scrollable. The table now uses a fixed layout and explicit column widths, wraps long content, constrains status badges, and progressively hides secondary columns on narrower screens. The generated stylesheet has 562 balanced braces and no horizontal-auto overflow on the table wrapper.
- Refined the fixed voucher list so status badges remain on one line. The status column now receives 18% width, the recipient column 15%, and table badges use compact padding/font sizing with `white-space: nowrap`.
- Aligned the shared voucher List view with the Finance queue: it now uses the compact eight-column layout (PV number, Staff, recipient, division, amount, status, updated, action), removes the separate PV-date column, and uses Finance-style white outline action buttons with a blue hover state. Column widths and responsive hiding rules were recalibrated while retaining the fixed, non-horizontal-scroll layout.
- Aligned `generated/finance-payment.module.css` with the Director table behavior. The Finance table no longer has horizontal scrolling or a forced minimum width, uses a fixed eight-column layout, preserves the right-side action button, and hides secondary columns at narrower breakpoints. Shared status badges now default to a single line. Both generated stylesheets have balanced braces.
- Updated the generated Finance List view after removing the Updated column. `generated/finance-page.tsx` now renders seven matching columns, while `generated/finance-payment.module.css` redistributes the table widths and gives the action cell 16px left/20px right padding so the outline button no longer touches the table edge. Responsive rules no longer hide the seventh-column action. The table structure validates as seven headers/seven cells and CSS braces remain balanced.
- Redesigned the generated Payment Voucher detail UI to follow the user's cleaner prototype while preserving workflow behavior. `generated/payment-voucher-detail.tsx` now places the title and current-action banner above the two-column content/tracker layout, groups the information sections into one bordered card, adds Print and context-aware PV download actions to the banner, and retains Staff/Director/Finance panels. `generated/payment-voucher.module.css` adds compact information typography, consolidated-card styling, a denser sticky tracker, responsive stacking, and print rules. TSX transpilation reports zero diagnostics, all 34 referenced CSS-module classes exist, and CSS has 621 balanced braces.
- Refined the PV detail replacement to match the two-card wireframe precisely: one consolidated Details card and one tracker card. Removed the duplicate external tracker heading, added the blue current-action icon, exact Print Voucher/Download Signed PV button treatment with icons, Recipient Details and verification badges, itemized breakdown metadata plus subtotal/tax/amount-in-words/grand-total summary, and Finance audit verification styling. TSX transpilation still reports zero diagnostics; all 38 CSS classes exist and CSS has 642 balanced braces.
- Relaxed the Director/shared eight-column list table spacing in `generated/payment-voucher.module.css`: row cell padding increased to 16px/12px, the action column increased from 9% to 13%, and its cell now has 16px left/20px right padding. Other columns were proportionally rebalanced to retain a 100% fixed, non-scrollable layout, including a 21% single-line status column.
- Strengthened the PV detail prototype styling so legacy beta rules cannot visually override it: the full Details card now has a visible outer border and section separators, Payment Details includes the requested thin divider, the layout uses an approximately 2:1 details/tracker split, and the action banner enforces a pale-blue background, blue square icon, white Print button, and bright-blue Download button. Validation remains clean with zero TSX diagnostics, no missing classes, and 646 balanced CSS braces.
- Recalibrated the final PV detail CSS directly from the user-supplied Tailwind prototype HTML. The generated view now maps the prototype's 20px action-card padding, 40px icon, 16px action title, 12px description/buttons, 24px lower-grid gap with an 8/4-equivalent split, 24–32px detail section padding, 10px labels/12px values, and 24px tracker markers with 12px/11px step typography. Replaced temporary Unicode action symbols with the prototype's inline SVG check, printer, and download icons. Validation reports zero TSX diagnostics, no missing styles, and 715 balanced CSS braces.
- Added a final high-specificity PV detail prototype block to `generated/payment-voucher.module.css` that explicitly enforces the requested three-card composition: one full-width Current Action card, then a two-column row containing the full Details card and Payment Progress card. It locks card borders/backgrounds, internal thin separators, compact typography, exact print/download hierarchy, 2:0.96 lower-grid proportions, a dense tracker, and responsive one-column stacking. The TSX still has zero syntax diagnostics, all CSS-module classes resolve, and the stylesheet has 705 balanced braces.
- Removed duplicate action icons defensively. The latest TSX contains only the prototype SVG icons, and the CSS now suppresses any legacy `aria-hidden` text-icon spans left in a manually merged copy; the action-icon container also uses zero font size so a leftover check character cannot render beside its SVG. CSS has 717 balanced braces.
- Simplified shared voucher grid cards: `generated/payment-voucher-record-card.tsx` no longer renders the Next Action block for rejected vouchers, leaving only the Director's remarks. `generated/payment-voucher.module.css` replaces the Next Action block's blue left indicator with a neutral one-pixel border for all other statuses. TSX transpilation reports zero diagnostics and CSS remains balanced.
- Removed the dark-red left indicator from `.notice` in the generated Payment Voucher stylesheet. Amendment/error notices now use a consistent thin `#fecaca` border on all four sides while retaining the light-red background and readable dark-red text. CSS remains balanced at 735 rules braces.
- Redesigned the rejected/amendment state in the generated PV detail files. A rejected voucher now uses one compact red Action Required banner containing the rejecting Director, amendment guidance, a dated remarks box, and the sole Amend Payment Voucher link. The previous separate rejection notice was removed, eliminating duplicated messaging/actions. Print Voucher was removed from every status; non-rejected records retain only the context-appropriate PV download action. TSX transpilation reports zero diagnostics, only one Amend label remains, no Print action remains, all CSS classes resolve, and CSS has 735 balanced braces.
- Generated `generated/role-sidebar.tsx` and `generated/beta.module.css` for the first Payment Request navigation step. After reviewing the Prisma schema, the Staff sidebar now shows three clean entries: Payment Voucher, Payment Request, and Petty Cash Top-up. Payment Request links to the single shared `/beta/payment-requests/new` form; its four Prisma-backed types belong in that form's dropdown rather than as sidebar children. Petty Cash remains clearly marked Soon, while other roles and Records navigation are preserved. The provisional Staff → Manager → Director → Google Form → Finance flow is intentionally not implemented until Finance confirms it.
- Generated `generated/payment-requests-new-page.tsx` as the complete replacement for the currently empty beta Payment Request creation page. After correcting an initial prototype-styled draft, the page now reuses the established Beta Payment Voucher CSS module and its panel, form-section, responsive line-entry, summary, notice, and action patterns. Its dropdown values remain compile-time checked against Prisma's `PaymentType` enum, while draft saving temporarily uses the existing prototype API until Prisma persistence and the final workflow are confirmed.
- Began the Payment Voucher PostgreSQL migration with a database-backed vertical slice. Generated a singleton Prisma client, a Payment Voucher Prisma repository, real collection/detail API routes, a browser API client, an async database-backed `usePaymentVouchers` hook, and a database-backed Staff creation flow. Creation now atomically allocates a monthly PV number and writes `Submission`, `PaymentVoucherDetail`, `SubmissionLine`, `ApprovalStep`, `SubmissionTransition`, and `AuditEvent` records in one transaction. Compatibility-only UI fields that are absent from the normalized schema are kept in the immutable CREATE transition snapshot. Approval, amendment, Finance processing, binary document storage, external signature tokens, and existing browser data migration remain follow-up phases; the generated creation flow explicitly prevents a rejected amendment from silently falling back to localStorage.
- Verified the six-file PostgreSQL vertical slice with the project's TypeScript compiler; it reports zero errors. A live `prisma migrate status` check resolved the configured datasource as PostgreSQL database `estuary` on `localhost:5432` but failed at the schema engine because no process is listening on port 5432. Database runtime verification and migration status remain blocked until PostgreSQL is started locally or `DATABASE_URL` is changed to the reachable server address.
- Generated `generated/seed.ts`, a rerunnable Prisma seed for the database-backed Payment Voucher slice. It creates the `beta-arus-org` organization, all IDs used by the Beta accounts, active memberships and roles, GL accounts 5100/5200/5300, reference areas/projects, and Payment Voucher workflow version 1 with the current ten states and eleven transition rules. It deliberately creates no dummy Payment Vouchers.
- Diagnosed the first live database test. The one-off migration-status command connected successfully through `127.0.0.1:15432`, but its temporary `DATABASE_URL` was removed afterward, so Prisma Studio/app processes still need the same working URL in their own environment. The actual `src/app/api/v1/payment-vouchers/route.ts` was also inspected and remains the original `betaNotImplemented` stub; this directly explains the UI message “Create Payment Voucher is scaffolded but not connected to the database yet.” The generated collection route still needs to replace that exact file, followed by a dev-server restart.
- Extended the generated Beta Payment Request page with supporting-document selection. Staff can select up to ten PDF/PNG/JPG files of at most 10 MB each, see file names and sizes, avoid duplicates, remove individual files, and send their filenames in the draft payload. The current JSON API does not persist binary file contents, so a multipart/object-storage endpoint plus Prisma `Document` and `SubmissionEvidence` writes remain required for real uploads.
- Diagnosed the Director approval failure after database-backed PV creation: `payment-voucher-detail.tsx` was still calling the old localStorage approve/reject functions, while both action API routes remained placeholders. Generated database-backed approve/reject repository operations, real action routes, browser API methods, and an updated async detail handler. The transaction validates the assigned active Director, records `ApprovalDecision`, `SubmissionTransition`, `AuditEvent`, updates the approval step and current submission state, and maps the stored signature key. All generated database files pass the project TypeScript compiler.
- Changed the generated PostgreSQL Payment Voucher numbering from the date-like monthly format `PV-YYYY-MM-NN` to the requested annual sequence `PV-YYYY-NNNN`. `DocumentSequence.month = 0` is reserved internally for the yearly PV counter, allowing numbers such as `PV-2026-0001` and `PV-2026-0002` without a Prisma schema migration. Existing issued voucher numbers are intentionally left unchanged. The complete database overlay still passes TypeScript validation.
- Generated the database-backed Project Manager preview slice. The repository now validates the assigned active Manager, writes an idempotent informational `MANAGER_PREVIEW` submission transition plus audit event, and leaves the workflow state unchanged. Added the real manager-preview API route and browser method, updated the Manager card to await the database action, and updated the Manager page to refresh counts/queues afterward. The complete database overlay passes TypeScript validation.
- Rebuilt the single Payment Voucher creation form styling inside the user-supplied shared `payment-voucher.module.css`, aligned with the clean receipt-style review page without changing the sidebar or form data/validation. The form uses a unique `formPanel` root so its overrides do not leak to other components. Removed the obsolete legacy review-page selectors from the shared stylesheet because the review screen now owns its separate `payment-voucher-review.module.css`; no extra form CSS file remains. The PV-specific Voucher Lines breakdown, responsive layout, summary, amount in words and navy grand-total bar remain. TypeScript passes, all form CSS-module references resolve, no legacy review-only selectors remain, and CSS braces are balanced.
- Rebuilt the single-PV Step 2 review as an isolated receipt-style page using `generated/payment-voucher-review.tsx` and a new review-only CSS module. It follows the supplied prototype without changing the sidebar or shared PV pages. Added review-step reporting from `PaymentVoucherCreateFlow` to `PaymentVoucherCreateWorkspace`, allowing the workspace to hide the redundant Creation Method / Single payment voucher toolbar only while Step 2 is visible. The combined generated overlay passes TypeScript validation.
- Rebuilt the Staff Payment Voucher review step from the supplied HTML prototype without changing the sidebar or other screens. `generated/payment-voucher-review.tsx` now presents a compact Step 2 header and one unified receipt-style card containing general, recipient, and payment information, a responsive itemized breakdown with aligned totals, amount in words, supporting documents, and a quiet footer action row. Added the isolated `generated/payment-voucher-review.module.css` so the redesign cannot alter the form, records, details, Director, Finance, or sidebar UI. Existing amendment and submission behavior is preserved. TypeScript passes, all 32 referenced CSS classes exist, and CSS braces are balanced.
- Restyled only the Payment Breakdown inside the generated creation form to match the compact light wireframe. Voucher Lines now shows an item-count badge and a small pale-blue Add line button; the line-entry grid uses a subtle table header and denser controls; and the amount-in-words, subtotal, tax, and grand total share a light two-column summary with no navy total bar. Payment Voucher fields and calculations are unchanged, responsive stacking is retained, the existing shared stylesheet remains the sole form CSS file, TypeScript passes, and CSS braces are balanced at 761/761.
- Corrected the Payment Voucher form scope after the user clarified that the supplied shared module's screen width must remain unchanged. Rebuilt `generated/payment-voucher.module.css` from the latest supplied module, removed obsolete legacy Staff review rules now owned by `payment-voucher-review.module.css`, restored `generated/payment-voucher-form.tsx` to the original full-width `.panel` wrapper with no review-like form-card header, and limited the visual redesign to Payment Breakdown. TypeScript passes, all form CSS classes resolve, no `.formPanel` or legacy review selectors remain, and CSS braces are balanced at 696/696.
- Increased only the compact Payment Breakdown typography for readability: column labels, line inputs, totals, amount-in-words text, item badge, and Add line button are now slightly larger, with Grand total increased to 20px. Layout dimensions and the rest of the form remain unchanged; CSS braces remain balanced at 696/696.
- Located the Beta Payment Request form, which was implemented directly in `src/app/beta/payment-requests/new/page.tsx` rather than under `features`. Generated a clean feature split: `payment-request-form.tsx`, its isolated `payment-request-form.module.css`, and a thin `payment-requests-new-page.tsx` route. The form now follows the supplied unified-card wireframe with Request Overview, Recipient/Vendor, supporting-document upload, Approver Workflow, compact Payment Breakdown, amount-in-words, totals, and a dark action footer. Existing four Prisma-backed Payment Request types, validation, file checks, and prototype draft API behavior are retained; Petty Cash remains separate. TypeScript passes, all 33 CSS-module classes resolve, and CSS braces are balanced at 91/91.
- Increased typography consistently across the generated Payment Request form for parity with the Payment Voucher form. Section headings are now 18px, descriptive text 13–14px, labels 12px, main inputs 14px, breakdown inputs 13px, row totals 14px, final total 18px, and the primary action 13px. Widths, spacing structure, responsive layout, and behavior are unchanged; TypeScript still passes and CSS remains balanced at 91/91.
- Enabled Add line for every Payment Request type, including Invoice. Removed the disabled button condition and handler guard, stopped request-type changes from collapsing Invoice back to one line, and clarified that Invoice starts with one line but may be split across accounts. TypeScript validation passes.
- Fixed duplicate Payment Request line React keys after removing and re-adding lines. Line IDs no longer derive from `current.length + 1`; a monotonic `useRef` counter now issues each new line number once for the component session. TypeScript validation passes. Existing duplicate state from hot reload requires one browser refresh after copying the replacement.
- Diagnosed the Manager-preview missing-export errors as file-placement issues, not missing implementation. The completed browser API was copied under `src/domain/payment-vouchers/payment-voucher-api.ts` instead of `src/data/payment-vouchers/payment-voucher-api.ts`, and the completed repository was placed under `src/domain` with the misspelled filename `prisma-payment-voucher-respository.ts`. The correct `src/data` files still lack the Manager exports, and the actual `[id]/manager-preview/route.ts` is zero bytes. The existing generated API, repository, and manager-preview route form a complete validated replacement set and expose both required Manager functions.
- Diagnosed “records disappear after reopening” as a database-read failure rather than data loss. PostgreSQL at `127.0.0.1:15432` is reachable, but the `DATABASE_URL` currently loaded from the project's `.env` fails authentication for `adlina_dev`. The supplied runtime trace confirms Prisma authentication failure in `listPaymentVouchersFromDatabase`. Prisma Studio was launched from a separate PowerShell session containing the valid temporary URL, while the dev server was launched from VS Code's separate terminal, which did not inherit that variable. `usePaymentVouchers` catches the failed GET and resets records to `[]`, while the records page ignores the hook's `error`, making the failure look like an empty database. The environment variables and `pnpm dev` must be run in the same terminal; later, surface the hook error in the page UI.
- Confirmed the project `.gitignore` contains `.env*`, so a correct local `.env` can persist the database URL across terminal and app restarts without being committed to Git. This stores the credential locally (and potentially in the user's OneDrive-synced project), so it should only be used if allowed by the team's secret-handling policy. The `127.0.0.1:15432` tunnel/server connection may still need to be started separately whenever it is unavailable.
- Diagnosed the empty Project Manager Payment Voucher queue as an identifier mismatch. The Manager page filters by the signed-in beta account ID `nadia-hassan`, while the Staff form was storing the placeholder `operations-manager`. Updated `generated/payment-voucher-form.tsx` so new vouchers store `nadia-hassan`, and updated the generated Prisma repository to normalize the old placeholder for existing vouchers both when listing and recording Manager preview. The complete Payment Voucher database overlay passes TypeScript validation.
- Fixed the Project Manager list view's clipped `View details` button by expanding the action column to 14%, rebalancing the other desktop columns, reducing action-cell side padding, and constraining the button to its available cell width. CSS remains balanced at 122/122 rule braces.
- Added Finance/Director-style Grid and List modes to the generated Project Manager Payment Voucher queue. List is the default and shows PV number, recipient, division, amount, workflow status, preview status, and a View details action. The action opens a responsive modal containing the existing live Manager preview card, so Mark as viewed still refreshes the queue and counts. Added Escape/backdrop/close dismissal and body scroll locking. The isolated Manager UI TypeScript check passes; all 39 CSS-module classes resolve and the stylesheet has balanced braces.

- Generated the first database-backed Finance Payment Voucher slice. Added active `FINANCE_ADMIN` membership validation, an idempotent `APPROVED_FOR_PAYMENT` to `FINANCE_PROCESSING` transition, durable payment date/reference/remarks/actor persistence, append-only `RECORD_PAYMENT` transition metadata, and audit events. Added two real Finance API routes and browser API methods, then updated the Finance panel/page to await the server actions and refresh PostgreSQL-backed records. Payment-proof filenames are recorded as pending metadata only; actual proof bytes and generated PDFs remain blocked on the existing S3 storage stub and are intentionally the next document-storage phase. The isolated Finance database overlay passes TypeScript validation.

- Diagnosed the Next-generated `.estuary-next/dev/types/validator.ts` errors after adding Finance routes. Both Finance source routes now exist and contain valid code, so their validator diagnostics are stale generated-cache output. A separate real error remains: `src/app/beta/payment-requests/[requestId]/page.tsx` is a zero-byte file. Generated `payment-request-detail-page.tsx` to restore that beta route using the existing `PaymentRequestDetailScreen`. Stop Next, remove only `.estuary-next`, restart the dev server, and restart the VS Code TypeScript server; never edit generated validator files.

- Added `generated/start-estuary.ps1` to prevent repeated empty-record symptoms caused by launching Next.js without the temporary database environment. The script stores no password, checks the `127.0.0.1:15432` tunnel, prompts securely, sets `DATABASE_URL`/`DIRECT_URL` only in its process, verifies Prisma migration connectivity, and launches the development server in that same process. PowerShell parser validation reports no syntax errors.

- Fixed the database-backed Finance PDF action while preserving the already-working client-side PDF builder/download. Finance now downloads the PDF in the browser, then calls a real POST `/api/v1/payment-vouchers/[id]/pdf` route instead of the localStorage `generatePaymentVoucherPdf()` operation. The repository validates saved payment information and active Finance membership, records the annual PV filename and client-download mode in the transition/audit trail, and moves `FINANCE_PROCESSING` to `AWAITING_RECIPIENT_SIGNATURE`. Mapping supports the generated filename/time without pretending that PDF bytes exist in S3. Also aligned new Finance-start transitions with the seeded `START_FINANCE_REVIEW` action while retaining fallback mapping for earlier beta rows. The Finance/PDF database overlay passes TypeScript validation.

## Next Recommended Step

- Copy and test the generated Finance start-processing/payment-information slice. After those values survive a restart, connect the S3-backed payment-proof upload and generated Payment Voucher PDF lifecycle.

# 2026-09-08 — External recipient Prisma slice

- Prepared a complete database-backed external recipient flow under `generated/`.
- Secure recipient tokens are generated with 32 random bytes; only SHA-256 hashes
  are stored in `ExternalActionToken`. Issuing a new token revokes prior unused
  tokens for the Payment Voucher, and links expire after seven days.
- Added internal link-issuance and public token-lookup/signature route files.
- Updated the Staff recipient-link panel and recipient portal to use the API
  instead of local Payment Voucher storage.
- Digital recipient signatures now transition the voucher from
  `AWAITING_RECIPIENT_SIGNATURE` to `AWAITING_STAFF_CONFIRMATION`, mark the token
  used, and write transition/audit records in PostgreSQL.
- Because private object storage is unavailable, the beta stores the signature
  data URL in transition metadata. This is temporary and must be moved to private
  object storage before production.
- `generated/tsconfig.recipient-database.json` passes TypeScript checking.
- Copy mapping and the manual test sequence are documented in
  `generated/RECIPIENT_DATABASE_FILES.md`.

# 2026-09-08 — Shared Payment Voucher records route diagnosis

- Diagnosed the “Project Manager access required” screen from the shared Payment
  Records flow.
- `src/app/beta/payment-vouchers/page.tsx` currently contains the Project Manager
  queue implementation, so all roles reaching it are incorrectly blocked.
- Restore `generated/payment-vouchers-page.tsx` to that shared route.
- Keep the Manager-specific queue at
  `src/app/beta/project-manager/payment-vouchers/page.tsx`.
- The generated shared page supports Staff, Director, Manager, and Finance with
  role-appropriate record filtering and passed its focused TypeScript check.

# 2026-09-08 — Recipient action button sizing

- Updated `generated/recipient-link-panel.module.css` so recipient workflow
  buttons use a compact 40px height, content-sized width, smaller padding, and
  single-line desktop labels. Mobile buttons remain full width.

# 2026-09-08 — Recipient button alignment follow-up

- Refined the recipient action cards: headings and descriptions reserve matching
  desktop space so the first buttons align; button labels wrap within the card
  instead of overflowing. Single-column layouts remove the reserved height.

# 2026-09-08 — Recipient portal wireframe redesign

- Updated the generated external-recipient interface to follow the supplied
  compact wireframe: one receipt-style left column and a sticky confirmation/
  signature card on the right.
- Refined the voucher header, disbursement summary, recipient information,
  line-item table, total, upload drop zone, acknowledgement copy, and responsive
  layout without changing API or Prisma behavior.
- Files: `generated/recipient-payment-voucher-view.tsx`,
  `generated/recipient-signature-panel.tsx`, and
  `generated/recipient-payment-voucher.module.css`.
- Focused recipient TypeScript check passes.

# 2026-09-08 — Recipient scrolling and overview alignment

- Removed sticky positioning from the recipient confirmation column so both
  sides scroll naturally with the page.
- Rebuilt Payment Overview as one four-column information grid: PV date,
  payment date, division and payment method on row one; payment reference,
  recipient reference, purpose and payment proof on row two.
- Updated generated recipient view/CSS pass the focused TypeScript check.

# 2026-09-08 — Recipient confirmation notice placement

- Moved recipient success/error notices outside the two-column CSS grid so they
  render directly below the public header instead of being auto-placed below the
  receipt and signature columns.
- Updated generated recipient view/CSS pass the focused TypeScript check.

# 2026-09-09 — Staff confirmation Prisma slice prepared offline

- User is working from home and the Penang database endpoint currently returns
  `TcpTestSucceeded: False`; live database testing is deferred until network or
  server access returns.
- Prepared the Staff action after a recipient submits a digital signature.
- The original Staff submitter can confirm a voucher only in
  `AWAITING_STAFF_CONFIRMATION`. The database operation records
  `CONFIRM_SIGNED_PV`, populates `signature_verified_at`, creates an audit event,
  and moves the voucher to `PENDING_FINANCE_VERIFICATION`.
- Added the explicit route file
  `generated/payment-voucher-staff-confirmation-route.ts` and changed the Staff
  panel from the local store to the Payment Voucher API.
- Copy mapping is in `generated/STAFF_CONFIRMATION_DATABASE_FILES.md`.
- Focused TypeScript checking passes; no live DB call was attempted.

# 2026-09-09 — Final Finance verification Prisma slice

- Prepared the Finance action after Staff confirms the recipient signature.
- Normal path: `PENDING_FINANCE_VERIFICATION` -> `COMPLETED` using the `COMPLETE`
  transition, with `closed_at`, transition history and audit event persisted.
- Correction path: Finance can return the signed PV with remarks using
  `RETURN_SIGNED_PV`, clearing current signature state, revoking active tokens,
  and returning the voucher to `AWAITING_RECIPIENT_SIGNATURE` for a fresh link.
- Updated repository, API helper, Finance panel, and two explicit Finance route
  files under `generated/`.
- Focused Finance TypeScript checking passes. No live database call was made
  because the user is working remotely and TCP connectivity is unavailable.

# 2026-09-09 — Manual signature Prisma slice

- Completed both manual-signature alternatives for the single Payment Voucher
  workflow while preserving the digital-signature option.
- The recipient portal now lets the recipient choose digital signing or
  download, sign and upload a PDF. Recipient manual upload moves the voucher to
  `AWAITING_STAFF_CONFIRMATION` for the original Staff submitter to review.
- The Staff fallback upload now uses an API instead of local browser storage.
  A PDF received by email can be uploaded and confirmed in one action, moving
  the voucher directly to `PENDING_FINANCE_VERIFICATION` and revoking the
  recipient token.
- Manual PDF data is temporarily stored in transition metadata with a 2.5 MB
  source-file limit because private object storage is not available. This is
  beta-only and must be replaced before production.
- Added two explicit route files, updated repository mapping, API helpers, and
  both recipient/Staff components. Copy and test instructions are in
  `generated/MANUAL_SIGNATURE_DATABASE_FILES.md`.
- `generated/tsconfig.recipient-database.json` passes offline TypeScript
  checking; no live database call was made.

# 2026-09-09 — Payment Request sidebar hierarchy

- Began the Payment Request prototype while database connectivity is
  unavailable.
- Updated the generated Staff sidebar to show Travel Allowance, a nested Claims
  group with five claim types, Invoice Payment, Cash Advance and Petty Cash.
- Invoice Payment is the only enabled request link for now; unfinished request
  types are visible as `Soon` items to avoid broken routes.
- Added reusable nested-navigation rendering and matching CSS indentation.
- Copy mapping is documented in
  `generated/PAYMENT_REQUEST_SIDEBAR_FILES.md`.
- The focused sidebar TypeScript check passes.

# 2026-09-09 — Invoice Payment local prototype form

- Added a dedicated Invoice Payment route, component and CSS rather than
  extending the generic request-type selector.
- Added the previously empty Payment Request domain types and local repository.
- The form covers request/staff/project details, vendor and e-invoice URL,
  GIRO/instant transfer, payment portion, requested amounts, supporting
  documents, Manager/Director reviewers, optional remarks and review-before-
  submit.
- Local submission creates an `INV-YYYY-NNNN` reference and begins at
  `PENDING_MANAGER_REVIEW`.
- Supporting document data URLs are retained for prototype review, capped at
  five documents and 2.5 MB combined to reduce local-storage quota failures.
- Copy mapping is in `generated/INVOICE_PAYMENT_FORM_FILES.md`.
- `generated/tsconfig.invoice-payment.json` passes TypeScript checking.
- Corrected an initial requirements mismatch: removed the generic accounting
  line-item/Payment Breakdown table from Invoice Payment. The form now stores
  Invoice Total, informational Tax/SST and Amount Requested. Amount Requested is
  calculated automatically for 50% upfront, 50% balance and full payment, or
  entered manually for Other. Manager review was updated to the same model and
  the local-storage key advanced to `estuary-payment-requests-v2` to avoid
  loading incompatible prototype records.
- Restyled the Staff pre-submission review page to the supplied invoice
  prototype. It now presents a compact Ready for Review header, request hero
  and total, four-column parties/project and financial summaries, active
  e-invoice link, individual document downloads, and aligned Back/Submit
  actions. Form persistence and workflow behaviour are unchanged. Focused
  TypeScript validation passes and CSS braces are balanced.
- Copy follow-up: the user's Manager `[requestId]/page.tsx` and an incorrectly
  created Manager `new/page.tsx` were both empty (0 bytes), producing Next.js
  validator `TS2306: file is not a module`. The Manager queue page was missing.
  Correct layout is a queue `invoice-payments/page.tsx`, a populated
  `[requestId]/page.tsx`, and no Manager `new` route; Staff owns the separate
  `payment-requests/invoice-payment/new/page.tsx` route.
- Final verification after the user corrected the tree: the Staff creation
  page and both Manager pages exist with non-empty code, the incorrect Manager
  `new` folder is absent, and the full project check
  `tsc --noEmit --incremental false` passes. Remaining red squiggles in an open
  generated validator editor are stale VS Code state.
- Runtime follow-up: inspected the Staff Invoice creation route and its imported
  client component after Next reported “default export is not a React
  Component.” Both exports are valid and the full type check passes. No Node
  development process was listening on ports 3000-3002 during diagnosis, so a
  clean cache removal and single-server restart is required rather than another
  route-code change.
- Extracted the Staff pre-submission review into dedicated
  `invoice-payment-review.tsx` and `invoice-payment-review.module.css` files.
  `invoice-payment-form.tsx` now owns form state/validation and renders the
  review component when the user continues. The focused TypeScript check passes
  and the new review stylesheet has balanced braces. The copy map lists both
  new component files and their exact destinations.
- Removed the confirmation screen's Print/Save action at the user's request and
  right-aligned the remaining Create Another and Track buttons. The responsive
  mobile layout still stacks both actions at full width; TypeScript validation
  passes.
- Fixed the Manager queue grid-card status colour: the request-number selector
  had also overridden the pending badge text to blue. It now targets only the
  first/request-number span, so Manager Review Required remains amber in both
  grid and list views.
- Redesigned the Manager Invoice Payment detail/review component to the supplied
  prototype: a single bordered information card on the left, a Manager action
  card and payment-progress card on the right, compact request/status hero,
  aligned request/invoice/payment sections, and downloadable document rows.
  The tracker uses the agreed five stages (Submitted, Manager, Director,
  Finance Verification, Completed) and derives its active/completed state from
  the locally stored request status. The responsive layout moves the action and
  tracker above the details on narrow screens. Focused TypeScript checking
  passes and the shared Manager stylesheet remains balanced.
- Aligned the Invoice Payment Manager queue with the existing Payment Voucher
  previews workspace: matching padded bordered header, typography, signed-in
  summary card, page spacing, summary-card sizing and queue-panel radius. Also
  corrected the queue description so it no longer refers to the removed
  Payment Breakdown table. Mobile page padding mirrors the voucher workspace;
  the focused Invoice Payment TypeScript check passes.
- Added a separate Staff submission confirmation component and stylesheet,
  matching the supplied prototype while using the correct five-stage workflow:
  Request Submitted, Manager Review, Director Review, Finance Verification and
  Completed. It displays the generated reference, request summary, assigned
  Manager, working copy-reference, print/save, create-another and Payment
  Records actions. The copy avoids promising unimplemented email delivery or
  recall behaviour. `invoice-payment-form.tsx` now renders this component after
  local creation. Focused TypeScript validation passes and CSS braces balance.
- Added the complete local Invoice Payment Director slice. It includes an
  assigned-request queue, Director detail/approval interface, dedicated CSS,
  App Router wrappers, and an enabled Director sidebar entry. Director approval
  requires no signature and advances `PENDING_DIRECTOR_REVIEW` to
  `PENDING_FINANCE_REVIEW`; returning requires remarks and sends the request to
  `RETURNED_TO_STAFF`. Domain records now retain optional Director actor,
  review/return timestamps and return remarks. The detail page follows the same
  two-column prototype and five-stage progress tracker used for Manager review.
  Focused TypeScript validation passes and the Director CSS is balanced.
- Added Grid/List switching to the Director Invoice Payment queue, matching the
  Manager queue. Grid cards show reference, status, vendor, project, requested
  amount, requester and document count; both views retain the same filters and
  detail links. Pending badge text remains amber because the request-number
  colour selector is scoped to the first card-header span. TypeScript checking
  passes and the stylesheet remains balanced.
- Standardized Payment Requests navigation for Staff, Manager, Director and
  Finance through one shared sidebar item builder. Every role now receives the
  expandable hierarchy through Travel Allowance, nested Claims, Invoice
  Payment, Cash Advance and Petty Cash. Only implemented role routes are
  enabled; future modules display Soon. The nested Invoice label was shortened
  to `Invoice Payment` so the active item stays on one line, and redundant
  Director claim/advance entries were removed. Queue/detail paths automatically
  expand and activate their parent submenu. Sidebar TypeScript checking passes.
- Updated Manager and Director sidebars so Invoice Payment is nested beneath an
  expandable/collapsible Payment Requests branch, matching the Staff navigation
  pattern. The branch opens automatically for each role's Payment Request queue
  and detail routes, and nested links remain active on `[requestId]` pages.
  Focused sidebar TypeScript validation passes.

# 2026-09-09 — Invoice Payment Manager review

- Added the Manager Invoice Payment queue at
  `/beta/project-manager/payment-requests/invoice-payments` with pending,
  forwarded and all filters plus grid/list views.
- Added the `[requestId]` detail page and review component. The assigned Manager
  can inspect invoice details, open the e-invoice URL, download locally retained
  documents, review the requested amount, forward to the Director without
  a signature, or return to Staff with required remarks.
- Extended the local repository with guarded Manager forward/return actions and
  persisted timestamps/actor IDs. Forwarding moves to
  `PENDING_DIRECTOR_REVIEW`; returning moves to `RETURNED_TO_STAFF`.
- Added the Manager sidebar link and updated the copy map in
  `generated/INVOICE_PAYMENT_FORM_FILES.md`.
- Focused Invoice Payment and sidebar TypeScript checks pass.
- Refined submenu emphasis: Payment Requests and Claims use regular text while
  collapsed and become bold only when expanded.
- Follow-up: diagnosed unstyled native submenu buttons in the user's copied CSS.
  The copied file retained an obsolete, unclosed `.navigationBranchLabel {`
  fragment before `.navigationBranchButton`, causing the new rules to be parsed
  incorrectly. The generated `beta.module.css` is balanced and should replace
  the malformed copy in full.

# 2026-09-09 — Collapsible Payment Request navigation

- Replaced the permanently expanded Payment Request hierarchy with accessible
  expand/collapse submenu buttons for `Payment Requests` and `Claims`.
- Added rotating chevrons, keyboard focus styling, `aria-expanded`, associated
  submenu IDs, and compact nested indentation.
- Payment Requests starts expanded on its own routes and collapsed elsewhere.
- The focused sidebar TypeScript check passes after the interaction change.

# 2026-09-10 — Invoice Payment Finance verification

- Added the complete local Finance slice: Grid/List queue, verification detail
  interface, responsive Finance CSS, and queue/detail App Router wrappers.
- Finance sees requests that reached `PENDING_FINANCE_REVIEW`, can verify and
  mark them `COMPLETED` without a signature, or return them to Staff with
  mandatory correction notes.
- Extended the domain/local store with Finance actor IDs, verification/return
  timestamps and return remarks, and enabled Invoice Payment in the expandable
  Finance Payment Requests sidebar.
- Focused Invoice Payment and sidebar TypeScript checks pass, and Finance CSS
  braces are balanced.

# 2026-09-10 — Invoice Payment records and tracking

- Enabled Invoice Payment as the second available type on the shared Payment
  Records landing page while preserving Payment Voucher behavior and counts.
- Added a role-filtered Invoice Payment records screen with search, All,
  Attention, In Progress, Completed and Returned filters plus Grid/List views.
- Added a universal read-only record detail page showing request, invoice,
  payment, supporting documents, return remarks and the five-stage workflow.
  Staff sees owned records, Manager and Director see assigned records, and
  Finance sees records that reached Finance verification.
- Updated returned/completed Invoice Payment notification links to open the
  exact read-only record. Focused TypeScript checking passes and the new records
  stylesheet has balanced braces.

# 2026-09-11 — Records filters and role visibility

- Reworked Invoice Payment records filtering to match Payment Voucher records:
  a separate filter card with Search, Status, Month, Exact Date and Clear
  Filters, followed by a results card with the same segmented Grid/List control.
- Standardized visibility for both record types: Staff sees owned records,
  Manager and Director see assigned records, and Finance sees all records.
- Added a `Back to Payment Records` link above the Payment Voucher records
  header and corresponding styling.
- Focused Invoice Payment and Payment Voucher records TypeScript checks pass;
  Invoice Payment records CSS remains balanced.

# 2026-09-10 — Invoice Payment in-app notifications

- Reused the existing generic notification local store, hook, bell, dropdown,
  styles and Beta header integration; no duplicate notification UI or storage
  was introduced.
- Extended the shared notification domain union with Invoice Payment submission,
  Manager approval, Director approval, return and completion events.
- Added `invoice-payment-notifications.ts` as the Payment Request-specific event
  adapter. Submission notifies the assigned Manager; Manager approval notifies
  the assigned Director; Director approval notifies Finance accounts; returns
  notify Staff; Finance completion notifies Staff. Each notification carries
  `entityType: INVOICE_PAYMENT` and a role-correct internal link.
- Connected the adapter to the Staff form and Manager, Director and Finance
  review components. Notification creation is failure-isolated so a successful
  workflow transition is not undone by a notification storage error.
- Focused Invoice Payment notification TypeScript checking passes.

# 2026-09-14 — Shared payment-record reference numbering

- Added `generated/payment-record-reference.ts` as the shared creation-time
  reference generator for every Payment Records type.
- Standardized prefixes as Payment Voucher `PV`, Invoice Payment `INV`, Expense
  Claim `EC`, Cash Advance `CA`, Travel Allowance `TA`, and Petty Cash `PC`,
  using the format `<PREFIX>-<YEAR>-<at least 4 digits>`.
- Each payment type has an independent annual sequence. The generator finds the
  highest existing sequence instead of counting records, preventing accidental
  number reuse after a local record is removed.
- Wired Invoice Payment into the shared local Payment Request generator.
  Existing stored references remain unchanged; newly created records use the
  standard format.
- Correction: Payment Voucher was not connected to the local helper because its
  production flow is already Prisma-backed. The Prisma repository assigns its
  `submission_number` transactionally through `DocumentSequence`, using month
  `0` as a reserved yearly counter. This already resets PV numbering to `0001`
  for each new calendar year. The temporary generated dummy-store change was
  reverted.
- Focused Invoice Payment TypeScript validation passes.

# 2026-09-14 — Payment Records reference ordering

- Clarified that the requested change concerns list ordering, not identifier
  generation: Payment Records should appear by reference sequence rather than
  by most recently updated timestamp.
- Added a shared natural reference comparator and applied ascending reference
  order to both Invoice Payment and Payment Voucher Grid/List results. Example:
  `INV-2026-0001`, `INV-2026-0002`, `INV-2026-0003`.
- Future Claims, Cash Advance, Travel Allowance, and Petty Cash records pages
  should reuse this comparator.

# 2026-09-14 — Travel Allowance Staff interface

- Added the first Travel Allowance slice at
  `/beta/payment-requests/travel-allowance/new` and enabled its Staff sidebar
  link.
- Replaced the Google Sheet-link workflow with structured travel entries. Each
  row captures travel date, employee, division/project, reason, meal selections,
  optional special allowance and mandatory special-allowance reason.
- Fixed meal rates are Breakfast RM10, Lunch RM20 and Dinner RM20; line and
  request totals are calculated automatically. Up to 12 rows are supported.
- Added Staff review and confirmation states, optional local supporting files,
  local `TA-YYYY-0001` creation, `PENDING_DIRECTOR_APPROVAL`, and payment-target
  calculation for one business day before the earliest travel date.
- Added a browser-downloadable landscape A4 TA PDF matching the supplied form's
  header, requester fields, 12-row allowance table and totals. A representative
  sample PDF was rendered and visually checked after correcting header overlap.
- User already owns the official TA template, so the temporary sample PDF was
  removed from the delivery set. Target template location is
  `public/templates/travel-allowance-template.pdf`; exact PDF positioning must
  be mapped against the real file when it is supplied.
- Focused Travel Allowance TypeScript validation passes.

# 2026-09-14 — Payment Request domain organization

- Reorganized Payment Request domain types by payment type to keep modules
  understandable: Invoice Payment copies to
  `domain/payment-requests/invoice-payment/types.ts` and Travel Allowance to
  `domain/payment-requests/travel-allowance/types.ts`.
- Initially considered a shared uploaded-document type, then simplified it at
  the user's request: Invoice Payment and Travel Allowance now each export their
  own `PaymentRequestDocument` from their payment-type `types.ts` file. There is
  no required `payment-requests/shared/types.ts` file.
- Updated all generated Invoice Payment and Travel Allowance imports, TypeScript
  configurations, and copy maps. Both focused TypeScript checks pass and no old
  `domain/payment-requests/types` imports remain.

# 2026-09-14 — Travel Allowance Staff-only copy set

- Deferred TA PDF generation until the final workflow step because the user
  already owns the official template.
- Removed the PDF import and download action from the current Staff confirmation
  and removed the generated temporary PDF builder, leaving a self-contained
  Staff submission/review/confirmation slice.
- Focused Travel Allowance TypeScript validation passes without any PDF file.

# 2026-09-14 — Self-contained payment-type document types

- Kept the existing Invoice Payment `PaymentRequestDocument` unchanged in
  `domain/payment-requests/invoice-payment/types.ts` so the user's pasted review
  import remains valid.
- Travel Allowance owns the equivalent document shape in its own `types.ts`.
  Removed the generated shared type file and updated all imports and copy maps.

# 2026-09-14 — Travel Allowance requester and fixed meals

- Removed the redundant employee-name field from every Travel Allowance entry.
  The signed-in Staff name is stored once on the request and displayed in the
  requester/review summary.
- Kept meal prices fixed in the domain: Breakfast RM10, Lunch RM20 and Dinner
  RM20. Staff selects meal types but cannot edit the rates.
- Updated validation, form rows, review table and documentation. Focused Travel
  Allowance TypeScript validation passes.

# 2026-09-14 — Travel Allowance Project Name selector

- Replaced each Travel Allowance row's free-text division/project field with a
  Project Name dropdown containing the Finance-provided project-code list.
- Added `Other`; selecting it reveals a required free-text Project Name input.
  The resolved value is stored as `line.projectName` and shown consistently on
  the review page.
- Updated the domain line shape, form, validation, CSS and documentation.
  Focused Travel Allowance TypeScript validation passes.

# 2026-09-14 — Return to Prisma PV manual-signature testing

- User confirmed TCP/database connectivity and passed the complete single-PV
  digital-signature flow through `COMPLETED`.
- Inspected the active project and confirmed that both manual alternatives are
  already present: recipient manual-PDF upload and Staff upload of a signed PDF
  returned outside Estuary. Prisma repository methods, API routes and both UI
  entry points exist.
- The next verification order is single-PV recipient manual upload, single-PV
  Staff manual upload, digital regression, then bulk creation. In bulk, signing
  remains per voucher so manual and digital vouchers can coexist in one batch.
- Focused generated recipient/manual database TypeScript validation passes.

# 2026-09-14 — Bulk and manual-multiple PV Prisma conversion

- User confirmed that the single-PV digital and manual-signature flows both pass.
- Converted the existing Staff bulk workflow from the local Payment Voucher store
  to the Prisma-backed Payment Voucher API. Both manual multiple-entry rows and
  spreadsheet rows share this path.
- Preserved the two-stage workflow: create database drafts first, then select the
  drafts to submit. Added a real draft-submit API route and transactional Prisma
  repository method with ownership, draft-state and Director-membership checks.
- Converted Director bulk approval from the local store to the already-tested
  per-voucher Prisma approval API and remove successfully approved vouchers from
  the visible pending list immediately.
- No Prisma schema change is required. Every row is a normal Payment Voucher and
  receives a unique yearly `PV-YYYY-xxxx` number through `DocumentSequence`.
- Focused TypeScript validation passes. Exact copy map is in
  `generated/BULK_PAYMENT_VOUCHER_PRISMA_FILES.md`.

# 2026-09-14 — Bulk PV review styling correction

- Fixed the bulk preview component importing the general Payment Voucher CSS
  module instead of its own bulk CSS module.
- Replaced mismatched single-PV breakdown class names with bulk preview table
  and card classes. Added compact five-card summary styling and responsive
  three-, two- and one-column layouts.
- The copy set now includes the corrected `bulk-preview-panel.tsx` and full
  `bulk-payment-voucher.module.css`. Focused TypeScript validation passes.
- Added a 12px gap between the Back and Create Drafts actions in the bulk review
  footer; this follow-up requires replacing only the bulk CSS module.

# 2026-09-14 — Prisma TCP transaction timeout

- Bulk draft creation reached the audit insert slightly after Prisma's default
  five-second interactive transaction timeout (`5054 ms`).
- Increased global Prisma interactive transaction `maxWait` to 10 seconds and
  `timeout` to 20 seconds in `src/lib/db/prisma.ts`. This keeps submission,
  numbering and audit creation atomic while accommodating TCP database latency.
- A development-server restart is required because PrismaClient is cached as a
  development singleton.

# 2026-09-14 — Invoice project selector and amended TA workflow

- Invoice Payment Project Name now uses the same Finance project-code dropdown
  and conditional `Other` input as Travel Allowance. The stored field remains
  `projectName`, so downstream Invoice views are unchanged.
- Amended Travel Allowance to support two paths: Staff self-request goes through
  Manager review before Director; Manager on-behalf request bypasses Manager
  review and goes directly to Director. Both then proceed to Finance.
- Manager has a combined request queue/tracker with a right-side New Request for
  Staff action. Manager-created requests remain visible for tracking without a
  self-review action.
- Added employee identity per travel line. Staff lines are populated and hidden
  automatically; Manager entry exposes an Employee selector and can include
  several employees in one request.
- Increased the row limit from 12 to 100 and added Duplicate for faster repeated
  entries. Spreadsheet import is deferred as the best later enhancement for
  very large batches.
- Added local Manager review/return and Director approve/return state changes,
  shared progress tracking, routes and sidebar links. Focused Invoice and Travel
  Allowance TypeScript checks pass.

# 2026-09-14 — Travel Allowance Finance and Payment Records

- Added Finance Travel Allowance queue and detail routes using the shared queue
  and progress interface. Finance must enter payment date and reference before
  verifying the request as `COMPLETED`, or may return it with correction notes.
- Added Finance completion/return metadata and local-store transitions.
- Added Travel Allowance Payment Records list and detail pages with consistent
  search, status/month/date filters and grid/list views.
- Record visibility: Staff sees requests created for them or containing their
  employee ID; Manager sees assigned or self-created requests; Director sees
  assigned requests; Finance sees all Travel Allowances.
- Enabled the Travel Allowance card on the Payment Records landing page and the
  Finance sidebar link. Focused Travel Allowance TypeScript validation passes.

# 2026-09-15 — Travel Allowance confirmation tracker

- Replaced the small inline Travel Allowance success state with a dedicated
  Invoice-style confirmation component and CSS module.
- Confirmation shows reference copy action, current status, total, employees,
  first travel date, payment target, next reviewer, create-another action and a
  direct Travel Allowance Payment Records link.
- Staff self-requests show the five-stage Manager workflow; Manager on-behalf
  requests show the four-stage workflow with Manager self-review omitted.
- Focused Travel Allowance TypeScript validation passes.

# 2026-09-15 — Travel Allowance Staff Prisma slice

- Replaced the generated Staff Travel Allowance form's local-storage create call
  with `POST /api/v1/travel-allowances`.
- Added a Prisma repository, collection route, record route and browser API
  client for Staff request creation/readback.
- Expanded the Travel Allowance domain input with `organizationId` and retained
  `managerApproverId` on both input and `TravelAllowanceRecord`, fixing the
  reported interface mismatch.
- Staff creation now writes Submission, TravelAllowanceDetail, SubmissionLine,
  ApprovalStep, SubmissionTransition, DocumentSequence and AuditEvent records in
  one transaction, beginning in `PENDING_MANAGER_REVIEW`.
- Corrected Prisma approval timestamps to use `ApprovalDecision.created_at`.
- Added `generated/TRAVEL_ALLOWANCE_STAFF_PRISMA_FILES.md` with the exact copy
  map. Manager actions remain intentionally deferred.
- Verified the Staff-only generated slice with TypeScript against the real app
  dependencies and Prisma client; it passes with zero errors.
- Standardized Payment Request organization across domain, data, feature and API
  layers. Type-specific data now uses
  `src/data/payment-requests/<payment-type>/`, and API routes use
  `src/app/api/v1/payment-requests/<payment-type>/`.
- Added an organized, copy-ready Travel Allowance Staff tree under
  `generated/src/` plus `generated/PAYMENT_REQUEST_FOLDER_STRUCTURE.md` for the
  five categories: travel-allowance, invoice-payment, cash-advance, claim and
  petty-cash.
- Copied the complete matched Staff set directly into the real Estuary-main
  checkout after the user reported 84 TypeScript errors. Root causes were an old
  Travel Allowance `types.ts` and a zero-byte `[id]/route.ts`; both were replaced.
- Mechanically updated remaining Invoice imports from the removed shared
  `@/domain/payment-requests/types` path to the separated
  `@/domain/payment-requests/invoice-payment/types` path.
- Full-project TypeScript errors dropped to seven. All seven are intentionally
  isolated to the unfinished Travel Allowance Manager review component importing
  obsolete local-store actions. Staff Travel Allowance has no remaining reported
  TypeScript errors and no local-store import.

# 2026-09-15 — Travel Allowance Manager Prisma slice

- Replaced the Travel Allowance Manager queue and review UI's obsolete local
  storage calls with the type-owned Travel Allowance browser API.
- Added Prisma Manager review and return operations with assignment/state checks,
  approval decisions, step activation, transitions and audit events.
- Extended Travel Allowance creation for Manager-on-behalf requests. Those begin
  at `PENDING_DIRECTOR_APPROVAL`, assign the selected Director and mark the
  Manager step `BYPASSED`.
- Added Manager-scoped database queue loading and dedicated API routes at
  `[id]/manager-review` and `[id]/manager-return`.
- Installed the organized Manager components, API routes, data changes and page
  routes directly into Estuary-main.
- Full Estuary-main TypeScript check now passes with zero errors.
- Updated `src/app/beta/role-sidebar.tsx` so the Manager Payment Requests submenu
  exposes separate `Travel Allowance reviews` and `New Travel Allowance` links.
  The queue points to `/beta/project-manager/payment-requests/travel-allowances`
  and the on-behalf form points to the nested `/new` route. Revalidated the full
  project with zero TypeScript errors.
- Refined the Manager navigation from two flat entries into an expandable
  `Travel Allowance` branch with `Reviews` and `Request for Staff` children.
  Changed active-item selection to the longest matching route, preventing both
  the queue and `/new` child from appearing active simultaneously. Preserved the
  user's removal of Manager `Review history`.
- Removed the duplicate `+ New request for Staff` button from the Manager queue;
  creation is now accessed only from the sidebar submenu. Full TypeScript check
  still passes with zero errors.

# 2026-09-15 — Travel Allowance Director Prisma slice

- Added Director-scoped Travel Allowance database listing, showing requests only
  after Manager review (or immediately for Manager-on-behalf requests).
- Added Prisma Director approval and return operations with state/assignment
  checks, ApprovalDecision updates, transitions, audit events and forwarding to
  `PENDING_FINANCE_VERIFICATION`.
- Added dedicated `director-approve` and `director-return` API routes and browser
  client methods.
- Replaced placeholder Director queue/review outputs with complete database-aware
  components and packaged their two Next.js pages under `generated/src/`.
- Focused Staff + Manager + Director Travel Allowance TypeScript check passes.
- Per user preference after editor save conflicts, Director files were packaged
  for manual copying and were not written into the live Estuary-main checkout.

# 2026-09-15 — Travel Allowance Finance + PDF slice

- Inspected the user's real `public/templates/travel-allowance-template.pdf`: one
  842x595 landscape page, 12 static rows, no AcroForm fields.
- Added Finance-scoped Prisma listing with optional travel-month filtering,
  Finance completion/payment recording and Finance return actions.
- Added `finance-complete`, `finance-return` and private no-store `form` API
  routes plus matching browser-client functions.
- Added Finance queue/review components and pages with month/status/search
  filters, PDF preview/download, payment date/reference capture and return notes.
- Added a server-side `pdf-lib` TA generator using the existing blank template.
  It duplicates the page every 12 entries, uses global row numbering, prints
  `Page X of Y`, shows `Continued` on intermediate pages and the grand total on
  the final page.
- Generated and rendered a 14-entry two-page sample. Visual QA confirmed aligned
  header fields, rows 1-12 then 13-14, blank unused continuation row numbers and
  final-page total. The generated PDF has two pages and zero form widgets.
- Focused Staff + Manager + Director + Finance + PDF TypeScript check passes.
- Finance files are packaged under `generated/src/` for manual copy and were not
  installed into the live checkout.

# 2026-09-15 — Travel Allowance PDF alignment refinement

- Adjusted generated header values so name, position, date and contact begin
  after their printed labels and remain inside their respective boxes.
- Increased populated header text to 8pt and table values to approximately
  6–7pt, with totals and page labels also enlarged for readability.
- Enlarged the white masks over the template's example row numbers so unused
  continuation rows remain clean.
- Regenerated and visually inspected the 14-entry, two-page sample; rows remain
  contained within their cells and pagination still continues from 12 to 13.
- Updated the manual-copy version under `generated/src/`; the live Estuary-main
  checkout was not overwritten.

# 2026-09-15 — Travel Allowance Finance action/PDF numbering refinement

- Removed first-page row-number masking from the TA PDF generator. The first
  page now preserves the template's native 1-12 labels without white overlays.
- Kept masking and global renumbering only for continuation pages, allowing
  rows 13 onward while blank continuation rows remain unnumbered.
- Removed the direct `Download form` action from the Finance queue. Pending
  rows now show only `Verify request`; PDF preview/download remains inside the
  Finance verification screen. Completed rows retain `View record`.
- Focused Travel Allowance TypeScript checks passed and the 14-entry sample was
  regenerated and visually inspected on both pages.
- Changes remain packaged under `generated/src/` for manual copying; the live
  Estuary-main checkout was not overwritten.

# 2026-09-15 — Travel Allowance Prisma payment records

- Replaced the old Travel Allowance payment-record list/detail browser-storage
  reads with the existing Travel Allowance API and PostgreSQL/Prisma repository.
- Extended Travel Allowance list scoping to Staff as well as Manager, Director
  and Finance. Staff sees requests submitted by or made for them; Manager sees
  assigned/on-behalf records; Director sees assigned records. A separate
  `includeAll` records mode lets Finance see every TA record while its work queue
  remains limited to requests that reached Finance.
- Added the Travel Allowance records list and detail pages under the dedicated
  `payment-records/travel-allowances` route and component folder.
- Kept the records design consistent with Invoice Payment: summary cards,
  search/status/month/exact-date filters, grid/list views, ordered TA numbers,
  record detail, progress tracker and generated-form preview/download.
- Updated the Payment Records landing page so Travel Allowance is available and
  its count/attention values come from the database. Invoice remains local until
  its separately planned Prisma migration.
- Verified no Travel Allowance records component imports the local store, and
  both focused Travel Allowance and Invoice/records TypeScript checks pass.
- Confirmed Prisma operations exist for create, Manager approve/return, Director
  approve/return, and Finance complete/return. Correction editing/resubmission
  after a return is not implemented yet and remains the final workflow gap.

# 2026-09-15 — Invoice Payment Prisma migration (backend + Staff submission)

- Confirmed the live Invoice `api.ts` and `prisma-repository.ts` placeholders
  were empty and the Invoice interfaces still used the local browser store.
- Added Prisma-backed Invoice creation/list/get, Manager review/return, Director
  review/return and Finance complete/return operations using Submission,
  InvoicePaymentDetail, lines, approval decisions, transitions and audit events.
- Added yearly `INV-YYYY-0001` document sequencing and 15-second interactive
  transaction timeouts. No Prisma schema migration is required.
- Added the Invoice API client and eight Next.js routes (collection, single
  request, and six workflow actions).
- Added `organizationId` to the Invoice creation input and changed the Staff
  form submission to await the database API.
- Packaged the completed files under their exact `generated/src/...` paths and
  confirmed the focused Invoice TypeScript check passes.
- Manager, Director, Finance, records and landing-page UI components still need
  their local-store calls replaced before the Invoice migration is complete.

# 2026-09-15 — Invoice Payment Prisma migration completed

- Replaced local Invoice reads/actions in Manager, Director and Finance queues
  and detail screens with the Invoice API client.
- Replaced local Invoice payment-record list/detail reads and Payment Records
  dashboard counts with role-scoped PostgreSQL API queries.
- Packaged all role components and record components under dedicated
  `invoice-payment` folders, while keeping shared payment-record card/CSS files
  at the component root per user preference.
- Packaged all role pages and record pages under their exact final `src/app`
  routes. Corrected Project Manager page imports to include its folder.
- Confirmed the complete generated Invoice UI contains no imports or calls to
  `local-payment-request-store`; focused TypeScript validation passes.
- Invoice request/workflow/record data is now Prisma-backed. Existing browser
  notification behavior remains separate, and historical browser-only Invoice
  records are not automatically migrated into PostgreSQL.

# 2026-09-16 — Travel Allowance form card UI

- Restyled the dedicated TA Form section in Finance verification and Travel
  Allowance payment-record details to match the supplied visual reference.
- Added a red document icon, PDF title and generation note, plus separate
  preview and download actions without changing supporting-document styling.
- Added responsive behavior that moves the actions below the form information
  on narrow screens.
- Organized the shared workflow stylesheet at its final imported
  `generated/src/features/payment-request/components/travel-allowance` path.
- Confirmed the focused Travel Allowance TypeScript validation passes.

# 2026-09-16 — Shared pagination for record and workflow lists

- Added a reusable list-pagination component and hook with 10, 25, 50 and 100
  rows per page, first/previous/numbered/next/last controls, and a 1,000-record
  client-side safety boundary.
- Applied pagination to Invoice Payment and Travel Allowance Manager, Director
  and Finance queues, plus both payment-record list screens.
- Pagination resets safely after searches, filters or database results change
  and paginates both card and table views from the same result set.
- Added a drop-in paginated Payment Voucher record-list wrapper for the general
  voucher records and approvals pages.
- Focused Invoice Payment, Travel Allowance and Payment Voucher TypeScript
  validation completed without errors.

# 2026-09-16 — Prisma Studio deletion diagnosis

- Investigated the Prisma Studio failure shown while deleting a Submission.
- The visible popup is a Prisma Studio query-engine/module-resolution stack,
  rather than a normal PostgreSQL foreign-key error.
- Installed Prisma CLI and Client are both 6.19.3; the active runtime is Node
  24.19.0.
- Submission children mostly use cascade deletion, but ApprovalDecision does
  not cascade through ApprovalStep. AuditEvent and SignatureEvent keep plain
  submission IDs, so direct Studio deletion can also leave orphaned history.
- Recommended restarting Studio through the project-local pnpm command after
  regenerating Prisma Client, then using a controlled development cleanup
  transaction rather than deleting workflow submissions directly in Studio.

# 2026-09-16 — Invoice and Travel Allowance correction/resubmission

- Added PATCH-based resubmission for Invoice Payment and Travel Allowance
  requests in `RETURNED_TO_STAFF` state.
- Resubmission updates the existing Prisma Submission and preserves its
  document number rather than creating a duplicate request.
- The transaction replaces editable detail/line data, clears prior approval
  decisions, resets Manager and Director approval steps, records a RESUBMIT
  transition and audit event, and routes the request back into approval.
- Existing forms now accept returned records as prefilled initial data and show
  the latest Manager, Director or Finance correction reason.
- Added Staff correction pages and an `Edit and resubmit` action to Invoice and
  Travel Allowance payment-record details. Access is limited to the original
  requester; employees included in a Manager-created TA remain read-only.
- Updated snapshot mapping to use the latest CREATE/RESUBMIT snapshot while
  preserving the original request number and transition history.
- Focused Invoice Payment and Travel Allowance TypeScript checks pass.

# 2026-09-16 — Returned-record wireframe redesign

- Redesigned Invoice Payment and Travel Allowance returned-record details from
  the supplied prototypes while treating their HTML as visual reference only.
- Added a structured correction notice identifying the returning role, actor,
  date, remarks and correction guidance.
- Added a sticky right rail with the existing progress tracker and a separate
  amber Action Required card containing the Start Corrections entry point.
- Added a Returned tag to the exact halted workflow step and retained the
  existing Staff/requester authorization checks for correction access.
- Preserved the TA PDF card, record data, Prisma behavior and resubmission
  routes; this change is interface-only.
- Added responsive behavior for tablet/mobile layouts and confirmed both
  focused TypeScript checks pass.

# 2026-09-16 — Payment Voucher rejected-amendment Prisma repair

- Diagnosed the Staff amendment failure: the amendment workspace still read from the legacy local-storage store, while the new Prisma-backed voucher existed only through the API.
- Added a Prisma-backed resubmission path that updates the rejected voucher in place, preserves its PV number and audit history, creates a new Director approval step, and returns it to `PENDING_DIRECTOR_APPROVAL`.
- Limited the **Amend Payment Voucher** action to the original Staff submitter. Director/Finance may retain the rejected record for history but cannot invoke the Staff action.
- Generated copy-ready files and a destination map in `generated/PAYMENT_VOUCHER_AMENDMENT_FILES.md`.

# 2026-09-16 — Travel Allowance record sidebar scrolling

- Removed sticky positioning from the returned Travel Allowance record's right-side progress/action rail.
- The Payment Progress and Action Required cards now remain in their normal document position while the page scrolls.
- Updated copy-ready CSS: `generated/src/features/payment-records/components/travel-allowance/travel-allowance-records.module.css`.

# 2026-09-16 — Cash Advance implementation planning

- Defined Cash Advance as two connected lifecycles: initial request/approval/payment and post-payment reconciliation.
- Kept Participant Allowance conditional and balance-return proof conditional on an underspend.
- Deferred PDF generation.
- Added a complete path-by-path implementation checklist at `generated/CASH_ADVANCE_IMPLEMENTATION_FILES.md` for the next work session.

# 2026-09-17 — Cash Advance Prisma workflow generated

- Implemented a no-schema-change Cash Advance workflow using the existing `Submission`, `CashAdvanceDetail` (`ca_detail` relation), lines, transitions, approvals and audit structures.
- Generated domain/policy, Prisma repository, API client/validation, twelve API route files, shared UI, Staff request/correction/reconciliation, Manager approval, Director approval, Finance payment/reconciliation and role pages.
- Staff signs during final review before the record is submitted to Manager.
- Reconciliation details are stored as transition snapshots; initial request rows remain in `SubmissionLine`.
- PDF, sidebar wiring and Payment Records are deferred until core workflow testing.
- Full generated set passes TypeScript with `generated/tsconfig.cash-advance.json`.
- Copy map: `generated/CASH_ADVANCE_COPY_FILES.md`.

# 2026-09-17 — Shared signatures for every beta role

- Generalized the existing Director-only browser signature store so Staff, Manager, Director and Finance can each save an active signature from `/beta/settings/signature`.
- Preserved legacy Director signature function names and migrated legacy records while reading, maintaining compatibility with Payment Voucher code.
- Cash Advance Staff, Manager and Director actions now require and use the active saved signature ID instead of a typed-name signature.
- Finance can manage a signature in Settings, although the current Cash Advance workflow records Finance payment/verification without requiring a Finance signature.
- Updated generated signature files and Cash Advance components pass the combined TypeScript check.

# 2026-09-17 — Cash Advance role page hierarchy correction

- Moved Manager, Director and Finance Cash Advance pages beneath each role's `payment-requests/cash-advance` segment.
- Standardized role detail route parameters as `[requestId]`.
- Updated role queue links to target the corrected paths and removed the obsolete generated role page paths.

# 2026-09-17 — Cash Advance role sidebar

- Enabled Cash Advance inside the Payment Requests submenu for Staff, Manager, Director and Finance.
- Staff receives nested `My requests` and `New Cash Advance` links; approval roles receive their role queue link.
- Added `My signature` under Settings for every role.
- Cash Advance submenus automatically expand on Cash Advance routes.

# 2026-09-17 — Database signatures and Cash Advance UI redesign

- Replaced Cash Advance/Settings local signature usage with PostgreSQL-backed active signature references using the existing `UserOrgMembership.signature_url` and `Document` models; no migration required.
- Signature image binaries are written to `runtime/private/signatures`, never `public`; metadata and active storage key are persisted in PostgreSQL.
- Added signature GET/POST/DELETE API, private image route, API client and Prisma repository.
- Cash Advance submission and Manager/Director approvals verify that the supplied signature Document is owned by the actor and is still their active database signature.
- Refactored Staff Cash Advance into Request Details → Review & Sign → Confirmation with a dedicated expense-entry component, consistent section cards, totals and responsive layout.
- Refined the progress tracker and confirmation layout to match Invoice Payment and Travel Allowance patterns.
- Full generated Cash Advance and signature set passes TypeScript.

# 2026-09-17 — Payment Voucher database signature migration

- Migrated single and bulk Payment Voucher Director approval from the browser-local signature store to the shared PostgreSQL signature API.
- Added server-side approval validation tying the supplied signature Document to the assigned Director, voucher organization and active `UserOrgMembership.signature_url` value.
- Migrated Payment Voucher PDF signature loading to the private signature Document endpoint while preserving the approved historical Document ID.
- Corrected Payment Voucher draft submission in the detail interface to use the PostgreSQL API rather than the local voucher store.
- The combined Payment Voucher/database-signature TypeScript project passes with zero errors.
- Copy map: `generated/PAYMENT_VOUCHER_SIGNATURE_DATABASE_FILES.md`.

# 2026-09-17 — Cash Advance interface consistency redesign

- Rebuilt the Cash Advance request and review forms as single receipt-style surfaces with divided sections, matching the supplied wireframe and the Invoice/Travel interface language.
- Rebuilt Manager, Director and Finance Cash Advance queues with role workspace headers, signed-in identity cards, action statistics, search, action/history filters, Grid/List views and pagination.
- Rebuilt Cash Advance detail presentation as one continuous receipt for overview, request entries, supporting documents and reconciliation information.
- Moved the role action/return panel above the payment tracker in the right rail for Manager, Director and Finance.
- Removed Staff `My requests` from the Cash Advance sidebar submenu; submitted requests direct Staff to Payment Records.
- Cash Advance TypeScript and CSS-module class coverage checks pass.

# 2026-09-17 — Cash Advance compact form refinement

- Removed the Cash Advance submenu entirely; Staff Cash Advance links directly to the new request form and approval roles link directly to their queues.
- Reduced Cash Advance form-only typography to align with Invoice Payment and Travel Allowance without shrinking the role workspace pages.
- Refined the request breakdown to match the supplied compact reference: blue Add expense button, smaller headers and inputs, subtle delete control, grey minimum strip and neutral total panel.
- Cash Advance TypeScript passes after the refinement.

# 2026-09-17 — Cash Advance role queue sizing and detail-route fix

- Reduced the shared Manager/Director/Finance Cash Advance workspace and list typography to Travel Allowance proportions.
- Changed role queue detail links from the internal Prisma submission ID to the stable encoded Cash Advance request number, which the repository already resolves.
- Confirmed all three role detail pages exist under `[requestId]` and accept the request number.
- Found the live `.estuary-next/dev/types/routes.d.ts` cache malformed while the dev server was unresponsive; the user should stop the server, remove `.estuary-next`, and restart so Next regenerates route metadata.
- Source-only Cash Advance TypeScript check passes after excluding the malformed generated Next cache from the verification project.

# 2026-09-17 — Cash Advance confirmation and tracker correction

- Corrected the Cash Advance tracker so submission completes `Request Submitted` in green and makes `Manager Review` the active blue-outlined step.
- Matched the Invoice tracker visual language with green checks, outlined current/returned markers, connecting lines, actor names and dates.
- Reduced confirmation typography and controls, resolved Manager IDs to display names, and changed the confirmation detail link to use the stable request number.
- Source-only Cash Advance TypeScript and CSS class coverage checks pass.

# 2026-09-17 — Cash Advance blank tracker markers and role-safe back links

- Removed numbering from all active and pending Cash Advance tracker circles; only completed checks and returned crosses retain symbols.
- Replaced the broken relative `../` Cash Advance back link with explicit role-specific queue destinations for Manager, Director and Finance; Staff defaults to Payment Records.
- Source-only Cash Advance TypeScript passes.

# 2026-09-17 — Cash Advance simplified stages and unified confirmation

- Removed the segmented Request details / Review & sign / Confirmation strip from the Cash Advance form, review and confirmation screens while retaining the internal three-stage workflow.
- Rebuilt Cash Advance confirmation as one Invoice/Travel-style receipt with breadcrumb, success header, copyable reference, status, compact request summary, horizontal six-stage workflow and footer actions.
- Kept workflow circles unnumbered in accordance with the latest tracker design.
- Source-only Cash Advance TypeScript, segmented-stepper absence and CSS-module class coverage checks pass.
- Replaced empty Cash Advance confirmation `.complete` / `.pending` placeholder rules with explicit `data-state` selectors for complete, active and pending workflow states; TypeScript passes and no empty state rules remain.
- Normalized Cash Advance Manager/Director/Finance right-rail action panels with standard 9–14px typography, compact signature previews, full-width 11px action buttons, shorter remarks fields and consistent spacing; styles remain scoped to `.rail .sideCard` and verification passes.
- Added a scoped 10px gap between Finance input fields and their following primary action button so Confirm payment no longer touches the Bank reference field.

# 2026-09-18 — Payment Voucher local-store build and PDF download fix

- Diagnosed the PV download failure as a compile-time dependency problem, not a limitation of database-backed signatures: the Finance panel still imported the legacy local Payment Voucher store, which imported the deleted local signature store.
- Migrated Finance `Mark inactive` to the Prisma repository/API using the existing `FINANCE_PROCESSING → INACTIVE` workflow rule and `StateGroup.VOIDED`; no schema change is required.
- Added inactive transition metadata mapping so Finance actor, timestamp and remarks remain visible after reload.
- Migrated the remaining legacy Staff signed-PV upload panel from the local store to the existing Prisma/API upload path.
- After both component replacements are copied, the obsolete `src/data/payment-vouchers/local-payment-voucher-store.ts` has no callers and should be removed rather than restoring `local-signature-store.ts`.
- Verified the Finance/database set and the PV PDF/database-signature set with focused TypeScript checks; both pass with zero errors.
- Copy map: `generated/PAYMENT_VOUCHER_DOWNLOAD_FIX_FILES.md`.
- Live API diagnosis found historical vouchers referencing the pre-migration local signature ID while Amir's active Prisma signature Document and private image file were both healthy. Added a PDF compatibility fallback: try the approved Document ID first, then resolve the Director's active database signature only when the historical ID cannot be loaded. New approvals remain document-specific.

# 2026-09-18 — Cash Advance role and reconciliation file separation

- Removed the shared `cash-advance-role-queue.tsx`; Manager, Director and Finance now have independent queue implementations with role-specific counters, filters, action labels and routes while retaining shared status/CSS primitives.
- Split Staff reconciliation into the requested `cash-spent-summary.tsx`, `participant-allowance.tsx`, `balance-return-proof.tsx`, `reconciliation-review.tsx` and orchestrating `cash-advance-reconciliation.tsx` files.
- Added complete client-side reconciliation validation and a review-before-submit stage.
- Split Finance reconciliation verification into `finance/cash-advance-reconciliation-review.tsx` and wired it into the Finance detail workflow.
- Updated `generated/CASH_ADVANCE_COPY_FILES.md`; the complete generated Cash Advance TypeScript project passes with zero errors.
- Added Travel Allowance-style supporting-document controls to the shared Cash Advance detail: icon/file metadata on the left and compact Preview document/Download buttons on the right. Preview uses a temporary browser blob URL; download preserves the original filename. Manager, Director and Finance receive the behavior through the shared detail component. TypeScript and CSS-module coverage checks pass.

# 2026-09-18 — Cash Advance Payment Records

- Activated Cash Advance on the Payment Records landing page with role-visible totals and attention counts; available beta types increased from three to four.
- Added `/beta/payment-records/cash-advances` with role-aware visibility, four summary counters, search, status/month/exact-date filters, Grid/List views and shared pagination supporting up to 1,000 records.
- Added the Cash Advance record detail route using the existing receipt, progress tracker and supporting-document preview/download UI.
- Added Staff-only action cards for returned requests and pending reconciliation; approval roles use their dedicated queues for mutations.
- Cash Advance TypeScript and Payment Records CSS-module coverage checks pass. Copy map: `generated/CASH_ADVANCE_PAYMENT_RECORDS_FILES.md`.

# 2026-09-18 — Empty Cash Advance route diagnosis

- Diagnosed the generated Next route-type error at `staff-sign/route.js`: the project contained a zero-byte `src/app/api/v1/payment-requests/cash-advance/[id]/staff-sign/route.ts`, so Next treated it as a route but TypeScript could not import it as a module.
- The current Cash Advance create/resubmit flow already submits and validates the Staff database signature; the separate `staff-sign` route is obsolete and should be deleted.
- Also found an unused zero-byte `cash-advance-signature-panel.tsx`; it should be removed because signature selection lives in `staff/cash-advance-review.tsx`.
- After deletion, stop the dev server, remove `.estuary-next`, and restart so Next regenerates route types.
- Added a scoped 14px gap and link-button alignment for the Payment Records Staff `Start reconciliation` / `Start corrections` action beneath its explanatory paragraph. The rule lives in the shared Cash Advance CSS and does not alter approval or Finance form buttons.

# 2026-09-18 — Unified Cash Advance Staff record and reconciliation

- Replaced the Staff detail page's stacked request receipt plus reconciliation form with one workspace that switches between `View request` and `Reconciliation`.
- Added `?view=reconciliation` handling to the existing Staff Cash Advance detail route, so Payment Records opens the same record directly in reconciliation mode rather than presenting a redundant second page.
- Refined returned-request behavior: request-stage returns still open the correction form, while reconciliation-stage returns open the saved reconciliation workspace and use the `Continue reconciliation` label.
- Added compact responsive workspace controls to the shared Cash Advance CSS.
- Cash Advance TypeScript passes with zero errors. The affected copy map is `generated/CASH_ADVANCE_PAYMENT_RECORDS_FILES.md`.
- Added a scoped 14px vertical gap between the Participant Allowance `Add participant` action row and its signed-proof upload area in the shared Cash Advance CSS.
- Made Payment Proof of Balance progressive: its return-date, bank-reference and upload controls stay hidden until Staff records spending and the calculated result has a positive balance. Exact-spend and overspend outcomes display a compact not-required notice instead.

# 2026-09-18 — Cash Advance PDF forms and Finance form pack

- Added server-side `pdf-lib` generation using the three templates already stored under `public/templates`.
- Added the signed Cash Advance Request Form after Director approval, the Cash Spent Summary after reconciliation, and Participant Allowance only when participants were recorded.
- Added individual Preview/Download controls plus one combined form pack that automatically contains one, two or three applicable forms.
- Request-line Purpose text wraps to two lines, reduces its font within a safe minimum and ellipsizes only when it still cannot fit the fixed template row.
- Embedded Staff, Manager and Director database signature images in the Request Form. PNG/JPG are supported; a saved WebP signature produces a clear re-upload-as-PNG/JPG error because `pdf-lib` does not embed WebP.
- Current structured reconciliation data fills the Summary and Participant templates. Template-only fields not collected by the current UI (Supplier, Type of Account, participant IC and handwritten recipient signature) remain blank; uploaded signed participant proof remains the signed evidence.
- Verified all three filled templates visually and confirmed the combined sample pack contains three A4 landscape pages. Cash Advance TypeScript passes.
- Replaced generic Cash Advance tracker actor/date labels with outcome and next-action sentences for every stage. Completed steps explain who acted and where the request went next; active steps identify the responsible role and action; pending, returned and final states now explain what must happen before progress continues.

# 2026-09-18 — Cash Advance account coding, bank details and upload-only Participant Allowance

- Added the complete approved Type of Account list and made Supplier plus Account Type required for every Cash Spent Summary row.
- Added Staff payment account fields (account holder name, bank name and account number) to the initial request, review, role detail and Cash Advance Request Form PDF. They remain in the existing submission snapshot metadata, so no Prisma schema change is required.
- Replaced structured Participant Allowance rows with a checkbox-driven workflow: download the blank template, obtain participant signatures, then upload the completed PDF/PNG/JPG.
- Finance can preview/download the uploaded participant-signed form from the reconciliation record and PDF forms section. The PDF route copies an uploaded PDF directly, or wraps an uploaded PNG/JPG as a PDF page for the combined pack.
- The Summary PDF now fills Supplier and the account code; the full account code plus description remains visible in the web review. Division continues to use the selected Project.
- Visually verified the amended Request Form, Summary, uploaded Participant form and three-page combined pack. Cash Advance TypeScript passes.

# 2026-09-18 — Cash Spent Summary responsive columns

- Removed the Cash Spent Summary table's forced `1120px` minimum width and replaced the fixed pixel columns with proportional widths, so the desktop form fits its card without a horizontal scrollbar.
- Expanded the Receipt Link column to 20% and added a reconciliation-specific override after the generic second-last-column rule, preventing the Google Drive input from being reduced to `100px`.
- Kept the existing small-screen horizontal overflow behavior because a seven-column editable table would otherwise become unusably narrow on phones.

# 2026-09-18 — Participant Allowance Excel template

- Replaced the blank Participant Allowance PDF download with an editable `.xlsx` template containing Project, Purpose, Currency, Payment Method and 25 participant rows for date, name, IC number, amount and handwritten signature.
- Updated the Staff reconciliation copy and link to download `/templates/Participant%20Allowance%20Template.xlsx`; the signed return upload remains PDF/PNG/JPG so Finance continues reviewing immutable signed evidence.
- Added the integration-ready workbook at `generated/public/templates/Participant Allowance Template.xlsx` and documented its project destination in the Cash Advance copy guides.
- Verified the workbook data, scanned for formula errors and rendered the full sheet to confirm that labels and columns are visible without clipping.

# 2026-09-18 — Participant Allowance kept as official PDF

- Restored the Staff reconciliation download to `Participant Allowance Template.pdf` so the approved logo and layout remain intact.
- The generated Excel workbook remains only as an unused draft and is not referenced by the Cash Advance interface or copy guides.
- Recommended future workflow: retain the official PDF download and optionally add a separate Google Sheet template link for data entry, printing and signature collection.

# 2026-09-19 — Payment Voucher amendment UI

- Confirmed that the copy-ready Payment Voucher detail already uses the consolidated Action Required amendment card: warning badge, rejecting Director, explanatory text, dated remarks panel and responsive action placement.
- Changed the `Amend Payment Voucher` action from bright blue to the shared dark navy (`#143b68`) with a darker navy hover state (`#0f3158`) and matching shadow.
- The affected copy-ready files remain `generated/payment-voucher-detail.tsx` and `generated/payment-voucher.module.css`; this workspace is not independently runnable.
- Aligned the amendment page's `Current action` toolbar with the `1240px` single-voucher form card by adding a scoped `amendmentWorkspace` class. Regular single/bulk creation widths are unchanged.

# 2026-09-19 — Cash Advance Request Form payment-account fields

- Diagnosed blank Account Holder Name, Bank Name and Account Number rows in the live PDF: the live `build-cash-advance-pdf.ts` does not contain any draw calls for those fields.
- Confirmed the Staff form, validation and Prisma transition snapshot already carry all three values.
- Confirmed the copy-ready PDF builder writes the fields into the correct template cells at `x=230` and center Y coordinates `190`, `177` and `164` on the final request-form page.
- Updated the Cash Advance copy guide to warn that older PDF builder copies show the template labels but leave their values blank.
- Added the Finance Use Only values to the Request Form: the forms route resolves `financePaidById` to the Prisma `User.name`, and the PDF writes the display name plus `financePaidAt` beside `Verified by:` and `Date:`. These remain intentionally blank before payment.
- Prevented reconciliation outcomes such as `UNDERSPEND` from breaking across lines in the Finance side card by overriding the shared `overflow-wrap: anywhere` rule and tightening the scoped three-column detail gap.
- Added a dedicated `reconciliationSection` scope to the Cash Advance detail. It provides medium typography and a 20px separation between the Total Spent/Balance/Outcome summary and the expense table.
- Increased the PDF form-row title, note and action text to balanced 14px/12px/12px sizing without altering other document rows.

# 2026-09-21 — Petty Cash compact page sizing

- Initially tested a centered `1180px` maximum width, then corrected it to match Cash Advance exactly: Petty Cash now fills the available Beta main column with `width: 100%`, `max-width: 100%` and `min-width: 0`.
- Adjusted the Petty Cash hero, card, field, table, button and total typography to the medium sizing used by the Invoice, Travel Allowance and Cash Advance interfaces.
- Added `min-width: 0` to the grid, cards and fields and scoped horizontal overflow to `.tableWrap`, preventing the expense table's minimum-content width from widening the full app and clipping the sidebar.

# 2026-09-22 — Petty Cash Staff UI refinement and tested-route diagnosis

- Diagnosed the live detail-page `405`: `src/app/api/v1/payment-requests/petty-cash/[id]/route.ts` exists but is empty, so the route has no `GET` export. The live ledger route was also copied under `[id]/ledger`; its correct destination is the top-level `petty-cash/ledger/route.ts`.
- Replaced the basic post-submit card with an Invoice/Travel-style Petty Cash confirmation containing reference copy, request summary, four-stage workflow tracker and Payment Records action.
- Reworked the Staff/Manager-readable Petty Cash detail into a receipt-style record with access checks, overview, expense evidence, totals, Finance payment details, correction action and four-stage progress rail.
- Rebuilt Petty Cash Payment Records to match Travel Allowance: back navigation, role summary, attention/completed metrics, clearable search/status/location/month/date filters, Grid/List views and shared pagination.
- Restyled the Staff form as one official voucher document based on the supplied wireframe while preserving the existing API contract, RM300-exclusive rule and receipt-link workflow.
- Focused Petty Cash TypeScript validation passes after the refinement.

# 2026-09-22 — Petty Cash returned-request UI consistency

- Removed the Manager review page's duplicate returned-request banner; the result and correction reason remain in the Manager Action card.
- Simplified the Staff amendment form by removing its large correction notice, adding a back link to the Petty Cash request and changing the compact correction badge to amber.
- Moved the Staff `Start corrections` action above the payment tracker and added deliberate spacing between the explanatory copy and action button.
- Added explicit shared Petty Cash badge colors: Manager pending is amber, Finance stages are blue, returned is red and paid is green, matching the Invoice, Travel Allowance and Payment Voucher status language.
- Focused Petty Cash TypeScript validation passes.
- Follow-up: hardened the shared status badge colors with semantic CSS variables and protected foreground/background colors from broad parent `span` rules used by detail views. Returned badges now retain dark red text on the pale-red background in every view.
- Replaced the amendment form's reused Manager back-row class with a dedicated padded `formBackRow`, preventing the link from overlapping the form border and header.
- Follow-up: moved `formBackRow` completely outside the amendment `<form>` and changed its styling to a separate 18px-spaced navigation row above the bordered form card.

# 2026-09-22 — Petty Cash PDF form

- Added `build-petty-cash-pdf.ts`, which overlays claimant details, request number, up to 12 expense rows per page, account/division values and totals onto the existing `public/templates/Petty Cash Template.pdf` asset.
- Kept the template's printed Penang office address unchanged, including for requests charged to the Kuala Lumpur Petty Cash float.
- Added the `[id]/form` PDF route with inline preview and attachment download behavior. The route becomes available only after Manager approval (`PENDING_FINANCE_PAYMENT`, `FINANCE_VERIFIED` or `PAID`).
- Added one Travel-style Petty Cash Form card to Staff record details, Manager review and Finance processing. It explains availability before approval and exposes Preview/Download afterward; Director access is through the shared Payment Records detail.
- Rendered a populated sample against the live template and visually verified the header fields, two expense rows and total alignment. Focused Petty Cash TypeScript validation passes.
- Follow-up clarification removed the Manager-approval gate: the latest PDF is now viewable at every status. Manager and Finance workflow pages show Preview only, Payment Record details show Preview and Download, and each paid request row in the Finance/Director ledger now shows `Preview form` beneath its payment-proof link.
- Final PDF/view refinement: moved the requester name, position, date and contact baselines from `417` to `408.5` and reduced them to 7pt so they sit cleanly inside the template row. Re-rendered against the live template and verified alignment.
- Staff and Manager detail pages now show historical correction remarks only while the current status is `RETURNED_TO_STAFF`; old remarks disappear after resubmission, re-approval and Finance processing while remaining preserved in transition history.
- Manager and Finance detail pages now expose both Preview and Download in the same Travel-style Petty Cash Form card as Staff Payment Records. The Finance/Director ledger remains preview-only for compactness.

# 2026-09-22 — Dynamic role-aware dashboard

- Replaced the Payment Voucher-only Beta dashboard with a normalized view of
  Payment Vouchers, Invoice Payments, Travel Allowances, Cash Advances, Petty
  Cash and Claims.
- Added role-aware visibility and action calculations for Staff, Manager,
  Director and Finance, including role-specific hero copy and primary action.
- Added cross-module totals, per-type record/amount/action cards and a merged
  recent-activity table with role-correct detail destinations.
- Loaded the six sources independently so one failed module produces a warning
  without hiding successful results from the other payment modules.
- Claims currently use the existing prototype payment-request endpoint and
  should move to a dedicated Claims API when that module is implemented.
- Focused dashboard TypeScript validation passes against the live project's
  installed Next.js/React dependencies.

# 2026-09-23 — Dashboard and sidebar action refinements

- Restyled `Records by payment type` to match the supplied compact wireframe:
  action badge at the top, tracked count, committed volume, category note and
  explicit category link.
- Corrected Staff category links so Invoice, Travel Allowance, Cash Advance and
  Petty Cash open their own record tables rather than the general landing page.
- Restyled the combined recent-activity table with the bordered, rounded and
  compact Payment Voucher table language.
- Added role-aware action-count bubbles to the sidebar for all six payment
  types. Staff sees only corrections and Staff-owned follow-up work; Manager,
  Director and Finance see only their own review or processing stages.
- Added a Staff `Action required` sidebar branch and Claims entries to the
  approval/processing branches so the navigation can expose all payment types.
- Added a dedicated role-filtered Claims records table, allowing the Claims
  dashboard card and sidebar item to open their own category like every other
  payment type. It remains backed by the prototype Claims endpoint.
- Updated the Petty Cash ledger so money-out values are red, proof links remain
  neutral and Petty Cash form preview links are blue.
- Focused dashboard and Petty Cash TypeScript checks pass. The validation uses
  `generated/next-env.generated.d.ts` because the live `.estuary-next` route
  cache was malformed and unrelated to these source changes.

# 2026-09-23 — Dashboard action UI simplification

- Removed the Staff `Action required` sidebar branch and stopped loading sidebar
  counts for Staff. Manager, Director and Finance retain their role-owned count
  bubbles.
- Changed sidebar action counts and dashboard `needs your action` badges from
  blue to red for stronger attention contrast.
- Removed the dashboard hero action buttons for every role.
- Removed the category phrases such as `Vendor settlements`, `Third-party
obligations` and `Field disbursement`; each card now ends only with its
  `View category` link.

# 2026-09-23 — Finance Petty Cash creation access

- Added Petty Cash to Finance's `Create payments` → `Payment Request` sidebar
  menu.
- Expanded the Petty Cash request form guard so Finance can create and resubmit
  a Petty Cash request using the same Manager-approval workflow as Staff.
- Existing Manager-approved Petty Cash requests continue to enter Finance's
  dedicated processing queue for payment verification and completion.

# 2026-09-23 — Right-column correction and remarks cards

- Removed the large returned-request banners from Invoice Payment, Travel
  Allowance, Cash Advance and Petty Cash Staff record details.
- Consolidated rejection state, reviewer identity/date, reviewer remarks,
  correction guidance and the Amend/Start corrections action into a compact
  right-column card above each workflow tracker.
- Added a reusable Payment Voucher correction card plus a validated patch that
  hides its old full-width rejection banner and inserts the new card above the
  Payment Voucher tracker.
- Follow-up: updated the complete `generated/payment-voucher-detail.tsx`
  replacement file itself. It now imports `PaymentVoucherCorrectionCard`,
  removes rejected-state branches from the old full-width action section and
  renders the correction card at the top of `pvTrackerColumn`.
- Visual follow-up: changed the Payment Voucher rejection card to a white card,
  added 16px spacing before Payment Progress and reduced the highlighted remarks
  area to one plain line: `Director's remark: …`.
- Final color adjustment: changed the Payment Voucher rejection card from white
  to a pale-red background with a soft red border so the required action remains
  visually distinct without reducing readability.
- Kept correction remarks on the editing forms where they provide necessary
  context while the Staff member is actively amending or reconciling a request.
- Invoice, Travel Allowance, Cash Advance, Petty Cash and the standalone Payment
  Voucher correction card pass focused TypeScript validation. The Payment
  Voucher integration patch also passes `git apply --check` against the current
  live detail component.

# 2026-09-23 — Payment Request correction-card rollback

- User decided to retain the existing returned-request layouts for Invoice
  Payment, Travel Allowance, Cash Advance and Petty Cash.
- Reverted only the newly introduced right-column correction-card changes for
  those Payment Request modules, including their related CSS.
- Kept the separate Payment Voucher rejection card, including its pale-red
  action treatment, one-line Director's remark and spacing above the tracker.
- Claims is the next feature area; requirements have not yet been provided.

# 2026-09-23 — Dynamic Claims request form, phase 1

- Added one shared Claims request form for Staff, Manager, Director and Finance.
- The form switches between Expense, Internet/Commute, Medical, Mileage, PD and
  Tech layouts while preserving the visual language used by the other Payment
  Request forms.
- Encoded the current policy assumptions: no Expense cap; RM70 Internet/Commute;
  RM500 annual Medical balance; per-trip Mileage rates of RM0.50/km through
  500km and RM0.30/km over 500km; RM500 PD; and RM500 standard or RM1,000
  extended Tech with a three-year Tech-claim lock.
- Added dynamic official-template preview links, automatic Mileage calculation,
  itemized rows, live policy feedback, role-neutral claimant information and a
  submission confirmation.
- Replaced the initial browser-local prototype immediately after user feedback.
  Claim submission now uses a dedicated API and Prisma repository backed by the
  existing `Submission`, `SubmissionLine` and `ExpenseClaimDetail` models.
- The repository stores the complete six-type request in the immutable CREATE
  transition snapshot and validates annual Medical usage and the Tech lock
  again inside the database transaction. No Claims data is stored in the
  browser and no Prisma schema migration is required for this form phase.
- New records use `CLAIM_SUBMITTED` / `IN_REVIEW` with no current assignee until
  the role-routing workflow is finalized.
- Claims dropdown follow-up: Expense Claim now uses the complete supplied Type
  of Account and Division option lists; Mileage uses the same complete Division
  dropdown. Claim types whose official forms do not contain these fields remain
  unchanged.
- Simplified Claims creation to one shared `/beta/payment-requests/claims/new`
  page for every role and removed redundant role-prefixed page wrappers. The
  Claims copy map now identifies exactly eight required files plus one sidebar
  link change.
- Corrected the full role sidebar after reviewing the user's pasted file:
  Claims now appears once in the Create Payment Request branch, while the
  Manager/Director approval and Finance processing Claims items continue to
  open `/beta/payment-records/claims`. Added a complete copy-ready
  `generated/src/app/beta/role-sidebar.tsx` replacement that preserves
  action-count bubbles.
- Redesigned the Claims creation UI to follow the supplied compact official
  expense-sheet prototype. Replaced external receipt URLs with required per-row
  PDF/JPG/PNG uploads (10 MB each). The multipart Claims API writes private file
  bytes to the same beta private-runtime pattern used by signatures, writes
  metadata to Prisma `Document`, links each receipt through
  `SubmissionEvidence`, and stores the resulting document IDs in the immutable
  claim snapshot. Added an active-membership-protected inline document endpoint
  for later Manager/Director/Finance preview screens.
- Aligned the Claims creation page width with the Invoice Payment and Travel
  Allowance form standard by changing its centered maximum width from 1120px to
  1240px.
- Increased Claims typography and control sizing toward the Travel Allowance
  form scale, changed Add expense/trip to the blue secondary action treatment,
  removed the official-form preview button and removed the green policy-check
  icon while retaining policy text and limit-error styling.

# 2026-09-23 — Claims confirmation and Staff-to-Manager review

- Replaced the basic Claims saved card with the same two-column confirmation
  pattern used by the other Payment Request features: success summary, four
  request facts, clear next-step guidance, My Claims/Create Another actions and
  a five-stage Claim progress tracker.
- Added a required Manager reviewer dropdown for Staff claimants. Staff
  submissions now persist as `PENDING_MANAGER_APPROVAL`, set the selected
  Manager as `current_assignee_id` and create an active Prisma `ApprovalStep`.
- Added a Manager Claims queue and Claim review page. Managers can inspect the
  claimant, type, itemized lines, account/division data, uploaded receipts and
  workflow progress.
- Added Prisma-backed Manager approve and return actions. Approval records an
  immutable `ApprovalDecision` and advances the Claim to
  `PENDING_DIRECTOR_APPROVAL`; return records the correction remarks and routes
  the request back to its claimant as `RETURNED_TO_CLAIMANT`.
- Updated the Manager sidebar Claims link to the new assigned-review queue and
  moved its action-count source from the old prototype endpoint to the dedicated
  Claims API. Expanded the Claims copy map with all confirmation, queue, detail
  and API files.
- Focused Claims TypeScript validation passes with the live project's compiler
  and generated Prisma client. Runtime/database testing still belongs in the
  live Next.js project after copying these files.

# 2026-09-23 — Complete role-based Claims routing (PDF deferred)

- Completed the remaining agreed Claims paths without implementing the PDF
  templates: Staff → Manager → Director → Finance; Manager → Director →
  Finance; Director → Finance; and Finance → Director → the submitting Finance
  user.
- The shared creation form now requires a Director selection for Staff,
  Manager and Finance claimants. Director claimants route directly to the
  active Finance user.
- Added Director and Finance Claims queues, detail screens, receipt preview and
  role-aware workflow trackers. Director records a required preview/forward
  decision; Finance records payment date/reference/notes and closes the Claim
  as `PAID`.
- Added Director and Finance return actions with correction remarks. Returned
  stage metadata keeps the tracker aligned with the stage that returned the
  Claim.
- Updated Prisma assignment/approval-step creation, role-specific list scopes,
  client APIs, route handlers, sidebar destinations and the complete Claims
  copy map.
- Migrated the dashboard Claims adapter and Claims Payment Records page from
  the prototype endpoint to the dedicated Prisma-backed Claims API, including
  role-specific detail links.
- `generated/tsconfig.claims.json` passes with no errors after including all
  Staff, Manager, Director and Finance Claims pages. PDF population, preview and
  download remain explicitly deferred.

# 2026-09-23 — Claims Drafts and Payment Records

- Added `Save as draft` beside Submit on the shared Claims form. Draft saving
  permits incomplete fields and optional receipts, writes directly through the
  Claims API to Prisma and creates a stable CL reference without entering any
  approval queue.
- Added a Draft editor that reloads the immutable saved snapshot and existing
  private receipt metadata. Saving updates the same record; submitting the
  Draft validates the complete policy/form and routes the same reference into
  the claimant-role workflow.
- Rebuilt Claims Payment Records to match Invoice/Travel/Cash Advance/Petty
  Cash patterns, with four summary cards, search, status/type/month/date
  filters, clear filters, Grid/List modes, pagination, status badges and a
  Payment Voucher-style table. Draft rows expose `Continue draft`.
- Added a role-aware read-only Claim record detail and activated Claims on the
  Payment Records landing page with live totals and attention counts.
- Draft records are excluded from Medical annual usage and Tech-lock policy
  usage until submitted.

# 2026-09-24 — Claims summary number colour

- Removed the red override from the Claims Payment Records `Require attention`
  and `Drafts` summary values. All Claims summary numbers now use the same navy
  `#1e3a5f` treatment as Invoice Payment.

# 2026-09-24 — Claims confirmation aligned with Payment Requests

- Rebuilt the Claims confirmation as the same centered, single-card receipt
  pattern used by Invoice Payment and Travel Allowance: success header,
  copyable reference, status badge, four-part summary, inline workflow and
  footer actions.
- Removed the separate right-side progress card. The workflow now adapts its
  visible stages to Staff, Manager, Director and Finance claimant routes while
  retaining Draft and returned-for-correction states.
- Added a dedicated `claim-confirmation.module.css` and included it in the
  Claims copy map so the confirmation styling can be copied independently.

# 2026-09-24 — Persist distinct Claim payment types

- Replaced the Claims repository's hard-coded `EXPENSE_CLAIM` write with a
  six-way mapping from the selected Claim form type to `PaymentType`.
- Updated all Claim reads, policy calculations and receipt authorization to
  include every Claim payment type. Draft edits also update `payment_type` if
  the user changes the Claim type before submission.
- Added the Prisma enum snippet and PostgreSQL migration. The migration adds
  the five new enum values and backfills existing rows from the Claim type in
  each submission's immutable transition snapshot. All subtypes continue to
  share the existing CL document-number sequence.

# 2026-09-24 — Claim database subtype migration deferred

- Reverted the distinct `PaymentType` implementation because the current
  database user cannot create Prisma's development shadow database and the
  schema change is being deferred for an authorized administrator.
- Claims continue to store `EXPENSE_CLAIM` in `Submission.payment_type` with
  no migration required. The precise form remains stored as `claimType` in the
  immutable transition snapshot and still drives form fields, policy limits,
  records, confirmation and approval screens.

# 2026-09-24 — Distinct Claim storage mapping restored

- Restored the six-way Claim-to-`PaymentType` repository mapping after the
  manager added the Prisma enum migration to the main Estuary repository.
- New Claims now write the selected subtype, Draft edits update the subtype,
  and all list/detail/policy/receipt queries recognize every Claim enum value.
- The Claim reference generator still uses `EXPENSE_CLAIM` only as the shared
  sequence key, ensuring all subtypes continue the same unique `CL` numbering.

# 2026-09-25 — Claims enum runtime failure diagnosed

- Confirmed the submitted Claims repository mapping is correct: writes map all
  six Claim types and reads filter across all six `PaymentType` members.
- PostgreSQL error `22P02 invalid input value for enum PaymentType` proves the
  connected database has not received the enum migration. The earlier `P3018`
  ownership failure blocked it even though the schema, migration and Prisma
  Client files were updated locally.
- The database enum must be updated on the exact database referenced by the
  app's `DATABASE_URL`, using the enum owner/admin account. Until then the only
  compatible application fallback is storing and querying all Claims as
  `EXPENSE_CLAIM`.

# 2026-09-27 — Claims approval workspaces aligned with Travel Allowance

- Rebuilt the Manager, Director and Finance Claims queues with the same page
  hierarchy used by Travel Allowance: signed-in identity card, three summary
  cards, action/history/all tabs, search, empty states and pagination.
- Restyled the queue results as the flat Payment Voucher table pattern with
  consistent headers, status badges, amounts and role-specific action links.
- Rebuilt the shared Claim review surface around the Travel Allowance detail
  layout: record header, request overview, itemized expenses, supporting
  receipt access, justification, role action rail and role-aware progress.
- Added a visual Claim Form (PDF) row with disabled Preview and Download
  controls. This is deliberately a design placeholder; PDF generation and
  download integration remain deferred.
- Added `claim-workflow.module.css` so approval screens no longer inherit the
  compact Claims creation-form typography and spacing.
- Verified the complete generated Claims scope with
  `tsc -p generated/tsconfig.claims.json --noEmit`; it passes with no errors.

# 2026-09-27 — Claims PDF generation

- Added one server-side `pdf-lib` generator for all six official Claim
  templates: Expense, Internet/Commute, Medical, Mileage, PD and Tech.
- The generator selects the template from `claimTypeDetails`, fills claimant
  and Claim metadata, maps the correct type-specific table columns, calculates
  line totals and writes the final Claim total. Overflow records copy the
  official template onto continuation pages with continuous row numbering.
- Added `/api/v1/payment-requests/claims/[id]/form` with inline preview and
  attachment download behavior, private no-store response headers and clear
  not-found/generation errors.
- Activated Preview and Download links in the shared Manager, Director and
  Finance Claim detail component.
- Visually rendered and checked representative Expense, Internet/Commute,
  Medical and Mileage outputs against the official templates. The focused
  Claims TypeScript check passes with no errors.

# 2026-09-27 — External recipient typed signature

- Replaced the external recipient's digital signature-image upload UI with a
  typed full-name field and live cursive signature preview.
- On submission, the browser renders the typed name to a transparent PNG and
  sends it through the existing recipient-signature endpoint. Existing Prisma
  document storage, Payment Voucher PDF embedding and Staff verification stay
  unchanged.
- Retained the alternative manual workflow for downloading, printing, signing
  and uploading the completed Payment Voucher PDF.
- Added a compact typed-signature CSS block designed to be appended to the
  existing `recipient-payment-voucher.module.css` supplied by the user, plus a
  copy map in `generated/EXTERNAL_RECIPIENT_TYPED_SIGNATURE_COPY_FILES.md`.
- Verified the generated component using
  `tsc -p generated/tsconfig.recipient-signature.json --noEmit`; it passes.

# 2026-09-27 — Payment Records sorting and reference formats

- Added one shared Payment Records sorter and the same simple `Sort by`
  control to Payment Voucher, Invoice Payment, Cash Advance, Travel Allowance,
  Claims and Petty Cash record screens. Options cover updated date, amount and
  reference number; clearing filters restores `Newest updated`.
- Reworked the Payment Voucher detail back control into the same blue inline
  arrow link used by the other Payment Records detail pages. It returns to the
  Payment Voucher records list and preserves the personal-only scope for a
  submitter viewing their own record.
- Updated new-request reference generators to `IVYY-MM-NN`, `CAYY-MM-NN`,
  `TAYY-MM-NN` and `CL-MM-NN`. Existing records remain unchanged, Payment
  Voucher numbering is unchanged, and Petty Cash numbering is deferred.
- Invoice, Cash Advance and Travel sequences now use the request year/month.
  Claim references use a non-resetting per-month-number sequence because the
  approved display format omits the year, avoiding future duplicate numbers.
- Added `generated/PAYMENT_RECORDS_SORT_AND_NUMBERING_COPY_FILES.md` with the
  complete live-project copy map.
- Verified the Invoice, Travel, Cash Advance, Claims and Petty Cash scopes plus
  the generated Payment Voucher page/detail scope with focused TypeScript
  checks; all six checks pass with no errors.
- Added `generated/COPY_PAYMENT_RECORDS_UPDATE.ps1`, which validates every
  generated source, backs up live files under `.codex-backups`, creates missing
  destination folders and copies the complete update into a supplied Estuary
  project path.
- Added seven `generated/COPY_CODE_*.md` documents grouped by payment type.
  Each document contains the exact destination path and the complete copyable
  code block for every updated TypeScript, TSX and CSS file in that group.
- Confirmed and implemented the Petty Cash reference format as `PC-YY-NN`
  (for example `PC-26-01`). It uses the request year and resets its sequence
  annually; existing Petty Cash references remain unchanged.

# 2026-09-27 — Payment table visual consistency

- Aligned Invoice Payment, Travel Allowance and Cash Advance Payment Records
  list tables with the Payment Voucher table: rounded bordered container,
  light uppercase header, consistent row spacing/dividers, blue references,
  hover feedback, aligned amounts and outlined action buttons.
- Applied the same table treatment to Manager, Director and Finance queues for
  Invoice Payment, Travel Allowance, Cash Advance and Claims using their shared
  workflow CSS modules; workflow behavior and routing are unchanged.
- Added explicit high-contrast foreground/background pairs for every Claims
  status badge, including a dark amber Manager-review label instead of an
  inherited blue foreground.
- Regenerated the Invoice, Cash Advance, Travel Allowance and Claims
  `COPY_CODE_*.md` documents so the full copyable code now includes every role
  queue CSS file. Focused TypeScript checks for all four scopes pass.

# 2026-09-27 — Travel Allowance Google Sheet partial-copy diagnosis

- Inspected the user's live `src/domain/payment-requests/travel-allowance/types.ts` after VS Code reported that `supportingDocumentLinks` was missing from `TravelAllowanceRecord`.
- Confirmed the live type still lacked `supportingDocumentLinks?: string[]` in `CreateTravelAllowanceInput`.
- Confirmed the live create and resubmit API routes also lacked `supportingDocumentLinks` in their Zod schemas.
- The generated copy-ready versions already contain all three changes. Added a common-error section to `generated/TRAVEL_ALLOWANCE_GOOGLE_SHEET_COPY_FILES.md` so partial copying is easier to diagnose.

# 2026-09-27 — Travel Allowance official-template reader correction

- Updated the Google Sheet reader to parse the existing official Travel Allowance template rather than requiring a new flat heading row.
- The reader now finds NAME, POSITION, DATE and CONTACT above the table; detects the actual table headings; ignores the `Eg` example row; reads employee/travel/division/reason/meals/special allowance; and recalculates totals in Estuary.
- Manager reviewer and Project Director are intentionally not read from the sheet. Both remain Estuary form selections after retrieval.
- Removed the earlier `supportingDocumentLinks` addition from the Travel Allowance type, form payload, API validators and review screens because the official template shown by the user has no supporting-document-link field. This also eliminates the reported `TravelAllowanceRecord` type error.
- Reduced the copy map to four files: the Google Sheet reader, Travel Allowance form, its CSS module and the generic Google Sheet API route.
- Verified the generated Travel Allowance set using the live project's TypeScript compiler with zero errors.

# 2026-09-27 — Cash Advance Google Sheet request and reconciliation

- Added a Manual form / Google Sheet link entry choice to the Cash Advance request form.
- Added an official Cash Advance Request Form reader for requester metadata, request breakdown rows and bank account details. Project, Manager and Director remain Estuary selections.
- Added an Appendix A Google Sheet reader to Cash Advance reconciliation. It imports expense date, supplier, description, account type, division, receipt link and amount, ignores the example/totals rows and lets Staff review the imported rows before submission.
- Replaced the Participant Allowance upload UI with a shared Google Sheet link. Existing uploaded participant proofs remain supported for historical records.
- Added optional `division` to reconciliation expenses and optional `participantProofLink` to reconciliation input. Both live in the existing reconciliation JSON snapshot, so no Prisma migration is needed.
- Updated Staff review and the shared Cash Advance detail to show Division and open the Participant Allowance sheet for Finance/other authorized viewers.
- Added copy instructions in `generated/CASH_ADVANCE_GOOGLE_SHEET_COPY_FILES.md`.
- Verified the generated Cash Advance set with the live project's TypeScript compiler; it passed with zero errors.

# 2026-09-27 — Six-type Claims Google Sheet retrieval

- Added a Manual form / Google Sheet link mode to Claims.
- Added a Claim Type dropdown inside Google Sheet mode and a single importer with three layout families: standard supplier/receipt Claims (Internet/Commute, Medical, PD, Tech), Expense Claim with account/division, and Mileage with route/distance.
- The importer reads NAME, POSITION, DATE and CONTACT; ignores `Eg` and totals rows; checks the form title against the selected Claim Type; validates required headings; and places retrieved rows into the existing dynamic Claim form.
- Added `receiptLink` to Claim lines. Submission and draft resubmission now accept either a stored/uploaded receipt or a valid link, with no Prisma migration because the link is retained in the existing Claim snapshot.
- Updated Manager/Director/Finance shared review to open linked receipts, and updated generated Claim PDFs to note linked Google Drive evidence.
- Documented the important limitation that receipt cells must display the raw HTTPS URL because public CSV export cannot recover a hidden hyperlink target behind `{link}`.
- Added `generated/CLAIMS_GOOGLE_SHEET_COPY_FILES.md` and verified the complete generated Claims TypeScript set with zero errors.

# 2026-09-27 — Petty Cash official Google Sheet retrieval

- Added a Manual form / Google Sheet Link tab choice to the Petty Cash request
  form, styled consistently with Travel Allowance.
- Added an official Petty Cash template reader for NAME, POSITION, DATE,
  CONTACT and the expense table fields: date, supplier, details, receipt link,
  account type, division and total.
- The reader ignores the `Eg` example row, validates each populated row,
  previews retrieved expenses and fills the existing manual form for final
  review. Location and Manager approver remain Estuary selections.
- Receipt cells must expose their full HTTP(S) URL because public CSV cannot
  recover a hidden hyperlink behind `{link}`. Official Sheet account/division
  values are preserved; known ledger codes are canonicalized and unmatched
  template labels remain visible as `from Sheet` options for review.
- No type, API payload, repository or Prisma changes were required because the
  existing Petty Cash line already stores all imported fields.
- Added `generated/PETTY_CASH_GOOGLE_SHEET_COPY_FILES.md` and verified the
  generated Petty Cash TypeScript scope with zero errors.

# 2026-09-27 — Finance bulk-processing typography

- Scoped a balanced 14px base type treatment to Finance bulk Payment Voucher
  processing without changing the shared Manager bulk presentation.
- Set voucher references/headings to 19px, Finance section headings to 23px,
  supporting notices to 13px and fields/values to 14px.
- Added a 19px top margin before each selected voucher's Payment Reference
  field and a 9px label/input gap so it no longer crowds the submitter metadata.
- Workflow behavior and validation are unchanged.

# 2026-09-27 — Petty Cash Sheet-tab spacing

- Added an 18px bottom margin to the Petty Cash entry-method tab container so
  the Manual/Google Sheet tabs no longer touch the form card below.

# 2026-09-27 — Payment Records bulk form ZIP downloads

- Added a reusable Payment Voucher-style `Download forms (N)` action to Invoice
  Payment, Travel Allowance, Cash Advance, Claims and Petty Cash records.
- The action follows active records filters and includes only eligible completed
  records visible to the signed-in role.
- Travel Allowance, Cash Advance, Claims and Petty Cash retrieve their existing
  generated PDF endpoints. Cash Advance uses the combined forms pack.
- Invoice Payment has no generated form, so its completed-record ZIP contains
  the uploaded invoice/supporting documents with collision-safe filenames.
- Added a browser ZIP writer with no third-party package, shared responsive
  button/status styling matching Payment Vouchers and a copy map at
  `generated/PAYMENT_RECORDS_BULK_FORM_ZIP_COPY_FILES.md`.
- Focused TypeScript checks for all five payment types pass with zero errors.
- Added `COPY_CODE_PAYMENT_RECORDS_BULK_ZIP.md` at the workspace root with the
  actual live `src/...` destinations and copy-paste code for all eight files.

# 2026-09-28 — Notifications for every payment type

- Extended the existing Payment Voucher/Invoice local notification pattern to
  Travel Allowance, Cash Advance, Claims and Petty Cash.
- Added 22 explicit notification event types plus four fail-safe notification
  builder modules. Notification errors are logged and never roll back a
  successful workflow action.
- Wired notifications into submission/resubmission, Manager approval/return,
  Director approval/forward/return, Finance return/completion and final payment.
- Cash Advance additionally notifies Staff when payment requires
  reconciliation, Finance when reconciliation is submitted, and Staff when
  reconciliation completes or is returned.
- Claims route notifications by requester role: Staff → Manager → Director →
  Finance; Finance → Director → submitting Finance user; Director → Finance.
- Petty Cash emits separate Finance-verified and final Paid notifications.
- Updated the shared notification bell so notifications display recognizable
  payment codes: PV, IV, TA, CA, CL and PC instead of a generic dot.
- Added `generated/ALL_PAYMENT_TYPES_NOTIFICATIONS_COPY_FILES.md` with all live
  `src/...` destinations. Focused TypeScript checks for all four payment modules
  and the shared notification bell pass with zero errors.

# 2026-09-28 — Claims entry-tab spacing and breadcrumb cleanup

- Added an 18px gap below the Claims Manual form / Google Sheet link tabs so
  the tabs no longer touch either entry panel.
- Removed the Payment Request › Claims › New Claim Request breadcrumb from the
  manual Claims form while retaining the page title.

# 2026-09-28 — Cash Advance Google Sheet sizing

- Matched the Cash Advance Manual/Google Sheet tabs to the compact Claims
  sizing, including 11px tab text and an 18px gap below the tab group.
- Normalized the Cash Advance Google Sheet panel description, labels, URL field
  and action buttons to the same moderate Claims scale.

# 2026-09-28 — All-role notification copy guide

- Added `COPY_CODE_ALL_ROLE_NOTIFICATIONS.md` with the exact Manager, Director,
  Finance and Cash Advance reconciliation imports/calls for Travel Allowance,
  Cash Advance, Claims, Petty Cash and the existing Invoice workflow.
- Clarified that notification calls run only after their related API action
  succeeds and that return actions always notify the original requester.

# 2026-09-28 — Bulk ZIP record-components-only copy guide

- Added `COPY_CODE_BULK_ZIP_RECORD_COMPONENTS_ONLY.md` containing complete,
  copy-ready Invoice Payment, Travel Allowance, Claims, Cash Advance and Petty
  Cash records components, excluding the already-delivered shared ZIP files.

# 2026-09-28 — Claims and Petty Cash reference numbers

- Changed new Claim references from `CL-MM-NN` to `CLYY-MM-NN`, for example
  `CL26-09-01`.
- Changed new Petty Cash references from `PC-YY-NN` to `PCYY-MM-NN`, for
  example `PC26-09-01`.
- Both now use separate `DocumentSequence` rows by organization, payment type,
  year and month, consistent with Invoice Payment, Cash Advance and Travel
  Allowance. Monthly and new-year sequences begin at `01`.
- Existing submissions retain their stored references; no Prisma migration is
  required.

# 2026-09-28 — Payment Voucher controlled dropdowns

- Replaced the single Payment Voucher form's legacy Division choices and free
  text Bank Name with the supplied controlled Division and Bank dropdowns.
- Limited Payment Method to Bank Transfer, Cash and Cheque.
- Applied the same three dropdown lists to the bulk Manual Entry panel so both
  creation paths store consistent values.
- No database or Prisma change is required.

# 2026-09-28 — My Requests for Manager, Director and Finance

- Added `My Requests` beside `Payment Records` in the Manager, Director and
  Finance sidebar record sections.
- Reused `/beta/payment-records?scope=mine` so the personal page shows only
  records created by the signed-in user across Payment Voucher, Invoice
  Payment, Travel Allowance, Cash Advance, Claims and Petty Cash.
- Preserved the personal query when opening each payment-type list and added
  personal headings/back links to the five Payment Request record pages.
- Corrected the Petty Cash personal overview fetch to request the full dataset
  before filtering by requester ID; this prevents a Manager's own request from
  disappearing when it is assigned to someone else.
- Added `generated/MY_REQUESTS_ALL_ROLES_COPY_FILES.md`. Focused TypeScript
  checks pass for the sidebar and all affected record modules.
- Added `COPY_CODE_MY_REQUESTS_ALL_ROLES.md` with the exact live `src/...`
  paths and copy-paste code sections requested for manual integration.
- Added `COPY_FULL_CODE_MY_REQUESTS_ALL_ROLES.md`, containing the complete
  current source of all seven affected files under their live `src/...` paths,
  so each file can be replaced directly without merging partial snippets.

# 2026-09-29 — Director and Finance expenditure analytics

- Added a responsive stacked monthly expenditure chart to the Director and
  Finance dashboards, positioned between Payment Portfolio and Latest Records.
- The chart uses all six payment categories separately and includes only paid
  or completed records visible to the signed-in role.
- Added Last 6 Months, This Year and All Time controls, horizontal overflow for
  long ranges, an accessible legend, empty state and period total.
- Used React and CSS only, with no new chart dependency and no database change.
- Added `generated/DIRECTOR_FINANCE_EXPENDITURE_CHART_COPY_FILES.md`.
- `generated/tsconfig.dashboard.json` passes with zero TypeScript errors.

# 2026-09-29 — Performance first phase

- Added a shared Beta route loading skeleton with responsive and reduced-motion
  support so navigation gives immediate visual feedback.
- Reworked Dashboard loading to publish each of its six payment datasets as
  soon as that API finishes instead of waiting for the slowest request.
- Reworked the Payment Records overview to render after the first Payment
  Request API settles and progressively fill the other category counts.
- Removed Payment Voucher loading as a blocker for the combined records page.
- Kept API contracts, workflows and the Prisma schema unchanged.
- Added `generated/PERFORMANCE_FIRST_PHASE_COPY_FILES.md`.
- Focused Dashboard and My Requests TypeScript checks pass with zero errors.

# 2026-09-29 — System-wide dashboard/sidebar payload optimization

- Confirmed the real live-development bottleneck with endpoint timings: the
  Staff Invoice Payment list returned about 6.2 MB in 2.6–2.8 seconds and Cash
  Advance returned about 1.3 MB in 0.7 seconds.
- Found that every page's persistent sidebar repeated all six full list APIs to
  calculate action badges, while the dashboard independently repeated the same
  six calls. Invoice list records each embedded about 1.25 million characters
  of uploaded document data.
- Added `/api/v1/dashboard/records`, backed by a minimal Prisma `select` that
  retrieves only summary and assignment fields and never reads form snapshots,
  evidence bodies or document data URLs.
- Switched both Dashboard and sidebar action counts to the lightweight summary
  API, replacing twelve heavy background requests with two small calls.
- Kept full data retrieval on dedicated record/detail pages because those pages
  still need documents and form contents.
- Updated `generated/PERFORMANCE_FIRST_PHASE_COPY_FILES.md` with all seven new
  or changed performance files. Dashboard and sidebar TypeScript checks pass.
- Added `COPY_FULL_CODE_PERFORMANCE_OPTIMIZATION.md` at the workspace root with
  the complete source of all ten required files under their exact live
  `src/...` paths, so manual integration does not require opening `generated`.

# 2026-09-29 — Payment Voucher submit button typography

- Set the right-side Submitter Action button text explicitly to `13px`, with
  `700` weight and `1.2` line height, so it remains balanced and is not enlarged
  by shared Payment Voucher button styles.
- Updated both the generated source and its complete copy-ready CSS file under
  `updated-files/src/features/payment-voucher/components`.

# 2026-09-29 — Returned remarks moved to payment detail rails

- Left Payment Voucher unchanged and updated Invoice Payment, Travel Allowance,
  Claims, Cash Advance and Petty Cash record detail interfaces.
- Returned/rejected remarks now appear as the first card in the right-hand rail,
  with the payment progress tracker immediately below; left-side request details
  remain unchanged.
- Added a dedicated returned-remarks card to Claim records, including reviewer,
  return date, remarks and a claimant correction link where applicable.
- Kept existing correction actions and workflows intact, and added compact,
  responsive card styling consistent with the Payment Voucher detail pattern.
- All five focused TypeScript configurations pass with zero errors. Complete
  copy-ready files are under `updated-files/src/...`.

# 2026-09-29 — Returned interface consolidated to two cards

- Replaced the three-card returned state with a two-card right rail for Invoice
  Payment, Travel Allowance, Claims, Cash Advance and Petty Cash.
- The first yellow Action Required card now contains the return metadata,
  reviewer remarks, correction guidance and Start Corrections button.
- The payment progress tracker sits directly beneath that combined card; the
  separate correction card was removed from returned record views.
- Payment Voucher remains unchanged. All five focused TypeScript checks pass,
  and the complete copy-ready files in `updated-files/src/...` were refreshed.

# 2026-09-30 — Unified Payment Voucher creation interface

- Constrained the Payment Voucher creation workspace to the same 1240px content
  width so the creation-method toolbar and active form cards align.
- Standardized the UI labels to `Single Payment Voucher` and
  `Multiple Payment Vouchers`, and changed the single-form title to
  `Create Payment Voucher`.
- Restyled Single Payment Voucher creation to follow the Invoice Payment layout:
  page title and Draft badge above one bordered form card with section dividers.
- Aligned the `Load Google Sheet` button with the Google Sheets URL input while
  retaining the stacked mobile layout.
- Replaced the Multiple Payment Voucher manual-entry Payment Breakdown fields
  with a responsive Voucher Lines table and a combined amount-in-words/totals
  summary matching the Single Payment Voucher pattern.
- Payment Voucher bulk, request-page and option-focused TypeScript checks pass.
  Complete copy-ready files were refreshed under `updated-files/src/...`.

# 2026-09-30 — Payment Voucher bank-name correction

- Corrected the Payment Voucher bank option from `Bank Mualamat` to
  `Bank Muamalat` in both Single and Multiple Payment Voucher forms.
- Updated the generated sources and their complete copy-ready files under
  `updated-files/src/...`.

# 2026-09-30 — Shared Payment Voucher dropdown options

- Added the copy-ready shared constants file
  `updated-files/src/shared/constants/payment-options.ts`.
- Centralized Division, Payment Method, Bank Name and Payment Voucher Account
  options so Single and Multiple Payment Voucher forms use the same values.
- Updated only the copy-ready `updated-files/src/...` sources as requested; no
  generated source was changed during this follow-up.

# 2026-09-30 — Payment Voucher SQL account options

- Replaced the three placeholder Payment Voucher account choices with the full
  supplied SQL account-code list in the shared copy-ready constants file.
- Updated Single Payment Voucher lines to render the shared account list and
  default new lines to `600-001`.
- Multiple Payment Vouchers continues to use the shared list and now normalizes
  the former placeholder defaults (`5100`, `5200`, `5300`) to `600-001`.
- No generated source was changed.

# 2026-10-02 — Payment Voucher create-menu entry

- Added Payment Voucher to the shared `Payment Request` submenu in the
  copy-ready counted role sidebar. Director and Finance users can now open the
  Payment Voucher creation page from the same submenu as the other payment
  request types.
- The focused sidebar TypeScript check passes.

# 2026-09-30 — Payment Request amount and account consistency

- Standardized monetary inputs in Invoice Payment, Travel Allowance, Claims,
  Cash Advance and Petty Cash to the Payment Voucher text-plus-decimal-keyboard
  pattern, removing browser number spinners while preserving calculations.
- Added `updated-files/src/shared/utils/payment-amount.ts` and reused the same
  amount parser in Payment Voucher and numeric Payment Request forms.
- Claims, Petty Cash and Cash Advance reconciliation account selectors now use
  the shared 33-item Payment Voucher SQL account list.
- Their Google Sheets parsers accept either the SQL code or the complete shared
  account label and normalize the saved value to the SQL code.
- Added complete copy-ready Invoice Payment and Cash Advance component files
  under `updated-files/src/...`; no generated source was modified.
- Focused TypeScript verification against a temporary mirror of the live source
  completed with zero errors; the verification mirror was removed afterward.

# 2026-09-30 — Shared Travel Allowance employee list

- Added `updated-files/src/shared/constants/employee-options.ts` with the 31
  unique employee names supplied by the user and no employee positions.
- Removed the four temporary Travel Allowance employees and updated its manual
  employee dropdown to show names only.
- Updated Manager Google Sheet matching to use the same shared employee list,
  so manual and Sheet-based Travel Allowance entry stay consistent.
- Removed duplicate entries for `Nuur Hafizah Bt Ramdan` and
  `Sharmanshah bin Shahren`; no generated source was modified.

# 2026-09-30 — Claim and Cash Advance routing-field alignment

- Changed the Claim form's Manager reviewer and Director preview controls from
  separate full-width rows to equal half-width fields on one desktop row.
- Changed the Cash Advance Director approver control to span the same full
  width as Purpose in both manual and Google Sheet completion layouts.
- Existing responsive grids still stack the fields on narrower screens.
- Updated only complete copy-ready files under `updated-files/src/...`; no
  generated source was modified.

# 2026-10-01 — Payment Voucher requester-owned recipient handoff

- Kept the Staff Payment Voucher workflow unchanged.
- Confirmed that Finance completion already assigns the recipient-signature
  stage to the original `submitted_by_id`.
- Replaced the Staff-only membership restriction on recipient-link issuance,
  manual signed-PV upload and signed-PV confirmation with an active organization
  membership check. A Manager or Finance requester can therefore perform the
  same post-Finance handoff on the Payment Voucher they originally submitted.
- Kept the existing `AWAITING_STAFF_CONFIRMATION` state code for database
  compatibility, but changed current interface copy and API payload naming to
  requester-oriented language.
- No runnable dependency manifest is available in this scaffold; verification
  was limited to source consistency checks.

# 2026-10-01 — Claims role-routing revision

- Changed Staff, Manager and Finance claimant submissions to enter Manager
  review first, then Director preview, then Finance processing and Completed.
- Kept Director claimant submissions on the shorter Director claimant →
  Finance processing → Completed route.
- Manager selection is now required and displayed for every non-Director
  claimant in both manual and Google Sheet completion interfaces.
- Standardized non-Director approval-step creation to Manager step 1 and
  Director step 2; Finance claimants still receive their own Finance-processing
  assignment after Director forwarding.
- Returned Claims can now be edited and resubmitted through the same revised
  role route.
- Focused Claims TypeScript verification passed using the live project's local
  TypeScript compiler and `generated/tsconfig.claims.json`.
- Clarified the Finance claimant path: the form labels the assigned reviewer as
  `Finance Manager reviewer`, routes the first action to that selected Manager,
  and rejects self-review. After Manager review and Director preview, the Claim
  returns to the original Finance claimant for Finance processing.

# 2026-10-01 — Cash Advance requester-owned reconciliation

- Kept the existing Cash Advance approval, Director and Finance-payment flow.
- Changed reconciliation submission from a Staff-only action to an
  original-requester action for Staff, Manager, Director or Finance users.
- Replaced the `staffId` reconciliation payload with `requesterId`; repository
  authorization now checks `submitted_by_id` plus active organization
  membership instead of requiring the Staff role.
- Updated record visibility, the Start/Continue Reconciliation action card,
  progress copy, list attention counts, dashboard links and sidebar counts so
  the original requester can find and complete their reconciliation.
- Retained the `RETURNED_TO_STAFF` state code for database compatibility while
  changing current display copy to `Returned to Requester`.
- Focused Cash Advance, dashboard and sidebar TypeScript checks all passed.

# 2026-10-01 — Petty Cash requester-role workflow

- Added four Petty Cash routes: Staff → Manager review → Director preview →
  Finance; Manager → Director preview → Finance; Director → Finance; Finance →
  another Finance user or Director review → Finance.
- Added `requesterRole`, independent reviewer fields and
  `PENDING_FINANCE_REVIEW`. Backend membership checks enforce the claimed role
  and reject Finance self-review.
- Added the Finance peer-review API/action, Director preview wording,
  role-sensitive form fields, notifications, confirmation, progress trackers,
  queues, Payment Records attention state, dashboard and sidebar ownership.
- No Prisma migration is required because routing metadata remains in the
  submission snapshot and the existing string state fields.
- Focused Petty Cash, dashboard and sidebar TypeScript checks pass. Runtime
  database verification remains required in the live project.

# 2026-10-01 — Static correction remarks card

- Removed sticky positioning from the shared `CorrectionEditLayout` remarks
  card. Invoice Payment, Travel Allowance, Claims, Cash Advance and Petty Cash
  correction remarks now remain in normal document flow and scroll away with
  their edit forms.
- Only `updated-files/src/shared/correction-edit-layout.module.css` needs to be
  copied for this adjustment.

# 2026-10-01 — External recipient signature 404 route fix

- Diagnosed the typed recipient-signature error as a missing App Router POST
  endpoint. The client correctly calls
  `/api/v1/recipient/payment-vouchers/[token]/signature`.
- Added copy-ready digital and manual recipient signature routes under their
  exact `generated/src/app/api/v1/recipient/payment-vouchers/[token]/...`
  destinations and updated the recipient copy list.
- The focused recipient/database TypeScript check passes. The live Next.js
  development server must be restarted after copying new route files.

# 2026-10-02 — Finance Payment Voucher sidebar entry

- Added `Payment Voucher` as a standalone item directly above the expandable
  `Payment Request` item in the Finance `Create payments` sidebar group,
  matching the Staff and Manager placement.
- Removed `Payment Voucher` from the shared Payment Request submenu definition
  so it remains a sibling and never appears under Payment Request.
- Updated both the copy-ready `generated/src/app/beta/role-sidebar.tsx` file and
  the older root-level sidebar reference copy.

# 2026-10-02 — Finance Payment Voucher requester access

- Expanded single and bulk Payment Voucher creation/submission access from
  Staff and Manager to Staff, Manager and Finance. Director remains excluded.
- Added server-side membership validation for create, rejected-request
  resubmission and draft submission. The accepted organization roles are
  `STAFF`, `MANAGER` and `FINANCE_ADMIN`.
- Preserved the workflow: Director approval, Finance processing, then assignment
  back to the original requester to issue the external recipient link. A Finance
  requester therefore receives the external-recipient action after processing.
- Updated fallback visibility so Finance requesters retain access to their own
  records before the Finance-processing stage, and Payment Records flags their
  requester-owned draft, correction and recipient-handoff actions.

# 2026-10-02 — Petty Cash monthly fund usage graph

- Added a responsive vertical grouped bar graph to the Director/Finance Petty
  Cash overview. Each location shows Allocation, Spent and Available bars on
  one shared scale.
- Presented it as a standalone analytics card between the three summary cards
  and the ledger list, matching the Finance dashboard hierarchy. Location and
  Month controls live in the graph card; Search remains in the ledger header.
- Each location compares the monthly allocation already spent with its
  available balance and includes text values plus accessible chart labels.
- No chart dependency was added; the graph uses the existing ledger summary
  response and CSS.

# 2026-10-02 — Petty Cash balance carry-forward

- Corrected the monthly float logic so a new monthly allocation no longer
  replaces the existing balance. The stored balance is recalculated from all
  top-up and disbursement entries after ensuring the monthly allocation.
- New floats start at zero because their first RM500 allocation is represented
  by a ledger top-up instead of an untracked starting balance.
- The selected month's opening balance is calculated from all earlier ledger
  entries and displayed as `Balance brought forward` before the new monthly
  allocation. The summary and graph include both amounts under Funds In.
- Focused Petty Cash TypeScript verification passes; existing live database
  records still require runtime verification after copying the repository.

# 2026-10-02 — Obsolete Payment Voucher local data files

- Audited the live Next.js project's `src` imports after the Prisma migration.
- The active client components import `payment-voucher-api.ts`, while all
  Payment Voucher API routes import `prisma-payment-voucher-repository.ts`.
- Nothing imports `dummy-payment-vouchers.ts`,
  `local-payment-voucher-store.ts`, or `payment-voucher-repository.ts`.
  The last file is only an unimplemented placeholder wrapper.
- Those three obsolete files can be removed from the live project. Keep the API
  client and Prisma repository. Do not copy the generated local-store fallback
  for future Prisma-based Payment Voucher changes.

# 2026-10-02 — My Requests requester-action count

- Added a `MY_REQUESTS` sidebar count for Manager, Director and Finance users.
  Staff behavior remains unchanged.
- Counts only records created by the signed-in user that currently require a
  requester action: Draft, rejected/returned correction, Payment Voucher link
  issuance or signed-PV confirmation, and Cash Advance reconciliation.
- Approval, preview and Finance-processing work remains in the existing role
  counts and is not duplicated under My Requests.
- Dashboard summaries now expose whether the latest Payment Voucher recipient
  link has been issued. A link-issued PV stops counting while waiting for the
  recipient; `RETURN_SIGNED_PV` makes it count again until a replacement link
  is issued.
- Focused dashboard and sidebar TypeScript verification passes.

# 2026-10-02 — Payment Voucher amount hints and tax codes

- Updated the single and bulk-manual Payment Voucher line editors so an empty
  unit amount displays `Enter amount` instead of a fixed zero.
- Replaced the plain Tax amount field with a Tax Code dropdown containing
  `No tax`, `SST 6%` and `Manual tax`.
- `SST 6%` calculates the tax from quantity times unit amount and recalculates
  when either value changes. `Manual tax` reveals an empty tax amount input.
- Preserved the existing API contract by continuing to submit the calculated
  numeric `taxAmount`; no Prisma or route change is required.
- Updated the copy-ready root and path-mirrored source files. The focused
  Payment Voucher form TypeScript check passes.

# 2026-10-02 — Invoice Payment amount table and tax codes

- Reworked the Invoice Payment amount section into a four-column table for
  Currency, Invoice Total, Tax Code and Amount Requested.
- Replaced visible zero defaults with instructional hint text for invoice,
  custom requested and manual tax amounts.
- Added No tax, SST 6% and Manual tax choices. Because Invoice Total already
  includes tax, SST 6% extracts the included SST using `total * 6 / 106` and
  recalculates whenever the invoice total changes.
- Manual tax reveals its own amount field; the existing numeric `taxAmount`
  API and Prisma contract remains unchanged.
- The table retains a readable minimum width and scrolls horizontally on small
  screens. Focused Invoice Payment TypeScript verification passes.
- Added a 10px gap between the Tax Code dropdown and the conditional Manual
  tax amount input.
- Corrected the bulk-manual voucher table so the Tax Code control no longer
  overlaps Total: the tax column is wider, its forced minimum width is removed,
  and table cells align from the top.

# 2026-10-02 — Petty Cash and Payment Voucher UI consistency

- Made the Petty Cash Director Previewer field span the complete form width in
  manual and Google Sheet entry modes.
- Restored the missing Petty Cash request-header presentation in the
  path-mirrored CSS: the request information now sits in a bordered card and
  Draft/Correction is rendered as a compact badge.
- Prevented Manager and Finance bulk Payment Voucher back buttons from wrapping
  by disabling flex shrinking and standardizing the text at 13px.
- Converted the Director `Set up signature` link into a full-width white button
  that changes to dark blue on hover or keyboard focus.
- Replaced both plain Signature Settings loading messages with the shared
  Invoice-style `PaymentPageState` presentation.
- Focused Petty Cash and Payment Voucher TypeScript checks pass.

# 2026-10-02 — Travel Allowance-aligned Petty Cash form

- Reorganized Petty Cash entry to match the Travel Allowance form hierarchy:
  page heading and Draft/Correction badge first, entry-mode tabs underneath,
  followed by one continuous form card.
- Added a blue-tinted Petty Cash guidance panel at the top of the form card and
  converted the former separate section cards into internally divided sections.
- Kept the full-width Director Previewer behavior and made the guidance layout
  collapse cleanly on smaller screens.
- Removed the duplicate inner Petty Cash hero from the path-mirrored source.
  Focused Petty Cash TypeScript verification passes.

# 2026-10-02 — Finance Payment Voucher grid and modal sizing

- Refined Finance Payment Voucher Grid view to retain the established PV card
  hierarchy with balanced padding, medium title/amount typography and a clean
  three-column information panel.
- Separated modal density from Grid density. The Finance processing popup is
  narrower and uses medium 13–22px typography, reduced inner spacing and more
  compact action panels while preserving all existing controls.
- Updated both root and path-mirrored Finance Payment Voucher CSS copies.
  Focused Payment Voucher TypeScript verification passes.

# 2026-10-02 — Payment queue pagination and Claims view controls

- Added the existing shared `ListPagination` component to Manager and Finance
  Payment Voucher queues and switched their Grid/List results to the current
  page. The Director approvals page now uses the existing paginated Payment
  Voucher record-list wrapper.
- Compact Travel Allowance workflow filter tabs now match the 36px controls
  used by the Invoice Payment queues, including smaller count badges.
- Added Grid/List controls and responsive Claim cards to the Manager, Director
  and Finance Claim queues. The general Claims records screen already provided
  both views, so all roles now have access to the feature.
- Payment Voucher, Travel Allowance and Claims focused TypeScript checks pass.

# 2026-10-03 — Continuous Finance Payment Voucher processing

- Removed the manual queue-navigation step after Finance starts an individual
  Payment Voucher. A successful start now selects `In processing` and opens or
  retains that voucher's processing detail immediately.
- Renamed the Finance queue tabs to clearer stage language: `Finance action`,
  `In processing` and `Signature in progress`.
- A completely successful bulk batch now returns to the Finance `In processing`
  queue, displays a batch confirmation and opens the first processed voucher.
- Partial bulk failures remain on the bulk screen, selected for retry, while
  successful records are not processed again.
- Focused Payment Voucher TypeScript verification passes.

## Follow-up — Finance panel callback copy dependency

- The Finance page requires the updated `generated/finance-payment-panel.tsx`
  because it introduces the optional `onProcessingStarted` callback.
- Added that panel to the bulk-workflow copy map and mapped it into the focused
  TypeScript configuration. This prevents the generated page from silently
  checking against an older panel in the separate live project.

# 2026-10-03 — Spacious Finance processing workspace

- Reworked the `FINANCE_PROCESSING` Payment Voucher detail into one wide,
  two-column workspace while preserving Estuary's existing colour system.
- The left reference column groups Pay To and Voucher Details. The larger right
  column contains payment date/reference, a full-width proof area, current-file
  summary, remarks, lock notice and the existing save/generate actions.
- Removed the duplicate summary grid only during Finance processing; all other
  Payment Voucher states retain their existing summary and action layouts.
- The workspace stacks into one column below 800px. The focused bulk/Finance
  TypeScript check passes and the stylesheet has balanced braces.
- Removed the duplicate “Choose a payment proof file” instruction above the
  browser file input. The native file-selection button now carries the action
  and uses the Estuary white-to-navy hover treatment.
- Replaced Finance Grid's inline full workflow panels with compact Petty
  Cash-style summary cards in a responsive two-column layout. Each card shows
  reference, status, recipient, purpose, submitter, amount, division and payment
  reference, with a single `View details` button.
- `FinancePaymentPanel` now renders only inside the existing modal for Grid and
  List selections, regardless of whether the voucher is processing, awaiting a
  signature, completed or inactive. Focused TypeScript verification passes and
  the Finance stylesheet has balanced braces.
- Kept `Bulk process Payment Vouchers` conditional: it appears only when at
  least one Director-approved voucher is ready and stays hidden at zero.

# 2026-10-03 — Organization-wide leadership expenditure analytics

- Added a separate `ORGANIZATION_COMPLETED` dashboard view for Director and
  Finance roles. It returns only paid/completed records across the organization.
- The dashboard now uses this shared dataset only for the monthly expenditure
  graph and period total, so every Director and Finance user sees identical
  financial results.
- Role-scoped records continue powering portfolio counts, assigned actions and
  recent activity; workflow access was not broadened.
- Updated the expenditure-chart copy map with the API, repository and route
  dependencies. The focused dashboard TypeScript check passes.

# 2026-10-03 — External recipient PV detail consistency

- Restyled the external recipient Payment Voucher details to match the internal
  PV detail hierarchy while retaining only recipient-appropriate information.
- Consolidated Payment Details, Recipient Details and Payment Breakdown into one
  clean bordered details card with section separators, consistent label/value
  typography and the standard itemized table treatment.
- Removed receipt-style shadows, grey section emphasis and nested recipient
  boxes. The confirmation/signature interface remains a separate action card.
- Updated the visible section titles for consistency and retained responsive
  two-column-to-single-column behavior. Recipient TypeScript verification passes
  and the stylesheet has balanced braces.
- Fixed two post-redesign CSS collisions: reset legacy grid-row assignments so
  details and signature columns start together, and merged all typed-signature
  input/preview styles into the full recipient stylesheet. All 25 signature CSS
  classes are present and the stylesheet remains balanced.

# 2026-10-04 — Staff requester badge and PV bulk table UX

- Enabled the Staff `My Requests` badge and connected it to the existing
  requester-owned action rules. It now aggregates actionable records across
  Payment Vouchers, Invoice Payments, Travel Allowances, Cash Advances, Petty
  Cash and Claims rather than disabling all Staff sidebar counts.
- Replaced the tall Manager, Director and Finance bulk Payment Voucher cards
  with compact selectable tables, including row checkboxes, Select all, review
  state, amount and `View details` actions. The existing review modal remains
  the only full-detail surface and is still required before batch submission.
- Matched the Manager preview confirmation hierarchy to the Director approval
  panel. Reworked Finance batch entry into a white Estuary-style form with
  shared payment details, one reference row per voucher, a follow-up notice and
  a final confirmation footer.
- Updated both copy maps. Focused sidebar and Payment Voucher bulk TypeScript
  checks pass with zero errors.
- Added panel-scoped fallback table rules after the first live copy rendered
  raw browser table spacing. The established `.panel` and `.approvalPanel`
  classes now enforce column padding, minimum widths, borders and wrapping even
  when the newer table class mapping is stale; both stylesheets remain balanced.
- Replaced the plain Manager, Director and Finance bulk-route loading strings
  with the shared `PaymentPageState` presentation used by the other payment
  interfaces. Added the previously missing Director bulk route to the generated
  copy set and focused TypeScript configuration; the check passes.

# 2026-10-05 — Payment Voucher required marker

- Added a red required-field marker beside the PV date label. The marker is
  nested inside the label text so the form grid cannot place it on a separate
  row, and its dedicated CSS class resets the default italic `em` styling.
- Added the same reusable `required` prop to the bulk manual-entry `InputField`.
  The bulk PV date now displays the red marker and passes the requirement to
  the native date input without duplicating label markup.

# 2026-10-05 — Shared Payment Voucher account options

- Removed the bulk form's local 5100/5200/5300 account list and sourced the
  account dropdown from `PAYMENT_VOUCHER_ACCOUNT_OPTIONS` in the shared payment
  constants. Existing legacy rows are normalized to the shared default account
  so old draft values do not leave the select without a matching option.
- Removed the remaining local Division, Bank Name and Payment Method lists from
  the same bulk form. They now reuse `DIVISION_SELECT_OPTIONS`,
  `BANK_NAME_SELECT_OPTIONS` and `PAYMENT_METHOD_SELECT_OPTIONS` from the shared
  payment constants as the single source of truth.
- Extended the reusable bulk field controls with required markers. Required
  fields from PV date through Purpose now show the red asterisk; bank details
  show it when Bank Transfer is selected. Bank account number spans the full
  two-column form width, while Project Manager and documents remain optional.

# 2026-10-05 — Payment progress descriptions

- Replaced terse actor names and generic `Completed` captions in Invoice
  Payment, Claims, Travel Allowance and Petty Cash progress timelines with
  concise action descriptions. Steps now explain submission, review/approval,
  Director preview, Finance processing and closure while retaining available
  actor names, dates and payment references.
- Focused TypeScript checks for all four payment workflows pass with zero
  errors.

# 2026-10-05 — Claims Google Sheet wrapped-heading fix

- Fixed Claim Google Sheet retrieval incorrectly treating the wrapped
  `Link to e-invoice/receipts (All documents to be uploaded in Project GDrive)`
  template heading as a claim date. Imported rows must now contain a real date
  and claim content, while wrapped or displaced column headings are ignored.
- The Google Sheet and receipt URL safety rules are unchanged: the worksheet
  must be shareable for CSV retrieval, and populated receipt cells must contain
  a full HTTPS link. Focused Claims TypeScript validation passes with zero
  errors using the repository TypeScript compiler.
- Follow-up testing exposed a second merged-cell path in the optional
  form-level `DATE:` metadata: when its value is blank, Google CSV can place the
  Project GDrive receipt heading where the metadata reader expects the date.
  Optional metadata dates now fail safely to blank so the user can complete the
  request date in Estuary; actual expense-row dates remain strictly validated.
  The generated source and current live-project copy were both updated, and the
  focused Claims TypeScript check still passes.
- Fixed the subsequent Google Sheet submission failure in the live project:
  its Claims route schema was missing `receiptLink`, so Zod stripped the
  already-validated URL before repository validation. Restored the optional URL
  field to the live route schema. Also hardened metadata extraction so table
  headings such as `#` and `Division` cannot become the claimant or Contact
  value when merged metadata cells are blank. The focused Claims check passes;
  the live full-project check reaches only an unrelated pre-existing missing
  `use-director-signature` hook error.
- Updated the Claims PDF renderer so the e-invoice/receipt column prints the
  saved Google Drive URL for Sheet-imported claims. Manual claims continue to
  show their uploaded receipt filename, and missing evidence still renders as
  a dash. The generated copy and live-project builder were both updated; the
  focused Claims TypeScript check passes.

# 2026-10-05 — Claims non-blocking previews and PV badge spacing

- Changed new Claim submissions to route directly to Finance in
  `PENDING_FINANCE_PROCESSING`. Manager and Director approval-step assignments
  remain as independent informational previews and no longer control the main
  Claim state or Finance assignee.
- Manager/Director preview actions now record their own transition and
  completion timestamp without advancing or rejecting the Claim. The queues,
  confirmation screen, detail tracker, notifications, dashboard attention
  state and sidebar counts use those timestamps, with an `Informational` state
  matching the Payment Voucher preview pattern.
- Finance can process or return both the new direct state and Claims stranded
  in the two legacy review states. Recording either legacy preview normalizes
  the main state to Finance processing; no schema migration is required.
- Increased the Manager Payment Voucher preview table's minimum width, enabled
  horizontal overflow and added explicit Status/Preview cell spacing so the
  status and `Required` badges no longer touch.
- Focused Claims, dashboard, sidebar and Manager UI TypeScript checks pass with
  zero errors. All three changed CSS modules have balanced braces.

## 2026-10-08 — Claims download button sizing and hover

- Updated the live Claims records stylesheet at `C:\Users\hp\OneDrive\Documents\Estuary-main\src\features\payment-records\components\claims\claim-records.module.css`.
- Scoped the styling to `.resultActions > button` so only the Download forms action is changed; nested Grid/List controls remain untouched.
- Standardized the button to a compact 40px minimum height, 14px horizontal padding, 0.9rem text, no shadow, white/navy default styling, and dark-navy/white hover styling.

## 2026-10-08 — Claims grid aligned with Invoice Payments

- Updated `C:\Users\hp\OneDrive\Documents\Estuary-main\src\features\payment-records\components\claims\claim-records.module.css`.
- Tightened Claims card spacing and typography, changed the four summary tiles into one two-column information panel, and standardized the View record action to the Invoice Payments proportions.
- Restyled the shared Download forms control on the Claims page to use a compact 40px height and 0.875rem font, with a white/navy default state, dark-navy/white hover state, no shadow, and an accessible focus outline.
- Added a single-column responsive summary layout below 680px.

## 2026-10-08 — Corrected Claims records layout

- Removed the earlier broad Claims card override after it produced an oversized layout.
- Reworked the Claims records stylesheet to mirror Invoice Payments more closely: four overview stats across on desktop, an Invoice-style bordered filter panel and control sizing, two compact record cards per row, and one shared two-column detail panel within each record card.
- Preserved the compact white/navy Download forms button with dark-navy hover behavior.
- Added responsive transitions: two stat columns and three filter columns below 1180px, then single-column stats, filters, cards, and detail panels below 760px.

## 2026-10-08 — Manager/Director bulk preview for Petty Cash and Claims

- Added a shared PV-aligned bulk-preview workspace at `C:\Users\hp\OneDrive\Documents\Estuary-main\src\features\payment-request\components\bulk\request-bulk-preview.tsx` with supporting modal/table styles.
- Added four routes: Manager and Director bulk preview pages for both Petty Cash and Claims.
- Added Bulk preview buttons to all four existing queue headers.
- Reused the existing single-record Manager/Director mutations and notification helpers so bulk preview remains informational and preserves current workflow behavior.
- The workspace includes record selection, select-all, explicit detail review, reviewed-state gating, batch totals, confirmation, partial-failure handling, and PV-style summary/table/confirmation layouts.
- Verification passed: `corepack pnpm typecheck` and targeted ESLint for the new component, routes, and modified queues, with no warnings.
- The live source directory is not a Git repository, so Git diff/status checks are unavailable there.

## 2026-10-08 — Bulk-preview button placement and faster loading

- Moved Manager/Director Petty Cash and Claims Bulk preview links from beside the signed-in card into the left header content block below the description, matching the existing Payment Voucher pattern.
- Bulk links now appear only when pending preview records exist and use the same 44px navy action styling as PV.
- Added two-minute role/query-scoped in-memory list caches to the Petty Cash and Claims API clients. A bulk page opened from an already-loaded queue reuses the resolved list immediately instead of making a duplicate request.
- Successful Petty Cash actions and relevant Claims preview mutations invalidate their caches so completed previews do not remain stale when navigating back.
- Verification passed: `corepack pnpm typecheck` and targeted ESLint, with no warnings.

## 2026-10-08 — Bulk approval for Travel, Invoice, and Cash Advance

- Added a shared PV-aligned `RequestBulkApproval` workspace for Manager and Director Travel Allowance, Invoice Payment, and Cash Advance workflows.
- Added six routes under the existing Manager/Director queue paths and placed conditional `Bulk review and approve` links below each queue description using the Payment Voucher header pattern.
- Every selected record must be opened and explicitly marked reviewed before batch confirmation is enabled.
- Successful records use the existing single-record approval mutation and notification helper, advancing to the next workflow stage. Partial failures remain selected for retry while successful records are removed.
- Cash Advance bulk approval requires the signed-in user's saved signature and uses its signature ID for every approved record; Travel and Invoice do not query the signature API.
- Added role/query-scoped two-minute list caches to all three API clients for instant queue-to-bulk reuse, with invalidation after mutations.
- Verification passed: full `corepack pnpm typecheck` and targeted ESLint across the shared component, six routes, six queues, and three API clients, with no warnings.

## 2026-10-08 — Full-detail bulk approval modal

- Expanded the shared Travel Allowance, Invoice Payment, and Cash Advance bulk approval modal in the live project so `View details` shows the complete approval data rather than only a brief summary.
- Invoice details now include vendor, transfer, payment-portion, amount, e-invoice, purpose, remarks, and supporting-document information. Travel details include every travel line, dates, employee, project, reasons, allowances, totals, remarks, documents, and external sheet links. Cash Advance details include purpose, bank information, advance lines, signature progress, remarks, and documents.
- Kept the overlay at a moderate responsive width with an independently scrollable body, structured detail sections, mobile single-column layout, and a fixed confirmation footer.
- Opening a record does not advance it. The reviewer must use `Mark reviewed and close`; only after every selected record is reviewed and the final confirmation is checked does the existing batch approval advance records to their next workflow stage.
- Verification passed: full `corepack pnpm typecheck`, targeted component ESLint, and full-project `corepack pnpm lint`, all with zero errors or warnings.

## 2026-10-08 — Receipt-style approval review overlay

- Restyled the shared Travel Allowance, Invoice Payment, and Cash Advance bulk approval review overlay to match the Payment Voucher receipt/document presentation.
- Removed the repeated card treatment and duplicate top summary. The modal now uses one continuous white document, flat section dividers, aligned three-column label/value details, one bordered item table, and compact document rows.
- Updated the header to show the request type and reference number while retaining the moderate responsive modal dimensions, scrolling body, and mobile two-/one-column transitions.
- Preserved the approval safeguards: viewing alone does not advance a record; `Mark reviewed and close` records review completion, and the final confirmed batch action advances it to the next workflow stage.
- Verification passed: `corepack pnpm typecheck`, targeted component ESLint, and full-project `corepack pnpm lint`, with zero errors or warnings.

## 2026-10-08 — Organized receipt card and faster role-specific bulk loading

- Adjusted the shared approval overlay again to match the requested Payment Voucher presentation: the scroll area now has a light canvas with one padded, bordered receipt card inside it, roomier three-column detail spacing, section dividers, and responsive padding.
- Added explicit `ManagerRequestBulkApproval` and `DirectorRequestBulkApproval` route components and updated all six Travel Allowance, Invoice Payment, and Cash Advance bulk pages to use the appropriate role entry point.
- Added an `approvalOnly` list scope through the three client APIs, API routes, and Prisma repositories. Direct bulk-page visits now query only records assigned to that reviewer at the exact pending Manager/Director stage instead of loading and mapping the broader history first.
- Preserved fast queue-to-bulk navigation by seeding each pending-only two-minute cache from the already-loaded role queue; opening bulk approval from a queue normally requires no duplicate list request.
- Changed the Travel Allowance, Invoice Payment Director, and Cash Advance bulk action styles from inline-flex to block-level flex with fit-content width, ensuring the action sits below the header description.
- Verification passed: full `corepack pnpm typecheck` and full-project `corepack pnpm lint`, with zero errors or warnings.

## 2026-10-10 — Clean Finance confirmation and faster bulk navigation

- Reworked the shared Finance bulk-processing confirmation for Invoice Payment, Travel Allowance, Claims, Cash Advance, and Petty Cash into the compact Finance Confirmation layout: a single bordered panel, batch total, shared payment fields, progress summary, filter pills, a contained record table, and a clear confirmation footer.
- Kept request-specific behavior isolated: Invoice Payment uses review-only processing; Travel Allowance and Claims require per-record payment references; Petty Cash retains proof upload and payment completion; Cash Advance retains its reconciliation handoff rather than being marked complete.
- Added All, To review, and Missing reference views plus review/reference progress bars so Finance can find incomplete rows without changing the selected batch.
- Added route preloading to each Finance `Bulk process` entry point on initial render and user intent, reducing the wait before the bulk page appears while preserving the existing bounded processing batches.
- Scoped all new styles to the Finance bulk-processing module, including responsive field, table, and footer layouts, so the five source queue pages retain their own interfaces.
- Verification passed: targeted ESLint, full-project `corepack pnpm lint`, `corepack pnpm typecheck`, and all 15 Vitest tests, with zero errors or warnings.

## 2026-10-08 — Bulk document alignment and non-scrolling PV table

- Corrected supporting-document rows in the shared request bulk-approval modal. Each row now has a fixed icon, a flexible filename/metadata column, and a compact Download/Open action with smaller typography and ellipsis handling.
- Removed the purpose subtitle beneath the Payment Voucher number in Manager preview, Director approval, and Finance bulk-processing tables.
- Added PV-specific fit-to-width table classes rather than changing the generic bulk table used by other request types. The nine PV columns now use fixed proportional widths, smaller cell/header spacing and type, and a compact full-cell View details button.
- Disabled horizontal overflow for the scoped PV table wrappers while preserving full table width; long values truncate inside their assigned columns instead of expanding the table.
- Verification passed: full `corepack pnpm typecheck` and full-project `corepack pnpm lint`, with zero errors or warnings.

## 2026-10-08 — Compact Director PV review typography

- Reduced the Director bulk Payment Voucher record counter from 14px to 12px.
- Scaled the Payment Voucher review overlay typography to a more compact hierarchy: 24px modal title, 16px section headings, 11px labels, 13px values/summary text, 10px table headings, and 12px table cells.
- Tightened modal body gaps, section padding, purpose-summary spacing, breakdown-cell padding, and footer controls while preserving the existing three-column information layout and review workflow.
- Verification passed: full `corepack pnpm typecheck` and full-project `corepack pnpm lint`, with zero errors or warnings.

## 2026-10-08 — Claims bulk preview receipt layout

- Rebuilt the shared Claims/Petty Cash bulk preview modal body using the same receipt-card structure as Invoice Payment instead of the broken unstyled overview list.
- The modal header now presents the request type and right-aligned reference, followed by a bordered inner document with a six-field request overview, optional notes, and a dedicated expense-breakdown section.
- Restored clear alignment for requester, position, date, type/location, entry count, and total. The shared treatment also keeps Petty Cash previews consistent.
- Reduced modal title to 22px, list values to 13px through the existing detail grid, expense rows to 12px, table headings to 10px, and cell padding to 12px.
- Verification passed: full `corepack pnpm typecheck` and full-project `corepack pnpm lint`, with zero errors or warnings.

## 2026-10-08 — Full Claims/Petty Cash preview evidence

- Moved the shared bulk-preview `Mark reviewed and close` action to the right side of the modal footer.
- Expanded the Claims expense table to include row number, supplier/route, account category, division, receipt action, and the policy-derived line amount (including correct Mileage calculations).
- Expanded the Petty Cash expense table with account category, division, proof action, and amount.
- Added a dedicated `Receipts and supporting documents` section whenever evidence exists. Uploaded Claim receipts use the authorized document-preview endpoint with the current reviewer ID; external Claim receipt links and Petty Cash proof links open in a new tab.
- Reused the compact aligned document-row presentation with filename/type/size metadata for uploads and clear Open actions for external evidence.
- Verification passed: full `corepack pnpm typecheck` and full-project `corepack pnpm lint`, with zero errors or warnings.

## 2026-10-08 — Claim Type filter in bulk preview

- Added a Claims-only Claim Type dropdown to the shared bulk-preview toolbar with All, Expense, Internet/commute, Medical, Mileage, PD, and Tech choices sourced from the canonical `CLAIM_TYPES` list.
- The table and visible count update immediately for the selected type and show `matching of total` record counts; Petty Cash remains unchanged.
- `Select all` now operates on the currently visible filtered Claims while preserving selections made under other filters, and is disabled when the active filter has no matches.
- Added an explicit empty state when pending Claims exist but none match the chosen type, plus compact responsive filter styling.
- Verification passed: full `corepack pnpm typecheck` and full-project `corepack pnpm lint`, with zero errors or warnings.

## 2026-10-10 — Finance label and Claims toolbar alignment

- Kept the Finance `Payment date *` and `Finance remarks (optional)` annotations inline with their labels instead of allowing the annotation to occupy a separate grid row.
- Grouped the Claims type filter and visible record count at the right side of the bulk-selection toolbar with a deliberate 24px gap and a responsive full-width treatment on smaller screens.
- Verification passed: targeted ESLint and `corepack pnpm typecheck`, with zero errors or warnings.

## 2026-10-10 — Finance amount-column alignment

- Right-aligned the Finance confirmation table's Amount heading to the same grid edge as every currency value and explicitly stretched the amount cell within its assigned column.
- Verification passed: targeted ESLint with zero errors or warnings.

## 2026-10-10 — Consistent Manager/Director bulk review and confirmation

- Updated the shared Travel Allowance, Invoice Payment, and Cash Advance approval-review modal plus the Claims/Petty Cash preview modal with the Payment Voucher footer pattern: Previous and Next on the left, Close and Mark as reviewed on the right.
- Navigation follows the selected batch when the opened record is selected, otherwise it browses the current eligible/visible queue. Marking a record reviewed keeps the modal open so reviewers can continue to the next item; Close is now an independent action.
- Rebuilt Manager/Director request approval and preview confirmations as compact cards with a small heading, selected total, reviewed progress count, confirmation checkbox, and right-aligned action.
- Applied the same compact confirmation structure to Manager Payment Voucher previews and Director Payment Voucher approvals, while retaining signature enforcement, notifications, workflow transitions, and individual-rejection requirements.
- Added responsive stacking for the compact confirmation cards and two-button modal footer groups.
- Verification passed: targeted ESLint, full-project `corepack pnpm lint`, `corepack pnpm typecheck`, and all 15 Vitest tests.

## 2026-10-10 — Navy bulk actions and compact detail buttons

- Changed non-Finance bulk approval/preview confirmation actions from green to the established dark navy, with a darker navy hover state while retaining the existing disabled treatment.
- Reduced Payment Voucher bulk-table `View details` controls from full-column width to a compact 110px maximum, preserving right alignment and responsive containment.
- Verification passed: targeted ESLint with zero errors or warnings.

## 2026-10-10 — Payment Voucher Finance wireframes and review navigation

- Tightened the shared Finance request confirmation table so the Record and Amount columns are proportioned more closely while retaining a larger payment-reference field.
- Rebuilt Payment Voucher Finance confirmation for the supplied one-voucher and multi-voucher wireframes: compact header/total, shared date and remarks, structured voucher/reference/review table, multi-voucher All/To review/Missing reference filters, reviewed/reference progress bars, scrollable rows, and numbered after-processing steps.
- Review badges in the confirmation table now open the existing full Payment Voucher review overlay; that overlay already provides Previous, Next, Close, and Mark as reviewed controls.
- Added the same Previous, Next, Close, and Mark as reviewed footer to all Finance request review overlays. Navigation stays within the selected batch when appropriate and marking reviewed no longer closes the overlay.
- Preserved existing payment-date, unique-reference, review, confirmation, processing, and redirect requirements.
- Verification passed: targeted ESLint, full-project `corepack pnpm lint`, `corepack pnpm typecheck`, and all 15 Vitest tests.

## 2026-10-10 — PV master Google Sheet entry point

- Added an Official template callout to the bulk Payment Voucher Google Sheets flow. Its `Open PV template sheet` link opens the configured master Google Sheet in a new tab rather than downloading a spreadsheet.
- Separated the master-template action from the import action: users open the master, make and complete their own copy, share that copy for link viewing, then paste only the completed-copy URL into Estuary.
- Added `NEXT_PUBLIC_PAYMENT_VOUCHER_TEMPLATE_SHEET_URL` as the documented public configuration value. When it is absent, the interface shows a clear `PV template link not configured` state rather than opening an invalid destination.
- Added compact responsive callout styling and updated the page instructions to distinguish the master sheet from the completed import sheet.
- Verification passed: targeted ESLint and `corepack pnpm typecheck`, with zero errors or warnings.

## 2026-10-11 — Grouped expenditure category bars

- Changed the Director/Finance monthly completed-expenditure chart from one stacked total bar per month to six side-by-side bars: Payment Vouchers, Invoice Payments, Travel Allowances, Cash Advances, Petty Cash, and Claims.
- Rescaled the chart against the highest individual category value instead of the highest monthly total, making category-to-category differences easier to compare.
- Preserved the monthly total above each group, the existing legend colors, range filters, hover values, period total, empty state, and horizontal responsive scrolling.
- Increased each month group's minimum width to keep all six category bars legible.
- Verification passed: targeted ESLint and `corepack pnpm typecheck`, with zero errors or warnings.

## 2026-10-11 — Hybrid expenditure summary and stacked chart

- Superseded the grouped-bar experiment with the agreed hybrid analytics layout: six category summary cards above one stacked expenditure bar per month.
- Each card shows the selected period's completed total, code, label, and established color for Payment Vouchers, Invoice Payments, Travel Allowances, Cash Advances, Petty Cash, and Claims.
- Added a rounded five-tick RM axis to the monthly chart while retaining the total above each month, colored stacked composition, hover breakdowns, date-range controls, overall period total, empty state, and horizontal scrolling.
- Category cards respond from six columns on desktop to three on tablet and two on mobile.
- Verification passed: targeted ESLint and `corepack pnpm typecheck`, with zero errors or warnings.

## 2026-10-11 — Staff bulk recipient-signature follow-up

- Added a Staff-only `Bulk recipient signature follow-up` action beneath the Payment Voucher records description whenever the signed-in requester has vouchers in `AWAITING_RECIPIENT_SIGNATURE`.
- Added a dedicated bulk workspace that limits records to the original Staff submitter, supports selection and full-detail modal review, verifies recipient names and email addresses, and prepares unique secure recipient links without signing or advancing vouchers on a recipient's behalf.
- Prepared links are processed in bounded concurrent groups of four for smoother API performance. The resulting personalized email drafts remain explicit one-click actions because the current beta uses the user's email application rather than an automatic mail service.
- Added route prefetching plus a short-lived shared Payment Voucher cache so the bulk page can open from already loaded records instead of immediately repeating the same request.
- Verification passed: full-project `corepack pnpm lint`, `corepack pnpm typecheck`, and all 15 Vitest tests.

## 2026-10-11 — Faster bulk Payment Voucher creation and submission

- Changed Manual Entry and Google Sheets bulk draft creation from one-request-at-a-time processing to bounded groups of four, retaining database confirmation before presenting success.
- Changed bulk draft submission to the same bounded concurrency model with live `completed of total` button progress. Successful vouchers remain submitted, while only failed vouchers remain selected for a safe retry.
- Added partial-creation recovery: successful drafts are retained and failed source rows can be retried without recreating the successful vouchers.
- Added a five-second timeout per Google export attempt and a 30-second in-process CSV cache keyed by the worksheet URL, making repeated loads of the same sheet faster while keeping the cache brief.
- Verification passed: full-project `corepack pnpm lint`, `corepack pnpm typecheck`, and all 15 Vitest tests.

## 2026-10-11 — Invoice Payment requester roles

- Removed the Staff-only validation from Invoice Payment creation. Any signed-in Staff, Manager, Director or Finance account can now create an Invoice Payment request and is stored as its original requester.
- Reworded the form and review interface from `Staff name/requester` to the role-neutral `Requester name/Requester`.
- Updated returned-request correction access so the original requester can edit their Invoice Payment regardless of role, while preserving the original-requester identity check.
- Updated the repository error wording to match the role-neutral ownership rule; the existing Manager → Director → Finance workflow remains unchanged.
- Verification passed: full-project `corepack pnpm lint`, `corepack pnpm typecheck`, and all 15 Vitest tests.

## 2026-10-11 — Finance bulk-action placement and Invoice badge

- Moved bulk-action links onto their own line beneath the workspace description across Invoice Payment, Travel Allowance, Cash Advance, Petty Cash, and Claims queues, while preserving compact button width and responsive containment.
- Corrected the Finance sidebar badge for `PENDING_FINANCE_REVIEW`: this is a shared Finance-role queue and is intentionally not assigned to one individual Finance account, so its pending Invoice Payment count is now visible to every Finance user.
- Kept Manager and Director sidebar counts assignment-specific; request creation ownership remains independent from the current approval or processing stage.
- Verification passed: full-project `corepack pnpm lint`, `corepack pnpm typecheck`, and all 15 Vitest tests.

## 2026-10-12 — Invoice Payment record-table spacing

- Reserved dedicated widths for the Invoice Payment list's Status and Action columns so long badges such as `Pending Finance Verification` cannot overlap the `View record` button.
- Increased the spacing between those two columns while retaining the table's horizontal-scroll fallback for narrower screens.
- Full-project ESLint and the Vitest suite passed. The TypeScript source check was blocked by malformed, actively regenerated `.estuary-next/dev/types` output from the running Next.js development server; the failure was confined to generated route files and was unrelated to the CSS-only change.

## 2026-10-12 — Travel Allowance approval Grid/List views

- Added accessible Grid/List view toggles to the Manager, Director, and Finance Travel Allowance pending queues while retaining List as the default.
- Added one shared Travel Allowance card presentation for all three roles, following the Invoice Payment card layout: reference and status header, employee title, entry count, two-column request details, and a role-appropriate action button.
- Preserved each queue's existing filters, search/month controls, pagination, status rules, and role-specific destinations.
- Added responsive behavior that changes the two-column grid to one column and stacks card metadata on smaller screens.
- Verification passed: full-project ESLint, a source-only TypeScript check excluding malformed live-dev generated route files, and all 15 Vitest tests.

## 2026-10-12 — Official Google Sheet templates for TA, CA, and Claims

- Added a shared responsive `Official template` panel matching the Payment Voucher design to the Travel Allowance, Cash Advance, and Claim Google Sheet entry flows.
- Travel Allowance and Cash Advance each expose one configured master-sheet link; missing links show a clear unavailable state instead of opening an invalid destination.
- Claims use one compact Claim-template selector for Expense, Internet/Commute, Medical, Mileage, PD, and Tech. The selected type controls both the master-sheet link and the existing sheet validation, avoiding six competing buttons and template/type mismatches.
- Added documented environment keys: `NEXT_PUBLIC_TRAVEL_ALLOWANCE_TEMPLATE_SHEET_URL`, `NEXT_PUBLIC_CASH_ADVANCE_TEMPLATE_SHEET_URL`, and one `NEXT_PUBLIC_*_CLAIM_TEMPLATE_SHEET_URL` key per Claim type.
- Verification passed: full-project ESLint, a source-only TypeScript check excluding malformed live-dev generated route files, and all 15 Vitest tests.

## 2026-10-14 — Payment Request template-button sizing

- Reduced the shared Official Template action used by Travel Allowance, Cash Advance, and Claims to match the Payment Voucher template button: 42px minimum height, 16px horizontal padding, 8px corners, and a 12px semibold label.
- Preserved the existing full-width mobile behavior and the unavailable-link state.
- Verification passed: full-project ESLint.

## 2026-10-14 — Cash Advance requester roles

- Removed the Staff-only restriction from Cash Advance creation and resubmission. Any signed-in active organization member using a Staff, Manager, Director, or Finance account can now create a request and sign it with their own active saved signature.
- The database now validates the requester as an active organization member while continuing to validate the selected Manager and Director against their required approval roles.
- Updated the creation, review, record, queue, return-action, reconciliation, and PDF-facing wording from `Staff` to the role-neutral `Requester` where the value represents the original submitter.
- Updated the personal Cash Advance queue to load and retain requests owned by the signed-in user regardless of their role.
- The Manager → Director → Finance → requester reconciliation workflow remains unchanged.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 18 Vitest tests.

## 2026-10-14 — Director Cash Advance routing and unrestricted amounts

- Director-created Cash Advances now hide the Manager approver field and require selection of a different Director; the signed-in Director is excluded from the available approving-Director options.
- The server derives the requester role from the active database membership instead of trusting browser input. Director requests are created directly in `PENDING_DIRECTOR_APPROVAL` with one active Director approval step and no Manager step; other requester roles retain Manager → Director approval.
- Applied the same conditional routing to returned-request resubmission, notifications, confirmation, record progress tracking, and PDF form descriptions.
- Removed the former RM300 minimum from domain validation, the form header, and the request breakdown. Cash Advances now accept any positive amount and impose no application-level maximum.
- Added Cash Advance policy tests covering small positive amounts, large amounts, and rejection of zero/negative values.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 21 Vitest tests.

## 2026-10-14 — Director Cash Advance project-field width

- Made the Cash Advance Project Name selector span the full form width for Director requesters, filling the space left by the intentionally hidden Manager approver field.
- Applied the same conditional width to the Google Sheet completion fields and the `Other Project Name` input, while preserving the existing two-column layout for Staff, Manager, and Finance requesters.
- Verification passed: full-project ESLint.

## 2026-10-14 — Currency cents input consistency

- Added shared currency-input behavior that preserves an in-progress decimal point while typing, accepts up to two cent digits, and normalizes completed values to two decimal places on blur.
- Applied it to Payment Voucher manual and bulk entry, Invoice Payment totals/tax/other requested amounts, Petty Cash, Cash Advance request and reconciliation lines, Travel Allowance special allowances, and Claims amounts.
- Kept non-currency decimal fields such as Payment Voucher quantity and Claim mileage distance independent from the currency component.
- Existing Google Sheet parsers and persisted numeric values already supported cents, so no workflow, API, or database-format change was required.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 21 Vitest tests.

## 2026-10-14 — Simplified single Payment Voucher lines

- Removed the Tax Code control and `+ Add line` action from the single Payment Voucher entry form; bulk Payment Voucher entry remains unchanged.
- Reduced the single-entry line layout to Account, Description, Quantity, Unit Price, and Total, and updated its review screen to use the same tax-free five-column breakdown.
- Single-entry submissions now explicitly persist `taxAmount: 0`; subtotal, total, and amount-in-words calculations no longer include tax.
- Preserved previously stored line rows when opening an amendment so older records are not silently discarded, while new single entries start with one line and cannot add more.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 21 Vitest tests.

## 2026-10-14 — Shared division selectors for Petty Cash and reconciliation

- Changed the Petty Cash expense-line division selector to import `DIVISION_SELECT_OPTIONS` from the shared payment-options module instead of using its separate domain-level division list.
- Changed Cash Advance reconciliation expense divisions from free-text inputs to dropdowns backed by the same shared division options.
- Existing or Google-Sheet-imported division values that are not in the current shared list remain selectable as labelled saved values, preventing older data from disappearing during an edit.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 21 Vitest tests.

## 2026-10-14 — Optional Invoice Payment supporting documents

- Removed the required badge and client-side attachment requirement from the Invoice Payment form; supporting documents are now clearly described as optional.
- Updated both Invoice Payment creation and returned-request resubmission validation to accept zero through five supporting documents.
- Kept the e-invoice link required and unchanged, since it is separate from the optional uploaded files.
- Added explicit empty-document messaging to the requester review and Manager, Director, and Finance review pages so optional requests do not display a blank section.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 21 Vitest tests.

## 2026-10-14 — Manager-only Travel Allowance creation

- Restricted new and returned Travel Allowance submissions to Manager accounts. The form now consistently presents the signed-in Manager as the submitter and creates requests on behalf of Staff.
- Updated create and resubmit API validation to accept only the Manager requester role and require the submitting Manager as the Manager approver identity.
- Added database-level verification that the requester has an active Manager membership in the organization; Manager-created requests bypass the Manager approval step and proceed directly to the selected Director.
- Removed the Travel Allowance creation link from Staff, Director, and Finance sidebars. The Manager sidebar links to the dedicated Manager creation page, while Director approval and Finance processing links remain available.
- Restricted returned-request corrections to the original Manager requester; legacy Staff-created requests are no longer eligible for resubmission under the new rule.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 21 Vitest tests.

## 2026-10-14 — Cash Advance manual-entry accounts

- Added a required Account dropdown to every Cash Advance manual-entry expense row, backed by the shared `PAYMENT_VOUCHER_ACCOUNT_OPTIONS` list used by Payment Voucher.
- Carried the chosen account into the requester review, request detail, stored request snapshot, generated Cash Advance request PDF, and the database submission line's GL-account relation.
- Kept the new request-line account field optional at the API/data-contract level so existing records and the current Google Sheet import remain compatible; the manual-entry form enforces selection before review and submission.
- Preserved any older saved account value that is no longer in the shared list so returned requests can still be edited safely.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 21 Vitest tests.

## 2026-10-14 — Travel Allowance Google Sheet employee and amount review

- Preserved each matched employee name exactly as supplied in the Travel Allowance Google Sheet when converting retrieved rows into review lines, instead of replacing it with the submitting Manager's profile name.
- Changed the Google Sheet retrieval summary to show the distinct sheet employees and added a calculated Amount column using the configured meal rates plus the row's special allowance.
- Changed the requester review hero to show the sheet employee or employee list; the signed-in Manager remains separately identified under `Submitted by` so request ownership and beneficiary names are not confused.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 21 Vitest tests.

## 2026-10-14 — Lenient Travel Allowance Google Sheet cells

- Reduced required Google Sheet headings and row values to the three identity/routing fields needed for a usable travel line: employee, travel date, and division/project.
- Blank reason, meals, special allowance, and special-allowance reason cells are now accepted during retrieval. Optional columns may also be omitted from the sheet.
- Google Sheet entries may contain a zero-value row, but the complete request must still have a total above RM0.00 before submission; manual entry retains its existing reason and special-reason requirements.
- Updated requester, Manager, Director, and Finance review tables to render a dash for an omitted reason, and relaxed create/resubmit API validation so imported blank reasons persist safely.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, and all 21 Vitest tests.

## 2026-10-15 — Cash Advance sheet leniency, reconciliation templates, and drafts

- Made the Cash Advance request-sheet parser ignore untouched template rows whose amount is `0.00`, preserve partially completed rows, and accept blank breakdown/purpose cells or zero-value companion rows as long as the complete request total is positive.
- Kept manual Cash Advance entry strict: Account, description, purpose, and a positive amount are still required for every manually entered row. Relaxed the shared API/domain contract only enough to preserve valid Google Sheet imports.
- Added a parser regression test covering blank descriptive cells and zero-value template rows. Cash Advance request review/detail screens display omitted descriptive values as a dash.
- Added Official Template panels to reconciliation for Cash Spent Appendix A and Participant Allowance. Direct-tab environment keys are `NEXT_PUBLIC_CASH_ADVANCE_APPENDIX_A_TEMPLATE_SHEET_URL` and `NEXT_PUBLIC_CASH_ADVANCE_PARTICIPANT_ALLOWANCE_TEMPLATE_SHEET_URL`; both fall back to `NEXT_PUBLIC_CASH_ADVANCE_TEMPLATE_SHEET_URL` when not configured.
- Added browser-local drafts for manually entered reconciliation values. Drafts restore on reopening, auto-save while editing, can be explicitly saved, and are removed after submission. Uploaded proof files are intentionally not stored in browser storage and must be selected again after reopening.
- Appendix A Google Sheet imports are not stored as drafts; manually changing the imported expense rows switches the reconciliation back to manual-draft behavior.
- Corrected the shared currency input's prop/draft synchronization to satisfy React's current lint rules without changing its two-decimal behavior.
- Verification passed: full-project ESLint, source-only TypeScript checking excluding live-dev generated route files, targeted reconciliation ESLint after the final cleanup, and all 23 Vitest tests.

## 2026-10-15 — Compact reconciliation template buttons

- Replaced the large Official Template cards in Cash Advance reconciliation with compact, medium-size outlined buttons placed beside the `Summary of Cash Advance Spent` retrieval heading and the `Participant Allowance` heading.
- The buttons are 40px high with content-width sizing, 15px horizontal padding, and responsive wrapping so they remain balanced without filling the card.
- Each button now uses only its dedicated environment URL: `NEXT_PUBLIC_CASH_ADVANCE_APPENDIX_A_TEMPLATE_SHEET_URL` or `NEXT_PUBLIC_CASH_ADVANCE_PARTICIPANT_ALLOWANCE_TEMPLATE_SHEET_URL`. An unconfigured button remains visible but disabled with a configuration hint.
- Verification passed: targeted ESLint for the changed reconciliation components and source-only TypeScript checking excluding live-dev generated route files.

## 2026-10-15 — Lenient receipt links and Google Drive chip references

- Updated the Cash Advance `Summary of Cash Advance Spent` importer and the Expense, PD, Internet/Commute, Medical, and Tech Claim importers to accept either a normal web URL or the displayed text exported from a Google Drive smart chip, such as a PDF filename.
- Removed the Claims API's URL-only validation for imported receipt references so chip labels can be stored without being rejected during submission.
- Kept valid web references clickable. Non-URL smart-chip labels are rendered as plain document-reference text instead of being placed in an unsafe or broken link.
- Added regression coverage for all six requested import paths, including a normal Google Drive URL compatibility case.
- Verification passed: targeted ESLint, TypeScript checking with incremental output disabled, and all 7 targeted Vitest cases.

## 2026-10-15 — Google-style document reference chips

- Added a reusable rounded grey document-reference chip with a compact file icon and ellipsized filename, matching the Google Sheets file-chip presentation.
- Applied it to imported Claim document references in the sheet preview, editable Claim table, and shared review pages for Expense, PD, Internet/Commute, Medical, and Tech claims.
- Applied the same chip to Cash Advance reconciliation review and saved reconciliation detail tables, including uploaded receipt filenames.
- Valid HTTP/HTTPS document references remain clickable in a new tab; filename-only values exported from Google Drive smart chips remain non-clickable text to avoid unsafe or broken navigation.
- Verification passed: targeted ESLint, TypeScript checking with incremental output disabled, and all 7 targeted Google Sheet import tests.

## 2026-10-15 — Clickable Google Sheets file-chip receipts

- Extended the shared payment-request Google Sheet endpoint with optional Google Sheets API enrichment. When `GOOGLE_SHEETS_API_KEY` is configured, it reads `chipRuns.richLinkProperties.uri`, cell hyperlinks, and rich-text links from the selected worksheet tab.
- Claim imports now pair the file chip's visible filename with its underlying Drive URL. Expense, PD, Internet/Commute, Medical, and Tech Claim record pages display the filename in the grey chip and open the actual proof document when clicked.
- Normal URL cells remain clickable. Filename-only fallback imports remain safely non-clickable because CSV exports do not contain enough information to reconstruct the original Drive URL.
- Added the new server-only environment requirement to the live app README. The Google Sheets API must be enabled for the key's Cloud project, and imported sheets must remain viewable to anyone with the link.
- The API key is sent to Google from the server through the `x-goog-api-key` header and is never exposed through a `NEXT_PUBLIC_` variable or Google request URL.
- Verification passed: targeted ESLint, TypeScript checking with incremental output disabled, and all 7 Claim smart-chip parser tests.

## 2026-10-15 — Payment Voucher Finance route audit and automatic references

- Audited the five Payment Voucher Finance mutation endpoints: start processing, save payment information, complete, mark inactive, and return for a new signature. Live route probes reached every handler and returned each route's structured not-found response for a deliberately missing voucher, confirming registration.
- The generic 404 shown in the screenshot is consistent with a stale Next.js development route manifest rather than the current route source; restart the already-running dev server after adding or changing route folders.
- Payment references now default to the PV number in both the single Finance panel and Payment Voucher bulk processing. The fields are visible but read-only, including a one-voucher bulk selection.
- The payment-information API no longer requires a client-supplied reference. The database operation derives `paid_reference` from the stored `submission_number`, ensuring single, bulk, and older clients all persist the PV number consistently.
- Added shared reference logic and unit coverage for unsaved and existing vouchers.
- Verification passed: targeted ESLint with no warnings, TypeScript checking with incremental output disabled, 2 reference tests, and live registration probes for all five Finance routes.

## 2026-10-15 — PV-number recipient references

- Changed the Payment Voucher recipient reference to use the generated PV number, matching the automatic Finance payment reference.
- New vouchers store the PV number in their snapshot recipient reference, and returned-voucher resubmission reuses the existing PV number rather than accepting or generating a separate `REC-…` value.
- Record mapping derives the displayed recipient reference directly from `submission_number`, so existing vouchers immediately show `PV-…` instead of legacy `REC-…` values without a database migration.
- Verification passed: targeted ESLint, TypeScript checking with incremental output disabled, and all 3 Payment Voucher reference tests.

## 2026-10-15 — Cash Advance account fallback, bank selector, and compact review

- Removed the Cash Advance submission failure for shared account codes that have not yet been seeded into an organization's `GlAccount` rows. The selected account code remains preserved in the request snapshot, while the optional database relation is populated whenever a matching ledger account exists.
- Applied the same behavior to new requests and returned-request resubmissions; no database migration was required because `SubmissionLine.gl_account_id` is already nullable.
- Replaced both Cash Advance Bank Name text fields with dropdowns backed by the shared `BANK_NAME_SELECT_OPTIONS` list. Previously saved or sheet-imported bank values outside the current shared list remain visible during correction editing.
- Rebuilt the requester preview as a compact receipt-style card matching the supplied reference: embedded title and total, separate request and approval rows, payment-account summary, condensed expense table, and bottom total bar. Director requests now use Director-specific submit copy instead of referring to a Manager.
- Verification passed: targeted ESLint, TypeScript checking with incremental output disabled, and all 6 targeted Cash Advance tests.

## 2026-10-15 — Non-blocking Manager preview for Cash Advance

- Changed new and corrected Cash Advance requests to enter `PENDING_DIRECTOR_APPROVAL` immediately with the selected Director as the active assignee. Manager is no longer an approval or signature gate.
- Kept the assigned Manager on Staff and Manager requests as an informational viewer. The Manager can open the request and optionally record a preview without signing, approving, returning, or delaying Director action.
- Reworked the Manager Cash Advance queue and single/bulk interfaces around `Available to preview` and `Previewed` states. Bulk Manager preview no longer requires a saved signature.
- Added a `MANAGER_PREVIEW` transition and `managerPreviewedAt` record field. The existing Manager preview endpoint now records that informational event; legacy `APPROVE_BY_MANAGER` data remains readable as a completed preview.
- Added compatibility handling for older requests still stored in `PENDING_MANAGER_APPROVAL`: they are presented as Director-ready, the assigned Director can approve or return them directly, and a later Manager preview also releases the legacy database state.
- Updated confirmation, tracking, Director queue copy, and notifications. The workflow UI now shows `Manager Preview` with an `Informational` pill while Director Review is active immediately.
- Added routing regression tests confirming all submissions start with the Director and legacy Manager-blocked records are exposed as Director-ready. Verification passed: targeted ESLint, TypeScript checking with incremental output disabled, and all 8 targeted Cash Advance tests.

## 2026-10-15 — Invoice and Travel Finance processing routes and automatic references

- Audited the Invoice Payment and Travel Allowance Finance completion paths from both the single-record screens and shared bulk-processing screen through their `finance-complete` API routes and database operations.
- Standardized the clients so single and bulk processing send the same Finance identity and payment-date data to the same registered dynamic routes.
- Invoice Payment now records `paid_at` and `paid_reference` in `InvoicePaymentDetail`; those fields are exposed as `financePaymentDate` and `financePaymentReference` on the record and shown after completion.
- Both Invoice Payment and Travel Allowance payment references are now derived server-side from the stored request number. Invoice references use the `IV…` request number and Travel Allowance references use the `TA…` request number; client-supplied text cannot override them.
- Added read-only automatic reference fields to both single Finance screens and the bulk payment table. Invoice bulk processing now includes the same payment-date and reference review used by Travel Allowance.
- Bulk failures now include the first real API error message alongside the retry count instead of only reporting that a record needs attention.
- Added shared reference regression coverage for Invoice and Travel request numbers. Verification passed: targeted ESLint, TypeScript checking with incremental output disabled, and all 38 project tests.

## 2026-10-15 — Monthly Travel Allowance request numbers

- Standardized new Travel Allowance request numbers as `TAyy-MM-NN`; for example, the first September 2026 request is `TA26-09-01`.
- The sequence remains organization-specific and resets by calendar month through the existing `DocumentSequence` key. Sequence values use at least two digits.
- Finance payment references continue to copy the stored Travel Allowance request number, so new requests use the same `TAyy-MM-NN` value for both identifiers.
- Extracted the formatter into a shared domain helper and added regression examples for September and October.
- Verification passed: 4 targeted Vitest tests, targeted ESLint, and TypeScript checking with incremental output disabled.

## 2026-10-15 — Tech Claim amount tiers and required Manager approval

- Replaced the user-controlled extended Tech allowance choice with amount-driven policy logic shared by manual entry and Google Sheet submissions.
- Tech Claims up to RM500.00 use the standard allowance. Staff Tech Claims from RM500.01 through RM1,000.00 automatically use the extended allowance, require Manager approval before Finance, and retain the existing three-year lock.
- Tech Claims above RM1,000.00 remain blocked because RM1,000.00 is the documented policy ceiling; a higher exception path must be defined separately before amounts such as RM1,500.00 or RM2,500.00 can be accepted.
- Google Sheet review now displays the Manager-approval requirement or the over-limit error before submission. Manual entry shows the same dynamic policy result.
- Finance single and bulk processing exclude extended staff Tech Claims until Manager approval. The server also enforces the block independently of the interface.
- Updated Manager review, workflow, confirmation and notification copy to distinguish required approval from informational previews.
- Verification passed: all 16 Vitest files / 44 tests, targeted ESLint, and TypeScript checking with incremental output disabled.

## 2026-10-15 — Automatic Cash Advance and Petty Cash payment references

- Cash Advance and Petty Cash Finance payment references now automatically copy their stored request number, matching Payment Voucher, Invoice Payment, and Travel Allowance behavior.
- Single Finance screens show the automatic value as read-only. Bulk Finance processing does the same and no longer asks Finance to type separate references for these request types.
- Both database operations derive the reference server-side, so an older or modified client cannot override it.
- Existing paid/verified Cash Advance and Petty Cash records display the request number as their reference without a database migration.
- Petty Cash still requires its payment proof; only the reference entry was automated.
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

## 2026-10-18 — ARUS payment-type dashboard colors

- Applied the requested ARUS payment-type palette throughout the dashboard action cards, portfolio code badges and action-drawer header: Payment Voucher `#07456b`, Invoice Payment `#0c6f50`, Travel Allowance `#f29221`, Cash Advance `#db224a`, Claims `#000000`, and Petty Cash `#ffffff`.
- Petty Cash uses a dark outline and text so its white marker remains visible on white cards. Action cards use compact colored markers; portfolio and drawer codes use solid branded badges.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-18 — Dashboard action-drawer direct routing

- Corrected dashboard action-drawer record links so role-owned tasks open directly in the appropriate Manager/Director approval or Finance processing page instead of detouring through Payment Records.
- Payment Records remains the destination only for requester-owned work such as drafts, corrections, confirmations, signed-PV uploads and reconciliation. This also handles Finance/Manager/Director users who submitted their own request without overriding their separate role action routes.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-18 — Dashboard drawer status colors and action-card sizing

- Changed dashboard action-drawer status badges from a single amber treatment to semantic colors shared with dashboard statuses: red for rejected/returned, amber for pending action, blue for active progress, green for completed, and grey for neutral states.
- Increased each payment-type action card to a 68px minimum height with more vertical spacing so the six-card action row is easier to scan and click.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-18 — Role-accurate dashboard action panel and drawer

- Implemented the approved Option C dashboard hierarchy with a prominent `Need your action` panel, payment-type action buttons, compact role-specific KPIs, and the existing payment portfolio below.
- Added a right-side action drawer. It shows up to ten oldest pending records for the selected payment type, links each record to its correct action/detail page, supports backdrop and Escape dismissal, and includes a role-aware `View all` queue link. It becomes full-width on mobile.
- Staff wording focuses on personal submissions, progress, completion, corrections, confirmations and reconciliation. Manager wording focuses on assigned review/preview work; Director wording focuses on approvals and exceptions; Finance wording focuses on verification, payment processing and final reconciliation.
- Tightened dashboard action eligibility using requester ownership, current assignee, approval membership and recorded previews. `RECONCILED` now counts as completed, and requester-owned Petty Cash actions route to Payment Records even when the requester is a Manager, Director or Finance user.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-18 — Cash Advance Manager and Director loading interface

- Replaced the full-width `Loading Cash Advance…` notice in Manager and Director detail pages with the shared centered `PaymentPageState` used by Invoice and Travel.
- Both roles now show `Loading request`, `Reading the Cash Advance details…`, and a role-correct `Back to Cash Advances` link. Initial-load errors use the same consistent presentation.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-17 — Dashboard redesign reverted

- Restored the original dashboard interface with four summary cards: Visible records, Need your action, In progress, and Completed.
- Removed the temporary prominent action row and five role-specific KPI layout at the user's request. Payment portfolio, Director/Finance expenditure analytics, and recent activity remain in their original positions.
- This reversal is limited to the dashboard redesign; the earlier requester action-count, Petty Cash, receipt-preview, Director queue, and pagination fixes remain in place.

## 2026-10-17 — Requester action-count refresh

- Added requester-owned Petty Cash reconciliation to the Payment Records attention total and Petty Cash type-card badge. A paid request in `PENDING_RECONCILIATION` counts as one action for its original requester and stops counting after submission to Finance.
- Kept action counting record-based so overlapping requester and role conditions do not duplicate the My Requests badge.
- Made sidebar action counts refresh on navigation, window focus, a shared action-change event, and a 15-second fallback interval. Petty Cash reconciliation submission emits the event immediately.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-17 — Petty Cash reconciliation preview and shared pagination repair

- Added spacing between Petty Cash action-success banners and the detail card.
- Replaced Finance reconciliation receipt URLs with document cards that open PDFs and images in an in-page preview modal without navigating or refreshing.
- Rebuilt the Director Petty Cash queue to match the Manager workspace with summary cards, search, pending/approved/all filters, Grid/List views, and shared pagination.
- Fixed the shared pagination hook so render-created filtered arrays no longer reset the current page immediately after Next is clicked. The default page size is now 10 records across Payment Voucher and payment-request queues using this shared control.
- Full-project ESLint and TypeScript checking passed.

## 2026-10-19 — ARUS payment-context detail indicator

- Added a compact route-aware payment-type indicator beneath the beta header on payment detail, correction and review routes.
- Indicators use the agreed ARUS palette for Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance and Claims. Petty Cash remains white with a navy outline and marker for visibility.
- The indicator is intentionally isolated from semantic workflow statuses and does not recolor the rest of the page.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-19 — Medical and PD annual entitlement enforcement

- Changed PD from a standalone RM500-per-claim ceiling to a cumulative RM500-per-employee calendar-year entitlement, parallel to Medical.
- Added employee joining-month proration for both Medical and PD; the joining month is included in the eligible-month calculation.
- Claim policy context now returns separate annual entitlements, used amounts and remaining balances. Draft, rejected and voided records are excluded by the repository query.
- Updated the Claim form policy bar to show used, prorated entitlement and remaining balance for both types.
- Submission is revalidated inside the database transaction using the same context, preventing form-only bypasses.
- Focused Claims policy tests passed (8/8); focused ESLint and full TypeScript checking passed.

## 2026-10-18 — Administration modal checkbox spacing

- Standardized checkbox sizing, alignment and label spacing across Programme, Accounting Code, Employee and Claim Entitlement modal overlays.

## 2026-10-18 — Administration typography and entitlement-table consistency

- Reduced typography and vertical spacing across the Administration header, tabs, notice, filters, directory headings, policy cards, tables and modal headings.
- Aligned the Claim entitlements employee table with the other Administration directories and added the same record-count footer treatment.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-18 — Administration table and control refinement

- Removed the temporary New badges from the Employees and Claim entitlements tabs.
- Reduced the Administration directory primary-button and row-action sizing.
- Restyled Administration tables to match the Payment Voucher table system with an inset rounded wrapper, fixed layout, PV header typography, compact cell spacing, wrapping content and row hover feedback.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-18 — Administration prototype alignment and claim entitlements

- Reworked Administration to match the approved directory prototype: full-width data tables, text-only search fields, status/role/manager filters, ten-row pagination and centered modal overlays for all Add/Edit actions.
- Added an Employees directory with role, programme, joining date and active status. Joining date supplies the source data required for employee-based claim proration.
- Added a Claim entitlements tab showing Medical and PD annual allowances (RM500 each by default), a proration setting, the proration rule, and each active employee's calculated annual entitlement.
- Administration data remains browser-local in the beta. Claim-policy storage and calculations are represented in the admin workspace; production enforcement still requires database-backed policy APIs and authenticated employee records.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-18 — Director Administration workspace

- Added a restricted Administration workspace visible only in the Director sidebar for the current beta identity model. Direct navigation also checks the signed-in role and shows an access-required state to other users.
- Added programme CRUD with active/inactive state and Manager assignment, plus accounting-code CRUD with descriptions and active/inactive state.
- Connected active administrator-managed accounting codes to single and bulk Payment Vouchers, Claims, Cash Advance requests and Cash Advance reconciliation. Inactive codes are excluded from new selections while previously saved values remain intact.
- The beta implementation persists administration settings in browser storage. The access helper is intentionally isolated so the future Admin and IT roles can move to a dedicated `ADMIN_ACCESS` permission and database-backed API without redesigning the page.
- Focused ESLint and full TypeScript checking passed.

## 2026-10-18 — Expenditure graph ARUS colors

- Updated the dashboard expenditure legend and stacked monthly graph to use the same ARUS payment-type palette as the dashboard, Payment Records and My Requests.
- Petty Cash uses white with a dark inset outline so its legend marker and chart segments remain visible against light backgrounds.
- Dashboard ESLint and full TypeScript checking passed.

## 2026-10-18 — Payment Records ARUS category colors

- Extended the ARUS payment-type palette to the shared category cards used by both Payment Records and My Requests.
- Payment Voucher, Invoice Payment, Travel Allowance, Cash Advance and Claims use their assigned solid colors; Petty Cash remains white with a dark outline and text for contrast.
- Full-project ESLint passed; TypeScript checking completed without reporting an error.

## 2026-10-22 — Standardized Payment Records statuses

- Updated Payment Records for Invoice Payment, Travel Allowance, Cash Advance, Claims and Petty Cash to use the shared standardized customer-facing status wording.
- Updated both the Status filter options and visible list/grid badges. Invoice Payment and Travel Allowance detail badges also import the shared mapper; Cash Advance, Claims and Petty Cash details already reuse standardized shared workflow/badge components.
- Preserved all internal status enums, role routing, Cash Advance reconciliation behavior and existing rejection-reason fields. Payment Voucher remains unchanged.
- Added the seven Payment Records copy destinations to `generated/STANDARD_PAYMENT_STATUS_COPY_FILES.md`.
- Replaced payment-type-specific status-filter options with one shared eight-stage option list. Record filtering now compares each internal enum through `matchesStandardPaymentStatus`, so every Payment Records page offers Draft, Submitted, both approval stages, rejection, Finance verification, processed payment and transaction-proof upload consistently.
- Restored `Pending Reconciliation` as a separate shared display/filter status for Cash Advance and Petty Cash. Both requester and Finance reconciliation-pending enums map to it; only `RECONCILED`, `COMPLETED` and `PAID` map to `Payment is processed`.
- Google Sheet entry does not own a separate workflow status: Claims, Travel Allowance and Cash Advance sheet data is submitted through the same request APIs as manual entry, so the resulting records automatically use the shared status mapper. No status is read from or trusted from the external sheet.
- Right-aligned the Amount table header with its right-aligned currency values across Invoice Payment, Travel Allowance, Cash Advance, Claims and Petty Cash Payment Records.

## 2026-10-22 — Invoice form purpose placement

- Removed the visible Request title field from the Staff Invoice Payment form.
- Moved Purpose of payment into the Invoice Details section as its first full-width field.
- Preserved compatibility with the existing required `title` storage field by submitting the trimmed purpose as the internal title; no database or API migration is required.
- Removed the duplicate title/purpose presentation from the pre-submission review hero so the purpose is displayed once.
- Refined the placement after feedback: Purpose of payment now appears below the complete Transfer Type and Payment Portion choice area, with a 24px separation.
- Removed the Tax Code column and tax controls from Payment Amount, reduced the table to Currency, Invoice Total and Amount Requested, and removed the Tax/SST line from the Staff review. The existing API-compatible `taxAmount` is submitted as `0`.
- Made Supporting Documents optional end to end: replaced the Required badge with an Optional badge, removed the client-side non-empty validation, and removed `.min(1)` from both the Invoice Payment create and resubmit API schemas. The five-file maximum remains enforced.

## 2026-10-21 — Reusable action-queue filter implementation

- Added a copy-ready shared filter card and generic filtering hook for the Manager, Director and Finance Invoice Payment, Cash Advance, Travel Allowance, Claims and Petty Cash queues.
- The shared implementation supports search, workflow status, updated month, exact updated date, updated-date sorting, amount sorting and clearing all filters.
- Added `generated/ACTION_QUEUE_FILTER_IMPLEMENTATION.md` with the queue wiring pattern and payment-specific labels. This is a copy guide; the generated scaffold is not independently deployable and the fifteen live queues are not claimed as already wired.
- Added the shared TypeScript files to the focused verification project.
- Wired the shared card into all generated Manager, Director and Finance Invoice Payment and Travel Allowance queues, replacing their duplicate search/status controls and filtering before pagination. Cash Advance and Petty Cash retain their older queue controls pending their separate queue-structure conversion.
- Preserved the Invoice Payment Grid/List selector as a compact, right-aligned `View | Grid | List` control with a navy active state after the filter-card conversion.
- Moved that selector inside the Invoice Payment records header for Manager, Director and Finance so it cannot fall into a separate left-aligned toolbar row; the header now keeps the prototype's title-left/control-right layout.
- Added final high-specificity Invoice queue styles that join `View`, `Grid` and `List` inside one outlined capsule and force the selected view to navy/white, preventing legacy toolbar rules from visually separating the controls.
- Removed the separate rounded border/background around the Invoice Payment records heading for Manager, Director and Finance while preserving the joined `View | Grid | List` control unchanged.
- Rebuilt the generated Manager, Director and Finance Travel Allowance queues from the user's current Grid/List-enabled source files. Added the shared action filter card while preserving `PaymentViewToggle`, `TravelAllowanceQueueCard`, bulk-action links and role-specific loading behavior; removed only the duplicate inline search/status tabs. Focused TypeScript and ESLint checks passed.
- Positioned the existing Travel Allowance `PaymentViewToggle` inside each records header so it stays right-aligned and visually unchanged, and removed the records heading's separate rounded border to match the Invoice queue treatment.
- Styled the Travel Allowance Manager/Director bulk review link and Finance bulk-process link as accessible navy action buttons, including hover, keyboard-focus and responsive full-width states.
- Rebuilt the generated Manager, Director and Finance Petty Cash queues from the user's current Grid/List-enabled files. Added the shared action filter card, preserved `PaymentViewToggle`, bulk actions and pagination, moved the view selector into each records header, added spacing above the records panel and removed the heading's nested rounded border.
- Rebuilt the generated Manager, Director and Finance Cash Advance queues from the user's current Grid/List-enabled files. Added the shared action filter card and removed only the duplicate search/status controls. Preserved the existing `PaymentViewToggle`, bulk links, cards, tables, pagination and workflow logic. Replaced the generated Cash Advance CSS with the user's current CSS verbatim and appended only a 24px records-panel top margin; existing bulk-button rules were not modified.
- Removed the obsolete `requiresAction` and `actionCount` variables from the Cash Advance Finance queue after the status tabs were replaced by the shared filter card, resolving its unused-variable ESLint warnings.
- Reworked Manager, Director and Finance Cash Advance grid cards to follow the Petty Cash interface: reference/status header, requester and entry summary, shaded two-column details panel, and bottom-right action. Added only scoped `.queueReceipt .queueCard*` CSS so existing bulk buttons and unrelated Cash Advance styles remain untouched.
- Rebuilt the shared Director/Finance Claims queue from the user's current source and CSS. Replaced only the old search/status filter area with the shared action filter card, extending that card with an optional extra-field slot so Claim Type remains available. Preserved both bulk-action buttons, Grid/List, Claims cards/tables, pagination and workflow logic. The supplied Claims CSS was copied unchanged.
- Clarified the shared filter CSS root selector as `.card` in a multiline block after a copied live file produced the CSS Modules `Selector "card" is not pure` error. All selectors in the generated stylesheet remain locally scoped.
- Rebuilt the Manager Claims queue from the user's current source after it was omitted from the earlier Director/Finance Claims update. Added the same shared filter card with Claim Type, while preserving the Manager bulk-review button, Grid/List, Claims cards/table, pagination and Manager-specific preview logic. No Claims CSS rules were changed.

## 2026-10-17 — Petty Cash advance and reconciliation workflow

- Changed Petty Cash below RM300 from reimbursement to an advance workflow. Initial requests no longer require receipt or invoice links in the form, API schema, shared validation, review screens, or Finance bulk processing.
- Made Director approval mandatory before Finance payment for Staff, Manager, Director, and Finance requesters. Staff and Finance may select an optional Manager reviewer; a Director requester must select another Director. Added the previously missing Director approval API route.
- Finance fund release now creates the Money Out transaction and moves the request to `PENDING_RECONCILIATION` instead of closing it.
- The original requester now owns reconciliation after payment, regardless of whether they are Staff, Manager, Director, or Finance. They submit mandatory purchase receipts, actual spending, an optional returned balance, proof when a balance is returned, or a required remark when no balance is returned. Actual spending plus returned balance must equal the released amount.
- Requester submission moves the request to `PENDING_FINANCE_RECONCILIATION`. Finance verifies the submitted evidence; final completion records any returned balance as Money In, updates the float balance, and closes the request as `RECONCILED`.
- Reconciliation amount controls are text inputs with decimal keyboard hints and `0.00` placeholders. The confirmation workflow stays on one desktop track, the secondary create-another button is white, and the Director detail includes the same action-plus-tracker rail used by the other request types.
- Updated confirmations, queues, status badges, Payment Records, and single/bulk Finance interfaces to reflect Director approval and two-stage reconciliation.
- Full-project ESLint and TypeScript checking passed. Focused policy coverage was added for receipt-free requests and mandatory Director routing.
- Updated the Petty Cash form wording placement: the page subtitle now explains purchasing before reconciliation, while the guidance-card heading reads “Request funds for planned work expenses below RM 300.” Removed the outdated reimbursement wording.
- Removed the duplicated reconciliation sentence from the Petty Cash page header, leaving it only in the guidance card. Added reusable `.requiredMark` CSS and red asterisks to the required request date, contact, location and role-dependent reviewer fields.

## 2026-10-22 — Unified Manager Pending Approvals

- Replaced the Manager sidebar's six payment-type approval links with one `Pending Approvals` destination and one combined action count.
- Added a unified Manager queue for Payment Voucher, Petty Cash, Invoice Payment, Travel Allowance, Cash Advance and Claims. Payment Voucher remains preview-only; the other five types support single or multiple selection.
- Added payment-type tabs and counts, search, programme, month and sorting controls, plus an adaptive detail filter: Claim Type for Claims, Location for Petty Cash, Vendor for Invoice, Division for Payment Voucher and Project for Travel Allowance/Cash Advance.
- Added a selection bar, bulk confirmation overlay, reviewed/not-reviewed progress, per-request Open action, Previous/Next detail review, Close and Mark as reviewed. Final approval remains disabled until every selected request is reviewed and the confirmation checkbox is selected.
- Kept the original payment-specific approval APIs and next-stage workflow behavior. Existing individual pages remain available by direct URL even though they are no longer listed separately in the Manager sidebar.
- Added copy destinations to `generated/MANAGER_PENDING_APPROVALS_COPY_FILES.md`. Focused TypeScript verification passed; this scaffold still has no independent ESLint runtime.
- Removed the synchronous `setLoading(false)` call from the Manager queue effect's non-Manager guard. The guard now returns without updating state because the access-required render already takes precedence. The corrected component passes the live ESLint configuration with no lint findings and passes focused TypeScript verification.
- Corrected the unified total to match the established Manager queue semantics: Cash Advance counts unpreviewed assignments, Claims and Petty Cash count assigned records not yet reviewed/previewed rather than only one workflow status, and Payment Voucher is displayed as a separate `Preview` tab without being added to `Waiting for you`. The All count and hero count now use the same non-PV collection.
- Replaced the overflowing unlabeled control strip with a dedicated, responsive filter card containing a title, description, top-right Clear filters button and labelled Search, Programme, adaptive request-detail, Submitted month and Sort fields. Added `manager-pending-approvals-filter.module.css` to the copy guide. Focused TypeScript and ESLint both pass.
- Revised the Manager queue after usability feedback: removed the All payment-type tab, made Payment Voucher the initial tab, removed the filter outline, and reduced the filters to Search, Status, Submitted month and Sort. Each payment-type tab retains its own count.
- Review and Payment Voucher Preview now open the in-page details overlay instead of navigating to an individual or bulk page. Single non-PV review is promoted into the one-item confirmation flow after Mark as reviewed; checkbox selections retain the Open, Previous, Next and Mark as reviewed sequence.
- Expanded the Payment Voucher overlay with payment details, recipient information, amount in words and the complete line breakdown. Mark as reviewed calls the Payment Voucher Manager-view API and refreshes the queue.
- Changed the selected-items action bar from sticky to viewport-fixed so it remains visible during long-list scrolling. `Waiting for you` now includes Payment Voucher actions, matching the combined sidebar count. Focused TypeScript and ESLint pass after these amendments.
- Removed the obsolete `ALL` member from the Manager queue's `PaymentType` union after the All payment-type tab was removed. `ALL` remains only as the intentional Status-filter sentinel. Focused TypeScript and ESLint continue to pass.
- Synchronized the Manager sidebar badge with the unified queue. Cash Advance now uses its unpreviewed Manager-assignment rule in `sidebar-action-counts.ts`, and assigned/unviewed approved Payment Vouchers are counted directly from the Payment Voucher API because the generic dashboard summary does not reliably carry the snapshot-only Project Manager assignment. Existing dashboard-derived PV counts are replaced rather than added twice. The sidebar `ALL_PENDING` total now follows the same six-category semantics as `Waiting for you`. Focused TypeScript and ESLint pass.
- Refined the fixed Manager selection bar with a larger sidebar/page inset, 24px bottom clearance and 118px reserved page padding so it does not cover the last queue row. Separated the total with a divider and increased its size, weight and contrast using an explicit `Total` label. Mobile keeps a compact edge inset and removes the divider when wrapping. Focused TypeScript and ESLint pass.
- Added a Claims-only Claim type filter to the unified Manager queue. Its options are derived from the assigned Claim records, it participates in filtering and Clear filters, and it resets when switching payment-type tabs. The Claims layout expands to five columns on wide screens while retaining the existing two-column/tablet and one-column/mobile behavior.
- Hardened the focused TypeScript project against a concurrently written malformed Next.js development route cache by removing its dependency on live `next-env.d.ts` and adding a local CSS Modules declaration. Focused TypeScript and ESLint pass.
- Replaced the unified queue's generic status filter with payment-specific Manager filters backed by all assigned records: Cash Advance Preview/Viewed; Petty Cash Needs preview/Previewed/All; Invoice Pending Manager Review/Pending Director Review/All; Travel Pending Manager Review/Forwarded/All; and Claims Manager/Director/Finance/Returned/Completed plus All. Claims retains its independent Claim type filter.
- Added raw workflow status, reviewed and actionable metadata to normalized queue rows. Tab badges and `Waiting for you` count only actionable rows, matching the sidebar rules, while forwarded/viewed/completed records remain accessible through their filters. Non-actionable rows cannot be selected or marked reviewed again.
- Removed the fixed bottom selection bar. Checkbox selection now exposes `Review selected (n)` in the queue header; the confirmation modal owns the selected total. After Mark as reviewed, that row's Open button is omitted from confirmation. Focused TypeScript and ESLint pass.
- Moved `Review selected (n)` from the queue title row into a normal footer below the records table, alongside a Clear action and selected-count label. The footer is part of the document flow and does not float over records.
- Made the `Waiting for you` hero consume `ALL_PENDING` from the same `fetchSidebarActionCounts` function used by the sidebar, with the locally derived actionable total only as a fetch-failure fallback. This prevents the hero and sidebar badge from showing different totals. Focused TypeScript and ESLint pass.
- Moved the approval-confirmation total out of the header subtitle and into a high-contrast summary row below the selected-request list. The row uses an explicit `Total selected amount` label and an 18px bold currency value. Reduced the remaining Open buttons to a compact 9px control. Focused TypeScript and ESLint pass.
- Set the confirmation footer buttons to a consistent medium 12px/700-weight label size. Active payment-type tabs now use their ARUS category color for the underline instead of the shared navy underline. Added Payment Voucher `Preview required` and `Viewed` filters, defaulting the PV tab to Preview required and filtering through the existing Manager-view timestamp. Focused TypeScript and ESLint pass.

## 2026-10-23 — Unified Director Pending Approvals

- Collapsed the Director approval submenu into one `/beta/director/pending-approvals` sidebar destination with the shared `ALL_PENDING` badge.
- Added a pending-only Director queue for Payment Voucher, Petty Cash, Invoice Payment, Travel Allowance, Cash Advance and Claims. Completed and forwarded records remain in Payment Records, so the queue intentionally has no redundant Status filter.
- Reused the Manager interaction pattern: ARUS-colored payment tabs, counts, search/month/sort filters, Claims-only Claim type filter, single detail overlay, multi-selection review sequence, total summary and final confirmation.
- Director approval uses the existing payment-specific APIs. Payment Voucher and Cash Advance approvals require the Director's saved signature; confirmation is disabled and explains the requirement when no signature exists.
- Added `generated/DIRECTOR_PENDING_APPROVALS_COPY_FILES.md`. Focused TypeScript and ESLint pass.
- Brought the Director Payment Voucher detail overlay to parity with Manager: full payment metadata, purpose and amount in words, recipient/banking information, itemized amounts, tax and grand total.
- Replaced the standalone Director `Mark as reviewed` action with real `Reject` and `Approve and forward` actions. Reject opens a required remarks field and calls the payment-type return/rejection API so the requester can amend; approval continues through each payment type's existing Director API. Payment Voucher and Cash Advance approvals still enforce a saved signature. The multi-select review/confirmation flow remains unchanged.
- Direct actions remove completed items from the pending queue, refresh Payment Vouchers when needed and refresh the shared sidebar/hero pending count. Focused TypeScript and ESLint pass.
- Styled the Director rejection-panel actions consistently with the approval UI: the Cancel control now has the standard bordered button treatment, while Reject and return is a solid red destructive action. Added matching hover, keyboard-focus and disabled states.
- Changed the destructive Reject button hover treatment to an inverted white background with red text and border.
- Refined Director multi-selection after workflow clarification: there is no bulk Reject action on the confirmation screen. Opening each selected request now requires an explicit Approve or Reject decision; Reject captures mandatory per-request remarks. The confirmation list displays Not reviewed, Approved or Rejected badges and submits the mixed decisions together through the correct payment-specific APIs. Successfully processed records leave the queue and failures remain selected for retry.
- Changed the Director detail overlay's Approve action from navy to green, with darker-green hover and accessible green focus-ring states, so it is visually distinct from the red Reject action.
- Inverted the Director Reject action styling: its default state is white with a red border/text, and hover changes to a solid red background with white text.
- Made `.rejectButton` explicitly medium-sized with a 14px label, 40px minimum height and 9px/16px padding using `!important` declarations so the shared modal footer button rules cannot override it.

## 2026-10-23 — Unified Finance Pending Processing

- Collapsed the Finance sidebar's six payment-type processing links into one `Pending Processing` destination using the shared `ALL_PENDING` action count.
- Added a unified Finance queue for Payment Voucher, Petty Cash, Invoice Payment, Travel Allowance, Cash Advance and Claims. Only Finance-actionable records are included; completed records remain in Payment Records.
- Added ARUS-coloured payment-type tabs, search, month and sorting controls, plus Finance-stage filters for Processing, Verification, Reconciliation and Transaction proof needed.
- Added Payment reference and Transaction proof columns. A proof action appears after a payment reference exists, while already attached proof is shown as Uploaded. Row processing continues through the existing payment-specific Finance screens so their current validation and workflows are preserved.
- Added `generated/FINANCE_PENDING_PROCESSING_COPY_FILES.md`. Focused TypeScript passed and ESLint passed after removing the unused date helper; only the existing environment warnings remain.
- Corrected the Petty Cash advance lifecycle end to end. Initial requests now capture planned expenses without requiring purchase receipts. Finance payment release creates the Money Out entry and moves the request to `PENDING_RECONCILIATION` instead of closing it.
- Added requester reconciliation UI and APIs. Purchase receipts are always mandatory. The balance is calculated as released minus actual spending; spending above the released amount is rejected. A positive balance requires return date, reference and transaction proof, while a zero balance requires a no-balance declaration.
- Added Finance reconciliation review with full receipt/evidence visibility, Verify and complete, and Return reconciliation with mandatory correction remarks. Verification creates an idempotent Money In entry for returned balances and closes the request as `RECONCILED`; returned reconciliation goes back to `PENDING_RECONCILIATION`.
- Updated the Petty Cash progress tracker to end at Reconciliation and updated the implementation copy map. Focused TypeScript and ESLint pass.
- Fixed the Petty Cash reconciliation multi-file handler so `Promise.all` resolves before the synchronous React state updater runs. This removes TypeScript TS1308 (`await` inside a non-async state callback).
- Added a Claims-only Claim type filter to the unified Finance Pending Processing queue. The filter uses the canonical Claim type options, resets when switching payment tabs or clearing filters, and Claim type labels are searchable.
- Added Finance queue multi-selection with a sticky selection summary and a Previous/Next modal review flow. The overlay presents request information on the left and the payment-specific Finance action entry point on the right, preserving each workflow's existing approval, return, reference, receipt and accounting validation.
- Restyled and repositioned the Finance multi-selection controls to match Manager/Director: the selection footer now sits inside the queue card with a light background, compact Clear control and navy Review selected action; the floating navy total bar was removed.
- Reworked unified Finance modal processing: PV now shows its full payment, recipient, bank and breakdown details with an inline Finance panel, auto-uses the PV number as the payment reference, accepts a payment receipt and remarks, and generates without forcing a download. Invoice, Travel Allowance, Cash Advance, Petty Cash and Claims now render their existing detail-and-action Finance reviews inside the overlay instead of navigating to legacy bulk pages.
- Confirmed the Petty Cash Finance review uses the new reconciliation API: `verifyPettyCashReconciliation` calls `/finance-reconcile`. The live-project error was caused by an older copied Finance review that still imported the removed `completePettyCashReconciliation`; copying the latest generated review resolves the module export error.
- Audited legacy queue cleanup after the unified Manager/Director/Finance navigation. Payment-specific `*-queue.tsx` components and their list `page.tsx` routes are removal candidates only after all sidebar, back-link and bulk-link references are removed. Payment-specific `*-review.tsx` components must remain because the unified Finance overlay currently embeds them. Legacy bulk pages/components can be removed once the new shared batch confirmation overlay fully replaces their processing behavior.
- Optimized the unified Finance Pending Processing bundle by replacing eager imports of Invoice, Travel Allowance, Cash Advance, Petty Cash and Claims review components with Next.js dynamic imports. Each payment-specific review chunk now loads only when its overlay is opened, with an accessible loading state; PV remains inline because it is the default Finance tab.
- Simplified Finance overlays by replacing payment-progress timelines with a compact Current next process card across payment types. Reworked the PV detail column into Payment details, Recipient information and Payment breakdown cards with a clear grand total, while retaining Finance processing controls on the right.
- Moved Current next process into the right rail below each Finance action rather than above the request details. Added embedded-mode props to payment-specific Finance reviews to suppress legacy back links and timelines only inside the unified overlay. Consolidated the PV left column into one continuous bordered details panel.
- Refined the PV Finance modal to match the supplied reference: one rounded two-column body, compact unboxed detail rows on the left, a proper four-column payment-breakdown header, a pale Finance rail on the right, and a navy Generate PV action.
- Extracted the PV-specific Finance workflow and prototype layout from the unified queue into `payment-voucher/components/finance/finance-processing-panel.tsx` with its own CSS module. `finance-pending-processing.tsx` now only selects the voucher and imports the reusable panel, while the component owns payment date/reference, receipt, remarks, Generate PV, notification, signed-PV download and the next-process card. Removed the obsolete PV-only state, API calls and CSS from the queue component and updated the Finance copy guide.

## 2026-10-29 — Three-file TypeScript/ESLint cleanup

- Corrected the Payment Voucher Finance-information contract so the repository derives the payment reference from the stored PV submission number. The API no longer accepts an optional client-provided reference and therefore no longer conflicts with the repository input type.
- Documented the legacy Finance bulk Invoice fix: use `processInvoicePaymentByFinance(id, financeId, paymentDate, paymentReference)` instead of calling the two-argument completion API with three arguments. The completion notification must not fire at the processing stage.
- Exported the Cash Advance `parseSummary` helper and added support for Google Drive smart-chip labels, resolved URLs and normalized dash variants. Added the corresponding three-case unit test copy.
- Verification: `tsconfig.cash-advance.json` TypeScript check passed; `tsconfig.pv-database.json` TypeScript check passed. The live project's full ESLint command passed before preparing these copy-ready fixes. The generated workspace has no standalone ESLint command, so full-project TypeScript must be rerun after copying the files into the live project.

## 2026-10-29 — Payment Voucher amendment review and resubmission repair

- Rebuilt the Payment Voucher review presentation into the supplied compact prototype hierarchy: corrected details remain in a structured left column, while voucher total, amount in words, assigned Director, amendment notice and resubmission controls sit in a dedicated right rail.
- Preserved responsive behavior by collapsing the two-column review into one column on narrower screens.
- Fixed returned-PV resubmission for legacy GL codes such as `917-000`. Initial creation already permits a line whose database GL relation is unavailable while preserving its account code in the Payment Voucher snapshot; resubmission now follows the same rule instead of failing with `GL account ... was not found for this organization.`
- The existing PV number remains unchanged, the original requester and organization checks remain enforced, and resubmission still returns the request to the assigned Director.
- Verification: focused `tsconfig.pv-database.json` TypeScript check passed. ESLint passed for the review component, Prisma repository, resubmit route and create-flow component.

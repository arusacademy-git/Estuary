# PROJECT_MEMORY.md

## Durable Lessons
- 2026-08-12: Before linking an established local repository to an existing GitHub repository, verify both ancestry (`git merge-base`) and tree layout. GitHub had an unrelated upload history with the project nested under `Work - Estuary/`, so a normal PR was impossible. The safe recovery is a one-time branch from GitHub `main` that moves the project to root and overlays the verified local tree; after merge, all new work should branch from the normalized remote `main`.
- 2026-08-12: Local lock files do not coordinate contributors on different computers. For Estuary, use GitHub issues/assignees for scope ownership, separate branches for parallel work, and pull requests into protected `main` for integration. Keep `PROJECT_LOCK.md` non-blocking and compatibility-only.
- 2026-08-12: A registered project path must resolve to the directory containing both `.git` and the canonical project-control documents. Registering a wrapper folder while the repository is nested one level deeper creates split lock truth: Ground Control reads the wrapper lock while code sessions read the repository lock. Verify both roots during registration and keep only one canonical `PROJECT_LOCK.md`.
- 2026-03-28: Shared project-lock workspace template applied. Always read the control repo and `PROJECT_LOCK.md` before editing code.
- 2026-04-14: During the doc-first phase, generate `prisma/schema.prisma` directly from `docs/SCHEMA.md` instead of retyping the schema by hand. This keeps implementation aligned with reviewed schema revisions and avoids silent drift.
- 2026-04-14: If Playwright browsers are needed in this workspace, set `PLAYWRIGHT_BROWSERS_PATH=0` so browser downloads stay inside the project directory instead of writing to global cache paths.
- 2026-04-15: Treat workflow copy, email wording, and even theme direction as configuration surfaces. David explicitly does not want hardcoded product copy or rigid visual constants that make later change expensive.
- 2026-04-15: When David says "POC," verify whether he means a true browsable product surface. For Estuary, a single workbench screen was not enough; the prototype had to feel like a real routed app opened in the browser.
- 2026-04-15: In this Dropbox-backed workspace, Next dev can hit transient `EPERM` rename failures inside `.estuary-next/dev/` during Playwright web-server startup even when the test ultimately passes. Treat it as a local file-lock quirk before assuming app-level breakage.
- 2026-04-15: When real auth, SMTP, and storage are still absent, a local finance MVP can still prove the workflow by persisting state into project-local JSON, queuing email payloads into a local outbox folder, and exporting finished PDFs into a local runtime folder.
- 2026-04-16: In multi-agent merges, write E2E integration tests for new route families with explicit skip conditions tied to route existence. This keeps CI truthful (module missing is visible) without breaking unrelated smoke while feature branches converge.
- 2026-04-16: For this Dropbox-backed workspace, run Playwright against `pnpm build && pnpm start` instead of `next dev` when reliability matters; it avoids intermittent dev-manifest rename `EPERM` failures.
- 2026-04-16: Payment-request create flow requires both `Title` and `Recipient name`; E2E tests must fill both required fields or navigation assertions will fail on client-side validation.
- 2026-04-23: Historical rule: project close-out previously updated `PROJECT_LOCK.md`, `PROJECT_HISTORY.md`, and `AI_HANDOFF.md` together. Superseded for Estuary on 2026-08-12 by GitHub issue/branch/PR coordination; the lock is now compatibility-only.
- 2026-07-06: Docker Desktop is not installed on this machine, but Prisma migrations can still be authored and truly verified without it: generate SQL offline with `prisma migrate diff --from-empty --to-schema-datamodel`, then run `prisma migrate deploy` against a throwaway instance from the `embedded-postgres` npm package in a scratch directory. No system install, no leftover state.
- 2026-07-06: Multiple workspace projects compete for port 3000 (Layar's Next server commonly holds it). Estuary's Playwright config now reads `E2E_PORT`; run e2e with an off-default port instead of killing sibling servers.

## Known Failure Modes
- Dropbox or other sync/file-lock activity may interfere with Next dev temp-file renames during automated browser runs.

## Reusable Patterns
- Use a seeded bootstrap vertical slice to prove `web` / `api` / `domain` / `data` boundaries before real business workflows are ready.
- For local POCs, use a dummy-auth operator workbench plus config repositories to prove policy and workflow shape before real auth and persistence are wired.
- If the user wants a convincing prototype quickly, keep config-driven business state underneath but move the surface into real app navigation early: dashboard, queue views, detail pages, and a shared shell read as "product" much faster than one oversized settings surface.

## Decision Log
- 2026-08-12: Estuary retired exclusive project locking in favor of GitHub-first team collaboration.
- 2026-03-28: This repo adopted the unified multi-agent project-lock workspace structure; superseded for Estuary collaboration on 2026-08-12.

## Do Not Repeat
- Record recurring mistakes and how to avoid them.
- Do not let `AI_HANDOFF.md` and `PROJECT_ROADMAP.md` lag behind the current schema version; stale version markers create false blockers.
- Do not close out a session with feature work sitting uncommitted. The April payment-request module (~3,900 lines) sat as untracked files for 2.5 months across a lock release and reacquisition; `git status` must be clean (or intentionally documented) before release.

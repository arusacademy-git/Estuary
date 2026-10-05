# Estuary

Estuary is an internal finance operations hub for Arus. It is replacing the current mix of Google Forms, Google Sheets, petty cash spreadsheets, and eventually Kakitangan with one API-first system that owns the full money-out lifecycle.

The repo now contains a browsable local payment-voucher MVP rather than a single-page workspace shell. It demonstrates dummy sign-in, route-level navigation, submitter-selected approvers, urgent bypass handling, a local file-backed workflow state, multi-line voucher issuing, director signature approval, finance payment capture, recipient signature collection, staff verification, queued email outbox files, and both draft and complete payment-voucher PDF export.

## Current Prototype

- Next.js 16 + TypeScript app-router build
- Docker-based local app + PostgreSQL runtime
- Prisma initialized from the locked schema document
- Routed payment-voucher prototype:
  - `/dashboard`
  - `/payment-requests`
  - `/payment-requests/new`
  - `/payment-requests/[id]`
  - `/payment-vouchers/new`
  - `/payment-vouchers/[id]`
  - `/approvals`
  - `/finance`
  - `/settings`
  - `/recipient/[token]`
- Payment-request module (invoice, claims, travel allowance, cash advance) now has list/create/detail routes, action APIs, local persistence, and E2E smoke coverage at `tests/e2e/payment-requests.spec.ts`
- Bootstrap API at `/api/v1/system/bootstrap`
- Prototype workspace API at `/api/v1/prototype/workspace`
- Payment-voucher PDF export API at `/api/v1/prototype/payment-voucher-pdf`
- Workflow action API at `/api/v1/prototype/workflow`
- Dummy sign-in and config-driven reference data collections
- Local file-backed workflow state in `runtime/prototype/state.json`
- Multi-line payment-voucher composer with calculated totals and row controls
- Director approval capture with signature text
- Finance payment capture with payment date, reference, and receipt link
- Recipient signature route with queued email handoff
- Staff verification handoff back to finance
- Draft PDF generation in-browser plus complete voucher export into `runtime/prototype/exports`
- Worker and MCP entrypoints stubbed for later phases

## Local Run

1. Copy `.env.example` to `.env`
2. Fill only the values you actually want live for the POC
3. Install dependencies: `corepack pnpm install`
4. Start PostgreSQL with Docker: `docker compose up db -d`
5. Apply migrations: `corepack pnpm exec prisma migrate deploy` (initial migration lives at `prisma/migrations/20260706000000_init`)
6. Validate Prisma: `corepack pnpm db:validate`
7. Start the app: `corepack pnpm dev`

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the prototype UI.

## Minimal Server Run

To run the current prototype as one application container while keeping an
existing PostgreSQL installation, follow
[`docs/SERVER_DEPLOYMENT.md`](docs/SERVER_DEPLOYMENT.md). The server Compose
file does not create a PostgreSQL container.

Interns should follow
[`docs/INTERN_UPDATE_GUIDE.md`](docs/INTERN_UPDATE_GUIDE.md) to recover
unpushed work, submit changes through pull requests, and update the Penang
server after an approved merge.

## Verification

- Lint: `corepack pnpm lint`
- Type-check: `corepack pnpm typecheck`
- Unit tests: `corepack pnpm test`
- E2E smoke: `corepack pnpm test:e2e`
- Build: `corepack pnpm build`
- Prisma validate: `corepack pnpm db:validate`
- Playwright web-server runs via `corepack pnpm build && corepack pnpm start` for stability in this Dropbox-backed workspace.
- If port 3000 is taken by another local app, run E2E on another port: set `E2E_PORT` (e.g. `3131`) before `corepack pnpm test:e2e`.

## Team Collaboration

- GitHub issues and assignees define who owns each piece of work.
- Use a separate descriptive branch for each issue or coherent change; never work directly on `main`.
- Open a pull request into `main` when the branch is ready for review.
- Multiple contributors can work in parallel on different scopes. Coordinate early when touching the same files because edits to the same lines may require conflict resolution.
- Pull the latest `main` before starting work and refresh long-running branches before merge.
- `PROJECT_LOCK.md` is a non-blocking Ground Control compatibility file, not a team-wide ownership lock.

## Structure

- `src/app/` - web UI and route handlers
- `src/domain/` - view models and workflow-facing composition
- `src/data/` - config repositories and seed data
- `src/lib/` - shared runtime and template helpers
- `src/worker/` - background worker entrypoint
- `src/mcp/` - MCP server entrypoint
- `prisma/` - database schema and migrations
- `docs/ESTUARY_OVERVIEW.html` - self-contained overview and development-history page (open directly in a browser)

## Prototype Principles

- Workflow and copy should be driven by configuration, not hardcoded strings.
- Reference data should be addable and changeable without reworking code shape.
- Theme, labels, and templates must stay easy to evolve.
- A local POC should still feel like a real product surface: routed, browsable, and understandable without opening developer tooling.
- The local POC can use dummy sign-in and staged integrations as long as the architecture leaves room to grow.

## Current Status

- Payment voucher MVP flow now works locally through issue -> director approval -> finance payment -> recipient signature -> staff verification -> export
- Payment-request module flow (browse -> create -> detail route) is covered in Playwright and currently passing
- Real Google OAuth and AWS integrations are still deferred
- SQL Account export sample remains a later blocker for Phase 6
- Petty cash confirmation remains a later blocker for Phase 5

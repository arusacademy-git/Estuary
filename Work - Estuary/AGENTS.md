# AGENTS.md

## Project Summary
- Project Name: Estuary
- Project ID: estuary
- Repo Mode: team-github
- Goal: Centralized internal finance operations hub for Arus (group of companies). Replaces Google Sheets PV system, Google Forms payment submissions, petty cash spreadsheet, and eventually Kakitangan. Manages the full money-out lifecycle for 6 payment types. API-first, MCP-capable, multi-entity from day one.

## Stack (Locked)
- **Frontend + API**: Next.js (TypeScript), API routes under `/api/v1/`
- **MCP Server**: `@modelcontextprotocol/sdk` (TypeScript), same monorepo
- **Database**: PostgreSQL on AWS RDS (db.t4g.micro)
- **ORM**: Prisma
- **Auth — web**: NextAuth.js + Google OAuth (SSO, organization switcher)
- **Auth — API/MCP**: API keys (`X-API-Key` header, scoped per client)
- **Email**: AWS SES (domain already configured)
- **File Storage**: AWS S3
- **PDF Generation**: React-PDF or Puppeteer (server-side)
- **Containerization**: Docker from day one (Lightsail now → ECS when commercializing)
- **Deployment**: AWS Lightsail (2GB) ~$10/month

## Payment Types
| Type | Approval | Notes |
|------|----------|-------|
| Payment Voucher | Director (1 step) | Phase 2 MVP priority |
| Invoice Payment | None (direct to payment) | Phase 5 |
| Cash Advance | Manager → Director (2 steps) | 3-checkpoint reconciliation; Phase 4 |
| Travel Allowance | Manager → Director (2 steps) | Phase 4 |
| Expense Claim | None (direct to payment) | Phase 5; Kakitangan until mid-2027 |
| Petty Cash Top-up | Manager → Director (2 steps) | Phase 5; OQ-PettyCashConfirm pending |

## Run, Test, And Format Commands
- Package manager: pnpm
- Run: `pnpm dev`
- Build: `pnpm build`
- Install: `pnpm install`
- Test: `pnpm test` (Vitest — once scaffolded)
- E2E: `pnpm test:e2e` (Playwright — once scaffolded)
- Format: `pnpm format` (Prettier)
- Lint: `pnpm lint` (ESLint)

## Constraints
- Multi-entity from day one: Organization is the top-level partition for all financial data
- API-first: every action must have a REST endpoint; web UI is one consumer, not the only one
- MCP server wraps the REST API; it does not bypass it
- Approval is per payment type, not amount tiers
- Email-only channel for external communications (approvals, PV collection, reminders)
- SES is already configured — do not introduce a second email provider
- S3 for all file storage — no Google Drive
- Signed PV collection links (external recipients only) use one-time tokenised email links — no login required
- Internal approval actions (Director, Manager) require SSO-authenticated session — email is notification only, not auth
- SQL Account CSV format must be locked to a real sample file before the export module is built

## Architecture Notes
- See `docs/SOFTWARE_SCOPE.md` for full scope, module breakdown, phasing, and open questions
- See `docs/SCHEMA.md` v2.1 for the Prisma schema
- Workflow state: `current_state_code` (type-prefixed string e.g. "PV_DRAFT") + `current_state_group` (reporting enum). Every state change writes an immutable `SubmissionTransition` row.
- Internal approvals (Director, Manager) require SSO-authenticated session — no token links. Email notifications are deep-links to the approval page only.
- External recipients (PV signature) use `ExternalActionToken` — one-use, SHA-256 hashed, bound to email, expiring.
- Travel Allowance and Cash Advance: sequential 2-step approval (Manager → Director); both steps require authenticated session
- Cash Advance: 2-step approval + 3-checkpoint reconciliation (2w/3w/4w); overspend creates parent-child CA link
- Unreconciled CA past Checkpoint 3 blocks the submitter from all new CA submissions in that org
- Multi-entity model: Organization → UserOrgMembership → User (many-to-many with role)
- A user can hold multiple roles in the same org (e.g. MANAGER + PETTY_CASH_CUSTODIAN)
- Every submission = shared header (Submission) + type-specific detail table (1:1) + line items
- 4 transaction dimensions: Agent (header) + Area (header) + GL Code (line) + Project (line) — mirrors SQL Account
- User defaults: agent and area stored on UserOrgMembership; pre-fill submission form
- Batch (mass) PV creation: Batch entity groups N submissions; one approval, N emails — Phase 3 (after core PV lifecycle validated in production)
- Docker from day one: migrate from Lightsail to ECS without code changes when commercializing

## Project-Lock Notes
- Read `PROJECT_LOCK.md` before editing code.
- Treat project ownership as primary; task files are optional support artifacts.
- Use `PROJECT_ROADMAP.md` for future features and deferred work.

## Conventions
- Root-cause fixes over patches.
- Treat `README.md` as a human-facing GitHub document.
- Update `AI_HANDOFF.md` every session.
- Update `PROJECT_MEMORY.md` only for durable lessons and reusable methodology.
- Update `PROJECT_ROADMAP.md` when you discover future work or better sequencing.
- Follow local `.prettierrc` and `.eslintrc.json` over AI defaults.

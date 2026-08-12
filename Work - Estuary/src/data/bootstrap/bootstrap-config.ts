import type { BootstrapConfig } from '@/domain/bootstrap/types';

export const bootstrapConfig: BootstrapConfig = {
  brand: 'Estuary',
  statusLabel: 'Phase 0 Prototype',
  headline: 'Finance operations, designed as one controlled flow instead of six improvised systems.',
  summary:
    'This prototype proves the runtime, layering, and visual direction before payment workflows go live. It exposes the locked stack, the current readiness posture, and the intended shape of the money-out control surface.',
  metrics: [
    {
      label: 'Payment types',
      value: '6',
      detail: 'PV, invoice, cash advance, travel, claims, and petty cash.',
    },
    {
      label: 'Approval modes',
      value: '3',
      detail: 'No approval, director-only, or manager to director.',
    },
    {
      label: 'Runtime layers',
      value: '6',
      detail: 'web, api, domain, data, worker, and integration boundaries.',
    },
    {
      label: 'Immediate focus',
      value: 'Phase 0',
      detail: 'Infrastructure scaffold and discovery outputs before workflow coding.',
    },
  ],
  capabilityColumns: [
    {
      eyebrow: 'Operating Surface',
      title: 'What this prototype already proves',
      items: [
        {
          label: 'Single source shell',
          detail: 'One app surface now reflects the whole system direction instead of scattered docs.',
        },
        {
          label: 'Shared vertical slice',
          detail: 'The homepage and the REST endpoint resolve through the same domain service.',
        },
        {
          label: 'Locked boundaries',
          detail: 'Project structure now separates web, api, domain, worker, and data concerns.',
        },
      ],
    },
    {
      eyebrow: 'Phase 1 Readiness',
      title: 'What is intentionally staged next',
      items: [
        {
          label: 'Prisma-first data model',
          detail: 'Schema bootstrap is in place so migrations and seeds can follow immediately.',
        },
        {
          label: 'Worker and MCP entrypoints',
          detail: 'Both are stubbed so the API-first architecture can expand without repo churn.',
        },
        {
          label: 'Runtime contract',
          detail: 'Env structure is documented now, before auth, SES, and S3 are wired for real.',
        },
      ],
    },
  ],
  workflowStages: [
    {
      code: 'SUBMIT',
      title: 'Draft to validated submission',
      detail: 'Org-scoped forms and typed contracts replace Google Forms drift.',
    },
    {
      code: 'APPROVE',
      title: 'Authenticated internal approvals',
      detail: 'Director and manager actions stay inside SSO sessions, never email tokens.',
    },
    {
      code: 'ISSUE',
      title: 'Numbered document generation',
      detail: 'Issued artifacts and immutable transitions become first-class records.',
    },
    {
      code: 'COLLECT',
      title: 'Recipient action and reminders',
      detail: 'External signature flows remain tokenized, monitored, and expirable.',
    },
    {
      code: 'CLOSE',
      title: 'Processing, export, and audit',
      detail: 'Every state change lands in one ledger-ready system instead of manual reconciliation.',
    },
  ],
  nextActions: [
    'Run Prisma validation and generate the client from the locked schema.',
    'Collect the real approval matrix, exception policy, and live process samples.',
    'Start Phase 1 with auth, org membership provisioning, and workflow seeding.',
  ],
  technicalNotes: [
    'The prototype UI is seeded and non-authoritative by design.',
    'The schema source of truth remains docs/SCHEMA.md and is copied into prisma/schema.prisma.',
    'No payment workflow is marked complete until the Phase 0 discovery blockers are resolved.',
  ],
};

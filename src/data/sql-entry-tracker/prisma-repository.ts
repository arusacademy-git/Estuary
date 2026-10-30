import type { SqlEntryStatus } from '@prisma/client';

import type { SqlEntryTrackingEntry } from '@/domain/sql-entry-tracker/types';
import { prisma } from '@/lib/db/prisma';

async function requireFinanceMembership(userId: string) {
  const membership = await prisma.userOrgMembership.findFirst({
    where: {
      user_id: userId,
      is_active: true,
      membership_status: 'ACTIVE',
      roles: { some: { role: 'FINANCE_ADMIN' } },
    },
    select: { organization_id: true },
  });

  if (!membership) throw new Error('An active Finance membership is required.');
  return membership;
}

function mapEntry(entry: {
  submission_id: string;
  status: SqlEntryStatus;
  sql_reference: string | null;
  recorded_at: Date | null;
  notes: string | null;
  updated_at: Date;
  updated_by: { name: string } | null;
}): SqlEntryTrackingEntry {
  return {
    submissionId: entry.submission_id,
    status: entry.status,
    sqlReference: entry.sql_reference ?? '',
    recordedAt: entry.recorded_at?.toISOString().slice(0, 10) ?? '',
    notes: entry.notes ?? '',
    updatedByName: entry.updated_by?.name ?? '',
    updatedAt: entry.updated_at.toISOString(),
  };
}

const entrySelect = {
  submission_id: true,
  status: true,
  sql_reference: true,
  recorded_at: true,
  notes: true,
  updated_at: true,
  updated_by: { select: { name: true } },
} as const;

export async function listSqlEntryTrackingFromDatabase(userId: string) {
  const membership = await requireFinanceMembership(userId);
  const entries = await prisma.sqlEntryTracking.findMany({
    where: { submission: { organization_id: membership.organization_id } },
    orderBy: { updated_at: 'desc' },
    select: entrySelect,
  });
  return entries.map(mapEntry);
}

export async function upsertSqlEntryTrackingInDatabase(input: {
  userId: string;
  submissionId: string;
  status: SqlEntryStatus;
  sqlReference?: string;
  recordedAt?: string;
  notes?: string;
}) {
  const membership = await requireFinanceMembership(input.userId);
  const submission = await prisma.submission.findFirst({
    where: { id: input.submissionId, organization_id: membership.organization_id },
    select: { id: true },
  });
  if (!submission) throw new Error('The selected payment record was not found.');

  const isRecorded = input.status === 'RECORDED_IN_SQL_SYSTEM';
  const sqlReference = input.sqlReference?.trim() ?? '';
  if (isRecorded && !sqlReference) {
    throw new Error('SQL reference number is required when the payment is recorded.');
  }
  if (isRecorded && !input.recordedAt) {
    throw new Error('Recorded date is required when the payment is recorded.');
  }

  const data = {
    status: input.status,
    sql_reference: isRecorded ? sqlReference : null,
    recorded_at: isRecorded ? new Date(`${input.recordedAt}T00:00:00.000Z`) : null,
    notes: input.notes?.trim() || null,
    updated_by_id: input.userId,
  };
  const entry = await prisma.sqlEntryTracking.upsert({
    where: { submission_id: input.submissionId },
    create: { submission_id: input.submissionId, ...data },
    update: data,
    select: entrySelect,
  });
  return mapEntry(entry);
}

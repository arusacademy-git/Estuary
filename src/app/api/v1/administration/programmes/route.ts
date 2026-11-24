import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import { betaAccounts } from '@/lib/auth/beta-accounts';
import { createDefaultAdminSettings } from '@/features/administration/admin-settings';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const programmeSchema = z.object({
  id: z.string().trim().min(1),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  managerId: z.string().trim(),
  active: z.boolean(),
});
const updateSchema = z.object({
  actorId: z.string().trim().min(1),
  programmes: z.array(programmeSchema).min(1).max(200),
});

export async function GET() {
  try {
    const rows = await prisma.betaProgramme.findMany({ orderBy: { code: 'asc' } });
    return dataResponse(rows.length
      ? rows.map((row) => ({ id: row.id, code: row.code, name: row.name, managerId: row.manager_id ?? '', active: row.is_active }))
      : createDefaultAdminSettings().programmes);
  } catch {
    return Response.json({ message: 'Shared programme settings could not be loaded.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: 'The programme directory is invalid.' }, { status: 400 });
  const { actorId, programmes } = parsed.data;
  if (!betaAccounts.some((account) => account.id === actorId && account.isAdministrator)) {
    return Response.json({ message: 'Administrator access required.' }, { status: 403 });
  }
  const ids = new Set(programmes.map((item) => item.id));
  const codes = new Set(programmes.map((item) => item.code.toUpperCase()));
  if (ids.size !== programmes.length || codes.size !== programmes.length || programmes.some((item) => item.managerId && !betaAccounts.some((account) => account.id === item.managerId))) {
    return Response.json({ message: 'Programme codes, IDs and Manager accounts must be valid and unique.' }, { status: 400 });
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.betaProgramme.deleteMany();
      await tx.betaProgramme.createMany({ data: programmes.map((item) => ({
        id: item.id,
        code: item.code.toUpperCase(),
        name: item.name,
        manager_id: item.managerId || null,
        is_active: item.active,
      })) });
    });
    return dataResponse(programmes);
  } catch {
    return Response.json({ message: 'The programme directory could not be saved.' }, { status: 503 });
  }
}

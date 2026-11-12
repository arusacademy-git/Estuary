import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

const notificationSchema = z.object({
  id: z.string().min(1).max(100),
  recipientId: z.string().min(1).max(100),
  actorId: z.string().max(100).optional(),
  type: z.string().min(1).max(100),
  entityType: z.string().min(1).max(100),
  entityId: z.string().min(1).max(100),
  referenceNumber: z.string().max(100),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  href: z.string().startsWith('/beta/').max(500),
});

function present(
  row: Awaited<ReturnType<typeof prisma.inAppNotification.findMany>>[number]
) {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id ?? undefined,
    type: row.type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    referenceNumber: row.reference_number,
    title: row.title,
    message: row.message,
    href: row.href,
    readAt: row.read_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

export async function GET(request: Request) {
  const recipientId = new URL(request.url).searchParams.get('recipientId');
  if (!recipientId)
    return Response.json(
      { message: 'recipientId is required.' },
      { status: 400 }
    );
  try {
    const rows = await prisma.inAppNotification.findMany({
      where: { recipient_id: recipientId },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    return Response.json({ data: rows.map(present) });
  } catch {
    return Response.json(
      { message: 'Notifications could not be loaded.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const parsed = notificationSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success)
    return Response.json({ message: 'Invalid notification.' }, { status: 400 });
  const item = parsed.data;
  try {
    const row = await prisma.inAppNotification.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        recipient_id: item.recipientId,
        actor_id: item.actorId,
        type: item.type,
        entity_type: item.entityType,
        entity_id: item.entityId,
        reference_number: item.referenceNumber,
        title: item.title,
        message: item.message,
        href: item.href,
      },
      update: {},
    });
    if (row.recipient_id !== item.recipientId)
      return Response.json(
        { message: 'Notification ID conflict.' },
        { status: 409 }
      );
    return Response.json({ data: present(row) }, { status: 201 });
  } catch {
    return Response.json(
      { message: 'Notification could not be saved.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const parsed = z
    .object({ recipientId: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { message: 'recipientId is required.' },
      { status: 400 }
    );
  try {
    await prisma.inAppNotification.updateMany({
      where: { recipient_id: parsed.data.recipientId, read_at: null },
      data: { read_at: new Date() },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { message: 'Notifications could not be updated.' },
      { status: 500 }
    );
  }
}

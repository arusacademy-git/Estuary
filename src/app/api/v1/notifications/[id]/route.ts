import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';

type Context = { params: Promise<{ id: string }> };
const bodySchema = z.object({ recipientId: z.string().min(1) });

export async function PATCH(request: Request, context: Context) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { message: 'recipientId is required.' },
      { status: 400 }
    );
  const { id } = await context.params;
  try {
    const result = await prisma.inAppNotification.updateMany({
      where: { id, recipient_id: parsed.data.recipientId, read_at: null },
      data: { read_at: new Date() },
    });
    return Response.json({ ok: result.count > 0 });
  } catch {
    return Response.json(
      { message: 'Notification could not be updated.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: Context) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { message: 'recipientId is required.' },
      { status: 400 }
    );
  const { id } = await context.params;
  try {
    const result = await prisma.inAppNotification.deleteMany({
      where: { id, recipient_id: parsed.data.recipientId },
    });
    return Response.json({ ok: result.count > 0 });
  } catch {
    return Response.json(
      { message: 'Notification could not be deleted.' },
      { status: 500 }
    );
  }
}

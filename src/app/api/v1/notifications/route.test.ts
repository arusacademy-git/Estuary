import { beforeEach, describe, expect, it, vi } from 'vitest';

const rows = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    inAppNotification: {
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { id: string };
          create: Record<string, unknown>;
        }) => {
          if (!rows.has(where.id))
            rows.set(where.id, {
              ...create,
              created_at: new Date('2026-11-11T00:00:00Z'),
              read_at: null,
            });
          return rows.get(where.id);
        }
      ),
      findMany: vi.fn(async ({ where }: { where: { recipient_id: string } }) =>
        [...rows.values()].filter(
          (row) => row.recipient_id === where.recipient_id
        )
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { recipient_id: string; read_at: null };
          data: { read_at: Date };
        }) => {
          let count = 0;
          for (const row of rows.values())
            if (row.recipient_id === where.recipient_id && !row.read_at) {
              row.read_at = data.read_at;
              count += 1;
            }
          return { count };
        }
      ),
    },
  },
}));

import { GET, PATCH, POST } from './route';

const notification = {
  id: 'test-notification-1',
  recipientId: 'afiq-rahman',
  actorId: 'siti-farhana',
  type: 'INVOICE_PAYMENT_RETURNED',
  entityType: 'INVOICE_PAYMENT',
  entityId: 'test-invoice-1',
  referenceNumber: 'IV26-11-05',
  title: 'Invoice Payment returned for correction',
  message: 'Finance returned IV26-11-05.',
  href: '/beta/payment-records/invoice-payments/test-invoice-1',
};

describe('shared in-app notifications', () => {
  beforeEach(() => rows.clear());

  it('delivers a Finance return to the intended recipient and keeps read state', async () => {
    const created = await POST(
      new Request('http://localhost/api/v1/notifications', {
        method: 'POST',
        body: JSON.stringify(notification),
      })
    );
    expect(created.status).toBe(201);

    const staff = await GET(
      new Request(
        'http://localhost/api/v1/notifications?recipientId=afiq-rahman'
      )
    );
    const finance = await GET(
      new Request(
        'http://localhost/api/v1/notifications?recipientId=siti-farhana'
      )
    );
    expect((await staff.json()).data).toMatchObject([
      { referenceNumber: 'IV26-11-05' },
    ]);
    expect((await finance.json()).data).toEqual([]);

    await PATCH(
      new Request('http://localhost/api/v1/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ recipientId: 'afiq-rahman' }),
      })
    );
    const reread = await GET(
      new Request(
        'http://localhost/api/v1/notifications?recipientId=afiq-rahman'
      )
    );
    expect((await reread.json()).data[0].readAt).toBeTruthy();
  });

  it('rejects external links in notification payloads', async () => {
    const result = await POST(
      new Request('http://localhost/api/v1/notifications', {
        method: 'POST',
        body: JSON.stringify({ ...notification, href: 'https://example.com' }),
      })
    );
    expect(result.status).toBe(400);
  });
});

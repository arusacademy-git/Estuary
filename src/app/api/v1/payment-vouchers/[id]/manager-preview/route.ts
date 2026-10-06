import { z } from 'zod';

import {
  markPaymentVoucherManagerViewedInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const managerPreviewSchema = z.object({
  managerId: z.string().trim().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = managerPreviewSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_MANAGER_PREVIEW',
        message: 'Project Manager information is required.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const voucher = await markPaymentVoucherManagerViewedInDatabase(
      decodeURIComponent(id),
      parsed.data.managerId,
    );

    return dataResponse(voucher);
  } catch (error) {
    console.error('Unable to save Project Manager preview in PostgreSQL.', error);

    const message =
      error instanceof Error
        ? error.message
        : 'The Project Manager preview could not be saved.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('another Project Manager') ||
          message.includes('not an active Manager')
        ? 403
        : 409;

    return Response.json(
      {
        error: 'MANAGER_PREVIEW_FAILED',
        message,
      },
      { status },
    );
  }
}

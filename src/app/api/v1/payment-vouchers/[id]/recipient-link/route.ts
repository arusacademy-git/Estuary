import { z } from 'zod';

import {
  issuePaymentVoucherRecipientLinkInDatabase,
} from '@/data/payment-vouchers/prisma-payment-voucher-repository';
import { dataResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const issueRecipientLinkSchema = z.object({
  requesterId: z.string().trim().min(1),
});

export async function POST(request: Request, context: RouteContext) {
  const parsed = issueRecipientLinkSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: 'INVALID_REQUESTER',
        message: 'Requester information is required.',
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await context.params;
    const issuedLink = await issuePaymentVoucherRecipientLinkInDatabase(
      decodeURIComponent(id),
      parsed.data.requesterId,
    );

    return dataResponse(issuedLink);
  } catch (error) {
    console.error('Unable to issue the secure recipient link.', error);

    const message =
      error instanceof Error
        ? error.message
        : 'The secure recipient link could not be issued.';

    const status = message.includes('could not be found')
      ? 404
      : message.includes('not an active member') ||
          message.includes('Only the original submitter')
        ? 403
        : message.includes('email address is missing')
          ? 400
          : 409;

    return Response.json(
      {
        error: 'ISSUE_RECIPIENT_LINK_FAILED',
        message,
      },
      { status },
    );
  }
}

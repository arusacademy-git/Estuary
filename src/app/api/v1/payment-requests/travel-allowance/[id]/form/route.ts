import { buildTravelAllowancePdf } from '@/features/payment-request/pdf/travel-allowance/build-travel-allowance-pdf';
import { getTravelAllowanceFromDatabase } from '@/data/payment-requests/travel-allowance/prisma-repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const record = await getTravelAllowanceFromDatabase(decodeURIComponent(id));
    if (!record) return Response.json({ error: 'TRAVEL_ALLOWANCE_NOT_FOUND', message: 'Travel Allowance could not be found.' }, { status: 404 });
    if (!['PENDING_FINANCE_VERIFICATION', 'COMPLETED'].includes(record.status)) {
      return Response.json({ error: 'TRAVEL_ALLOWANCE_NOT_APPROVED', message: 'The form is available after Director approval.' }, { status: 409 });
    }

    const bytes = await buildTravelAllowancePdf(record);
    const download = new URL(request.url).searchParams.get('download') === '1';
    const disposition = download ? 'attachment' : 'inline';
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${record.requestNumber}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({ error: 'TRAVEL_ALLOWANCE_PDF_FAILED', message: error instanceof Error ? error.message : 'The TA form could not be generated.' }, { status: 500 });
  }
}

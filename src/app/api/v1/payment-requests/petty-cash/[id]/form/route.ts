import { getPettyCashFromDatabase } from '@/data/payment-requests/petty-cash/prisma-repository';
import { buildPettyCashPdf } from '@/features/payment-request/pdf/petty-cash/build-petty-cash-pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const record = await getPettyCashFromDatabase(decodeURIComponent(id));
    if (!record) {
      return Response.json(
        { error: 'PETTY_CASH_NOT_FOUND', message: 'Petty Cash request could not be found.' },
        { status: 404 },
      );
    }
    const bytes = await buildPettyCashPdf(record);
    const download = new URL(request.url).searchParams.get('download') === '1';
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${record.requestNumber}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: 'PETTY_CASH_PDF_FAILED',
        message: error instanceof Error ? error.message : 'The Petty Cash form could not be generated.',
      },
      { status: 500 },
    );
  }
}

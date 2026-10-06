import { getClaimFromDatabase } from '@/data/payment-requests/claims/prisma-repository';
import { buildClaimPdf } from '@/features/payment-request/pdf/claims/build-claim-pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const record = await getClaimFromDatabase(decodeURIComponent(id));
    if (!record) {
      return Response.json(
        { error: 'CLAIM_NOT_FOUND', message: 'The Claim request could not be found.' },
        { status: 404 },
      );
    }
    const bytes = await buildClaimPdf(record);
    const download = new URL(request.url).searchParams.get('download') === '1';
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${record.claimNumber}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: 'CLAIM_PDF_FAILED',
        message: error instanceof Error ? error.message : 'The Claim form could not be generated.',
      },
      { status: 500 },
    );
  }
}
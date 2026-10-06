import { getClaimFromDatabase } from '@/data/payment-requests/claims/prisma-repository';
import { buildClaimPdf } from '@/features/payment-request/pdf/claims/build-claim-pdf';
import { dataResponse } from '@/lib/api/response';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const record = await getClaimFromDatabase(decodeURIComponent(id));
    if (!record) return Response.json({ message: 'Claim request not found.' }, { status: 404 });

    const query = new URL(request.url).searchParams;
    if (query.get('form') === '1') {
      const bytes = await buildClaimPdf(record);
      const download = query.get('download') === '1';
      return new Response(Buffer.from(bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${record.claimNumber}.pdf"`,
          'Cache-Control': 'private, no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    return dataResponse(record);
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : 'The Claim could not be loaded.' }, { status: 500 });
  }
}

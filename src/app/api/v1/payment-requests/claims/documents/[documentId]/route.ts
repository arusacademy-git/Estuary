import { readClaimReceiptFromDatabase } from '@/data/payment-requests/claims/prisma-repository';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await context.params;
  const userId = new URL(request.url).searchParams.get('userId') ?? '';
  if (!userId) return Response.json({ message: 'A signed-in user is required.' }, { status: 400 });
  try {
    const result = await readClaimReceiptFromDatabase(documentId, userId);
    if (!result) return Response.json({ message: 'Claim receipt not found.' }, { status: 404 });
    const safeName = result.document.original_file_name.replaceAll(/[\r\n"]/g, '_');
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        'Content-Type': result.document.mime_type ?? 'application/octet-stream',
        'Content-Length': String(result.bytes.length),
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : 'The receipt could not be opened.' }, { status: 403 });
  }
}

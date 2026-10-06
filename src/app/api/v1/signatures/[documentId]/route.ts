import { readSignatureDocument } from '@/data/signatures/prisma-signature-repository';
type Context = { params: Promise<{ documentId: string }> };
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: Context) {
    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) return Response.json({ message: 'Signature owner is required.' }, { status: 400 });
    try {
        const { documentId } = await context.params;
        const result = await readSignatureDocument(decodeURIComponent(documentId), userId);
        if (!result) return Response.json({ message: 'Signature image could not be found.' }, { status: 404 });
        return new Response(new Uint8Array(result.bytes), { headers: { 'Content-Type': result.document.mime_type ?? 'image/png', 'Content-Disposition': `inline; filename="${result.document.original_file_name.replaceAll('"', '')}"`, 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        console.error('Signature image could not be read.', error);
        return Response.json({ message: 'Signature image could not be read.' }, { status: 500 });
    }
}

import { z } from 'zod';
import { dataResponse } from '@/lib/api/response';
import { deactivateUserSignatureInDatabase, getActiveUserSignatureFromDatabase, saveUserSignatureInDatabase } from '@/data/signatures/prisma-signature-repository';

export const dynamic = 'force-dynamic';
const identity = z.object({ organizationId: z.string().min(1), userId: z.string().min(1) });
const upload = identity.extend({ fileName: z.string().min(1), mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']), fileSize: z.number().int().positive().max(300 * 1024), dataUrl: z.string().min(1) });
function failure(error: unknown) { console.error('Signature database operation failed.', error); return Response.json({ error: 'SIGNATURE_OPERATION_FAILED', message: error instanceof Error ? error.message : 'The signature operation failed.' }, { status: 409 }); }

export async function GET(request: Request) {
    const url = new URL(request.url); const parsed = identity.safeParse({ organizationId: url.searchParams.get('organizationId'), userId: url.searchParams.get('userId') });
    if (!parsed.success) return Response.json({ message: 'Organization and user are required.' }, { status: 400 });
    try { return dataResponse(await getActiveUserSignatureFromDatabase(parsed.data.organizationId, parsed.data.userId)); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
    const parsed = upload.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Select a valid signature image smaller than 300 KB.', details: parsed.error.flatten() }, { status: 400 });
    try { return dataResponse(await saveUserSignatureInDatabase(parsed.data), { status: 201 }); } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
    const parsed = identity.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: 'Organization and user are required.' }, { status: 400 });
    try { await deactivateUserSignatureInDatabase(parsed.data.organizationId, parsed.data.userId); return dataResponse({ removed: true as const }); } catch (error) { return failure(error); }
}

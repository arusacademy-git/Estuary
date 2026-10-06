import { getCashAdvanceFromDatabase } from '@/data/payment-requests/cash-advance/prisma-cash-advance-repository';
import { readSignatureDocument } from '@/data/signatures/prisma-signature-repository';
import { buildCashAdvancePdf, type CashAdvancePdfForm, type CashAdvancePdfSignature } from '@/features/payment-request/pdf/cash-advance/build-cash-advance-pdf';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };
const forms = new Set<CashAdvancePdfForm>(['request', 'summary', 'participant', 'pack']);

async function signature(documentId: string | undefined, userId: string): Promise<CashAdvancePdfSignature | undefined> {
  if (!documentId) return undefined;
  const result = await readSignatureDocument(documentId, userId);
  if (!result) return undefined;
  return { bytes: result.bytes, mimeType: result.document.mime_type ?? 'image/png' };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const record = await getCashAdvanceFromDatabase(decodeURIComponent(id));
    if (!record) return Response.json({ error: 'CASH_ADVANCE_NOT_FOUND', message: 'Cash Advance could not be found.' }, { status: 404 });
    if (!['PENDING_FINANCE_PROCESSING', 'PENDING_RECONCILIATION', 'PENDING_FINANCE_RECONCILIATION', 'COMPLETED'].includes(record.status)) {
      return Response.json({ error: 'CASH_ADVANCE_NOT_APPROVED', message: 'Cash Advance forms are available after Director approval.' }, { status: 409 });
    }

    const requested = new URL(request.url).searchParams.get('form') ?? 'pack';
    if (!forms.has(requested as CashAdvancePdfForm)) return Response.json({ error: 'INVALID_FORM', message: 'Choose request, summary, participant or pack.' }, { status: 400 });
    const form = requested as CashAdvancePdfForm;
    const signatures = {
      staff: await signature(record.staffSignatureKey, record.requesterId),
      manager: await signature(record.managerSignatureKey, record.managerApproverId),
      director: await signature(record.directorSignatureKey, record.directorApproverId),
    };
    const financeVerifier = record.financePaidById
      ? await prisma.user.findUnique({
          where: { id: record.financePaidById },
          select: { name: true },
        })
      : null;
    const bytes = await buildCashAdvancePdf(record, {
      form,
      signatures,
      financeVerifierName: financeVerifier?.name,
    });
    const suffix = form === 'pack' ? 'forms' : form === 'summary' ? 'cash-spent-summary' : form === 'participant' ? 'participant-allowance' : 'request-form';
    const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${record.requestNumber}-${suffix}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return Response.json({ error: 'CASH_ADVANCE_PDF_FAILED', message: error instanceof Error ? error.message : 'The Cash Advance form could not be generated.' }, { status: 500 });
  }
}

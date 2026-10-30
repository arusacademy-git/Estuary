import { uploadClaimPaymentProofInDatabase } from "@/data/payment-requests/claims/prisma-repository";
import { dataResponse } from "@/lib/api/response";

type Context = { params: Promise<{ id: string }> };
const allowed = new Set(["application/pdf", "image/png", "image/jpeg"]);

export async function POST(request: Request, context: Context) {
  const form = await request.formData();
  const financeId = String(form.get("financeId") ?? "");
  const proof = form.get("proof");
  if (!financeId || !(proof instanceof File) || !allowed.has(proof.type)) {
    return Response.json(
      {
        message:
          "Finance identity and a PDF, JPG or PNG transaction proof are required.",
      },
      { status: 400 },
    );
  }
  try {
    const { id } = await context.params;
    return dataResponse(
      await uploadClaimPaymentProofInDatabase(
        decodeURIComponent(id),
        financeId,
        {
          fileName: proof.name,
          mimeType: proof.type as
            | "application/pdf"
            | "image/png"
            | "image/jpeg",
          bytes: new Uint8Array(await proof.arrayBuffer()),
        },
      ),
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Transaction proof could not be uploaded.",
      },
      { status: 409 },
    );
  }
}

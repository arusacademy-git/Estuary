import type {
  ManualDraftType,
  ManualFormDraft,
  SaveManualFormDraftInput,
} from "@/domain/payment-requests/manual-drafts/types";

type Envelope<T> = { data?: T; message?: string };

async function read<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok)
    throw new Error(
      body?.message ?? `Draft request failed (${response.status}).`,
    );
  if (!body || body.data === undefined)
    throw new Error("The draft API returned no data.");
  return body.data;
}

export async function fetchManualFormDraft<T>(
  paymentType: ManualDraftType,
  organizationId: string,
  requesterId: string,
) {
  const query = new URLSearchParams({
    paymentType,
    organizationId,
    requesterId,
  });
  return read<ManualFormDraft<T> | null>(
    await fetch(`/api/v1/payment-requests/manual-drafts?${query}`, {
      cache: "no-store",
    }),
  );
}

export async function fetchManualFormDrafts<T>(
  organizationId: string,
  requesterId: string,
) {
  const query = new URLSearchParams({ organizationId, requesterId });
  return read<ManualFormDraft<T>[]>(
    await fetch(`/api/v1/payment-requests/manual-drafts?${query}`, {
      cache: "no-store",
    }),
  );
}

export async function saveManualFormDraft<T>(
  input: SaveManualFormDraftInput<T>,
) {
  return read<ManualFormDraft<T>>(
    await fetch("/api/v1/payment-requests/manual-drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteManualFormDraft(
  id: string,
  organizationId: string,
  requesterId: string,
) {
  const query = new URLSearchParams({ id, organizationId, requesterId });
  return read<{ deleted: boolean }>(
    await fetch(`/api/v1/payment-requests/manual-drafts?${query}`, {
      method: "DELETE",
    }),
  );
}

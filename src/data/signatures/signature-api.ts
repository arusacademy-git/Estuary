import type { SaveUserSignatureInput, UserSignatureRecord } from '@/domain/signatures/types';

type Envelope<T> = { data?: T; message?: string };
async function read<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok) throw new Error(body?.message ?? `Signature request failed (${response.status}).`);
  if (!body || body.data === undefined) throw new Error('The Signature API returned no data.');
  return body.data;
}

export async function fetchUserSignature(organizationId: string, userId: string) {
  const query = new URLSearchParams({ organizationId, userId });
  const response = await fetch(`/api/v1/signatures?${query}`, { cache: 'no-store' });
  return read<UserSignatureRecord | null>(response);
}

export async function uploadUserSignature(input: SaveUserSignatureInput) {
  const response = await fetch('/api/v1/signatures', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  return read<UserSignatureRecord>(response);
}

export async function removeUserSignature(organizationId: string, userId: string) {
  const response = await fetch('/api/v1/signatures', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, userId }),
  });
  return read<{ removed: true }>(response);
}

export async function fetchSignatureImageDataUrl(documentId: string, userId: string) {
  const query = new URLSearchParams({ userId });
  const response = await fetch(
    `/api/v1/signatures/${encodeURIComponent(documentId)}?${query}`,
    { cache: 'no-store' },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as Envelope<never> | null;
    throw new Error(
      body?.message ??
        `The saved signature image could not be loaded (${response.status}).`,
    );
  }
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('The signature image could not be read.'));
    reader.onerror = () => reject(new Error('The signature image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

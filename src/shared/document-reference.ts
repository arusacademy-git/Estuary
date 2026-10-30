export function normalizeWebDocumentReference(value?: string) {
  const candidate = value?.trim();
  if (!candidate) return undefined;

  const repaired = candidate
    .replace(/^https\/\//i, 'https://')
    .replace(/^http\/\//i, 'http://');
  const withProtocol = /^www\./i.test(repaired)
    ? `https://${repaired}`
    : repaired;

  try {
    const url = new URL(withProtocol);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function isWebDocumentReference(value?: string) {
  return Boolean(normalizeWebDocumentReference(value));
}

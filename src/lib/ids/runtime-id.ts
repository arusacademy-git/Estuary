type RuntimeCrypto = Pick<Crypto, 'getRandomValues'> & {
  randomUUID?: () => string;
};

function uuidFromRandomValues(runtimeCrypto: RuntimeCrypto) {
  const bytes = runtimeCrypto.getRandomValues(new Uint8Array(16));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-');
}

/**
 * Creates an identifier in browsers, Node.js, secure HTTPS contexts, and the
 * plain-HTTP NetBird beta environment.
 */
export function createRuntimeId(
  runtimeCrypto: RuntimeCrypto | null = globalThis.crypto,
) {
  if (typeof runtimeCrypto?.randomUUID === 'function') {
    return runtimeCrypto.randomUUID();
  }

  if (typeof runtimeCrypto?.getRandomValues === 'function') {
    try {
      return uuidFromRandomValues(runtimeCrypto);
    } catch {
      // Continue to the last-resort identifier for restricted runtimes.
    }
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

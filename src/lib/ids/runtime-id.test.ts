import { describe, expect, it, vi } from 'vitest';

import { createRuntimeId } from './runtime-id';

describe('createRuntimeId', () => {
  it('uses the native randomUUID implementation when available', () => {
    const randomUUID = vi.fn(() => 'native-runtime-id');
    const getRandomValues = vi.fn();

    expect(createRuntimeId({ randomUUID, getRandomValues })).toBe(
      'native-runtime-id',
    );
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it('creates a UUID with getRandomValues when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(0);
      return bytes;
    });

    expect(createRuntimeId({ getRandomValues })).toBe(
      '00000000-0000-4000-8000-000000000000',
    );
  });

  it('creates a last-resort local identifier without Web Crypto', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(createRuntimeId(null)).toMatch(/^local-[a-z0-9]+-[a-z0-9]+$/);

    vi.restoreAllMocks();
  });
});

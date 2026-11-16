import { describe, expect, it } from 'vitest';

import { dataUrlToBlob } from './download-payment-voucher-pdf';

describe('signed Payment Voucher data URL conversion', () => {
  it('converts an uploaded base64 PDF into a downloadable PDF Blob', async () => {
    const blob = dataUrlToBlob('data:application/pdf;base64,JVBERi0xLjQ=');
    expect(blob.type).toBe('application/pdf');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(
      Uint8Array.from([37, 80, 68, 70, 45, 49, 46, 52]),
    );
  });

  it('rejects malformed stored files', () => {
    expect(() => dataUrlToBlob('not-a-data-url')).toThrow('invalid');
  });
});

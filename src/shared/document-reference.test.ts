import { describe, expect, it } from 'vitest';

import { isWebDocumentReference, normalizeWebDocumentReference } from './document-reference';

describe('document reference URLs', () => {
  it('accepts a normal URL', () => {
    expect(normalizeWebDocumentReference('https://drive.google.com/file/d/example/view'))
      .toBe('https://drive.google.com/file/d/example/view');
  });

  it('repairs a pasted URL with a missing protocol colon', () => {
    expect(normalizeWebDocumentReference('https//drive.com'))
      .toBe('https://drive.com/');
  });

  it('accepts a www link without converting a filename into a URL', () => {
    expect(normalizeWebDocumentReference('www.example.com/receipt.pdf'))
      .toBe('https://www.example.com/receipt.pdf');
    expect(isWebDocumentReference('receipt.pdf')).toBe(false);
  });
});

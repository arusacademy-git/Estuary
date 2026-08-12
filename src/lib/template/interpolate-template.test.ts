import { describe, expect, it } from 'vitest';

import { interpolateTemplate } from '@/lib/template/interpolate-template';

describe('interpolateTemplate', () => {
  it('replaces known placeholders and preserves unknown ones', () => {
    const result = interpolateTemplate('Hello {{name}} {{missing}}', {
      name: 'Afiq',
    });

    expect(result).toBe('Hello Afiq {{missing}}');
  });
});

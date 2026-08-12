import { describe, expect, it } from 'vitest';

import { bootstrapConfig } from '@/data/bootstrap/bootstrap-config';
import { buildBootstrapOverview } from '@/domain/bootstrap/get-bootstrap-overview';

describe('buildBootstrapOverview', () => {
  it('marks configured services as ready', () => {
    const overview = buildBootstrapOverview(bootstrapConfig, {
      databaseUrlConfigured: true,
      directUrlConfigured: true,
      nextAuthUrlConfigured: true,
      nextAuthSecretConfigured: true,
      googleOauthConfigured: true,
      awsSesConfigured: false,
      awsS3Configured: true,
    });

    expect(overview.runtimeSignals).toEqual([
      expect.objectContaining({ label: 'Database runtime', status: 'ready' }),
      expect.objectContaining({ label: 'Internal auth runtime', status: 'ready' }),
      expect.objectContaining({ label: 'Notification runtime', status: 'pending' }),
      expect.objectContaining({ label: 'Document runtime', status: 'ready' }),
    ]);
    expect(overview.apiPath).toBe('/api/v1/system/bootstrap');
    expect(overview.metrics).toHaveLength(4);
  });
});

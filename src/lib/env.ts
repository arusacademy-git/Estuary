import type {
  RuntimeEnvironmentSnapshot,
  RuntimeSignal,
} from '@/domain/bootstrap/types';

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function readRuntimeEnvironment(): RuntimeEnvironmentSnapshot {
  return {
    databaseUrlConfigured: hasValue(process.env.DATABASE_URL),
    directUrlConfigured: hasValue(process.env.DIRECT_URL),
    nextAuthUrlConfigured: hasValue(process.env.NEXTAUTH_URL),
    nextAuthSecretConfigured: hasValue(process.env.NEXTAUTH_SECRET),
    googleOauthConfigured:
      hasValue(process.env.GOOGLE_CLIENT_ID) &&
      hasValue(process.env.GOOGLE_CLIENT_SECRET),
    awsSesConfigured:
      hasValue(process.env.AWS_REGION) &&
      hasValue(process.env.AWS_ACCESS_KEY_ID) &&
      hasValue(process.env.AWS_SECRET_ACCESS_KEY) &&
      hasValue(process.env.AWS_SES_FROM_EMAIL),
    awsS3Configured:
      hasValue(process.env.AWS_REGION) &&
      hasValue(process.env.AWS_ACCESS_KEY_ID) &&
      hasValue(process.env.AWS_SECRET_ACCESS_KEY) &&
      hasValue(process.env.AWS_S3_BUCKET),
  };
}

export function getRuntimeSignals(
  snapshot: RuntimeEnvironmentSnapshot
): RuntimeSignal[] {
  return [
    {
      label: 'Database runtime',
      status:
        snapshot.databaseUrlConfigured && snapshot.directUrlConfigured
          ? 'ready'
          : 'pending',
      detail:
        'DATABASE_URL and DIRECT_URL are required before Prisma migrations and worker flows can run.',
    },
    {
      label: 'Internal auth runtime',
      status:
        snapshot.nextAuthUrlConfigured &&
        snapshot.nextAuthSecretConfigured &&
        snapshot.googleOauthConfigured
          ? 'ready'
          : 'pending',
      detail:
        'NextAuth plus Google OAuth stays blocked until URL, secret, and Google credentials exist.',
    },
    {
      label: 'Notification runtime',
      status: snapshot.awsSesConfigured ? 'ready' : 'pending',
      detail:
        'SES credentials and from-address are required for approvals, reminders, and signature collection.',
    },
    {
      label: 'Document runtime',
      status: snapshot.awsS3Configured ? 'ready' : 'pending',
      detail:
        'S3 credentials and bucket binding are required for evidence, PDFs, and signed artifacts.',
    },
  ];
}

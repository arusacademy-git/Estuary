export type BetaRole = 'STAFF' | 'DIRECTOR' | 'FINANCE_ADMIN';

export type BetaSession = {
  userId: string;
  organizationId: string;
  email: string;
  roles: BetaRole[];
};

export async function getBetaSession(): Promise<BetaSession | null> {
  // TODO: replace with NextAuth.js Google OAuth session lookup.
  return null;
}

export function requireBetaRole(session: BetaSession | null, role: BetaRole): BetaSession {
  if (!session || !session.roles.includes(role)) {
    throw new Error('Forbidden');
  }

  return session;
}

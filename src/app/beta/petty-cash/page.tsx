'use client';

import { useState } from 'react';

import { PettyCashOverview } from '@/features/payment-request/components/petty-cash/ledger/petty-cash-overview';
import { readBetaSession } from '@/lib/auth/beta-accounts';

export default function PettyCashOverviewPage() {
  const [account] = useState<ReturnType<typeof readBetaSession>>(
    () => readBetaSession(),
  );

  if (
    !account ||
    (account.role !== 'director' && account.role !== 'finance')
  ) {
    return (
      <section>
        <h1>Petty Cash access unavailable</h1>
        <p>Only Director and Finance can view the overall ledger.</p>
      </section>
    );
  }

  return (
    <PettyCashOverview
      role={account.role}
    />
  );
}

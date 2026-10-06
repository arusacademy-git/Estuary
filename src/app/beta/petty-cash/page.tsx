'use client';

import { useEffect, useState } from 'react';

import { PettyCashOverview } from '@/features/payment-request/components/petty-cash/ledger/petty-cash-overview';
import { readBetaSession } from '@/lib/auth/beta-accounts';

export default function PettyCashOverviewPage() {
  const [account, setAccount] =
    useState<ReturnType<typeof readBetaSession>>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setAccount(readBetaSession());
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <section>
        <h1>Loading Petty Cash overview</h1>
      </section>
    );
  }

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
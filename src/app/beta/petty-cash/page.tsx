"use client";

import { useState } from "react";

import { readBetaSession } from "@/lib/auth/beta-accounts";
import { PettyCashOverview } from "@/features/payment-request/components/petty-cash/ledger/petty-cash-overview";
import type { PettyCashRole } from "@/domain/payment-requests/petty-cash/types";

export default function PettyCashOverviewPage() {
  const [account] = useState<ReturnType<typeof readBetaSession>>(() =>
    readBetaSession(),
  );

  if (!account) {
    return (
      <section>
        <h1>Petty Cash access unavailable</h1>
        <p>Sign in to view the Petty Cash ledger.</p>
      </section>
    );
  }

  return <PettyCashOverview role={account.role as PettyCashRole} />;
}

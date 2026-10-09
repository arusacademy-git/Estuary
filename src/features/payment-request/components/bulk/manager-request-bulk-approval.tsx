'use client';

import { RequestBulkApproval } from './request-bulk-approval';

type ApprovalKind = 'travel-allowances' | 'invoice-payments' | 'cash-advance';

export function ManagerRequestBulkApproval({ kind }: { kind: ApprovalKind }) {
  return <RequestBulkApproval kind={kind} role="manager" />;
}

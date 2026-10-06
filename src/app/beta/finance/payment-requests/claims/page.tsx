import { RoleClaimQueue } from '@/features/payment-request/components/claims/role-claim-queue';
export default function FinanceClaimQueuePage() { return <RoleClaimQueue role="finance" title="Claim processing" copy="Verify receipts and record payment for Claims cleared for Finance." pendingStatus="PENDING_FINANCE_PROCESSING" basePath="/beta/finance/payment-requests/claims" />; }

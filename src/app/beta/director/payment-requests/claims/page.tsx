import { RoleClaimQueue } from '@/features/payment-request/components/claims/role-claim-queue';
export default function DirectorClaimQueuePage() { return <RoleClaimQueue role="director" title="Claim previews" copy="Preview approved and self-submitted Claims before Finance processing." pendingStatus="PENDING_DIRECTOR_APPROVAL" basePath="/beta/director/payment-requests/claims" />; }

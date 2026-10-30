import { redirect } from 'next/navigation';

export default function DirectorClaimQueuePage() {
  redirect('/beta/director/pending-approvals?type=CL');
}

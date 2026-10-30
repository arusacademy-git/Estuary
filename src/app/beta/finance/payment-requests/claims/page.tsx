import { redirect } from 'next/navigation';

export default function FinanceClaimQueuePage() {
  redirect('/beta/finance/pending-processing?type=CL');
}
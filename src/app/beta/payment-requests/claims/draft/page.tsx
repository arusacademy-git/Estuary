import { redirect } from 'next/navigation';

export default function ClaimDraftPage() {
  redirect('/beta/payment-records/claims?scope=mine');
}

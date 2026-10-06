'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { SignatureUpload } from '@/features/signatures/components/signature-upload';
import { PaymentPageState } from '@/shared/payment-page-state';

export default function SignatureSettingsPage() {
  const router = useRouter(); const [account, setAccount] = useState<BetaAccount | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { const current = readBetaSession(); setAccount(current); setLoading(false); if (!current) router.replace('/beta'); }, [router]);
  if (loading) return <PaymentPageState title="Loading Signature Settings" copy="Preparing your saved signature and upload controls…" backHref="/beta" backLabel="Back to Dashboard" />;
  if (!account) return null;
  return <SignatureUpload roleLabel={account.role === 'manager' ? 'Manager' : account.role === 'director' ? 'Director' : account.role === 'finance' ? 'Finance' : 'Staff'} userId={account.id} userName={account.name} />;
}

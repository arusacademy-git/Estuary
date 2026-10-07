'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readBetaSession, type BetaAccount } from '@/lib/auth/beta-accounts';
import { SignatureUpload } from '@/features/signatures/components/signature-upload';

export default function SignatureSettingsPage() {
  const router = useRouter(); const [account] = useState<BetaAccount | null>(() => readBetaSession());
  useEffect(() => { if (!account) router.replace('/beta'); }, [account, router]);
  if (!account) return null;
  return <SignatureUpload roleLabel={account.role === 'manager' ? 'Manager' : account.role === 'director' ? 'Director' : account.role === 'finance' ? 'Finance' : 'Staff'} userId={account.id} userName={account.name} />;
}

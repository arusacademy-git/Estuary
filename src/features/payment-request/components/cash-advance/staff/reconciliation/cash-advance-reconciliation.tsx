'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { submitCashAdvanceReconciliation } from '@/data/payment-requests/cash-advance/cash-advance-api';
import {
  cashAdvanceBalance,
  cashAdvanceExpenseTotal,
  cashAdvanceOutcome,
} from '@/domain/payment-requests/cash-advance/policy';
import type {
  CashAdvanceDocument,
  CashAdvanceExpense,
  CashAdvanceRecord,
} from '@/domain/payment-requests/cash-advance/types';
import { notifyCashAdvanceReconciliationSubmitted } from '@/features/payment-request/notifications/cash-advance-notifications';
import { readBetaSession } from '@/lib/auth/beta-accounts';

import styles from '../../cash-advance.module.css';
import { BalanceReturnProof } from './balance-return-proof';
import { CashSpentGoogleSheet } from './cash-spent-google-sheet';
import { CashSpentSummary } from './cash-spent-summary';
import { ParticipantAllowance } from './participant-allowance';
import { ReconciliationReview } from './reconciliation-review';

const newExpense = (): CashAdvanceExpense => ({
  id: crypto.randomUUID(),
  expenseDate: '',
  supplier: '',
  description: '',
  accountType: '',
  amount: 0,
});

export function CashAdvanceReconciliation({ record }: { record: CashAdvanceRecord }) {
  const router = useRouter();
  const previous = record.reconciliation;
  const [stage, setStage] = useState<'EDIT' | 'REVIEW'>('EDIT');
  const [expenses, setExpenses] = useState<CashAdvanceExpense[]>(previous?.expenses ?? [newExpense()]);
  const [includesParticipants, setIncludesParticipants] = useState(previous?.includesParticipantAllowance ?? false);
  const [participantProof] = useState<CashAdvanceDocument | undefined>(previous?.participantProof);
  const [participantProofLink, setParticipantProofLink] = useState(previous?.participantProofLink ?? '');
  const [returnDate, setReturnDate] = useState(previous?.balanceReturnDate ?? '');
  const [returnReference, setReturnReference] = useState(previous?.balanceReturnReference ?? '');
  const [balanceProof, setBalanceProof] = useState<CashAdvanceDocument | undefined>(previous?.balanceReturnProof);
  const [remarks, setRemarks] = useState(previous?.remarks ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const totalSpent = useMemo(() => cashAdvanceExpenseTotal(expenses), [expenses]);
  const balance = cashAdvanceBalance(record.totalAmount, totalSpent);
  const outcome = cashAdvanceOutcome(balance);
  const detailHref = `/beta/payment-records/cash-advances/${encodeURIComponent(record.requestNumber)}`;

  function validate() {
    if (!expenses.length || expenses.some((expense) => !expense.expenseDate || !expense.supplier?.trim() || !expense.description.trim() || !expense.accountType?.trim() || expense.amount <= 0)) {
      return 'Complete the date, supplier, description, type of account and amount for every Cash Spent Summary row.';
    }
    if (includesParticipants && !participantProof && !participantProofLink.trim()) {
      return 'Paste the Participant Allowance Google Sheet link.';
    }
    if (includesParticipants && participantProofLink.trim()) {
      try {
        const url = new URL(participantProofLink.trim());
        if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return 'Use a valid Google Sheets link for Participant Allowance.';
      } catch {
        return 'Use a valid Google Sheets link for Participant Allowance.';
      }
    }
    if (outcome === 'UNDERSPEND' && (!returnDate || !returnReference.trim() || !balanceProof)) {
      return 'Complete the balance return date, bank reference and payment proof.';
    }
    return null;
  }

  function review() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStage('REVIEW');
  }

  async function submit() {
    const account = readBetaSession();
    if (!account || account.id !== record.requesterId) {
      setError('Only the original requester can reconcile this Cash Advance.');
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setStage('EDIT');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await submitCashAdvanceReconciliation(record.id, {
        requesterId: account.id,
        expenses,
        includesParticipantAllowance: includesParticipants,
        participants: [],
        participantProof: includesParticipants ? participantProof : undefined,
        participantProofLink: includesParticipants ? participantProofLink.trim() || undefined : undefined,
        balanceReturnDate: outcome === 'UNDERSPEND' ? returnDate : undefined,
        balanceReturnReference: outcome === 'UNDERSPEND' ? returnReference : undefined,
        balanceReturnProof: outcome === 'UNDERSPEND' ? balanceProof : undefined,
        remarks: remarks.trim() || undefined,
      });
      notifyCashAdvanceReconciliationSubmitted(updated, account);
      router.refresh();
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Reconciliation could not be submitted.');
      setSaving(false);
    }
  }

  const header = <>
    <div className={styles.reconciliationBack}><Link href={detailHref}>← Back to view details</Link></div>
    <header className={styles.reconciliationHeader}>
      <div>
        <p>Cash Advance / Reconciliation</p>
        <h1>{stage === 'REVIEW' ? `Review ${record.requestNumber}` : `Reconcile ${record.requestNumber}`}</h1>
        <span>{stage === 'REVIEW' ? 'Confirm all entries and supporting evidence before sending the reconciliation to Finance.' : 'Complete Appendix A, the optional Participant Allowance, and balance proof where required.'}</span>
      </div>
      <strong>{stage === 'REVIEW' ? 'Review' : 'In progress'}</strong>
    </header>
  </>;

  if (stage === 'REVIEW') {
    return <main className={styles.reconciliationPage}>
      {header}
      {error && <div className={styles.error}>{error}</div>}
      <ReconciliationReview advance={record.totalAmount} balance={balance} balanceReturnDate={returnDate} balanceReturnProof={balanceProof} balanceReturnReference={returnReference} expenses={expenses} includesParticipants={includesParticipants} onBack={() => setStage('EDIT')} onSubmit={submit} outcome={outcome} participantProof={participantProof} participantProofLink={participantProofLink} remarks={remarks} requestNumber={record.requestNumber} saving={saving} totalSpent={totalSpent} />
    </main>;
  }

  return <main className={styles.reconciliationPage}>
    {header}
    {record.returnedStage === 'RECONCILIATION' && record.returnRemarks && <div className={styles.returnNotice}><strong>Finance requested corrections</strong><p>{record.returnRemarks}</p></div>}
    {error && <div className={styles.error}>{error}</div>}
    <div className={styles.formReceipt}>
      <CashSpentSummary expenses={expenses} onChange={setExpenses} totalSpent={totalSpent} />
      <CashSpentGoogleSheet onApply={(retrieved) => { setExpenses(retrieved); setError(''); }} />
      <ParticipantAllowance enabled={includesParticipants} onEnabledChange={setIncludesParticipants} onSheetLinkChange={setParticipantProofLink} sheetLink={participantProofLink} />
      <BalanceReturnProof advance={record.totalAmount} balance={balance} onError={setError} onProofChange={setBalanceProof} onReturnDateChange={setReturnDate} onReturnReferenceChange={setReturnReference} outcome={outcome} proof={balanceProof} returnDate={returnDate} returnReference={returnReference} totalSpent={totalSpent} />
      <section className={styles.receiptSection}><div className={styles.field}><label>Additional reconciliation remarks</label><textarea onChange={(event) => setRemarks(event.target.value)} placeholder="Add any information Finance should know" value={remarks} /></div><div className={styles.footerActions}><span>Review all entries before submitting.</span><button className={styles.primary} onClick={review} type="button">Review reconciliation →</button></div></section>
    </div>
  </main>;
}

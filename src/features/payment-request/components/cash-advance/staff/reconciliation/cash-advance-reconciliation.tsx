'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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

type ReconciliationDraft = {
  expenses: CashAdvanceExpense[];
  includesParticipants: boolean;
  participantProofLink: string;
  returnDate: string;
  returnReference: string;
  remarks: string;
  savedAt: string;
};

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
  const [draftReady, setDraftReady] = useState(false);
  const [entrySource, setEntrySource] = useState<'MANUAL' | 'GOOGLE_SHEET'>('MANUAL');
  const [draftStatus, setDraftStatus] = useState('Manual entries are saved as a browser draft.');

  const totalSpent = useMemo(() => cashAdvanceExpenseTotal(expenses), [expenses]);
  const balance = cashAdvanceBalance(record.totalAmount, totalSpent);
  const outcome = cashAdvanceOutcome(balance);
  const detailHref = `/beta/payment-records/cash-advances/${encodeURIComponent(record.requestNumber)}`;
  const draftKey = `estuary:cash-advance-reconciliation-draft:${record.id}`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftKey);
      if (stored) {
        const draft = JSON.parse(stored) as Partial<ReconciliationDraft>;
        if (Array.isArray(draft.expenses) && draft.expenses.length) setExpenses(draft.expenses);
        if (typeof draft.includesParticipants === 'boolean') setIncludesParticipants(draft.includesParticipants);
        if (typeof draft.participantProofLink === 'string') setParticipantProofLink(draft.participantProofLink);
        if (typeof draft.returnDate === 'string') setReturnDate(draft.returnDate);
        if (typeof draft.returnReference === 'string') setReturnReference(draft.returnReference);
        if (typeof draft.remarks === 'string') setRemarks(draft.remarks);
        setDraftStatus(draft.savedAt ? `Draft restored from ${new Date(draft.savedAt).toLocaleString('en-MY')}.` : 'Draft restored.');
      }
    } catch {
      setDraftStatus('The saved browser draft could not be restored.');
    } finally {
      setDraftReady(true);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady || entrySource !== 'MANUAL' || stage !== 'EDIT') return;
    const timeout = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const draft: ReconciliationDraft = { expenses, includesParticipants, participantProofLink, returnDate, returnReference, remarks, savedAt };
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftStatus(`Draft saved locally at ${new Date(savedAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}. Uploaded proof files must be selected again after reopening.`);
      } catch {
        setDraftStatus('Draft could not be saved in this browser.');
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [draftKey, draftReady, entrySource, expenses, includesParticipants, participantProofLink, remarks, returnDate, returnReference, stage]);

  function saveDraftNow() {
    const savedAt = new Date().toISOString();
    const draft: ReconciliationDraft = { expenses, includesParticipants, participantProofLink, returnDate, returnReference, remarks, savedAt };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
      setDraftStatus(`Draft saved locally at ${new Date(savedAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}. Uploaded proof files must be selected again after reopening.`);
    } catch {
      setDraftStatus('Draft could not be saved in this browser.');
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Draft cleanup must never block a successful reconciliation action.
    }
  }

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
      clearDraft();
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
      <CashSpentSummary expenses={expenses} onChange={(nextExpenses) => { setEntrySource('MANUAL'); setExpenses(nextExpenses); }} totalSpent={totalSpent} />
      <CashSpentGoogleSheet onApply={(retrieved) => { setEntrySource('GOOGLE_SHEET'); setExpenses(retrieved); clearDraft(); setDraftStatus('Google Sheet expenses loaded. This retrieved data is not stored as a draft.'); setError(''); }} />
      <ParticipantAllowance enabled={includesParticipants} onEnabledChange={setIncludesParticipants} onSheetLinkChange={setParticipantProofLink} sheetLink={participantProofLink} />
      <BalanceReturnProof advance={record.totalAmount} balance={balance} onError={setError} onProofChange={setBalanceProof} onReturnDateChange={setReturnDate} onReturnReferenceChange={setReturnReference} outcome={outcome} proof={balanceProof} returnDate={returnDate} returnReference={returnReference} totalSpent={totalSpent} />
      <section className={styles.receiptSection}><div className={styles.field}><label>Additional reconciliation remarks</label><textarea onChange={(event) => setRemarks(event.target.value)} placeholder="Add any information Finance should know" value={remarks} /></div><div className={styles.footerActions}><span>{entrySource === 'MANUAL' ? draftStatus : 'Review the retrieved Google Sheet entries before submitting.'}</span><div className={styles.draftActions}>{entrySource === 'MANUAL' && <button className={styles.secondary} onClick={saveDraftNow} type="button">Save draft</button>}<button className={styles.primary} onClick={review} type="button">Review reconciliation →</button></div></div></section>
    </div>
  </main>;
}

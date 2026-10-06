'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';

import {
  createClaimRequest,
  fetchClaimPolicyContext,
  saveClaimDraft,
  submitClaimDraft,
} from '@/data/payment-requests/claims/api';
import { notifyClaimSubmitted } from '@/features/payment-request/notifications/claim-notifications';
import {
  claimLimit,
  claimLineAmount,
  claimTotal,
  MEDICAL_ANNUAL_LIMIT,
  mileageRate,
  validateClaimInput,
} from '@/domain/payment-requests/claims/policy';
import {
  CLAIM_DIVISION_TYPES,
  CLAIM_TYPES,
  claimTypeDetails,
  type ClaimLine,
  type ClaimPolicyContext,
  type ClaimRecord,
  type ClaimType,
  type CreateClaimInput,
} from '@/domain/payment-requests/claims/types';
import { betaAccounts, readBetaSession } from '@/lib/auth/beta-accounts';
import { PAYMENT_VOUCHER_ACCOUNT_OPTIONS } from '@/shared/constants/payment-options';
import { parsePaymentAmountInput } from '@/shared/utils/payment-amount';
import { CorrectionBackLink, CorrectionEditLayout } from '@/shared/correction-edit-layout';

import { ClaimConfirmation } from './claim-confirmation';
import { ClaimGoogleSheet, type ClaimSheetData } from './claim-google-sheet';
import styles from './claims.module.css';

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const makeLine = (): ClaimLine => ({
  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  expenseDate: today(), supplier: '', details: '', receiptFileName: '', receiptMimeType: '', receiptFileSize: 0,
  accountType: '', division: '', amount: 0, from: '', to: '', kilometers: 0,
});

const RECEIPT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const RECEIPT_MAX_SIZE = 10 * 1024 * 1024;

export function ClaimForm({ initialRecord }: { initialRecord?: ClaimRecord } = {}) {
  const [account, setAccount] = useState<ReturnType<typeof readBetaSession>>(null);
  const [context, setContext] = useState<ClaimPolicyContext>({ medicalUsedThisYear: 0 });
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [claimType, setClaimType] = useState<ClaimType>(initialRecord?.claimType ?? 'EXPENSE');
  const [claimDate, setClaimDate] = useState(initialRecord?.claimDate ?? today());
  const [contact, setContact] = useState(initialRecord?.requesterContact ?? '');
  const [managerId, setManagerId] = useState(initialRecord?.managerApproverId ?? '');
  const [directorId, setDirectorId] = useState(initialRecord?.directorApproverId ?? '');
  const [techExtended, setTechExtended] = useState(initialRecord?.techExtended ?? false);
  const [lines, setLines] = useState<ClaimLine[]>(initialRecord?.lines?.length ? initialRecord.lines : [makeLine()]);
  const [receiptFiles, setReceiptFiles] = useState<Record<string, File>>({});
  const [entryMode, setEntryMode] = useState<'MANUAL' | 'GOOGLE_SHEET'>('MANUAL');
  const [sheetMessage, setSheetMessage] = useState('');
  const [notes, setNotes] = useState(initialRecord?.notes ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<ClaimRecord | null>(null);

  useEffect(() => { setAccount(readBetaSession()); }, []);
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setLoadingPolicy(true);
    fetchClaimPolicyContext({ organizationId: 'beta-arus-org', requesterId: account.id, claimDate })
      .then((value) => { if (!cancelled) setContext(value); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Claim policy balances could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoadingPolicy(false); });
    return () => { cancelled = true; };
  }, [account, claimDate]);

  const total = useMemo(() => claimTotal(claimType, lines), [claimType, lines]);
  const limit = claimLimit({ claimType, techExtended }, context);
  const type = claimTypeDetails(claimType);
  const limitExceeded = limit !== null && total > limit;

  function buildInput(currentAccount: NonNullable<typeof account>): CreateClaimInput {
    return {
      organizationId: 'beta-arus-org', requesterId: currentAccount.id, requesterName: currentAccount.name,
      requesterPosition: currentAccount.position, requesterRole: currentAccount.role, requesterContact: contact.trim(),
      managerApproverId: currentAccount.role !== 'director' ? managerId : undefined,
      directorApproverId: currentAccount.role !== 'director' ? directorId : undefined,
      claimDate, claimType, techExtended: claimType === 'TECH' && techExtended,
      lines, notes: notes.trim() || undefined,
    };
  }

  function chooseType(next: ClaimType) {
    if (next === claimType) return;
    setClaimType(next);
    setTechExtended(false);
    setLines([makeLine()]);
    setReceiptFiles({});
    setConfirmed(false);
    setError('');
  }

  function updateLine(id: string, patch: Partial<ClaimLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  async function applyGoogleSheet(data: ClaimSheetData) {
    if (!account) return setError('Sign in before creating a claim.');
    const nextClaimDate = claimDate || data.claimDate;
    const nextContact = contact || data.contact;
    const input: CreateClaimInput = {
      organizationId: 'beta-arus-org', requesterId: account.id, requesterName: account.name,
      requesterPosition: account.position, requesterRole: account.role, requesterContact: nextContact.trim(),
      managerApproverId: account.role !== 'director' ? managerId : undefined,
      directorApproverId: account.role !== 'director' ? directorId : undefined,
      claimDate: nextClaimDate, claimType: data.claimType, techExtended: false,
      lines: data.lines, notes: notes.trim() || undefined,
    };
    let activeContext = context;
    try {
      activeContext = await fetchClaimPolicyContext({ organizationId: 'beta-arus-org', requesterId: account.id, claimDate: nextClaimDate });
    } catch (caught) {
      return setError(caught instanceof Error ? caught.message : 'Claim policy balances could not be loaded.');
    }
    const validation = validateClaimInput(input, activeContext);
    if (validation) return setError(validation);
    if (!confirmed) return setError('Confirm that the retrieved claim information and supporting links are correct.');
    setSaving(true); setError('');
    try {
      const record = initialRecord
        ? await submitClaimDraft(initialRecord.id, input, {})
        : await createClaimRequest(input, {});
      notifyClaimSubmitted(record, account);
      setCreated(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The claim could not be submitted.');
    } finally { setSaving(false); }
  }

  function selectReceipt(lineId: string, file?: File) {
    if (!file) return;
    if (!RECEIPT_TYPES.includes(file.type)) {
      setError('Upload receipts as PDF, JPG or PNG files.');
      return;
    }
    if (file.size > RECEIPT_MAX_SIZE) {
      setError('Each receipt must be 10 MB or smaller.');
      return;
    }
    setError('');
    setReceiptFiles((current) => ({ ...current, [lineId]: file }));
    updateLine(lineId, { receiptLink: undefined, receiptFileName: file.name, receiptMimeType: file.type, receiptFileSize: file.size });
  }

  function removeLine(id: string) {
    setLines((current) => current.filter((line) => line.id !== id));
    setReceiptFiles((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!account) return setError('Sign in before creating a claim.');
    const input = buildInput(account);
    const validation = validateClaimInput(input, context);
    if (validation) return setError(validation);
    if (!confirmed) return setError('Confirm that the claim information and supporting documents are correct.');
    setSaving(true); setError('');
    try {
      const record = initialRecord
        ? await submitClaimDraft(initialRecord.id, input, receiptFiles)
        : await createClaimRequest(input, receiptFiles);
      notifyClaimSubmitted(record, account);
      setCreated(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The claim could not be saved.');
    } finally { setSaving(false); }
  }

  async function saveDraft() {
    if (!account) return setError('Sign in before saving a Claim draft.');
    setSaving(true); setError('');
    try {
      const record = await saveClaimDraft(buildInput(account), receiptFiles, initialRecord?.id);
      setCreated(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The Claim draft could not be saved.');
    } finally { setSaving(false); }
  }

  if (created) return <ClaimConfirmation record={created} onCreateAnother={() => {
    if (initialRecord) { window.location.assign('/beta/payment-requests/claims/new'); return; }
    setCreated(null); setClaimType('EXPENSE'); setTechExtended(false); setLines([makeLine()]); setReceiptFiles({}); setNotes(''); setConfirmed(false);
  }} />;

  return <main className={styles.page}>
    {initialRecord && <CorrectionBackLink href={`/beta/payment-records/claims/${encodeURIComponent(initialRecord.claimNumber)}`} label="Claim details" />}
    <header className={styles.pageHeader}>
      <div><p>Payment Requests / Claims</p><h1>{initialRecord ? `Edit ${initialRecord.claimNumber}` : 'New Claim Request'}</h1><span>Submit claims and itemized expenses with automatic policy checks.</span></div>
      <strong>{initialRecord ? 'Correction' : 'Draft'}</strong>
    </header>
    {!initialRecord && <nav className={styles.entryModeTabs} aria-label="Claim entry method"><button data-active={entryMode === 'MANUAL'} onClick={() => setEntryMode('MANUAL')} type="button">Manual form</button><button data-active={entryMode === 'GOOGLE_SHEET'} onClick={() => setEntryMode('GOOGLE_SHEET')} type="button">Google Sheet Link</button></nav>}
    {error && entryMode === 'GOOGLE_SHEET' && <div className={styles.error} role="alert">{error}</div>}
    {entryMode === 'GOOGLE_SHEET' ? <ClaimGoogleSheet
      completionFields={<>
        <label><span>Claim date *</span><input type="date" value={claimDate} onChange={(event) => setClaimDate(event.target.value)} /></label>
        <label><span>Contact *</span><input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Phone number or email" /></label>
        {account && account.role !== 'director' && <label><span>{account.role === 'finance' ? 'Finance Manager reviewer *' : 'Manager reviewer *'}</span><select value={managerId} onChange={(event) => setManagerId(event.target.value)}><option value="">{account.role === 'finance' ? 'Choose a Finance Manager' : 'Choose a Manager'}</option>{betaAccounts.filter((item) => item.role === 'manager').map((manager) => <option key={manager.id} value={manager.id}>{manager.name} — {manager.position}</option>)}</select></label>}
        {account && account.role !== 'director' && <label><span>Director preview *</span><select value={directorId} onChange={(event) => setDirectorId(event.target.value)}><option value="">Choose a Director</option>{betaAccounts.filter((item) => item.role === 'director').map((director) => <option key={director.id} value={director.id}>{director.name} — {director.position}</option>)}</select></label>}
        <label className={styles.sheetCompletionWide}><span>Notes</span><textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional context for the reviewer" /></label>
        <label className={`${styles.sheetCompletionWide} ${styles.sheetDeclaration}`}><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /><span>I confirm that the retrieved claim and receipt links are correct.</span></label>
      </>}
      disabled={saving || loadingPolicy}
      onApply={applyGoogleSheet}
      onCancel={() => setEntryMode('MANUAL')}
      onRetrieved={(data) => {
        setClaimType(data.claimType);
        setTechExtended(false);
        if (data.claimDate) setClaimDate(data.claimDate);
        if (data.contact) setContact(data.contact);
        setError('');
      }}
    /> : <CorrectionEditLayout remarks={initialRecord ? initialRecord.returnRemarks ?? 'Update the request and resubmit it for approval.' : undefined}>
      <form className={styles.claimForm} onSubmit={submit}>
        {error && <div className={styles.error} role="alert">{error}</div>}
        {sheetMessage && <div className={styles.success} role="status">{sheetMessage}</div>}

        <article className={styles.sheet}>
          <header className={styles.documentBar}><div><strong>Official {type.label} sheet</strong><span>Reference assigned after submission</span></div></header>

          <section className={styles.section}>
            <SectionHeading number="1" title="Select claim type & policy matrix" />
            <div className={styles.policyMatrix}>
              <label className={styles.claimTypeField}><span>Claim type</span><select value={claimType} onChange={(event) => chooseType(event.target.value as ClaimType)}>{CLAIM_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><small>Form fields adjust automatically based on the selected type.</small></label>
              <div className={`${styles.policyChoice} ${context.techExtendedLockedUntil && claimType === 'TECH' ? styles.policyLocked : ''}`}><div className={styles.policyDescription}><i aria-hidden="true" /><p><strong>{type.label} policy:</strong> {type.description}</p></div>
                {claimType === 'TECH' && <><label className={styles.extendedChoice}><input checked={techExtended} disabled={Boolean(context.techExtendedLockedUntil)} onChange={(event) => setTechExtended(event.target.checked)} type="checkbox" /><span><strong>Use the extended RM1,000.00 Tech allowance</strong><small>Prevents another Tech claim for three calendar years after submission.</small></span></label>{context.techExtendedLockedUntil && <p className={styles.lockMessage}>Tech claims are locked until {displayDate(context.techExtendedLockedUntil)}.</p>}</>}
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.headingRow}><SectionHeading number="2" title="Claimant information" /><span>Signed-in profile verified</span></div>
            <div className={styles.fieldGrid}>
              <label><span>Staff name</span><input disabled value={account?.name ?? ''} /></label>
              <label><span>Position & title</span><input disabled value={account?.position ?? ''} /></label>
              <label><span>Role</span><input disabled value={account ? roleLabel(account.role) : ''} /></label>
              <label><span>Claim date</span><input required type="date" value={claimDate} onChange={(event) => setClaimDate(event.target.value)} /></label>
              <label className={styles.fullField}><span>Contact details (notification & audit trail)</span><input required value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Phone number or email" /></label>
              {account && account.role !== 'director' && <label className={styles.wideField}><span>{account.role === 'finance' ? 'Finance Manager reviewer' : 'Manager reviewer'}</span><select required value={managerId} onChange={(event) => setManagerId(event.target.value)}><option value="">{account.role === 'finance' ? 'Choose a Finance Manager' : 'Choose a Manager'}</option>{betaAccounts.filter((item) => item.role === 'manager').map((manager) => <option key={manager.id} value={manager.id}>{manager.name} — {manager.position}</option>)}</select></label>}
              {account && account.role !== 'director' && <label className={styles.wideField}><span>Director preview</span><select required value={directorId} onChange={(event) => setDirectorId(event.target.value)}><option value="">Choose a Director</option>{betaAccounts.filter((item) => item.role === 'director').map((director) => <option key={director.id} value={director.id}>{director.name} — {director.position}</option>)}</select></label>}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.itemsHeading}><SectionHeading number="3" title={claimType === 'MILEAGE' ? 'Itemized trips' : 'Itemized expenses'} copy={claimType === 'MILEAGE' ? 'Enter the route and distance for every trip.' : 'Attach a merchant receipt and state the operational purpose for each line item.'} /><button className={styles.secondaryButton} onClick={() => setLines((current) => [...current, makeLine()])} type="button">+ Add {claimType === 'MILEAGE' ? 'trip' : 'expense item'}</button></div>
            <div className={styles.tableWrap}>{claimType === 'MILEAGE'
              ? <MileageTable lines={lines} updateLine={updateLine} removeLine={removeLine} />
              : <ExpenseTable claimType={claimType} lines={lines} receiptFiles={receiptFiles} selectReceipt={selectReceipt} updateLine={updateLine} removeLine={removeLine} />}
            </div>
            <PolicyBar claimType={claimType} context={context} limit={limit} limitExceeded={limitExceeded} loading={loadingPolicy} techExtended={techExtended} total={total} />
          </section>

          <section className={styles.section}>
            <SectionHeading number="4" title="Purpose & context justification" />
            <label className={styles.notesField}><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add clear operational context that will help the reviewer understand this claim" /><small>Explain the business purpose to support Manager review and Finance verification.</small></label>
          </section>

          <footer className={styles.submitSection}><label className={styles.declaration}><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /><span>I confirm that this claim is accurate, complies with Estuary policies, and all uploaded documents relate directly to the expenses listed.</span></label><div className={styles.actions}><button className={styles.draftButton} disabled={saving} onClick={saveDraft} type="button">{saving ? 'Saving…' : initialRecord ? 'Save draft changes' : 'Save as draft'}</button><button className={styles.primaryButton} disabled={saving || loadingPolicy || Boolean(context.techExtendedLockedUntil && claimType === 'TECH')} type="submit">{saving ? 'Submitting…' : loadingPolicy ? 'Checking policy…' : initialRecord ? 'Submit draft →' : 'Submit claim →'}</button></div></footer>
        </article>
      </form>
    </CorrectionEditLayout>}
  </main>;
}

function ExpenseTable({ claimType, lines, receiptFiles, selectReceipt, updateLine, removeLine }: { claimType: ClaimType; lines: ClaimLine[]; receiptFiles: Record<string, File>; selectReceipt: (lineId: string, file?: File) => void; updateLine: (id: string, patch: Partial<ClaimLine>) => void; removeLine: (id: string) => void }) {
  const expense = claimType === 'EXPENSE';
  return <table className={styles.claimTable}><thead><tr><th>Date</th><th>Supplier / merchant</th><th>Description & purpose</th>{expense && <><th>Type of account</th><th>Division</th></>}<th>Receipt / proof</th><th>Amount (RM)</th><th /></tr></thead><tbody>{lines.map((line) => <tr key={line.id}>
    <td><input type="date" value={line.expenseDate} onChange={(event) => updateLine(line.id, { expenseDate: event.target.value })} /></td>
    <td><input value={line.supplier} onChange={(event) => updateLine(line.id, { supplier: event.target.value })} placeholder="Supplier" /></td>
    <td><input value={line.details} onChange={(event) => updateLine(line.id, { details: event.target.value })} placeholder="What is this expense for?" /></td>
    {expense && <><td><select value={line.accountType} onChange={(event) => updateLine(line.id, { accountType: event.target.value })}><option value="">Choose account</option>{PAYMENT_VOUCHER_ACCOUNT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td><td><select value={line.division} onChange={(event) => updateLine(line.id, { division: event.target.value })}><option value="">Choose division</option>{CLAIM_DIVISION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></td></>}
    <td>{line.receiptLink && !receiptFiles[line.id] ? <div className={styles.receiptLink}><a href={line.receiptLink} rel="noreferrer" target="_blank">Open receipt ↗</a><label><input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => selectReceipt(line.id, event.target.files?.[0])} type="file" />Replace with upload</label></div> : <label className={`${styles.receiptUpload} ${receiptFiles[line.id] || line.receiptDocumentId ? styles.receiptAttached : ''}`}><input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => selectReceipt(line.id, event.target.files?.[0])} type="file" /><span>{receiptFiles[line.id] || line.receiptDocumentId ? '✓' : '↑'}</span><strong>{(receiptFiles[line.id]?.name ?? line.receiptFileName) || 'Upload receipt'}</strong><small>{receiptFiles[line.id] ? formatFileSize(receiptFiles[line.id].size) : line.receiptDocumentId ? 'Saved receipt · replace' : 'PDF, JPG or PNG'}</small></label>}</td>
    <td><input inputMode="decimal" placeholder="0.00" type="text" value={line.amount || ''} onChange={(event) => updateLine(line.id, { amount: parsePaymentAmountInput(event.target.value) })} /></td>
    <td><RemoveButton disabled={lines.length === 1} onClick={() => removeLine(line.id)} /></td>
  </tr>)}</tbody></table>;
}

function MileageTable({ lines, updateLine, removeLine }: { lines: ClaimLine[]; updateLine: (id: string, patch: Partial<ClaimLine>) => void; removeLine: (id: string) => void }) {
  return <table className={`${styles.claimTable} ${styles.mileageTable}`}><thead><tr><th>Date</th><th>Details / purpose</th><th>Division</th><th>From</th><th>To</th><th>Total km</th><th>Rate / km</th><th>Total (RM)</th><th /></tr></thead><tbody>{lines.map((line) => <tr key={line.id}>
    <td><input type="date" value={line.expenseDate} onChange={(event) => updateLine(line.id, { expenseDate: event.target.value })} /></td>
    <td><input value={line.details} onChange={(event) => updateLine(line.id, { details: event.target.value })} placeholder="Project or trip purpose" /></td>
    <td><select value={line.division} onChange={(event) => updateLine(line.id, { division: event.target.value })}><option value="">Choose division</option>{CLAIM_DIVISION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></td>
    <td><input value={line.from} onChange={(event) => updateLine(line.id, { from: event.target.value })} placeholder="Starting point" /></td>
    <td><input value={line.to} onChange={(event) => updateLine(line.id, { to: event.target.value })} placeholder="Destination" /></td>
    <td><input min="0.1" step="0.1" type="number" value={line.kilometers || ''} onChange={(event) => updateLine(line.id, { kilometers: Number(event.target.value) })} /></td>
    <td><strong>RM {mileageRate(line.kilometers).toFixed(2)}</strong></td>
    <td><strong>RM {claimLineAmount('MILEAGE', line).toFixed(2)}</strong></td>
    <td><RemoveButton disabled={lines.length === 1} onClick={() => removeLine(line.id)} /></td>
  </tr>)}</tbody></table>;
}

function PolicyBar({ claimType, context, limit, limitExceeded, loading, techExtended, total }: { claimType: ClaimType; context: ClaimPolicyContext; limit: number | null; limitExceeded: boolean; loading: boolean; techExtended: boolean; total: number }) {
  let copy = 'No monetary limit applies. Supporting documents are still required.';
  if (claimType === 'INTERNET_COMMUTE') copy = 'Maximum RM70.00 for this claim.';
  if (claimType === 'MEDICAL') copy = `RM${context.medicalUsedThisYear.toFixed(2)} used of the RM${MEDICAL_ANNUAL_LIMIT.toFixed(2)} annual allowance. RM${(limit ?? 0).toFixed(2)} remains.`;
  if (claimType === 'MILEAGE') copy = 'RM0.50/km for a trip up to 500km; RM0.30/km when that trip exceeds 500km.';
  if (claimType === 'PD') copy = 'Maximum RM500.00 for this PD claim.';
  if (claimType === 'TECH') copy = techExtended ? 'Extended RM1,000.00 option selected. A three-year Tech claim lock starts after submission.' : 'Standard Tech claim limit: RM500.00.';
  return <div className={`${styles.policyBar} ${limitExceeded ? styles.policyError : ''}`}><div><span><strong>{limitExceeded ? 'Policy limit exceeded' : loading ? 'Checking policy' : 'Policy check'}</strong><small>{loading ? 'Reading your current allowance usage from the database…' : copy}</small></span></div><span><small>Claim total</small><strong>RM {total.toFixed(2)}</strong></span></div>;
}

function SectionHeading({ number, title, copy }: { number: string; title: string; copy?: string }) {
  return <div className={styles.sectionHeading}><div><h2>{number}. {title}</h2>{copy && <p>{copy}</p>}</div></div>;
}

function RemoveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return <button aria-label="Remove row" className={styles.removeButton} disabled={disabled} onClick={onClick} type="button">×</button>;
}

function roleLabel(role: string) { return role === 'manager' ? 'Manager' : role === 'director' ? 'Director' : role === 'finance' ? 'Finance' : 'Staff'; }
function displayDate(value: string) { return new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
function formatFileSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

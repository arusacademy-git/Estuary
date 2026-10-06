'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import {
  createPettyCashRequest,
  resubmitPettyCashRequest,
} from '@/data/payment-requests/petty-cash/api';
import {
  PETTY_CASH_REQUEST_LIMIT,
  pettyCashTotal,
  validatePettyCashInput,
} from '@/domain/payment-requests/petty-cash/policy';
import {
  DIVISION_TYPES,
  PETTY_CASH_ACCOUNT_TYPES,
  PETTY_CASH_LOCATIONS,
  type CreatePettyCashInput,
  type PettyCashRecord,
  type PettyCashRequestLine,
} from '@/domain/payment-requests/petty-cash/types';
import { betaAccounts, readBetaSession } from '@/lib/auth/beta-accounts';
import { notifyPettyCashSubmitted } from '@/features/payment-request/notifications/petty-cash-notifications';
import styles from '../petty-cash.module.css';
import { PettyCashConfirmation } from './petty-cash-confirmation';
import {
  PettyCashGoogleSheet,
  type PettyCashSheetData,
} from './petty-cash-google-sheet';


/* Types & helpers*/

type Account = NonNullable<ReturnType<typeof readBetaSession>>;
type Location = CreatePettyCashInput['location'];
type FinanceReviewerRole = 'director' | 'finance' | '';
type EntryMode = 'MANUAL' | 'GOOGLE_SHEET';

const ORGANIZATION_ID = 'beta-arus-org';

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const makeLine = (): PettyCashRequestLine => ({
  id: crypto.randomUUID(),
  expenseDate: today(),
  supplier: '',
  details: '',
  proofLink: '',
  accountType: '',
  division: '',
  amount: 0,
});

const isKnownOption = (options: readonly string[], value: string) =>
  options.some((option) => option === value);

function getSubmitLabel(role?: Account['role']) {
  switch (role) {
    case 'staff':
      return 'Submit to Manager';
    case 'manager':
      return 'Submit for Director preview';
    case 'director':
      return 'Submit to Finance';
    default:
      return 'Submit for independent review';
  }
}

function getRoutingCopy(role?: Account['role']) {
  switch (role) {
    case 'staff':
      return 'Choose the Manager reviewer and Director previewer.';
    case 'manager':
      return 'Choose the Director who will preview the request.';
    case 'director':
      return 'This request will go directly to Finance processing.';
    default:
      return 'Choose another authorized Finance user or a Director for independent review.';
  }
}

interface RequestDraft {
  account: Account;
  requestDate: string;
  contact: string;
  location: Location;
  managerId: string;
  directorId: string;
  financeReviewerId: string;
  financeReviewerRole: FinanceReviewerRole;
  lines: PettyCashRequestLine[];
  notes: string;
}

function resolveDirectorId({ account, directorId, financeReviewerId, financeReviewerRole }: RequestDraft) {
  if (account.role === 'staff' || account.role === 'manager') return directorId;
  if (account.role === 'finance' && financeReviewerRole === 'director') return financeReviewerId;
  return account.id;
}

function buildInput(draft: RequestDraft): CreatePettyCashInput {
  const { account, requestDate, contact, location, managerId, financeReviewerId, financeReviewerRole, lines, notes } = draft;
  const isFinance = account.role === 'finance';

  return {
    organizationId: ORGANIZATION_ID,
    requesterId: account.id,
    requesterRole: account.role,
    requesterName: account.name,
    requesterPosition: account.position,
    requesterContact: contact.trim(),
    requestDate,
    location,
    managerApproverId: account.role === 'staff' ? managerId : account.id,
    directorApproverId: resolveDirectorId(draft),
    financeReviewerId: isFinance ? financeReviewerId : undefined,
    financeReviewerRole: isFinance && financeReviewerRole ? financeReviewerRole : undefined,
    lines,
    notes: notes.trim() || undefined,
  };
}


/* Shared request fields (used by both the manual form and the Sheet flow)    */

interface RequestFieldsProps {
  account: Account | null;
  /** Appended to each label, e.g. " *" for required fields. */
  mark?: string;
  requestDate: string;
  onRequestDateChange: (value: string) => void;
  contact: string;
  onContactChange: (value: string) => void;
  location: Location;
  onLocationChange: (value: Location) => void;
  managerId: string;
  onManagerChange: (value: string) => void;
  directorId: string;
  onDirectorChange: (value: string) => void;
  financeReviewerId: string;
  financeReviewerRole: FinanceReviewerRole;
  onFinanceReviewerChange: (role: FinanceReviewerRole, id: string) => void;
}

function RequestFields({
  account,
  mark = '',
  requestDate,
  onRequestDateChange,
  contact,
  onContactChange,
  location,
  onLocationChange,
  managerId,
  onManagerChange,
  directorId,
  onDirectorChange,
  financeReviewerId,
  financeReviewerRole,
  onFinanceReviewerChange,
}: RequestFieldsProps) {
  const managers = betaAccounts.filter((item) => item.role === 'manager');
  const directors = betaAccounts.filter((item) => item.role === 'director');
  const financeReviewers = betaAccounts.filter(
    (item) => item.role === 'director' || (item.role === 'finance' && item.id !== account?.id),
  );

  const reviewerValue = financeReviewerRole && financeReviewerId ? `${financeReviewerRole}:${financeReviewerId}` : '';

  return (
    <>
      <label>
        <span>Request date{mark}</span>
        <input type="date" value={requestDate} onChange={(event) => onRequestDateChange(event.target.value)} />
      </label>
      <label>
        <span>Contact <em className={styles.requiredMarker}>*</em></span>
        <input value={contact} onChange={(event) => onContactChange(event.target.value)} placeholder="Phone or email" />
      </label>
      <label>
        <span>Location <em className={styles.requiredMarker}>*</em></span>
        <select value={location} onChange={(event) => onLocationChange(event.target.value as Location)}>
          {PETTY_CASH_LOCATIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </label>
      {account?.role === 'staff' && (
        <label>
          <span>Manager reviewer <em className={styles.requiredMarker}>*</em></span>
          <select value={managerId} onChange={(event) => onManagerChange(event.target.value)}>
            <option value="">Choose Manager</option>
            {managers.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      )}
      {(account?.role === 'staff' || account?.role === 'manager') && (
        <label className={styles.fullWidthField}>
          <span>Director previewer <em className={styles.requiredMarker}>*</em></span>
          <select value={directorId} onChange={(event) => onDirectorChange(event.target.value)}>
            <option value="">Choose Director</option>
            {directors.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      )}
      {account?.role === 'finance' && (
        <label>
          <span>Independent reviewer <em className={styles.requiredMarker}>*</em></span>
          <select
            value={reviewerValue}
            onChange={(event) => {
              const [role, id] = event.target.value.split(':');
              onFinanceReviewerChange((role as FinanceReviewerRole) || '', id || '');
            }}
          >
            <option value="">Choose another Finance user or Director</option>
            {financeReviewers.map((item) => (
              <option key={item.id} value={`${item.role}:${item.id}`}>
                {item.name} · {item.role === 'finance' ? 'Finance' : 'Director'}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}

/* Expense row                                                                */

interface ExpenseRowProps {
  line: PettyCashRequestLine;
  canRemove: boolean;
  onChange: (id: string, patch: Partial<PettyCashRequestLine>) => void;
  onRemove: (id: string) => void;
}

function ExpenseRow({ line, canRemove, onChange, onRemove }: ExpenseRowProps) {
  return (
    <tr>
      <td>
        <input type="date" value={line.expenseDate} onChange={(e) => onChange(line.id, { expenseDate: e.target.value })} />
      </td>
      <td>
        <input value={line.supplier} onChange={(e) => onChange(line.id, { supplier: e.target.value })} placeholder="Supplier" />
      </td>
      <td>
        <input value={line.details} onChange={(e) => onChange(line.id, { details: e.target.value })} placeholder="What is the expense for?" />
      </td>
      <td>
        <input type="url" value={line.proofLink} onChange={(e) => onChange(line.id, { proofLink: e.target.value })} placeholder="https://" />
      </td>
      <td>
        <select value={line.accountType} onChange={(e) => onChange(line.id, { accountType: e.target.value })}>
          <option value="">Choose account</option>
          {line.accountType && !isKnownOption(PETTY_CASH_ACCOUNT_TYPES, line.accountType) && (
            <option value={line.accountType}>{line.accountType} (from Sheet)</option>
          )}
          {PETTY_CASH_ACCOUNT_TYPES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </td>
      <td>
        <select value={line.division} onChange={(e) => onChange(line.id, { division: e.target.value })}>
          <option value="">Division</option>
          {line.division && !isKnownOption(DIVISION_TYPES, line.division) && (
            <option value={line.division}>{line.division} (from Sheet)</option>
          )}
          {DIVISION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </td>
      <td>
        <input
          min="0.01"
          step="0.01"
          type="number"
          placeholder="0.00"
          value={line.amount || ''}
          onChange={(e) => onChange(line.id, { amount: Number(e.target.value) })}
        />
      </td>
      <td>
        <button
          aria-label="Remove expense"
          className={styles.removeButton}
          disabled={!canRemove}
          onClick={() => onRemove(line.id)}
          type="button"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

/* Main form                                                                  */

export function PettyCashForm({ initialRecord }: { initialRecord?: PettyCashRecord }) {
  const [account, setAccount] = useState<ReturnType<typeof readBetaSession>>(null);
  const [requestDate, setRequestDate] = useState(initialRecord?.requestDate ?? today());
  const [contact, setContact] = useState(initialRecord?.requesterContact ?? '');
  const [location, setLocation] = useState<Location>(initialRecord?.location ?? 'PENANG');
  const [managerId, setManagerId] = useState(initialRecord?.managerApproverId ?? '');
  const [directorId, setDirectorId] = useState(initialRecord?.directorApproverId ?? '');
  const [financeReviewerId, setFinanceReviewerId] = useState(initialRecord?.financeReviewerId ?? '');
  const [financeReviewerRole, setFinanceReviewerRole] = useState<FinanceReviewerRole>(initialRecord?.financeReviewerRole ?? '');
  const [notes, setNotes] = useState(initialRecord?.notes ?? '');
  const [lines, setLines] = useState<PettyCashRequestLine[]>(initialRecord?.lines ?? [makeLine()]);
  const [confirmed, setConfirmed] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('MANUAL');
  const [sheetImportMessage, setSheetImportMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<PettyCashRecord | null>(null);

  useEffect(() => setAccount(readBetaSession()), []);

  const total = useMemo(() => pettyCashTotal(lines), [lines]);

  const handleFinanceReviewerChange = (role: FinanceReviewerRole, id: string) => {
    setFinanceReviewerRole(role);
    setFinanceReviewerId(id);
  };

  const requestFieldsProps = {
    account,
    requestDate,
    onRequestDateChange: setRequestDate,
    contact,
    onContactChange: setContact,
    location,
    onLocationChange: setLocation,
    managerId,
    onManagerChange: setManagerId,
    directorId,
    onDirectorChange: setDirectorId,
    financeReviewerId,
    financeReviewerRole,
    onFinanceReviewerChange: handleFinanceReviewerChange,
  };

  const updateLine = (id: string, patch: Partial<PettyCashRequestLine>) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));

  const addLine = () => setLines((current) => [...current, makeLine()]);
  const removeLine = (id: string) => setLines((current) => current.filter((item) => item.id !== id));

  /** Validates, then creates (or resubmits) the request. */
  async function validateAndSubmit(account: Account, input: CreatePettyCashInput, confirmMessage: string) {
    const validation = validatePettyCashInput(input);
    if (validation) return setError(validation);
    if (!confirmed) return setError(confirmMessage);

    setSaving(true);
    setError('');
    try {
      const record = initialRecord
        ? await resubmitPettyCashRequest(initialRecord.id, input)
        : await createPettyCashRequest(input);
      notifyPettyCashSubmitted(record, account);
      setCreated(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The Petty Cash request could not be submitted.');
    } finally {
      setSaving(false);
    }
  }

  const draftFor = (account: Account, overrides: Partial<RequestDraft> = {}): RequestDraft => ({
    account,
    requestDate,
    contact,
    location,
    managerId,
    directorId,
    financeReviewerId,
    financeReviewerRole,
    lines,
    notes,
    ...overrides,
  });

  async function applyGoogleSheet(data: PettyCashSheetData) {
    if (!account) return setError('Sign in before retrieving a Petty Cash sheet.');

    const input = buildInput(
      draftFor(account, {
        requestDate: requestDate || data.requestDate,
        contact: contact || data.contact,
        lines: data.lines,
      }),
    );
    await validateAndSubmit(account, input, 'Confirm that the retrieved request information and supporting links are correct.');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!account) return setError('Sign in before submitting a Petty Cash request.');

    await validateAndSubmit(account, buildInput(draftFor(account)), 'Confirm that the request information and supporting links are correct.');
  }

  if (created) {
    return (
      <PettyCashConfirmation
        request={created}
        onCreateAnother={() => {
          setCreated(null);
          setLines([makeLine()]);
          setNotes('');
          setConfirmed(false);
        }}
      />
    );
  }

  const submitLabel = getSubmitLabel(account?.role);
  const isOverLimit = total >= PETTY_CASH_REQUEST_LIMIT;
  const limitLabel = `RM${PETTY_CASH_REQUEST_LIMIT.toFixed(2)}`;

  return (
    <main className={styles.requestPage}>
      {initialRecord && (
        <div className={styles.formBackRow}>
          <Link href={`/beta/payment-records/petty-cash/${encodeURIComponent(initialRecord.requestNumber)}`}>
            ← Back to Petty Cash request
          </Link>
        </div>
      )}

      <header className={styles.requestHeader}>
        <div>
          <p>Payment Requests / Petty Cash</p>
          <h1>{initialRecord ? `Edit ${initialRecord.requestNumber}` : 'New Petty Cash Request'}</h1>
          <span>Request reimbursement for small work expenses below {limitLabel}.</span>
        </div>
        <strong>{initialRecord ? 'Correction' : 'Draft'}</strong>
      </header>

      {!initialRecord && (
        <div className={styles.entryModeTabs} role="group" aria-label="Petty Cash entry method">
          <button data-active={entryMode === 'MANUAL'} type="button" onClick={() => setEntryMode('MANUAL')}>
            Manual form
          </button>
          <button data-active={entryMode === 'GOOGLE_SHEET'} type="button" onClick={() => setEntryMode('GOOGLE_SHEET')}>
            Google Sheet Link
          </button>
        </div>
      )}

      {sheetImportMessage && entryMode === 'MANUAL' && (
        <div className={styles.sheetSuccess} role="status">{sheetImportMessage}</div>
      )}

      {entryMode === 'GOOGLE_SHEET' && !initialRecord ? (
        <>
          {error && <div className={styles.error} role="alert">{error}</div>}
          <PettyCashGoogleSheet
            routingCopy={getRoutingCopy(account?.role)}
            submitLabel={submitLabel}
            completionFields={
              <>
                <RequestFields {...requestFieldsProps} mark=" *" />
                <label className={styles.sheetCompletionWide}>
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional context for Manager or Finance"
                  />
                </label>
                <label className={`${styles.sheetCompletionWide} ${styles.sheetDeclaration}`}>
                  <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
                  <span>I confirm that the retrieved request and supporting links are correct.</span>
                </label>
              </>
            }
            disabled={saving}
            onCancel={() => setEntryMode('MANUAL')}
            onApply={applyGoogleSheet}
            onRetrieved={(data) => {
              if (data.requestDate) setRequestDate(data.requestDate);
              if (data.contact) setContact(data.contact);
              setError('');
            }}
          />
        </>
      ) : (
        <form className={`${styles.formCard} ${styles.formPage}`} onSubmit={submit}>
          {error && <div className={styles.error} role="alert">{error}</div>}

          <section className={styles.formGuidance}>
            <div>
              <span>Petty Cash</span>
              <h2>Reimbursement for small work expenses</h2>
            </div>
            <p>
              Use Petty Cash for approved work expenses below {limitLabel}. Record each expense and provide a shareable
              receipt or invoice link.
            </p>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeading}>
              <div>
                <span>1</span>
                <div>
                  <h2>Request information</h2>
                  <p>Requester, office fund and Manager assignment</p>
                </div>
              </div>
            </div>
            <div className={styles.fieldGrid}>
              <label><span>Name</span><input disabled value={account?.name ?? ''} /></label>
              <label><span>Position</span><input disabled value={account?.position ?? ''} /></label>
              <RequestFields {...requestFieldsProps} />
            </div>
          </section>

          <section className={`${styles.card} ${styles.expenseSection}`}>
            <div className={styles.sectionHeading}>
              <div>
                <span>2</span>
                <div>
                  <h2>Expense details</h2>
                  <p>Itemized record of receipts and ledger account allocations</p>
                </div>
              </div>
              <button className={styles.secondaryButton} type="button" onClick={addLine}>
                + Add expense row
              </button>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.expenseTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Details / purpose</th>
                    <th>Receipt or invoice link</th>
                    <th>Type of account</th>
                    <th>Division</th>
                    <th>Amount (RM)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <ExpenseRow
                      key={line.id}
                      line={line}
                      canRemove={lines.length > 1}
                      onChange={updateLine}
                      onRemove={removeLine}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`${styles.totalBar} ${isOverLimit ? styles.totalInvalid : ''}`}>
              <span className={styles.policyCopy}>
                <span>
                  Policy status: <strong>{isOverLimit ? 'Limit exceeded' : 'Compliant'}</strong>
                  <small>Total must remain below {limitLabel}</small>
                </span>
              </span>
              <span className={styles.totalAmount}>
                <small>Request total</small>
                <strong>RM {total.toFixed(2)}</strong>
              </span>
            </div>
          </section>

          <section className={`${styles.card} ${styles.notesSection}`}>
            <label className={styles.notesField}>
              <span>Notes / purpose justification for Manager or Finance</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add project context or an explanation for these expenses"
              />
            </label>
          </section>

          <section className={styles.confirmCard}>
            <label>
              <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
              <span>I confirm that this request is accurate and the receipt/invoice links relate to these expenses.</span>
            </label>
            <button className={styles.primaryButton} disabled={saving} type="submit">
              {saving ? 'Submitting…' : initialRecord ? 'Resubmit request' : submitLabel}
            </button>
          </section>
        </form>
      )}
    </main>
  );
}
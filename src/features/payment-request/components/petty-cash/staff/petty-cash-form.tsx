"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  createPettyCashRequest,
  resubmitPettyCashRequest,
} from "@/data/payment-requests/petty-cash/api";
import {
  PETTY_CASH_REQUEST_LIMIT,
  pettyCashTotal,
  validatePettyCashInput,
} from "@/domain/payment-requests/petty-cash/policy";
import {
  DIVISION_TYPES,
  PETTY_CASH_ACCOUNT_TYPES,
  PETTY_CASH_LOCATIONS,
  type CreatePettyCashInput,
  type PettyCashRecord,
  type PettyCashRequestLine,
} from "@/domain/payment-requests/petty-cash/types";
import { betaAccounts, readBetaSession } from "@/lib/auth/beta-accounts";
import { notifyPettyCashSubmitted } from "@/features/payment-request/notifications/petty-cash-notifications";
import { useManualFormDraft } from "@/features/payment-request/components/shared/use-manual-form-draft";
import styles from "../petty-cash.module.css";
import { PettyCashConfirmation } from "./petty-cash-confirmation";

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
const makeLine = (): PettyCashRequestLine => ({
  id: crypto.randomUUID(),
  expenseDate: today(),
  supplier: "",
  details: "",
  proofLink: "",
  accountType: "",
  division: "",
  amount: 0,
});

export function PettyCashForm({
  initialRecord,
}: {
  initialRecord?: PettyCashRecord;
}) {
  const [account, setAccount] =
    useState<ReturnType<typeof readBetaSession>>(null);
  const [requestDate, setRequestDate] = useState(
    initialRecord?.requestDate ?? today(),
  );
  const [contact, setContact] = useState(initialRecord?.requesterContact ?? "");
  const [location, setLocation] = useState<CreatePettyCashInput["location"]>(
    initialRecord?.location ?? "PENANG",
  );
  const [managerId, setManagerId] = useState(
    initialRecord?.managerApproverId ?? "",
  );
  const [directorId, setDirectorId] = useState(
    initialRecord?.directorApproverId ?? "",
  );
  const [financeReviewerId, setFinanceReviewerId] = useState(
    initialRecord?.financeReviewerId ?? "",
  );
  const [financeReviewerRole, setFinanceReviewerRole] = useState<
    "manager" | "director" | "finance" | ""
  >(initialRecord?.financeReviewerRole ?? "");
  const [notes, setNotes] = useState(initialRecord?.notes ?? "");
  const [lines, setLines] = useState<PettyCashRequestLine[]>(
    initialRecord?.lines ?? [makeLine()],
  );
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<PettyCashRecord | null>(null);
  const [stage, setStage] = useState<"FORM" | "REVIEW">("FORM");

  useEffect(() => setAccount(readBetaSession()), []);
  const managers = betaAccounts.filter((item) => item.role === "manager");
  const directors = betaAccounts.filter((item) => item.role === "director");
  const financeReviewers = betaAccounts.filter(
    (item) =>
      ["manager", "director"].includes(item.role) ||
      (item.role === "finance" && item.id !== account?.id),
  );
  const total = useMemo(() => pettyCashTotal(lines), [lines]);
  const draft = useManualFormDraft({
    paymentType: "PETTY_CASH",
    requesterId: account?.id,
    disabled: Boolean(initialRecord),
    getSnapshot: () => ({
      requestDate,
      contact,
      location,
      managerId,
      directorId,
      financeReviewerId,
      financeReviewerRole,
      notes,
      lines,
    }),
    restoreSnapshot: (value: {
      requestDate?: string;
      contact?: string;
      location?: CreatePettyCashInput["location"];
      managerId?: string;
      directorId?: string;
      financeReviewerId?: string;
      financeReviewerRole?: "manager" | "director" | "finance" | "";
      notes?: string;
      lines?: PettyCashRequestLine[];
    }) => {
      if (value.requestDate) setRequestDate(value.requestDate);
      setContact(value.contact ?? "");
      setLocation(value.location ?? "PENANG");
      setManagerId(value.managerId ?? "");
      setDirectorId(value.directorId ?? "");
      setFinanceReviewerId(value.financeReviewerId ?? "");
      setFinanceReviewerRole(value.financeReviewerRole ?? "");
      setNotes(value.notes ?? "");
      setLines(value.lines?.length ? value.lines : [makeLine()]);
    },
  });

  function updateLine(id: string, patch: Partial<PettyCashRequestLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function buildInput(
    currentAccount: NonNullable<typeof account>,
  ): CreatePettyCashInput {
    return {
      organizationId: "beta-arus-org",
      requesterId: currentAccount.id,
      requesterRole: currentAccount.role,
      requesterName: currentAccount.name,
      requesterPosition: currentAccount.position,
      requesterContact: contact.trim(),
      requestDate,
      location,
      managerApproverId:
        currentAccount.role === "staff"
          ? managerId
          : currentAccount.role === "finance" &&
              financeReviewerRole === "manager"
            ? financeReviewerId
            : currentAccount.id,
      directorApproverId:
        currentAccount.role === "staff" || currentAccount.role === "manager"
          ? directorId
          : currentAccount.role === "finance" &&
              financeReviewerRole === "director"
            ? financeReviewerId
            : currentAccount.id,
      financeReviewerId:
        currentAccount.role === "finance" ? financeReviewerId : undefined,
      financeReviewerRole:
        currentAccount.role === "finance" && financeReviewerRole
          ? financeReviewerRole
          : undefined,
      lines,
      notes: notes.trim() || undefined,
    };
  }

  function review(event: FormEvent) {
    event.preventDefault();
    if (!account) {
      return setError("Sign in before submitting a Petty Cash request.");
    }
    const input = buildInput(account);
    const validation = validatePettyCashInput(input);
    if (validation) return setError(validation);
    if (!confirmed)
      return setError(
        "Confirm that the request information and supporting links are correct.",
      );
    setError("");
    setStage("REVIEW");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!account)
      return setError("Sign in before submitting a Petty Cash request.");
    const input = buildInput(account);
    setSaving(true);
    setError("");
    try {
      const record = initialRecord
        ? await resubmitPettyCashRequest(initialRecord.id, input)
        : await createPettyCashRequest(input);
      notifyPettyCashSubmitted(record, account);
      await draft.clearDraft();
      setCreated(record);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Petty Cash request could not be submitted.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (created)
    return (
      <PettyCashConfirmation
        request={created}
        onCreateAnother={() => {
          setCreated(null);
          setLines([makeLine()]);
          setNotes("");
          setConfirmed(false);
        }}
      />
    );

  if (stage === "REVIEW")
    return (
      <main className={styles.compactReviewPage}>
        <header className={styles.compactPageEyebrow}>Payment Requests / Petty Cash <strong>Review</strong></header>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <article className={styles.compactReviewCard}>
          <div className={styles.compactReviewMain}>
            <header className={styles.compactReviewHeader}>
              <span className={styles.compactTypeBadge}>PC</span><span>Petty Cash request</span>
              <h1>Review Petty Cash Request</h1>
              <p>Check the request before submitting it into the approval workflow.</p>
            </header>
            <section className={styles.compactReviewSection}>
              <h2>Request summary</h2>
              <dl className={styles.compactSummaryGrid}>
                <div><dt>Requester</dt><dd>{account?.name}</dd></div>
                <div><dt>Request date</dt><dd>{requestDate}</dd></div>
                <div><dt>Location</dt><dd>{location.replace("_", " ")}</dd></div>
                <div><dt>Entries</dt><dd>{lines.length}</dd></div>
                <div><dt>Notes</dt><dd>{notes || "—"}</dd></div>
              </dl>
            </section>
            <section className={styles.compactReviewSection}>
              <h2>Petty Cash entries <small>{lines.length} {lines.length === 1 ? "entry" : "entries"}</small></h2>
              <div className={styles.compactTableWrap}>
                <table className={styles.compactReviewTable}>
                  <thead><tr><th>#</th><th>Description</th><th>Purpose / account</th><th>Division</th><th>Amount</th></tr></thead>
                  <tbody>{lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.details}</td><td>{line.accountType}</td><td>{line.division}</td><td><strong>RM {Number(line.amount).toFixed(2)}</strong></td></tr>)}</tbody>
                  <tfoot><tr><td colSpan={4}>Total requested</td><td>RM {total.toFixed(2)}</td></tr></tfoot>
                </table>
              </div>
            </section>
          </div>
          <aside className={styles.compactReviewAside}>
            <span>Total requested</span><strong>RM {total.toFixed(2)}</strong>
            <small>{lines.length} {lines.length === 1 ? "entry" : "entries"} · Petty Cash</small>
            <div className={styles.compactNextStep}><span>What happens next</span><p>After submission, the request enters its role-aware approval workflow. Receipts and any unused balance are recorded during reconciliation.</p></div>
            <div className={styles.compactReviewActions}>
              <button className={styles.primaryButton} disabled={saving} type="button" onClick={submit}>{saving ? "Submitting…" : initialRecord ? "Resubmit request" : "Submit request"}</button>
            <button
              className={styles.secondaryButton}
              disabled={saving}
              type="button"
              onClick={() => setStage("FORM")}
            >
              Back to edit
            </button>
            </div>
          </aside>
        </article>
      </main>
    );

  return (
    <main className={styles.requestPage}>
      {initialRecord && (
        <div className={styles.formBackRow}>
          <Link
            href={`/beta/payment-records/petty-cash/${encodeURIComponent(initialRecord.requestNumber)}`}
          >
            ← Back to Petty Cash request
          </Link>
        </div>
      )}
      <header className={styles.requestHeader}>
        <div>
          <p>Payment Requests / Petty Cash</p>
          <h1>
            {initialRecord
              ? `Edit ${initialRecord.requestNumber}`
              : "New Petty Cash Request"}
          </h1>
        </div>
        <strong>{initialRecord ? "Correction" : "Draft"}</strong>
      </header>
      <form
        className={`${styles.formCard} ${styles.formPage}`}
        onSubmit={review}
      >
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <section className={styles.formGuidance}>
          <div>
            <span>Petty Cash</span>
            <h2>Request funds for planned work expenses below RM 300</h2>
          </div>
          <p>
            Request Petty Cash before purchasing. Receipts and any unused
            balance are recorded during reconciliation after Finance releases
            the money.
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
            <label>
              <span>Name</span>
              <input disabled value={account?.name ?? ""} />
            </label>
            <label>
              <span>Position</span>
              <input disabled value={account?.position ?? ""} />
            </label>
            <label>
              <span>
                Request date <em className={styles.requiredMark}>*</em>
              </span>
              <input
                type="date"
                value={requestDate}
                onChange={(event) => setRequestDate(event.target.value)}
              />
            </label>
            <label>
              <span>
                Contact <em className={styles.requiredMark}>*</em>
              </span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="Phone or email"
              />
            </label>
            <label>
              <span>
                Location <em className={styles.requiredMark}>*</em>
              </span>
              <select
                value={location}
                onChange={(event) =>
                  setLocation(
                    event.target.value as CreatePettyCashInput["location"],
                  )
                }
              >
                {PETTY_CASH_LOCATIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {(account?.role === "staff" || account?.role === "manager") && (
              <label>
                <span>
                  Director previewer <em className={styles.requiredMark}>*</em>
                </span>
                <select
                  value={directorId}
                  onChange={(event) => setDirectorId(event.target.value)}
                >
                  <option value="">Choose Director</option>
                  {directors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {account?.role === "staff" && (
              <label className={styles.fullWidthField}>
                <span>
                  Manager reviewer <em className={styles.requiredMark}>*</em>
                </span>
                <select
                  value={managerId}
                  onChange={(event) => setManagerId(event.target.value)}
                >
                  <option value="">Choose Manager</option>
                  {managers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {account?.role === "finance" && (
              <label>
                <span>
                  Independent previewer{" "}
                  <em className={styles.requiredMark}>*</em>
                </span>
                <select
                  value={
                    financeReviewerRole && financeReviewerId
                      ? `${financeReviewerRole}:${financeReviewerId}`
                      : ""
                  }
                  onChange={(event) => {
                    const [role, id] = event.target.value.split(":");
                    setFinanceReviewerRole(
                      (role as "manager" | "director" | "finance") || "",
                    );
                    setFinanceReviewerId(id || "");
                  }}
                >
                  <option value="">
                    Choose another Finance user, Manager or Director
                  </option>
                  {financeReviewers.map((item) => (
                    <option key={item.id} value={`${item.role}:${item.id}`}>
                      {item.name} ·{" "}
                      {item.role === "finance"
                        ? "Finance"
                        : item.role === "manager"
                          ? "Manager"
                          : "Director"}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>
        <section className={`${styles.card} ${styles.expenseSection}`}>
          <div className={styles.sectionHeading}>
            <div>
              <span>2</span>
              <div>
                <h2>Planned expense details</h2>
                <p>
                  Estimate how the Petty Cash will be used. Purchase receipts
                  are uploaded during reconciliation.
                </p>
              </div>
            </div>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setLines((current) => [...current, makeLine()])}
            >
              + Add planned expense
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.expenseTable}>
              <thead>
                <tr>
                  <th>Details / purpose</th>
                  <th>Type of account</th>
                  <th>Division</th>
                  <th>Estimated amount (RM)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <input
                        value={line.details}
                        onChange={(e) =>
                          updateLine(line.id, { details: e.target.value })
                        }
                        placeholder="What is the expense for?"
                      />
                    </td>
                    <td>
                      <select
                        value={line.accountType}
                        onChange={(e) =>
                          updateLine(line.id, { accountType: e.target.value })
                        }
                      >
                        <option value="">Choose account</option>
                        {line.accountType &&
                          !PETTY_CASH_ACCOUNT_TYPES.some(
                            (item) => item === line.accountType,
                          ) && (
                            <option value={line.accountType}>
                              {line.accountType} (saved value)
                            </option>
                          )}
                        {PETTY_CASH_ACCOUNT_TYPES.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={line.division}
                        onChange={(e) =>
                          updateLine(line.id, { division: e.target.value })
                        }
                      >
                        <option value="">Division</option>
                        {line.division &&
                          !DIVISION_TYPES.some(
                            (item) => item === line.division,
                          ) && (
                            <option value={line.division}>
                              {line.division} (saved value)
                            </option>
                          )}
                        {DIVISION_TYPES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <DecimalInput value={line.amount} onValueChange={(amount) => updateLine(line.id, { amount })} />
                    </td>
                    <td>
                      <button
                        aria-label="Remove expense"
                        className={styles.removeButton}
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((current) =>
                            current.filter((item) => item.id !== line.id),
                          )
                        }
                        type="button"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className={`${styles.totalBar} ${total >= PETTY_CASH_REQUEST_LIMIT ? styles.totalInvalid : ""}`}
          >
            <span className={styles.policyCopy}>
              <span>
                Policy status:{" "}
                <strong>
                  {total < PETTY_CASH_REQUEST_LIMIT
                    ? "Compliant"
                    : "Limit exceeded"}
                </strong>
                <small>
                  Total must remain below RM
                  {PETTY_CASH_REQUEST_LIMIT.toFixed(2)}
                </small>
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
            <input
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>
              I confirm that these planned expenses and estimated amounts are
              accurate.
            </span>
          </label>
          <div className={styles.draftActions}>
            <button
              className={styles.secondaryButton}
              disabled={draft.isSavingDraft || saving}
              type="button"
              onClick={() =>
                draft
                  .saveDraft()
                  .catch((caught) =>
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "The draft could not be saved.",
                    ),
                  )
              }
            >
              {draft.isSavingDraft ? "Saving draft…" : "Save as draft"}
            </button>
            <button
              className={styles.primaryButton}
              disabled={saving}
              type="submit"
            >
              Continue to review →
            </button>
          </div>
          {draft.draftMessage && (
            <small className={styles.draftMessage} role="status">
              {draft.draftMessage}
            </small>
          )}
        </section>
      </form>
    </main>
  );
}

function DecimalInput({ value, onValueChange }: { value: number; onValueChange: (value: number) => void }) {
  const [text, setText] = useState(value ? String(value) : "");
  return <input inputMode="decimal" placeholder="0.00" type="text" value={text}
    onBlur={() => { const numeric = Number(text.replace(",", ".")); setText(Number.isFinite(numeric) && text ? String(numeric) : ""); }}
    onChange={(event) => { const next = event.target.value; if (!/^\d*(?:[.,]\d{0,2})?$/.test(next)) return; setText(next); const numeric = Number(next.replace(",", ".")); onValueChange(Number.isFinite(numeric) ? numeric : 0); }} />;
}

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
import { isProjectManagerAccount } from "@/features/administration/admin-settings";
import { notifyPettyCashSubmitted } from "@/features/payment-request/notifications/petty-cash-notifications";
import { ManualDraftConfirmation } from "../../shared/manual-draft-confirmation";
import { ManualDraftStatus } from "../../shared/manual-draft-status";
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
  const [draftSaved, setDraftSaved] = useState(false);
  const [created, setCreated] = useState<PettyCashRecord | null>(null);
  const [stage, setStage] = useState<"FORM" | "REVIEW">("FORM");

  useEffect(() => setAccount(readBetaSession()), []);
  const managers = betaAccounts.filter(
    (item) => item.role === "manager" || isProjectManagerAccount(item),
  );
  const directors = betaAccounts.filter((item) => item.role === "director");
  const financeReviewers = betaAccounts.filter(
    (item) =>
      ["manager", "director"].includes(item.role) ||
      isProjectManagerAccount(item) ||
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

  if (draftSaved)
    return (
      <ManualDraftConfirmation
        createHref="/beta/payment-requests/petty-cash/new"
        paymentType="PETTY_CASH"
        recordsHref="/beta/payment-records/petty-cash?scope=mine"
      />
    );

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
        <header className={styles.compactPageEyebrow}>
          Payment Requests / Petty Cash <strong>Review</strong>
        </header>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <article className={styles.compactReviewCard}>
          <div className={styles.compactReviewMain}>
            <header className={styles.compactReviewHeader}>
              <span className={styles.compactTypeBadge}>PC</span>
              <span>Petty Cash request</span>
              <h1>Review Petty Cash Request</h1>
              <p>
                Check the request before submitting it into the approval
                workflow.
              </p>
            </header>
            <section className={styles.compactReviewSection}>
              <h2>Request summary</h2>
              <dl className={styles.compactSummaryGrid}>
                <div>
                  <dt>Requester</dt>
                  <dd>{account?.name}</dd>
                </div>
                <div>
                  <dt>Request date</dt>
                  <dd>{requestDate}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{location.replace("_", " ")}</dd>
                </div>
                <div>
                  <dt>Entries</dt>
                  <dd>{lines.length}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{notes || "—"}</dd>
                </div>
              </dl>
            </section>
            <section className={styles.compactReviewSection}>
              <h2>
                Petty Cash entries{" "}
                <small>
                  {lines.length} {lines.length === 1 ? "entry" : "entries"}
                </small>
              </h2>
              <div className={styles.compactTableWrap}>
                <table className={styles.compactReviewTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>Purpose / account</th>
                      <th>Division</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id}>
                        <td>{index + 1}</td>
                        <td>{line.details}</td>
                        <td>{line.accountType}</td>
                        <td>{line.division}</td>
                        <td>
                          <strong>RM {Number(line.amount).toFixed(2)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Total requested</td>
                      <td>RM {total.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
          <aside className={styles.compactReviewAside}>
            <span>Total requested</span>
            <strong>RM {total.toFixed(2)}</strong>
            <small>
              {lines.length} {lines.length === 1 ? "entry" : "entries"} · Petty
              Cash
            </small>
            <div className={styles.compactNextStep}>
              <span>What happens next</span>
              <p>
                After submission, the request enters its role-aware approval
                workflow. Receipts and any unused balance are recorded during
                reconciliation.
              </p>
            </div>
            <div className={styles.compactReviewActions}>
              <button
                className={styles.primaryButton}
                disabled={saving}
                type="button"
                onClick={submit}
              >
                {saving
                  ? "Submitting…"
                  : initialRecord
                    ? "Resubmit request"
                    : "Submit request"}
              </button>
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
          <p className={styles.pettyCashEyebrow}>
            <b>PC</b> Petty Cash
          </p>
          <h1>
            {initialRecord
              ? `Edit ${initialRecord.requestNumber}`
              : "New Petty Cash request"}
          </h1>
          <span>
            Request funds for planned work expenses below RM300. Receipts and
            any unused balance are recorded during reconciliation, after Finance
            releases the money.
          </span>
        </div>
        <strong>{initialRecord ? "Correction" : "Draft"}</strong>
      </header>
      <form className={styles.pettyForm} onSubmit={review}>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <div className={styles.pettyFormLayout}>
          <article className={styles.pettyMainCard}>
            <section className={styles.pettySection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>1</span>
                  <div>
                    <h2>Requester &amp; reviewers</h2>
                    <p>Your details are filled in from your profile.</p>
                  </div>
                </div>
              </div>
              <div className={styles.requesterProfile}>
                <b aria-hidden="true">
                  {(account?.name ?? "User")
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </b>
                <span>
                  <strong>{account?.name ?? "Signed-in requester"}</strong>
                  <small>
                    {account?.position ?? ""}
                    {account?.role ? ` · ${account.role}` : ""}
                  </small>
                </span>
              </div>
              <div className={styles.fieldGrid}>
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
                  <label
                    className={`${styles.reviewerField} ${account?.role === "manager"
                        ? styles.reviewerFieldFull
                        : ""
                      }`}
                  >
                    <span>
                      Director previewer{" "}
                      <em className={styles.requiredMark}>*</em>
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
                  <label className={styles.reviewerField}>
                    <span>
                      Manager reviewer{" "}
                      <em className={styles.requiredMark}>*</em>
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
                      {financeReviewers.map((item) => {
                        const reviewerRole = isProjectManagerAccount(item)
                          ? "manager"
                          : item.role;
                        return (
                          <option
                            key={item.id}
                            value={`${reviewerRole}:${item.id}`}
                          >
                            {item.name} ·{" "}
                            {reviewerRole === "finance"
                              ? "Finance"
                              : reviewerRole === "manager"
                                ? "Manager"
                                : "Director"}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                )}
              </div>
            </section>
            <section className={styles.pettySection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>2</span>
                  <div>
                    <h2>Planned expenses</h2>
                    <p>Estimate how the Petty Cash will be used.</p>
                  </div>
                </div>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() =>
                    setLines((current) => [...current, makeLine()])
                  }
                >
                  + Add expense
                </button>
              </div>
              <div className={styles.plannedExpenseList}>
                {lines.map((line, index) => (
                  <article className={styles.plannedExpenseCard} key={line.id}>
                    <header>
                      <strong>Expense {index + 1}</strong>
                      <button
                        aria-label={`Remove expense ${index + 1}`}
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
                    </header>
                    <label className={styles.expensePurposeField}>
                      <span>
                        Details / purpose{" "}
                        <em className={styles.requiredMark}>*</em>
                      </span>
                      <input
                        required
                        value={line.details}
                        onChange={(event) =>
                          updateLine(line.id, { details: event.target.value })
                        }
                        placeholder="What is this expense for?"
                      />
                    </label>
                    <div className={styles.expenseFieldGrid}>
                      <label>
                        <span>
                          Type of account{" "}
                          <em className={styles.requiredMark}>*</em>
                        </span>
                        <select
                          required
                          value={line.accountType}
                          onChange={(event) =>
                            updateLine(line.id, {
                              accountType: event.target.value,
                            })
                          }
                        >
                          <option value="">Choose account</option>
                          {line.accountType &&
                            !PETTY_CASH_ACCOUNT_TYPES.includes(
                              line.accountType as (typeof PETTY_CASH_ACCOUNT_TYPES)[number],
                            ) && (
                              <option value={line.accountType}>
                                {line.accountType} (saved value)
                              </option>
                            )}
                          {PETTY_CASH_ACCOUNT_TYPES.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>
                          Division <em className={styles.requiredMark}>*</em>
                        </span>
                        <select
                          required
                          value={line.division}
                          onChange={(event) =>
                            updateLine(line.id, {
                              division: event.target.value,
                            })
                          }
                        >
                          <option value="">Choose division</option>
                          {line.division &&
                            !DIVISION_TYPES.includes(
                              line.division as (typeof DIVISION_TYPES)[number],
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
                      </label>
                      <label>
                        <span>
                          Estimated amount (RM){" "}
                          <em className={styles.requiredMark}>*</em>
                        </span>
                        <DecimalInput
                          required
                          value={line.amount}
                          onValueChange={(amount) =>
                            updateLine(line.id, { amount })
                          }
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
              <p className={styles.receiptNote}>
                No receipt needed now. Upload purchase receipts when you
                reconcile.
              </p>
            </section>
            <section className={styles.pettySection}>
              <div className={styles.sectionHeading}>
                <div>
                  <span>3</span>
                  <div>
                    <h2>Purpose</h2>
                    <p>Give the approver the context they need.</p>
                  </div>
                </div>
              </div>
              <label className={styles.notesField}>
                <span>Notes / purpose justification</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add project context or an explanation for these expenses"
                />
              </label>
            </section>
          </article>
          <aside className={styles.pettySummaryCard}>
            <span>Request total</span>
            <strong>RM {total.toFixed(2)}</strong>
            <dl>
              <div>
                <dt>Request type</dt>
                <dd>Petty Cash</dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>{lines.length}</dd>
              </div>
              <div>
                <dt>Limit</dt>
                <dd>Below RM{PETTY_CASH_REQUEST_LIMIT.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>
                  RM
                  {Math.max(0, PETTY_CASH_REQUEST_LIMIT - total).toFixed(2)}
                </dd>
              </div>
            </dl>
            <div
              className={`${styles.pettyPolicyBox} ${total >= PETTY_CASH_REQUEST_LIMIT ? styles.pettyPolicyError : ""}`}
            >
              <b>Policy check</b>
              <p>
                {total < PETTY_CASH_REQUEST_LIMIT
                  ? `Compliant. The total must stay below RM${PETTY_CASH_REQUEST_LIMIT.toFixed(2)}.`
                  : `Limit exceeded. Reduce the total to below RM${PETTY_CASH_REQUEST_LIMIT.toFixed(2)}.`}
              </p>
            </div>
            <div className={styles.pettyNextBox}>
              <b>What happens next</b>
              <p>
                After approval, Finance releases the money. You then reconcile
                with receipts and return any unused balance.
              </p>
            </div>
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
                className={styles.primaryButton}
                disabled={saving || !confirmed}
                type="submit"
              >
                Continue to review →
              </button>
              <button
                className={styles.secondaryButton}
                disabled={draft.isSavingDraft || saving}
                type="button"
                onClick={() =>
                  draft
                    .saveDraft()
                    .then(() => setDraftSaved(true))
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
            </div>
            <ManualDraftStatus message={draft.draftMessage} />
          </aside>
        </div>
      </form>
    </main>
  );
}

function DecimalInput({
  required = false,
  value,
  onValueChange,
}: {
  required?: boolean;
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  return (
    <input
      inputMode="decimal"
      placeholder="0.00"
      required={required}
      type="text"
      value={text}
      onBlur={() => {
        const numeric = Number(text.replace(",", "."));
        setText(Number.isFinite(numeric) && text ? String(numeric) : "");
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*(?:[.,]\d{0,2})?$/.test(next)) return;
        setText(next);
        const numeric = Number(next.replace(",", "."));
        onValueChange(Number.isFinite(numeric) ? numeric : 0);
      }}
    />
  );
}

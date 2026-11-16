"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  createClaimRequest,
  fetchClaimPolicyContext,
  saveClaimDraft,
  submitClaimDraft,
} from "@/data/payment-requests/claims/api";
import { notifyClaimSubmitted } from "@/features/payment-request/notifications/claim-notifications";
import {
  claimLimit,
  claimLineAmount,
  claimTotal,
  MEDICAL_ANNUAL_LIMIT,
  mileageRate,
  validateClaimInput,
} from "@/domain/payment-requests/claims/policy";
import {
  CLAIM_ACCOUNT_TYPES,
  CLAIM_DIVISION_TYPES,
  CLAIM_TYPES,
  claimTypeDetails,
  type ClaimLine,
  type ClaimPolicyContext,
  type ClaimRecord,
  type ClaimType,
  type CreateClaimInput,
} from "@/domain/payment-requests/claims/types";
import { betaAccounts, readBetaSession } from "@/lib/auth/beta-accounts";

import { ClaimConfirmation } from "./claim-confirmation";
import { ManualDraftConfirmation } from "../shared/manual-draft-confirmation";
import { ManualDraftStatus } from "../shared/manual-draft-status";
import { useManualFormDraft } from "../shared/use-manual-form-draft";
import styles from "./claims.module.css";

type ClaimDraftSnapshot = {
  claimType: ClaimType;
  claimDate: string;
  contact: string;
  directorId: string;
  techExtended: boolean;
  lines: ClaimLine[];
  notes: string;
};

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
const makeLine = (): ClaimLine => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  expenseDate: today(),
  supplier: "",
  details: "",
  receiptFileName: "",
  receiptMimeType: "",
  receiptFileSize: 0,
  accountType: "",
  division: "",
  amount: 0,
  from: "",
  to: "",
  kilometers: 0,
});

const RECEIPT_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const RECEIPT_MAX_SIZE = 10 * 1024 * 1024;

function claimEntryLabel(type: ClaimType) {
  if (type === "INTERNET_COMMUTE") return "internet / commute expense";
  if (type === "MEDICAL") return "medical expense";
  if (type === "MILEAGE") return "mileage trip";
  if (type === "PD") return "PD expense";
  if (type === "TECH") return "tech expense";
  return "expense";
}

export function ClaimForm({
  initialRecord,
  resumeDraft = false,
}: { initialRecord?: ClaimRecord; resumeDraft?: boolean } = {}) {
  const [account] = useState<ReturnType<typeof readBetaSession>>(() =>
    readBetaSession(),
  );
  const [context, setContext] = useState<ClaimPolicyContext>({
    medicalUsedThisYear: 0,
  });
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [claimType, setClaimType] = useState<ClaimType>(
    initialRecord?.claimType ?? "EXPENSE",
  );
  const [claimDate, setClaimDate] = useState(
    initialRecord?.claimDate ?? today(),
  );
  const [contact, setContact] = useState(initialRecord?.requesterContact ?? "");
  const [directorId, setDirectorId] = useState(
    initialRecord?.directorApproverId ?? "",
  );
  const [techExtended, setTechExtended] = useState(
    initialRecord?.techExtended ?? false,
  );
  const [lines, setLines] = useState<ClaimLine[]>(initialRecord?.lines ?? []);
  const [receiptFiles, setReceiptFiles] = useState<Record<string, File>>({});
  const [entryModal, setEntryModal] = useState<{
    line: ClaimLine;
    mode: "ADD" | "EDIT";
  } | null>(null);
  const [entryReceipt, setEntryReceipt] = useState<File | undefined>();
  const [notes, setNotes] = useState(initialRecord?.notes ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<ClaimRecord | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [stage, setStage] = useState<"FORM" | "REVIEW">("FORM");

  const draft = useManualFormDraft<ClaimDraftSnapshot>({
    paymentType: "CLAIM",
    requesterId: account?.id,
    disabled: Boolean(initialRecord),
    restoreOnLoad: resumeDraft,
    getSnapshot: () => ({
      claimType,
      claimDate,
      contact,
      directorId,
      techExtended,
      lines: lines.map((line) => ({ ...line })),
      notes,
    }),
    restoreSnapshot: (snapshot) => {
      setClaimType(snapshot.claimType ?? "EXPENSE");
      setClaimDate(snapshot.claimDate ?? today());
      setContact(snapshot.contact ?? "");
      setDirectorId(snapshot.directorId ?? "");
      setTechExtended(Boolean(snapshot.techExtended));
      setLines(
        snapshot.lines?.length
          ? snapshot.lines.map((line) => ({ ...line }))
          : [],
      );
      setNotes(snapshot.notes ?? "");
      setReceiptFiles({});
      setConfirmed(false);
    },
  });

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setLoadingPolicy(true);
    fetchClaimPolicyContext({
      organizationId: "beta-arus-org",
      requesterId: account.id,
      claimDate,
    })
      .then((value) => {
        if (!cancelled) setContext(value);
      })
      .catch((caught) => {
        if (!cancelled)
          setError(
            caught instanceof Error
              ? caught.message
              : "Claim policy balances could not be loaded.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingPolicy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, claimDate]);

  const total = useMemo(() => claimTotal(claimType, lines), [claimType, lines]);
  const limit = claimLimit({ claimType, techExtended }, context);
  const type = claimTypeDetails(claimType);
  const limitExceeded = limit !== null && total > limit;

  function buildInput(
    currentAccount: NonNullable<typeof account>,
  ): CreateClaimInput {
    return {
      organizationId: "beta-arus-org",
      requesterId: currentAccount.id,
      requesterName: currentAccount.name,
      requesterPosition: currentAccount.position,
      requesterRole: currentAccount.role,
      requesterContact: contact.trim(),
      directorApproverId: directorId,
      claimDate,
      claimType,
      techExtended: claimType === "TECH" && techExtended,
      lines,
      notes: notes.trim() || undefined,
    };
  }

  function chooseType(next: ClaimType) {
    if (next === claimType) return;
    setClaimType(next);
    setTechExtended(false);
    setLines([]);
    setReceiptFiles({});
    setConfirmed(false);
    setError("");
  }

  function openNewEntry() {
    setEntryReceipt(undefined);
    setEntryModal({ line: makeLine(), mode: "ADD" });
  }

  function openEditEntry(line: ClaimLine) {
    setEntryReceipt(receiptFiles[line.id]);
    setEntryModal({ line: { ...line }, mode: "EDIT" });
  }

  function closeEntryModal() {
    setEntryModal(null);
    setEntryReceipt(undefined);
  }

  function saveEntry(addAnother = false) {
    if (!entryModal) return;
    const line = entryModal.line;
    const hasReceipt = Boolean(
      entryReceipt ||
      line.receiptDocumentId ||
      line.receiptLink?.trim() ||
      (line.receiptFileName.trim() && line.receiptFileSize > 0),
    );
    const incomplete =
      !line.expenseDate ||
      !line.details.trim() ||
      (claimType === "MILEAGE"
        ? !line.division.trim() ||
        !line.from.trim() ||
        !line.to.trim() ||
        line.kilometers <= 0
        : !line.supplier.trim() ||
        !hasReceipt ||
        line.amount <= 0 ||
        (claimType === "EXPENSE" &&
          (!line.accountType.trim() || !line.division.trim())));
    if (incomplete) {
      setError(
        claimType === "MILEAGE"
          ? "Complete the date, purpose, division, route and distance before saving this trip."
          : "Complete every required expense field and attach a receipt before saving.",
      );
      return;
    }
    setError("");
    setLines((current) =>
      entryModal.mode === "EDIT"
        ? current.map((item) => (item.id === line.id ? line : item))
        : [...current, line],
    );
    if (entryReceipt) {
      setReceiptFiles((current) => ({
        ...current,
        [line.id]: entryReceipt,
      }));
    } else if (line.receiptLink?.trim()) {
      setReceiptFiles((current) => {
        const next = { ...current };
        delete next[line.id];
        return next;
      });
    }
    if (addAnother) {
      setEntryReceipt(undefined);
      setEntryModal({ line: makeLine(), mode: "ADD" });
      return;
    }
    closeEntryModal();
  }

  function duplicateLine(line: ClaimLine) {
    const copy = { ...line, id: makeLine().id };
    setLines((current) => [...current, copy]);
    const receipt = receiptFiles[line.id];
    if (receipt) {
      setReceiptFiles((current) => ({ ...current, [copy.id]: receipt }));
    }
  }

  function removeLine(id: string) {
    setLines((current) => current.filter((line) => line.id !== id));
    setReceiptFiles((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function review(event: FormEvent) {
    event.preventDefault();
    if (!account) return setError("Sign in before creating a claim.");
    const input = buildInput(account);
    const validation = validateClaimInput(input, context);
    if (validation) return setError(validation);
    if (!confirmed)
      return setError(
        "Confirm that the claim information and supporting documents are correct.",
      );
    setError("");
    setStage("REVIEW");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!account) return setError("Sign in before creating a claim.");
    const input = buildInput(account);
    setSaving(true);
    setError("");
    try {
      const record = initialRecord
        ? await submitClaimDraft(initialRecord.id, input, receiptFiles)
        : await createClaimRequest(input, receiptFiles);
      notifyClaimSubmitted(record, account);
      if (!initialRecord) await draft.clearDraft();
      setCreated(record);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The claim could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!account) return setError("Sign in before saving a Claim draft.");
    setSaving(true);
    setError("");
    try {
      if (initialRecord) {
        const record = await saveClaimDraft(
          buildInput(account),
          receiptFiles,
          initialRecord.id,
        );
        setCreated(record);
      } else {
        await draft.saveDraft();
        setDraftSaved(true);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Claim draft could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (draftSaved)
    return (
      <ManualDraftConfirmation
        createHref="/beta/payment-requests/claims/new"
        paymentType="CLAIM"
        recordsHref="/beta/payment-records/claims?scope=mine"
      />
    );

  if (created)
    return (
      <ClaimConfirmation
        record={created}
        onCreateAnother={() => {
          if (initialRecord) {
            window.location.assign("/beta/payment-requests/claims/new");
            return;
          }
          setCreated(null);
          setClaimType("EXPENSE");
          setTechExtended(false);
          setLines([]);
          setReceiptFiles({});
          setNotes("");
          setConfirmed(false);
        }}
      />
    );

  if (stage === "REVIEW")
    return (
      <main className={styles.compactReviewPage}>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <article className={styles.compactReviewCard}>
          <div className={styles.compactReviewMain}>
            <header className={styles.compactReviewHeader}>
              <span className={styles.compactTypeBadge}>CL</span>
              <span>Claim request</span>
              <h1>Review Claim Request</h1>
              <p>
                Check the request before submitting it into the approval
                workflow.
              </p>
            </header>
            <section className={styles.compactReviewSection}>
              <h2>Claim summary</h2>
              <dl className={styles.compactSummaryGrid}>
                <div>
                  <dt>Requester</dt>
                  <dd>{account?.name}</dd>
                </div>
                <div>
                  <dt>Claim type</dt>
                  <dd>{type.label}</dd>
                </div>
                <div>
                  <dt>Claim date</dt>
                  <dd>{claimDate}</dd>
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
                Claim entries{" "}
                <small>
                  {lines.length} {lines.length === 1 ? "entry" : "entries"}
                </small>
              </h2>
              <div className={styles.compactTableWrap}>
                <table className={styles.compactReviewTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Receipt</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id}>
                        <td>{index + 1}</td>
                        <td>{line.expenseDate || "—"}</td>
                        <td>{line.accountType || type.label}</td>
                        <td>{line.details || "—"}</td>
                        <td>
                          {line.receiptFileName ||
                            (line.receiptLink ? "Receipt link" : "—")}
                        </td>
                        <td>
                          <strong>
                            RM {claimLineAmount(claimType, line).toFixed(2)}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5}>Total claimed</td>
                      <td>RM {total.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
          <aside className={styles.compactReviewAside}>
            <span>Total claimed</span>
            <strong>RM {total.toFixed(2)}</strong>
            <small>
              {lines.length} {lines.length === 1 ? "entry" : "entries"} ·{" "}
              {type.label}
            </small>
            <div className={styles.compactNextStep}>
              <span>What happens next</span>
              <p>After you submit, the claim enters the approval workflow.</p>
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
                    ? "Submit draft →"
                    : "Submit claim →"}
              </button>
              <button
                className={styles.draftButton}
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
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.claimEyebrow}>
            <b>CL</b> Claims
          </span>
          <h1>{resumeDraft ? "Continue Claim draft" : "New claim request"}</h1>
          <p>
            {resumeDraft
              ? "Review and complete your saved information before submitting it into the approval workflow."
              : "Submit claims and itemized expenses with automatic policy checks."}
          </p>
        </div>
      </header>
      <form className={styles.claimForm} onSubmit={review}>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.claimFormLayout}>
          <article className={styles.sheet}>
            <section className={styles.section}>
              <SectionHeading
                number="1"
                title="Claim type"
                copy="Choose what you are claiming. The entry form changes automatically."
              />
              <div
                className={styles.claimTypeTabs}
                role="group"
                aria-label="Claim type"
              >
                {CLAIM_TYPES.map((item) => (
                  <button
                    aria-pressed={claimType === item.value}
                    key={item.value}
                    onClick={() => chooseType(item.value)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className={styles.selectedPolicy}>
                <strong>{type.label}</strong>
                <span>{type.description}</span>
                <b>
                  {limit === null
                    ? "No monetary cap"
                    : `RM ${limit.toFixed(2)} limit`}
                </b>
              </div>
              <div
                className={`${styles.policyChoice} ${context.techExtendedLockedUntil && claimType === "TECH" ? styles.policyLocked : ""}`}
              >
                <div className={styles.policyDescription}>
                  <i aria-hidden="true" />
                  <p>
                    <strong>{type.label} policy:</strong> {type.description}
                  </p>
                </div>
                {claimType === "TECH" && (
                  <>
                    <label className={styles.extendedChoice}>
                      <input
                        checked={techExtended}
                        disabled={Boolean(context.techExtendedLockedUntil)}
                        onChange={(event) =>
                          setTechExtended(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>
                        <strong>
                          Use the extended RM1,000.00 Tech allowance
                        </strong>
                        <small>
                          Prevents another Tech claim for three calendar years
                          after submission.
                        </small>
                      </span>
                    </label>
                    {context.techExtendedLockedUntil && (
                      <p className={styles.lockMessage}>
                        Tech claims are locked until{" "}
                        {displayDate(context.techExtendedLockedUntil)}.
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.headingRow}>
                <SectionHeading number="2" title="Claimant & approver" />
                <span>Signed-in profile verified</span>
              </div>
              <div className={styles.fieldGrid}>
                <label>
                  <span>Staff name</span>
                  <input disabled value={account?.name ?? ""} />
                </label>
                <label>
                  <span>Position & title</span>
                  <input disabled value={account?.position ?? ""} />
                </label>
                <label>
                  <span>Role</span>
                  <input
                    disabled
                    value={account ? roleLabel(account.role) : ""}
                  />
                </label>
                <label>
                  <span>Claim date</span>
                  <input
                    required
                    type="date"
                    value={claimDate}
                    onChange={(event) => setClaimDate(event.target.value)}
                  />
                </label>
                <label className={styles.halfField}>
                  <span>
                    Contact details (notification & audit trail){" "}
                    <em className={styles.requiredMark}>*</em>
                  </span>
                  <input
                    required
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="Phone number or email"
                  />
                </label>
                {account && (
                  <label className={styles.halfField}>
                    <span>
                      Final approving Director{" "}
                      <em className={styles.requiredMark}>*</em>
                    </span>
                    <select
                      required
                      value={directorId}
                      onChange={(event) => setDirectorId(event.target.value)}
                    >
                      <option value="">Choose a Director</option>
                      {betaAccounts
                        .filter(
                          (item) =>
                            item.role === "director" && item.id !== account.id,
                        )
                        .map((director) => (
                          <option key={director.id} value={director.id}>
                            {director.name} — {director.position}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.itemsHeading}>
                <SectionHeading
                  number="3"
                  title={
                    claimType === "MILEAGE"
                      ? "Itemized trips"
                      : "Itemized expenses"
                  }
                  copy={
                    claimType === "MILEAGE"
                      ? "Enter the route and distance for every trip."
                      : "Attach a merchant receipt and state the operational purpose for each line item."
                  }
                />
                <button
                  className={styles.secondaryButton}
                  onClick={openNewEntry}
                  type="button"
                >
                  + Add {claimEntryLabel(claimType)}
                </button>
              </div>
              {lines.length ? (
                <ClaimEntriesTable
                  claimType={claimType}
                  lines={lines}
                  onDuplicate={duplicateLine}
                  onEdit={openEditEntry}
                  onRemove={removeLine}
                />
              ) : (
                <div className={styles.emptyEntries}>
                  <strong>No {claimEntryLabel(claimType)} added yet</strong>
                  <span>
                    Add your first {claimEntryLabel(claimType)} and attach its
                    supporting information.
                  </span>
                  <button onClick={openNewEntry} type="button">
                    + Add {claimEntryLabel(claimType)}
                  </button>
                </div>
              )}
              <PolicyBar
                claimType={claimType}
                context={context}
                limit={limit}
                limitExceeded={limitExceeded}
                loading={loadingPolicy}
                techExtended={techExtended}
                total={total}
              />
            </section>

            <section className={styles.section}>
              <SectionHeading
                number="4"
                title="Purpose & context justification"
              />
              <label className={styles.notesField}>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add clear operational context that will help the reviewer understand this claim"
                />
                <small>
                  Explain the business purpose to support Director review and
                  Finance verification.
                </small>
              </label>
            </section>

            <footer className={styles.submitSection}>
              {!initialRecord && (
                <ManualDraftStatus message={draft.draftMessage} />
              )}
              <label className={styles.declaration}>
                <input
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I confirm that this claim is accurate, complies with Estuary
                  policies, and all uploaded documents relate directly to the
                  expenses listed.
                </span>
              </label>
              <div className={styles.actions}>
                <button
                  className={styles.draftButton}
                  disabled={saving || draft.isSavingDraft}
                  onClick={saveDraft}
                  type="button"
                >
                  {saving || draft.isSavingDraft
                    ? "Saving…"
                    : initialRecord
                      ? "Save draft changes"
                      : "Save as draft"}
                </button>
                <button
                  className={styles.primaryButton}
                  disabled={
                    saving ||
                    loadingPolicy ||
                    Boolean(
                      context.techExtendedLockedUntil && claimType === "TECH",
                    )
                  }
                  type="submit"
                >
                  {saving
                    ? "Submitting…"
                    : loadingPolicy
                      ? "Checking policy…"
                      : "Continue to review →"}
                </button>
              </div>
            </footer>
          </article>
          <aside className={styles.claimSummaryCard}>
            <span>Claim total</span>
            <strong>RM {total.toFixed(2)}</strong>
            <dl>
              <div>
                <dt>Claim type</dt>
                <dd>{type.label}</dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>{lines.length}</dd>
              </div>
              <div>
                <dt>Missing receipts</dt>
                <dd>
                  {claimType === "MILEAGE"
                    ? 0
                    : lines.filter(
                      (line) =>
                        !line.receiptFileName &&
                        !line.receiptLink &&
                        !line.receiptDocumentId,
                    ).length}
                </dd>
              </div>
              <div>
                <dt>Limit</dt>
                <dd>{limit === null ? "No cap" : `RM ${limit.toFixed(2)}`}</dd>
              </div>
            </dl>
            <div className={styles.summaryPolicy}>
              <b>Policy check</b>
              <p>
                {limitExceeded
                  ? "The current total is above the available policy limit."
                  : type.description}
              </p>
            </div>
          </aside>
        </div>
      </form>
      {entryModal && (
        <ClaimEntryModal
          claimType={claimType}
          line={entryModal.line}
          mode={entryModal.mode}
          receipt={entryReceipt}
          onCancel={closeEntryModal}
          onChange={(patch) =>
            setEntryModal((current) =>
              current
                ? { ...current, line: { ...current.line, ...patch } }
                : current,
            )
          }
          onReceipt={(file) => {
            if (!file) {
              setEntryReceipt(undefined);
              setEntryModal((current) =>
                current
                  ? {
                    ...current,
                    line: {
                      ...current.line,
                      receiptDocumentId: undefined,
                      receiptFileName: "",
                      receiptMimeType: "",
                      receiptFileSize: 0,
                    },
                  }
                  : current,
              );
              return;
            }
            if (!RECEIPT_TYPES.includes(file.type)) {
              setError("Upload receipts as PDF, JPG or PNG files.");
              return;
            }
            if (file.size > RECEIPT_MAX_SIZE) {
              setError("Each receipt must be 10 MB or smaller.");
              return;
            }
            setError("");
            setEntryReceipt(file);
            setEntryModal((current) =>
              current
                ? {
                  ...current,
                  line: {
                    ...current.line,
                    receiptLink: undefined,
                    receiptFileName: file.name,
                    receiptMimeType: file.type,
                    receiptFileSize: file.size,
                  },
                }
                : current,
            );
          }}
          onSave={saveEntry}
        />
      )}
    </div>
  );
}

function ClaimEntriesTable({
  claimType,
  lines,
  onDuplicate,
  onEdit,
  onRemove,
}: {
  claimType: ClaimType;
  lines: ClaimLine[];
  onDuplicate: (line: ClaimLine) => void;
  onEdit: (line: ClaimLine) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className={styles.entriesTableWrap}>
      <table className={styles.entriesTable}>
        <thead>
          <tr>
            <th>Date</th>
            <th>{claimType === "MILEAGE" ? "Trip" : "Expense"}</th>
            <th>{claimType === "MILEAGE" ? "Distance" : "Receipt"}</th>
            <th>Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>{displayDate(line.expenseDate)}</td>
              <td>
                <strong>{line.details}</strong>
                <span>
                  {claimType === "MILEAGE"
                    ? `${line.from} → ${line.to}`
                    : line.supplier}
                </span>
              </td>
              <td>
                {claimType === "MILEAGE" ? (
                  `${line.kilometers} km`
                ) : (
                  <span className={styles.uploadedBadge}>Uploaded</span>
                )}
              </td>
              <td>
                <strong>
                  RM {claimLineAmount(claimType, line).toFixed(2)}
                </strong>
              </td>
              <td>
                <div className={styles.entryActions}>
                  <button onClick={() => onEdit(line)} type="button">
                    Edit
                  </button>
                  <button onClick={() => onDuplicate(line)} type="button">
                    Duplicate
                  </button>
                  <button
                    aria-label={`Remove ${line.details}`}
                    className={styles.entryRemove}
                    onClick={() => onRemove(line.id)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClaimEntryModal({
  claimType,
  line,
  mode,
  receipt,
  onCancel,
  onChange,
  onReceipt,
  onSave,
}: {
  claimType: ClaimType;
  line: ClaimLine;
  mode: "ADD" | "EDIT";
  receipt?: File;
  onCancel: () => void;
  onChange: (patch: Partial<ClaimLine>) => void;
  onReceipt: (file?: File) => void;
  onSave: (addAnother?: boolean) => void;
}) {
  const mileage = claimType === "MILEAGE";
  const generalExpense = claimType === "EXPENSE";
  const entryLabel = claimEntryLabel(claimType);
  const [proofMode, setProofMode] = useState<"UPLOAD" | "DRIVE">(() =>
    line.receiptLink ? "DRIVE" : "UPLOAD",
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onCancel]);

  return (
    <div
      aria-labelledby="claim-entry-title"
      aria-modal="true"
      className={styles.entryModalBackdrop}
      role="dialog"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
    >
      <section className={styles.entryModal}>
        <header>
          <div>
            <span>{mode === "EDIT" ? "Edit entry" : "New entry"}</span>
            <h2 id="claim-entry-title">
              {mode === "EDIT" ? `Edit ${entryLabel}` : `Add ${entryLabel}`}
            </h2>
            <p>
              {mileage
                ? "Add one journey and its distance."
                : `Add one ${entryLabel} and attach its proof.`}
            </p>
          </div>
          <button
            aria-label="Close entry form"
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </header>

        <div className={styles.entryModalFields}>
          <label>
            <span>
              Date <em>*</em>
            </span>
            <input
              required
              type="date"
              value={line.expenseDate}
              onChange={(event) =>
                onChange({ expenseDate: event.target.value })
              }
            />
          </label>
          {mileage ? (
            <>
              <label>
                <span>
                  Total distance (km) <em>*</em>
                </span>
                <DecimalInput
                  placeholder="0.0"
                  value={line.kilometers}
                  onValueChange={(kilometers) => onChange({ kilometers })}
                />
              </label>
              <label>
                <span>
                  From <em>*</em>
                </span>
                <input
                  value={line.from}
                  onChange={(event) => onChange({ from: event.target.value })}
                  placeholder="Starting point"
                />
              </label>
              <label>
                <span>
                  To <em>*</em>
                </span>
                <input
                  value={line.to}
                  onChange={(event) => onChange({ to: event.target.value })}
                  placeholder="Destination"
                />
              </label>
              <label className={styles.modalFullField}>
                <span>
                  Division <em>*</em>
                </span>
                <select
                  value={line.division}
                  onChange={(event) =>
                    onChange({ division: event.target.value })
                  }
                >
                  <option value="">Choose division</option>
                  {CLAIM_DIVISION_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                <span>
                  Amount (RM) <em>*</em>
                </span>
                <DecimalInput
                  placeholder="0.00"
                  value={line.amount}
                  onValueChange={(amount) => onChange({ amount })}
                />
              </label>
              <label className={styles.modalFullField}>
                <span>
                  Supplier / merchant <em>*</em>
                </span>
                <input
                  value={line.supplier}
                  onChange={(event) =>
                    onChange({ supplier: event.target.value })
                  }
                  placeholder="Where was it bought?"
                />
              </label>
              {generalExpense && (
                <>
                  <label>
                    <span>
                      Type of account <em>*</em>
                    </span>
                    <select
                      value={line.accountType}
                      onChange={(event) =>
                        onChange({ accountType: event.target.value })
                      }
                    >
                      <option value="">Choose account</option>
                      {CLAIM_ACCOUNT_TYPES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>
                      Division <em>*</em>
                    </span>
                    <select
                      value={line.division}
                      onChange={(event) =>
                        onChange({ division: event.target.value })
                      }
                    >
                      <option value="">Choose division</option>
                      {CLAIM_DIVISION_TYPES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </>
          )}
          <label className={styles.modalFullField}>
            <span>
              Description & purpose <em>*</em>
            </span>
            <input
              value={line.details}
              onChange={(event) => onChange({ details: event.target.value })}
              placeholder={
                mileage
                  ? "Why was this journey required?"
                  : "What was purchased and why?"
              }
            />
          </label>
          {!mileage && (
            <div className={styles.modalFullField}>
              <span>
                Receipt / proof <em>*</em>
              </span>
              <div
                aria-label="Proof method"
                className={styles.proofMethodTabs}
                role="group"
              >
                <button
                  aria-pressed={proofMode === "UPLOAD"}
                  onClick={() => {
                    setProofMode("UPLOAD");
                    onChange({ receiptLink: undefined });
                  }}
                  type="button"
                >
                  Upload file
                </button>
                <button
                  aria-pressed={proofMode === "DRIVE"}
                  onClick={() => {
                    setProofMode("DRIVE");
                    onReceipt(undefined);
                  }}
                  type="button"
                >
                  Google Drive link
                </button>
              </div>
              {proofMode === "UPLOAD" ? (
                <label className={styles.modalReceiptUpload}>
                  <input
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    onChange={(event) => onReceipt(event.target.files?.[0])}
                    type="file"
                  />
                  <b>Choose file</b>
                  <small>
                    {receipt?.name ??
                      line.receiptFileName ??
                      "PDF, JPG or PNG · max 10 MB"}
                  </small>
                </label>
              ) : (
                <div className={styles.driveProofField}>
                  <p>
                    Paste a Google Drive link to the receipt, invoice or
                    e-receipt for this expense.
                  </p>
                  <div>
                    <input
                      inputMode="url"
                      placeholder="https://drive.google.com/file/d/.../view"
                      type="url"
                      value={line.receiptLink ?? ""}
                      onChange={(event) =>
                        onChange({ receiptLink: event.target.value })
                      }
                    />
                    {line.receiptLink?.trim() && <b>Link added</b>}
                  </div>
                  <small>
                    Share the file with Finance, or set it to “Anyone with the
                    link can view”.
                  </small>
                </div>
              )}
            </div>
          )}
        </div>

        <footer>
          <span>
            {mode === "EDIT"
              ? "Update this entry"
              : "Add this entry to the claim"}
          </span>
          <div>
            <button
              className={styles.modalCancel}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
            {mode === "ADD" && (
              <button
                className={styles.modalSecondary}
                onClick={() => onSave(true)}
                type="button"
              >
                Save & add another
              </button>
            )}
            <button
              className={styles.modalPrimary}
              onClick={() => onSave(false)}
              type="button"
            >
              Save {entryLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function ExpenseTable({
  claimType,
  lines,
  receiptFiles,
  selectReceipt,
  updateLine,
  removeLine,
}: {
  claimType: ClaimType;
  lines: ClaimLine[];
  receiptFiles: Record<string, File>;
  selectReceipt: (lineId: string, file?: File) => void;
  updateLine: (id: string, patch: Partial<ClaimLine>) => void;
  removeLine: (id: string) => void;
}) {
  const expense = claimType === "EXPENSE";
  return (
    <table className={styles.claimTable}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Supplier / merchant</th>
          <th>Description & purpose</th>
          {expense && (
            <>
              <th>Type of account</th>
              <th>Division</th>
            </>
          )}
          <th>Receipt / proof</th>
          <th>Amount (RM)</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id}>
            <td>
              <input
                type="date"
                value={line.expenseDate}
                onChange={(event) =>
                  updateLine(line.id, { expenseDate: event.target.value })
                }
              />
            </td>
            <td>
              <input
                value={line.supplier}
                onChange={(event) =>
                  updateLine(line.id, { supplier: event.target.value })
                }
                placeholder="Supplier"
              />
            </td>
            <td>
              <input
                value={line.details}
                onChange={(event) =>
                  updateLine(line.id, { details: event.target.value })
                }
                placeholder="What is this expense for?"
              />
            </td>
            {expense && (
              <>
                <td>
                  <select
                    value={line.accountType}
                    onChange={(event) =>
                      updateLine(line.id, { accountType: event.target.value })
                    }
                  >
                    <option value="">Choose account</option>
                    {CLAIM_ACCOUNT_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={line.division}
                    onChange={(event) =>
                      updateLine(line.id, { division: event.target.value })
                    }
                  >
                    <option value="">Choose division</option>
                    {CLAIM_DIVISION_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </td>
              </>
            )}
            <td>
              {line.receiptLink && !receiptFiles[line.id] ? (
                <div className={styles.receiptLink}>
                  <a href={line.receiptLink} rel="noreferrer" target="_blank">
                    Open receipt ↗
                  </a>
                  <label>
                    <input
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      onChange={(event) =>
                        selectReceipt(line.id, event.target.files?.[0])
                      }
                      type="file"
                    />
                    Replace with upload
                  </label>
                </div>
              ) : (
                <label
                  className={`${styles.receiptUpload} ${receiptFiles[line.id] || line.receiptDocumentId ? styles.receiptAttached : ""}`}
                >
                  <input
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    onChange={(event) =>
                      selectReceipt(line.id, event.target.files?.[0])
                    }
                    type="file"
                  />
                  <span>
                    {receiptFiles[line.id] || line.receiptDocumentId
                      ? "✓"
                      : "↑"}
                  </span>
                  <strong>
                    {(receiptFiles[line.id]?.name ?? line.receiptFileName) ||
                      "Upload receipt"}
                  </strong>
                  <small>
                    {receiptFiles[line.id]
                      ? formatFileSize(receiptFiles[line.id].size)
                      : line.receiptDocumentId
                        ? "Saved receipt · replace"
                        : "PDF, JPG or PNG"}
                  </small>
                </label>
              )}
            </td>
            <td>
              <DecimalInput
                value={line.amount}
                placeholder="0.00"
                onValueChange={(amount) => updateLine(line.id, { amount })}
              />
            </td>
            <td>
              <RemoveButton
                disabled={lines.length === 1}
                onClick={() => removeLine(line.id)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MileageTable({
  lines,
  updateLine,
  removeLine,
}: {
  lines: ClaimLine[];
  updateLine: (id: string, patch: Partial<ClaimLine>) => void;
  removeLine: (id: string) => void;
}) {
  return (
    <table className={`${styles.claimTable} ${styles.mileageTable}`}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Details / purpose</th>
          <th>Division</th>
          <th>From</th>
          <th>To</th>
          <th>Total km</th>
          <th>Rate / km</th>
          <th>Total (RM)</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id}>
            <td>
              <input
                type="date"
                value={line.expenseDate}
                onChange={(event) =>
                  updateLine(line.id, { expenseDate: event.target.value })
                }
              />
            </td>
            <td>
              <input
                value={line.details}
                onChange={(event) =>
                  updateLine(line.id, { details: event.target.value })
                }
                placeholder="Project or trip purpose"
              />
            </td>
            <td>
              <select
                value={line.division}
                onChange={(event) =>
                  updateLine(line.id, { division: event.target.value })
                }
              >
                <option value="">Choose division</option>
                {CLAIM_DIVISION_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <input
                value={line.from}
                onChange={(event) =>
                  updateLine(line.id, { from: event.target.value })
                }
                placeholder="Starting point"
              />
            </td>
            <td>
              <input
                value={line.to}
                onChange={(event) =>
                  updateLine(line.id, { to: event.target.value })
                }
                placeholder="Destination"
              />
            </td>
            <td>
              <DecimalInput
                value={line.kilometers}
                placeholder="0.1"
                onValueChange={(kilometers) =>
                  updateLine(line.id, { kilometers })
                }
              />
            </td>
            <td>
              <strong>RM {mileageRate(line.kilometers).toFixed(2)}</strong>
            </td>
            <td>
              <strong>RM {claimLineAmount("MILEAGE", line).toFixed(2)}</strong>
            </td>
            <td>
              <RemoveButton
                disabled={lines.length === 1}
                onClick={() => removeLine(line.id)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DecimalInput({
  value,
  placeholder,
  onValueChange,
}: {
  value: number;
  placeholder: string;
  onValueChange: (value: number) => void;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  return (
    <input
      inputMode="decimal"
      placeholder={placeholder}
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

function PolicyBar({
  claimType,
  context,
  limit,
  limitExceeded,
  loading,
  techExtended,
  total,
}: {
  claimType: ClaimType;
  context: ClaimPolicyContext;
  limit: number | null;
  limitExceeded: boolean;
  loading: boolean;
  techExtended: boolean;
  total: number;
}) {
  let copy =
    "No monetary limit applies. Supporting documents are still required.";
  if (claimType === "INTERNET_COMMUTE")
    copy = "Maximum RM70.00 for this claim.";
  if (claimType === "MEDICAL")
    copy = `RM${context.medicalUsedThisYear.toFixed(2)} used of the RM${MEDICAL_ANNUAL_LIMIT.toFixed(2)} annual allowance. RM${(limit ?? 0).toFixed(2)} remains.`;
  if (claimType === "MILEAGE")
    copy =
      "RM0.50/km for a trip up to 500km; RM0.30/km when that trip exceeds 500km.";
  if (claimType === "PD") copy = "Maximum RM500.00 for this PD claim.";
  if (claimType === "TECH")
    copy = techExtended
      ? "Extended RM1,000.00 option selected. A three-year Tech claim lock starts after submission."
      : "Standard Tech claim limit: RM500.00.";
  return (
    <div
      className={`${styles.policyBar} ${limitExceeded ? styles.policyError : ""}`}
    >
      <div>
        <span>
          <strong>
            {limitExceeded
              ? "Policy limit exceeded"
              : loading
                ? "Checking policy"
                : "Policy check"}
          </strong>
          <small>
            {loading
              ? "Reading your current allowance usage from the database…"
              : copy}
          </small>
        </span>
      </div>
      <span>
        <small>Claim total</small>
        <strong>RM {total.toFixed(2)}</strong>
      </span>
    </div>
  );
}

function SectionHeading({
  number,
  title,
  copy,
}: {
  number: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <h2>
          {number}. {title}
        </h2>
        {copy && <p>{copy}</p>}
      </div>
    </div>
  );
}

function RemoveButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label="Remove row"
      className={styles.removeButton}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      ×
    </button>
  );
}

function roleLabel(role: string) {
  return role === "manager"
    ? "Manager"
    : role === "director"
      ? "Director"
      : role === "finance"
        ? "Finance"
        : "Staff";
}
function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}
function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

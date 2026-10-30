"use client";

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";

import {
  createCashAdvance,
  resubmitCashAdvance,
} from "@/data/payment-requests/cash-advance/cash-advance-api";
import { notifyCashAdvanceSubmitted } from "@/features/payment-request/notifications/cash-advance-notifications";
import { useManualFormDraft } from "@/features/payment-request/components/shared/use-manual-form-draft";
import {
  cashAdvanceRequestedTotal,
  validateCashAdvanceRequest,
} from "@/domain/payment-requests/cash-advance/policy";
import {
  CASH_ADVANCE_PROJECTS,
  type CashAdvanceDocument,
  type CashAdvanceRecord,
  type CashAdvanceRequestLine,
} from "@/domain/payment-requests/cash-advance/types";
import { betaAccounts, readBetaSession } from "@/lib/auth/beta-accounts";
import { useUserSignature } from "@/features/signatures/hooks/use-user-signature";
import { BANK_NAME_SELECT_OPTIONS } from "@/shared/constants/payment-options";
import { CashAdvanceConfirmation } from "./cash-advance-confirmation";
import {
  CashAdvanceRequestGoogleSheet,
  type CashAdvanceRequestSheetData,
} from "./cash-advance-request-google-sheet";
import { CashAdvanceRequestLines } from "./cash-advance-request-lines";
import { CashAdvanceReview } from "./cash-advance-review";
import styles from "../cash-advance.module.css";

const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
const makeLine = (): CashAdvanceRequestLine => ({
  id: crypto.randomUUID(),
  description: "",
  purpose: "",
  amount: 0,
});

function normalizeBankName(value?: string | null) {
  const bankName = value?.trim() ?? "";
  return (
    BANK_NAME_SELECT_OPTIONS.find(
      (option) => option.value.toLowerCase() === bankName.toLowerCase(),
    )?.value ?? bankName
  );
}

function readFile(file: File): Promise<CashAdvanceDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            dataUrl: reader.result,
          })
        : reject(new Error(`${file.name} could not be read.`));
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

export function CashAdvanceForm({
  initialRecord,
}: {
  initialRecord?: CashAdvanceRecord;
}) {
  const [account] = useState<ReturnType<typeof readBetaSession>>(() =>
    readBetaSession(),
  );
  const [requestDate, setRequestDate] = useState(
    initialRecord?.requestDate ?? today(),
  );
  const [contact, setContact] = useState(initialRecord?.requesterContact ?? "");
  const [accountHolderName, setAccountHolderName] = useState(
    initialRecord?.accountHolderName ??
      account?.name ?? "",
  );
  const [bankName, setBankName] = useState(
    normalizeBankName(initialRecord?.bankName),
  );
  const [bankAccountNumber, setBankAccountNumber] = useState(
    initialRecord?.bankAccountNumber ?? "",
  );
  const [projectName, setProjectName] = useState(
    initialRecord?.projectName ?? "",
  );
  const [otherProject, setOtherProject] = useState(
    initialRecord?.isOtherProject ? initialRecord.projectName : "",
  );
  const [isOtherProject, setIsOtherProject] = useState(
    initialRecord?.isOtherProject ?? false,
  );
  const [managerId, setManagerId] = useState(
    initialRecord?.managerApproverId ?? "",
  );
  const [directorId, setDirectorId] = useState(
    initialRecord?.directorApproverId ?? "",
  );
  const [purpose, setPurpose] = useState(initialRecord?.purpose ?? "");
  const [remarks, setRemarks] = useState(initialRecord?.remarks ?? "");
  const [lines, setLines] = useState<CashAdvanceRequestLine[]>(
    initialRecord?.lines ?? [makeLine()],
  );
  const [documents, setDocuments] = useState<CashAdvanceDocument[]>(
    initialRecord?.supportingDocuments ?? [],
  );
  const [entryMode, setEntryMode] = useState<"MANUAL" | "GOOGLE_SHEET">(
    "MANUAL",
  );
  const [sheetMessage, setSheetMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [stage, setStage] = useState<"FORM" | "REVIEW" | "CONFIRMATION">(
    "FORM",
  );
  const [submittedRecord, setSubmittedRecord] =
    useState<CashAdvanceRecord | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const draft = useManualFormDraft({
    paymentType: "CASH_ADVANCE",
    requesterId: account?.id,
    disabled: Boolean(initialRecord) || entryMode !== "MANUAL",
    getSnapshot: () => ({
      requestDate,
      contact,
      accountHolderName,
      bankName,
      bankAccountNumber,
      projectName,
      otherProject,
      isOtherProject,
      managerId,
      directorId,
      purpose,
      remarks,
      lines,
      documents,
    }),
    restoreSnapshot: (value: {
      requestDate?: string;
      contact?: string;
      accountHolderName?: string;
      bankName?: string;
      bankAccountNumber?: string;
      projectName?: string;
      otherProject?: string;
      isOtherProject?: boolean;
      managerId?: string;
      directorId?: string;
      purpose?: string;
      remarks?: string;
      lines?: CashAdvanceRequestLine[];
      documents?: CashAdvanceDocument[];
    }) => {
      if (value.requestDate) setRequestDate(value.requestDate);
      setContact(value.contact ?? "");
      setAccountHolderName(value.accountHolderName ?? "");
      setBankName(normalizeBankName(value.bankName));
      setBankAccountNumber(value.bankAccountNumber ?? "");
      setProjectName(value.projectName ?? "");
      setOtherProject(value.otherProject ?? "");
      setIsOtherProject(value.isOtherProject ?? false);
      setManagerId(value.managerId ?? "");
      setDirectorId(value.directorId ?? "");
      setPurpose(value.purpose ?? "");
      setRemarks(value.remarks ?? "");
      setLines(value.lines?.length ? value.lines : [makeLine()]);
      setDocuments(value.documents ?? []);
    },
  });

  const { signature: activeSignature } = useUserSignature(account?.id);
  const managers = betaAccounts.filter((item) => item.role === "manager");
  const directors = betaAccounts.filter((item) => item.role === "director");
  const total = useMemo(() => cashAdvanceRequestedTotal(lines), [lines]);

  function updateLine(id: string, patch: Partial<CashAdvanceRequestLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function applyGoogleSheet(data: CashAdvanceRequestSheetData) {
    const nextRequestDate = requestDate || data.requestDate;
    const nextContact = contact || data.contact;
    const nextPurpose =
      purpose.trim() ||
      Array.from(
        new Set(data.lines.map((line) => line.purpose.trim()).filter(Boolean)),
      ).join("; ");
    if (
      !nextRequestDate ||
      !nextContact.trim() ||
      !managerId ||
      !directorId ||
      !nextPurpose
    ) {
      setError(
        "Complete the request date, contact, Manager, Director and purpose on this page.",
      );
      return;
    }
    if (!(isOtherProject ? otherProject.trim() : projectName)) {
      setError("Select or enter the Project Name on this page.");
      return;
    }
    const nextAccountHolder = accountHolderName || data.accountHolderName;
    const nextBankName = normalizeBankName(bankName || data.bankName);
    const nextBankAccount = bankAccountNumber || data.bankAccountNumber;
    if (
      !nextAccountHolder.trim() ||
      !nextBankName.trim() ||
      !nextBankAccount.trim()
    ) {
      setError("Complete the bank account details on this page.");
      return;
    }
    setRequestDate(nextRequestDate);
    setContact(nextContact);
    setAccountHolderName(nextAccountHolder);
    setBankName(nextBankName);
    setBankAccountNumber(nextBankAccount);
    setLines(data.lines);
    setPurpose(nextPurpose);
    setError("");
    setSheetMessage("");
    setStage("REVIEW");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (
      [...documents, ...files].reduce((sum, item) => sum + item.size, 0) >
      3 * 1024 * 1024
    ) {
      setError(
        "Supporting documents must be smaller than 3 MB combined for beta testing.",
      );
      return;
    }
    try {
      const nextDocuments = await Promise.all(files.map(readFile));
      setDocuments((current) => [...current, ...nextDocuments]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Documents could not be read.",
      );
    }
  }

  function validate() {
    if (!account) return "Sign in before creating a Cash Advance request.";
    if (
      !requestDate ||
      !contact.trim() ||
      !managerId ||
      !directorId ||
      !purpose.trim()
    )
      return "Complete the request, contact, approvers and purpose.";
    if (
      !accountHolderName.trim() ||
      !bankName.trim() ||
      !bankAccountNumber.trim()
    )
      return "Complete the Staff bank account details for payment.";
    if (!(isOtherProject ? otherProject.trim() : projectName))
      return "Select or enter the Project Name.";
    return validateCashAdvanceRequest(lines);
  }

  function review(event: FormEvent) {
    event.preventDefault();
    const message = validate();
    if (message) return setError(message);
    setError("");
    setStage("REVIEW");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const message = validate();
    if (message || !account)
      return setError(message ?? "The request is incomplete.");
    if (!activeSignature || !confirmed)
      return setError(
        "Save your digital signature in Settings and confirm the Staff declaration before submitting.",
      );
    setSaving(true);
    setError("");
    const input = {
      organizationId: "beta-arus-org",
      requestDate,
      requesterId: account.id,
      requesterName: account.name,
      requesterPosition: account.position,
      requesterDepartment: account.department,
      requesterRole: account.role,
      requesterContact: contact.trim(),
      accountHolderName: accountHolderName.trim(),
      bankName: bankName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      projectName: isOtherProject ? otherProject.trim() : projectName,
      isOtherProject,
      managerApproverId: managerId,
      directorApproverId: directorId,
      purpose: purpose.trim(),
      currency: "MYR" as const,
      lines,
      supportingDocuments: documents,
      remarks: remarks.trim() || undefined,
      staffSignatureKey: activeSignature.id,
    };
    try {
      const record = initialRecord
        ? await resubmitCashAdvance(initialRecord.id, input)
        : await createCashAdvance(input);
      notifyCashAdvanceSubmitted(record, account);
      await draft.clearDraft();
      setSubmittedRecord(record);
      setStage("CONFIRMATION");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Cash Advance could not be submitted.",
      );
      setSaving(false);
    }
  }

  if (stage === "CONFIRMATION" && submittedRecord)
    return <CashAdvanceConfirmation record={submittedRecord} />;

  if (stage === "REVIEW")
    return (
      <CashAdvanceReview
        amendment={Boolean(initialRecord)}
        accountHolderName={accountHolderName}
        bankAccountNumber={bankAccountNumber}
        bankName={bankName}
        confirmed={confirmed}
        directorName={
          directors.find((item) => item.id === directorId)?.name ?? directorId
        }
        error={error}
        lines={lines}
        managerName={
          managers.find((item) => item.id === managerId)?.name ?? managerId
        }
        onBack={() => setStage("FORM")}
        onConfirmedChange={setConfirmed}
        onSubmit={submit}
        projectName={isOtherProject ? otherProject : projectName}
        purpose={purpose}
        requestDate={requestDate}
        saving={saving}
        signature={activeSignature}
        requesterName={account?.name ?? ""}
        total={total}
      />
    );

  return (
    <div className={styles.page}>
      <header className={styles.formHero}>
        <div className={styles.formHeroTop}>
          <div>
            <span className={styles.eyebrow}>
              Payment Request · Cash Advance
            </span>
            <h1>
              {initialRecord
                ? `Amend ${initialRecord.requestNumber}`
                : "New Cash Advance request"}
            </h1>
            <p>
              Request funds for approved work-related expenses of RM300 and
              above.
            </p>
          </div>
          <span className={styles.draftPill}>
            {initialRecord ? "Correction" : "New request"}
          </span>
        </div>
      </header>
      <nav
        className={styles.entryModeTabs}
        aria-label="Cash Advance entry method"
      >
        <button
          className={entryMode === "MANUAL" ? styles.entryModeActive : ""}
          onClick={() => setEntryMode("MANUAL")}
          type="button"
        >
          Manual form
        </button>
        <button
          className={entryMode === "GOOGLE_SHEET" ? styles.entryModeActive : ""}
          onClick={() => setEntryMode("GOOGLE_SHEET")}
          type="button"
        >
          Google Sheet link
        </button>
      </nav>
      {error && entryMode === "GOOGLE_SHEET" && (
        <div className={styles.error}>{error}</div>
      )}
      {entryMode === "GOOGLE_SHEET" ? (
        <CashAdvanceRequestGoogleSheet
          completionFields={
            <>
              <div className={styles.field}>
                <label>
                  Request date <em className={styles.requiredMark}>*</em>
                </label>
                <input
                  type="date"
                  value={requestDate}
                  onChange={(event) => setRequestDate(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>
                  Contact <em className={styles.requiredMark}>*</em>
                </label>
                <input
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="Phone or email"
                />
              </div>
              <div className={styles.field}>
                <label>
                  Project Name <em className={styles.requiredMark}>*</em>
                </label>
                <select
                  value={isOtherProject ? "__OTHER__" : projectName}
                  onChange={(event) => {
                    setIsOtherProject(event.target.value === "__OTHER__");
                    setProjectName(
                      event.target.value === "__OTHER__"
                        ? ""
                        : event.target.value,
                    );
                  }}
                >
                  <option value="">Choose project</option>
                  {CASH_ADVANCE_PROJECTS.map((project) => (
                    <option key={project}>{project}</option>
                  ))}
                  <option value="__OTHER__">Other</option>
                </select>
              </div>
              {isOtherProject && (
                <div className={styles.field}>
                  <label>
                    Other Project Name{" "}
                    <em className={styles.requiredMark}>*</em>
                  </label>
                  <input
                    value={otherProject}
                    onChange={(event) => setOtherProject(event.target.value)}
                  />
                </div>
              )}
              <div className={styles.field}>
                <label>
                  Manager approver <em className={styles.requiredMark}>*</em>
                </label>
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
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label>
                  Director approver{" "}
                  <em className={styles.requiredMark}>*</em>
                </label>
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
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label>Purpose</label>
                <textarea
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  placeholder="Purpose of this Cash Advance"
                />
              </div>
              <div className={styles.field}>
                <label>
                  Account holder <em className={styles.requiredMark}>*</em>
                </label>
                <input
                  value={accountHolderName}
                  onChange={(event) => setAccountHolderName(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>
                  Bank name <em className={styles.requiredMark}>*</em>
                </label>
                <select
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                >
                  <option value="">Choose a bank</option>
                  {BANK_NAME_SELECT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>
                  Account number <em className={styles.requiredMark}>*</em>
                </label>
                <input
                  value={bankAccountNumber}
                  onChange={(event) => setBankAccountNumber(event.target.value)}
                />
              </div>
            </>
          }
          onApply={applyGoogleSheet}
          onCancel={() => setEntryMode("MANUAL")}
          onRetrieved={(data) => {
            if (data.requestDate) setRequestDate(data.requestDate);
            if (data.contact) setContact(data.contact);
            if (data.accountHolderName)
              setAccountHolderName(data.accountHolderName);
            if (data.bankName) setBankName(normalizeBankName(data.bankName));
            if (data.bankAccountNumber)
              setBankAccountNumber(data.bankAccountNumber);
            const importedPurpose = Array.from(
              new Set(
                data.lines.map((line) => line.purpose.trim()).filter(Boolean),
              ),
            ).join("; ");
            if (importedPurpose) setPurpose(importedPurpose);
            setError("");
          }}
        />
      ) : (
        <form className={styles.page} onSubmit={review}>
          {initialRecord?.returnRemarks && (
            <div className={styles.returnNotice}>
              <strong>Changes requested</strong>
              <p>{initialRecord.returnRemarks}</p>
            </div>
          )}
          {sheetMessage && <div className={styles.notice}>{sheetMessage}</div>}
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formReceipt}>
            <section className={styles.receiptSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <div>
                    <h2>Request information</h2>
                    <p>Staff, project and approval assignment</p>
                  </div>
                </div>
              </div>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <label>
                    Request date <em className={styles.requiredMark}>*</em>
                  </label>
                  <input
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>
                    Contact <em className={styles.requiredMark}>*</em>
                  </label>
                  <input
                    placeholder="e.g. +60 12-345 6789"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>
                    Project Name <em className={styles.requiredMark}>*</em>
                  </label>
                  <select
                    value={isOtherProject ? "__OTHER__" : projectName}
                    onChange={(e) => {
                      setIsOtherProject(e.target.value === "__OTHER__");
                      setProjectName(
                        e.target.value === "__OTHER__" ? "" : e.target.value,
                      );
                    }}
                  >
                    <option value="">Choose project</option>
                    {CASH_ADVANCE_PROJECTS.map((project) => (
                      <option key={project}>{project}</option>
                    ))}
                    <option value="__OTHER__">Other</option>
                  </select>
                </div>
                {isOtherProject && (
                  <div className={styles.field}>
                    <label>
                      Other Project Name{" "}
                      <em className={styles.requiredMark}>*</em>
                    </label>
                    <input
                      value={otherProject}
                      onChange={(e) => setOtherProject(e.target.value)}
                    />
                  </div>
                )}
                <div className={styles.field}>
                  <label>
                    Manager approver <em className={styles.requiredMark}>*</em>
                  </label>
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                  >
                    <option value="">Choose Manager</option>
                    {managers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`${styles.field} ${styles.full}`}>
                  <label>
                    Director approver{" "}
                    <em className={styles.requiredMark}>*</em>
                  </label>
                  <select
                    value={directorId}
                    onChange={(e) => setDirectorId(e.target.value)}
                  >
                    <option value="">Choose Director</option>
                    {directors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`${styles.field} ${styles.full}`}>
                  <label>
                    Purpose of Cash Advance{" "}
                    <em className={styles.requiredMark}>*</em>
                  </label>
                  <textarea
                    placeholder="Explain the main project requirement or context necessitating this Cash Advance…"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                </div>
              </div>
            </section>
            <section className={styles.receiptSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <div>
                    <h2>Payment account</h2>
                    <p>
                      Use the Staff requester’s bank account that will receive
                      this Cash Advance.
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.grid3}>
                <div className={styles.field}>
                  <label>
                    Account holder name{" "}
                    <em className={styles.requiredMark}>*</em>
                  </label>
                  <input
                    placeholder="Name as registered with the bank"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>
                    Bank name <em className={styles.requiredMark}>*</em>
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  >
                    <option value="">Choose a bank</option>
                    {BANK_NAME_SELECT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>
                    Account number <em className={styles.requiredMark}>*</em>
                  </label>
                  <input
                    inputMode="numeric"
                    placeholder="Bank account number"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                  />
                </div>
              </div>
            </section>
            <CashAdvanceRequestLines
              lines={lines}
              onAdd={() => setLines((current) => [...current, makeLine()])}
              onChange={updateLine}
              onRemove={(id) =>
                setLines((current) => current.filter((item) => item.id !== id))
              }
              total={total}
            />
            <section className={styles.receiptSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <div>
                    <h2>Documents and remarks</h2>
                    <p>Add any supporting information available now.</p>
                  </div>
                </div>
              </div>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <label>Supporting documents</label>
                  <label className={styles.uploadWell}>
                    <strong>Choose files</strong>
                    <span>or drag and drop</span>
                    <small>PDF, PNG or JPG up to 3 MB combined</small>
                    <input
                      accept="application/pdf,image/png,image/jpeg"
                      multiple
                      onChange={selectFiles}
                      type="file"
                    />
                  </label>
                  {documents.map((document) => (
                    <small key={document.id}>{document.fileName}</small>
                  ))}
                </div>
                <div className={styles.field}>
                  <label>Additional remarks</label>
                  <textarea
                    placeholder="Include any timeline urgency, supplier requirements, or relevant notes…"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.footerActions}>
                <span className={styles.muted}>
                  You will review and sign on the next step.
                </span>
                <div className={styles.draftActions}>
                  <button
                    className={styles.secondary}
                    disabled={draft.isSavingDraft}
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
                  <button className={styles.primary} type="submit">
                    Continue to review →
                  </button>
                </div>
                {draft.draftMessage && (
                  <small className={styles.draftMessage} role="status">
                    {draft.draftMessage}
                  </small>
                )}
              </div>
            </section>
          </div>
        </form>
      )}
    </div>
  );
}

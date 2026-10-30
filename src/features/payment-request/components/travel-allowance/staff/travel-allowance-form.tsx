"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";

import {
  createTravelAllowance,
  resubmitTravelAllowance,
} from "@/data/payment-requests/travel-allowance/api";
import { notifyTravelAllowanceSubmitted } from "@/features/payment-request/notifications/travel-allowance-notifications";
import { useManualFormDraft } from "@/features/payment-request/components/shared/use-manual-form-draft";
import type {
  PaymentRequestDocument,
  TravelAllowanceLine,
  TravelAllowanceRecord,
  TravelMealType,
} from "@/domain/payment-requests/travel-allowance/types";
import {
  TRAVEL_ALLOWANCE_PROJECTS,
  TRAVEL_MEAL_RATES,
  travelLineMealSubtotal,
  travelLineTotal,
} from "@/domain/payment-requests/travel-allowance/types";
import { betaAccounts, readBetaSession } from "@/lib/auth/beta-accounts";
import {
  EMPLOYEE_OPTIONS,
  findEmployeeByName,
} from "@/shared/constants/employee-options";
import { TravelAllowanceConfirmation } from "./travel-allowance-confirmation";
import {
  TravelAllowanceGoogleSheet,
  type TravelAllowanceSheetData,
} from "./travel-allowance-google-sheet";
import styles from "./travel-allowance.module.css";

const MAX_LINES = 100;
const MAX_DOCUMENT_SIZE = 2.5 * 1024 * 1024;
const meals: TravelMealType[] = ["BREAKFAST", "LUNCH", "DINNER"];
type EditableTravelLine = TravelAllowanceLine & { groupId?: string };

function today() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function uniqueId(prefix = "line") {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random()}`;
}

function newLine(employeeId = "", employeeName = ""): EditableTravelLine {
  const id = uniqueId();
  return {
    id,
    groupId: id,
    travelDate: "",
    employeeId,
    employeeName,
    projectName: "",
    isOtherProject: false,
    reason: "",
    meals: [],
    specialAllowance: 0,
  };
}

function submissionLine(line: EditableTravelLine): TravelAllowanceLine {
  const copy = { ...line };
  delete copy.groupId;
  return copy;
}

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function readDocument(file: File): Promise<PaymentRequestDocument> {
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

export function TravelAllowanceForm({
  mode = "staff",
  initialRecord,
}: {
  mode?: "staff" | "manager";
  initialRecord?: TravelAllowanceRecord;
}) {
  const requestMode = initialRecord?.requesterRole ?? mode;
  const [account, setAccount] =
    useState<ReturnType<typeof readBetaSession>>(null);
  const [requestDate, setRequestDate] = useState(
    initialRecord?.requestDate ?? today(),
  );
  const [contact, setContact] = useState(initialRecord?.contact ?? "");
  const [projectDirectorId, setProjectDirectorId] = useState(
    initialRecord?.projectDirectorId ?? "",
  );
  const [lines, setLines] = useState<EditableTravelLine[]>(
    () =>
      initialRecord?.lines.map((line) => ({ ...line, groupId: line.id })) ?? [
        newLine(),
      ],
  );
  const [documents, setDocuments] = useState<PaymentRequestDocument[]>(
    initialRecord?.supportingDocuments ?? [],
  );
  const [remarks, setRemarks] = useState(initialRecord?.remarks ?? "");
  const [entryMode, setEntryMode] = useState<"MANUAL" | "GOOGLE_SHEET">(
    "MANUAL",
  );
  const [sheetImportMessage, setSheetImportMessage] = useState("");
  const [stage, setStage] = useState<"FORM" | "REVIEW" | "CONFIRMATION">(
    "FORM",
  );
  const [record, setRecord] = useState<TravelAllowanceRecord | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const session = readBetaSession();
    setAccount(session);
    if (
      session?.role === "manager" &&
      requestMode === "manager" &&
      !initialRecord
    ) {
      setManagerApproverId(session.id);
    }
  }, [initialRecord, requestMode]);

  const directors = betaAccounts.filter((item) => item.role === "director");
  const managers = betaAccounts.filter((item) => item.role === "manager");
  const employees = EMPLOYEE_OPTIONS;
  const [managerApproverId, setManagerApproverId] = useState(
    initialRecord?.managerApproverId ?? "",
  );
  const draft = useManualFormDraft({
    paymentType: "TRAVEL_ALLOWANCE",
    requesterId: account?.id,
    disabled: Boolean(initialRecord) || entryMode !== "MANUAL",
    getSnapshot: () => ({
      requestDate,
      contact,
      projectDirectorId,
      managerApproverId,
      lines,
      documents,
      remarks,
    }),
    restoreSnapshot: (value: {
      requestDate?: string;
      contact?: string;
      projectDirectorId?: string;
      managerApproverId?: string;
      lines?: EditableTravelLine[];
      documents?: PaymentRequestDocument[];
      remarks?: string;
    }) => {
      if (value.requestDate) setRequestDate(value.requestDate);
      setContact(value.contact ?? "");
      setProjectDirectorId(value.projectDirectorId ?? "");
      setManagerApproverId(value.managerApproverId ?? "");
      setLines(value.lines?.length ? value.lines : [newLine()]);
      setDocuments(value.documents ?? []);
      setRemarks(value.remarks ?? "");
    },
  });
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + travelLineTotal(line), 0),
    [lines],
  );

  function updateLine(id: string, patch: Partial<TravelAllowanceLine>) {
    setLines((current) =>
      current.map((line) => {
        const target = current.find((item) => item.id === id);
        return line.groupId === target?.groupId ? { ...line, ...patch } : line;
      }),
    );
  }

  function updateRequestProject(
    patch: Pick<TravelAllowanceLine, "projectName" | "isOtherProject">,
  ) {
    setLines((current) => current.map((line) => ({ ...line, ...patch })));
  }

  function toggleGroupEmployee(line: EditableTravelLine, employeeId: string) {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    const groupId = line.groupId ?? line.id;
    setLines((current) => {
      const group = current.filter(
        (item) => (item.groupId ?? item.id) === groupId,
      );
      const existing = group.find((item) => item.employeeId === employeeId);
      if (existing) {
        if (group.length === 1) {
          return current.map((item) =>
            item.id === existing.id
              ? { ...item, employeeId: "", employeeName: "" }
              : item,
          );
        }
        return current.filter((item) => item.id !== existing.id);
      }
      const template = group[0] ?? line;
      if (!template.employeeId) {
        return current.map((item) =>
          item.id === template.id
            ? { ...item, groupId, employeeId, employeeName: employee.name }
            : item,
        );
      }
      if (current.length >= MAX_LINES) return current;
      return [
        ...current,
        {
          ...template,
          id: uniqueId(),
          groupId,
          employeeId,
          employeeName: employee.name,
        },
      ];
    });
  }

  function applyGoogleSheet(data: TravelAllowanceSheetData) {
    if (!account) {
      setError("Sign in before retrieving a Travel Allowance sheet.");
      return;
    }

    if (requestMode === "manager") {
      const unmatchedEntry = data.entries.findIndex(
        (entry) => !findEmployeeByName(entry.employeeName),
      );
      if (unmatchedEntry >= 0) {
        setError(
          `Travel entry ${unmatchedEntry + 1} does not match an Estuary Staff name.`,
        );
        return;
      }
    }

    const importedProjects = [
      ...new Set(
        data.entries.map((entry) => entry.projectName.trim()).filter(Boolean),
      ),
    ];
    if (importedProjects.length > 1) {
      setError(
        "A Travel Allowance request can contain only one project. Create a separate request for entries under another project.",
      );
      return;
    }

    const importedLines = data.entries.map((entry, index) => {
      const employee =
        requestMode === "staff"
          ? account
          : findEmployeeByName(entry.employeeName);
      if (!employee) return newLine();
      const standardProject = TRAVEL_ALLOWANCE_PROJECTS.includes(
        entry.projectName as (typeof TRAVEL_ALLOWANCE_PROJECTS)[number],
      );
      return {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `sheet-line-${Date.now()}-${index}`,
        employeeId: employee.id,
        employeeName: employee.name,
        travelDate: entry.travelDate,
        projectName: entry.projectName,
        isOtherProject: !standardProject,
        reason: entry.reason,
        meals: entry.meals,
        specialAllowance: entry.specialAllowance,
        specialAllowanceReason: entry.specialAllowanceReason || undefined,
      } satisfies TravelAllowanceLine;
    });

    const nextRequestDate = requestDate || data.requestDate;
    const nextContact = contact || data.contact;
    if (!nextRequestDate || !nextContact.trim() || !projectDirectorId) {
      setError(
        "Complete the request date, contact and Project Director on this page.",
      );
      return;
    }
    if (requestMode === "staff" && !managerApproverId) {
      setError("Select the Manager reviewer on this page.");
      return;
    }
    setRequestDate(nextRequestDate);
    setContact(nextContact);
    if (requestMode === "manager") setManagerApproverId(account.id);
    setLines(importedLines);
    setError("");
    setSheetImportMessage("");
    setStage("REVIEW");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleMeal(line: TravelAllowanceLine, meal: TravelMealType) {
    updateLine(line.id, {
      meals: line.meals.includes(meal)
        ? line.meals.filter((item) => item !== meal)
        : [...line.meals, meal],
    });
  }

  async function selectDocuments(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    const invalid = selected.find(
      (file) =>
        !["application/pdf", "image/png", "image/jpeg"].includes(file.type),
    );
    if (invalid)
      return setError(`${invalid.name} is not supported. Use PDF, PNG or JPG.`);
    const size = [...documents, ...selected].reduce(
      (sum, item) => sum + item.size,
      0,
    );
    if (size > MAX_DOCUMENT_SIZE)
      return setError(
        "Supporting documents must be smaller than 2.5 MB combined for local testing.",
      );
    try {
      const next = await Promise.all(selected.map(readDocument));
      setDocuments((current) => [...current, ...next]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The documents could not be read.",
      );
    }
  }

  function validationMessage() {
    if (!account || account.role !== requestMode)
      return `Sign in using a ${requestMode === "staff" ? "Staff" : "Manager"} account.`;
    if (!requestDate || !contact.trim() || !projectDirectorId)
      return "Complete the request date, contact and Project Director.";
    if (requestMode === "staff" && !managerApproverId)
      return "Select the Manager reviewer.";
    if (!lines.length) return "Add at least one travel entry.";
    const incomplete = lines.find(
      (line) =>
        !line.employeeId ||
        !line.employeeName.trim() ||
        !line.travelDate ||
        !line.projectName.trim() ||
        !line.reason.trim(),
    );
    if (incomplete)
      return "Complete the travel date, Project Name and reason for every entry.";
    const noAllowance = lines.find(
      (line) => line.meals.length === 0 && line.specialAllowance <= 0,
    );
    if (noAllowance)
      return "Select at least one meal or enter a special allowance for every entry.";
    const missingReason = lines.find(
      (line) =>
        line.specialAllowance > 0 && !line.specialAllowanceReason?.trim(),
    );
    if (missingReason) return "Explain the reason for every special allowance.";
    return null;
  }

  function review(event: React.FormEvent) {
    event.preventDefault();
    const message = validationMessage();
    if (message) return setError(message);
    setError("");
    setStage("REVIEW");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const message = validationMessage();
    if (message || !account)
      return setError(message ?? "The request is incomplete.");
    setIsSaving(true);
    try {
      const input = {
        organizationId: "beta-arus-org",
        requestDate,
        requesterId: account.id,
        requesterName: account.name,
        requesterRole: requestMode,
        requesterPosition: account.position,
        contact: contact.trim(),
        managerApproverId:
          requestMode === "staff" ? managerApproverId : account.id,
        projectDirectorId,
        currency: "MYR",
        lines: lines.map(submissionLine),
        supportingDocuments: documents,
        remarks: remarks.trim() || undefined,
      } as const;
      const created = initialRecord
        ? await resubmitTravelAllowance(initialRecord.id, input)
        : await createTravelAllowance(input);
      notifyTravelAllowanceSubmitted(created, account);
      await draft.clearDraft();
      setRecord(created);
      setStage("CONFIRMATION");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The Travel Allowance could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (stage === "CONFIRMATION" && record) {
    return (
      <TravelAllowanceConfirmation
        request={record}
        onCreateAnother={() =>
          initialRecord
            ? window.location.assign("/beta/payment-records/travel-allowances")
            : window.location.reload()
        }
      />
    );
  }

  if (stage === "REVIEW") {
    return (
      <TravelAllowanceReview
        accountName={account?.name ?? ""}
        contact={contact}
        directorName={
          directors.find((item) => item.id === projectDirectorId)?.name ?? ""
        }
        lines={lines}
        remarks={remarks}
        requestDate={requestDate}
        total={total}
        isSaving={isSaving}
        onBack={() => setStage("FORM")}
        onSubmit={submit}
      />
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>Payment Requests / Travel Allowance</p>
          <h1>
            {initialRecord
              ? `Edit ${initialRecord.requestNumber}`
              : requestMode === "manager"
                ? "New Travel Allowance on behalf of Staff"
                : "New Travel Allowance"}
          </h1>
          <span>
            Enter each project-travel meal allowance. Estuary will calculate and
            generate the official TA form.
          </span>
        </div>
        <strong>Draft</strong>
      </header>
      {initialRecord && (
        <div className={styles.error} role="status">
          <strong>This request was returned for correction.</strong>
          <p>
            {initialRecord.financeReturnRemarks ??
              initialRecord.directorReturnRemarks ??
              initialRecord.managerReturnRemarks ??
              "Update the request and resubmit it for approval."}
          </p>
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {!initialRecord && (
        <div
          className={styles.entryModeTabs}
          role="group"
          aria-label="Travel Allowance entry method"
        >
          <button
            data-active={entryMode === "MANUAL"}
            type="button"
            onClick={() => setEntryMode("MANUAL")}
          >
            Manual form
          </button>
          <button
            data-active={entryMode === "GOOGLE_SHEET"}
            type="button"
            onClick={() => setEntryMode("GOOGLE_SHEET")}
          >
            Google Sheet Link
          </button>
        </div>
      )}
      {sheetImportMessage && entryMode === "MANUAL" && (
        <div className={styles.sheetSuccess} role="status">
          {sheetImportMessage}
        </div>
      )}
      {entryMode === "GOOGLE_SHEET" && !initialRecord ? (
        <TravelAllowanceGoogleSheet
          completionFields={
            <>
              <label>
                <span>Request date *</span>
                <input
                  type="date"
                  value={requestDate}
                  onChange={(event) => setRequestDate(event.target.value)}
                />
              </label>
              <label>
                <span>Contact *</span>
                <input
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="Phone number or extension"
                />
              </label>
              <label>
                <span>Manager reviewer *</span>
                {requestMode === "manager" ? (
                  <input disabled value={account?.name ?? "Loading…"} />
                ) : (
                  <select
                    value={managerApproverId}
                    onChange={(event) =>
                      setManagerApproverId(event.target.value)
                    }
                  >
                    <option value="">Choose a Manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} - {manager.position}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label>
                <span>Project Director *</span>
                <select
                  value={projectDirectorId}
                  onChange={(event) => setProjectDirectorId(event.target.value)}
                >
                  <option value="">Choose a Director</option>
                  {directors.map((director) => (
                    <option key={director.id} value={director.id}>
                      {director.name} - {director.position}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
          onCancel={() => setEntryMode("MANUAL")}
          onApply={applyGoogleSheet}
          onRetrieved={(data) => {
            if (data.requestDate) setRequestDate(data.requestDate);
            if (data.contact) setContact(data.contact);
            setError("");
          }}
        />
      ) : (
        <form className={styles.formCard} onSubmit={review}>
          <section className={styles.guidance}>
            <div>
              <span>Travel Allowance</span>
              <h2>Paid before project travel</h2>
            </div>
            <p>
              Approved allowances are scheduled one business day before the
              travel date. Breakfast is RM10, lunch RM20 and dinner RM20.
            </p>
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h2>Requester and approval</h2>
              <p>
                {requestMode === "manager"
                  ? "You are submitting this request on behalf of Staff."
                  : "Your profile is used as the requester."}
              </p>
            </div>
            <div className={styles.fields}>
              <label>
                <span>Request date *</span>
                <input
                  type="date"
                  value={requestDate}
                  onChange={(event) => setRequestDate(event.target.value)}
                />
              </label>
              <label>
                <span>
                  {requestMode === "manager"
                    ? "Submitted by Manager"
                    : "Staff name"}
                </span>
                <input disabled value={account?.name ?? "Loading…"} />
              </label>
              <label>
                <span>Position</span>
                <input disabled value={account?.position ?? "Loading…"} />
              </label>
              <label>
                <span>Contact *</span>
                <input
                  placeholder="Phone number or extension"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                />
              </label>
              <label>
                <span>Manager reviewer *</span>
                {requestMode === "manager" ? (
                  <input disabled value={account?.name ?? "Loading…"} />
                ) : (
                  <select
                    value={managerApproverId}
                    onChange={(event) =>
                      setManagerApproverId(event.target.value)
                    }
                  >
                    <option value="">Choose a Manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} - {manager.position}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label>
                <span>Project Director in charge *</span>
                <select
                  value={projectDirectorId}
                  onChange={(event) => setProjectDirectorId(event.target.value)}
                >
                  <option value="">Choose a Director</option>
                  {directors.map((director) => (
                    <option key={director.id} value={director.id}>
                      {director.name} - {director.position}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section className={styles.entriesSection}>
            <div className={styles.entriesHeading}>
              <div>
                <h2>Travel entries</h2>
                <p>
                  Select one or more employees per entry. Every entry in this
                  request must use the same project. Create a new request for a
                  different project. Up to {MAX_LINES} rows are supported.
                </p>
              </div>
              <button
                type="button"
                disabled={lines.length >= MAX_LINES}
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    {
                      ...newLine(),
                      projectName: current[0]?.projectName ?? "",
                      isOtherProject: current[0]?.isOtherProject ?? false,
                    },
                  ])
                }
              >
                + Add entry
              </button>
            </div>
            <div className={styles.entryList}>
              {lines
                .filter(
                  (line, index, current) =>
                    current.findIndex(
                      (item) =>
                        (item.groupId ?? item.id) === (line.groupId ?? line.id),
                    ) === index,
                )
                .map((line, index) => {
                  const groupId = line.groupId ?? line.id;
                  const groupLines = lines.filter(
                    (item) => (item.groupId ?? item.id) === groupId,
                  );
                  return (
                    <article className={styles.entryCard} key={line.id}>
                      <div className={styles.entryTop}>
                        <strong>Entry {index + 1}</strong>
                        <div className={styles.entryActions}>
                          <button
                            type="button"
                            disabled={lines.length >= MAX_LINES}
                            onClick={() => {
                              const nextGroupId = uniqueId("group");
                              setLines((current) => [
                                ...current,
                                ...groupLines.map((item) => ({
                                  ...item,
                                  id: uniqueId(),
                                  groupId: nextGroupId,
                                  travelDate: "",
                                })),
                              ]);
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            disabled={lines.length === groupLines.length}
                            onClick={() =>
                              setLines((current) =>
                                current.filter(
                                  (item) =>
                                    (item.groupId ?? item.id) !== groupId,
                                ),
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className={styles.entryFields}>
                        {requestMode === "manager" ? (
                          <div
                            className={`${styles.full} ${styles.employeePicker}`}
                          >
                            <span>
                              Employee name <em>*</em>
                            </span>
                            <details>
                              <summary>
                                {groupLines.some((item) => item.employeeId)
                                  ? `${groupLines.filter((item) => item.employeeId).length} employee${groupLines.filter((item) => item.employeeId).length === 1 ? "" : "s"} selected`
                                  : "Choose one or more employees"}
                              </summary>
                              <div className={styles.employeeOptions}>
                                {employees.map((employee) => (
                                  <label key={employee.id}>
                                    <input
                                      type="checkbox"
                                      checked={groupLines.some(
                                        (item) =>
                                          item.employeeId === employee.id,
                                      )}
                                      onChange={() =>
                                        toggleGroupEmployee(line, employee.id)
                                      }
                                    />
                                    <span>
                                      <strong>{employee.name}</strong>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </details>
                            <div className={styles.employeeChips}>
                              {groupLines
                                .filter((item) => item.employeeId)
                                .map((item) => (
                                  <button
                                    key={item.employeeId}
                                    type="button"
                                    onClick={() =>
                                      toggleGroupEmployee(line, item.employeeId)
                                    }
                                  >
                                    {item.employeeName}{" "}
                                    <span aria-hidden="true">×</span>
                                  </button>
                                ))}
                            </div>
                          </div>
                        ) : (
                          <label className={styles.full}>
                            <span>
                              Employee name <em>*</em>
                            </span>
                            <select
                              value={line.employeeId}
                              onChange={(event) => {
                                const employee = employees.find(
                                  (item) => item.id === event.target.value,
                                );
                                updateLine(line.id, {
                                  employeeId: employee?.id ?? "",
                                  employeeName: employee?.name ?? "",
                                });
                              }}
                            >
                              <option value="">Choose an employee</option>
                              {line.employeeId &&
                                !employees.some(
                                  (employee) => employee.id === line.employeeId,
                                ) && (
                                  <option value={line.employeeId}>
                                    {line.employeeName || "Saved employee"}
                                  </option>
                                )}
                              {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                  {employee.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label>
                          <span>
                            Travel date <em>*</em>
                          </span>
                          <input
                            type="date"
                            value={line.travelDate}
                            onChange={(event) =>
                              updateLine(line.id, {
                                travelDate: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>
                            Project Name <em>*</em>
                          </span>
                          <select
                            value={
                              line.isOtherProject ? "OTHER" : line.projectName
                            }
                            onChange={(event) => {
                              const value = event.target.value;
                              updateRequestProject(
                                value === "OTHER"
                                  ? { isOtherProject: true, projectName: "" }
                                  : {
                                      isOtherProject: false,
                                      projectName: value,
                                    },
                              );
                            }}
                          >
                            <option value="">Choose a project</option>
                            {TRAVEL_ALLOWANCE_PROJECTS.map((project) => (
                              <option key={project} value={project}>
                                {project}
                              </option>
                            ))}
                            <option value="OTHER">Other</option>
                          </select>
                          {line.isOtherProject && (
                            <input
                              aria-label="Other Project Name"
                              placeholder="Enter the Project Name"
                              value={line.projectName}
                              onChange={(event) =>
                                updateRequestProject({
                                  isOtherProject: true,
                                  projectName: event.target.value,
                                })
                              }
                            />
                          )}
                        </label>
                        <label className={styles.reason}>
                          <span>
                            Reason for meal allowance <em>*</em>
                          </span>
                          <input
                            placeholder="Example: Cohort workshop"
                            value={line.reason}
                            onChange={(event) =>
                              updateLine(line.id, {
                                reason: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <fieldset className={styles.meals}>
                        <legend>Meal type - fixed rates</legend>
                        {meals.map((meal) => (
                          <label key={meal}>
                            <input
                              type="checkbox"
                              checked={line.meals.includes(meal)}
                              onChange={() => toggleMeal(line, meal)}
                            />
                            <span>
                              {meal[0] + meal.slice(1).toLowerCase()}{" "}
                              <small>{money(TRAVEL_MEAL_RATES[meal])}</small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <div className={styles.specialRow}>
                        <label>
                          <span>Special allowance (RM)</span>
                          <DecimalInput
                            value={line.specialAllowance}
                            onValueChange={(value) =>
                              updateLine(line.id, {
                                specialAllowance: value,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Reason for special allowance</span>
                          <input
                            disabled={line.specialAllowance <= 0}
                            value={line.specialAllowanceReason ?? ""}
                            onChange={(event) =>
                              updateLine(line.id, {
                                specialAllowanceReason: event.target.value,
                              })
                            }
                          />
                        </label>
                        <div>
                          <span>Entry total</span>
                          <strong>{money(travelLineTotal(line))}</strong>
                          <small>
                            Meals {money(travelLineMealSubtotal(line))}
                          </small>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
            <div className={styles.grandTotal}>
              <span>Total requested</span>
              <strong>{money(total)}</strong>
            </div>
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h2>Supporting information</h2>
              <p>
                The editable Google Sheet link is no longer required because
                Estuary generates the TA form.
              </p>
            </div>
            <label className={styles.upload}>
              <span>Optional supporting documents</span>
              <input
                accept=".pdf,.png,.jpg,.jpeg"
                multiple
                type="file"
                onChange={(event) => void selectDocuments(event)}
              />
              <small>
                PDF, PNG or JPG; combined maximum 2.5 MB for local testing.
              </small>
            </label>
            {documents.map((document) => (
              <div className={styles.document} key={document.id}>
                <span>{document.fileName}</span>
                <button
                  type="button"
                  onClick={() =>
                    setDocuments((current) =>
                      current.filter((item) => item.id !== document.id),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <label className={styles.remarks}>
              <span>Additional remarks</span>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
              />
            </label>
          </section>
          <footer className={styles.actions}>
            <button
              className={styles.secondaryAction}
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
            <button type="submit">Continue to review →</button>
            {draft.draftMessage && (
              <p className={styles.draftMessage} role="status">
                {draft.draftMessage}
              </p>
            )}
          </footer>
        </form>
      )}
    </main>
  );
}

function DecimalInput({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [text, setText] = useState(value ? String(value) : "");

  return (
    <input
      inputMode="decimal"
      placeholder="0.00"
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
        onValueChange(Number.isFinite(numeric) ? Math.max(0, numeric) : 0);
      }}
    />
  );
}

function TravelAllowanceReview({
  accountName,
  contact,
  directorName,
  lines,
  remarks,
  requestDate,
  total,
  isSaving,
  onBack,
  onSubmit,
}: {
  accountName: string;
  contact: string;
  directorName: string;
  lines: TravelAllowanceLine[];
  remarks: string;
  requestDate: string;
  total: number;
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p>Payment Requests / Travel Allowance / Review</p>
          <h1>Review Travel Allowance</h1>
          <span>
            Confirm every travel entry before routing it to the next reviewer.
          </span>
        </div>
        <strong>Ready for review</strong>
      </header>
      <section className={styles.reviewCard}>
        <div className={styles.reviewHero}>
          <div>
            <span>Travel Allowance request</span>
            <h2>{accountName}</h2>
            <p>
              {lines.length} travel {lines.length === 1 ? "entry" : "entries"}{" "}
              requested on{" "}
              {new Date(`${requestDate}T12:00:00`).toLocaleDateString("en-MY")}
            </p>
          </div>
          <div>
            <span>Total requested</span>
            <strong>{money(total)}</strong>
          </div>
        </div>
        <dl className={styles.reviewMeta}>
          <div>
            <dt>Submitted by</dt>
            <dd>{accountName}</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>{contact}</dd>
          </div>
          <div>
            <dt>Project Director</dt>
            <dd>{directorName}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>MYR</dd>
          </div>
          <div>
            <dt>Remarks</dt>
            <dd>{remarks || "None"}</dd>
          </div>
        </dl>
        <div className={styles.reviewTable}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>Travel date</th>
                <th>Project Name</th>
                <th>Reason</th>
                <th>Meals</th>
                <th>Special</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id}>
                  <td>{index + 1}</td>
                  <td>{line.employeeName}</td>
                  <td>{line.travelDate}</td>
                  <td>{line.projectName}</td>
                  <td>{line.reason}</td>
                  <td>
                    {line.meals
                      .map((meal) => meal[0] + meal.slice(1).toLowerCase())
                      .join(", ") || "-"}
                  </td>
                  <td>{money(line.specialAllowance)}</td>
                  <td>
                    <strong>{money(travelLineTotal(line))}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className={styles.reviewActions}>
          <button className={styles.secondary} type="button" onClick={onBack}>
            Back to edit
          </button>
          <button disabled={isSaving} type="button" onClick={onSubmit}>
            {isSaving ? "Submitting…" : "Submit Travel Allowance →"}
          </button>
        </footer>
      </section>
    </main>
  );
}

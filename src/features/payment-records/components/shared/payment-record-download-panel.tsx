"use client";

import { useState } from "react";

import {
  downloadPaymentRecordFormsZip,
  type PaymentRecordZipEntry,
} from "./download-payment-record-forms-zip";

import styles from "./payment-record-download-panel.module.css";

export type DownloadPaymentType =
  | "PAYMENT_VOUCHER"
  | "INVOICE_PAYMENT"
  | "TRAVEL_ALLOWANCE"
  | "CASH_ADVANCE"
  | "PETTY_CASH"
  | "CLAIM";

export type DownloadablePaymentRecord = {
  id: string;
  type: DownloadPaymentType;
  reference: string;
  status: string;
  completedAt: string;
  forms: PaymentRecordZipEntry[];
  receipts: PaymentRecordZipEntry[];
};

const paymentTypes: Array<{ type: DownloadPaymentType; code: string }> = [
  { type: "PAYMENT_VOUCHER", code: "PV" },
  { type: "INVOICE_PAYMENT", code: "INV" },
  { type: "TRAVEL_ALLOWANCE", code: "TA" },
  { type: "CASH_ADVANCE", code: "CA" },
  { type: "PETTY_CASH", code: "PC" },
  { type: "CLAIM", code: "CL" },
];

type Period = "THIS_MONTH" | "LAST_MONTH" | "MONTH" | "RANGE";
type Documents = "FORMS" | "RECEIPTS" | "BOTH";

const monthValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export function PaymentRecordDownloadPanel({
  records,
}: {
  records: DownloadablePaymentRecord[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<DownloadPaymentType[]>(
    paymentTypes.map((item) => item.type),
  );
  const [period, setPeriod] = useState<Period>("THIS_MONTH");
  const [month, setMonth] = useState(monthValue(new Date()));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [documents, setDocuments] = useState<Documents>("BOTH");
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState("");

  const now = new Date();
  const currentMonth = monthValue(now);
  const previousMonth = monthValue(
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
  );
  const periodRecords = records.filter((record) => {
    if (!["COMPLETED", "PAID", "RECONCILED", "CLOSED"].includes(record.status))
      return false;
    const day = record.completedAt?.slice(0, 10) ?? "";
    if (period === "THIS_MONTH") return day.startsWith(currentMonth);
    if (period === "LAST_MONTH") return day.startsWith(previousMonth);
    if (period === "MONTH") return !month || day.startsWith(month);
    return (!from || day >= from) && (!to || day <= to);
  });
  const matchingRecords = periodRecords.filter((record) =>
    selectedTypes.includes(record.type),
  );

  const entries = matchingRecords.flatMap((record) => {
    const forms = Array.isArray(record.forms) ? record.forms : [];
    const receipts = Array.isArray(record.receipts) ? record.receipts : [];
    return [
      ...(documents !== "RECEIPTS" ? forms : []),
      ...(documents !== "FORMS" ? receipts : []),
    ];
  });
  const availableRecords = matchingRecords.filter((record) =>
    documents === "FORMS"
      ? (record.forms?.length ?? 0) > 0
      : documents === "RECEIPTS"
        ? (record.receipts?.length ?? 0) > 0
        : (record.forms?.length ?? 0) + (record.receipts?.length ?? 0) > 0,
  );
  const skipped = matchingRecords.length - availableRecords.length;

  const selectedTypeCodes = paymentTypes
    .filter((item) => selectedTypes.includes(item.type))
    .map((item) => item.code);
  const periodName =
    period === "THIS_MONTH"
      ? monthValue(now)
      : period === "LAST_MONTH"
        ? previousMonth
        : period === "MONTH"
          ? month || "month"
          : `${from || "start"}-to-${to || "end"}`;
  const documentName =
    documents === "FORMS"
      ? "signed-forms"
      : documents === "RECEIPTS"
        ? "receipts"
        : "forms-and-receipts";
  const archiveName = `Estuary-${selectedTypeCodes.join("-") || "records"}-${periodName}-${documentName}`;
  const downloadFileName = `${archiveName}-${new Date().toISOString().slice(0, 10)}.zip`;

  const toggleType = (type: DownloadPaymentType) => {
    setDocuments("BOTH");
    setMessage("");
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  };

  const download = async () => {
    setPreparing(true);
    setMessage("");
    try {
      const result = await downloadPaymentRecordFormsZip(entries, archiveName);
      setMessage(
        result.skipped
          ? `${result.downloaded} files downloaded; ${result.skipped} unavailable ${result.skipped === 1 ? "file was" : "files were"} skipped.`
          : `${result.downloaded} files downloaded.`,
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Files could not be downloaded.",
      );
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className={styles.root}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Download files
      </button>
      {open && (
        <section
          className={styles.panel}
          aria-label="Download completed payment files"
        >
          <header>
            <p>Download files</p>
            <span>
              Forms and receipts are available for completed requests. Signed
              versions are used where the payment workflow provides them.
            </span>
            <b>Status: Completed</b>
          </header>
          <fieldset>
            <legend>Payment types</legend>
            <div className={styles.types}>
              {paymentTypes.map((item) => (
                <button
                  aria-pressed={selectedTypes.includes(item.type)}
                  data-active={selectedTypes.includes(item.type)}
                  data-type={item.type}
                  key={item.type}
                  onClick={() => toggleType(item.type)}
                  type="button"
                >
                  <i />
                  {item.code}{" "}
                  <span>
                    {
                      periodRecords.filter(
                        (record) => record.type === item.type,
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Period</legend>
            <div className={styles.periods}>
              {(
                [
                  ["THIS_MONTH", "This month"],
                  ["LAST_MONTH", "Last month"],
                  ["MONTH", "Month"],
                  ["RANGE", "Date range"],
                ] as const
              ).map(([value, label]) => (
                <button
                  data-active={period === value}
                  key={value}
                  onClick={() => setPeriod(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            {period === "MONTH" && (
              <input
                aria-label="Download month"
                onChange={(event) => setMonth(event.target.value)}
                type="month"
                value={month}
              />
            )}
            {period === "RANGE" && (
              <div className={styles.range}>
                <input
                  aria-label="From date"
                  onChange={(event) => setFrom(event.target.value)}
                  type="date"
                  value={from}
                />
                <input
                  aria-label="To date"
                  onChange={(event) => setTo(event.target.value)}
                  type="date"
                  value={to}
                />
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend>Documents</legend>
            {(
              [
                ["FORMS", "Forms"],
                ["RECEIPTS", "Receipts"],
                ["BOTH", "Both", "forms and receipts together"],
              ] as const
            ).map(([value, label, detail]) => (
              <label key={value}>
                <input
                  checked={documents === value}
                  name="documents"
                  onChange={() => setDocuments(value)}
                  type="radio"
                />
                <span>
                  <b>{label}</b>
                  {detail && <small>{detail}</small>}
                </span>
              </label>
            ))}
          </fieldset>
          <div className={styles.preview}>
            <strong>
              {availableRecords.length} requests · {entries.length} files
            </strong>
            {skipped > 0 && (
              <span>
                {skipped} {skipped === 1 ? "request has" : "requests have"} no
                selected documents and will be skipped.
              </span>
            )}
          </div>
          {message && (
            <p className={styles.message} role="status">
              {message}
            </p>
          )}
          <footer>
            <button
              disabled={!entries.length || preparing}
              onClick={download}
              type="button"
            >
              {preparing
                ? "Preparing ZIP…"
                : `Download ${entries.length} ${entries.length === 1 ? "file" : "files"}`}
            </button>
            <button onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
          </footer>
          <small title={downloadFileName}>File name: {downloadFileName}</small>
        </section>
      )}
    </div>
  );
}

'use client';

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { createInvoicePayment, resubmitInvoicePayment } from '@/data/payment-requests/invoice-payment/api';
import type {
  InvoicePaymentPortion,
  InvoicePaymentRequestRecord,
  InvoiceTransferType,
  PaymentRequestDocument,
} from '@/domain/payment-requests/invoice-payment/types';
import {
  INVOICE_PAYMENT_PROJECTS,
} from '@/domain/payment-requests/invoice-payment/types';
import { readBetaSession } from '@/lib/auth/beta-accounts';
import { amountToMalayWords } from '@/lib/currency/amount-words';
import { notifyManagerInvoicePaymentSubmitted } from '@/features/payment-request/notifications/invoice-payment-notifications';

import {
  InvoicePaymentReview,
} from './invoice-payment-review';
import {
  InvoicePaymentConfirmation,
} from './invoice-payment-confirmation';

import styles from './invoice-payment-form.module.css';

const MAX_DOCUMENT_COUNT = 5;
const MAX_TOTAL_DOCUMENT_SIZE = 2.5 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

type InvoiceTaxCode = 'NONE' | 'SST_6' | 'MANUAL';

function calculateIncludedSst(invoiceTotal: string) {
  const total = Number(invoiceTotal) || 0;
  return Math.round((total * 6 / 106) * 100) / 100;
}

function initialTaxCode(
  invoiceTotal: number | undefined,
  taxAmount: number | undefined,
): InvoiceTaxCode {
  if (!taxAmount) return 'NONE';

  const includedSst = invoiceTotal
    ? Math.round((invoiceTotal * 6 / 106) * 100) / 100
    : 0;

  return Math.abs(taxAmount - includedSst) < 0.01
    ? 'SST_6'
    : 'MANUAL';
}

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFile(file: File): Promise<PaymentRequestDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`${file.name} could not be read.`));
        return;
      }
      resolve({
        id: fileKey(file),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

export function InvoicePaymentForm({ initialRecord }: { initialRecord?: InvoicePaymentRequestRecord }) {
  const initialProjectIsListed = initialRecord ? (INVOICE_PAYMENT_PROJECTS as readonly string[]).includes(initialRecord.projectName) : false;
  const [account, setAccount] = useState<ReturnType<typeof readBetaSession>>(null);
  const [requestDate, setRequestDate] = useState(initialRecord?.requestDate ?? localDate());
  const [projectSelection, setProjectSelection] = useState(initialRecord ? initialProjectIsListed ? initialRecord.projectName : 'OTHER' : '');
  const [otherProjectName, setOtherProjectName] = useState(initialRecord && !initialProjectIsListed ? initialRecord.projectName : '');
  const [title, setTitle] = useState(initialRecord?.title ?? '');
  const [purpose, setPurpose] = useState(initialRecord?.purpose ?? '');
  const [vendorName, setVendorName] = useState(initialRecord?.vendorName ?? '');
  const [eInvoiceLink, setEInvoiceLink] = useState(initialRecord?.eInvoiceLink ?? '');
  const [transferType, setTransferType] = useState<InvoiceTransferType | ''>(initialRecord?.transferType ?? '');
  const [paymentPortion, setPaymentPortion] = useState<InvoicePaymentPortion | ''>(initialRecord?.paymentPortion ?? '');
  const [paymentPortionOther, setPaymentPortionOther] = useState(initialRecord?.paymentPortionOther ?? '');
  const [managerApproverId, setManagerApproverId] = useState(initialRecord?.managerApproverId ?? 'nadia-hassan');
  const [directorApproverId, setDirectorApproverId] = useState(initialRecord?.directorApproverId ?? '');
  const [remarks, setRemarks] = useState(initialRecord?.remarks ?? '');
  const [invoiceTotal, setInvoiceTotal] = useState(initialRecord ? String(initialRecord.invoiceTotal) : '');
  const [taxCode, setTaxCode] = useState<InvoiceTaxCode>(() =>
    initialTaxCode(initialRecord?.invoiceTotal, initialRecord?.taxAmount),
  );
  const [taxAmount, setTaxAmount] = useState(initialRecord?.taxAmount ? String(initialRecord.taxAmount) : '');
  const [otherRequestedAmount, setOtherRequestedAmount] = useState(initialRecord?.paymentPortion === 'OTHER' ? String(initialRecord.requestedAmount) : '');
  const [documents, setDocuments] = useState<PaymentRequestDocument[]>(initialRecord?.supportingDocuments ?? []);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdRequest, setCreatedRequest] =
    useState<InvoicePaymentRequestRecord | null>(null);

  useEffect(() => {
    setAccount(readBetaSession());
  }, []);

  useEffect(() => {
    if (taxCode === 'SST_6') {
      setTaxAmount(calculateIncludedSst(invoiceTotal).toFixed(2));
    }
  }, [invoiceTotal, taxCode]);

  const projectName =
    projectSelection === 'OTHER'
      ? otherProjectName.trim()
      : projectSelection;

  const requestedAmount = useMemo(() => {
    const total = Number(invoiceTotal) || 0;
    if (paymentPortion === 'UPFRONT_50' || paymentPortion === 'BALANCE_50') {
      return total * 0.5;
    }
    if (paymentPortion === 'FULL') return total;
    if (paymentPortion === 'OTHER') return Number(otherRequestedAmount) || 0;
    return 0;
  }, [invoiceTotal, otherRequestedAmount, paymentPortion]);

  const amountInWords = useMemo(
    () => amountToMalayWords(requestedAmount),
    [requestedAmount],
  );

  async function selectDocuments(event: ChangeEvent<HTMLInputElement>) {
    setError('');
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!selected.length) return;

    const invalid = selected.find(
      (file) =>
        !ACCEPTED_DOCUMENT_TYPES.includes(file.type) &&
        !/\.(pdf|png|jpe?g)$/i.test(file.name),
    );
    if (invalid) {
      setError(`${invalid.name} is not supported. Use PDF, PNG or JPG.`);
      return;
    }

    const existingIds = new Set(documents.map((document) => document.id));
    const unique = selected.filter((file) => !existingIds.has(fileKey(file)));
    if (documents.length + unique.length > MAX_DOCUMENT_COUNT) {
      setError(`Attach no more than ${MAX_DOCUMENT_COUNT} documents.`);
      return;
    }

    const totalSize =
      documents.reduce((sum, document) => sum + document.size, 0) +
      unique.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_DOCUMENT_SIZE) {
      setError('The combined document size must be smaller than 2.5 MB for this local prototype.');
      return;
    }

    setIsReadingFiles(true);
    try {
      const readDocuments = await Promise.all(unique.map(readFile));
      setDocuments((current) => [...current, ...readDocuments]);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'The documents could not be read.');
    } finally {
      setIsReadingFiles(false);
    }
  }

  function validateForm() {
    if (!account || account.role !== 'staff') {
      return 'A signed-in Staff account is required.';
    }
    if (!requestDate || !projectName.trim() || !title.trim() || !purpose.trim()) {
      return 'Complete the request date, project, title and purpose.';
    }
    if (!vendorName.trim() || !eInvoiceLink.trim()) {
      return 'Enter the vendor name and e-invoice link.';
    }
    try {
      const url = new URL(eInvoiceLink.trim());
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    } catch {
      return 'Enter a valid e-invoice link beginning with http:// or https://.';
    }
    if (!transferType || !paymentPortion) {
      return 'Select the transfer type and payment portion.';
    }
    if (paymentPortion === 'OTHER' && !paymentPortionOther.trim()) {
      return 'Describe the other payment portion.';
    }
    if (!managerApproverId || !directorApproverId) {
      return 'Select the Manager and Director reviewers.';
    }
    const invoiceValue = Number(invoiceTotal);
    const taxValue = Number(taxAmount);
    if (!Number.isFinite(invoiceValue) || invoiceValue <= 0) {
      return 'Enter an invoice total greater than RM 0.00.';
    }
    if (!Number.isFinite(taxValue) || taxValue < 0 || taxValue > invoiceValue) {
      return 'Enter a valid Tax/SST amount that does not exceed the invoice total.';
    }
    if (requestedAmount <= 0 || requestedAmount > invoiceValue) {
      return 'The amount requested must be greater than RM 0.00 and cannot exceed the invoice total.';
    }
    if (!documents.length) {
      return 'Attach at least one e-invoice or supporting document.';
    }
    return null;
  }

  function continueToReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const message = validateForm();
    if (message) {
      setError(message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsReviewing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitRequest() {
    const message = validateForm();
    if (message || !account || !transferType || !paymentPortion) {
      setError(message ?? 'The Invoice Payment request is incomplete.');
      setIsReviewing(false);
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const input = {
        organizationId: 'beta-arus-org',
        requestDate,
        staffId: account.id,
        staffName: account.name,
        projectName: projectName.trim(),
        title: title.trim(),
        purpose: purpose.trim(),
        vendorName: vendorName.trim(),
        eInvoiceLink: eInvoiceLink.trim(),
        transferType,
        paymentPortion,
        paymentPortionOther:
          paymentPortion === 'OTHER' ? paymentPortionOther.trim() : undefined,
        managerApproverId,
        directorApproverId,
        currency: 'MYR',
        invoiceTotal: Number(invoiceTotal),
        taxAmount: Number(taxAmount),
        requestedAmount,
        supportingDocuments: documents,
        remarks: remarks.trim() || undefined,
      } as const;
      const record = initialRecord
        ? await resubmitInvoicePayment(initialRecord.id, input)
        : await createInvoicePayment(input);
      notifyManagerInvoicePaymentSubmitted(record, account);
      setCreatedRequest(record);
      setIsReviewing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The request could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  if (createdRequest) {
    return (
      <InvoicePaymentConfirmation
        request={createdRequest}
        onCreateAnother={() => initialRecord ? window.location.assign('/beta/payment-records/invoice-payments') : window.location.reload()}
      />
    );
  }

  if (isReviewing) {
    return (
      <InvoicePaymentReview
        documents={documents}
        eInvoiceLink={eInvoiceLink}
        error={error}
        invoiceTotal={Number(invoiceTotal)}
        isSaving={isSaving}
        paymentPortion={paymentPortion}
        paymentPortionOther={paymentPortionOther}
        projectName={projectName}
        purpose={purpose}
        requestDate={requestDate}
        requestedAmount={requestedAmount}
        staffName={account?.name ?? 'Not available'}
        taxAmount={Number(taxAmount)}
        title={title}
        transferType={transferType}
        vendorName={vendorName}
        onBack={() => setIsReviewing(false)}
        onSubmit={submitRequest}
      />
    );
  }

  return (
    <main className={styles.page}>
      <PageHeader />
      {initialRecord && <div className={styles.errorNotice} role="status"><strong>{initialRecord.requestNumber} was returned for correction.</strong><br />{initialRecord.financeReturnRemarks ?? initialRecord.directorReturnRemarks ?? initialRecord.managerReturnRemarks ?? 'Update the request and resubmit it for approval.'}</div>}
      {error && <div className={styles.errorNotice} role="alert">{error}</div>}
      <form className={styles.formCard} onSubmit={continueToReview}>
        <section className={styles.guidance}>
          <div><span>Invoice requirements</span><h2>E-Invoice / Monthly Payment</h2></div>
          <p>
            The e-invoice must be billed to <strong>Arus Education Sdn. Bhd.</strong>,
            include the required company address and contain the contractor’s bank details.
          </p>
        </section>

        <FormSection title="Request Overview" copy="Staff and project information for Finance tracking">
          <div className={styles.fieldGrid}>
            <Field label="Request date" required><input required type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} /></Field>
            <Field label="Staff name"><input disabled value={account?.name ?? 'No Staff session found'} /></Field>
            <Field
              className={styles.fullWidth}
              label="Project name"
              required
              help="If your project is not listed, select Other and enter it below."
            >
              <select
                required
                value={projectSelection}
                onChange={(event) => {
                  setProjectSelection(event.target.value);
                  if (event.target.value !== 'OTHER') {
                    setOtherProjectName('');
                  }
                }}
              >
                <option value="">Select a project</option>
                {INVOICE_PAYMENT_PROJECTS.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
                <option value="OTHER">Other</option>
              </select>

              {projectSelection === 'OTHER' && (
                <input
                  required
                  placeholder="Enter the Project Name"
                  value={otherProjectName}
                  onChange={(event) => setOtherProjectName(event.target.value)}
                />
              )}
            </Field>
            <Field className={styles.fullWidth} label="Request title" required><input required placeholder="e.g. Monthly contractor invoice for September" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
            <Field className={styles.fullWidth} label="Purpose of payment" required><textarea required rows={3} placeholder="Describe the services, billing period and reason for payment" value={purpose} onChange={(event) => setPurpose(event.target.value)} /></Field>
          </div>
        </FormSection>

        <FormSection title="Invoice Details" copy="Information required to verify and process the e-invoice">
          <div className={styles.fieldGrid}>
            <Field label="Contractor / Vendor name" required><input required placeholder="Enter the vendor name shown on the invoice" value={vendorName} onChange={(event) => setVendorName(event.target.value)} /></Field>
            <Field label="E-invoice link" required help="Use the complete URL beginning with https://"><input required type="url" placeholder="https://..." value={eInvoiceLink} onChange={(event) => setEInvoiceLink(event.target.value)} /></Field>
          </div>
          <div className={styles.choiceGrid}>
            <ChoiceGroup legend="Transfer type" required>
              <Choice checked={transferType === 'GIRO'} label="GIRO transfer" description="Processed on the next working day" onChange={() => setTransferType('GIRO')} />
              <Choice checked={transferType === 'INSTANT'} label="Instant transfer" description="Process the payment immediately" onChange={() => setTransferType('INSTANT')} />
            </ChoiceGroup>
            <ChoiceGroup legend="Payment portion" required>
              <Choice checked={paymentPortion === 'UPFRONT_50'} label="50% upfront payment" onChange={() => setPaymentPortion('UPFRONT_50')} />
              <Choice checked={paymentPortion === 'BALANCE_50'} label="50% balance payment" onChange={() => setPaymentPortion('BALANCE_50')} />
              <Choice checked={paymentPortion === 'FULL'} label="Full payment" onChange={() => setPaymentPortion('FULL')} />
              <Choice checked={paymentPortion === 'OTHER'} label="Other" onChange={() => setPaymentPortion('OTHER')} />
              {paymentPortion === 'OTHER' && <input className={styles.otherInput} required placeholder="Describe the payment portion" value={paymentPortionOther} onChange={(event) => setPaymentPortionOther(event.target.value)} />}
            </ChoiceGroup>
          </div>
        </FormSection>

        <FormSection title="Payment Amount" copy="Enter the invoice total; Estuary calculates the requested amount from the selected payment portion">
          <div className={styles.amountTableWrap}>
            <table className={styles.amountTable}>
              <thead><tr><th>Currency</th><th>Invoice Total <em>*</em></th><th>Tax Code</th><th>Amount Requested <em>*</em></th></tr></thead>
              <tbody><tr>
                <td><input aria-label="Currency" disabled value="MYR" /></td>
                <td><input aria-label="Invoice total" required inputMode="decimal" type="text" placeholder="Enter invoice total" value={invoiceTotal} onChange={(event) => setInvoiceTotal(event.target.value)} /><small>Final total including Tax/SST</small></td>
                <td>
                  <select aria-label="Tax code" value={taxCode} onChange={(event) => {
                    const nextTaxCode = event.target.value as InvoiceTaxCode;
                    setTaxCode(nextTaxCode);
                    if (nextTaxCode === 'NONE' || nextTaxCode === 'MANUAL') setTaxAmount('');
                    if (nextTaxCode === 'SST_6') setTaxAmount(calculateIncludedSst(invoiceTotal).toFixed(2));
                  }}>
                    <option value="NONE">No tax</option><option value="SST_6">SST 6%</option><option value="MANUAL">Manual tax</option>
                  </select>
                  {taxCode === 'MANUAL' && <input aria-label="Manual tax amount" inputMode="decimal" type="text" placeholder="Enter tax amount" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} />}
                  {taxCode === 'SST_6' && <small>Included SST: RM {Number(taxAmount || 0).toFixed(2)}</small>}
                </td>
                <td>
                  {paymentPortion === 'OTHER' ? <input aria-label="Amount requested" required inputMode="decimal" type="text" placeholder="Enter requested amount" value={otherRequestedAmount} onChange={(event) => setOtherRequestedAmount(event.target.value)} /> : <input aria-label="Amount requested" disabled placeholder="Select payment portion" value={paymentPortion ? requestedAmount.toFixed(2) : ''} />}
                  <small>{paymentPortion === 'OTHER' ? 'Custom payment portion' : 'Calculated automatically'}</small>
                </td>
              </tr></tbody>
            </table>
          </div>
          <div className={styles.amountWordsBox}>
            <span>Amount requested in words</span>
            <output>{amountInWords}</output>
          </div>
        </FormSection>

        <FormSection title="Supporting Documents" copy="Attach the e-invoice and any supporting proof" required>
          <div className={styles.uploadField}>
            <input accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" id="invoice-documents" multiple type="file" onChange={selectDocuments} />
            <label className={styles.uploadArea} htmlFor="invoice-documents"><strong>{isReadingFiles ? 'Reading files…' : 'Choose supporting documents'}</strong><span>PDF, PNG or JPG · maximum 5 files · 2.5 MB combined</span></label>
            {documents.length > 0 && <ul className={styles.documentList}>{documents.map((document) => <li key={document.id}><div><strong>{document.fileName}</strong><span>{formatFileSize(document.size)}</span></div><button type="button" onClick={() => setDocuments((current) => current.filter((item) => item.id !== document.id))}>Remove</button></li>)}</ul>}
          </div>
        </FormSection>

        <FormSection title="Review Workflow" copy="Manager and Director review without signatures">
          <div className={styles.fieldGrid}>
            <Field label="Manager reviewer" required><select required value={managerApproverId} onChange={(event) => setManagerApproverId(event.target.value)}><option value="nadia-hassan">Nadia Hassan</option></select></Field>
            <Field label="Director reviewer" required><select required value={directorApproverId} onChange={(event) => setDirectorApproverId(event.target.value)}><option value="">Choose Director</option><option value="amir-iskandar">Amir Iskandar</option><option value="farid-hakim">Farid Hakim</option><option value="maryam-iskandar">Maryam Iskandar</option><option value="daniel-lee">Daniel Lee</option></select></Field>
            <Field className={styles.fullWidth} label="Additional remarks"><textarea rows={3} placeholder="Optional notes for Manager, Director or Finance" value={remarks} onChange={(event) => setRemarks(event.target.value)} /></Field>
          </div>
        </FormSection>

        <footer className={styles.formActions}><button className={styles.primaryButton} disabled={isReadingFiles} type="submit">Continue to review <span aria-hidden="true">→</span></button></footer>
      </form>
    </main>
  );
}

function PageHeader({ review = false }: { review?: boolean }) {
  return <header className={styles.pageHeader}><div><p>Payment Requests / Invoice Payment</p><h1>{review ? 'Review Invoice Payment' : 'Create Invoice Payment'}</h1></div><span>{review ? 'Review' : 'Draft'}</span></header>;
}

function FormSection({ title, copy, required = false, children }: { title: string; copy: string; required?: boolean; children: React.ReactNode }) {
  return <section className={styles.formSection}><div className={styles.sectionHeading}><div><h2>{title}</h2>{required && <span>Required</span>}</div><p>{copy}</p></div>{children}</section>;
}

function Field({ label, required = false, help, className, children }: { label: string; required?: boolean; help?: string; className?: string; children: React.ReactNode }) {
  return <label className={`${styles.field} ${className ?? ''}`}><span>{label}{required && <em> *</em>}</span>{children}{help && <small>{help}</small>}</label>;
}

function ChoiceGroup({ legend, required = false, children }: { legend: string; required?: boolean; children: React.ReactNode }) {
  return <fieldset className={styles.choiceGroup}><legend>{legend}{required && <em> *</em>}</legend>{children}</fieldset>;
}

function Choice({ checked, label, description, onChange }: { checked: boolean; label: string; description?: string; onChange: () => void }) {
  return <label className={`${styles.choice} ${checked ? styles.choiceSelected : ''}`}><input checked={checked} name={label.includes('transfer') ? 'transfer' : 'portion'} type="radio" onChange={onChange} /><span><strong>{label}</strong>{description && <small>{description}</small>}</span></label>;
}

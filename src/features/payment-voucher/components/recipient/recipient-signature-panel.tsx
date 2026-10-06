'use client';

import { type ChangeEvent, useRef, useState } from 'react';

import {
  submitManualSignedPaymentVoucherByRecipient,
  submitPaymentVoucherRecipientSignature,
} from '@/data/payment-vouchers/payment-voucher-api';
import type {
  PaymentVoucherRecord,
  RecipientSignatureMethod,
} from '@/domain/payment-vouchers/types';
import { downloadPaymentVoucherPdf } from '@/features/payment-voucher/pdf/download-payment-voucher-pdf';

import styles from './recipient-payment-voucher.module.css';

type RecipientSignaturePanelProps = {
  token: string;
  voucher: PaymentVoucherRecord;
  onSubmitted: (voucher: PaymentVoucherRecord) => void;
};

const MAX_MANUAL_PDF_SIZE = 2.5 * 1024 * 1024;
const MAX_TYPED_NAME_LENGTH = 80;

function createTypedSignatureDataUrl(name: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 280;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Your browser could not create the typed signature.');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#102a4c';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const fontFamily = '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive';
  let fontSize = 116;
  context.font = `italic ${fontSize}px ${fontFamily}`;

  while (fontSize > 48 && context.measureText(name).width > 900) {
    fontSize -= 4;
    context.font = `italic ${fontSize}px ${fontFamily}`;
  }

  context.fillText(name, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL('image/png');
}

function typedSignatureFileName(name: string) {
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `${safeName || 'recipient'}-typed-signature.png`;
}

export function RecipientSignaturePanel({
  token,
  voucher,
  onSubmitted,
}: RecipientSignaturePanelProps) {
  const manualPdfInputRef = useRef<HTMLInputElement | null>(null);
  const [method, setMethod] = useState<RecipientSignatureMethod>(
    voucher.recipientSignatureMethod ?? 'DIGITAL',
  );
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [typedSignatureName, setTypedSignatureName] = useState(voucher.recipientName);
  const [manualPdfDataUrl, setManualPdfDataUrl] = useState('');
  const [manualPdfFileName, setManualPdfFileName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  function chooseMethod(nextMethod: RecipientSignatureMethod) {
    if (isSubmitting) return;
    setMethod(nextMethod);
    setErrorMessage('');
  }

  function handleManualPdfFile(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage('');
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please upload the manually signed PV as a PDF file.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_MANUAL_PDF_SIZE) {
      setErrorMessage('The signed PDF must be smaller than 2.5 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setErrorMessage('The signed PDF could not be read.');
        return;
      }
      setManualPdfDataUrl(reader.result);
      setManualPdfFileName(file.name);
    };
    reader.onerror = () => setErrorMessage('The signed PDF could not be read.');
    reader.readAsDataURL(file);
  }

  function removeManualPdf() {
    setManualPdfDataUrl('');
    setManualPdfFileName('');
    setErrorMessage('');
    if (manualPdfInputRef.current) manualPdfInputRef.current.value = '';
  }

  async function handleDownloadPdf() {
    setErrorMessage('');
    setIsDownloading(true);
    try {
      await downloadPaymentVoucherPdf(voucher);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to download the Payment Voucher PDF.',
      );
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleSubmit() {
    setErrorMessage('');

    if (!isConfirmed) {
      setErrorMessage(
        'Please confirm that you received the payment and that the information is correct.',
      );
      return;
    }

    const signatureName = typedSignatureName.trim();
    if (method === 'DIGITAL' && signatureName.length < 2) {
      setErrorMessage('Please type your full name to create your digital signature.');
      return;
    }

    if (method === 'MANUAL' && (!manualPdfFileName || !manualPdfDataUrl)) {
      setErrorMessage('Please upload the complete manually signed PV PDF.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedVoucher = method === 'DIGITAL'
        ? await submitPaymentVoucherRecipientSignature(token, {
            signatureFileName: typedSignatureFileName(signatureName),
            signatureDataUrl: createTypedSignatureDataUrl(signatureName),
            confirmedPaymentReceived: true,
          })
        : await submitManualSignedPaymentVoucherByRecipient(token, {
            fileName: manualPdfFileName,
            dataUrl: manualPdfDataUrl,
            confirmedPaymentReceived: true,
          });

      onSubmitted(updatedVoucher);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to submit the signed Payment Voucher.',
      );
      setIsSubmitting(false);
    }
  }

  const hasRequiredSignature = method === 'DIGITAL'
    ? typedSignatureName.trim().length >= 2
    : Boolean(manualPdfFileName && manualPdfDataUrl);

  return (
    <section className={styles.actionCard}>
      <p className={styles.sectionLabel}>Recipient confirmation</p>
      <h2>Confirm and sign Payment Voucher</h2>
      <p className={styles.actionDescription}>
        Confirm the payment details, then choose a typed digital signature or
        upload a Payment Voucher that you printed and signed manually.
      </p>

      <label className={styles.confirmationBox}>
        <input
          checked={isConfirmed}
          type="checkbox"
          onChange={(event) => setIsConfirmed(event.target.checked)}
        />
        <span>
          I, <strong>{voucher.recipientName}</strong>, confirm that I have received
          the stated payment in full and that all personal and banking details
          shown above are accurate.
        </span>
      </label>

      <div className={styles.methodSection}>
        <div className={styles.methodHeading}>
          <strong>Choose signing method</strong>
          <span>Required</span>
        </div>

        <div className={styles.methodGrid}>
          <button
            className={`${styles.methodCard} ${method === 'DIGITAL' ? styles.methodCardSelected : ''}`}
            disabled={isSubmitting}
            type="button"
            onClick={() => chooseMethod('DIGITAL')}
          >
            <span aria-hidden="true" className={styles.methodIcon}>✎</span>
            <strong>Type signature</strong>
            <span>Type your full name and Estuary will create a cursive signature.</span>
          </button>

          <button
            className={`${styles.methodCard} ${method === 'MANUAL' ? styles.methodCardSelected : ''}`}
            disabled={isSubmitting}
            type="button"
            onClick={() => chooseMethod('MANUAL')}
          >
            <span aria-hidden="true" className={styles.methodIcon}>PDF</span>
            <strong>Sign manually</strong>
            <span>Download, print, sign and upload the completed PDF.</span>
          </button>
        </div>
      </div>

      {method === 'DIGITAL' ? (
        <div className={styles.typedSignatureSection}>
          <label htmlFor="recipient-typed-signature">
            <span>Type your full name</span>
            <small>This name will appear as your digital signature.</small>
          </label>

          <input
            autoComplete="name"
            disabled={isSubmitting}
            id="recipient-typed-signature"
            maxLength={MAX_TYPED_NAME_LENGTH}
            placeholder="Enter your full name"
            type="text"
            value={typedSignatureName}
            onChange={(event) => {
              setTypedSignatureName(event.target.value);
              setErrorMessage('');
            }}
          />

          <div className={styles.signaturePreviewCard}>
            <div className={styles.previewHeading}>
              <span>Signature preview</span>
              <small>Typed signature</small>
            </div>

            <div
              aria-label={
                typedSignatureName.trim()
                  ? `Signature preview for ${typedSignatureName.trim()}`
                  : 'Signature preview'
              }
              className={styles.cursiveSignature}
            >
              {typedSignatureName.trim() || 'Your signature'}
            </div>

            <p>
              By submitting, you agree that this typed name represents your
              electronic signature for this Payment Voucher.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.manualSection}>
          <div className={styles.manualStep}>
            <span className={styles.stepNumber}>1</span>
            <div>
              <strong>Download and sign the Payment Voucher</strong>
              <p>Print the PDF, sign it in the recipient section and scan it.</p>
            </div>
          </div>

          <button
            className={styles.downloadOutlineButton}
            disabled={isDownloading || isSubmitting}
            type="button"
            onClick={handleDownloadPdf}
          >
            {isDownloading ? 'Preparing PDF…' : 'Download Payment Voucher PDF'}
          </button>

          <div className={styles.manualStep}>
            <span className={styles.stepNumber}>2</span>
            <div>
              <strong>Upload the complete signed PDF</strong>
              <p>PDF only, with a maximum size of 2.5 MB for this beta.</p>
            </div>
          </div>

          <input
            ref={manualPdfInputRef}
            accept="application/pdf,.pdf"
            className={styles.hiddenFileInput}
            id="recipient-manual-pv"
            type="file"
            onChange={handleManualPdfFile}
          />

          {!manualPdfDataUrl ? (
            <button
              className={styles.uploadButton}
              type="button"
              onClick={() => manualPdfInputRef.current?.click()}
            >
              <span aria-hidden="true" className={styles.uploadIcon}>PDF</span>
              <strong>Upload signed Payment Voucher</strong>
              <small>Click to browse and choose the completed PDF</small>
            </button>
          ) : (
            <div className={styles.manualFileReady}>
              <div>
                <strong>Signed PDF ready</strong>
                <span>{manualPdfFileName}</span>
              </div>
              <button type="button" onClick={removeManualPdf}>Remove</button>
            </div>
          )}
        </div>
      )}

      {errorMessage && (
        <div className={styles.signatureError} role="alert">
          {errorMessage}
        </div>
      )}

      <button
        className={styles.submitButton}
        disabled={isSubmitting || !isConfirmed || !hasRequiredSignature}
        type="button"
        onClick={handleSubmit}
      >
        {isSubmitting
          ? 'Submitting…'
          : method === 'DIGITAL'
            ? 'Confirm and submit typed signature'
            : 'Confirm and submit manually signed PDF'}
      </button>

      <p className={styles.securityNote}>
        The submitted signature will be recorded for voucher{' '}
        <strong>{voucher.voucherNumber}</strong> and routed to Staff for verification.
      </p>
    </section>
  );
}

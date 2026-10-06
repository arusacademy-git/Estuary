'use client';

import {
  type ChangeEvent,
  useState,
} from 'react';

import type { BetaAccount } from '@/lib/auth/beta-accounts';
import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';

import {
  uploadManualSignedPaymentVoucherByStaff,
} from '@/data/payment-vouchers/payment-voucher-api';
import {
  notifyFinanceSignedPvUploaded,
} from '@/features/payment-voucher/notifications/payment-voucher-notifications';

import styles from '@/features/payment-voucher/components/staff/staff-signed-pv-upload.module.css';

type StaffSignedPvUploadPanelProps = {
  staff: BetaAccount;
  voucher: PaymentVoucherRecord;
};

const MAX_SIGNED_FILE_SIZE = 2.5 * 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read the signed Payment Voucher PDF.'));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error('Unable to read the signed Payment Voucher PDF.'));
    };

    reader.readAsDataURL(file);
  });
}

export function StaffSignedPvUploadPanel({
  staff,
  voucher,
}: StaffSignedPvUploadPanelProps) {
  const [signedPvFile, setSignedPvFile] = useState<File | null>(null);
  const [confirmedPaymentReceived, setConfirmedPaymentReceived] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isOriginalSubmitter = voucher.submitterId === staff.id;
  const isWaitingForSignedPv = voucher.status === 'AWAITING_RECIPIENT_SIGNATURE';

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setErrorMessage('');
    setSuccessMessage('');

    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setSignedPvFile(null);
      return;
    }

    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      event.target.value = '';
      setSignedPvFile(null);
      setErrorMessage('The signed Payment Voucher must be a PDF file.');
      return;
    }

    if (selectedFile.size > MAX_SIGNED_FILE_SIZE) {
      event.target.value = '';
      setSignedPvFile(null);
      setErrorMessage('The signed PDF must be smaller than 2.5 MB.');
      return;
    }

    setSignedPvFile(selectedFile);
  }

  async function handleUploadSignedPv() {
    setErrorMessage('');
    setSuccessMessage('');

    if (!signedPvFile) {
      setErrorMessage('Select the signed Payment Voucher PDF.');
      return;
    }

    if (!confirmedPaymentReceived) {
      setErrorMessage(
        'Confirm that the recipient received the payment and signed the complete Payment Voucher.',
      );
      return;
    }

    if (!isOriginalSubmitter) {
      setErrorMessage('Only the original Staff submitter can upload the signed PV.');
      return;
    }

    setIsUploading(true);

    try {
      const dataUrl = await readFileAsDataUrl(signedPvFile);
      const updatedVoucher = await uploadManualSignedPaymentVoucherByStaff(
        voucher.id,
        staff.id,
        {
          fileName: signedPvFile.name,
          dataUrl,
          confirmedPaymentReceived: true,
        },
      );

      notifyFinanceSignedPvUploaded(updatedVoucher, staff);
      setSignedPvFile(null);
      setConfirmedPaymentReceived(false);
      setSuccessMessage(
        'The signed Payment Voucher was uploaded and sent to Finance for verification.',
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to upload the signed Payment Voucher.',
      );
    } finally {
      setIsUploading(false);
    }
  }

  if (!isOriginalSubmitter || !isWaitingForSignedPv) {
    return null;
  }

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Action required</p>
        <h2>Upload the recipient-signed Payment Voucher</h2>
        <p>
          Upload the complete PDF returned by the recipient so Finance can
          perform the final verification.
        </p>
      </div>

      <div className={styles.generatedFile}>
        <div>
          <span>Generated PV</span>
          <strong>{voucher.pvPdfFileName || 'Not generated'}</strong>
        </div>
        <small>
          Generated{' '}
          {voucher.pvPdfGeneratedAt
            ? new Date(voucher.pvPdfGeneratedAt).toLocaleString('en-MY')
            : 'date unavailable'}
        </small>
      </div>

      <label className={styles.fileField}>
        <span>Signed Payment Voucher PDF</span>
        <input
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          type="file"
        />
        <small>PDF only. Maximum file size 2.5 MB.</small>
      </label>

      {signedPvFile && (
        <div className={styles.selectedFile}>
          <span>Selected file</span>
          <strong>{signedPvFile.name}</strong>
        </div>
      )}

      <label>
        <input
          checked={confirmedPaymentReceived}
          onChange={(event) => setConfirmedPaymentReceived(event.target.checked)}
          type="checkbox"
        />{' '}
        I confirm the recipient received the payment and signed this complete PV.
      </label>

      {errorMessage && <div className={styles.errorMessage} role="alert">{errorMessage}</div>}
      {successMessage && <div className={styles.successMessage} role="status">{successMessage}</div>}

      <button
        className={styles.uploadButton}
        disabled={!signedPvFile || !confirmedPaymentReceived || isUploading}
        onClick={handleUploadSignedPv}
        type="button"
      >
        {isUploading ? 'Uploading…' : 'Upload signed PV and notify Finance'}
      </button>
    </section>
  );
}

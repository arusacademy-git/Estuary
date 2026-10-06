import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

import {
  fetchSignatureImageDataUrl,
  fetchUserSignature,
} from '@/data/signatures/signature-api';

import {
  buildPaymentVoucherPdf,
} from '@/features/payment-voucher/pdf/build-payment-voucher-pdf';

import type {
  BuildPaymentVoucherPdfOptions,
} from '@/features/payment-voucher/pdf/build-payment-voucher-pdf';

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function createPdfFileName(voucher: PaymentVoucherRecord) {
  const preferredFileName = voucher.recipientSignatureDataUrl
    ? voucher.signedPvFileName
    : voucher.pvPdfFileName;

  if (preferredFileName) {
    const safeExistingName = sanitizeFileName(preferredFileName);
    return safeExistingName.toLowerCase().endsWith('.pdf')
      ? safeExistingName
      : `${safeExistingName}.pdf`;
  }

  const voucherNumber = sanitizeFileName(voucher.voucherNumber) || 'payment-voucher';
  return voucher.recipientSignatureDataUrl
    ? `${voucherNumber}-signed.pdf`
    : `${voucherNumber}.pdf`;
}

function createSafeArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function getDirectorSignatureDataUrl(voucher: PaymentVoucherRecord) {
  if (!voucher.directorSignatureKey) return null;

  try {
    return await fetchSignatureImageDataUrl(
      voucher.directorSignatureKey,
      voucher.directorId,
    );
  } catch (originalError) {
    /*
     * Compatibility for vouchers approved before signatures moved from
     * browser-local storage to Prisma. Their approval transition contains a
     * legacy local signature ID rather than a Document ID, so the private
     * image route correctly returns 404. Use the Director's active database
     * signature for those historical beta vouchers.
     *
     * New approvals store the real Document ID and return in the try block.
     */
    const activeSignature = await fetchUserSignature(
      voucher.organizationId,
      voucher.directorId,
    );

    if (!activeSignature) {
      throw originalError;
    }

    return fetchSignatureImageDataUrl(
      activeSignature.documentId,
      voucher.directorId,
    );
  }
}

export async function downloadPaymentVoucherPdf(
  voucher: PaymentVoucherRecord,
  options: BuildPaymentVoucherPdfOptions = {},
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('The Payment Voucher PDF can only be downloaded from the browser.');
  }

  const directorSignatureDataUrl =
    options.directorSignatureDataUrl ??
    await getDirectorSignatureDataUrl(voucher);

  const recipientSignatureDataUrl =
    options.recipientSignatureDataUrl ??
    voucher.recipientSignatureDataUrl ??
    null;

  const pdfBytes = await buildPaymentVoucherPdf(voucher, {
    directorSignatureDataUrl,
    recipientSignatureDataUrl,
  });

  const pdfBlob = new Blob(
    [createSafeArrayBuffer(pdfBytes)],
    { type: 'application/pdf' },
  );
  const downloadUrl = URL.createObjectURL(pdfBlob);
  const downloadLink = document.createElement('a');

  downloadLink.href = downloadUrl;
  downloadLink.download = createPdfFileName(voucher);
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

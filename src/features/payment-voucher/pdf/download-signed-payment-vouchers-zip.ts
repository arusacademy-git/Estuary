import type { PaymentVoucherRecord } from '@/domain/payment-vouchers/types';
import { fetchSignatureImageDataUrl, fetchUserSignature } from '@/data/signatures/signature-api';
import { buildPaymentVoucherPdf } from '@/features/payment-voucher/pdf/build-payment-voucher-pdf';

type ZipEntry = { name: string; bytes: Uint8Array };

function sanitize(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function dataUrlBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('The signed Payment Voucher file is invalid.');
  const metadata = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (metadata.includes(';base64')) {
    const binary = window.atob(payload);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

async function directorSignature(voucher: PaymentVoucherRecord) {
  if (!voucher.directorSignatureKey) return null;
  try {
    return await fetchSignatureImageDataUrl(voucher.directorSignatureKey, voucher.directorId);
  } catch (originalError) {
    const current = await fetchUserSignature(voucher.organizationId, voucher.directorId);
    if (!current) throw originalError;
    return fetchSignatureImageDataUrl(current.documentId, voucher.directorId);
  }
}

async function signedPdf(voucher: PaymentVoucherRecord): Promise<ZipEntry> {
  const defaultName = `${sanitize(voucher.voucherNumber) || 'payment-voucher'}-signed.pdf`;

  if (voucher.signedPvDataUrl) {
    const suppliedName = sanitize(voucher.signedPvFileName ?? defaultName);
    return {
      name: suppliedName.toLowerCase().endsWith('.pdf') ? suppliedName : `${suppliedName}.pdf`,
      bytes: dataUrlBytes(voucher.signedPvDataUrl),
    };
  }

  if (!voucher.recipientSignatureDataUrl) {
    throw new Error(`${voucher.voucherNumber} does not have a signed PDF.`);
  }

  return {
    name: defaultName,
    bytes: await buildPaymentVoucherPdf(voucher, {
      directorSignatureDataUrl: await directorSignature(voucher),
      recipientSignatureDataUrl: voucher.recipientSignatureDataUrl,
    }),
  };
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number) {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function join(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function zipStore(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.bytes);
    const local = join([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(checksum), u32(entry.bytes.length), u32(entry.bytes.length),
      u16(name.length), u16(0), name, entry.bytes,
    ]);
    localParts.push(local);
    centralParts.push(join([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(checksum), u32(entry.bytes.length), u32(entry.bytes.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ]));
    offset += local.length;
  }

  const central = join(centralParts);
  return join([
    ...localParts,
    central,
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(offset), u16(0),
  ]);
}

export function canDownloadSignedPaymentVoucher(voucher: PaymentVoucherRecord) {
  return voucher.status === 'COMPLETED' && Boolean(
    voucher.signedPvDataUrl || voucher.recipientSignatureDataUrl,
  );
}

export async function downloadSignedPaymentVouchersZip(vouchers: PaymentVoucherRecord[]) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Signed Payment Vouchers can only be downloaded from the browser.');
  }

  const eligible = vouchers.filter(canDownloadSignedPaymentVoucher);
  if (!eligible.length) throw new Error('No completed signed Payment Vouchers are available to download.');

  const entries: ZipEntry[] = [];
  for (const voucher of eligible) entries.push(await signedPdf(voucher));

  const bytes = zipStore(entries);
  const safeBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(safeBuffer).set(bytes);
  const url = URL.createObjectURL(new Blob([safeBuffer], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `signed-payment-vouchers-${new Date().toISOString().slice(0, 10)}.zip`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

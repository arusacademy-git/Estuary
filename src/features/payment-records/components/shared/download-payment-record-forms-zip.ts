'use client';

export type PaymentRecordZipEntry = { name: string; url: string };
type ZipEntry = { name: string; bytes: Uint8Array };

function sanitize(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function u16(value: number) { return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff); }
function u32(value: number) { return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff); }
function join(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function zipStore(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const encoder = new TextEncoder();
  let offset = 0;
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
    ...localParts, central,
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(offset), u16(0),
  ]);
}

async function retrieve(entry: PaymentRecordZipEntry, index: number): Promise<ZipEntry> {
  const response = await fetch(entry.url);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `Could not retrieve ${entry.name}.`);
  }
  const rawName = sanitize(entry.name) || `payment-form-${index + 1}.pdf`;
  return { name: rawName, bytes: new Uint8Array(await response.arrayBuffer()) };
}

export async function downloadPaymentRecordFormsZip(entries: PaymentRecordZipEntry[], archiveName: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('Forms can only be downloaded from the browser.');
  if (!entries.length) throw new Error('No completed forms are available for the current filters.');

  const names = new Map<string, number>();
  const uniqueEntries = entries.map((entry) => {
    const clean = sanitize(entry.name) || 'payment-form.pdf';
    const seen = names.get(clean) ?? 0;
    names.set(clean, seen + 1);
    if (!seen) return { ...entry, name: clean };
    const dot = clean.lastIndexOf('.');
    return { ...entry, name: dot > 0 ? `${clean.slice(0, dot)}-${seen + 1}${clean.slice(dot)}` : `${clean}-${seen + 1}` };
  });

  const files: ZipEntry[] = [];
  for (let index = 0; index < uniqueEntries.length; index += 1) files.push(await retrieve(uniqueEntries[index], index));

  const bytes = zipStore(files);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitize(archiveName) || 'payment-forms'}-${new Date().toISOString().slice(0, 10)}.zip`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
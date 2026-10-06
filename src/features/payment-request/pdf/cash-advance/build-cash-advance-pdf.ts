import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';

import type { CashAdvanceRecord } from '@/domain/payment-requests/cash-advance/types';

export type CashAdvancePdfForm = 'request' | 'summary' | 'participant' | 'pack';

export type CashAdvancePdfSignature = {
  bytes: Uint8Array;
  mimeType: string;
};

export type CashAdvancePdfSignatures = {
  staff?: CashAdvancePdfSignature;
  manager?: CashAdvancePdfSignature;
  director?: CashAdvancePdfSignature;
};

type BuildOptions = {
  form?: CashAdvancePdfForm;
  templateRoot?: string;
  signatures?: CashAdvancePdfSignatures;
  financeVerifierName?: string;
};

const DARK = rgb(0.03, 0.06, 0.1);
const REQUEST_ROWS = 13;
const SUMMARY_ROWS = 13;

function date(value?: string) {
  if (!value) return '';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function truncate(font: PDFFont, value: string, size: number, width: number) {
  const text = value.trim();
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let shortened = text;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}…`, size) > width) shortened = shortened.slice(0, -1);
  return `${shortened.trimEnd()}…`;
}

function drawCell(page: PDFPage, font: PDFFont, value: string, x: number, centerY: number, width: number, size = 6.5, align: 'left' | 'center' | 'right' = 'left') {
  const text = truncate(font, value || '', size, width - 5);
  const textWidth = font.widthOfTextAtSize(text, size);
  const textX = align === 'center' ? x + (width - textWidth) / 2 : align === 'right' ? x + width - textWidth - 2.5 : x + 2.5;
  page.drawText(text, { x: textX, y: centerY - size * 0.35, size, font, color: DARK });
}

function wrap(font: PDFFont, value: string, size: number, width: number, maxLines: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !current) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const retained = lines.slice(0, maxLines);
    retained[maxLines - 1] = truncate(font, lines.slice(maxLines - 1).join(' '), size, width);
    return retained;
  }
  return lines;
}

function drawWrappedCell(page: PDFPage, font: PDFFont, value: string, x: number, centerY: number, width: number, rowHeight: number) {
  let size = 6.1;
  let lines = wrap(font, value, size, width - 5, 2);
  while (size > 4.8 && (lines.length > 2 || lines.length * (size + 0.4) > rowHeight - 1.5)) {
    size -= 0.25;
    lines = wrap(font, value, size, width - 5, 2);
  }
  const lineHeight = size + 0.35;
  const firstBaseline = centerY + ((lines.length - 1) * lineHeight) / 2 - size * 0.35;
  lines.forEach((line, index) => page.drawText(line, { x: x + 2.5, y: firstBaseline - index * lineHeight, size, font, color: DARK }));
}

async function embedSignature(pdf: PDFDocument, signature?: CashAdvancePdfSignature) {
  if (!signature) return undefined;
  if (signature.mimeType === 'image/png') return pdf.embedPng(signature.bytes);
  if (signature.mimeType === 'image/jpeg' || signature.mimeType === 'image/jpg') return pdf.embedJpg(signature.bytes);
  throw new Error('Cash Advance PDF signatures must be PNG or JPG. Re-upload WebP signatures as PNG in Settings.');
}

function drawImageInBox(page: PDFPage, image: PDFImage | undefined, x: number, y: number, width: number, height: number) {
  if (!image) return;
  const scale = Math.min(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  page.drawImage(image, { x: x + (width - imageWidth) / 2, y: y + (height - imageHeight) / 2, width: imageWidth, height: imageHeight });
}

async function templatePage(output: PDFDocument, templatePath: string) {
  const template = await PDFDocument.load(await readFile(templatePath));
  if (!template.getPageCount()) throw new Error(`PDF template has no pages: ${path.basename(templatePath)}`);
  const [page] = await output.copyPages(template, [0]);
  output.addPage(page);
  return page;
}

function documentBytes(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('The uploaded Participant Allowance form is invalid.');
  return { mimeType: match[1].toLowerCase(), bytes: Uint8Array.from(Buffer.from(match[2], 'base64')) };
}

async function appendRequest(
  output: PDFDocument,
  record: CashAdvanceRecord,
  root: string,
  regular: PDFFont,
  bold: PDFFont,
  signatures: CashAdvancePdfSignatures,
  financeVerifierName?: string,
) {
  const linePages = chunks(record.lines, REQUEST_ROWS);
  const [staffImage, managerImage, directorImage] = await Promise.all([
    embedSignature(output, signatures.staff),
    embedSignature(output, signatures.manager),
    embedSignature(output, signatures.director),
  ]);

  for (const [pageIndex, lines] of linePages.entries()) {
    const page = await templatePage(output, path.join(root, 'Cash Advance Request Form Template.pdf'));
    drawCell(page, regular, record.requestNumber, 616, 445, 131, 7.5, 'center');
    drawCell(page, regular, record.requesterName, 154, 408, 203, 7.3);
    drawCell(page, regular, record.requesterPosition, 407, 408, 80, 7.1);
    drawCell(page, regular, record.requesterContact, 541, 408, 75, 7.1);
    drawCell(page, regular, date(record.requestDate), 652, 408, 95, 7.1);

    lines.forEach((line, rowIndex) => {
      const centerY = 366.7 - rowIndex * 13.35;
      drawCell(page, regular, line.description, 166, centerY, 321, 6.2);
      drawWrappedCell(page, regular, line.purpose, 487, centerY, 129, 13.35);
      drawCell(page, regular, line.amount.toFixed(2), 616, centerY, 131, 6.4, 'right');
    });

    const finalPage = pageIndex === linePages.length - 1;
    drawCell(page, bold, finalPage ? record.totalAmount.toFixed(2) : 'Continued', 616, 196, 131, 7, 'right');
    drawCell(page, regular, `Page ${pageIndex + 1} of ${linePages.length}`, 650, 45, 95, 6.5, 'right');
    if (finalPage) {
      drawCell(page, regular, record.accountHolderName ?? '', 230, 190, 257, 7);
      drawCell(page, regular, record.bankName ?? '', 230, 177, 257, 7);
      drawCell(page, regular, record.bankAccountNumber ?? '', 230, 164, 257, 7);
      drawCell(page, regular, financeVerifierName ?? '', 536, 168, 209, 7);
      drawCell(page, regular, date(record.financePaidAt), 536, 157, 209, 7);
      drawImageInBox(page, staffImage, 232, 122, 250, 38);
      drawImageInBox(page, managerImage, 232, 86, 250, 32);
      drawImageInBox(page, directorImage, 232, 54, 250, 29);
    }
  }
}

async function appendSummary(output: PDFDocument, record: CashAdvanceRecord, root: string, regular: PDFFont, bold: PDFFont) {
  const reconciliation = record.reconciliation;
  if (!reconciliation) throw new Error('The Cash Spent Summary is available after Staff submits reconciliation.');
  const expensePages = chunks(reconciliation.expenses, SUMMARY_ROWS);
  for (const [pageIndex, expenses] of expensePages.entries()) {
    const page = await templatePage(output, path.join(root, 'Summary of Cash Advance Spent Template.pdf'));
    drawCell(page, regular, record.requestNumber, 687, 468, 105, 7.4, 'center');
    expenses.forEach((expense, rowIndex) => {
      const centerY = 402.4 - rowIndex * 12.75;
      drawCell(page, regular, date(expense.expenseDate), 98, centerY, 53, 5.8, 'center');
      drawCell(page, regular, expense.supplier ?? '', 151, centerY, 129, 5.6);
      drawCell(page, regular, expense.description, 280, centerY, 157, 5.8);
      drawCell(page, regular, expense.accountType?.split(/\s+/)[0] ?? '', 437, centerY, 56, 5.3, 'center');
      drawCell(page, regular, record.projectName, 493, centerY, 54, 5.3, 'center');
      drawCell(page, regular, expense.receiptLink ?? expense.receipt?.fileName ?? '', 547, centerY, 140, 5.1);
      drawCell(page, regular, expense.amount.toFixed(2), 687, centerY, 105, 5.8, 'right');
    });
    const finalPage = pageIndex === expensePages.length - 1;
    drawCell(page, bold, finalPage ? reconciliation.totalSpent.toFixed(2) : 'Continued', 687, 236, 105, 6.5, 'right');
    drawCell(page, regular, finalPage ? record.totalAmount.toFixed(2) : '', 687, 222, 105, 6.2, 'right');
    drawCell(page, regular, finalPage ? reconciliation.balance.toFixed(2) : '', 687, 208, 105, 6.2, 'right');
    drawCell(page, regular, `Page ${pageIndex + 1} of ${expensePages.length}`, 690, 179, 100, 6.2, 'right');
  }
}

async function appendParticipant(output: PDFDocument, record: CashAdvanceRecord) {
  const proof = record.reconciliation?.participantProof;
  if (!record.reconciliation?.includesParticipantAllowance || !proof) {
    throw new Error('The Participant Allowance form is not applicable to this Cash Advance.');
  }
  const uploaded = documentBytes(proof.dataUrl);
  if (uploaded.mimeType === 'application/pdf') {
    const source = await PDFDocument.load(uploaded.bytes);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
    return;
  }
  const image = uploaded.mimeType === 'image/png'
    ? await output.embedPng(uploaded.bytes)
    : uploaded.mimeType === 'image/jpeg' || uploaded.mimeType === 'image/jpg'
      ? await output.embedJpg(uploaded.bytes)
      : undefined;
  if (!image) throw new Error('Upload the completed Participant Allowance form as PDF, PNG or JPG.');
  const landscape = image.width >= image.height;
  const page = output.addPage(landscape ? [842, 595] : [595, 842]);
  drawImageInBox(page, image, 24, 24, page.getWidth() - 48, page.getHeight() - 48);
}

export async function buildCashAdvancePdf(record: CashAdvanceRecord, options: BuildOptions = {}) {
  const form = options.form ?? 'pack';
  const root = options.templateRoot ?? path.join(process.cwd(), 'public', 'templates');
  const output = await PDFDocument.create();
  const regular = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);

  if (form === 'request' || form === 'pack') {
    await appendRequest(
      output,
      record,
      root,
      regular,
      bold,
      options.signatures ?? {},
      options.financeVerifierName,
    );
  }
  if (form === 'summary' || (form === 'pack' && record.reconciliation)) await appendSummary(output, record, root, regular, bold);
  if (form === 'participant' || (form === 'pack' && record.reconciliation?.includesParticipantAllowance)) await appendParticipant(output, record);

  output.setTitle(`${record.requestNumber} Cash Advance ${form === 'pack' ? 'Forms' : 'Form'}`);
  output.setSubject('Cash Advance');
  output.setCreator('Estuary');
  return output.save();
}

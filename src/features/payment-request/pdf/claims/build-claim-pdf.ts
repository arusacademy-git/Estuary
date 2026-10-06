import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import { claimLineAmount, mileageRate } from '@/domain/payment-requests/claims/policy';
import { claimTypeDetails, type ClaimRecord } from '@/domain/payment-requests/claims/types';

type Options = { templateRoot?: string };

type Cell = { x: number; width: number };

type Layout = {
  rowsPerPage: number;
  firstRowY: number;
  rowHeight: number;
  profileY: number;
  claimNumber: Cell & { y: number };
  total: Cell & { y: number };
  number: Cell;
  date: Cell;
  supplier?: Cell;
  details: Cell;
  receipt?: Cell;
  account?: Cell;
  division?: Cell;
  from?: Cell;
  to?: Cell;
  kilometers?: Cell;
  rate?: Cell;
  amount: Cell;
  profile: {
    name: Cell;
    position: Cell;
    date: Cell;
    contact: Cell;
  };
};

const EXPENSE_LAYOUT: Layout = {
  rowsPerPage: 12,
  firstRowY: 369,
  rowHeight: 12.96,
  profileY: 424,
  claimNumber: { x: 681, y: 458, width: 111 },
  total: { x: 679, y: 212, width: 113 },
  number: { x: 78, width: 24 },
  date: { x: 102, width: 54 },
  supplier: { x: 156, width: 102 },
  details: { x: 258, width: 151 },
  receipt: { x: 409, width: 127 },
  account: { x: 536, width: 72 },
  division: { x: 608, width: 71 },
  amount: { x: 679, width: 113 },
  profile: {
    name: { x: 104, width: 151 },
    position: { x: 296, width: 110 },
    date: { x: 433, width: 172 },
    contact: { x: 644, width: 144 },
  },
};

const COMPACT_LAYOUT: Layout = {
  rowsPerPage: 8,
  firstRowY: 342,
  rowHeight: 14.46,
  profileY: 403,
  claimNumber: { x: 660, y: 443, width: 132 },
  total: { x: 659, y: 226, width: 133 },
  number: { x: 72, width: 25 },
  date: { x: 97, width: 74 },
  supplier: { x: 171, width: 124 },
  details: { x: 295, width: 204 },
  receipt: { x: 499, width: 160 },
  amount: { x: 659, width: 133 },
  profile: {
    name: { x: 101, width: 191 },
    position: { x: 337, width: 158 },
    date: { x: 524, width: 132 },
    contact: { x: 699, width: 89 },
  },
};

const LOWER_LAYOUT: Layout = {
  ...COMPACT_LAYOUT,
  firstRowY: 327,
  rowHeight: 15.32,
  profileY: 392,
  claimNumber: { x: 659, y: 436, width: 133 },
  total: { x: 659, y: 203, width: 133 },
  number: { x: 73, width: 22 },
  date: { x: 95, width: 87 },
  supplier: { x: 182, width: 129 },
  details: { x: 311, width: 205 },
  receipt: { x: 516, width: 143 },
  amount: { x: 659, width: 133 },
  profile: {
    name: { x: 104, width: 202 },
    position: { x: 352, width: 160 },
    date: { x: 545, width: 110 },
    contact: { x: 699, width: 89 },
  },
};

const MILEAGE_LAYOUT: Layout = {
  rowsPerPage: 8,
  firstRowY: 341,
  rowHeight: 12.18,
  profileY: 427,
  claimNumber: { x: 712, y: 461, width: 80 },
  total: { x: 712, y: 243, width: 80 },
  number: { x: 66, width: 24 },
  date: { x: 90, width: 50 },
  details: { x: 140, width: 149 },
  division: { x: 289, width: 73 },
  from: { x: 362, width: 102 },
  to: { x: 464, width: 103 },
  kilometers: { x: 567, width: 72 },
  rate: { x: 639, width: 73 },
  amount: { x: 712, width: 80 },
  profile: {
    name: { x: 91, width: 194 },
    position: { x: 323, width: 137 },
    date: { x: 486, width: 149 },
    contact: { x: 672, width: 116 },
  },
};

function layoutFor(record: ClaimRecord) {
  if (record.claimType === 'EXPENSE') return EXPENSE_LAYOUT;
  if (record.claimType === 'MILEAGE') return MILEAGE_LAYOUT;
  if (record.claimType === 'MEDICAL' || record.claimType === 'PD') return LOWER_LAYOUT;
  return COMPACT_LAYOUT;
}

function clean(value: string | undefined) {
  return (value ?? '')
    .replaceAll('→', ' to ')
    .replaceAll('–', '-')
    .replaceAll('—', '-')
    .replaceAll('’', "'")
    .replaceAll('…', '...')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function date(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? clean(value)
    : new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(parsed);
}

function fit(font: PDFFont, raw: string, size: number, width: number) {
  const value = clean(raw);
  if (font.widthOfTextAtSize(value, size) <= width) return value;
  let shortened = value;
  while (
    shortened.length > 1 &&
    font.widthOfTextAtSize(`${shortened}...`, size) > width
  ) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
}

function drawCell(
  page: PDFPage,
  font: PDFFont,
  value: string,
  cell: Cell,
  y: number,
  size = 6.5,
  align: 'left' | 'center' | 'right' = 'left',
) {
  const text = fit(font, value, size, cell.width - 5);
  const textWidth = font.widthOfTextAtSize(text, size);
  const x = align === 'center'
    ? cell.x + (cell.width - textWidth) / 2
    : align === 'right'
      ? cell.x + cell.width - textWidth - 3
      : cell.x + 3;
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0.03, 0.08, 0.15),
  });
}

function clearCell(page: PDFPage, cell: Cell, y: number, height: number) {
  page.drawRectangle({
    x: cell.x + 1,
    y: y + 1,
    width: cell.width - 2,
    height: height - 2,
    color: rgb(1, 1, 1),
  });
}

function drawProfile(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  record: ClaimRecord,
  layout: Layout,
) {
  drawCell(page, font, record.requesterName, layout.profile.name, layout.profileY, 7.5);
  drawCell(page, font, record.requesterPosition, layout.profile.position, layout.profileY, 7.5);
  drawCell(page, font, date(record.claimDate), layout.profile.date, layout.profileY, 7.5);
  drawCell(page, font, record.requesterContact, layout.profile.contact, layout.profileY, 7.2);
  drawCell(page, bold, record.claimNumber, layout.claimNumber, layout.claimNumber.y, 7.5, 'center');
}

function drawLine(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  record: ClaimRecord,
  line: ClaimRecord['lines'][number],
  layout: Layout,
  y: number,
) {
  drawCell(page, font, date(line.expenseDate), layout.date, y, 6.2, 'center');
  drawCell(page, font, line.details, layout.details, y, 6.1);

  if (record.claimType === 'MILEAGE') {
    drawCell(page, font, line.division, layout.division!, y, 6);
    drawCell(page, font, line.from, layout.from!, y, 6.1);
    drawCell(page, font, line.to, layout.to!, y, 6.1);
    drawCell(page, font, Number(line.kilometers).toFixed(1), layout.kilometers!, y, 6.2, 'right');
    drawCell(page, font, mileageRate(Number(line.kilometers)).toFixed(2), layout.rate!, y, 6.2, 'right');
  } else {
    drawCell(page, font, line.supplier, layout.supplier!, y, 6.1);
    drawCell(page, font, line.receiptLink || (line.receiptFileName ? `Attached: ${line.receiptFileName}` : '-'), layout.receipt!, y, line.receiptLink ? 4.8 : 5.7);
    if (layout.account) drawCell(page, font, line.accountType || '-', layout.account, y, 5.5);
    if (layout.division) drawCell(page, font, line.division || '-', layout.division, y, 5.5);
  }

  drawCell(
    page,
    bold,
    claimLineAmount(record.claimType, line).toFixed(2),
    layout.amount,
    y,
    6.4,
    'right',
  );
}

export async function buildClaimPdf(
  record: ClaimRecord,
  options: Options = {},
) {
  const templateRoot = options.templateRoot ?? path.join(process.cwd(), 'public', 'templates');
  const templatePath = path.join(templateRoot, claimTypeDetails(record.claimType).template);
  const template = await PDFDocument.load(await readFile(templatePath));
  if (template.getPageCount() < 1) throw new Error('The selected Claim template has no pages.');

  const layout = layoutFor(record);
  const output = await PDFDocument.create();
  const regular = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const pageCount = Math.max(1, Math.ceil(record.lines.length / layout.rowsPerPage));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const [page] = await output.copyPages(template, [0]);
    output.addPage(page);
    drawProfile(page, regular, bold, record, layout);

    const lines = record.lines.slice(
      pageIndex * layout.rowsPerPage,
      (pageIndex + 1) * layout.rowsPerPage,
    );

    if (pageIndex > 0) {
      Array.from({ length: layout.rowsPerPage }, (_, rowIndex) => {
        const y = layout.firstRowY - rowIndex * layout.rowHeight;
        clearCell(page, layout.number, y - 2, layout.rowHeight - 1);
        drawCell(
          page,
          regular,
          String(pageIndex * layout.rowsPerPage + rowIndex + 1),
          layout.number,
          y,
          6.3,
          'right',
        );
      });
    }

    lines.forEach((line, rowIndex) => {
      const y = layout.firstRowY - rowIndex * layout.rowHeight;
      drawLine(page, regular, bold, record, line, layout, y);
    });

    clearCell(page, layout.total, layout.total.y - 2, 12);
    drawCell(
      page,
      bold,
      pageIndex === pageCount - 1 ? record.totalAmount.toFixed(2) : 'Continued',
      layout.total,
      layout.total.y,
      7,
      'right',
    );
  }

  output.setTitle(`${record.claimNumber} ${claimTypeDetails(record.claimType).label} Form`);
  output.setSubject(claimTypeDetails(record.claimType).label);
  output.setCreator('Estuary');
  return output.save();
}

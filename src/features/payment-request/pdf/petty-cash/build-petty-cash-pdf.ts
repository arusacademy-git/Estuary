import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from 'pdf-lib';

import type { PettyCashRecord } from '@/domain/payment-requests/petty-cash/types';

const ROWS_PER_PAGE = 12;
const FIRST_ROW_Y = 348;
const ROW_HEIGHT = 14.8;

type Options = { templatePath?: string };

function date(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(parsed);
}

function fit(font: PDFFont, value: string, size: number, width: number) {
  const text = value.trim() || '-';
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let shortened = text;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > width) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
}

function drawCell(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  y: number,
  width: number,
  size = 6.5,
  align: 'left' | 'center' | 'right' = 'left',
) {
  const text = fit(font, value, size, width - 4);
  const textWidth = font.widthOfTextAtSize(text, size);
  const textX = align === 'center'
    ? x + (width - textWidth) / 2
    : align === 'right'
      ? x + width - textWidth - 2
      : x + 2;
  page.drawText(text, { x: textX, y, size, font, color: rgb(0.03, 0.08, 0.15) });
}

export async function buildPettyCashPdf(
  record: PettyCashRecord,
  options: Options = {},
) {
  const templatePath = options.templatePath ?? path.join(
    process.cwd(),
    'public',
    'templates',
    'Petty Cash Template.pdf',
  );
  const template = await PDFDocument.load(await readFile(templatePath));
  if (template.getPageCount() < 1) throw new Error('Petty Cash template has no pages.');

  const output = await PDFDocument.create();
  const regular = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(record.lines.length / ROWS_PER_PAGE)) },
    (_, pageIndex) => record.lines.slice(
      pageIndex * ROWS_PER_PAGE,
      (pageIndex + 1) * ROWS_PER_PAGE,
    ),
  );

  for (const [pageIndex, lines] of chunks.entries()) {
    const [page] = await output.copyPages(template, [0]);
    output.addPage(page);

    drawCell(page, regular, record.requesterName, 119, 408.5, 86, 7);
    drawCell(page, regular, record.requesterPosition, 252, 408.5, 85, 7);
    drawCell(page, regular, date(record.requestDate), 373, 408.5, 168, 7);
    drawCell(page, regular, record.requesterContact, 584, 408.5, 184, 7);
    drawCell(page, bold, record.requestNumber, 633, 449, 136, 7.5, 'center');

    if (pageIndex > 0) {
      Array.from({ length: ROWS_PER_PAGE }, (_, rowIndex) => {
        const y = FIRST_ROW_Y - rowIndex * ROW_HEIGHT;
        page.drawRectangle({ x: 89, y: y - 2.5, width: 16, height: 11, color: rgb(1, 1, 1) });
      });
    }

    lines.forEach((line, rowIndex) => {
      const y = FIRST_ROW_Y - rowIndex * ROW_HEIGHT;
      const globalNumber = pageIndex * ROWS_PER_PAGE + rowIndex + 1;
      if (pageIndex > 0) drawCell(page, regular, String(globalNumber), 88, y, 18, 6.5, 'right');
      drawCell(page, regular, date(line.expenseDate), 106, y, 50, 6.2, 'center');
      drawCell(page, regular, line.supplier, 156, y, 49.5, 6.2);
      drawCell(page, regular, line.details, 205.5, y, 133.5, 6.1);
      drawCell(page, regular, line.proofLink, 339, y, 114.5, 5.8);
      drawCell(page, regular, line.accountType, 453.5, y, 90, 5.8);
      drawCell(page, regular, line.division, 543.5, y, 88.5, 6);
      drawCell(page, bold, line.amount.toFixed(2), 632, y, 139, 6.5, 'right');
    });

    const finalPage = pageIndex === chunks.length - 1;
    drawCell(
      page,
      bold,
      finalPage ? record.totalAmount.toFixed(2) : 'Continued',
      632,
      174,
      139,
      7.5,
      'right',
    );
  }

  output.setTitle(`${record.requestNumber} Petty Cash Form`);
  output.setSubject('Petty Cash');
  output.setCreator('Estuary');
  return output.save();
}

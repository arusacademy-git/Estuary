import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

import type { TravelAllowanceRecord } from '@/domain/payment-requests/travel-allowance/types';

const ROWS_PER_PAGE = 12;
const FIRST_ROW_Y = 367;
const ROW_HEIGHT = 12.65;

type Options = { templatePath?: string };

function mealSubtotal(line: TravelAllowanceRecord['lines'][number]) {
  return line.meals.reduce(
    (total, meal) => total + (meal === 'BREAKFAST' ? 10 : 20),
    0,
  );
}

function lineTotal(line: TravelAllowanceRecord['lines'][number]) {
  return mealSubtotal(line) + line.specialAllowance;
}

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
  const text = value.trim();
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
  size = 6,
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

export async function buildTravelAllowancePdf(
  request: TravelAllowanceRecord,
  options: Options = {},
) {
  const templatePath = options.templatePath ?? path.join(
    process.cwd(),
    'public',
    'templates',
    'travel-allowance-template.pdf',
  );
  const template = await PDFDocument.load(await readFile(templatePath));
  if (template.getPageCount() < 1) throw new Error('Travel Allowance template has no pages.');

  const output = await PDFDocument.create();
  const regular = await output.embedFont(StandardFonts.Helvetica);
  const bold = await output.embedFont(StandardFonts.HelveticaBold);
  const chunks = Array.from(
    { length: Math.max(1, Math.ceil(request.lines.length / ROWS_PER_PAGE)) },
    (_, pageIndex) => request.lines.slice(
      pageIndex * ROWS_PER_PAGE,
      (pageIndex + 1) * ROWS_PER_PAGE,
    ),
  );

  for (const [pageIndex, lines] of chunks.entries()) {
    const [page] = await output.copyPages(template, [0]);
    output.addPage(page);

    drawCell(page, regular, request.requesterName, 88, 426, 148, 8);
    drawCell(page, regular, request.requesterPosition, 282, 426, 245, 8);
    drawCell(page, regular, date(request.requestDate), 552, 426, 87, 8);
    drawCell(page, regular, request.contact, 677, 426, 113, 8);
    drawCell(page, bold, request.requestNumber, 727, 463, 64, 8, 'center');

    // Page one already contains the template's printed 1-12 numbering. Only
    // continuation pages need those values cleared and replaced with 13+.
    if (pageIndex > 0) {
      Array.from({ length: ROWS_PER_PAGE }, (_, rowIndex) => {
        const y = FIRST_ROW_Y - rowIndex * ROW_HEIGHT;
        page.drawRectangle({ x: 63, y: y - 2.5, width: 19, height: 10.5, color: rgb(1, 1, 1) });
      });
    }

    lines.forEach((line, rowIndex) => {
      const y = FIRST_ROW_Y - rowIndex * ROW_HEIGHT;
      const globalNumber = pageIndex * ROWS_PER_PAGE + rowIndex + 1;
      if (pageIndex > 0) {
        drawCell(page, regular, String(globalNumber), 62, y, 21, 7, 'right');
      }
      drawCell(page, regular, date(line.travelDate), 85, y, 51, 6.5, 'center');
      drawCell(page, regular, line.employeeName, 139, y, 97, 6.5);
      drawCell(page, regular, line.projectName, 239, y, 75, 6.2);
      drawCell(page, regular, line.reason, 317, y, 94, 6.2);
      drawCell(page, regular, line.meals.map((meal) => meal === 'BREAKFAST' ? 'Breakfast' : meal === 'LUNCH' ? 'Lunch' : 'Dinner').join(', ') || '-', 414, y, 114, 6.2, 'center');
      drawCell(page, regular, mealSubtotal(line).toFixed(2), 531, y, 57, 6.5, 'right');
      drawCell(page, regular, line.specialAllowance.toFixed(2), 591, y, 48, 6.5, 'right');
      drawCell(page, regular, line.specialAllowanceReason ?? '-', 642, y, 83, 6);
      drawCell(page, bold, lineTotal(line).toFixed(2), 728, y, 62, 6.5, 'right');
    });

    const finalPage = pageIndex === chunks.length - 1;
    drawCell(page, bold, finalPage ? request.totalAmount.toFixed(2) : 'Continued', 728, 211, 62, 7.5, 'right');
    drawCell(page, regular, `Page ${pageIndex + 1} of ${chunks.length}`, 700, 190, 90, 7, 'right');
  }

  output.setTitle(`${request.requestNumber} Travel Allowance Form`);
  output.setSubject('Travel Allowance');
  output.setCreator('Estuary');
  return output.save();
}

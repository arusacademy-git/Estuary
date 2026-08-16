import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { prototypeConfig } from '@/data/prototype/prototype-config';
import type {
  PrototypeDraft,
  PrototypeDraftLineItem,
} from '@/domain/prototype/types';

import {
  calculateLineTotal,
  composePaymentDetails,
  formatMoney,
  parseMoney,
  summarizeDraftTotals,
} from './voucher-calculations';

type PageState = {
  cursorY: number;
  page: Awaited<ReturnType<PDFDocument['addPage']>>;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const ROW_HEIGHT = 24;

export type PaymentVoucherPdfInput = {
  draft: PrototypeDraft;
  approverName?: string;
  directorSignatureText?: string;
  approvalDate?: string;
  paymentDate?: string;
  paymentReference?: string;
  receiptLink?: string;
  recipientSignatureText?: string;
  recipientSignedAt?: string;
  verificationLabel?: string;
};

function drawWrappedText(
  pageState: PageState,
  text: string,
  x: number,
  maxWidth: number,
  fontSize: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  color = rgb(0.12, 0.16, 0.22)
): number {
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      const nextWidth = font.widthOfTextAtSize(nextLine, fontSize);

      if (nextWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = nextLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (lines.length === 0) {
      pageState.cursorY -= fontSize + 4;
      continue;
    }

    for (const line of lines) {
      pageState.page.drawText(line, {
        x,
        y: pageState.cursorY,
        size: fontSize,
        font,
        color,
      });
      pageState.cursorY -= fontSize + 4;
    }
  }

  return pageState.cursorY;
}

function ensurePage(
  pdfDoc: PDFDocument,
  pageState: PageState,
  minimumY: number
): PageState {
  if (pageState.cursorY >= minimumY) {
    return pageState;
  }

  const nextPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return {
    page: nextPage,
    cursorY: PAGE_HEIGHT - MARGIN,
  };
}

function drawLabelValue(
  pageState: PageState,
  label: string,
  value: string,
  regularFont: Awaited<ReturnType<PDFDocument['embedFont']>>,
  boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>
): void {
  pageState.page.drawText(label, {
    x: MARGIN,
    y: pageState.cursorY,
    size: 10,
    font: boldFont,
    color: rgb(0.39, 0.45, 0.55),
  });

  pageState.page.drawText(value, {
    x: 170,
    y: pageState.cursorY,
    size: 10,
    font: regularFont,
    color: rgb(0.12, 0.16, 0.22),
  });

  pageState.cursorY -= 18;
}

function drawTableHeader(
  pageState: PageState,
  boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>
): void {
  const headerY = pageState.cursorY;
  pageState.page.drawRectangle({
    x: MARGIN,
    y: headerY - 8,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 24,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.88, 0.91, 0.95),
    borderWidth: 1,
  });

  const columns = [
    { label: 'Account', x: MARGIN + 8 },
    { label: 'Description', x: MARGIN + 90 },
    { label: 'Qty', x: MARGIN + 300 },
    { label: 'Unit', x: MARGIN + 340 },
    { label: 'Tax', x: MARGIN + 410 },
    { label: 'Total', x: MARGIN + 470 },
  ];

  for (const column of columns) {
    pageState.page.drawText(column.label, {
      x: column.x,
      y: headerY,
      size: 9,
      font: boldFont,
      color: rgb(0.39, 0.45, 0.55),
    });
  }

  pageState.cursorY -= 28;
}

function drawLineItemRow(
  pageState: PageState,
  item: PrototypeDraftLineItem,
  accountLabels: Record<string, string>,
  amountsTaxInclusive: boolean,
  regularFont: Awaited<ReturnType<PDFDocument['embedFont']>>
): void {
  const accountLabel = accountLabels[item.accountCode] ?? item.accountCode;
  const description = item.description || accountLabel;
  const values = [
    { text: item.accountCode, x: MARGIN + 8 },
    { text: description, x: MARGIN + 90 },
    { text: item.quantity, x: MARGIN + 300 },
    { text: formatMoney(parseMoney(item.unitPrice)), x: MARGIN + 340 },
    { text: item.taxCode, x: MARGIN + 410 },
    {
      text: formatMoney(calculateLineTotal(item, amountsTaxInclusive)),
      x: MARGIN + 470,
    },
  ];

  for (const value of values) {
    pageState.page.drawText(value.text, {
      x: value.x,
      y: pageState.cursorY,
      size: 9,
      font: regularFont,
      color: rgb(0.12, 0.16, 0.22),
    });
  }

  pageState.page.drawLine({
    start: { x: MARGIN, y: pageState.cursorY - 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: pageState.cursorY - 6 },
    thickness: 1,
    color: rgb(0.93, 0.94, 0.96),
  });

  pageState.cursorY -= ROW_HEIGHT;
}

export async function buildPaymentVoucherPdfDocument(
  input: PaymentVoucherPdfInput
): Promise<Uint8Array> {
  const { draft } = input;
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const accountLabels = Object.fromEntries(
    prototypeConfig.referenceCollections
      .find((collection) => collection.id === 'gl-codes')
      ?.items.map((item) => [item.code, item.label]) ?? []
  );
  const approverName =
    input.approverName ??
    prototypeConfig.users.find((user) => user.id === draft.approverId)?.name ??
    draft.approverId;
  const totals = summarizeDraftTotals(draft);
  const details = composePaymentDetails(draft, accountLabels);
  let pageState: PageState = {
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    cursorY: PAGE_HEIGHT - MARGIN,
  };

  pageState.page.drawText('PAYMENT VOUCHER', {
    x: MARGIN,
    y: pageState.cursorY,
    size: 22,
    font: boldFont,
    color: rgb(0.14, 0.18, 0.25),
  });

  pageState.page.drawText(draft.organizationName, {
    x: MARGIN,
    y: pageState.cursorY - 28,
    size: 11,
    font: regularFont,
    color: rgb(0.39, 0.45, 0.55),
  });

  pageState.page.drawRectangle({
    x: PAGE_WIDTH - 170,
    y: pageState.cursorY - 16,
    width: 130,
    height: 34,
    color: rgb(0.93, 0.11, 0.28),
  });

  pageState.page.drawText(draft.voucherNumber, {
    x: PAGE_WIDTH - 160,
    y: pageState.cursorY - 4,
    size: 12,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  pageState.cursorY -= 58;

  drawLabelValue(pageState, 'Payee', draft.payeeName, regularFont, boldFont);
  drawLabelValue(
    pageState,
    'Identity / IC',
    draft.payeeIdentity,
    regularFont,
    boldFont
  );
  drawLabelValue(
    pageState,
    'Approver',
    approverName,
    regularFont,
    boldFont
  );
  drawLabelValue(
    pageState,
    'Project / GL',
    `${draft.projectCode} / ${draft.glCode}`,
    regularFont,
    boldFont
  );
  drawLabelValue(
    pageState,
    'Payment mode',
    draft.paymentModeCode,
    regularFont,
    boldFont
  );
  drawLabelValue(
    pageState,
    'Bank',
    `${draft.bankName} - ${draft.bankAccountNumber}`,
    regularFont,
    boldFont
  );
  drawLabelValue(
    pageState,
    'Urgent bypass',
    draft.urgentBypass ? 'Yes' : 'No',
    regularFont,
    boldFont
  );
  drawLabelValue(
    pageState,
    'Approval date',
    input.approvalDate ?? 'Pending director approval',
    regularFont,
    boldFont
  );
  drawLabelValue(
    pageState,
    'Payment date',
    input.paymentDate ?? 'Pending finance capture',
    regularFont,
    boldFont
  );
  drawLabelValue(
    pageState,
    'Payment reference',
    input.paymentReference ?? draft.paymentReference ?? 'Pending finance capture',
    regularFont,
    boldFont
  );

  pageState.cursorY -= 8;
  pageState = ensurePage(pdfDoc, pageState, 220);
  drawTableHeader(pageState, boldFont);

  for (const item of draft.lineItems) {
    pageState = ensurePage(pdfDoc, pageState, 120);
    if (pageState.cursorY > PAGE_HEIGHT - MARGIN - 5) {
      drawTableHeader(pageState, boldFont);
    }
    drawLineItemRow(
      pageState,
      item,
      accountLabels,
      draft.amountsTaxInclusive,
      regularFont
    );
  }

  pageState.cursorY -= 10;
  pageState.page.drawText(`Subtotal: ${formatMoney(totals.subtotal)}`, {
    x: PAGE_WIDTH - 190,
    y: pageState.cursorY,
    size: 10,
    font: regularFont,
    color: rgb(0.12, 0.16, 0.22),
  });
  pageState.cursorY -= 16;

  pageState.page.drawText(`Tax: ${formatMoney(totals.tax)}`, {
    x: PAGE_WIDTH - 190,
    y: pageState.cursorY,
    size: 10,
    font: regularFont,
    color: rgb(0.12, 0.16, 0.22),
  });
  pageState.cursorY -= 18;

  pageState.page.drawText(`Grand total: ${formatMoney(totals.grand)}`, {
    x: PAGE_WIDTH - 190,
    y: pageState.cursorY,
    size: 12,
    font: boldFont,
    color: rgb(0.12, 0.16, 0.22),
  });
  pageState.cursorY -= 30;

  pageState = ensurePage(pdfDoc, pageState, 150);
  pageState.page.drawText('Amount in words', {
    x: MARGIN,
    y: pageState.cursorY,
    size: 10,
    font: boldFont,
    color: rgb(0.39, 0.45, 0.55),
  });
  pageState.cursorY -= 18;
  drawWrappedText(
    pageState,
    draft.amountInWords,
    MARGIN,
    PAGE_WIDTH - MARGIN * 2,
    10,
    regularFont
  );

  pageState.cursorY -= 8;
  pageState.page.drawText('Payment details', {
    x: MARGIN,
    y: pageState.cursorY,
    size: 10,
    font: boldFont,
    color: rgb(0.39, 0.45, 0.55),
  });
  pageState.cursorY -= 18;
  drawWrappedText(
    pageState,
    details,
    MARGIN,
    PAGE_WIDTH - MARGIN * 2,
    10,
    regularFont
  );

  pageState.cursorY -= 10;
  pageState.page.drawText('Receipt link', {
    x: MARGIN,
    y: pageState.cursorY,
    size: 10,
    font: boldFont,
    color: rgb(0.39, 0.45, 0.55),
  });
  pageState.cursorY -= 18;
  drawWrappedText(
    pageState,
    input.receiptLink ?? 'Receipt not yet linked.',
    MARGIN,
    PAGE_WIDTH - MARGIN * 2,
    10,
    regularFont
  );

  pageState.cursorY -= 20;
  pageState = ensurePage(pdfDoc, pageState, 120);
  const signatureTop = pageState.cursorY;
  const signatureColumns = [
    { label: 'Prepared by', x: MARGIN },
    { label: 'Approved by', x: MARGIN + 180 },
    { label: 'Received by', x: MARGIN + 360 },
  ];

  for (const column of signatureColumns) {
    pageState.page.drawLine({
      start: { x: column.x, y: signatureTop },
      end: { x: column.x + 140, y: signatureTop },
      thickness: 1,
      color: rgb(0.79, 0.84, 0.89),
    });
    pageState.page.drawText(column.label, {
      x: column.x,
      y: signatureTop - 16,
      size: 9,
      font: regularFont,
      color: rgb(0.39, 0.45, 0.55),
    });
  }

  if (input.directorSignatureText) {
    pageState.page.drawText(input.directorSignatureText, {
      x: MARGIN + 180,
      y: signatureTop + 8,
      size: 12,
      font: regularFont,
      color: rgb(0.12, 0.16, 0.22),
    });
  }

  if (input.recipientSignatureText) {
    pageState.page.drawText(input.recipientSignatureText, {
      x: MARGIN + 360,
      y: signatureTop + 8,
      size: 12,
      font: regularFont,
      color: rgb(0.12, 0.16, 0.22),
    });
  }

  if (input.verificationLabel) {
    pageState.page.drawText(input.verificationLabel, {
      x: MARGIN,
      y: signatureTop - 34,
      size: 9,
      font: regularFont,
      color: rgb(0.39, 0.45, 0.55),
    });
  }

  return pdfDoc.save();
}

export async function buildPaymentVoucherPdf(
  draft: PrototypeDraft
): Promise<Uint8Array> {
  return buildPaymentVoucherPdfDocument({ draft });
}

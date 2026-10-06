import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import {
  betaAccounts,
} from '@/lib/auth/beta-accounts';

import type {
  PaymentVoucherRecord,
} from '@/domain/payment-vouchers/types';

const TEMPLATE_PATH =
  '/templates/payment-voucher-template.pdf';

export type BuildPaymentVoucherPdfOptions = {
  directorSignatureDataUrl?: string | null;
  recipientSignatureDataUrl?: string | null;
};

type TextPosition = {
  x: number;
  top: number;
  maxWidth: number;
  size: number;
  minSize?: number;
  lineHeight?: number;
  maxLines?: number;
};

const TEXT_COLOR = rgb(
  0.05,
  0.08,
  0.12,
);

/*
 * Positions are percentages of the PDF page.
 *
 * x: distance from the left.
 * top: distance from the top.
 */
const FIELD_POSITIONS = {
  pvDate: {
    x: 0.875,
    top: 0.127,
    maxWidth: 0.065,
    size: 9,
    minSize: 8,
    maxLines: 1,
  },

  voucherNumber: {
    x: 0.865,
    top: 0.195,
    maxWidth: 0.08,
    size: 8.5,
    minSize: 7,
    maxLines: 1,
  },

  amount: {
    x: 0.27,
    top: 0.275,
    maxWidth: 0.66,
    size: 10,
    minSize: 8.5,
    maxLines: 1,
  },

  amountInWords: {
    x: 0.27,
    top: 0.302,
    maxWidth: 0.66,
    size: 9.5,
    minSize: 7.5,
    maxLines: 1,
  },

  paymentMethod: {
    x: 0.27,
    top: 0.359,
    maxWidth: 0.14,
    size: 9.5,
    minSize: 8,
    maxLines: 1,
  },

  bankName: {
    x: 0.27,
    top: 0.386,
    maxWidth: 0.14,
    size: 9.5,
    minSize: 8,
    maxLines: 1,
  },

  bankAccountNumber: {
    x: 0.58,
    top: 0.386,
    maxWidth: 0.34,
    size: 9.5,
    minSize: 8,
    maxLines: 1,
  },

  recipientName: {
    x: 0.27,
    top: 0.41,
    maxWidth: 0.64,
    size: 9.5,
    minSize: 8,
    maxLines: 1,
  },

  recipientIc: {
    x: 0.27,
    top: 0.432,
    maxWidth: 0.64,
    size: 9,
    minSize: 8,
    maxLines: 1,
  },
  purpose: {
    x: 0.095,
    top: 0.512,
    maxWidth: 0.62,
    size: 11,
    minSize: 9,
    lineHeight: 13,
    maxLines: 3,
  },

  payeeName: {
    x: 0.755,
    top: 0.512,
    maxWidth: 0.17,
    size: 11,
    minSize: 9,
    lineHeight: 13,
    maxLines: 2,
  },

  approvedBy: {
    x: 0.095,
    top: 0.603,
    maxWidth: 0.15,
    size: 10.5,
    minSize: 9,
    maxLines: 1,
  },

  approvalDate: {
    x: 0.095,
    top: 0.65,
    maxWidth: 0.15,
    size: 10,
    minSize: 8.5,
    maxLines: 1,
  },

  paidBy: {
    x: 0.57,
    top: 0.58,
    maxWidth: 0.15,
    size: 10,
    minSize: 8.5,
    maxLines: 1,
  },

  paymentDate: {
    x: 0.57,
    top: 0.606,
    maxWidth: 0.15,
    size: 10,
    minSize: 8.5,
    maxLines: 1,
  },

  paymentReference: {
    x: 0.57,
    top: 0.636,
    maxWidth: 0.15,
    size: 9.5,
    minSize: 8,
    maxLines: 1,
  },
} satisfies Record<
  string,
  TextPosition
>;

const NUMBER_WORDS = [
  'KOSONG',
  'SATU',
  'DUA',
  'TIGA',
  'EMPAT',
  'LIMA',
  'ENAM',
  'TUJUH',
  'LAPAN',
  'SEMBILAN',
];

function getAccountName(
  accountId?: string,
) {
  if (!accountId) {
    return '';
  }

  const account = betaAccounts.find(
    (candidate) =>
      candidate.id === accountId,
  );

  return account?.name ?? accountId;
}

function sanitizePdfText(
  value?: string | null,
) {
  if (!value) {
    return '';
  }

  /*
   * Standard Helvetica uses WinAnsi.
   * Unsupported characters are removed so
   * they do not break PDF generation.
   */
  return value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

function formatDateForPdf(
  value?: string,
) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return sanitizePdfText(value);
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  ).format(date);
}

function formatAmountForPdf(
  amount: number,
) {
  return new Intl.NumberFormat(
    'en-MY',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

function integerToMalayWords(
  value: number,
): string {
  const number = Math.floor(
    Math.abs(value),
  );

  if (number < 10) {
    return NUMBER_WORDS[number];
  }

  if (number === 10) {
    return 'SEPULUH';
  }

  if (number === 11) {
    return 'SEBELAS';
  }

  if (number < 20) {
    return `${NUMBER_WORDS[
      number - 10
    ]} BELAS`;
  }

  if (number < 100) {
    const tens = Math.floor(
      number / 10,
    );

    const remainder =
      number % 10;

    return remainder === 0
      ? `${NUMBER_WORDS[tens]} PULUH`
      : `${NUMBER_WORDS[tens]} PULUH ${integerToMalayWords(
        remainder,
      )}`;
  }

  if (number < 1000) {
    const hundreds = Math.floor(
      number / 100,
    );

    const remainder =
      number % 100;

    const prefix =
      hundreds === 1
        ? 'SERATUS'
        : `${NUMBER_WORDS[hundreds]} RATUS`;

    return remainder === 0
      ? prefix
      : `${prefix} ${integerToMalayWords(
        remainder,
      )}`;
  }

  if (number < 1_000_000) {
    const thousands = Math.floor(
      number / 1000,
    );

    const remainder =
      number % 1000;

    const prefix =
      thousands === 1
        ? 'SERIBU'
        : `${integerToMalayWords(
          thousands,
        )} RIBU`;

    return remainder === 0
      ? prefix
      : `${prefix} ${integerToMalayWords(
        remainder,
      )}`;
  }

  if (number < 1_000_000_000) {
    const millions = Math.floor(
      number / 1_000_000,
    );

    const remainder =
      number % 1_000_000;

    const prefix =
      `${integerToMalayWords(
        millions,
      )} JUTA`;

    return remainder === 0
      ? prefix
      : `${prefix} ${integerToMalayWords(
        remainder,
      )}`;
  }

  const billions = Math.floor(
    number / 1_000_000_000,
  );

  const remainder =
    number % 1_000_000_000;

  const prefix =
    `${integerToMalayWords(
      billions,
    )} BILION`;

  return remainder === 0
    ? prefix
    : `${prefix} ${integerToMalayWords(
      remainder,
    )}`;
}

function amountToMalayWords(
  amount: number,
) {
  const totalCents = Math.round(
    Math.max(0, amount) * 100,
  );

  const ringgit = Math.floor(
    totalCents / 100,
  );

  const sen =
    totalCents % 100;

  return [
    'RINGGIT MALAYSIA',
    integerToMalayWords(ringgit),
    'DAN SEN',
    integerToMalayWords(sen),
    'SAHAJA',
  ].join(' ');
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maximumWidth: number,
) {
  const cleanedText =
    sanitizePdfText(text);

  if (!cleanedText) {
    return [];
  }

  const words =
    cleanedText.split(/\s+/);

  const lines: string[] = [];

  let currentLine = '';

  for (const word of words) {
    const candidate =
      currentLine
        ? `${currentLine} ${word}`
        : word;

    const candidateWidth =
      font.widthOfTextAtSize(
        candidate,
        fontSize,
      );

    if (
      candidateWidth <= maximumWidth
    ) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function calculateFittedText(
  value: string,
  font: PDFFont,
  position: TextPosition,
  pageWidth: number,
) {
  const maximumWidth =
    pageWidth * position.maxWidth;

  const minimumSize =
    position.minSize ?? 7;

  const maximumLines =
    position.maxLines ?? 1;

  let fontSize =
    position.size;

  while (fontSize >= minimumSize) {
    const lines = wrapText(
      value,
      font,
      fontSize,
      maximumWidth,
    );

    const everyLineFits =
      lines.every(
        (line) =>
          font.widthOfTextAtSize(
            line,
            fontSize,
          ) <= maximumWidth,
      );

    if (
      lines.length <= maximumLines &&
      everyLineFits
    ) {
      return {
        fontSize,
        lines,
      };
    }

    fontSize -= 0.25;
  }

  const finalLines = wrapText(
    value,
    font,
    minimumSize,
    maximumWidth,
  );

  return {
    fontSize: minimumSize,
    lines: finalLines.slice(
      0,
      maximumLines,
    ),
  };
}

function drawField(
  page: PDFPage,
  font: PDFFont,
  value: string,
  position: TextPosition,
) {
  const cleanedValue =
    sanitizePdfText(value);

  if (!cleanedValue) {
    return;
  }

  const {
    width,
    height,
  } = page.getSize();

  const {
    fontSize,
    lines,
  } = calculateFittedText(
    cleanedValue,
    font,
    position,
    width,
  );

  const lineHeight =
    position.lineHeight ??
    fontSize + 2;

  const x =
    width * position.x;

  const startingY =
    height -
    height * position.top;

  lines.forEach(
    (line, index) => {
      page.drawText(line, {
        x,
        y:
          startingY -
          index * lineHeight,
        size: fontSize,
        font,
        color: TEXT_COLOR,
      });
    },
  );
}

function convertDataUrlToBytes(
  dataUrl: string,
) {
  const match = dataUrl.match(
    /^data:image\/(png|jpeg|jpg);base64,(.+)$/i,
  );

  if (!match) {
    throw new Error(
      'The Director signature must be a PNG or JPG image.',
    );
  }

  const imageType =
    match[1].toLowerCase();

  const binary =
    atob(match[2]);

  const bytes =
    new Uint8Array(binary.length);

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return {
    bytes,
    imageType,
  };
}

async function embedSignature(
  pdfDocument: PDFDocument,
  dataUrl: string,
): Promise<PDFImage> {
  const {
    bytes,
    imageType,
  } = convertDataUrlToBytes(
    dataUrl,
  );

  if (imageType === 'png') {
    return pdfDocument.embedPng(
      bytes,
    );
  }

  return pdfDocument.embedJpg(
    bytes,
  );
}

function drawDirectorSignature(
  page: PDFPage,
  signature: PDFImage,
) {
  const {
    width,
    height,
  } = page.getSize();

  const boxX =
    width * 0.27;

  const boxTop =
    height * 0.575;

  const boxWidth =
    width * 0.16;

  const boxHeight =
    height * 0.07;

  const scale = Math.min(
    boxWidth / signature.width,
    boxHeight / signature.height,
  );

  const signatureWidth =
    signature.width * scale;

  const signatureHeight =
    signature.height * scale;

  page.drawImage(signature, {
    x:
      boxX +
      (boxWidth - signatureWidth) / 2,

    y:
      height -
      boxTop -
      signatureHeight,

    width: signatureWidth,
    height: signatureHeight,
  });
}

function drawRecipientSignature(
  page: PDFPage,
  signature: PDFImage,
) {
  const {
    width,
    height,
  } = page.getSize();

  /*
   * Recipient signature box:
   * right-hand "Received by (signature)"
   * section of the PV template.
   */
  const boxX =
    width * 0.755;

  const boxTop =
    height * 0.575;

  const boxWidth =
    width * 0.17;

  const boxHeight =
    height * 0.07;

  const scale = Math.min(
    boxWidth / signature.width,
    boxHeight / signature.height,
  );

  const signatureWidth =
    signature.width * scale;

  const signatureHeight =
    signature.height * scale;

  page.drawImage(signature, {
    x:
      boxX +
      (boxWidth - signatureWidth) / 2,

    y:
      height -
      boxTop -
      signatureHeight,

    width: signatureWidth,
    height: signatureHeight,
  });
}

export async function buildPaymentVoucherPdf(
  voucher: PaymentVoucherRecord,
  options: BuildPaymentVoucherPdfOptions = {},
): Promise<Uint8Array> {
  const templateResponse =
    await fetch(TEMPLATE_PATH, {
      cache: 'no-store',
    });

  if (!templateResponse.ok) {
    throw new Error(
      `Unable to load the Payment Voucher template. Check that ${TEMPLATE_PATH} exists.`,
    );
  }

  const templateBytes =
    await templateResponse.arrayBuffer();

  const pdfDocument =
    await PDFDocument.load(
      templateBytes,
    );

  const pages =
    pdfDocument.getPages();

  if (pages.length === 0) {
    throw new Error(
      'The Payment Voucher template does not contain a page.',
    );
  }

  const firstPage =
    pages[0];

  const regularFont =
    await pdfDocument.embedFont(
      StandardFonts.Helvetica,
    );

  const directorName =
    getAccountName(
      voucher.directorId,
    );

  const financeName =
    getAccountName(
      voucher.paymentMadeById,
    );

  drawField(
    firstPage,
    regularFont,
    formatDateForPdf(
      voucher.pvDate,
    ),
    FIELD_POSITIONS.pvDate,
  );

  /*
   * Currency is not drawn because MYR is
   * already printed in the PDF template.
   */
  drawField(
    firstPage,
    regularFont,
    voucher.voucherNumber,
    FIELD_POSITIONS.voucherNumber,
  );

  drawField(
    firstPage,
    regularFont,
    `RM ${formatAmountForPdf(
      voucher.amount,
    )}`,
    FIELD_POSITIONS.amount,
  );

  drawField(
    firstPage,
    regularFont,
    amountToMalayWords(
      voucher.amount,
    ),
    FIELD_POSITIONS.amountInWords,
  );

  drawField(
    firstPage,
    regularFont,
    voucher.paymentMethod,
    FIELD_POSITIONS.paymentMethod,
  );

  drawField(
    firstPage,
    regularFont,
    voucher.bankName ??
    'NOT APPLICABLE',
    FIELD_POSITIONS.bankName,
  );

  drawField(
    firstPage,
    regularFont,
    voucher.bankAccountNumber ??
    'NOT APPLICABLE',
    FIELD_POSITIONS.bankAccountNumber,
  );

  drawField(
    firstPage,
    regularFont,
    voucher.recipientName,
    FIELD_POSITIONS.recipientName,
  );

  drawField(
    firstPage,
    regularFont,
    voucher.recipientIc ??
    'NOT PROVIDED',
    FIELD_POSITIONS.recipientIc,
  );

  drawField(
    firstPage,
    regularFont,
    voucher.purpose,
    FIELD_POSITIONS.purpose,
  );

  drawField(
    firstPage,
    regularFont,
    voucher.recipientName,
    FIELD_POSITIONS.payeeName,
  );

  drawField(
    firstPage,
    regularFont,
    directorName,
    FIELD_POSITIONS.approvedBy,
  );

  drawField(
    firstPage,
    regularFont,
    formatDateForPdf(
      voucher.directorApprovedAt,
    ),
    FIELD_POSITIONS.approvalDate,
  );

  drawField(
    firstPage,
    regularFont,
    financeName,
    FIELD_POSITIONS.paidBy,
  );

  drawField(
    firstPage,
    regularFont,
    formatDateForPdf(
      voucher.paymentDate,
    ),
    FIELD_POSITIONS.paymentDate,
  );

  drawField(
    firstPage,
    regularFont,
    voucher.paymentReference ?? '',
    FIELD_POSITIONS.paymentReference,
  );

  /*
   * Recipient signature remains blank until
   * the secure recipient stage.
   */
  if (
  options.directorSignatureDataUrl
) {
  const directorSignature =
    await embedSignature(
      pdfDocument,
      options.directorSignatureDataUrl,
    );

  drawDirectorSignature(
    firstPage,
    directorSignature,
  );
}

if (
  options.recipientSignatureDataUrl
) {
  const recipientSignature =
    await embedSignature(
      pdfDocument,
      options.recipientSignatureDataUrl,
    );

  drawRecipientSignature(
    firstPage,
    recipientSignature,
  );
}

const completedPdfBytes =
  await pdfDocument.save();

return completedPdfBytes;
  
}
import {
  BULK_PAYMENT_VOUCHER_CSV_HEADERS,
} from '@/domain/payment-vouchers/bulk-upload';

const TEMPLATE_FILE_NAME =
  'estuary-payment-voucher-bulk-template.xlsx';

const columnWidths = [
  14, // PV Date
  18, // Division
  28, // Director Email
  30, // Project Manager Email
  24, // Recipient Name
  30, // Recipient Email
  22, // Recipient IC Number
  18, // Recipient Is Malaysian
  20, // Payment Method
  20, // Bank Name
  24, // Bank Account Number
  36, // Purpose of Payment
  16, // Account Code
  34, // Line Description
  12, // Quantity
  16, // Unit Amount
  14, // Tax Amount
];

const sampleValues: Array<
  string | number | Date
> = [
  new Date(2026, 7, 29),
  'Programme',
  'amir@arus.example',
  'nadia@arus.example',
  'Demo Recipient',
  'recipient@example.com',
  '000000000000',
  'Yes',
  'Bank Transfer',
  'Maybank',
  '0000000000',
  'External facilitator payment',
  '5300',
  'Facilitation services',
  1,
  200,
  0,
];

/*
 * These fields must remain text so Excel
 * does not convert their values into
 * scientific notation.
 */
const textColumnNumbers = [
  3,  // Director Email
  4,  // Project Manager Email
  5,  // Recipient Name
  6,  // Recipient Email
  7,  // Recipient IC Number
  10, // Bank Name
  11, // Bank Account Number
  13, // Account Code
];

function downloadBlob(
  blob: Blob,
  fileName: string,
) {
  const downloadUrl =
    URL.createObjectURL(blob);

  const downloadLink =
    document.createElement('a');

  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;
  downloadLink.style.display = 'none';

  document.body.appendChild(
    downloadLink,
  );

  downloadLink.click();
  downloadLink.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, 1000);
}

export async function downloadPaymentVoucherExcelTemplate() {
  /*
   * Dynamic import keeps ExcelJS out of the
   * initial page bundle until Staff requests
   * the template.
   */
  const ExcelJS = await import('exceljs');

  const workbook =
    new ExcelJS.Workbook();

  workbook.creator = 'Estuary';
  workbook.lastModifiedBy = 'Estuary';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet =
    workbook.addWorksheet(
      'Payment Vouchers',
      {
        views: [
          {
            state: 'frozen',
            ySplit: 1,
          },
        ],
      },
    );

  worksheet.columns =
    BULK_PAYMENT_VOUCHER_CSV_HEADERS.map(
      (header, index) => ({
        header,
        key: `column_${index + 1}`,
        width:
          columnWidths[index] ?? 20,
      }),
    );

  /*
   * Header design.
   */
  const headerRow = worksheet.getRow(1);

  headerRow.height = 34;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: {
        argb: 'FFFFFFFF',
      },
      size: 11,
    };

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: 'FF173B67',
      },
    };

    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };

    cell.border = {
      bottom: {
        style: 'thin',
        color: {
          argb: 'FFB8C7DA',
        },
      },
    };
  });

  /*
   * Add one sample row.
   */
  const sampleRow =
    worksheet.addRow(sampleValues);

  sampleRow.height = 24;

  sampleRow.eachCell((cell) => {
    cell.alignment = {
      vertical: 'middle',
      wrapText: true,
    };
  });

  /*
   * Date formatting.
   */
  worksheet.getColumn(1).numFmt =
    'yyyy-mm-dd';

  /*
   * Prevent identifiers from becoming
   * scientific notation.
   */
  textColumnNumbers.forEach(
    (columnNumber) => {
      worksheet.getColumn(
        columnNumber,
      ).numFmt = '@';
    },
  );

  /*
   * Numeric formatting.
   */
  worksheet.getColumn(15).numFmt =
    '0.00';

  worksheet.getColumn(16).numFmt =
    '#,##0.00';

  worksheet.getColumn(17).numFmt =
    '#,##0.00';

  /*
   * Apply basic formatting to empty rows
   * Staff may use.
   */
  for (
    let rowNumber = 2;
    rowNumber <= 501;
    rowNumber += 1
  ) {
    const row =
      worksheet.getRow(rowNumber);

    row.getCell(1).numFmt =
      'yyyy-mm-dd';

    textColumnNumbers.forEach(
      (columnNumber) => {
        row.getCell(
          columnNumber,
        ).numFmt = '@';
      },
    );

    row.getCell(15).numFmt =
      '0.00';

    row.getCell(16).numFmt =
      '#,##0.00';

    row.getCell(17).numFmt =
      '#,##0.00';

    /*
     * Division dropdown.
     */
    row.getCell(2).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [
        '"Programme,Finance,Operations"',
      ],
      showErrorMessage: true,
      errorTitle:
        'Invalid division',
      error:
        'Select a division from the list.',
    };

    /*
     * Malaysian dropdown.
     */
    row.getCell(8).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [
        '"Yes,No"',
      ],
      showErrorMessage: true,
      errorTitle:
        'Invalid selection',
      error:
        'Select Yes or No.',
    };

    /*
     * Payment method dropdown.
     */
    row.getCell(9).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [
        '"Bank Transfer,Cash,Cheque,IBG,DuitNow"',
      ],
      showErrorMessage: true,
      errorTitle:
        'Invalid payment method',
      error:
        'Select a payment method from the list.',
    };
  }

  worksheet.autoFilter = {
    from: {
      row: 1,
      column: 1,
    },
    to: {
      row: 1,
      column:
        BULK_PAYMENT_VOUCHER_CSV_HEADERS.length,
    },
  };

  /*
   * Add concise instructions in a separate
   * worksheet so they do not interfere with
   * the importer.
   */
  const instructions =
    workbook.addWorksheet(
      'Instructions',
    );

  instructions.columns = [
    {
      key: 'item',
      width: 28,
    },
    {
      key: 'instruction',
      width: 90,
    },
  ];

  instructions.addRows([
    [
      'How to use',
      'Complete one row for each Payment Voucher, then upload this workbook to Estuary.',
    ],
    [
      'PV Date',
      'Use the yyyy-mm-dd format.',
    ],
    [
      'IC and bank account',
      'These columns are formatted as text. Do not change them to number format.',
    ],
    [
      'Required fields',
      'Complete all required fields before uploading.',
    ],
    [
      'Sample row',
      'Delete or replace the sample row before uploading your actual records.',
    ],
  ]);

  instructions.getRow(1).font = {
    bold: true,
  };

  instructions.eachRow((row) => {
    row.alignment = {
      vertical: 'top',
      wrapText: true,
    };
  });

  const workbookBuffer =
    await workbook.xlsx.writeBuffer();

  const workbookBytes =
    new Uint8Array(
      workbookBuffer as ArrayBuffer,
    );

  const workbookBlob =
    new Blob(
      [workbookBytes],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    );

  downloadBlob(
    workbookBlob,
    TEMPLATE_FILE_NAME,
  );
}
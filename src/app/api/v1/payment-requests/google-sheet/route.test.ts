import { describe, expect, it } from 'vitest';
import { Workbook } from 'exceljs';

import { richLinksFromHtml, richLinksFromWorkbook } from './route';

describe('public Google Sheet smart-chip links', () => {
  it('keeps a smart-chip label mapped to its clickable Drive URL', () => {
    const links = richLinksFromHtml(`
      <table><tr><td>
        <a href="https://drive.google.com/file/d/example/view">1. Receipt.pdf</a>
      </td></tr></table>
    `);

    expect(links).toEqual({
      '1. Receipt.pdf': 'https://drive.google.com/file/d/example/view',
    });
  });

  it('unwraps Google redirect links used by public sheet views', () => {
    const links = richLinksFromHtml(`
      <a href="https://www.google.com/url?q=https%3A%2F%2Fdrive.google.com%2Ffile%2Fd%2Freceipt%2Fview&amp;sa=D">Receipt file</a>
    `);

    expect(links['Receipt file']).toBe(
      'https://drive.google.com/file/d/receipt/view',
    );
  });
});

describe('public Google Sheet workbook smart-chip links', () => {
  it('extracts the display filename and original URL without an API key', async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Receipts');
    sheet.getCell('A1').value = {
      text: 'receipt.pdf',
      hyperlink: 'https://drive.google.com/file/d/example/view',
    };
    const data = await workbook.xlsx.writeBuffer();

    await expect(richLinksFromWorkbook(new Uint8Array(data))).resolves.toEqual({
      'receipt.pdf': 'https://drive.google.com/file/d/example/view',
    });
  });
});

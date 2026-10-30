import { describe, expect, it } from 'vitest';

import { parseSummary } from './cash-spent-google-sheet';

describe('Cash Advance spent summary document references', () => {
  it('accepts a Google Drive smart-chip label in the receipt column', () => {
    const result = parseSummary([
      'No,Date,Supplier,Breakdown of Request - List of Expenses,Type of Account,Division,Link to e-invoice / receipts,Amount (RM)',
      '1,15/10/2026,Grab,Airport transfer,600-001,V-VIA-TEF,1.Grab - Home Airport.pdf,25.50',
    ].join('\n'));

    expect(result).toHaveLength(1);
    expect(result[0].receiptLink).toBe('1.Grab - Home Airport.pdf');
  });

  it('keeps the smart-chip label and resolves its public Google Drive URL', () => {
    const label = '1.Grab - Home Airport.pdf';
    const url = 'https://drive.google.com/file/d/example/view';
    const result = parseSummary([
      'No,Date,Supplier,Breakdown of Request - List of Expenses,Type of Account,Division,Link to e-invoice / receipts,Amount (RM)',
      `1,15/10/2026,Grab,Airport transfer,600-001,V-VIA-TEF,${label},25.50`,
    ].join('\n'), { [label]: url });

    expect(result[0]).toMatchObject({ receiptLink: url, receiptLabel: label });
  });

  it('resolves the link when Google changes the smart-chip dash style', () => {
    const csvLabel = '1.Grab – Home Airport.pdf';
    const htmlLabel = '1.Grab - Home Airport.pdf';
    const url = 'https://drive.google.com/file/d/dash-example/view';
    const result = parseSummary([
      'No,Date,Supplier,Breakdown of Request - List of Expenses,Type of Account,Division,Link to e-invoice / receipts,Amount (RM)',
      `1,15/10/2026,Grab,Airport transfer,600-001,V-VIA-TEF,${csvLabel},25.50`,
    ].join('\n'), { [htmlLabel]: url });

    expect(result[0]).toMatchObject({ receiptLink: url, receiptLabel: csvLabel });
  });
});

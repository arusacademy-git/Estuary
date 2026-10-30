import { describe, expect, it } from 'vitest';

import type { ClaimType } from '@/domain/payment-requests/claims/types';

import { parseClaimSheet } from './claim-google-sheet';

const chipReference = '1.Grab - Home Airport.pdf';

describe('Claim Google Sheet document references', () => {
  it.each<ClaimType>(['EXPENSE', 'PD', 'INTERNET_COMMUTE', 'MEDICAL', 'TECH'])(
    'accepts a Google Drive smart-chip label for %s claims',
    (claimType) => {
      const expenseColumns = claimType === 'EXPENSE'
        ? ',Type of Account,Division'
        : '';
      const expenseValues = claimType === 'EXPENSE'
        ? ',600-001 PROJECT ACCOMODATION,V-VIA-TEF'
        : '';
      const result = parseClaimSheet([
        `Date,Supplier,Details,Link to e-invoice / receipts${expenseColumns},Total`,
        `15/10/2026,Grab,Airport transfer,${chipReference}${expenseValues},25.50`,
      ].join('\n'), claimType);

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].receiptLink).toBe(chipReference);
    },
  );

  it('continues to accept a normal web link', () => {
    const result = parseClaimSheet([
      'Date,Supplier,Details,Link to e-invoice / receipts,Total',
      '15/10/2026,Clinic,Consultation,https://drive.google.com/file/d/example/view,80.00',
    ].join('\n'), 'MEDICAL');

    expect(result.lines[0].receiptLink).toBe('https://drive.google.com/file/d/example/view');
  });

  it('accepts a day/month purchase date without a year', () => {
    const result = parseClaimSheet([
      'Date,Supplier,Details,Link to e-invoice / receipts,Total',
      '20/9,Clinic,Consultation,https://drive.google.com/file/d/example/view,80.00',
    ].join('\n'), 'MEDICAL');

    expect(result.lines[0].expenseDate).toBe(`${new Date().getFullYear()}-09-20`);
  });

  it('stores a smart-chip label with its enriched Drive URL', () => {
    const driveUrl = 'https://drive.google.com/file/d/chip-example/view';
    const result = parseClaimSheet([
      'Date,Supplier,Details,Link to e-invoice / receipts,Total',
      `15/10/2026,Clinic,Consultation,${chipReference},80.00`,
    ].join('\n'), 'MEDICAL', { [chipReference]: driveUrl });

    expect(result.lines[0]).toMatchObject({
      receiptFileName: chipReference,
      receiptLink: driveUrl,
    });
  });

  it('matches the URL when Google changes the smart-chip dash style', () => {
    const csvLabel = '1.Grab – Home Airport.pdf';
    const htmlLabel = '1.Grab - Home Airport.pdf';
    const driveUrl = 'https://drive.google.com/file/d/dash-example/view';
    const result = parseClaimSheet([
      'Date,Supplier,Details,Link to e-invoice / receipts,Total',
      `15/10/2026,Grab,Airport transfer,${csvLabel},25.50`,
    ].join('\n'), 'MEDICAL', { [htmlLabel]: driveUrl });

    expect(result.lines[0]).toMatchObject({
      receiptFileName: csvLabel,
      receiptLink: driveUrl,
    });
  });
});

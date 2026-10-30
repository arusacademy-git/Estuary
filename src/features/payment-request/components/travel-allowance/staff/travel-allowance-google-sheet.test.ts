import { describe, expect, it } from 'vitest';

import { parseTravelAllowanceSheet } from './travel-allowance-google-sheet';

describe('Travel Allowance Google Sheet parser', () => {
  it('uses the request year for a day-month travel date without a year', () => {
    const result = parseTravelAllowanceSheet([
      'Name: Afiq,Position: Staff,Date: 17/10/2026',
      '#,Employee Name,Travel Date,Under Which Division,Reason for Meal Allowance,Meal Type,Special Allowance',
      '1,Afiq Rahman,19-Jan,O-HR-ARUS,Programme travel,"Breakfast, Lunch",0',
    ].join('\n'));

    expect(result.entries[0].travelDate).toBe('2026-01-19');
  });

  it('uses the current year when the request date is blank', () => {
    const result = parseTravelAllowanceSheet([
      '#,Employee Name,Travel Date,Under Which Division,Reason for Meal Allowance,Meal Type,Special Allowance',
      '1,Afiq Rahman,19-Jan,O-HR-ARUS,Programme travel,Breakfast,0',
    ].join('\n'));

    expect(result.entries[0].travelDate).toBe(`${new Date().getFullYear()}-01-19`);
  });
});

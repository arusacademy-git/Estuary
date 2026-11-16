import type {
  AdminAccountingCode,
  AdminEmployee,
  AdminProgramme,
} from './admin-settings';

export const PROGRAMME_IMPORT_HEADERS = [
  'Programme Code',
  'Programme Name',
  'Manager Email',
  'Active',
] as const;

export const ACCOUNTING_IMPORT_HEADERS = [
  'Accounting Code',
  'Account Name',
  'Description',
  'Active',
] as const;

function normalizedHeader(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted && character === '"' && csv[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ',') {
      row.push(value);
      value = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function table(csv: string, expectedHeaders: readonly string[]) {
  const rows = parseCsv(csv);
  if (!rows.length) throw new Error('The selected worksheet is empty.');
  const headers = rows[0].map(normalizedHeader);
  const missing = expectedHeaders.filter(
    (header) => !headers.includes(normalizedHeader(header)),
  );
  if (missing.length) {
    throw new Error(`Row 1 is missing required header${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
  }
  return rows.slice(1).map((cells, rowIndex) => ({
    rowNumber: rowIndex + 2,
    get: (header: string) => cells[headers.indexOf(normalizedHeader(header))]?.trim() ?? '',
  }));
}

function activeValue(value: string, rowNumber: number) {
  const normalized = value.trim().toLocaleLowerCase();
  if (['true', 'yes', 'y', '1', 'active'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', 'inactive'].includes(normalized)) return false;
  throw new Error(`Row ${rowNumber}: Active must be Yes/No or True/False.`);
}

function importId(prefix: string, code: string) {
  const slug = code.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${prefix}-${slug || Date.now()}`;
}

export function upsertProgrammesFromCsv(
  csv: string,
  existing: AdminProgramme[],
  employees: AdminEmployee[],
) {
  const next = [...existing];
  let created = 0;
  let updated = 0;
  for (const row of table(csv, PROGRAMME_IMPORT_HEADERS)) {
    const code = row.get('Programme Code').toUpperCase();
    const name = row.get('Programme Name');
    const managerEmail = row.get('Manager Email').toLocaleLowerCase();
    if (!code || !name) throw new Error(`Row ${row.rowNumber}: Programme Code and Programme Name are required.`);
    const manager = managerEmail
      ? employees.find((employee) => employee.email.toLocaleLowerCase() === managerEmail && employee.active)
      : undefined;
    if (managerEmail && !manager) throw new Error(`Row ${row.rowNumber}: no active employee matches Manager Email ${managerEmail}.`);
    const index = next.findIndex((item) => item.code.toLocaleLowerCase() === code.toLocaleLowerCase());
    const item: AdminProgramme = {
      id: index >= 0 ? next[index].id : importId('programme', code),
      code,
      name,
      managerId: manager?.id ?? '',
      active: activeValue(row.get('Active'), row.rowNumber),
    };
    if (index >= 0) { next[index] = item; updated += 1; } else { next.push(item); created += 1; }
  }
  return { items: next, created, updated };
}

export function upsertAccountingCodesFromCsv(csv: string, existing: AdminAccountingCode[]) {
  const next = [...existing];
  let created = 0;
  let updated = 0;
  for (const row of table(csv, ACCOUNTING_IMPORT_HEADERS)) {
    const code = row.get('Accounting Code').toUpperCase();
    const name = row.get('Account Name');
    if (!code || !name) throw new Error(`Row ${row.rowNumber}: Accounting Code and Account Name are required.`);
    const index = next.findIndex((item) => item.code.toLocaleLowerCase() === code.toLocaleLowerCase());
    const item: AdminAccountingCode = {
      id: index >= 0 ? next[index].id : importId('account', code),
      code,
      name,
      description: row.get('Description'),
      active: activeValue(row.get('Active'), row.rowNumber),
    };
    if (index >= 0) { next[index] = item; updated += 1; } else { next.push(item); created += 1; }
  }
  return { items: next, created, updated };
}

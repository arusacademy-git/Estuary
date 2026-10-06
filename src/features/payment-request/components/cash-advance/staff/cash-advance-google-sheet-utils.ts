export function normalizeSheetCell(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function parseSheetCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if (
      (character === '\n' || character === '\r') &&
      !quoted
    ) {
      if (character === '\r' && next === '\n') {
        index += 1;
      }

      row.push(value);

      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }

      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error(
      'The Google Sheet contains an unclosed quoted value.',
    );
  }

  row.push(value);

  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }

  return rows;
}

export async function retrieveSheetCsv(url: string) {
  const response = await fetch(
    '/api/v1/payment-requests/google-sheet',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: url.trim(),
      }),
    },
  );

  const body = (await response.json()) as {
    data?: {
      csv: string;
    };
    error?: {
      message?: string;
    };
  };

  if (!response.ok || !body.data) {
    throw new Error(
      body.error?.message ??
        'Unable to read the Google Sheet.',
    );
  }

  return body.data.csv;
}

export function sheetMoney(value: string) {
  const clean = value
    .replace(/rm/gi, '')
    .replace(/,/g, '')
    .trim();

  if (!clean || clean === '-') {
    return 0;
  }

  return Number(clean);
}

export function sheetDate(
  value: string,
  fallbackYear = new Date().getFullYear(),
) {
  const clean = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  const numeric = clean.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/,
  );

  if (numeric) {
    const year =
      numeric[3].length === 2
        ? 2000 + Number(numeric[3])
        : Number(numeric[3]);

    return `${year}-${numeric[2].padStart(
      2,
      '0',
    )}-${numeric[1].padStart(2, '0')}`;
  }

  const dayMonth = clean.match(
    /^(\d{1,2})[\s-]([A-Za-z]{3,9})$/,
  );

  const parsed = new Date(
    dayMonth
      ? `${dayMonth[1]} ${dayMonth[2]} ${fallbackYear}`
      : clean,
  );

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `Invalid date in the Cash Advance sheet: ${value}`,
    );
  }

  return `${parsed.getFullYear()}-${String(
    parsed.getMonth() + 1,
  ).padStart(2, '0')}-${String(
    parsed.getDate(),
  ).padStart(2, '0')}`;
}

export function sheetMetadata(
  rows: string[][],
  endIndex: number,
) {
  const result: Record<string, string> = {};

  const labels = [
    'name',
    'position',
    'contact',
    'date',
    'account holder name',
    'bank name',
    'account number',
  ];

  rows
    .slice(0, endIndex)
    .forEach((row, rowIndex) =>
      row.forEach((rawCell, columnIndex) => {
        const cell = rawCell.trim();

        const label = labels.find(
          (item) =>
            normalizeSheetCell(cell).startsWith(
              `${item}:`,
            ) ||
            normalizeSheetCell(cell) === item,
        );

        if (!label) {
          return;
        }

        let value = cell.includes(':')
          ? cell
              .slice(cell.indexOf(':') + 1)
              .trim()
          : '';

        if (!value) {
          for (
            let next = columnIndex + 1;
            next < row.length;
            next += 1
          ) {
            const candidate = String(
              row[next] ?? '',
            ).trim();

            if (
              labels.some((item) =>
                normalizeSheetCell(
                  candidate,
                ).startsWith(`${item}:`),
              )
            ) {
              break;
            }

            if (candidate) {
              value = candidate;
              break;
            }
          }
        }

        if (!value) {
          value = String(
            rows[rowIndex + 1]?.[
              columnIndex
            ] ?? '',
          ).trim();
        }

        if (value) {
          result[label] = value;
        }
      }),
    );

  return result;
}
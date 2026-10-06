import { NextResponse } from 'next/server';

const maximumSheetSize = 2_000_000;

function googleSheetDetails(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Paste a Google Sheets link first.');
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid Google Sheets link.');
  }

  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') {
    throw new Error('Only https://docs.google.com Google Sheets links are accepted.');
  }

  const match = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  if (!match) {
    throw new Error('The link must be a standard Google Sheets sharing link.');
  }

  const hashParameters = new URLSearchParams(url.hash.replace(/^#/, ''));
  const requestedGid = url.searchParams.get('gid') ?? hashParameters.get('gid');
  const gid = requestedGid && /^\d+$/.test(requestedGid)
    ? requestedGid
    : null;

  const gidParameter = gid ? `&gid=${encodeURIComponent(gid)}` : '';
  const spreadsheetId = match[1];

  return {
    sourceUrl: url.toString(),
    exportUrls: [
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParameter}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${gidParameter}`,
    ],
  };
}

async function fetchGoogleSheetCsv(exportUrls: string[]) {
  const failures: string[] = [];

  for (const exportUrl of exportUrls) {
    try {
      const response = await fetch(exportUrl, {
        cache: 'no-store',
        redirect: 'follow',
        headers: { Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.1' },
      });

      if (!response.ok) {
        failures.push(`HTTP ${response.status}`);
        continue;
      }

      const csv = await response.text();
      const contentType = response.headers.get('content-type') ?? '';
      const isHtml = contentType.includes('text/html') || /^\s*<!doctype html/i.test(csv);

      if (!csv.trim() || isHtml) {
        failures.push(isHtml ? 'Google returned a sign-in page' : 'Google returned an empty sheet');
        continue;
      }

      if (csv.length > maximumSheetSize) {
        throw new Error('The Google Sheet is too large. Keep the sheet below 2 MB.');
      }

      return csv;
    } catch (error) {
      if (error instanceof Error && error.message.includes('too large')) throw error;
      failures.push(error instanceof Error ? error.message : 'Google request failed');
    }
  }

  throw new Error(
    `Google could not export this sheet (${failures.join('; ') || 'unknown response'}). Open the exact worksheet tab, copy its URL so it includes gid, and confirm anyone with the link can view it.`,
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const { sourceUrl, exportUrls } = googleSheetDetails(body.url);
    const csv = await fetchGoogleSheetCsv(exportUrls);

    return NextResponse.json({ data: { csv, sourceUrl } });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Unable to read the Google Sheet.' } },
      { status: 400 },
    );
  }
}

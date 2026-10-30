import { NextResponse } from 'next/server';
import { Workbook } from 'exceljs';

const maximumSheetSize = 2_000_000;
const maximumWorkbookSize = 8_000_000;

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
    spreadsheetId,
    gid,
    exportUrls: [
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gidParameter}`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${gidParameter}`,
    ],
  };
}

type GoogleCellData = {
  formattedValue?: string;
  hyperlink?: string;
  chipRuns?: Array<{ chip?: { richLinkProperties?: { uri?: string } } }>;
  textFormatRuns?: Array<{ format?: { link?: { uri?: string } } }>;
};

async function fetchRichLinks(spreadsheetId: string, gid: string | null) {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim();
  if (!apiKey) return {};

  const fields = 'sheets(properties(sheetId),data(rowData(values(formattedValue,hyperlink,chipRuns,textFormatRuns))))';
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=true&fields=${encodeURIComponent(fields)}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json', 'x-goog-api-key': apiKey },
  });
  if (!response.ok) return {};

  const body = await response.json() as {
    sheets?: Array<{
      properties?: { sheetId?: number };
      data?: Array<{ rowData?: Array<{ values?: GoogleCellData[] }> }>;
    }>;
  };
  const requestedSheet = body.sheets?.find((sheet) => gid === null || String(sheet.properties?.sheetId) === gid);
  const links: Record<string, string> = {};

  requestedSheet?.data?.forEach((grid) => grid.rowData?.forEach((row) => row.values?.forEach((cell) => {
    const label = cell.formattedValue?.trim();
    const uri = cell.chipRuns?.find((run) => run.chip?.richLinkProperties?.uri)?.chip?.richLinkProperties?.uri
      ?? cell.hyperlink
      ?? cell.textFormatRuns?.find((run) => run.format?.link?.uri)?.format?.link?.uri;
    if (label && uri && /^https?:\/\//i.test(uri)) links[label] = uri;
  })));

  return links;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function richLinksFromHtml(html: string) {
  const links: Record<string, string> = {};
  const anchors = html.matchAll(/<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi);
  for (const anchor of anchors) {
    const label = decodeHtml(anchor[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    let href = decodeHtml(anchor[1] ?? anchor[2] ?? '').trim();
    try {
      const redirect = new URL(href, 'https://docs.google.com');
      if (redirect.hostname.endsWith('google.com') && redirect.pathname === '/url') href = redirect.searchParams.get('q') ?? href;
    } catch { continue; }
    if (label && /^https?:\/\//i.test(href)) links[label] = href;
  }
  return links;
}

async function fetchPublicRichLinks(spreadsheetId: string, gid: string | null) {
  const encodedId = encodeURIComponent(spreadsheetId);
  const encodedGid = gid ? encodeURIComponent(gid) : null;
  const urls = [
    `https://docs.google.com/spreadsheets/d/${encodedId}/htmlview${encodedGid ? `?gid=${encodedGid}` : ''}`,
    `https://docs.google.com/spreadsheets/d/${encodedId}/gviz/tq?tqx=out:html${encodedGid ? `&gid=${encodedGid}` : ''}`,
  ];
  const links: Record<string, string> = {};

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        cache: 'no-store', redirect: 'follow', headers: { Accept: 'text/html' },
      });
      if (!response.ok) continue;
      const html = await response.text();
      if (!html.trim() || html.length > maximumSheetSize * 2) continue;
      Object.assign(links, richLinksFromHtml(html));
    } catch {
      // Try the next public representation. The optional API-key path remains a fallback.
    }
  }

  return links;
}

export async function richLinksFromWorkbook(data: Uint8Array) {
  const workbook = new Workbook();
  const excelBuffer = Buffer.from(data);
  await workbook.xlsx.load(
    excelBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const links: Record<string, string> = {};

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        const value = cell.value;
        if (!value || typeof value !== 'object' || !('hyperlink' in value)) return;
        const hyperlink = typeof value.hyperlink === 'string' ? value.hyperlink.trim() : '';
        const label = 'text' in value && typeof value.text === 'string'
          ? value.text.trim()
          : cell.text.trim();
        if (label && /^https?:\/\//i.test(hyperlink)) links[label] = hyperlink;
      });
    });
  });

  return links;
}

async function fetchPublicWorkbookRichLinks(spreadsheetId: string) {
  try {
    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export?format=xlsx`,
      { cache: 'no-store', redirect: 'follow', headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } },
    );
    if (!response.ok) return {};
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > maximumWorkbookSize) return {};
    const data = new Uint8Array(await response.arrayBuffer());
    if (!data.length || data.length > maximumWorkbookSize) return {};
    return await richLinksFromWorkbook(data);
  } catch {
    return {};
  }
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
    const { sourceUrl, spreadsheetId, gid, exportUrls } = googleSheetDetails(body.url);
    const csv = await fetchGoogleSheetCsv(exportUrls);
    const [publicRichLinks, workbookRichLinks, apiRichLinks] = await Promise.all([
      fetchPublicRichLinks(spreadsheetId, gid),
      fetchPublicWorkbookRichLinks(spreadsheetId),
      fetchRichLinks(spreadsheetId, gid),
    ]);
    const richLinks = { ...publicRichLinks, ...workbookRichLinks, ...apiRichLinks };

    return NextResponse.json({ data: { csv, sourceUrl, richLinks } });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Unable to read the Google Sheet.' } },
      { status: 400 },
    );
  }
}

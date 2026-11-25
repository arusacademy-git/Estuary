import { Workbook } from 'exceljs';

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
  const anchors = html.matchAll(
    /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi
  );
  for (const anchor of anchors) {
    const label = decodeHtml(
      anchor[3]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
    let href = decodeHtml(anchor[1] ?? anchor[2] ?? '').trim();
    try {
      const redirect = new URL(href, 'https://docs.google.com');
      if (
        redirect.hostname.endsWith('google.com') &&
        redirect.pathname === '/url'
      ) {
        href = redirect.searchParams.get('q') ?? href;
      }
    } catch {
      continue;
    }
    if (label && /^https?:\/\//i.test(href)) links[label] = href;
  }
  return links;
}

export async function richLinksFromWorkbook(data: Uint8Array) {
  const workbook = new Workbook();
  const excelBuffer = Buffer.from(data);
  await workbook.xlsx.load(
    excelBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const links: Record<string, string> = {};

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        const value = cell.value;
        if (!value || typeof value !== 'object' || !('hyperlink' in value)) {
          return;
        }
        const hyperlink =
          typeof value.hyperlink === 'string' ? value.hyperlink.trim() : '';
        const label =
          'text' in value && typeof value.text === 'string'
            ? value.text.trim()
            : cell.text.trim();
        if (label && /^https?:\/\//i.test(hyperlink)) links[label] = hyperlink;
      });
    });
  });

  return links;
}

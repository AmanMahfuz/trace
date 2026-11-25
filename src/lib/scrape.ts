import dns from 'dns/promises';
import * as cheerio from 'cheerio';

/**
 * Checks whether an IP address belongs to localhost, private networks,
 * link-local addresses, or reserved blocks.
 */
export function isPrivateIP(ip: string): boolean {
  if (ip === 'localhost' || ip === '::1' || ip === '0.0.0.0') return true;

  // IPv4 Checks
  // 127.0.0.0/8 (Loopback)
  if (ip.startsWith('127.')) return true;
  // 10.0.0.0/8 (Private)
  if (ip.startsWith('10.')) return true;
  // 169.254.0.0/16 (Link-local / Cloud metadata)
  if (ip.startsWith('169.254.')) return true;
  // 192.168.0.0/16 (Private)
  if (ip.startsWith('192.168.')) return true;

  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    const second = parseInt(parts[1], 10);
    if (!isNaN(second) && second >= 16 && second <= 31) return true;
  }

  // IPv6 Checks
  // fc00::/7 (Unique Local Address)
  const lower = ip.toLowerCase();
  if (lower.startsWith('fc00:') || lower.startsWith('fd') || lower.startsWith('fc')) return true;
  // fe80::/10 (Link-local)
  if (lower.startsWith('fe80:')) return true;

  return false;
}

/**
 * Validates a target URL against SSRF vulnerabilities by resolving DNS
 * and verifying that neither hostname nor resolved IP addresses point to internal infrastructure.
 */
export async function validateSafeUrl(targetUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isPrivateIP(hostname)) {
    throw new Error('Access to private/local destinations is forbidden');
  }

  try {
    const lookupResults = await dns.lookup(hostname, { all: true });
    for (const res of lookupResults) {
      if (isPrivateIP(res.address)) {
        throw new Error('Domain resolves to a prohibited internal IP address');
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('prohibited')) throw err;
    throw new Error('Failed to resolve target host DNS');
  }

  return parsed;
}

/**
 * Fetch a URL with manual redirect checking to prevent SSRF via open redirects.
 */
async function fetchWithRedirectValidation(
  initialUrl: string,
  maxRedirects = 5,
  signal?: AbortSignal
): Promise<{ text: string; finalUrl: string }> {
  let currentUrl = initialUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const safeUrl = await validateSafeUrl(currentUrl);

    const res = await fetch(safeUrl.toString(), {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 TraceBot/1.0',
      },
    });

    // Check for redirects (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) {
        throw new Error(`Redirect response (${res.status}) missing Location header`);
      }
      currentUrl = new URL(location, currentUrl).toString();
      redirects++;
      continue;
    }

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1048576) {
      throw new Error('Target resource exceeds maximum permissible size of 1MB');
    }

    const text = await res.text();
    if (text.length > 1048576) {
      throw new Error('Target response body exceeds 1MB limit');
    }

    return { text, finalUrl: currentUrl };
  }

  throw new Error('Exceeded maximum redirection count');
}

export async function scrapeJobUrl(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let html = '';
  let resolvedUrl = url;

  try {
    const result = await fetchWithRedirectValidation(url, 5, controller.signal);
    html = result.text;
    resolvedUrl = result.finalUrl;
  } finally {
    clearTimeout(timeoutId);
  }

  const $ = cheerio.load(html);

  // Extract structured JSON-LD data
  let title: string | undefined;
  let company: string | undefined;
  let datePosted: string | undefined;
  let validThrough: string | undefined;

  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const json = JSON.parse($(elem).html() || '{}');
      const item =
        json['@type'] === 'JobPosting'
          ? json
          : Array.isArray(json['@graph'])
          ? json['@graph'].find((g: Record<string, unknown>) => g['@type'] === 'JobPosting')
          : null;

      if (item) {
        title = typeof item.title === 'string' ? item.title : title;
        company =
          item.hiringOrganization && typeof item.hiringOrganization.name === 'string'
            ? item.hiringOrganization.name
            : company;
        datePosted = typeof item.datePosted === 'string' ? item.datePosted : datePosted;
        validThrough = typeof item.validThrough === 'string' ? item.validThrough : validThrough;
      }
    } catch {}
  });

  // Extract readable text via Jina Reader, fallback to stripped HTML
  let readableText = '';
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${encodeURI(resolvedUrl)}`, {
      headers: { 'X-Target-Selector': 'body' },
    });
    if (jinaRes.ok) {
      readableText = await jinaRes.text();
    }
  } catch {}

  if (!readableText || readableText.length < 300) {
    $('script, style, nav, footer, header, noscript, svg').remove();
    readableText = $('body').text().replace(/\s+/g, ' ').trim();
  }

  if (readableText.length < 300) {
    throw new Error("We couldn't read that page. Paste the raw job description instead.");
  }

  // Do not truncate below 12,000 chars (we keep up to 16,000 chars)
  return {
    raw_text: readableText.slice(0, 16000),
    title,
    company,
    date_posted: datePosted ? new Date(datePosted) : undefined,
    valid_through: validThrough ? new Date(validThrough) : undefined,
  };
}

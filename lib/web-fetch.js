const dns = require('node:dns/promises');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const { Readability } = require('@mozilla/readability');
const { DOMParser } = require('./linkedom-worker');
const { highlightedCodeBlock, strikethrough, taskListItems } = require('turndown-plugin-gfm');

let TurndownService;

function parseDocument(html, url = 'https://invalid.fikr.local/') {
  const document = new DOMParser().parseFromString(String(html), 'text/html');
  // Readability uses documentURI for relative metadata. LinkeDOM intentionally
  // leaves navigation out, so supply the already validated public URL.
  Object.defineProperty(document, 'documentURI', { configurable: true, value: String(url) });
  return document;
}

class MarkdownDOMParser {
  parseFromString(html) {
    return parseDocument(html);
  }
}

function loadTurndown() {
  if (TurndownService) return TurndownService;
  const priorWindow = global.window;
  // Turndown otherwise loads its own second server-side DOM implementation.
  // The same bounded LinkeDOM parser is already available and compatible here.
  global.window = { DOMParser: MarkdownDOMParser };
  try {
    TurndownService = require('turndown');
  } finally {
    if (priorWindow === undefined) delete global.window;
    else global.window = priorWindow;
  }
  return TurndownService;
}

function isHeadingTableRow(row) {
  if (!row?.parentNode) return false;
  if (row.parentNode.nodeName === 'THEAD') return true;
  const firstRow = row.parentNode.getElementsByTagName?.('tr')?.[0];
  return firstRow === row && Array.from(row.children ?? []).every((cell) => cell.nodeName === 'TH');
}

function installCompatibleGfm(turndown) {
  turndown.use([highlightedCodeBlock, strikethrough, taskListItems]);
  turndown.addRule('gfmTableCell', {
    filter: ['th', 'td'],
    replacement(content, node) {
      const siblings = Array.from(node.parentNode?.children ?? []);
      const prefix = siblings.indexOf(node) === 0 ? '| ' : ' ';
      return `${prefix}${content.replace(/\|/g, '\\|').trim()} |`;
    },
  });
  turndown.addRule('gfmTableRow', {
    filter: 'tr',
    replacement(content, node) {
      if (!isHeadingTableRow(node)) return `\n${content}`;
      const borders = Array.from(node.children ?? []).map((cell, index) => {
        const alignment = String(cell.getAttribute?.('align') ?? '').toLowerCase();
        const marker = alignment === 'left' ? ':--' : alignment === 'right' ? '--:' : alignment === 'center' ? ':-:' : '---';
        return `${index === 0 ? '| ' : ' '}${marker} |`;
      }).join('');
      return `\n${content}\n${borders}`;
    },
  });
  turndown.addRule('gfmTableSection', {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement: (content) => content,
  });
  turndown.addRule('gfmTable', {
    filter(node) {
      return node.nodeName === 'TABLE' && isHeadingTableRow(node.getElementsByTagName?.('tr')?.[0]);
    },
    replacement(content) {
      return `\n\n${content.replace(/\n\n/g, '\n').trim()}\n\n`;
    },
  });
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_MARKDOWN_CHARS = 60_000;
const SUPPORTED_CONTENT_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'text/plain',
  'text/markdown',
]);

const BLOCKED_IPV4_SUBNETS = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];
const BLOCKED_IPV6_SUBNETS = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:2::', 48],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];
const blockedAddresses = new net.BlockList();
for (const [network, prefix] of BLOCKED_IPV4_SUBNETS) blockedAddresses.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of BLOCKED_IPV6_SUBNETS) blockedAddresses.addSubnet(network, prefix, 'ipv6');

function boundedText(value, maxLength) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizedHostname(value) {
  return String(value ?? '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function mappedIpv4Address(address) {
  const normalized = normalizedHostname(address);
  const dottedMatch = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dottedMatch) return dottedMatch[1];
  const hexMatch = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hexMatch) return null;
  const high = Number.parseInt(hexMatch[1], 16);
  const low = Number.parseInt(hexMatch[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function isPublicAddress(addressValue) {
  const address = normalizedHostname(addressValue);
  const mapped = mappedIpv4Address(address);
  if (mapped) return isPublicAddress(mapped);
  const family = net.isIP(address);
  if (family === 4) return !blockedAddresses.check(address, 'ipv4');
  if (family === 6) return !blockedAddresses.check(address, 'ipv6');
  return false;
}

function parsePublicUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value ?? '').trim());
  } catch {
    throw new Error('Enter a valid webpage URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Webpages must use HTTP or HTTPS');
  if (parsed.username || parsed.password) throw new Error('Credentials are not allowed in webpage URLs');
  if (!parsed.hostname) throw new Error('Enter a valid webpage URL');
  const hostname = normalizedHostname(parsed.hostname);
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Private and local webpages are not available');
  }
  if (net.isIP(hostname) && !isPublicAddress(hostname)) {
    throw new Error('Private and local webpages are not available');
  }
  parsed.hash = '';
  return parsed;
}

async function resolvePublicAddresses(url, resolver = dns.lookup) {
  const hostname = normalizedHostname(url.hostname);
  if (net.isIP(hostname)) return [{ address: hostname, family: net.isIP(hostname) }];
  let resolved;
  try {
    resolved = await resolver(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('That webpage host could not be resolved');
  }
  const entries = (Array.isArray(resolved) ? resolved : [resolved])
    .map((entry) => typeof entry === 'string' ? { address: entry, family: net.isIP(entry) } : entry)
    .filter((entry) => entry && net.isIP(entry.address));
  if (entries.length === 0) throw new Error('That webpage host could not be resolved');
  if (entries.some((entry) => !isPublicAddress(entry.address))) {
    throw new Error('Private and local webpages are not available');
  }
  return entries.map((entry) => ({ address: normalizedHostname(entry.address), family: Number(entry.family) }));
}

function pinnedLookup(addresses) {
  return (_hostname, options, callback) => {
    const requestedFamily = typeof options === 'number' ? options : Number(options?.family ?? 0);
    const candidates = requestedFamily === 4 || requestedFamily === 6
      ? addresses.filter((entry) => entry.family === requestedFamily)
      : addresses;
    if (candidates.length === 0) {
      const error = new Error('No public address is available for that webpage');
      error.code = 'ENOTFOUND';
      callback(error);
      return;
    }
    if (typeof options === 'object' && options?.all) callback(null, candidates);
    else callback(null, candidates[0].address, candidates[0].family);
  };
}

function requestPublicUrl({ url, addresses, signal, maxResponseBytes }) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(url, {
      method: 'GET',
      lookup: pinnedLookup(addresses),
      signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/markdown,text/plain;q=0.8',
        'Accept-Encoding': 'identity',
        'User-Agent': 'FikrStudio/0.1 (+https://fikr.one)',
      },
    }, (response) => {
      const declaredLength = Number(response.headers['content-length']);
      if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
        response.destroy();
        reject(new Error(`That webpage is larger than ${Math.floor(maxResponseBytes / (1024 * 1024))} MB`));
        return;
      }
      const chunks = [];
      let received = 0;
      response.on('data', (chunk) => {
        received += chunk.length;
        if (received > maxResponseBytes) {
          response.destroy(new Error(`That webpage is larger than ${Math.floor(maxResponseBytes / (1024 * 1024))} MB`));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({
        status: Number(response.statusCode ?? 0),
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end();
  });
}

function headerValue(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name) ?? '';
  const value = headers?.[name.toLowerCase()] ?? headers?.[name];
  return Array.isArray(value) ? value[0] ?? '' : String(value ?? '');
}

function contentTypeFromHeaders(headers) {
  return headerValue(headers, 'content-type').split(';', 1)[0].trim().toLowerCase();
}

function htmlCharset(headers, bytes) {
  const declared = `${headerValue(headers, 'content-type')} ${bytes.subarray(0, 2_048).toString('ascii')}`
    .match(/charset\s*=\s*["']?([a-zA-Z0-9._-]+)/i)?.[1]
    ?.toLowerCase();
  if (!declared) return 'utf-8';
  if (['utf-8', 'utf8', 'utf-16le', 'utf-16be', 'windows-1252', 'iso-8859-1'].includes(declared)) return declared;
  return 'utf-8';
}

function decodeBody(headers, bytes) {
  try {
    return new TextDecoder(htmlCharset(headers, bytes), { fatal: false }).decode(bytes);
  } catch {
    return bytes.toString('utf8');
  }
}

function sanitizeExtractedHtml(html, finalUrl) {
  const document = parseDocument(`<html><head></head><body>${html}</body></html>`, finalUrl);
  const removableTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'FRAME', 'OBJECT', 'EMBED', 'FORM', 'BUTTON', 'SELECT', 'TEXTAREA', 'DIALOG', 'CANVAS', 'SVG']);
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    if (removableTags.has(element.nodeName)) element.remove();
  }
  for (const input of Array.from(document.getElementsByTagName('input'))) {
    if (String(input.getAttribute('type') ?? '').toLowerCase() !== 'checkbox') input.remove();
  }
  for (const anchor of Array.from(document.getElementsByTagName('a'))) {
    try {
      const target = new URL(anchor.getAttribute('href') ?? '', finalUrl);
      if (!['http:', 'https:'].includes(target.protocol)) anchor.removeAttribute('href');
      else anchor.setAttribute('href', target.toString());
    } catch {
      anchor.removeAttribute('href');
    }
  }
  for (const image of Array.from(document.getElementsByTagName('img'))) {
    try {
      const target = new URL(image.getAttribute('src') ?? '', finalUrl);
      if (!['http:', 'https:'].includes(target.protocol)) image.remove();
      else image.setAttribute('src', target.toString());
    } catch {
      image.remove();
    }
  }
  return document.body.innerHTML;
}

function fallbackArticle(document) {
  const root = document.getElementsByTagName('main')[0]
    ?? document.getElementsByTagName('article')[0]
    ?? Array.from(document.getElementsByTagName('*')).find((element) => element.getAttribute?.('role') === 'main')
    ?? document.body;
  if (!root) return null;
  const clone = root.cloneNode(true);
  const removableTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'IFRAME', 'FORM', 'BUTTON']);
  for (const element of Array.from(clone.getElementsByTagName('*'))) {
    if (removableTags.has(element.nodeName)) element.remove();
  }
  const textContent = clone.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (textContent.length < 20) return null;
  return {
    title: document.title,
    byline: null,
    siteName: null,
    publishedTime: null,
    excerpt: textContent.slice(0, 280),
    textContent,
    content: clone.outerHTML,
  };
}

function markdownFromHtml(html, title) {
  const MarkdownConverter = loadTurndown();
  const turndown = new MarkdownConverter({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
  });
  installCompatibleGfm(turndown);
  turndown.remove(['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'form']);
  let markdown = turndown.turndown(html)
    .replace(/^(\s*[-*+]\s+)\\\[([ xX])\\\]/gm, '$1[$2]')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  const normalizedTitle = boundedText(title, 500).toLowerCase();
  const firstHeading = markdown.match(/^#{1,6}\s+(.+)$/m)?.[1]?.replace(/[*_`]/g, '').trim().toLowerCase();
  if (title && firstHeading !== normalizedTitle) markdown = `# ${title.trim()}\n\n${markdown}`.trim();
  return markdown;
}

async function extractMarkdown(html, finalUrl, { maxMarkdownChars = DEFAULT_MAX_MARKDOWN_CHARS } = {}) {
  const taskAwareHtml = String(html).replace(/<input\b(?=[^>]*\btype\s*=\s*["']?checkbox\b)[^>]*>/gi, (input) => (
    /\bchecked(?:\s*=|\s|>)/i.test(input) ? '[x] ' : '[ ] '
  ));
  const document = parseDocument(taskAwareHtml, finalUrl);
  const fallbackDocument = parseDocument(taskAwareHtml, finalUrl);
  const article = new Readability(document, {
    charThreshold: 50,
    keepClasses: false,
  }).parse() ?? fallbackArticle(fallbackDocument);
  if (!article?.content || !article.textContent?.trim()) {
    throw new Error('Fikr could not find readable content on that webpage');
  }
  const title = boundedText(article.title, 500);
  let markdown = markdownFromHtml(sanitizeExtractedHtml(article.content, finalUrl), title);
  if (!markdown || markdown.replace(/[#*_[\]()!`>\-|]/g, '').trim().length < 20) {
    throw new Error('Fikr could not find readable content on that webpage');
  }
  const truncated = markdown.length > maxMarkdownChars;
  if (truncated) {
    const cutoff = Math.max(markdown.lastIndexOf('\n', maxMarkdownChars), Math.floor(maxMarkdownChars * 0.9));
    markdown = `${markdown.slice(0, cutoff).trim()}\n\n_[Webpage content truncated by Fikr]_`;
  }
  return {
    title,
    author: boundedText(article.byline, 300),
    siteName: boundedText(article.siteName, 300),
    publishedTime: boundedText(article.publishedTime, 100),
    excerpt: boundedText(article.excerpt, 500),
    wordCount: article.textContent.trim().split(/\s+/u).filter(Boolean).length,
    markdown,
    truncated,
  };
}

async function fetchWebPage(urlValue, {
  resolver = dns.lookup,
  request = requestPublicUrl,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  maxMarkdownChars = DEFAULT_MAX_MARKDOWN_CHARS,
  now = () => Date.now(),
} = {}) {
  const requestedUrl = parsePublicUrl(urlValue);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('The webpage request timed out')), timeoutMs);
  const abort = () => controller.abort(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });

  try {
    let currentUrl = requestedUrl;
    let response;
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const addresses = await resolvePublicAddresses(currentUrl, resolver);
      response = await request({
        url: currentUrl,
        addresses,
        signal: controller.signal,
        maxResponseBytes,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirectCount === maxRedirects) throw new Error('That webpage redirected too many times');
      const location = headerValue(response.headers, 'location');
      if (!location) throw new Error('That webpage returned an invalid redirect');
      currentUrl = parsePublicUrl(new URL(location, currentUrl).toString());
    }
    if (!response || response.status < 200 || response.status >= 300) {
      throw new Error(`That webpage returned HTTP ${response?.status || 'error'}`);
    }
    if (!Buffer.isBuffer(response.body)) throw new Error('That webpage returned an invalid response');
    if (response.body.length > maxResponseBytes) {
      throw new Error(`That webpage is larger than ${Math.floor(maxResponseBytes / (1024 * 1024))} MB`);
    }
    const contentType = contentTypeFromHeaders(response.headers) || 'text/html';
    if (!SUPPORTED_CONTENT_TYPES.has(contentType)) {
      throw new Error(`Fikr cannot read ${contentType || 'that content type'} as a webpage`);
    }
    const decoded = decodeBody(response.headers, response.body);
    const extracted = contentType === 'text/plain' || contentType === 'text/markdown'
      ? {
          title: '',
          author: '',
          siteName: '',
          publishedTime: '',
          excerpt: boundedText(decoded, 500),
          wordCount: decoded.trim().split(/\s+/u).filter(Boolean).length,
          markdown: decoded.trim().slice(0, maxMarkdownChars),
          truncated: decoded.trim().length > maxMarkdownChars,
        }
      : await extractMarkdown(decoded, currentUrl.toString(), { maxMarkdownChars });
    return {
      requestedUrl: requestedUrl.toString(),
      finalUrl: currentUrl.toString(),
      contentType,
      fetchedAt: now(),
      ...extracted,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      throw new Error('The webpage request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

module.exports = {
  DEFAULT_MAX_MARKDOWN_CHARS,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_TIMEOUT_MS,
  extractMarkdown,
  fetchWebPage,
  isPublicAddress,
  parsePublicUrl,
  requestPublicUrl,
  resolvePublicAddresses,
};

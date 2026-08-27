const path = require('node:path');

const {
  extractText,
  getDocumentProxy,
  renderPageAsImage,
} = require('unpdf');

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 120;
const MAX_PAGE_CHARACTERS = 12_000;
const MAX_DOCUMENT_CHARACTERS = 60_000;
const MIN_EMBEDDED_TEXT_CHARACTERS = 40;
const MAX_OCR_PAGES = 6;
const MAX_RENDER_PIXELS = 12_000_000;
const OCR_PAGE_TIMEOUT_MS = 25_000;

function boundedText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function unpackedAsarPath(value) {
  return String(value).replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

function normalizePageMarkdown(value) {
  return String(value ?? '')
    .replaceAll('\u0000', '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function visibleCharacterCount(value) {
  return Array.from(String(value ?? '').replace(/\s/gu, '')).length;
}

function decodePdfAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object' || attachment.kind !== 'pdf'
    || attachment.mediaType !== 'application/pdf') {
    throw new Error('extract_document requires a validated PDF attachment');
  }
  const attachmentId = boundedText(attachment.id, 240);
  const name = boundedText(attachment.name, 180).split(/[\\/]/).pop();
  const match = String(attachment.dataUrl ?? '').match(/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!attachmentId || !name || !match) throw new Error('Invalid PDF attachment');
  const bytes = Buffer.from(match[1], 'base64');
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw new Error('PDF attachment is empty or too large');
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('PDF attachment signature is invalid');
  return { attachmentId, name, bytes };
}

function abortError(signal) {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('Document extraction was canceled', 'AbortError');
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError(signal);
}

function withDeadline(promise, { signal, timeoutMs, timeoutMessage, onStop }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      callback(value);
    };
    const stop = (error) => {
      try {
        onStop?.();
      } finally {
        finish(reject, error);
      }
    };
    const onAbort = () => stop(abortError(signal));
    const timer = setTimeout(() => stop(new Error(timeoutMessage)), timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    Promise.resolve(promise).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error),
    );
  });
}

async function createBundledEnglishOcrWorker() {
  const { createWorker, OEM, PSM } = require('tesseract.js');
  const language = require('@tesseract.js-data/eng');
  const tesseractRoot = path.dirname(require.resolve('tesseract.js'));
  const workerPath = unpackedAsarPath(path.join(tesseractRoot, 'worker-script', 'node', 'index.js'));
  const corePath = unpackedAsarPath(path.dirname(require.resolve('tesseract.js-core')));
  const langPath = unpackedAsarPath(path.join(path.dirname(language.langPath), '4.0.0_best_int'));
  const worker = await createWorker(language.code, OEM.LSTM_ONLY, {
    workerPath,
    corePath,
    langPath,
    gzip: language.gzip,
    cacheMethod: 'none',
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: '1',
    user_defined_dpi: '220',
  });
  return worker;
}

async function renderBoundedPage(pdf, pageNumber, pdfAdapter) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const basePixels = Math.max(1, viewport.width * viewport.height);
  const scale = Math.min(2, Math.sqrt(MAX_RENDER_PIXELS / basePixels));
  return pdfAdapter.renderPageAsImage(pdf, pageNumber, {
    canvasImport: () => import('@napi-rs/canvas'),
    scale: Math.max(1, scale),
  });
}

function documentPageMetadata(document, page) {
  return {
    citation: page.citation,
    attachmentId: document.attachmentId,
    name: document.name,
    pageNumber: page.pageNumber,
    extractionMethod: page.extractionMethod,
  };
}

async function extractPdfDocument(attachment, options = {}) {
  const { attachmentId, name, bytes } = decodePdfAttachment(attachment);
  const citationIndex = Math.max(1, Math.floor(Number(options.citationIndex) || 1));
  const signal = options.signal;
  const pdfAdapter = options.pdfAdapter ?? { extractText, getDocumentProxy, renderPageAsImage };
  const createOcrWorker = options.createOcrWorker ?? createBundledEnglishOcrWorker;
  const maxPages = Math.min(MAX_PDF_PAGES, Math.max(1, Math.floor(Number(options.maxPages) || MAX_PDF_PAGES)));
  const requestedMaxOcrPages = Number(options.maxOcrPages);
  const maxOcrPages = Math.min(MAX_OCR_PAGES, Math.max(0, Math.floor(
    Number.isFinite(requestedMaxOcrPages) ? requestedMaxOcrPages : MAX_OCR_PAGES,
  )));
  let pdf;
  let ocrWorker;
  let ocrUnavailable = false;
  const warnings = [];

  try {
    throwIfAborted(signal);
    pdf = await pdfAdapter.getDocumentProxy(new Uint8Array(bytes), {
      maxImageSize: MAX_RENDER_PIXELS,
      isEvalSupported: false,
    });
    if (!Number.isFinite(pdf.numPages) || pdf.numPages < 1) throw new Error('PDF has no readable pages');
    if (pdf.numPages > maxPages) throw new Error(`PDF has ${pdf.numPages} pages; the limit is ${maxPages}`);
    const extracted = await pdfAdapter.extractText(pdf, { mergePages: false });
    const embeddedPages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    const pages = [];
    let documentCharacters = 0;
    let ocrPages = 0;
    let truncated = false;

    for (let index = 0; index < pdf.numPages; index += 1) {
      throwIfAborted(signal);
      const pageNumber = index + 1;
      let markdown = normalizePageMarkdown(embeddedPages[index]);
      let extractionMethod = 'text';
      if (visibleCharacterCount(markdown) < MIN_EMBEDDED_TEXT_CHARACTERS) {
        if (ocrPages >= maxOcrPages) {
          warnings.push(`Page ${pageNumber} needs OCR but the ${maxOcrPages}-page OCR limit was reached.`);
        } else if (!ocrUnavailable) {
          try {
            if (!ocrWorker) {
              ocrWorker = await withDeadline(createOcrWorker(), {
                signal,
                timeoutMs: OCR_PAGE_TIMEOUT_MS,
                timeoutMessage: 'The local OCR engine did not start in time',
              });
            }
            const image = await renderBoundedPage(pdf, pageNumber, pdfAdapter);
            const recognition = await withDeadline(ocrWorker.recognize(Buffer.from(image)), {
              signal,
              timeoutMs: OCR_PAGE_TIMEOUT_MS,
              timeoutMessage: `OCR timed out on page ${pageNumber}`,
              onStop: () => { void ocrWorker?.terminate(); },
            });
            markdown = normalizePageMarkdown(recognition?.data?.text);
            extractionMethod = 'ocr';
            ocrPages += 1;
          } catch (error) {
            if (signal?.aborted || error?.name === 'AbortError') throw error;
            ocrUnavailable = true;
            warnings.push(`Page ${pageNumber} OCR failed: ${boundedText(error?.message ?? error, 300)}`);
            await ocrWorker?.terminate().catch(() => {});
            ocrWorker = undefined;
          }
        }
      }

      if (markdown.length > MAX_PAGE_CHARACTERS) {
        markdown = `${markdown.slice(0, MAX_PAGE_CHARACTERS).trimEnd()}\n\n[Page content truncated by Fikr]`;
        truncated = true;
      }
      const remaining = MAX_DOCUMENT_CHARACTERS - documentCharacters;
      if (remaining <= 0) {
        warnings.push(`Pages after ${pageNumber - 1} were omitted because the extracted document reached Fikr's context limit.`);
        truncated = true;
        break;
      }
      if (markdown.length > remaining) {
        markdown = `${markdown.slice(0, Math.max(0, remaining - 38)).trimEnd()}\n\n[Document content truncated by Fikr]`;
        truncated = true;
      }
      documentCharacters += markdown.length;
      pages.push({
        citation: `D${citationIndex}:p.${pageNumber}`,
        pageNumber,
        extractionMethod,
        characterCount: markdown.length,
        markdown,
      });
      if (documentCharacters >= MAX_DOCUMENT_CHARACTERS) break;
    }

    const document = {
      citationPrefix: `D${citationIndex}`,
      attachmentId,
      name,
      mediaType: 'application/pdf',
      totalPages: pdf.numPages,
      extractedPages: pages.length,
      ocrPages,
      truncated,
      warnings,
      pages,
      markdown: pages.map((page) => `## Page ${page.pageNumber}\n\n${page.markdown || '[No readable text found]'}`).join('\n\n'),
    };
    return document;
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    const message = boundedText(error?.message ?? error, 500);
    if (/password/i.test(message)) throw new Error('Password-protected PDFs are not supported');
    throw new Error(`Fikr could not extract ${name}: ${message || 'Unknown PDF error'}`);
  } finally {
    await ocrWorker?.terminate().catch(() => {});
    await pdf?.loadingTask?.destroy?.().catch(() => {});
  }
}

module.exports = {
  MAX_DOCUMENT_CHARACTERS,
  MAX_OCR_PAGES,
  MAX_PDF_PAGES,
  createBundledEnglishOcrWorker,
  documentPageMetadata,
  extractPdfDocument,
  normalizePageMarkdown,
  unpackedAsarPath,
};

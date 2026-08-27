const test = require('node:test');
const assert = require('node:assert/strict');
const { createCanvas } = require('@napi-rs/canvas');

const {
  createBundledEnglishOcrWorker,
  extractPdfDocument,
  normalizePageMarkdown,
  unpackedAsarPath,
} = require('../lib/document-extractor');

function pdfString(value) {
  return String(value).replace(/([\\()])/g, '\\$1');
}

function textPdf(pageTexts) {
  const objects = new Map();
  const pageIds = pageTexts.map((_, index) => 4 + index * 2);
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pageTexts.forEach((text, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const content = `BT /F1 18 Tf 72 720 Td (${pdfString(text)}) Tj ET`;
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  });

  const maxId = Math.max(...objects.keys());
  const chunks = [Buffer.from('%PDF-1.4\n%Fikr\n', 'binary')];
  const offsets = new Array(maxId + 1).fill(0);
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = chunks.reduce((total, chunk) => total + chunk.length, 0);
    chunks.push(Buffer.from(`${id} 0 obj\n${objects.get(id)}\nendobj\n`, 'binary'));
  }
  const xrefOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const xref = [
    `xref\n0 ${maxId + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join('');
  chunks.push(Buffer.from(xref, 'binary'));
  return Buffer.concat(chunks);
}

function pdfAttachment(bytes, overrides = {}) {
  return {
    id: 'document-1',
    name: 'report.pdf',
    kind: 'pdf',
    mediaType: 'application/pdf',
    dataUrl: `data:application/pdf;base64,${bytes.toString('base64')}`,
    ...overrides,
  };
}

test('extracts real PDF text per page and preserves stable page citations', async () => {
  const result = await extractPdfDocument(pdfAttachment(textPdf([
    'Fikr document extraction preserves page one provenance for reliable answers.',
    'Page two contains the implementation plan and production verification checklist.',
  ])), { citationIndex: 2, maxOcrPages: 0 });

  assert.equal(result.citationPrefix, 'D2');
  assert.equal(result.totalPages, 2);
  assert.deepEqual(result.pages.map((page) => page.citation), ['D2:p.1', 'D2:p.2']);
  assert.deepEqual(result.pages.map((page) => page.extractionMethod), ['text', 'text']);
  assert.match(result.pages[0].markdown, /page one provenance/);
  assert.match(result.pages[1].markdown, /production verificatio/);
  assert.match(result.markdown, /## Page 1/);
  assert.equal(result.ocrPages, 0);
});

test('runs OCR only for text-poor pages and reuses one bounded worker', async () => {
  let renderedPages = 0;
  let recognizedPages = 0;
  let terminated = 0;
  const pdf = { numPages: 2, getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }) }), loadingTask: { destroy: async () => {} } };
  const result = await extractPdfDocument(pdfAttachment(textPdf(['stub'])), {
    citationIndex: 1,
    pdfAdapter: {
      getDocumentProxy: async () => pdf,
      extractText: async () => ({ totalPages: 2, text: [
        'This page already has enough embedded text to avoid unnecessary optical character recognition.',
        '',
      ] }),
      renderPageAsImage: async (_pdf, pageNumber) => {
        renderedPages += 1;
        assert.equal(pageNumber, 2);
        return Buffer.from('png');
      },
    },
    createOcrWorker: async () => ({
      recognize: async () => {
        recognizedPages += 1;
        return { data: { text: 'Scanned release report recovered locally with OCR.' } };
      },
      terminate: async () => { terminated += 1; },
    }),
  });

  assert.equal(renderedPages, 1);
  assert.equal(recognizedPages, 1);
  assert.equal(terminated, 1);
  assert.equal(result.ocrPages, 1);
  assert.equal(result.pages[0].extractionMethod, 'text');
  assert.equal(result.pages[1].extractionMethod, 'ocr');
  assert.match(result.pages[1].markdown, /recovered locally/);
});

test('bundled English OCR reads a rendered page without network access', { timeout: 40_000 }, async () => {
  const canvas = createCanvas(1200, 280);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'black';
  context.font = 'bold 68px Arial';
  context.fillText('FIKR OCR REPORT 2026', 55, 165);
  const worker = await createBundledEnglishOcrWorker();
  try {
    const result = await worker.recognize(await canvas.encode('png'));
    assert.match(result.data.text, /FIKR OCR REPORT 2026/i);
  } finally {
    await worker.terminate();
  }
});

test('rejects malformed PDFs and normalizes extracted Markdown safely', async () => {
  await assert.rejects(
    () => extractPdfDocument(pdfAttachment(Buffer.from('%PDF-not-a-document')), { maxOcrPages: 0 }),
    /Fikr could not extract report\.pdf/,
  );
  assert.equal(normalizePageMarkdown('one\r\n\r\n\r\n two\u0000'), 'one\n\n two');
  assert.equal(unpackedAsarPath('/Applications/Fikr.app/Contents/Resources/app.asar/node_modules/tool'), '/Applications/Fikr.app/Contents/Resources/app.asar.unpacked/node_modules/tool');
});

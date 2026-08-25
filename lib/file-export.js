const MAX_TEXT_EXPORT_BYTES = 32 * 1024 * 1024;
const SAFE_TEXT_EXPORT_NAME = /^[^/\\\0]{1,180}\.(fikrdata|md|json|txt)$/i;
const SAFE_BINARY_EXPORT_NAME = /^[^/\\\0]{1,180}\.png$/i;

function normalizeTextExport(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid export request');
  }

  const filename = typeof payload.filename === 'string' ? payload.filename.trim() : '';
  const content = typeof payload.content === 'string' ? payload.content : null;
  if (!SAFE_TEXT_EXPORT_NAME.test(filename) || content === null) {
    throw new Error('Invalid export request');
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_EXPORT_BYTES) {
    throw new Error('Export exceeds 32 MB');
  }

  const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return { filename, content, extension };
}

function normalizeBase64Export(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid export request');
  }
  const filename = typeof payload.filename === 'string' ? payload.filename.trim() : '';
  const base64 = typeof payload.base64 === 'string' ? payload.base64.trim() : '';
  if (!SAFE_BINARY_EXPORT_NAME.test(filename) || !base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('Invalid export request');
  }
  const content = Buffer.from(base64, 'base64');
  if (content.length > MAX_TEXT_EXPORT_BYTES) throw new Error('Export exceeds 32 MB');
  return { filename, content, extension: 'png' };
}

module.exports = {
  MAX_TEXT_EXPORT_BYTES,
  normalizeBase64Export,
  normalizeTextExport,
};

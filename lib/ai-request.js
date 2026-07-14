const PROVIDER_URLS = Object.freeze({
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
});

const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

function validateAiRequest(provider, body) {
  if (!Object.hasOwn(PROVIDER_URLS, provider)) throw new Error('Unsupported AI provider');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid AI request body');
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_REQUEST_BYTES) throw new Error('AI request exceeds 1 MB');
  if (typeof body.model !== 'string' || !body.model.trim() || body.model.length > 300) throw new Error('Invalid AI model');
  return body;
}

async function performAiRequest({ provider, body, apiKey, fetchImpl = fetch, timeoutMs = 60_000 }) {
  validateAiRequest(provider, body);
  if (typeof apiKey !== 'string' || !apiKey) throw new Error('No API key configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://fikr.one';
      headers['X-Title'] = 'Fikr Studio';
    }
    const response = await fetchImpl(PROVIDER_URLS[provider], {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const responseBody = await response.text();
    if (Buffer.byteLength(responseBody, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('AI response exceeds 5 MB');
    return { ok: response.ok, status: response.status, body: responseBody };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES, PROVIDER_URLS, performAiRequest, validateAiRequest };

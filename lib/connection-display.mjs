const MASKED_LOCAL_TOKEN = "••••••••";

export function maskLocalMcpText(value, token) {
  const text = String(value ?? "");
  const secret = String(token ?? "");
  if (!secret) return text;
  return text.split(encodeURIComponent(secret)).join(MASKED_LOCAL_TOKEN).split(secret).join(MASKED_LOCAL_TOKEN);
}

export function actionableIpcError(error, fallback) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const cleaned = raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  if (/SdkError|version negotiation|fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(cleaned)) {
    return `${fallback.replace(/[.!?]+$/, "")}. Check the URL and make sure the server is running.`;
  }
  return cleaned || fallback;
}

export { MASKED_LOCAL_TOKEN };

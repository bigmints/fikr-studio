import type { AIProvider } from './ai-settings';

export async function requestByokAi(provider: AIProvider, body: Record<string, unknown>): Promise<Response> {
  const ipc = typeof window !== 'undefined' ? (window as any).fikrStudio : null;
  if (!ipc?.requestAi) throw new Error('Secure AI requests require the Fikr Studio desktop app');
  const result = await ipc.requestAi(provider, body) as { ok: boolean; status: number; body: string };
  return new Response(result.body, {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

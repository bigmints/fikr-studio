export async function writeClipboardText(text: string): Promise<void> {
  const ipc = typeof window !== "undefined" ? (window as any).fikrStudio : null;
  if (ipc?.writeClipboardText) {
    await ipc.writeClipboardText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

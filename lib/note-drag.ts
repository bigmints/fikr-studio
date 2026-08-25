export const NOTE_DRAG_MIME = "application/x-fikr-note-ids";

export function decodeDraggedNoteIds(payload: string): string[] {
  if (!payload) return [];

  try {
    const value = JSON.parse(payload);
    if (!Array.isArray(value)) return [];

    return Array.from(new Set(
      value
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 500),
    ));
  } catch {
    return [];
  }
}

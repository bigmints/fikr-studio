export function makeExportFilename(name, extension, fallback = "export") {
  const safeExtension = String(extension || "").toLowerCase();
  if (!/^[a-z0-9]+$/.test(safeExtension)) throw new Error("A safe export extension is required");

  const slug = String(name || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return `${slug || fallback}.${safeExtension}`;
}

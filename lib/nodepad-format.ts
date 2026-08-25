/**
 * .fikrdata file format — full-fidelity project serialisation.
 *
 * A .fikrdata file is a JSON object with a version field so future schema
 * changes can be handled gracefully. The file contains the complete project
 * state: blocks (with all AI annotations, connections, confidence scores,
 * sub-tasks), collapsed IDs, ghost notes history, and enough context for
 * the AI enrichment pipeline to continue seamlessly on re-import.
 *
 * Transient UI fields (isEnriching, isError, statusText) are stripped on
 * export and reset to safe defaults on import.
 */

import { makeExportFilename } from "./export-filename.mjs"

import type { ContentType } from "./content-types"

export const NODEPAD_FILE_VERSION = 1 as const

// ── Serialised types ──────────────────────────────────────────────────────────

export interface NodepadBlock {
  id: string
  text: string
  timestamp: number
  contentType: ContentType
  category?: string
  annotation?: string
  confidence?: number | null
  sources?: { url: string; title: string; siteName: string }[]
  influencedBy?: { id: string; type: string }[]        // typed edges
  isUnrelated?: boolean
  mergeSuggestion?: { targetId: string } | null
  isPinned?: boolean
  subTasks?: { id: string; text: string; isDone: boolean; timestamp: number }[]
}

export interface NodepadGhostNote {
  id: string
  text: string
  category: string
  isGenerating: boolean
}

export interface NodepadFile {
  version: typeof NODEPAD_FILE_VERSION
  exportedAt: number
  project: {
    id: string
    name: string
    blocks: NodepadBlock[]
    collapsedIds: string[]
    ghostNotes: NodepadGhostNote[]
    lastGhostTexts?: string[]
    lastGhostBlockCount?: number
    lastGhostTimestamp?: number
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

/** Serialise a project to a NodepadFile, stripping transient UI state. */
export function serialiseProject(project: {
  id: string
  name: string
  blocks: any[]
  collapsedIds: string[]
  ghostNotes?: any[]
  lastGhostTexts?: string[]
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
}): NodepadFile {
  return {
    version: NODEPAD_FILE_VERSION,
    exportedAt: Date.now(),
    project: {
      id: project.id,
      name: project.name,
      collapsedIds: project.collapsedIds ?? [],
      ghostNotes: (project.ghostNotes ?? []).map((g: any) => ({
        id: g.id,
        text: g.text,
        category: g.category,
        isGenerating: false,          // never persist a generating state
      })),
      lastGhostTexts: project.lastGhostTexts,
      lastGhostBlockCount: project.lastGhostBlockCount,
      lastGhostTimestamp: project.lastGhostTimestamp,
      blocks: project.blocks.map((b: any): NodepadBlock => ({
        id:           b.id,
        text:         b.text,
        timestamp:    b.timestamp,
        contentType:  b.contentType,
        ...(b.category     !== undefined && { category:    b.category }),
        ...(b.annotation   !== undefined && { annotation:  b.annotation }),
        ...(b.confidence   !== undefined && { confidence:  b.confidence }),
        ...(b.sources      !== undefined && { sources:     b.sources }),
        ...(b.influencedBy !== undefined && { 
          influencedBy: (b.influencedBy as any[]).map(edge => typeof edge === 'string' ? { id: edge, type: 'related' } : edge) 
        }),
        ...(b.isUnrelated  !== undefined && { isUnrelated:  b.isUnrelated }),
        ...(b.isPinned                   && { isPinned:     b.isPinned }),
        ...(b.subTasks?.length           && { subTasks:     b.subTasks }),
        ...(b.mergeSuggestion !== undefined && { mergeSuggestion: b.mergeSuggestion }),
      })),
    },
  }
}

type ElectronTextFileBridge = {
  saveTextFile?: (filename: string, content: string) => Promise<{ saved: boolean; canceled: boolean }>;
};

/** Save a .fikrdata file without navigating the Electron renderer. */
export async function downloadNodepadFile(project: {
  id: string; name: string; blocks: any[]; collapsedIds: string[]
  ghostNotes?: any[]; lastGhostTexts?: string[]
  lastGhostBlockCount?: number; lastGhostTimestamp?: number
}): Promise<boolean> {
  const data = serialiseProject(project)
  const content = JSON.stringify(data, null, 2)
  const filename = makeExportFilename(project.name, "fikrdata", "project")
  const bridge = typeof window !== "undefined"
    ? (window as unknown as { fikrStudio?: ElectronTextFileBridge }).fikrStudio
    : undefined
  if (bridge?.saveTextFile) {
    const result = await bridge.saveTextFile(filename, content)
    return result.saved
  }

  const blob = new Blob([content], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}

// ── Import ────────────────────────────────────────────────────────────────────

export class NodepadParseError extends Error {}

/**
 * Parse a .fikrdata file string and return a project object ready to push
 * into the projects list. Always assigns a fresh ID so there are no
 * collisions. Name conflicts get a copy suffix: "My Research (2)".
 */
export function parseNodepadFile(
  raw: string,
  existingNames: string[],
): {
  id: string
  name: string
  blocks: any[]
  collapsedIds: string[]
  ghostNotes: any[]
  lastGhostTexts?: string[]
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
} {
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    throw new NodepadParseError("Not a valid .fikrdata file — JSON parse failed.")
  }

  if (!data || typeof data !== "object") {
    throw new NodepadParseError("Not a valid .fikrdata file — unexpected root type.")
  }
  if (!data.project || !Array.isArray(data.project.blocks)) {
    throw new NodepadParseError("Not a valid .fikrdata file — missing project.blocks array.")
  }

  const src = data.project

  // Deduplicate name — always "Name (2)", "Name (3)", …
  let name = (src.name as string) || "Imported Project"
  if (existingNames.includes(name)) {
    let n = 2
    while (existingNames.includes(`${name} (${n})`)) n++
    name = `${name} (${n})`
  }

  return {
    id:           Math.random().toString(36).substring(2, 10),
    name,
    blocks:       (src.blocks as any[]).map(b => ({
      ...b,
      isEnriching: false,
      isError:     false,
      statusText:  undefined,
    })),
    collapsedIds: Array.isArray(src.collapsedIds) ? src.collapsedIds : [],
    ghostNotes:   Array.isArray(src.ghostNotes)   ? src.ghostNotes   : [],
    lastGhostTexts:       src.lastGhostTexts,
    lastGhostBlockCount:  src.lastGhostBlockCount,
    lastGhostTimestamp:   src.lastGhostTimestamp,
  }
}

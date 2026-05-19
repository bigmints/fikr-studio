"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { SearchProvider } from "@/lib/search-store";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Sparkles, Mic, Video, FileText } from "lucide-react";
import { TilingArea } from "@/components/tiling-area";
import { ListArea } from "@/components/list-area";
import { GraphArea } from "@/components/graph-area";
import { ProjectSidebar } from "@/components/project-sidebar";
import { SettingsPage, type SettingsSection } from "@/components/settings-page";
import { StatusBar } from "@/components/status-bar";
import { GhostPanel, type GhostNote } from "@/components/ghost-panel";
import { VimInput } from "@/components/vim-input";
import { IntroModal } from "@/components/intro-modal";
import { useSearchEffect } from "@/components/search-panel";
import { SearchModal } from "@/components/search-modal";
import { TileCard, type TextBlock } from "@/components/tile-card";
import { NoteDetailPanel } from "@/components/note-detail-panel";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";

function GlobalSearchEngine({ projects }: { projects: any[] }) {
  useSearchEffect({ projects });
  return null;
}
import { StudioRoot } from "@/components/studio/studio-root";
import { ConnectionsPage } from "@/components/connections-page";
import { INITIAL_PROJECTS } from "@/lib/initial-data";
import { useAISettings } from "@/lib/ai-settings";
import { enrichBlockClient } from "@/lib/ai-enrich";
import { generateGhostClient } from "@/lib/ai-ghost";
import { vectorIndex, VectorIndex } from "@/lib/vector-index";
import {
  exportToMarkdown,
  downloadMarkdown,
  copyToClipboard,
} from "@/lib/export";
import {
  downloadNodepadFile,
  parseNodepadFile,
  NodepadParseError,
} from "@/lib/nodepad-format";
import { detectContentType } from "@/lib/detect-content-type";
import { analytics } from "@/lib/analytics";
import { limitWords } from "@/lib/utils";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export interface Project {
  id: string;
  name: string;
  blocks: TextBlock[];
  collapsedIds: string[];
  ghostNotes: GhostNote[];
  lastGhostBlockCount?: number;
  lastGhostTimestamp?: number;
  /** Texts of recently generated ghost notes — passed back to the API to prevent near-duplicates */
  lastGhostTexts?: string[];
}

import { TileIndex } from "@/components/tile-index";
import { type WordUsage } from "@/components/status-bar";

export default function Page() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [studioProjects, setStudioProjects] = useState<any[]>([]);
  const [activeStudioProjectId, setActiveStudioProjectId] = useState<string>("");
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(
    null,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [isGhostPanelOpen, setIsGhostPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"tiling" | "list" | "graph">(
    "list",
  );

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [jumpToSettings, setJumpToSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("account");

  // ── Auth + usage polling ─────────────────────────────────────────────────
  const [cloudIdToken, setCloudIdToken] = useState<string | null>(null);
  const [cloudPlan, setCloudPlan] = useState<string>("Free");
  const [cloudRelayKey, setCloudRelayKey] = useState<string>("");
  const [wordUsage, setWordUsage] = useState<WordUsage | null>(null);
  const usagePollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWordUsage = useCallback(async (token: string) => {
    try {
      const res = await fetch("https://www.fikr.one/api/user/usage", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.wordsLimit > 0) {
        setWordUsage({
          wordsUsed: data.wordsUsed,
          wordsLimit: data.wordsLimit,
          percentUsed: data.percentUsed,
          plan: data.plan,
        });
      }
    } catch {
      // silently fail — usage is non-critical
    }
  }, []);

  // Handle auth changes from SettingsModal → start/stop polling
  const handleAuthChange = useCallback(
    (user: any, idToken: string | null, plan: string, relayKey?: string) => {
      if (relayKey !== undefined) setCloudRelayKey(relayKey);
      setCloudIdToken(idToken);
      setCloudPlan(plan);
      // ── Send UID + ID token to main process so Firestore sync can fire ─────
      if (typeof window !== "undefined" && (window as any).fikrStudio?.setUser) {
        (window as any).fikrStudio.setUser(user?.uid ?? null, idToken ?? null);
      }
      if (usagePollRef.current) clearInterval(usagePollRef.current);
      if (idToken && (plan.toLowerCase().includes("plus") || plan.toLowerCase().includes("pro"))) {
        fetchWordUsage(idToken);
        usagePollRef.current = setInterval(() => fetchWordUsage(idToken), 5 * 60 * 1000);
      } else {
        setWordUsage(null);
      }
    },
    [fetchWordUsage],
  );

  // Cleanup poll on unmount
  useEffect(() => () => { if (usagePollRef.current) clearInterval(usagePollRef.current); }, []);

  const handleWordCountClick = useCallback(() => {
    const url = "https://fikr.one/dashboard/billing";
    if (typeof window !== "undefined" && (window as any).fikrStudio?.openUrl) {
      (window as any).fikrStudio.openUrl(url);
    } else {
      window.open(url, "_blank");
    }
  }, []);


  const openSettings = (section: SettingsSection) => {
    setSettingsSection(section);
    setSettingsOpen(true);
  };
  const [mcpPort, setMcpPort] = useState<number | null>(null);
  const [activeApp, setActiveApp] = useState("Fikr Intel");
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const helpTooltipTimer = useRef<NodeJS.Timeout | null>(null);
  const {
    settings,
    updateSettings,
    resolvedModelId,
    currentModel,
    isHydrated,
  } = useAISettings();
  const debounceTimers = useRef<Record<string, Record<string, NodeJS.Timeout>>>(
    {},
  );
  const enrichBlockRef = useRef<any>(null);

  // ── Undo history ring (max 20 block snapshots per project) ───────────────
  const blockHistoryRef = useRef<Record<string, TextBlock[][]>>({});
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const undoToastTimer = useRef<NodeJS.Timeout | null>(null);

  const pushHistory = useCallback(
    (projectId: string, currentBlocks: TextBlock[]) => {
      if (!blockHistoryRef.current[projectId])
        blockHistoryRef.current[projectId] = [];
      const stack = blockHistoryRef.current[projectId];
      stack.push(currentBlocks.map((b) => ({ ...b })));
      if (stack.length > 20) stack.shift();
    },
    [],
  );

  const showUndoToast = useCallback((msg: string) => {
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current);
    setUndoToast(msg);
    undoToastTimer.current = setTimeout(() => setUndoToast(null), 2200);
  }, []);

  // Clean up undo toast timer on unmount
  useEffect(
    () => () => {
      if (undoToastTimer.current) clearTimeout(undoToastTimer.current);
    },
    [],
  );

  // ── Intro modal ──────────────────────────────────────────────────────────
  const handleIntroClose = useCallback(() => {
    analytics.track("intro_close");
    setIsIntroOpen(false);
    // Persist intro-seen via IPC in Electron, fall back to localStorage in browser
    if (typeof window !== "undefined" && (window as any).fikrStudio) {
      (window as any).fikrStudio.setIntroSeen();
    } else {
      localStorage.setItem("nodepad-intro-seen", "true");
    }
    // Show the help tooltip for 6 seconds pointing to the ? button
    setShowHelpTooltip(true);
    if (helpTooltipTimer.current) clearTimeout(helpTooltipTimer.current);
    helpTooltipTimer.current = setTimeout(
      () => setShowHelpTooltip(false),
      6000,
    );
  }, []);

  useEffect(
    () => () => {
      if (helpTooltipTimer.current) clearTimeout(helpTooltipTimer.current);
    },
    [],
  );

  const undo = useCallback(() => {
    const stack = blockHistoryRef.current[activeProjectId];
    if (!stack || stack.length === 0) {
      showUndoToast("Nothing to undo");
      return;
    }
    analytics.track("note_undo");
    const previousBlocks = stack.pop()!;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId ? { ...p, blocks: previousBlocks } : p,
      ),
    );
    showUndoToast("↩ Undone");
  }, [activeProjectId, showUndoToast]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId],
  );

  const blocks = activeProject?.blocks || [];
  const ghostNotes = activeProject?.ghostNotes || [];

  const updateActiveProject = useCallback(
    (updater: (p: Project) => Project) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProjectId ? updater(p) : p)),
      );
    },
    [activeProjectId],
  );

  // Clear debounce timers for the previous project when switching
  const prevActiveProjectId = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevActiveProjectId.current;
    if (prev && prev !== activeProjectId && debounceTimers.current[prev]) {
      Object.values(debounceTimers.current[prev]).forEach(clearTimeout);
      delete debounceTimers.current[prev];
    }
    prevActiveProjectId.current = activeProjectId;
  }, [activeProjectId]);

  // 1. Persistence: Initial Load & Migration
  //    In Electron: reads from ~/.fikr-studio/workspace.json via IPC bridge
  //    In browser:  falls back to localStorage (dev mode)
  useEffect(() => {
    const ipc = typeof window !== "undefined" && (window as any).fikrStudio;

    const init = async () => {
      let initialProjects: Project[] = [];
      let initialActiveId = "";
      let introSeen: boolean;
      let diskData: any = null;

      if (ipc) {
        // ── Electron path ──────────────────────────────────────────────────────
        diskData = await ipc.loadProjects();
        introSeen = await ipc.getIntroSeen();
        if (diskData && diskData.projects && diskData.projects.length > 0) {
          initialProjects = diskData.projects;
          initialActiveId =
            diskData.activeProjectId || diskData.projects[0]?.id || "";
        }
      } else {
        // ── Browser / localStorage fallback ───────────────────────────────────
        const savedProjects = localStorage.getItem("nodepad-projects");
        const savedActiveId = localStorage.getItem("nodepad-active-project");
        const oldBlocks = localStorage.getItem("nodepad-blocks");
        const oldCollapsed = localStorage.getItem("nodepad-collapsed");
        const backupProjects = localStorage.getItem("nodepad-backup");
        introSeen = !!localStorage.getItem("nodepad-intro-seen");

        if (savedProjects) {
          try {
            initialProjects = JSON.parse(savedProjects);
            initialActiveId = savedActiveId || initialProjects[0]?.id || "";
          } catch (e) {
            console.error("Failed to parse saved projects — trying backup", e);
          }
        }
        if (initialProjects.length === 0 && backupProjects) {
          try {
            initialProjects = JSON.parse(backupProjects);
            initialActiveId = initialProjects[0]?.id || "";
          } catch (e) {
            console.error("Backup restore also failed", e);
          }
        }
        if (initialProjects.length === 0 && oldBlocks) {
          try {
            const blks = JSON.parse(oldBlocks);
            const collapsed = oldCollapsed ? JSON.parse(oldCollapsed) : [];
            initialProjects = [
              {
                id: "default",
                name: "Default Space",
                blocks: blks,
                collapsedIds: collapsed,
                ghostNotes: [],
              },
            ];
            initialActiveId = "default";
          } catch (e) {
            console.error("Migration failed", e);
          }
        }
      }

      if (initialProjects.length === 0) {
        initialProjects = INITIAL_PROJECTS;
        initialActiveId = INITIAL_PROJECTS[0].id;
      }

      // Sanitize loaded state to clear any stuck "in-progress" flags
      // from a previous session that may have been interrupted.
      const sanitizedProjects = initialProjects.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) => ({
          ...b,
          isEnriching: false,
          isError: false,
          statusText: undefined,
        })),
        ghostNotes: (p.ghostNotes || []).map((g) => ({
          ...g,
          isGenerating: false,
          isError: false,
          statusText: undefined,
        })),
      }));

      setProjects(sanitizedProjects);
      setActiveProjectId(initialActiveId);
      setIsLoaded(true);

      // Load studio projects — in Electron use diskData (same workspace.json),
      // fall back to localStorage in browser mode.
      try {
        if (ipc && diskData?.studioProjects?.length > 0) {
          // Electron path: already loaded from disk above
          const reset = diskData.studioProjects.map((p: any) =>
            p.status === "generating"
              ? { ...p, status: "error", outputMarkdown: undefined, error: "Generation was interrupted. Click Retry to regenerate." }
              : p
          );
          setStudioProjects(reset);
          setActiveStudioProjectId("");
        } else if (!ipc) {
          // Browser fallback
          const savedStudio = localStorage.getItem("fikr-studio-projects");
          if (savedStudio) {
            const parsed = JSON.parse(savedStudio);
            const reset = parsed.map((p: any) =>
              p.status === "generating"
                ? { ...p, status: "error", outputMarkdown: undefined, error: "Generation was interrupted. Click Retry to regenerate." }
                : p
            );
            setStudioProjects(reset);
            localStorage.setItem("fikr-studio-projects", JSON.stringify(reset));
            setActiveStudioProjectId("");
          }
        }
      } catch (e) {
        console.error("Failed to load studio projects", e);
      }


      if (ipc && ipc.getMcpPort) {
        ipc
          .getMcpPort()
          .then((port: number) => setMcpPort(port))
          .catch(console.error);
      }

      if (!introSeen) setIsIntroOpen(true);
    };

    init();
  }, []);

  // 2. Persistence: Save on Change
  //    In Electron: saves to ~/.fikr-studio/workspace.json via IPC
  //    In browser:  saves to localStorage
  //    NOTE: always include studioProjects so Studio articles are not lost when
  //    an Intel canvas change triggers a save before saveWorkspace is called.
  useEffect(() => {
    if (!isLoaded) return;
    const ipc = typeof window !== "undefined" && (window as any).fikrStudio;
    if (ipc) {
      ipc.saveProjects({
        projects,
        activeProjectId,
        studioProjects: studioProjectsRef.current,
        activeStudioProjectId,
      });
    } else {
      localStorage.setItem("nodepad-projects", JSON.stringify(projects));
      localStorage.setItem("nodepad-active-project", activeProjectId);
      try {
        localStorage.setItem("nodepad-backup", JSON.stringify(projects));
      } catch {
        /* quota exceeded — skip silently */
      }
    }
  }, [projects, activeProjectId, activeStudioProjectId, isLoaded]);

  // 3. MCP Live Events — listen for notes/projects pushed by external AI agents
  useEffect(() => {
    const ipc = typeof window !== "undefined" && (window as any).fikrStudio;
    if (!ipc) return;

    const cleanup = ipc.onExternalEvent(
      (event: { type: string; payload: any }) => {
        if (event.type === "note-added") {
          const { projectId, note } = event.payload;
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId ? { ...p, blocks: [...p.blocks, note] } : p,
            ),
          );
          // Only auto-enrich raw MCP notes. Pre-synthesized notes (fromSkill)
          // arrive with isEnriching:false + full annotation — skip the LLM pass.
          if (note.fromMcp && !note.fromSkill && enrichBlockRef.current) {
            setTimeout(
              () => enrichBlockRef.current(projectId, note.id, note.text),
              100,
            );
          }
        } else if (event.type === "note-deleted") {
          const { projectId, noteId } = event.payload;
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? { ...p, blocks: p.blocks.filter((b) => b.id !== noteId) }
                : p,
            ),
          );
        } else if (event.type === "note-updated") {
          const { projectId, note } = event.payload;
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    blocks: p.blocks.map((b) =>
                      b.id === note.id
                        ? {
                            ...b,
                            text: note.text,
                            contentType: note.contentType,
                            category: note.category,
                            annotation: note.annotation,
                            isEnriching: false,
                          }
                        : b,
                    ),
                  }
                : p,
            ),
          );
        } else if (event.type === "project-created") {
          const { project } = event.payload;
          setProjects((prev) => [...prev, project]);
        } else if (event.type === "workspace-synced") {
          // Main process pushed a fresh workspace from Firestore after sign-in.
          // Replace local state with cloud data. studioProjects are only replaced
          // if the cloud has them (main.js preserves local disk data otherwise).
          const workspace = event.payload;
          if (workspace?.projects?.length > 0) {
            setProjects(workspace.projects);
            if (workspace.activeProjectId) {
              setActiveProjectId(workspace.activeProjectId);
            }
          }
          if (workspace?.studioProjects?.length > 0) {
            setStudioProjects(workspace.studioProjects);
          }
        } else if (event.type === "workspace-cleared") {
          // User chose "Clear everything" during logout.
          // Reset to a blank slate so no data bleeds into the logged-out session.
          setProjects(INITIAL_PROJECTS);
          setActiveProjectId(INITIAL_PROJECTS[0]?.id ?? "");
          setStudioProjects([]);
          setActiveStudioProjectId("");
          localStorage.removeItem("fikr-studio-projects");
          localStorage.removeItem("nodepad-projects");
          localStorage.removeItem("nodepad-active-project");
          localStorage.removeItem("nodepad-backup");
        }
      },
    );

    return cleanup;
  }, []);

  // Hidden file input for .nodepad import — triggered from sidebar or ⌘K
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const raw = ev.target?.result as string;
          const names = projectsRef.current.map((p) => p.name);
          const imported = parseNodepadFile(raw, names) as Project;
          analytics.track("import_file_success", { file: file.name, project: imported.id });
          setProjects((prev) => [...prev, imported]);
          setActiveProjectId(imported.id);
          setIsSidebarOpen(false);
        } catch (err) {
          if (err instanceof NodepadParseError) {
            alert(err.message);
          } else {
            alert(
              "Could not import file — make sure it's a valid .nodepad file.",
            );
          }
        }
      };
      reader.readAsText(file);
      // Reset input so the same file can be re-imported if needed
      e.target.value = "";
    },
    [],
  );

  const handleCreateStudioProject = useCallback(() => {
    const id = generateId();
    const newProj = {
      id,
      name: "New Article",
      mode: "article",
      platform: "linkedin",
      status: "ideating",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setStudioProjects((prev) => [newProj, ...prev]);
    setActiveStudioProjectId(id);
    
    // Save to IPC/localStorage
    if (typeof window !== "undefined" && (window as any).fikrStudio) {
      (window as any).fikrStudio.saveWorkspace({
        projects,
        activeProjectId,
        studioProjects: [newProj, ...studioProjects],
        activeStudioProjectId: id
      });
    } else {
      localStorage.setItem("fikr-studio-projects", JSON.stringify([newProj, ...studioProjects]));
    }
  }, [projects, activeProjectId, studioProjects]);

  // A ref to read current projects without causing re-renders or stale closures
  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // Keep a ref to studioProjects for use in async callbacks that outlive renders
  const studioProjectsRef = useRef(studioProjects);
  useEffect(() => {
    studioProjectsRef.current = studioProjects;
  }, [studioProjects]);

  // Persist studioProjects helper (always available at page level)
  const persistStudio = useCallback((updated: any[]) => {
    if (typeof window !== "undefined" && (window as any).fikrStudio?.saveWorkspace) {
      (window as any).fikrStudio.saveWorkspace({
        projects: projectsRef.current,
        activeProjectId,
        studioProjects: updated,
        activeStudioProjectId,
      });
    } else {
      localStorage.setItem("fikr-studio-projects", JSON.stringify(updated));
    }
  }, [activeProjectId, activeStudioProjectId]);

  // ── Article version management ────────────────────────────────────────────
  const MAX_VERSIONS = typeof window !== "undefined" && (window as any).fikrStudio ? 30 : 10;

  const saveArticleVersion = useCallback((
    projectId: string,
    label: string,
    markdown: string,
    isManual: boolean,
  ) => {
    if (!markdown?.trim()) return;
    const version: import("@/lib/generate/types").ArticleVersion = {
      id: generateId(),
      label,
      savedAt: Date.now(),
      markdown,
      wordCount: markdown.trim().split(/\s+/).filter(Boolean).length,
      isManual,
    };
    setStudioProjects((prev: any[]) => {
      const updated = prev.map((p: any) => {
        if (p.id !== projectId) return p;
        const existing: import("@/lib/generate/types").ArticleVersion[] = p.versions ?? [];
        const next = [...existing, version];
        // Cap: evict oldest non-manual first, then oldest manual
        while (next.length > MAX_VERSIONS) {
          const dropIdx = next.findIndex((v) => !v.isManual);
          next.splice(dropIdx !== -1 ? dropIdx : 0, 1);
        }
        return { ...p, versions: next };
      });
      persistStudio(updated);
      return updated;
    });
  }, [persistStudio, MAX_VERSIONS]);

  const revertToVersion = useCallback((
    projectId: string,
    versionId: string,
    currentMarkdown: string,
  ) => {
    setStudioProjects((prev: any[]) => {
      const updated = prev.map((p: any) => {
        if (p.id !== projectId) return p;
        const target = (p.versions ?? []).find(
          (v: import("@/lib/generate/types").ArticleVersion) => v.id === versionId,
        );
        if (!target) return p;
        // Snapshot current state before reverting so user can always undo the revert
        const snapshot: import("@/lib/generate/types").ArticleVersion = {
          id: generateId(),
          label: "Before revert",
          savedAt: Date.now(),
          markdown: currentMarkdown,
          wordCount: currentMarkdown.trim().split(/\s+/).filter(Boolean).length,
          isManual: false,
        };
        const versions = [...(p.versions ?? []), snapshot];
        while (versions.length > MAX_VERSIONS) {
          const dropIdx = versions.findIndex((v: import("@/lib/generate/types").ArticleVersion) => !v.isManual);
          versions.splice(dropIdx !== -1 ? dropIdx : 0, 1);
        }
        return { ...p, outputMarkdown: target.markdown, versions, updatedAt: Date.now() };
      });
      persistStudio(updated);
      return updated;
    });
  }, [persistStudio, MAX_VERSIONS]);

  /**
   * Background generation — lives at page level so it survives mode switching.
   * Called by StudioRoot when the user clicks Generate.
   */
  const handleStudioGenerate = useCallback(async (
    projectId: string,
    params: import("@/lib/generate/types").GenerateParams,
    projectName: string,
  ) => {
    console.log("[Studio] handleStudioGenerate called", { projectId, projectName, params });
    const { streamGenerate } = await import("@/lib/generate/generate-stream");

    let outputMarkdown = "";
    let flushBuffer = "";
    const FLUSH_EVERY = 150; // flush to state every ~150 chars for streaming feel
    try {
      console.log("[Studio] calling streamGenerate...");
      const result = await streamGenerate(
        params,
        (chunk) => {
          outputMarkdown += chunk;
          flushBuffer   += chunk;
          if (flushBuffer.length >= FLUSH_EVERY) {
            flushBuffer = "";
            const snap = outputMarkdown;
            setStudioProjects((prev) => prev.map((p: any) =>
              p.id === projectId ? { ...p, outputMarkdown: snap } : p
            ));
          }
        },
        new AbortController().signal,
      );
      console.log("[Studio] streamGenerate done, length:", outputMarkdown.length);

      setStudioProjects((prev) => {
        const updated = prev.map((p: any) => {
          if (p.id !== projectId) return p;
          
          let finalName = p.name;
          if (outputMarkdown) {
            const match = outputMarkdown.match(/^#\s+(.+)$/m);
            if (match && match[1]) {
              finalName = match[1].trim();
            }
          }

          // Auto-snapshot "Generated" version
          const genVersion: import("@/lib/generate/types").ArticleVersion = {
            id: generateId(),
            label: "Generated",
            savedAt: Date.now(),
            markdown: outputMarkdown,
            wordCount: outputMarkdown.trim().split(/\s+/).filter(Boolean).length,
            isManual: false,
          };
          const existingVersions: import("@/lib/generate/types").ArticleVersion[] = p.versions ?? [];
          const nextVersions = [...existingVersions, genVersion];
          const maxV = typeof window !== "undefined" && (window as any).fikrStudio ? 30 : 10;
          while (nextVersions.length > maxV) {
            const dropIdx = nextVersions.findIndex((v: import("@/lib/generate/types").ArticleVersion) => !v.isManual);
            nextVersions.splice(dropIdx !== -1 ? dropIdx : 0, 1);
          }

          return { 
            ...p, 
            name: limitWords(finalName, 3),
            status: "done", 
            outputMarkdown, 
            citations: result.citations,
            systemPrompt: result.systemPrompt,
            updatedAt: Date.now(),
            versions: nextVersions,
          };
        });
        persistStudio(updated);
        return updated;
      });

      setUndoToast(`"${projectName}" is ready — open Studio to read it`);
      if (undoToastTimer.current) clearTimeout(undoToastTimer.current);
      undoToastTimer.current = setTimeout(() => setUndoToast(null), 6000);

    } catch (err: unknown) {
      const isAbort = (err as { name?: string })?.name === "AbortError";
      const msg = isAbort ? "The generation timed out after 90 seconds. Try a simpler prompt or check your local model server." : (err instanceof Error ? err.message : "Unknown error");
      console.error("[Studio] streamGenerate error:", msg);

      setStudioProjects((prev) => {
        const updated = prev.map((p: any) =>
          p.id === projectId ? { ...p, status: "error", error: msg, updatedAt: Date.now() } : p,
        );
        persistStudio(updated);
        return updated;
      });

      setUndoToast(`Generation failed: ${msg}`);
      if (undoToastTimer.current) clearTimeout(undoToastTimer.current);
      undoToastTimer.current = setTimeout(() => setUndoToast(null), 6000);
    }
  }, [persistStudio]);


  // Stable ref to active blocks — lets useCallbacks read current blocks without
  // listing `blocks` in their deps (which would recreate them on every state change
  // and cause all memo-ized TileCards to re-render unnecessarily).
  const blocksRef = useRef<TextBlock[]>([]);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Tracks which project IDs currently have a ghost generation in-flight
  const generatingRef = useRef<Set<string>>(new Set());

  /**
   * Builds a recency-biased, category-diverse context window for ghost generation.
   * Strategy:
   *   1. Always include the 4 most recently added blocks (freshest thinking).
   *   2. Then add the single most-recent block from every category not yet represented.
   *   3. Fill remaining slots (up to 10 total) with the next most-recent blocks.
   * This forces the model to see cross-category material rather than a wall of the
   * dominant theme.
   */
  function buildGhostContext(enrichedBlocks: TextBlock[]) {
    if (enrichedBlocks.length <= 8) return enrichedBlocks;

    const sorted = [...enrichedBlocks].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
    const selected = new Set<string>();
    const result: TextBlock[] = [];

    // Step 1 — most recent 4
    sorted.slice(0, 4).forEach((b) => {
      selected.add(b.id);
      result.push(b);
    });

    // Step 2 — one representative per missing category
    const representedCats = new Set(result.map((b) => b.category));
    const byCat = new Map<string, TextBlock>();
    sorted.forEach((b) => {
      if (b.category && !byCat.has(b.category)) byCat.set(b.category, b);
    });
    for (const [cat, block] of byCat) {
      if (result.length >= 10) break;
      if (!representedCats.has(cat) && !selected.has(block.id)) {
        selected.add(block.id);
        result.push(block);
        representedCats.add(cat);
      }
    }

    // Step 3 — fill to 10 with remaining recent blocks
    for (const b of sorted) {
      if (result.length >= 10) break;
      if (!selected.has(b.id)) {
        selected.add(b.id);
        result.push(b);
      }
    }

    return result;
  }

  const generateGhostNote = useCallback(
    async (projectId: string, retryGhostId?: string) => {
      const targetProject = projectsRef.current.find((p) => p.id === projectId);

      if (!targetProject) return;

      // Require at least 5 enriched blocks
      const enrichedBlocks = targetProject.blocks.filter(
        (b) => !b.isEnriching && b.category,
      );
      if (enrichedBlocks.length < 5) return;

      // No concurrent generation for this project
      if (generatingRef.current.has(projectId)) return;

      // If NOT retrying, enforce generation limits
      if (!retryGhostId) {
        // Cap panel at 5 ghost notes
        if ((targetProject.ghostNotes || []).length >= 5) return;

        // Require at least 5 new blocks since last generation
        const lastCount = targetProject.lastGhostBlockCount || 0;
        if (enrichedBlocks.length < lastCount + 5) return;

        // Require at least 5 minutes since last generation
        const lastTime = targetProject.lastGhostTimestamp || 0;
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - lastTime < fiveMinutes) return;

        // Require at least 2 distinct categories (meaningful diversity)
        const categories = new Set(
          enrichedBlocks.map((b) => b.category).filter(Boolean),
        );
        if (categories.size < 2) return;
      }

      analytics.track("ghost_generate", { project: projectId, retry: !!retryGhostId });
      generatingRef.current.add(projectId);
      const ghostId = retryGhostId || "ghost-" + generateId();

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;

          let updatedGhostNotes = p.ghostNotes || [];
          if (retryGhostId) {
            updatedGhostNotes = updatedGhostNotes.map((n) =>
              n.id === retryGhostId
                ? {
                    ...n,
                    isGenerating: true,
                    isError: false,
                    statusText: undefined,
                  }
                : n,
            );
          } else {
            updatedGhostNotes = [
              ...updatedGhostNotes,
              {
                id: ghostId,
                text: "",
                category: "thesis",
                isGenerating: true,
              },
            ];
          }

          return {
            ...p,
            ghostNotes: updatedGhostNotes,
            lastGhostBlockCount: enrichedBlocks.length,
            lastGhostTimestamp: Date.now(),
          };
        }),
      );

      try {
        const curated = buildGhostContext(enrichedBlocks);
        const context = curated.map((b) => ({
          text: b.text,
          category: b.category,
          contentType: b.contentType,
        }));

        // Pass the last 5 generated ghost texts so the model can avoid near-duplicates
        const previousSyntheses = (targetProject.lastGhostTexts || []).slice(
          -5,
        );

        const data = await generateGhostClient(context, previousSyntheses);
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              ghostNotes: (p.ghostNotes || []).map((n) =>
                n.id === ghostId
                  ? {
                      ...n,
                      text: data.text,
                      category: data.category,
                      isGenerating: false,
                    }
                  : n,
              ),
              // Accumulate ghost texts for dedup (keep last 10)
              lastGhostTexts: [...(p.lastGhostTexts || []), data.text].slice(
                -10,
              ),
            };
          }),
        );
        
        // Index the ghost note
        try {
          const indexText = vectorIndex.constructor.prototype.constructor.buildIndexText({ text: data.text, contentType: "thesis", category: data.category });
          await vectorIndex.add(ghostId, projectId, indexText, "thesis", 90);
        } catch(e) {}
      } catch (e: any) {
        console.error("Ghost note generation failed", e);
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  ghostNotes: (p.ghostNotes || []).map((n) =>
                    n.id === ghostId
                      ? {
                          ...n,
                          isGenerating: false,
                          isError: true,
                          statusText:
                            e instanceof Error
                              ? e.message
                              : "Generation failed",
                        }
                      : n,
                  ),
                }
              : p,
          ),
        );
      } finally {
        generatingRef.current.delete(projectId);
      }
    },
    [],
  );

  const enrichBlock = useCallback(
    async (
      projectId: string,
      id: string,
      text: string,
      category?: string,
      forcedType?: string,
      retryCount: number = 0,
      isReEnrich: boolean = false,
    ) => {
      // Read context directly from the ref — avoids wrapping in setProjects() which
      // React StrictMode double-invokes in development, causing two concurrent
      // enrichment requests and a visible category flicker.
      const targetProject = projectsRef.current.find((p) => p.id === projectId);
      if (!targetProject) return;

      const context = targetProject.blocks
        .filter((b) => b.id !== id && !b.isEnriching)
        .map((b) => ({
          id: b.id,
          text: b.text,
          category: b.category,
          annotation: b.annotation,
        }))
        .slice(-15);

      try {
        const data = await enrichBlockClient(
          text,
          context.map(({ id, ...rest }) => ({ id, ...rest })),
          forcedType,
          category,
          id, // stable block ID for the per-block in-flight guard
        );

        const mergeTargetIdx = data.mergeWithIndex;
        const mergeTargetId =
          mergeTargetIdx !== null && context[mergeTargetIdx]
            ? context[mergeTargetIdx].id
            : null;

        // Map indices back to stable block IDs and typed edges
        const influencedBy = data.influencedBy
          ? data.influencedBy
              .filter((item: any) => context[item.index])
              .map((item: any) => ({ id: context[item.index].id, type: item.relationship }))
          : [];

        setProjects((current: Project[]) => {
          return current.map((proj) => {
            if (proj.id !== projectId) return proj;

            // Task-merge is only applied to brand-new notes, never to re-enrichments.
            // Re-enriching an existing note that gets reclassified as "task" should
            // update it in-place — not delete it from the block list (which would
            // cause the detail panel to lose its reference and show "No synthesis").
            if (data.contentType === "task" && !isReEnrich) {
              const existingTaskIndex = proj.blocks.findIndex(
                (b) => b.contentType === "task" && b.id !== id,
              );
              if (existingTaskIndex !== -1) {
                const existingTask = proj.blocks[existingTaskIndex];
                const newSubTask = {
                  id: Math.random().toString(36).substring(2, 9),
                  text: text,
                  isDone: false,
                  timestamp: Date.now(),
                };
                return {
                  ...proj,
                  blocks: proj.blocks
                    .filter((b) => b.id !== id)
                    .map((b) =>
                      b.id === existingTask.id
                        ? {
                            ...b,
                            subTasks: [...(b.subTasks || []), newSubTask],
                            isEnriching: false,
                            statusText: undefined,
                          }
                        : b,
                    ),
                };
              } else {
                return {
                  ...proj,
                  blocks: proj.blocks.map((b) =>
                    b.id === id
                      ? {
                          ...b,
                          contentType: "task",
                          category: "Tasks",
                          subTasks: [
                            {
                              id: Math.random().toString(36).substring(2, 9),
                              text: text,
                              isDone: false,
                              timestamp: Date.now(),
                            },
                          ],
                          isEnriching: false,
                          statusText: undefined,
                          isError: false,
                        }
                      : b,
                  ),
                };
              }
            }

            return {
              ...proj,
              blocks: proj.blocks.map((b) =>
                b.id === id
                  ? {
                      ...b,
                      contentType: data.contentType,
                      category: data.category,
                      title: data.title,
                      annotation: data.annotation,
                      confidence: data.confidence,
                      influencedBy,
                      isUnrelated: data.isUnrelated,
                      sources: data.sources ?? undefined,
                      isEnriching: false,
                      statusText: undefined,
                      isError: false,
                      mergeSuggestion: mergeTargetId ? { targetId: mergeTargetId } : undefined,
                    }
                  : b,
              ),
            };
          });
        });

        // Index the note block asynchronously
        try {
          const indexText = VectorIndex.buildIndexText({ 
            text, 
            title: data.title,
            annotation: data.annotation,
            contentType: data.contentType, 
            category: data.category 
          });
          await vectorIndex.add(id, projectId, indexText, data.contentType, data.confidence || 90);
        } catch(e) {}

        // Similarity check asynchronously to suggest merges
        if (!mergeTargetId) {
          try {
            const results = await vectorIndex.search(text, 1);
            if (results.length > 0 && results[0].score > 0.85 && results[0].blockId !== id) {
              setProjects((current) => current.map(p => p.id === projectId ? {
                ...p,
                blocks: p.blocks.map(b => b.id === id ? { ...b, mergeSuggestion: { targetId: results[0].blockId } } : b)
              } : p));
            }
          } catch(e) {}
        }

        setTimeout(() => generateGhostNote(projectId), 2500);
      } catch (e: any) {
        console.warn(e);
        const isAbort = e?.name === "AbortError" || e?.message?.includes("abort") || false;
        
        // If it's an abort, it was explicitly cancelled by a newer request or timeout. Do not mutate state here.
        if (isAbort) return;

        const isNoKey = e?.message?.includes("No API key configured") || false;
        const isNetworkError =
          e?.message?.toLowerCase().includes("fetch") ||
          e?.message?.toLowerCase().includes("network");

        // Auto retry mechanism (up to 2 retries)
        if (!isNoKey && retryCount < 2) {
          const backoff = 2000 * Math.pow(2, retryCount); // 2s, 4s
          console.log(`[Enrichment] Retrying block ${id} in ${backoff}ms (attempt ${retryCount + 1}/2)...`);
          setTimeout(() => {
            enrichBlock(projectId, id, text, category, forcedType, retryCount + 1);
          }, backoff);
          return;
        }

        const errorStatus = isNoKey
          ? "no-api-key"
          : isNetworkError
            ? "Connection failed. Ensure your AI server is running and accessible."
            : e instanceof Error
              ? e.message
              : "Enrichment failed.";
        setProjects((current: Project[]) =>
          current.map((proj) =>
            proj.id === projectId
              ? {
                  ...proj,
                  blocks: proj.blocks.map((b) =>
                    b.id === id
                      ? {
                          ...b,
                          isEnriching: false,
                          isError: true,
                          statusText: errorStatus,
                        }
                      : b,
                  ),
                }
              : proj,
          ),
        );
      }
    },
    [generateGhostNote],
  );

  useEffect(() => {
    enrichBlockRef.current = enrichBlock;
  }, [enrichBlock]);

  const claimGhostNote = useCallback(
    (id: string) => {
      analytics.track("ghost_claim", { ghostId: id });
      const note = (activeProject?.ghostNotes || []).find((n) => n.id === id);
      if (!note || note.isGenerating) return;
      const newId = generateId();
      const { text, category } = note;

      updateActiveProject((p) => {
        const updatedProject = {
          ...p,
          blocks: [
            ...p.blocks,
            {
              id: newId,
              text,
              timestamp: Date.now(),
              contentType: "thesis" as ContentType,
              category,
              annotation: text, // The ghost note text IS the synthesis
              isEnriching: false,
            },
          ],
          ghostNotes: (p.ghostNotes || []).filter((n) => n.id !== id),
        };
        return updatedProject;
      });

      // Index claimed thesis note
      try {
        const indexText = VectorIndex.buildIndexText({ text, contentType: "thesis", category });
        vectorIndex.add(newId, activeProjectId, indexText, "thesis", 95).catch(() => {});
      } catch(e) {}

      // Trigger a fresh ghost note pass after claiming
      setTimeout(() => generateGhostNote(activeProjectId), 1000);
    },
    [activeProject, activeProjectId, updateActiveProject, generateGhostNote],
  );

  const dismissGhostNote = useCallback(
    (id: string) => {
      analytics.track("ghost_dismiss", { ghostId: id });
      updateActiveProject((p) => ({
        ...p,
        ghostNotes: (p.ghostNotes || []).filter((n) => n.id !== id),
      }));
    },
    [updateActiveProject],
  );

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsMenuOpen((prev) => !prev);
      }
      if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        // Don't intercept while typing in an input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          undo();
        }
      }
      if (e.key === "Escape") {
        if (isMenuOpen) {
          setIsMenuOpen(false);
        } else if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (isGhostPanelOpen) {
          setIsGhostPanelOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [isMenuOpen, isSearchOpen, isGhostPanelOpen, undo]);

  // List view keyboard navigation
  useEffect(() => {
    if (viewMode !== "list" || !activeProject?.blocks?.length) return;

    const handleListKeys = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        
        const sorted = [...activeProject.blocks].sort(
          (a, b) => b.timestamp - a.timestamp
        );
        const currentIndex = highlightedBlockId 
          ? sorted.findIndex(b => b.id === highlightedBlockId) 
          : -1;
        
        const nextIndex = e.key === "ArrowDown"
          ? (currentIndex < sorted.length - 1 ? currentIndex + 1 : 0)
          : (currentIndex > 0 ? currentIndex - 1 : sorted.length - 1);
        
        const nextId = sorted[nextIndex].id;
        setHighlightedBlockId(nextId);
        
        // Keep sidebar in sync if it is open
        if (selectedNoteId) {
          setSelectedNoteId(nextId);
        }

        // Auto-scroll
        const el = document.getElementById(`tile-${nextId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }

      if (e.key === "Enter" && highlightedBlockId && !selectedNoteId) {
        e.preventDefault();
        setSelectedNoteId(highlightedBlockId);
      }
    };

    window.addEventListener("keydown", handleListKeys);
    return () => window.removeEventListener("keydown", handleListKeys);
  }, [viewMode, activeProject?.blocks, highlightedBlockId, selectedNoteId]);

  const addBlock = useCallback(
    (text: string, forcedType?: ContentType) => {
      // Parse inline #type tag  e.g. "#claim The earth is 4.5 billion years old"
      let resolvedText = text;
      let resolvedType = forcedType;

      if (!resolvedType) {
        const tagMatch = text.match(/^#([a-z]+)\s+(.+)/i);
        if (tagMatch) {
          const tag = tagMatch[1].toLowerCase() as ContentType;
          const ALL_TYPES: ContentType[] = [
            "entity",
            "claim",
            "question",
            "task",
            "idea",
            "reference",
            "quote",
            "definition",
            "opinion",
            "reflection",
            "narrative",
            "comparison",
            "thesis",
            "general",
          ];
          if (ALL_TYPES.includes(tag)) {
            resolvedType = tag;
            resolvedText = tagMatch[2].trim();
          }
        }
      }

      const newId = generateId();

      // Types where the heuristic is syntactically unambiguous — the AI is also
      // sent forcedType so it won't reclassify them.  We can show these types
      // immediately because they will never change after enrichment.
      const heuristicType = resolvedType ?? detectContentType(resolvedText);
      const HIGH_CONFIDENCE_TYPES = new Set<ContentType>([
        "question",
        "reference",
        "quote",
        "task",
      ]);
      const enrichForcedType =
        resolvedType ??
        (HIGH_CONFIDENCE_TYPES.has(heuristicType) ? heuristicType : undefined);

      // For ambiguous types (claim, idea, reflection, …) the AI may return a
      // different classification, so start as "general" during enrichment to
      // avoid a jarring double-classification jump in the UI.
      const initialDisplayType: ContentType =
        resolvedType ??
        (HIGH_CONFIDENCE_TYPES.has(heuristicType) ? heuristicType : "general");

      analytics.track("note_add", { type: initialDisplayType, project: activeProjectId });
      pushHistory(activeProjectId, blocksRef.current);
      updateActiveProject((p) => ({
        ...p,
        blocks: [
          ...p.blocks,
          {
            id: newId,
            text: resolvedText,
            timestamp: Date.now(),
            contentType: initialDisplayType,
            isEnriching: true,
          },
        ],
      }));


      enrichBlock(
        activeProjectId,
        newId,
        resolvedText,
        undefined,
        enrichForcedType,
      ).catch(console.error);
    },
    [activeProjectId, pushHistory, updateActiveProject, enrichBlock],
  );

  const deleteBlock = useCallback(
    (id: string) => {
      analytics.track("note_delete", { blockId: id, project: activeProjectId });
      pushHistory(activeProjectId, blocksRef.current);
      updateActiveProject((p) => ({
        ...p,
        blocks: p.blocks.filter((b) => b.id !== id),
      }));
    },
    [activeProjectId, pushHistory, updateActiveProject],
  );

  const editBlock = useCallback(
    (id: string, newText: string) => {
      analytics.track("note_edit", { blockId: id, project: activeProjectId });
      // Snapshot before the edit so Cmd+Z restores the original text
      const currentProj = projectsRef.current.find(
        (p) => p.id === activeProjectId,
      );
      if (currentProj) {
        const currentBlock = currentProj.blocks.find((b) => b.id === id);
        if (currentBlock && currentBlock.text !== newText) {
          pushHistory(activeProjectId, currentProj.blocks);
        }
      }

      setProjects((prev) => {
        const proj = prev.find((p) => p.id === activeProjectId);
        if (!proj) return prev;
        const block = proj.blocks.find((b) => b.id === id);
        if (!block || block.text === newText) return prev;

        if (!debounceTimers.current[activeProjectId]) {
          debounceTimers.current[activeProjectId] = {};
        }

        if (debounceTimers.current[activeProjectId][id]) {
          clearTimeout(debounceTimers.current[activeProjectId][id]);
        }

        debounceTimers.current[activeProjectId][id] = setTimeout(() => {
          enrichBlock(
            activeProjectId, 
            id, 
            newText, 
            block.category, 
            block.contentType
          ).catch(console.error);
          delete debounceTimers.current[activeProjectId][id];
        }, 800);

        return prev.map((p) =>
          p.id === activeProjectId
            ? {
                ...p,
                blocks: p.blocks.map((b) =>
                  b.id === id
                    ? { ...b, text: newText, isEnriching: true, isError: false }
                    : b,
                ),
              }
            : p,
        );
      });
    },
    [activeProjectId, enrichBlock, pushHistory],
  );

  const reEnrichBlock = useCallback(
    (id: string, newCategory?: string) => {
      analytics.track("note_re_enrich", { blockId: id });
      const block = blocksRef.current.find((b) => b.id === id);
      if (!block) return;

      // Preserve the existing category if no new one is provided — avoids
      // a brief flicker where the category pill goes blank during enrichment.
      const resolvedCategory = newCategory ?? block.category;

      updateActiveProject((p) => ({
        ...p,
        blocks: p.blocks.map((b) =>
          b.id === id ? { ...b, category: resolvedCategory, isEnriching: true } : b,
        ),
      }));

      enrichBlock(
        activeProjectId,
        id,
        block.text,
        resolvedCategory,
        block.contentType,
        0,
        true, // isReEnrich — prevents task-merge from deleting the block
      ).catch(console.error);
    },
    [activeProjectId, updateActiveProject, enrichBlock],
  );

  const editAnnotation = useCallback(
    (id: string, newAnnotation: string) => {
      analytics.track("note_edit_annotation", { blockId: id });
      updateActiveProject((p) => ({
        ...p,
        blocks: p.blocks.map((b) =>
          b.id === id ? { ...b, annotation: newAnnotation } : b,
        ),
      }));
    },
    [updateActiveProject],
  );

  const toggleCollapse = useCallback(
    (id: string) => {
      analytics.track("note_toggle_collapse", { blockId: id });
      updateActiveProject((p) => {
        const next = new Set(p.collapsedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { ...p, collapsedIds: [...next] };
      });
    },
    [updateActiveProject],
  );

  const handleTogglePin = useCallback(
    (id: string) => {
      analytics.track("note_toggle_pin", { blockId: id });
      setProjects((current) =>
        current.map((p) =>
          p.id === activeProjectId
            ? {
                ...p,
                blocks: p.blocks.map((b) =>
                  b.id === id ? { ...b, isPinned: !b.isPinned } : b,
                ),
              }
            : p,
        ),
      );
    },
    [activeProjectId],
  );

  const handleToggleSubTask = useCallback(
    (blockId: string, subTaskId: string) => {
      analytics.track("note_toggle_subtask", { blockId });
      setProjects((current) =>
        current.map((p) =>
          p.id === activeProjectId
            ? {
                ...p,
                blocks: p.blocks.map((b) =>
                  b.id === blockId
                    ? {
                        ...b,
                        subTasks: b.subTasks?.map((st) =>
                          st.id === subTaskId
                            ? { ...st, isDone: !st.isDone }
                            : st,
                        ),
                      }
                    : b,
                ),
              }
            : p,
        ),
      );
    },
    [activeProjectId],
  );

  const handleDeleteSubTask = useCallback(
    (blockId: string, subTaskId: string) => {
      analytics.track("note_delete_subtask", { blockId });
      setProjects((current) =>
        current.map((p) =>
          p.id === activeProjectId
            ? {
                ...p,
                blocks: p.blocks.map((b) =>
                  b.id === blockId
                    ? {
                        ...b,
                        subTasks: b.subTasks?.filter(
                          (st) => st.id !== subTaskId,
                        ),
                      }
                    : b,
                ),
              }
            : p,
        ),
      );
    },
    [activeProjectId],
  );

  const handleChangeType = useCallback(
    (id: string, newType: ContentType) => {
      analytics.track("note_change_type", { blockId: id, type: newType });
      const block = blocksRef.current.find((b) => b.id === id);
      if (!block) return;
      pushHistory(activeProjectId, blocksRef.current);
      updateActiveProject((p) => ({
        ...p,
        blocks: p.blocks.map((b) =>
          b.id === id ? { ...b, contentType: newType, isEnriching: true } : b,
        ),
      }));
      enrichBlock(
        activeProjectId,
        id,
        block.text,
        block.category,
        newType,
        0,
        true, // isReEnrich — prevents task-merge from deleting the block
      ).catch(console.error);
    },
    [activeProjectId, pushHistory, updateActiveProject, enrichBlock],
  );

  const clearBlocks = useCallback(() => {
    analytics.track("project_clear_all", { project: activeProjectId });
    pushHistory(activeProjectId, blocksRef.current);
    updateActiveProject((p) => ({ ...p, blocks: [], collapsedIds: [] }));
  }, [activeProjectId, pushHistory, updateActiveProject]);

  const mergeBlocks = useCallback((sourceId: string, targetId: string) => {
    analytics.track("note_merge", { sourceId, targetId });
    pushHistory(activeProjectId, blocksRef.current);
    updateActiveProject((p) => {
      const source = p.blocks.find(b => b.id === sourceId);
      const target = p.blocks.find(b => b.id === targetId);
      if (!source || !target) return p;
      return {
        ...p,
        blocks: p.blocks
          .filter(b => b.id !== sourceId)
          .map(b => b.id === targetId ? {
            ...b,
            text: b.text + "\n\n" + source.text,
          } : b)
      };
    });
  }, [activeProjectId, pushHistory, updateActiveProject]);

  const dismissMerge = useCallback((id: string) => {
    analytics.track("note_dismiss_merge", { blockId: id });
    updateActiveProject((p) => ({
      ...p,
      blocks: p.blocks.map(b => b.id === id ? { ...b, mergeSuggestion: undefined } : b)
    }));
  }, [updateActiveProject]);

  const createProject = useCallback(() => {
    analytics.track("project_create");
    const newProject: Project = {
      id: generateId(),
      name: "New Space",
      blocks: [],
      collapsedIds: [],
      ghostNotes: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
  }, []);

  const renameProject = useCallback((id: string, newName: string) => {
    analytics.track("project_rename", { projectId: id });
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p)),
    );
  }, []);

  const deleteProject = useCallback(
    (id: string) => {
      analytics.track("project_delete", { projectId: id });
      setProjects((prev) => {
        if (prev.length <= 1) return prev;
        const nextProjects = prev.filter((p) => p.id !== id);
        if (activeProjectId === id) {
          setActiveProjectId(nextProjects[0].id);
        }
        return nextProjects;
      });
    },
    [activeProjectId],
  );

  const handleCommand = useCallback(
    (cmd: string, text?: string) => {
      // Handle view switches
      if (cmd === "tiling") {
        analytics.track("view_switch", { mode: "tiling" });
        setViewMode("tiling");
      } else if (cmd === "list") {
        analytics.track("view_switch", { mode: "list" });
        setViewMode("list");
      } else if (cmd === "open-projects") {
        setIsGhostPanelOpen(false);
        setIsIndexOpen(false);
        setIsSidebarOpen((prev) => !prev);
      } else if (cmd === "new-project") {
        setIsGhostPanelOpen(false);
        setIsIndexOpen(false);
        setIsSidebarOpen(true);
        createProject();
      } else if (cmd === "clear") clearBlocks();
      // .fikrdata export / import
      else if (cmd === "export-fikrdata") {
        analytics.track("export_nodepad", { project: activeProjectId });
        setProjects((prev) => {
          const proj = prev.find((p) => p.id === activeProjectId);
          if (proj) downloadNodepadFile(proj);
          return prev;
        });
      } else if (cmd === "import-fikrdata") {
        analytics.track("import_file");
        importInputRef.current?.click();
      }

      // Handle type overrides
      else if (cmd === "task" && text) addBlock(text, "task");
      else if (cmd === "thesis" && text) addBlock(text, "thesis");

    },
    [clearBlocks, addBlock, activeProjectId],
  );

  return (
    <SearchProvider>
      <GlobalSearchEngine projects={projects} />
      <div className="flex h-dvh overflow-hidden bg-background">
        {/* Hidden file input for .fikrdata import */}
        <input
          ref={importInputRef}
          type="file"
          accept=".fikrdata,.json"
          className="hidden"
          onChange={handleImportFile}
        />

         <ProjectSidebar
           isOpen={isSidebarOpen}
           onClose={() => setIsSidebarOpen(false)}
           projects={projects}
           activeProjectId={activeProjectId}
           onSelectProject={(id) => {
             analytics.track("project_select", { projectId: id });
             setActiveProjectId(id);
           }}
           onCreateProject={createProject}
           onRenameProject={renameProject}
           onDeleteProject={deleteProject}
           aiSettings={settings}
           onUpdateAISettings={updateSettings}
           openToSettings={jumpToSettings}
           onSettingsOpened={() => setJumpToSettings(false)}
           onOpenSettings={openSettings}
           mcpPort={mcpPort}
           activeApp={activeApp}
           setActiveApp={setActiveApp}
           studioProjects={studioProjects}
           activeStudioProjectId={activeStudioProjectId}
           onSelectStudioProject={setActiveStudioProjectId}
           onCreateStudioProject={handleCreateStudioProject}
           activeStudioWordCount={(() => {
             const p = studioProjects.find((p: any) => p.id === activeStudioProjectId);
             const md = p?.outputMarkdown ?? "";
             return md ? md.trim().split(/\s+/).filter(Boolean).length : 0;
           })()}
         />

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* ── Shared toolbar — always visible in Fikr Intel ── */}
          {activeApp === "Fikr Intel" && (
            <StatusBar
              isGhostPanelOpen={isGhostPanelOpen}
            ghostNoteCount={ghostNotes.filter((n) => !n.isGenerating).length}
            activeProjectName={
              activeApp === "Fikr Intel"
                ? (activeProject?.name || "")
                : (studioProjects.find((p: any) => p.id === activeStudioProjectId)?.name || "")
            }
            viewMode={viewMode}
            onGhostPanelToggle={() => {
              analytics.track("ghost_panel_toggle");
              setIsGhostPanelOpen((prev) => !prev);
            }}
            onViewModeChange={(mode) => {
              analytics.track("view_switch", { mode });
              setViewMode(mode);
            }}
            onSearchClick={
              activeApp === "Fikr Intel"
                ? () => {
                    analytics.track("search_open");
                    setIsSearchOpen(true);
                  }
                : undefined
            }
            onImport={() => {
              analytics.track("import_file");
              importInputRef.current?.click();
            }}
            onExportFikrdata={() => handleCommand("export-fikrdata")}
            onOpenSettings={() => {
              analytics.track("settings_open");
              setIsSidebarOpen(true);
              setJumpToSettings(true);
            }}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            enrichingCount={activeApp === "Fikr Intel" ? blocks.filter((b) => b.isEnriching).length : 0}
            modelLabel={
              activeApp === "Fikr Intel" && isHydrated && settings.apiKey
                ? currentModel.shortLabel
                : undefined
            }
            wordUsage={wordUsage}
            onWordCountClick={handleWordCountClick}
          />
          )}

          {activeApp === "Connections" ? (
            <ConnectionsPage
              mcpPort={mcpPort}
              plan={cloudPlan}
              relayApiKey={cloudRelayKey}
            />
          ) : activeApp === "Fikr Intel" ? (
            <>

          {isHydrated && !settings.apiKey && !["plus", "pro"].some(t => cloudPlan.toLowerCase().includes(t)) && (
            <div className="px-3 py-2 border-b border-border shrink-0">
              <div
                role="alert"
                className="flex items-center justify-between gap-4 rounded-md border px-3.5 py-2.5 text-xs"
                style={{
                  borderColor: "color-mix(in oklch, #3CA6A6 35%, transparent)",
                  background: "color-mix(in oklch, #3CA6A6 8%, transparent)",
                  color: "var(--foreground)",
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#3CA6A6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <span className="text-foreground/80 leading-snug">
                    AI enrichment requires an API key to classify and annotate your notes.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href="https://fikr.one/pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all border cursor-pointer"
                    style={{
                      borderColor: "color-mix(in oklch, #3CA6A6 40%, transparent)",
                      color: "#3CA6A6",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "color-mix(in oklch, #3CA6A6 12%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                    }}
                  >
                    View plans
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                  </a>
                  <button
                    onClick={() => {
                      setIsSidebarOpen(true);
                      setJumpToSettings(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
                    style={{
                      background: "#3CA6A6",
                      color: "#ffffff",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                    }}
                  >
                    Add your key →
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-1 overflow-hidden relative">
            <main className="relative flex-1 overflow-hidden">
              {isLoaded ? (
                viewMode === "tiling" ? (
                  <TilingArea
                    key={`tiling-${activeProjectId}`}
                    blocks={activeProject.blocks}
                    collapsedIds={new Set(activeProject.collapsedIds)}
                    onDelete={deleteBlock}
                    onEdit={editBlock}
                    onEditAnnotation={editAnnotation}
                    onReEnrich={reEnrichBlock}
                    onChangeType={handleChangeType}
                    onToggleCollapse={toggleCollapse}
                    onTogglePin={handleTogglePin}
                    onToggleSubTask={handleToggleSubTask}
                    onDeleteSubTask={handleDeleteSubTask}
                    highlightedBlockId={highlightedBlockId}
                    onHighlight={setHighlightedBlockId}
                    selectedBlockId={selectedNoteId}
                    onOpenDetail={setSelectedNoteId}
                    onMerge={mergeBlocks}
                    onDismissMerge={dismissMerge}
                  />
                ) : viewMode === "graph" ? (
                  <GraphArea
                    key={`graph-${activeProjectId}`}
                    blocks={activeProject.blocks}
                    ghostNote={activeProject.ghostNotes?.[0]}
                    projectName={activeProject.name}
                    onReEnrich={reEnrichBlock}
                    onChangeType={handleChangeType}
                    onTogglePin={handleTogglePin}
                    onEdit={editBlock}
                    onEditAnnotation={editAnnotation}
                    highlightedBlockId={highlightedBlockId}
                    onHighlight={setHighlightedBlockId}
                    selectedBlockId={selectedNoteId}
                    onOpenDetail={setSelectedNoteId}
                  />
                ) : (
                  <ListArea
                    blocks={activeProject.blocks}
                    highlightedBlockId={highlightedBlockId}
                    onHighlight={setHighlightedBlockId}
                    selectedBlockId={selectedNoteId}
                    onOpenDetail={setSelectedNoteId}
                  />
                )
              ) : (
                <div className="h-full w-full" />
              )}
            </main>

            <GhostPanel
              ghostNotes={ghostNotes}
              isOpen={isGhostPanelOpen}
              onClose={() => setIsGhostPanelOpen(false)}
              onClaim={claimGhostNote}
              onDismiss={dismissGhostNote}
              onRetry={(id) => generateGhostNote(activeProjectId, id)}
            />
            
            <NoteDetailPanel
              block={selectedNoteId ? (activeProject?.blocks.find((b) => b.id === selectedNoteId) ?? null) : null}
              isOpen={!!selectedNoteId}
              onClose={() => { setSelectedNoteId(null); setHighlightedBlockId(null); }}
              onEdit={editBlock}
              onEditAnnotation={editAnnotation}
              onReEnrich={reEnrichBlock}
              onDelete={deleteBlock}
              onTogglePin={handleTogglePin}
              onChangeType={handleChangeType}
            />
          </div>

          {/* Undo toast */}
          <AnimatePresence>
            {undoToast && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-[130] pointer-events-none"
              >
                <div className="px-3 py-1.5 rounded-sm bg-card/95 border border-border/40 backdrop-blur-md shadow-xl">
                  <span className="font-mono text-[10px] text-foreground/70 tracking-tight whitespace-nowrap">
                    {undoToast}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

            <VimInput
              onSubmit={addBlock}
            />
          </>
        ) : (
          <StudioRoot
            studioProjects={studioProjects}
            setStudioProjects={setStudioProjects}
            intelBlocks={blocks}
            onHighlightNote={setHighlightedBlockId}
            activeProjectId={activeStudioProjectId}
            setActiveProjectId={setActiveStudioProjectId}
            onStartGeneration={handleStudioGenerate}
            onSaveVersion={saveArticleVersion}
            onRevertToVersion={revertToVersion}
            onPersist={persistStudio}
          />
        )}
        </div>

        <TileIndex
          blocks={blocks}
          onHighlight={setHighlightedBlockId}
          highlightedId={highlightedBlockId}
          onClose={() => setIsIndexOpen(false)}
          isOpen={isIndexOpen}
          viewMode={viewMode}
        />



        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          projects={projects}
          onSelectResult={(blockId, projectId) => {
            if (projectId !== activeProjectId) setActiveProjectId(projectId);
            setHighlightedBlockId(blockId);
            setSelectedNoteId(blockId);
            setIsSearchOpen(false);
          }}
        />

        {/* First-visit intro video modal */}
        <IntroModal open={isIntroOpen} onClose={handleIntroClose} />

        {/* Full-screen Settings Page */}
        <SettingsPage
          open={settingsOpen}
          initialSection={settingsSection}
          aiSettings={settings}
          onUpdateAISettings={updateSettings}
          mcpPort={mcpPort}
          onClose={() => setSettingsOpen(false)}
          onAuthChange={handleAuthChange}
        />
      </div>
    </SearchProvider>
  );
}

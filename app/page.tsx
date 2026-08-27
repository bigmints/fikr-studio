"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { SearchProvider } from "@/lib/search-store";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { LayoutGrid, Sparkles, Mic, Video, FileText } from "lucide-react";
import { TilingArea } from "@/components/tiling-area";
import { ListArea, type SortOption } from "@/components/list-area";
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
import { BulkActionPanel } from "@/components/bulk-action-panel";
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { isEditableShortcutTarget } from "@/lib/keyboard-shortcuts";
import { UpdateCheckIndicator } from "@/components/update-check-indicator";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { FikrChat } from "@/components/fikr-chat";
import { CreationsPage } from "@/components/creations-page";
import { type FikrSurface } from "@/components/project-sidebar";
import { type FikrArtifact, type FikrChatMemory, type FikrChatThread } from "@/lib/fikr-chat";
import { normalizeChatMemories } from "@/lib/chat-memory.mjs";
import {
  createCreationFromArtifact,
  creationMatchesArtifact,
  createKnowledgeNoteFromAnswer,
  normalizeChatThreads,
} from "@/lib/chat-domain.mjs";

function GlobalSearchEngine({ projects }: { projects: any[] }) {
  useSearchEffect({ projects });
  return null;
}
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
  const [chatThreads, setChatThreads] = useState<FikrChatThread[]>([]);
  const [chatMemories, setChatMemories] = useState<FikrChatMemory[]>([]);
  const [activeChatThreadId, setActiveChatThreadId] = useState<string | null>(null);
  const [activeStudioProjectId, setActiveStudioProjectId] = useState<string>("");
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(
    null,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  // Suppresses the save-on-change effect during cloud push (workspace-synced).
  // Without this, the effect would immediately re-upload the stale pre-sync state.
  const isSyncingFromCloud = useRef(false);
  // Persistence callbacks must observe the same collections React is about to
  // render. Keep these ref-sync effects ahead of the save-on-change effect so
  // the first hydrated render cannot write the initial empty arrays to disk.
  const projectsRef = useRef(projects);
  const studioProjectsRef = useRef(studioProjects);
  const chatThreadsRef = useRef(chatThreads);
  const chatMemoriesRef = useRef(chatMemories);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  useEffect(() => {
    studioProjectsRef.current = studioProjects;
  }, [studioProjects]);
  useEffect(() => {
    chatThreadsRef.current = chatThreads;
  }, [chatThreads]);
  useEffect(() => {
    chatMemoriesRef.current = chatMemories;
  }, [chatMemories]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [isGhostPanelOpen, setIsGhostPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"tiling" | "list" | "graph">(
    "list",
  );
  const [knowledgeSortBy, setKnowledgeSortBy] = useState<SortOption>("newest");

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false);
  const [newEntryOpenRequest, setNewEntryOpenRequest] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [isNoteSelectionMode, setIsNoteSelectionMode] = useState(false);
  const [jumpToSettings, setJumpToSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("account");

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setIsSidebarOpen(false);
    }
  }, []);

  // ── Auth + usage polling ─────────────────────────────────────────────────
  const [cloudIdToken, setCloudIdToken] = useState<string | null>(null);
  const [cloudPlan, setCloudPlan] = useState<string>("Free");
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [wordUsage, setWordUsage] = useState<WordUsage | null>(null);
  const usagePollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWordUsage = useCallback(async (token: string) => {
    try {
      let data;
      if (typeof window !== "undefined" && (window as any).fikrStudio?.getUsage) {
        data = await (window as any).fikrStudio.getUsage();
      } else {
        // Fallback for non-Electron contexts (if any)
        const res = await fetch("https://fikr.one/api/user/usage", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        data = await res.json();
      }
      
      if (data && data.wordsLimit !== undefined) {
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
    (user: any, idToken: string | null, plan: string) => {
      setCloudIdToken(idToken);
      setCloudPlan(plan);
      setIsAuthResolved(true);
      // Send only the ID token; main verifies identity and plan through fikr.one.
      if (typeof window !== "undefined" && (window as any).fikrStudio?.setUser) {
        (window as any).fikrStudio.setUser(user?.uid ?? null, idToken ?? null);
      }
      if (usagePollRef.current) clearInterval(usagePollRef.current);
      if (idToken) {
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
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [activeSurface, setActiveSurface] = useState<FikrSurface>("Chat");
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
  const showApiKeyBanner = isAuthResolved
    && isHydrated
    && !settings.apiKey
    && !["plus", "pro"].some((tier) => cloudPlan.toLowerCase().includes(tier));
  const isLaunchReady = isLoaded && isHydrated && isAuthResolved;
  const debounceTimers = useRef<Record<string, Record<string, NodeJS.Timeout>>>(
    {},
  );
  const enrichBlockRef = useRef<any>(null);

  // ── Undo history ring (max 20 block snapshots per project) ───────────────
  const blockHistoryRef = useRef<Record<string, TextBlock[][]>>({});

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
    toast(msg);
  }, []);

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

  const blocks = useMemo(() => activeProject?.blocks || [], [activeProject?.blocks]);
  const ghostNotes = useMemo(() => activeProject?.ghostNotes || [], [activeProject?.ghostNotes]);

  // The inbox always opens with a useful reading/editing surface. Preserve the
  // current selection when possible and otherwise select the newest note.
  useEffect(() => {
    if (!isLoaded || viewMode !== "list" || isNoteSelectionMode) return;
    if (window.matchMedia("(max-width: 1023px)").matches && !selectedNoteId) {
      setHighlightedBlockId(null);
      return;
    }
    if (blocks.length === 0) {
      setSelectedNoteId(null);
      setHighlightedBlockId(null);
      return;
    }
    if (selectedNoteId && blocks.some((block) => block.id === selectedNoteId)) return;
    const newestNote = [...blocks].sort((a, b) => b.timestamp - a.timestamp)[0];
    setSelectedNoteId(newestNote.id);
    setHighlightedBlockId(newestNote.id);
  }, [blocks, isLoaded, isNoteSelectionMode, selectedNoteId, viewMode]);

  useEffect(() => {
    if (!isNoteSelectionMode) return;
    setSelectedNoteId(null);
    setHighlightedBlockId(null);
  }, [isNoteSelectionMode]);

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
                name: "Default workspace",
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

      try {
        const rawThreads = ipc
          ? diskData?.chatThreads
          : JSON.parse(localStorage.getItem("fikr-chat-threads") || "[]");
        const restoredThreads = normalizeChatThreads(rawThreads) as FikrChatThread[];
        setChatThreads(restoredThreads);
        setActiveChatThreadId(null);
      } catch (e) {
        console.error("Failed to load chat conversations", e);
        setChatThreads([]);
      }

      try {
        const rawMemories = ipc
          ? diskData?.chatMemories
          : JSON.parse(localStorage.getItem("fikr-chat-memories") || "[]");
        setChatMemories(normalizeChatMemories(rawMemories) as FikrChatMemory[]);
      } catch (e) {
        console.error("Failed to load chat memories", e);
        setChatMemories([]);
      }

      // Load studio projects — in Electron use diskData (same workspace.json),
      // fall back to localStorage in browser mode.
      try {
        if (ipc && Array.isArray(diskData?.studioProjects)) {
          // Electron path: already loaded from disk above
          const reset = diskData.studioProjects.map((p: any) =>
            p.status === "generating"
              ? { ...p, status: "error", outputMarkdown: undefined, error: "Generation was interrupted. Click Retry to regenerate." }
              : p
          );
          studioProjectsRef.current = reset;
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


      if (ipc && ipc.getMcpConnection) {
        ipc
          .getMcpConnection()
          .then(({ port, token }: { port: number; token: string }) => {
            setMcpPort(port);
            setMcpToken(token);
          })
          .catch(console.error);
      }

      setIsLoaded(true);
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
    if (isSyncingFromCloud.current) return; // cloud just pushed — don't echo back
    const ipc = typeof window !== "undefined" && (window as any).fikrStudio;
    if (ipc) {
      void ipc
        .saveProjects({
          projects,
          activeProjectId,
          studioProjects: studioProjectsRef.current,
          activeStudioProjectId,
          chatThreads,
          chatMemories,
        })
        .then((saved: boolean) => {
          if (!saved) {
            toast.error("Changes couldn’t be saved", {
              id: "workspace-save-error",
              description: "Your edits are still open. Try again before closing Fikr.",
            });
          }
        })
        .catch(() => {
          toast.error("Changes couldn’t be saved", {
            id: "workspace-save-error",
            description: "Your edits are still open. Try again before closing Fikr.",
          });
        });
    } else {
      try {
        localStorage.setItem("nodepad-projects", JSON.stringify(projects));
        localStorage.setItem("nodepad-active-project", activeProjectId);
        localStorage.setItem("nodepad-backup", JSON.stringify(projects));
        localStorage.setItem("fikr-chat-threads", JSON.stringify(chatThreads));
        localStorage.setItem("fikr-chat-memories", JSON.stringify(chatMemories));
      } catch {
        toast.error("Changes couldn’t be saved", {
          id: "workspace-save-error",
          description: "Browser storage is unavailable or full.",
        });
      }
    }
  }, [projects, activeProjectId, activeStudioProjectId, chatThreads, chatMemories, isLoaded]);

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
          // Main process pushed a server-authorized cloud workspace after sign-in.
          // Replace local state with cloud data. Suppress the save-on-change effect
          // so we don't immediately re-upload the stale pre-sync state.
          const workspace = event.payload;
          if (workspace?.projects?.length > 0) {
            isSyncingFromCloud.current = true;
            setProjects(workspace.projects);
            if (workspace.activeProjectId) {
              setActiveProjectId(workspace.activeProjectId);
            }
            // Hold the suppression flag for 500ms to ensure React's render + commit
            // cycle completes before the save-on-change effect is allowed to fire.
            // setTimeout(0) is insufficient — the effect runs after commit, which
            // can happen in a later microtask queue than the setTimeout(0) callback.
            setTimeout(() => { isSyncingFromCloud.current = false; }, 500);
          }
          if (workspace && Object.prototype.hasOwnProperty.call(workspace, "studioProjects")) {
            const syncedStudioProjects = Array.isArray(workspace.studioProjects)
              ? workspace.studioProjects
              : [];
            studioProjectsRef.current = syncedStudioProjects;
            setStudioProjects(syncedStudioProjects);
          }
          if (workspace?.chatThreads) {
            setChatThreads(normalizeChatThreads(workspace.chatThreads) as FikrChatThread[]);
            setActiveChatThreadId(null);
          }
          if (workspace && Object.prototype.hasOwnProperty.call(workspace, "chatMemories")) {
            setChatMemories(normalizeChatMemories(workspace.chatMemories) as FikrChatMemory[]);
          }
        } else if (event.type === "workspace-cleared") {
          // User chose "Clear everything" during logout.
          // Reset to a blank slate so no data bleeds into the logged-out session.
          setProjects(INITIAL_PROJECTS);
          setActiveProjectId(INITIAL_PROJECTS[0]?.id ?? "");
          setStudioProjects([]);
          setActiveStudioProjectId("");
          setChatThreads([]);
          setChatMemories([]);
          setActiveChatThreadId(null);
          localStorage.removeItem("fikr-studio-projects");
          localStorage.removeItem("nodepad-projects");
          localStorage.removeItem("nodepad-active-project");
          localStorage.removeItem("nodepad-backup");
          localStorage.removeItem("fikr-chat-threads");
          localStorage.removeItem("fikr-chat-memories");
        } else if (event.type === "mcp-port-updated") {
          setMcpPort(event.payload.port);
        }
      },
    );

    return cleanup;
  }, []);

  // Hidden file input for .fikrdata import — triggered from sidebar or ⌘K
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
          toast("Workspace imported", { description: imported.name });
        } catch (err) {
          if (err instanceof NodepadParseError) {
            toast.error("Couldn’t import workspace", { description: err.message });
          } else {
            toast.error("Couldn’t import workspace", {
              description: "Choose a valid .fikrdata file and try again.",
            });
          }
        }
      };
      reader.onerror = () => {
        toast.error("Couldn’t read that file");
      };
      reader.readAsText(file);
      // Reset input so the same file can be re-imported if needed
      e.target.value = "";
    },
    [],
  );

  // Persist studioProjects helper (always available at page level)
  const persistStudio = useCallback((updated: any[], nextActiveStudioProjectId = activeStudioProjectId) => {
    if (typeof window !== "undefined" && (window as any).fikrStudio?.saveWorkspace) {
      (window as any).fikrStudio.saveWorkspace({
        projects: projectsRef.current,
        activeProjectId,
        studioProjects: updated,
        activeStudioProjectId: nextActiveStudioProjectId,
        chatThreads: chatThreadsRef.current,
        chatMemories: chatMemoriesRef.current,
      });
    } else {
      localStorage.setItem("fikr-studio-projects", JSON.stringify(updated));
    }
  }, [activeProjectId, activeStudioProjectId]);

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
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      const primary = e.metaKey || e.ctrlKey;
      const typing = isEditableShortcutTarget(e.target);

      if ((primary && key === "/") || (!primary && e.key === "?" && !typing)) {
        e.preventDefault();
        setIsKeyboardShortcutsOpen(true);
        return;
      }

      if (e.key === "Escape") {
        if (isKeyboardShortcutsOpen) {
          setIsKeyboardShortcutsOpen(false);
        } else if (isMenuOpen) {
          setIsMenuOpen(false);
        } else if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (isGhostPanelOpen) {
          setIsGhostPanelOpen(false);
        }
        return;
      }

      if (typing || !primary) return;

      if (!e.shiftKey && !e.altKey && (key === "k" || key === "f")) {
        e.preventDefault();
        setSettingsOpen(false);
        setIsKeyboardShortcutsOpen(false);
        setIsSearchOpen(true);
      } else if (!e.shiftKey && !e.altKey && key === "n") {
        e.preventDefault();
        setActiveSurface("Knowledge");
        setSettingsOpen(false);
        setIsSearchOpen(false);
        setNewEntryOpenRequest((request) => request + 1);
      } else if (!e.shiftKey && !e.altKey && key === "1") {
        e.preventDefault();
        setActiveSurface("Chat");
        setSettingsOpen(false);
      } else if (!e.shiftKey && !e.altKey && key === "2") {
        e.preventDefault();
        setActiveSurface("Knowledge");
        setSettingsOpen(false);
      } else if (!e.shiftKey && !e.altKey && key === "3") {
        e.preventDefault();
        setActiveSurface("Creations");
        setSettingsOpen(false);
      } else if (!e.shiftKey && !e.altKey && key === "4") {
        e.preventDefault();
        setActiveSurface("Connections");
        setSettingsOpen(false);
      } else if (!e.shiftKey && !e.altKey && key === ",") {
        e.preventDefault();
        setSettingsSection("account");
        setSettingsOpen(true);
      } else if (e.shiftKey && !e.altKey && key === "i") {
        e.preventDefault();
        setActiveSurface("Knowledge");
        setSettingsOpen(false);
        setIsGhostPanelOpen((open) => !open);
      } else if (!e.shiftKey && e.altKey && key === "l") {
        e.preventDefault();
        setActiveSurface("Knowledge");
        setSettingsOpen(false);
        setViewMode("list");
      } else if (!e.shiftKey && e.altKey && key === "g") {
        e.preventDefault();
        setActiveSurface("Knowledge");
        setSettingsOpen(false);
        setSelectedNoteId(null);
        setHighlightedBlockId(null);
        setViewMode("graph");
      } else if (!e.shiftKey && !e.altKey && key === "z" && activeSurface === "Knowledge") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [activeSurface, isKeyboardShortcutsOpen, isMenuOpen, isSearchOpen, isGhostPanelOpen, undo]);

  const addBlock = useCallback(
    (text: string, forcedType?: ContentType, allowInlineType = true) => {
      // Parse inline #type tag  e.g. "#claim The earth is 4.5 billion years old"
      let resolvedText = text;
      let resolvedType = forcedType;

      if (!resolvedType && allowInlineType && !text.includes("\n")) {
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
      if (selectedNoteId === id) setSelectedNoteId(null);
      setSelectedNoteIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [activeProjectId, pushHistory, updateActiveProject, selectedNoteId],
  );

  const handleSelectNote = useCallback((id: string, multiSelect?: boolean) => {
    if (multiSelect) {
      setSelectedNoteIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      setSelectedNoteId(null);
    } else {
      setSelectedNoteIds(new Set());
      setSelectedNoteId(id);
    }
  }, []);

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

  const handleBulkDelete = useCallback(() => {
    if (selectedNoteIds.size === 0) return;
    pushHistory(activeProjectId, blocksRef.current);
    updateActiveProject((p) => ({
      ...p,
      blocks: p.blocks.filter((b) => !selectedNoteIds.has(b.id)),
    }));
    setSelectedNoteIds(new Set());
  }, [activeProjectId, pushHistory, updateActiveProject, selectedNoteIds]);

  const handleBulkResynthesize = useCallback(() => {
    if (selectedNoteIds.size === 0) return;
    const ids = Array.from(selectedNoteIds);
    ids.forEach((id) => reEnrichBlock(id));
    setSelectedNoteIds(new Set());
  }, [selectedNoteIds, reEnrichBlock]);

  const handleBulkRecategorize = useCallback((newCategory: string) => {
    if (selectedNoteIds.size === 0 || !newCategory.trim()) return;
    const ids = Array.from(selectedNoteIds);
    ids.forEach((id) => {
      const block = blocksRef.current.find(b => b.id === id);
      if (block) {
        updateActiveProject((p) => ({
          ...p,
          blocks: p.blocks.map((b) =>
            b.id === id ? { ...b, category: newCategory.trim(), isEnriching: true } : b
          ),
        }));
        enrichBlock(activeProjectId, id, block.text, newCategory.trim(), block.contentType, 0, true).catch(console.error);
      }
    });
    setSelectedNoteIds(new Set());
  }, [selectedNoteIds, activeProjectId, updateActiveProject, enrichBlock]);

  const handleMoveNotes = useCallback((noteIds: string[], targetProjectId: string) => {
    const moveIds = new Set(noteIds);
    if (moveIds.size === 0 || targetProjectId === activeProjectId) return;

    const currentProjects = projectsRef.current;
    const source = currentProjects.find((project) => project.id === activeProjectId);
    const target = currentProjects.find((project) => project.id === targetProjectId);
    if (!source || !target) return;

    const blocksToMove = source.blocks.filter((block) => moveIds.has(block.id));
    if (blocksToMove.length === 0) return;

    pushHistory(activeProjectId, source.blocks);
    setProjects((current) => current.map((project) => {
      if (project.id === activeProjectId) {
        return { ...project, blocks: project.blocks.filter((block) => !moveIds.has(block.id)) };
      }
      if (project.id === targetProjectId) {
        const existingIds = new Set(project.blocks.map((block) => block.id));
        return {
          ...project,
          blocks: [
            ...project.blocks,
            ...blocksToMove.filter((block) => !existingIds.has(block.id)),
          ],
        };
      }
      return project;
    }));

    setSelectedNoteIds(new Set());
    setSelectedNoteId((current) => current && moveIds.has(current) ? null : current);
    analytics.track("note_move", {
      count: blocksToMove.length,
      fromProject: activeProjectId,
      toProject: targetProjectId,
    });
    toast(blocksToMove.length === 1 ? "Note moved" : "Notes moved", {
      description: `${blocksToMove.length} note${blocksToMove.length === 1 ? "" : "s"} moved to ${target.name}`,
    });

    void Promise.all(blocksToMove.map((block) => {
      const indexText = VectorIndex.buildIndexText({
        text: block.text,
        title: block.title,
        annotation: block.annotation,
        contentType: block.contentType,
        category: block.category,
      });
      return vectorIndex.add(
        block.id,
        targetProjectId,
        indexText,
        block.contentType,
        block.confidence,
      );
    })).catch((error) => console.error("Failed to reindex moved notes", error));
  }, [activeProjectId, pushHistory]);

  const handleBulkMove = useCallback((targetProjectId: string) => {
    handleMoveNotes(Array.from(selectedNoteIds), targetProjectId);
  }, [handleMoveNotes, selectedNoteIds]);

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

  const createProject = useCallback((requestedName?: string) => {
    analytics.track("project_create");
    const name = requestedName?.trim().slice(0, 80) || "New workspace";
    const newProject: Project = {
      id: generateId(),
      name,
      blocks: [],
      collapsedIds: [],
      ghostNotes: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    toast(requestedName ? "Space created" : "Workspace created", requestedName ? { description: name } : undefined);
    return newProject.id;
  }, []);

  useEffect(() => {
    const handleNewWorkspaceShortcut = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        isEditableShortcutTarget(event.target) ||
        !(event.metaKey || event.ctrlKey) ||
        !event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "n"
      ) return;
      event.preventDefault();
      setActiveSurface("Knowledge");
      setSettingsOpen(false);
      createProject();
    };
    window.addEventListener("keydown", handleNewWorkspaceShortcut);
    return () => window.removeEventListener("keydown", handleNewWorkspaceShortcut);
  }, [createProject]);

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
        const project = projectsRef.current.find((item) => item.id === activeProjectId);
        if (project) {
          void downloadNodepadFile(project)
            .then((saved) => {
              if (saved) toast("Workspace exported", { description: `${project.name}.fikrdata` });
            })
            .catch(() => toast.error("Couldn’t export workspace"));
        } else {
          toast.error("Couldn’t export workspace");
        }
      } else if (cmd === "import-fikrdata") {
        analytics.track("import_file");
        importInputRef.current?.click();
      }

      // Handle type overrides
      else if (cmd === "task" && text) addBlock(text, "task");
      else if (cmd === "thesis" && text) addBlock(text, "thesis");

    },
    [clearBlocks, addBlock, activeProjectId, createProject],
  );

  const handleSaveChatKnowledge = useCallback((
    threadId: string,
    draft: { title: string; content: string; kind: "insight" | "knowledge-note" },
    projectId: string,
  ) => {
    const target = projectsRef.current.find((project) => project.id === projectId);
    if (!target) {
      toast.error("Choose a Knowledge workspace first");
      return false;
    }
    const duplicate = target.blocks.some((block) =>
      (block as TextBlock & { sourceThreadId?: string }).sourceThreadId === threadId && block.text.trim() === draft.content.trim(),
    );
    if (duplicate) {
      toast(draft.kind === "insight" ? "Insight already saved" : "Note already saved", { description: `It’s already in ${target.name}.` });
      return false;
    }

    const note = createKnowledgeNoteFromAnswer({
      answer: draft.content,
      title: draft.title,
      kind: draft.kind,
      threadId,
      existingIds: target.blocks.map((block) => block.id),
    }) as TextBlock;
    setProjects((current) => current.map((project) => project.id === projectId
      ? { ...project, blocks: [...project.blocks, note] }
      : project));
    const indexText = VectorIndex.buildIndexText(note);
    void vectorIndex.add(note.id, projectId, indexText, note.contentType, note.confidence).catch(() => {});
    toast(draft.kind === "insight" ? "Insight saved to Knowledge" : "Note saved to Knowledge", { description: target.name });
    return true;
  }, []);

  const handleSaveChatCreation = useCallback((threadId: string, artifact: FikrArtifact) => {
    const existing = studioProjectsRef.current.find((creation: any) =>
      creationMatchesArtifact(creation, artifact),
    );
    if (existing) {
      toast("Creation already saved");
      return false;
    }
    const creation = createCreationFromArtifact({
      artifact,
      threadId,
      existingIds: studioProjectsRef.current.map((candidate: any) => candidate.id),
    });
    const updated = [creation, ...studioProjectsRef.current];
    studioProjectsRef.current = updated;
    setStudioProjects(updated);
    setActiveStudioProjectId(creation.id);
    persistStudio(updated);
    toast("Saved to Creations", { description: creation.name });
    return true;
  }, [persistStudio]);

  const isChatCreationSaved = useCallback((_threadId: string, artifact: FikrArtifact) => (
    studioProjectsRef.current.some((creation: any) =>
      creationMatchesArtifact(creation, artifact),
    )
  ), []);

  const handleDeleteChat = useCallback((threadId: string) => {
    const current = chatThreadsRef.current;
    const deletedIndex = current.findIndex((thread) => thread.id === threadId);
    if (deletedIndex < 0) return;
    const deletedThread = current[deletedIndex];
    const wasActive = activeChatThreadId === threadId;
    const updated = current.filter((thread) => thread.id !== threadId);
    chatThreadsRef.current = updated;
    setChatThreads(updated);
    if (wasActive) setActiveChatThreadId(null);
    analytics.track("chat_delete", { threadId });
    toast("Chat deleted", {
      description: deletedThread.title,
      duration: 6_000,
      action: {
        label: "Undo",
        onClick: () => {
          const restored = [...chatThreadsRef.current];
          if (restored.some((thread) => thread.id === deletedThread.id)) return;
          restored.splice(Math.min(deletedIndex, restored.length), 0, deletedThread);
          chatThreadsRef.current = restored;
          setChatThreads(restored);
          if (wasActive) setActiveChatThreadId(deletedThread.id);
        },
      },
    });
  }, [activeChatThreadId]);

  const handleRenameChat = useCallback((threadId: string, nextTitle: string) => {
    const title = nextTitle.trim().split(/\s+/).slice(0, 5).join(" ").slice(0, 120);
    if (!title) return;
    const updated = chatThreadsRef.current.map((thread) => thread.id === threadId
      ? { ...thread, title, updatedAt: Date.now() }
      : thread);
    chatThreadsRef.current = updated;
    setChatThreads(updated);
    analytics.track("chat_rename", { threadId });
    toast("Chat renamed");
  }, []);

  const handleDeleteCreation = useCallback((creationId: string) => {
    const current = studioProjectsRef.current;
    const deletedIndex = current.findIndex((creation: any) => creation.id === creationId);
    if (deletedIndex < 0) return;
    const deletedCreation = current[deletedIndex];
    const wasActive = activeStudioProjectId === creationId;
    const updated = current.filter((creation: any) => creation.id !== creationId);
    const nextActiveId = wasActive ? updated[0]?.id ?? "" : activeStudioProjectId;
    studioProjectsRef.current = updated;
    setStudioProjects(updated);
    if (wasActive) setActiveStudioProjectId(nextActiveId);
    persistStudio(updated, nextActiveId);
    analytics.track("creation_delete", { creationId });
    toast("Creation deleted", {
      description: deletedCreation.name || "Untitled creation",
      duration: 6_000,
      action: {
        label: "Undo",
        onClick: () => {
          const restored = [...studioProjectsRef.current];
          if (restored.some((creation: any) => creation.id === deletedCreation.id)) return;
          restored.splice(Math.min(deletedIndex, restored.length), 0, deletedCreation);
          studioProjectsRef.current = restored;
          setStudioProjects(restored);
          const restoredActiveId = wasActive ? deletedCreation.id : activeStudioProjectId;
          if (wasActive) setActiveStudioProjectId(restoredActiveId);
          persistStudio(restored, restoredActiveId);
        },
      },
    });
  }, [activeStudioProjectId, persistStudio]);

  const handleUpdateCreation = useCallback((creationId: string, outputMarkdown: string, name: string) => {
    const updated = studioProjectsRef.current.map((creation: any) => creation.id === creationId
      ? { ...creation, name, outputMarkdown, updatedAt: Date.now() }
      : creation);
    studioProjectsRef.current = updated;
    setStudioProjects(updated);
    persistStudio(updated);
    analytics.track("creation_update", { creationId });
    toast("Creation updated");
  }, [persistStudio]);

  return (
    <SearchProvider>
      <GlobalSearchEngine projects={projects} />
      <UpdateCheckIndicator />
      {!isLaunchReady ? (
        <div
          className="grid h-dvh place-items-center bg-background px-6 text-center"
          data-testid="app-launch-gate"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center">
            <img src="./logo.svg" alt="" className="size-11 animate-pulse object-contain" />
            <p className="mt-4 text-sm font-semibold text-foreground">Opening Fikr</p>
            <p className="mt-1 text-xs text-muted-foreground">Checking your account and workspace.</p>
          </div>
        </div>
      ) : (
        <div className="flex h-dvh flex-col overflow-hidden bg-background">
        {/* Hidden file input for .fikrdata import */}
        <input
          ref={importInputRef}
          type="file"
          accept=".fikrdata,.json"
          className="hidden"
          onChange={handleImportFile}
        />

        {showApiKeyBanner && <ApiKeyBanner onAddKey={() => openSettings("llm")} />}

        <div className="flex min-h-0 flex-1" data-testid="workspace-layout">
         <ProjectSidebar
           isOpen={isSidebarOpen}
           onOpen={() => setIsSidebarOpen(true)}
           onClose={() => setIsSidebarOpen(false)}
           projects={projects}
           activeProjectId={activeProjectId}
           onSelectProject={(id) => {
             analytics.track("project_select", { projectId: id });
             setActiveProjectId(id);
             setSelectedNoteId(null);
             setSelectedNoteIds(new Set());
             setIsNoteSelectionMode(false);
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
           activeSurface={activeSurface}
           setActiveSurface={setActiveSurface}
           chatThreads={chatThreads}
           activeChatThreadId={activeChatThreadId}
           onSelectChatThread={(id) => {
             setActiveSurface("Chat");
             setActiveChatThreadId(id);
           }}
           onNewChat={() => {
             setActiveSurface("Chat");
             setActiveChatThreadId(null);
           }}
           onRenameChat={handleRenameChat}
           onDeleteChat={handleDeleteChat}
           onOpenKeyboardShortcuts={() => setIsKeyboardShortcutsOpen(true)}
           studioProjects={studioProjects}
           activeStudioProjectId={activeStudioProjectId}
           onSelectStudioProject={setActiveStudioProjectId}
           activeStudioWordCount={(() => {
             const p = studioProjects.find((p: any) => p.id === activeStudioProjectId);
             const md = p?.outputMarkdown ?? "";
             return md ? md.trim().split(/\s+/).filter(Boolean).length : 0;
           })()}
           onMoveNotes={handleMoveNotes}
           hideMobileMenu={activeSurface === "Knowledge" && Boolean(selectedNoteId)}
         />

        <div className="fikr-app-content relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* The existing workspace toolbar belongs to Knowledge. */}
          {activeSurface === "Knowledge" && (
            <StatusBar
              isGhostPanelOpen={isGhostPanelOpen}
            ghostNoteCount={ghostNotes.filter((n) => !n.isGenerating).length}
            activeProjectName={activeProject?.name || ""}
            viewMode={viewMode}
            onGhostPanelToggle={() => {
              analytics.track("ghost_panel_toggle");
              setIsGhostPanelOpen((prev) => !prev);
            }}
            onViewModeChange={(mode) => {
              analytics.track("view_switch", { mode });
              setViewMode(mode);
              if (mode !== "list") {
                setSelectedNoteId(null);
                setHighlightedBlockId(null);
              }
            }}
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
            onOpenKeyboardShortcuts={() => setIsKeyboardShortcutsOpen(true)}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
            enrichingCount={blocks.filter((b) => b.isEnriching).length}
            modelLabel={
              isHydrated && settings.apiKey
                ? currentModel.shortLabel
                : undefined
            }
            wordUsage={wordUsage}
            onWordCountClick={handleWordCountClick}
            onTriggerOnboarding={() => setIsIntroOpen(true)}
          />
          )}

          {activeSurface === "Connections" ? (
            <ConnectionsPage
              mcpPort={mcpPort}
              mcpToken={mcpToken}
              plan={cloudPlan}
            />
          ) : activeSurface === "Chat" ? (
            <FikrChat
              projects={projects}
              threads={chatThreads}
              setThreads={setChatThreads}
              memories={chatMemories}
              setMemories={setChatMemories}
              activeThreadId={activeChatThreadId}
              onActiveThreadChange={setActiveChatThreadId}
              onSaveKnowledge={handleSaveChatKnowledge}
              onCreateSpace={createProject}
              isCreationSaved={isChatCreationSaved}
              onSaveCreation={handleSaveChatCreation}
              onOpenCreations={() => setActiveSurface("Creations")}
            />
          ) : activeSurface === "Creations" ? (
            <CreationsPage
              creations={studioProjects}
              onDeleteCreation={handleDeleteCreation}
              onUpdateCreation={handleUpdateCreation}
            />
          ) : (
            <>

          <div className="flex flex-1 overflow-hidden relative">
            <main className="relative flex-1 overflow-hidden">
              {isLoaded ? (
                viewMode === "list" ? (
                  <div className="grid h-full min-w-0 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(280px,300px)_minmax(0,1fr)] min-[1100px]:grid-cols-[minmax(300px,320px)_minmax(0,1fr)] min-[1440px]:grid-cols-[minmax(340px,380px)_minmax(0,1fr)]">
                    <ListArea
                      blocks={activeProject.blocks}
                      highlightedBlockId={highlightedBlockId}
                      onHighlight={setHighlightedBlockId}
                      selectedBlockId={selectedNoteId}
                      selectedBlockIds={selectedNoteIds}
                      onOpenDetail={handleSelectNote}
                      onSelectAll={(ids) => {
                        setSelectedNoteId(null);
                        setSelectedNoteIds(new Set(ids));
                      }}
                      onClearSelection={() => setSelectedNoteIds(new Set())}
                      selectionMode={isNoteSelectionMode}
                      onSelectionModeChange={setIsNoteSelectionMode}
                      sortBy={knowledgeSortBy}
                      onSortByChange={setKnowledgeSortBy}
                    />
                    <div className={`${selectedNoteId ? "fixed inset-0 z-[130] block pb-[env(safe-area-inset-bottom)]" : "hidden"} min-h-0 bg-background lg:static lg:z-auto lg:block lg:pb-0`}>
                      <NoteDetailPanel
                        mode="workspace"
                        block={selectedNoteId ? (activeProject?.blocks.find((b) => b.id === selectedNoteId) ?? null) : null}
                        isOpen
                        onClose={() => { setSelectedNoteId(null); setHighlightedBlockId(null); }}
                        onEdit={editBlock}
                        onEditAnnotation={editAnnotation}
                        onReEnrich={reEnrichBlock}
                        onDelete={deleteBlock}
                        onTogglePin={handleTogglePin}
                        onChangeType={handleChangeType}
                      />
                    </div>
                  </div>
                ) : viewMode === "tiling" ? (
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
                ) : null
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
            
            {viewMode !== "list" && (
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
            )}

            <BulkActionPanel
              isOpen={selectedNoteIds.size > 0}
              selectedCount={selectedNoteIds.size}
              projects={projects.map(p => ({ id: p.id, name: p.name }))}
              activeProjectId={activeProjectId}
              onClose={() => setSelectedNoteIds(new Set())}
              onDelete={handleBulkDelete}
              onResynthesize={handleBulkResynthesize}
              onRecategorize={handleBulkRecategorize}
              onMove={handleBulkMove}
            />
          </div>

            <VimInput
              key={`entry-${activeProjectId}`}
              projectId={activeProjectId}
              onSubmit={(text) => addBlock(text, undefined, false)}
              openRequest={newEntryOpenRequest}
              onOpenRequestHandled={() => setNewEntryOpenRequest(0)}
              hidden={
                isSearchOpen ||
                isIndexOpen ||
                isIntroOpen ||
                settingsOpen ||
                isMenuOpen ||
                selectedNoteIds.size > 0
              }
            />
          </>
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
        </div>



        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          projects={projects}
          onSelectResult={(blockId, projectId) => {
            setActiveSurface("Knowledge");
            if (projectId !== activeProjectId) setActiveProjectId(projectId);
            setHighlightedBlockId(blockId);
            setSelectedNoteId(blockId);
            setIsSearchOpen(false);
          }}
        />

        <KeyboardShortcutsDialog
          open={isKeyboardShortcutsOpen}
          onOpenChange={setIsKeyboardShortcutsOpen}
        />

        {/* First-visit intro video modal */}
        <IntroModal open={isIntroOpen} onClose={handleIntroClose} />

        </div>
      )}

      {/* Mounted during launch so authentication resolves before the workspace is revealed. */}
      <SettingsPage
        open={settingsOpen}
        initialSection={settingsSection}
        aiSettings={settings}
        onUpdateAISettings={updateSettings}
        onClose={() => setSettingsOpen(false)}
        onAuthChange={handleAuthChange}
        showApiKeyBanner={showApiKeyBanner}
      />
    </SearchProvider>
  );
}

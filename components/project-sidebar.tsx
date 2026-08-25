"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Check,
  X,
  Edit3,
  Sparkles,
  Key,
  LogOut,
  LogIn,
  Shield,
  Moon,
  Sun,
  Keyboard,
  HelpCircle,
  RefreshCw,
  MessageCircle,
  BookOpen,
  PenLine,
  Cable,
  SquarePen,
  Settings,
  MoreHorizontal,
  FolderClosed,
  FolderOpen,
  Menu,
} from "lucide-react";

import { useTheme } from "next-themes";
import { AboutPanel } from "@/components/about-panel";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type AISettings } from "@/lib/ai-settings";
import { decodeDraggedNoteIds, NOTE_DRAG_MIME } from "@/lib/note-drag";
import { signInWithCustomToken, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

interface Project {
  id: string;
  name: string;
  blocks: any[];
  collapsedIds: string[];
}

export type FikrSurface = "Chat" | "Knowledge" | "Creations" | "Connections";

interface ChatThreadSummary {
  id: string;
  title: string;
  updatedAt: number;
}

function formatThreadActivity(updatedAt: number) {
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return "Recent";

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

interface ProjectSidebarProps {
  isOpen: boolean;
  onOpen?: () => void;
  onClose: () => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onRenameProject: (id: string, newName: string) => void;
  onDeleteProject: (id: string) => void;
  openToSettings?: boolean;
  onSettingsOpened?: () => void;
  onOpenSettings: (section: "llm" | "account") => void;
  // AI Settings
  aiSettings: AISettings;
  onUpdateAISettings: (patch: Partial<AISettings>) => void;
  mcpPort?: number | null;
  activeSurface: FikrSurface;
  setActiveSurface: (surface: FikrSurface) => void;
  chatThreads: ChatThreadSummary[];
  activeChatThreadId: string | null;
  onSelectChatThread: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  studioProjects?: any[];
  activeStudioProjectId?: string;
  onSelectStudioProject?: (id: string) => void;
  onCreateStudioProject?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  activeStudioWordCount?: number;
  onMoveNotes?: (noteIds: string[], targetProjectId: string) => void;
  hideMobileMenu?: boolean;
}

export function ProjectSidebar({
  isOpen,
  onOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  openToSettings,
  onSettingsOpened,
  onOpenSettings,
  activeSurface,
  setActiveSurface,
  chatThreads,
  activeChatThreadId,
  onSelectChatThread,
  onNewChat,
  onDeleteChat,
  studioProjects = [],
  activeStudioProjectId = "",
  onOpenKeyboardShortcuts,
  onMoveNotes,
  hideMobileMenu = false,
}: ProjectSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [chatPendingDeleteId, setChatPendingDeleteId] = useState<string | null>(null);

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const clearDropTarget = () => setDropTargetId(null);
    window.addEventListener("dragend", clearDropTarget);
    return () => window.removeEventListener("dragend", clearDropTarget);
  }, []);

  // Firebase Auth State (kept in sidebar for continuous MCP relay)
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<string>("Free");

  // Firebase auth listener; plan authority comes from verified fikr.one APIs.
  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const token = await currentUser.getIdToken().catch(() => null);
        const ipc = (window as any).fikrStudio;
        const profile = token && ipc?.setUser
          ? await ipc.setUser(currentUser.uid, token).catch(() => null)
          : null;
        setUserPlan(profile?.plan || "Free");
      } else {
        setUserPlan("Free");
      }
    });

    // Listen to deep-linked auth tokens from Electron
    // @ts-expect-error - external IPC method
    const unsubscribeIpc = window.fikrStudio?.onExternalEvent?.((eventData) => {
      if (eventData.type === "auth-token" && eventData.payload?.token) {
        signInWithCustomToken(auth, eventData.payload.token).catch(() => {});
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeIpc) unsubscribeIpc();
    };
  }, []);


  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (openToSettings) {
      onOpenSettings("llm");
      onSettingsOpened?.();
    }
  }, [openToSettings, onOpenSettings, onSettingsOpened]);

  const isPro = userPlan.toLowerCase().includes("pro");
  const isPlus = userPlan.toLowerCase().includes("plus");
  const isManagedPlan = isPro || isPlus;

  const handleRename = (id: string) => {
    if (editName.trim()) onRenameProject(id, editName.trim());
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onDeleteProject(id);
    setDeletingId(null);
  };

  const handleSyncNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSyncing || !isManagedPlan) return;
    setIsSyncing(true);
    try {
      const ipc = typeof window !== "undefined" && (window as any).fikrStudio;
      if (ipc?.syncWorkspace) {
        await ipc.syncWorkspace();
      }
    } catch (err) {
      console.error("[Sync] Manual sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Proper logout flow:
   * - In Electron: calls the main-process logout IPC which syncs data,
   *   shows a native keep/clear dialog, then optionally wipes local cache.
   * - Falls back to plain Firebase signOut in the browser.
   */
  const handleLogout = async () => {
    if (isLoggingOut) return;
    const ipc = typeof window !== "undefined" && (window as any).fikrStudio;
    if (ipc?.logout) {
      setIsLoggingOut(true);
      try {
        const currentData = { projects, activeProjectId, studioProjects, activeStudioProjectId, chatThreads };
        const result = await ipc.logout(currentData);
        if (result?.cancelled) return; // user hit Cancel
        // Firebase sign-out happens after the native dialog confirms
        await signOut(getFirebaseAuth());
      } catch (err) {
        console.error('[Logout] IPC logout failed:', err);
        // Fallback: still sign out of Firebase
        await signOut(getFirebaseAuth());
      } finally {
        setIsLoggingOut(false);
      }
    } else {
      // Browser / dev mode — plain sign-out
      await signOut(getFirebaseAuth());
    }
  };

  const sortedThreads = chatThreads
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 12);

  const navigation = [
    ["Chat", MessageCircle],
    ["Knowledge", BookOpen],
    ["Creations", PenLine],
    ["Connections", Cable],
  ] as const;
  const contextKind = activeSurface === "Chat"
    ? "chats"
    : activeSurface === "Knowledge"
      ? "workspaces"
      : null;
  const showContextPanel = contextKind === "workspaces"
    || (contextKind === "chats" && sortedThreads.length > 0);
  const closeMobilePanel = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      onClose();
    }
  };

  return (
    <TooltipProvider>
      <div className="fikr-navigation-shell relative z-50" data-testid="fikr-navigation-shell">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={onOpen}
          aria-label="Open menu"
          className={`fikr-mobile-menu-button size-11 rounded-xl border-border/70 bg-background/92 text-foreground shadow-md backdrop-blur-md hover:bg-accent lg:hidden ${hideMobileMenu ? "hidden" : ""}`}
        >
          <Menu className="size-5" />
        </Button>

        <aside className="fikr-icon-rail hidden lg:flex" aria-label="Fikr navigation">
          <div className="fikr-rail-logo flex justify-center px-2.5 pb-4 pt-3">
            <img src="./logo.svg" alt="Fikr" className="size-8 object-contain" />
          </div>

          <nav className="flex flex-col items-center gap-1.5 px-2" aria-label="Main navigation">
            {navigation.map(([surface, Icon]) => (
              <Tooltip key={surface}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-lg"
                    variant="ghost"
                    onClick={() => {
                      setActiveSurface(surface);
                      closeMobilePanel();
                    }}
                    aria-label={surface}
                    aria-current={activeSurface === surface ? "page" : undefined}
                    className={`relative size-9 rounded-lg text-white/66 hover:bg-white/8 hover:text-white ${
                      activeSurface === surface
                        ? "bg-[#3ca6a6]/16 text-[#63c1c1] hover:bg-[#3ca6a6]/20 hover:text-[#75cccc]"
                        : ""
                    }`}
                  >
                    {activeSurface === surface && (
                      <span className="fikr-nav-active-indicator absolute -left-2 h-6 w-0.5 rounded-r-full bg-[#3ca6a6]" aria-hidden="true" />
                    )}
                    <Icon className="size-5" strokeWidth={1.9} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{surface}</TooltipContent>
              </Tooltip>
            ))}
          </nav>

          <div className="fikr-rail-divider mt-3 px-3">
            <Separator className="bg-white/10" />
          </div>

          <div className="fikr-rail-footer mt-auto flex flex-col items-center gap-1.5 px-2 pb-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => onOpenSettings("account")}
                  aria-label="Settings"
                  className="size-9 rounded-lg text-white/60 hover:bg-white/8 hover:text-white"
                >
                  <Settings className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon-lg"
                      variant="ghost"
                      aria-label="Open account menu"
                      className="size-9 overflow-hidden rounded-full border border-white/10 bg-white/8 p-0 text-white hover:bg-white/12"
                    >
                      {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || "User"} className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center bg-[#3ca6a6]/18 text-xs font-semibold text-[#70caca]">
                          {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">Account</TooltipContent>
              </Tooltip>
              <DropdownMenuContent className="w-[248px]" align="start" side="right" sideOffset={14}>
                <div className="mb-1 flex items-center gap-2 border-b border-border/60 px-2 py-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/15 text-sm font-semibold text-primary">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || "User"} className="size-full object-cover" />
                    ) : (
                      user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{user?.displayName || "Fikr User"}</span>
                      {isPro && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-xs font-semibold text-amber-500">Pro</span>}
                      {isPlus && <span className="rounded bg-teal-400/15 px-1.5 py-0.5 text-xs font-semibold text-teal-500">Plus</span>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{user?.email || "Not signed in"}</p>
                  </div>
                </div>
                {!isManagedPlan && (
                  <DropdownMenuItem onClick={() => window.open("https://fikr.one", "_blank")}>
                    <Sparkles /> Upgrade to Pro
                  </DropdownMenuItem>
                )}
                {!isManagedPlan && (
                  <DropdownMenuItem onClick={() => onOpenSettings("llm")}>
                    <Key /> LLM Setup
                  </DropdownMenuItem>
                )}
                {user && (
                  <DropdownMenuItem onClick={() => onOpenSettings("account")}>
                    <Shield /> Manage Account
                  </DropdownMenuItem>
                )}
                {user && isManagedPlan && (
                  <DropdownMenuItem onClick={handleSyncNow} disabled={isSyncing}>
                    <RefreshCw className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? "Syncing…" : "Sync Now"}
                  </DropdownMenuItem>
                )}
                {mounted && (
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.preventDefault();
                      setTheme(theme === "dark" ? "light" : "dark");
                    }}
                  >
                    {theme === "dark" ? <Sun /> : <Moon />}
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setIsAboutOpen(true)}>
                  <HelpCircle /> About / Help
                </DropdownMenuItem>
                {onOpenKeyboardShortcuts && (
                  <DropdownMenuItem onClick={onOpenKeyboardShortcuts}>
                    <Keyboard /> Keyboard shortcuts
                    <DropdownMenuShortcut>⌘/</DropdownMenuShortcut>
                  </DropdownMenuItem>
                )}
                {user ? (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout} disabled={isLoggingOut}>
                    <LogOut className={isLoggingOut ? "animate-pulse" : ""} />
                    {isLoggingOut ? "Signing out…" : "Log out"}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-primary focus:text-primary"
                    onClick={() => {
                      const ipc = typeof window !== "undefined" && (window as any).fikrStudio;
                      if (ipc?.openAuth) ipc.openAuth();
                    }}
                  >
                    <LogIn /> Sign in
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {contextKind && showContextPanel && (
          <aside
            className="fikr-context-panel hidden lg:flex"
            aria-label={contextKind === "chats" ? "Recent chats" : "Workspaces"}
            data-testid="fikr-context-panel"
            data-context-kind={contextKind}
          >
            <div className="fikr-context-panel__header flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
              <div className="min-w-0 flex-1">
                <h1 className="fikr-toolbar-title text-sidebar-foreground">
                  {contextKind === "chats" ? "Chats" : "Knowledge"}
                </h1>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (contextKind === "chats") onNewChat();
                  else onCreateProject();
                  closeMobilePanel();
                }}
                className="h-8 shrink-0 rounded-md px-2.5 text-xs"
              >
                {contextKind === "chats" ? <SquarePen className="size-4.5" /> : <FolderClosed className="size-4.5" />}
                New
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="pb-4">
                {contextKind === "workspaces" && <section aria-labelledby="workspaces-heading" className="min-w-0">
                  <div className="flex h-10 items-center justify-between px-4 pt-1">
                    <h2 id="workspaces-heading" className="text-xs font-bold uppercase tracking-wide text-primary">
                      Workspaces
                    </h2>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {projects.length} {projects.length === 1 ? "space" : "spaces"}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-0.5 px-2">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        onDragOver={(event) => {
                          if (!onMoveNotes || project.id === activeProjectId) return;
                          if (!Array.from(event.dataTransfer.types).includes(NOTE_DRAG_MIME)) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDropTargetId(project.id);
                        }}
                        onDragLeave={(event) => {
                          const nextTarget = event.relatedTarget;
                          if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
                          if (dropTargetId === project.id) setDropTargetId(null);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const noteIds = decodeDraggedNoteIds(event.dataTransfer.getData(NOTE_DRAG_MIME));
                          setDropTargetId(null);
                          if (noteIds.length > 0 && project.id !== activeProjectId) onMoveNotes?.(noteIds, project.id);
                        }}
                        className={`group relative flex h-[52px] w-full min-w-0 items-center overflow-hidden rounded-lg transition-colors ${
                          dropTargetId === project.id
                            ? "bg-primary/14 ring-1 ring-inset ring-primary/25"
                            : activeProjectId === project.id && activeSurface === "Knowledge"
                              ? "bg-primary/10"
                              : "hover:bg-sidebar-accent/45"
                        }`}
                      >
                        {activeProjectId === project.id && activeSurface === "Knowledge" && (
                          <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" aria-hidden="true" />
                        )}
                        {editingId === project.id ? (
                          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/70 bg-background/65 text-sidebar-foreground/70">
                              {activeProjectId === project.id && activeSurface === "Knowledge" ? (
                                <FolderOpen className="size-4" strokeWidth={1.8} />
                              ) : (
                                <FolderClosed className="size-4" strokeWidth={1.8} />
                              )}
                            </span>
                            <input
                              ref={inputRef}
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") handleRename(project.id);
                                if (event.key === "Escape") setEditingId(null);
                              }}
                              onBlur={() => handleRename(project.id)}
                              className="min-w-0 flex-1 border-b border-primary/55 bg-transparent text-sm font-semibold text-sidebar-foreground outline-none"
                            />
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setActiveSurface("Knowledge");
                              onSelectProject(project.id);
                              closeMobilePanel();
                            }}
                            className="h-[52px] w-0 min-w-0 flex-1 justify-start gap-2.5 overflow-hidden rounded-lg px-3.5 text-sidebar-foreground hover:bg-transparent"
                          >
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                              activeProjectId === project.id && activeSurface === "Knowledge"
                                ? "border-primary/20 bg-primary/10 text-primary"
                                : "border-sidebar-border/70 bg-background/55 text-sidebar-foreground/60"
                            }`}>
                              {activeProjectId === project.id && activeSurface === "Knowledge" ? (
                                <FolderOpen className="size-4" strokeWidth={1.8} />
                              ) : (
                                <FolderClosed className="size-4" strokeWidth={1.8} />
                              )}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                              <span className={`w-full truncate text-sm leading-5 ${
                                activeProjectId === project.id && activeSurface === "Knowledge" ? "font-semibold" : "font-medium"
                              }`}>{project.name}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {project.blocks?.length || 0} {(project.blocks?.length || 0) === 1 ? "note" : "notes"}
                              </span>
                            </span>
                          </Button>
                        )}

                        {editingId !== project.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Workspace actions for ${project.name}`}
                                className="mr-1 shrink-0 rounded-md text-muted-foreground opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:opacity-100 group-hover:opacity-100"
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={6}>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditName(project.name);
                                  setEditingId(project.id);
                                }}
                              >
                                <Edit3 /> Rename
                              </DropdownMenuItem>
                              {projects.length > 1 && (
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingId(project.id)}>
                                  <Trash2 /> Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        <AnimatePresence>
                          {deletingId === project.id && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.12 }}
                              className="absolute inset-0 z-10 flex items-center justify-between bg-destructive px-3 text-white"
                            >
                              <span className="text-xs font-semibold">Delete workspace?</span>
                              <div className="flex items-center gap-1">
                                <Button type="button" size="icon-xs" variant="ghost" onClick={() => handleDelete(project.id)} aria-label={`Confirm deleting ${project.name}`} className="text-white hover:bg-white/16 hover:text-white">
                                  <Check />
                                </Button>
                                <Button type="button" size="icon-xs" variant="ghost" onClick={() => setDeletingId(null)} aria-label="Cancel deleting workspace" className="text-white hover:bg-black/12 hover:text-white">
                                  <X />
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </section>}

                {contextKind === "chats" && <section aria-label="Recent chats" className="min-w-0">
                  <div className="min-w-0">
                    {sortedThreads.map((thread) => (
                        <div
                          key={thread.id}
                          className={`group relative flex h-[50px] w-full min-w-0 items-center overflow-hidden transition-colors ${
                            activeChatThreadId === thread.id && activeSurface === "Chat"
                              ? "bg-sidebar-accent/70"
                              : "hover:bg-sidebar-accent/45"
                          }`}
                        >
                          {activeChatThreadId === thread.id && activeSurface === "Chat" && (
                            <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary" aria-hidden="true" />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => { setActiveSurface("Chat"); onSelectChatThread(thread.id); closeMobilePanel(); }}
                            aria-current={activeChatThreadId === thread.id && activeSurface === "Chat" ? "page" : undefined}
                            className="h-[50px] w-0 min-w-0 flex-1 justify-start overflow-hidden rounded-none px-3 py-2 text-sidebar-foreground hover:bg-transparent"
                          >
                            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                              <span className={`w-full truncate text-sm leading-5 ${
                                activeChatThreadId === thread.id && activeSurface === "Chat" ? "font-semibold" : "font-medium"
                              }`}>{thread.title}</span>
                              <span className="text-xs font-normal tabular-nums text-muted-foreground">
                                {mounted ? formatThreadActivity(thread.updatedAt) : "Recent"}
                              </span>
                            </span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                aria-label={`Chat options for ${thread.title}`}
                                className="mr-1 shrink-0 rounded-md text-muted-foreground opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                              >
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="right" sideOffset={6} className="w-40">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setChatPendingDeleteId(thread.id)}
                              >
                                <Trash2 /> Delete chat
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                    ))}
                  </div>
                </section>}
              </div>
            </ScrollArea>
            <div className="border-t border-sidebar-border p-4 lg:hidden">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { onOpenSettings("account"); onClose(); }}
                className="h-12 w-full justify-start rounded-xl px-3 text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <Settings className="size-[18px]" />
                Settings and account
              </Button>
            </div>
          </aside>
        )}

        <Sheet open={isOpen} onOpenChange={(open) => { if (open) onOpen?.(); else onClose(); }}>
          <SheetContent
            side="right"
            aria-label="Fikr menu"
            className="w-[min(88vw,360px)] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-[360px] lg:hidden"
          >
            <SheetHeader className="border-b border-sidebar-border px-5 pb-4 pt-5 text-left">
              <div className="flex items-center gap-3">
                <img src="./logo.svg" alt="" className="size-9 object-contain" />
                <div>
                  <SheetTitle className="text-base font-semibold tracking-tight text-sidebar-foreground">Fikr</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">Choose where you want to go.</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <nav className="grid grid-cols-2 gap-2 px-4 py-4" aria-label="Mobile navigation">
              {navigation.map(([surface, Icon]) => (
                <Button
                  key={surface}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setActiveSurface(surface);
                    onClose();
                  }}
                  aria-current={activeSurface === surface ? "page" : undefined}
                  className={`h-11 justify-start rounded-xl px-3 text-sm text-sidebar-foreground ${
                    activeSurface === surface
                      ? "bg-background/82 font-semibold shadow-sm"
                      : "hover:bg-sidebar-accent"
                  }`}
                >
                  <Icon className={`size-[17px] ${activeSurface === surface ? "text-primary" : "text-muted-foreground"}`} />
                  {surface}
                </Button>
              ))}
            </nav>

            {contextKind && showContextPanel && (
              <div className="flex min-h-0 flex-1 flex-col border-t border-sidebar-border">
                <div className="flex items-center gap-3 px-4 pb-2 pt-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-sidebar-foreground">
                      {contextKind === "chats" ? "Recent chats" : "Workspaces"}
                    </h2>
                    {contextKind === "workspaces" && <p className="mt-0.5 text-xs text-muted-foreground">Open a knowledge space.</p>}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (contextKind === "chats") onNewChat();
                      else onCreateProject();
                      onClose();
                    }}
                    className="h-9 rounded-xl border-sidebar-border bg-background/70 px-3 text-xs font-semibold text-sidebar-foreground hover:bg-background"
                  >
                    {contextKind === "chats" ? <SquarePen className="size-4" /> : <FolderClosed className="size-4" />}
                    New
                  </Button>
                </div>

                <ScrollArea className={`min-h-0 flex-1 pb-4 ${contextKind === "chats" ? "px-0" : "px-4"}`}>
                  {contextKind === "chats" ? (
                    <div>
                      {sortedThreads.map((thread) => (
                        <Button
                          key={thread.id}
                          type="button"
                          variant="ghost"
                          onClick={() => { setActiveSurface("Chat"); onSelectChatThread(thread.id); onClose(); }}
                          className={`h-[52px] w-full min-w-0 justify-start overflow-hidden rounded-none px-4 py-2 text-sidebar-foreground ${
                            activeChatThreadId === thread.id ? "bg-sidebar-accent/70" : "hover:bg-sidebar-accent/45"
                          }`}
                        >
                          <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
                            <span className={`w-full truncate text-sm leading-5 ${
                              activeChatThreadId === thread.id && activeSurface === "Chat" ? "font-semibold" : "font-medium"
                            }`}>{thread.title}</span>
                            <span className="text-xs font-normal tabular-nums text-muted-foreground">
                              {mounted ? formatThreadActivity(thread.updatedAt) : "Recent"}
                            </span>
                          </span>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {projects.map((project) => (
                        <Button
                          key={project.id}
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setActiveSurface("Knowledge");
                            onSelectProject(project.id);
                            onClose();
                          }}
                          className={`h-12 w-full min-w-0 justify-start overflow-hidden rounded-xl px-3 text-sidebar-foreground ${
                            activeProjectId === project.id ? "bg-background/82" : "hover:bg-sidebar-accent"
                          }`}
                        >
                          {activeProjectId === project.id && activeSurface === "Knowledge" ? (
                            <FolderOpen className="size-4 shrink-0 text-primary" />
                          ) : (
                            <FolderClosed className="size-4 shrink-0 text-primary" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{project.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{project.blocks?.length || 0}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            <div className="mt-auto border-t border-sidebar-border p-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { onOpenSettings("account"); onClose(); }}
                className="h-11 w-full justify-start rounded-xl px-3 text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <Settings className="size-[17px]" />
                Settings and account
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <AboutPanel open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
        <Dialog open={Boolean(chatPendingDeleteId)} onOpenChange={(open) => { if (!open) setChatPendingDeleteId(null); }}>
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete this chat?</DialogTitle>
              <DialogDescription>
                {sortedThreads.find((thread) => thread.id === chatPendingDeleteId)?.title ?? "This conversation"} will be removed from recent chats. You can undo immediately afterward.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (chatPendingDeleteId) onDeleteChat(chatPendingDeleteId);
                  setChatPendingDeleteId(null);
                }}
              >
                Delete chat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

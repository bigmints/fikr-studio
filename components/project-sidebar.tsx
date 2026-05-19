"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Check,
  X,
  Edit3,
  LayoutGrid,
  Search,
  ChevronDown,
  Sparkles,
  Key,
  Plug,
  LogOut,
  LogIn,
  Shield,
  CreditCard,
  FileText,
  Moon,
  Sun,
  Keyboard,
  HelpCircle,
  RefreshCw,
} from "lucide-react";

import { useTheme } from "next-themes";
import { AboutPanel } from "@/components/about-panel";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type AISettings } from "@/lib/ai-settings";
import { signInWithCustomToken, signOut, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import { limitWords } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  blocks: any[];
  collapsedIds: string[];
}

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onRenameProject: (id: string, newName: string) => void;
  onDeleteProject: (id: string) => void;
  openToSettings?: boolean;
  onSettingsOpened?: () => void;
  onOpenSettings: (section: "llm" | "account" | "connections") => void;
  // AI Settings
  aiSettings: AISettings;
  onUpdateAISettings: (patch: Partial<AISettings>) => void;
  mcpPort?: number | null;
  activeApp: string;
  setActiveApp: (app: string) => void;
  studioProjects?: any[];
  activeStudioProjectId?: string;
  onSelectStudioProject?: (id: string) => void;
  onCreateStudioProject?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  activeStudioWordCount?: number;
}

export function ProjectSidebar({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  aiSettings,
  onUpdateAISettings,
  openToSettings,
  onSettingsOpened,
  onOpenSettings,
  mcpPort,
  activeApp,
  setActiveApp,
  studioProjects = [],
  activeStudioProjectId = "",
  onSelectStudioProject = () => {},
  onCreateStudioProject = () => {},
  onOpenKeyboardShortcuts = () => {},
  activeStudioWordCount,
}: ProjectSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Firebase Auth State (kept in sidebar for continuous MCP relay)
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<string>("Free");
  const [relayApiKey, setRelayApiKey] = useState<string>("");

  // Firebase Auth + Auth Token Listener
  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();

    let unsubscribeUserDoc: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        unsubscribeUserDoc = onSnapshot(
          doc(db, "users", currentUser.uid),
          async (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setUserPlan(data.plan || "Free");
              if (!data.relayApiKey) {
                const newKey = "fp_" + crypto.randomUUID().replace(/-/g, "");
                await updateDoc(doc(db, "users", currentUser.uid), {
                  relayApiKey: newKey,
                });
                setRelayApiKey(newKey);
              } else {
                setRelayApiKey(data.relayApiKey);
              }
            }
          },
        );
      } else {
        setRelayApiKey("");
        if (unsubscribeUserDoc) unsubscribeUserDoc();
      }
    });

    // Listen to deep-linked auth tokens from Electron
    // @ts-ignore
    const unsubscribeIpc = window.fikrStudio?.onExternalEvent?.((eventData) => {
      if (eventData.type === "auth-token" && eventData.payload?.token) {
        signInWithCustomToken(auth, eventData.payload.token).catch(() => {});
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      // @ts-ignore
      if (unsubscribeIpc) unsubscribeIpc();
    };
  }, []);

  // Listen to Firestore MCP Queue when Relay is Enabled (must stay active)
  useEffect(() => {
    if (!user) return;

    const db = getFirebaseDb();
    const queueRef = collection(db, "users", user.uid, "mcp_queue");

    console.log("[Fikr Studio Relay] Listening for cloud MCP payloads...");
    const unsubscribeQueue = onSnapshot(queueRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added" || change.type === "modified") {
          const data = change.doc.data();
          if (data.status === "pending" && data.payload) {
            console.log(
              "[Fikr Studio Relay] Received payload:",
              data.payload.method,
            );

            try {
              const payload =
                typeof data.payload === "string"
                  ? JSON.parse(data.payload)
                  : data.payload;
              // @ts-ignore
              const result = await window.fikrStudio.executeMcp(payload);

              if (result !== null && payload.id !== undefined) {
                await updateDoc(
                  doc(db, "users", user.uid, "mcp_queue", change.doc.id),
                  { status: "completed", result },
                ).catch(console.error);
              } else {
                await updateDoc(
                  doc(db, "users", user.uid, "mcp_queue", change.doc.id),
                  { status: "completed", result: null },
                ).catch(console.error);
              }
            } catch (err: any) {
              const errMsg = err.message || "Unknown error";
              await updateDoc(
                doc(db, "users", user.uid, "mcp_queue", change.doc.id),
                { status: "error", error: errMsg },
              ).catch(console.error);
            }
          }
        }
      });
    });

    return () => unsubscribeQueue();
  }, [user]);


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
  }, [openToSettings]);

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

  const handleClose = () => {
    onClose();
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
        const currentData = { projects, activeProjectId };
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

  return (
    <div
      className="studio-sidebar relative z-50"
    >
      {/* macOS traffic light spacer — drag region */}
      <div className="studio-sidebar__drag-region" />

        {/* App Switcher */}
        <div className="px-4 pb-3 shrink-0 border-b border-border/10 mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center w-full hover:bg-sidebar-foreground/10 p-1.5 -ml-1.5 rounded-md transition-colors text-left group gap-2 focus:outline-none text-sidebar-foreground">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg shadow-sm overflow-hidden bg-primary/20">
                  <img src="./logo-icon.png" alt="Fikr Logo" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none flex-1">
                  <span className="font-semibold text-sm">{activeApp}</span>
                  <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest font-mono">Workspace</span>
                </div>
                <ChevronDown className="h-4 w-4 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[248px] border-border/50 bg-background/95 backdrop-blur-md" align="start" side="bottom" sideOffset={8}>
              <DropdownMenuItem onClick={() => setActiveApp("Fikr Intel")} className="gap-2 cursor-pointer p-2 focus:bg-foreground/5">
                <div className="flex aspect-square size-6 items-center justify-center rounded-sm border border-border/50 bg-primary/10 overflow-hidden">
                  <img src="./logo-icon.png" alt="Fikr Logo" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium text-sm">Fikr Intel</span>
                  <span className="text-[10px] text-muted-foreground">Spatial Canvas</span>
                </div>
                {activeApp === "Fikr Intel" && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveApp("Fikr Studio")} className="gap-2 cursor-pointer p-2 focus:bg-foreground/5">
                <div className="flex aspect-square size-6 items-center justify-center rounded-sm border border-border/50 bg-primary/10 overflow-hidden">
                  <img src="./logo-icon.png" alt="Fikr Logo" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium text-sm">Fikr Studio</span>
                  <span className="text-[10px] text-muted-foreground">Creative Workspace</span>
                </div>
                {activeApp === "Fikr Studio" && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>

              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Project List only visible in Fikr Intel */}
          <div className="flex-1 overflow-hidden flex flex-col">
        {activeApp === "Fikr Intel" ? (
          <>
            {/* Title & Search */}
            <div className="px-4 pb-3 shrink-0 flex flex-col gap-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/60 select-none">
                Spaces
              </h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/50" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find a space..."
                  className="w-full bg-sidebar-foreground/5 border border-sidebar-border rounded-md py-1.5 pl-8 pr-3 text-[12px] text-sidebar-foreground focus:outline-none focus:border-primary/50 transition-colors placeholder:text-sidebar-foreground/40"
                />
              </div>
            </div>

            {/* Content — project list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 custom-scrollbar">
              {projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((project) => (
                <div
                  key={project.id}
                  className={`group relative rounded-sm transition-all duration-150 ${
                    activeProjectId === project.id
                      ? "bg-primary/10 shadow-sm"
                      : "hover:bg-sidebar-foreground/10"
                  }`}
                >
                  <div className="flex items-center p-2 px-2.5">
                    <button
                      onClick={() => onSelectProject(project.id)}
                      className="flex-1 text-left flex flex-col gap-0 overflow-hidden"
                    >
                      {editingId === project.id ? (
                        <input
                          ref={inputRef}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(project.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onBlur={() => handleRename(project.id)}
                          className="bg-transparent font-mono text-xs font-bold text-sidebar-foreground focus:outline-none w-full border-b border-primary/50 py-0"
                        />
                      ) : (
                        <span
                          className={`font-mono text-[12px] font-bold truncate ${
                            activeProjectId === project.id
                              ? "text-primary"
                              : "text-sidebar-foreground/80 group-hover:text-sidebar-foreground"
                          }`}
                        >
                          {project.name}
                        </span>
                      )}
                      <span className="font-mono text-[8px] text-sidebar-foreground/60 uppercase tracking-tighter font-bold">
                        {project.blocks?.length || 0}{" "}
                        {(project.blocks?.length || 0) === 1 ? "node" : "nodes"}
                      </span>
                    </button>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingId !== project.id && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditName(project.name);
                              setEditingId(project.id);
                            }}
                            className="p-1 hover:bg-sidebar-foreground/10 rounded-sm text-sidebar-foreground/60 hover:text-primary transition-colors"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          {(projects?.length || 0) > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(project.id);
                              }}
                              className="p-1 hover:bg-destructive/20 rounded-sm text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Delete Confirmation Overlay */}
                  <AnimatePresence>
                    {deletingId === project.id && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0 }}
                        className="absolute inset-0 z-10 bg-destructive/95 backdrop-blur-md rounded-sm flex items-center justify-between px-3"
                      >
                        <span className="font-mono text-[8px] font-bold text-white uppercase tracking-tighter">
                          Delete Space?
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(project.id)}
                            className="p-1 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="p-1 bg-black/30 hover:bg-black/40 rounded-full text-white transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-sidebar-border shrink-0">
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={onCreateProject}
                  className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
                >
                  <span>New Space</span>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 pb-3 shrink-0 flex flex-col gap-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/60 select-none">
                Studio Projects
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 custom-scrollbar">
              {studioProjects.filter(p => !p.archived).map((project) => (
                <div
                  key={project.id}
                  className={`group relative rounded-sm transition-all duration-150 ${
                    activeStudioProjectId === project.id
                      ? "bg-primary/10 shadow-sm"
                      : "hover:bg-sidebar-foreground/10"
                  }`}
                >
                  <div className="flex items-center p-2 px-2.5">
                    <button
                      onClick={() => onSelectStudioProject(project.id)}
                      className="flex-1 text-left flex flex-col gap-0 overflow-hidden"
                    >
                      <span
                        className={`font-mono text-[12px] font-bold truncate ${
                          activeStudioProjectId === project.id
                            ? "text-primary"
                            : "text-sidebar-foreground/80 group-hover:text-sidebar-foreground"
                        }`}
                      >
                        {limitWords(project.name || "Untitled", 3)}
                      </span>
                      <span className="font-mono text-[8px] text-sidebar-foreground/60 uppercase tracking-tighter font-bold">
                        {activeStudioProjectId === project.id && activeStudioWordCount
                          ? `${activeStudioWordCount.toLocaleString()} words • ${project.platform}`
                          : `${project.mode} • ${project.platform}`}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
              
              {studioProjects.filter(p => !p.archived).length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-50 mt-10">
                  <FileText className="size-6 mb-2" />
                  <p className="text-xs">No projects yet</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-sidebar-border shrink-0">
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={onCreateStudioProject}
                  className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
                >
                  <span>New Studio Project</span>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
          </div>

        {/* User Profile */}
        <div className="p-3 shrink-0 border-t border-sidebar-border mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center w-full hover:bg-sidebar-foreground/10 p-1.5 -ml-1.5 rounded-md transition-colors text-left group gap-2 focus:outline-none text-sidebar-foreground">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-muted/20 overflow-hidden shrink-0">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || "User"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-primary/20 text-primary flex items-center justify-center font-bold font-mono text-[12px]">
                      {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 leading-none flex-1 overflow-hidden">
                  <span className="font-semibold text-sm truncate">{user?.displayName || "Fikr User"}</span>
                  <span className="text-[10px] text-sidebar-foreground/60 truncate">{user?.email || "Not signed in"}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[240px] border-border/50 bg-background/95 backdrop-blur-md rounded-xl p-1 shadow-xl" align="start" side="right" sideOffset={12}>
              <div className="px-2 py-2 flex items-center gap-2 border-b border-border/50 mb-1">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-muted overflow-hidden shrink-0">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || "User"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-primary/20 text-primary flex items-center justify-center font-bold font-mono text-[12px]">
                      {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div className="flex flex-col leading-none overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm truncate">{user?.displayName || "Fikr User"}</span>
                    {isPro && (
                      <span className="bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold">Pro</span>
                    )}
                    {isPlus && (
                      <span className="bg-teal-400/20 text-teal-400 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold">Plus</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate">{user?.email || "Not signed in"}</span>
                </div>
              </div>
              {!isManagedPlan && (
                <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" onClick={() => window.open('https://fikr.one', '_blank')}>
                  <Sparkles className="size-4" />
                  <span>Upgrade to Pro</span>
                </DropdownMenuItem>
              )}
              {!isManagedPlan && (
                <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" onClick={() => onOpenSettings("llm")}>
                  <Key className="size-4" />
                  <span>LLM Setup</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" onClick={() => onOpenSettings("connections")}>
                <Plug className="size-4" />
                <span>Connections</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" onClick={() => onOpenSettings("account")}>
                <Shield className="size-4" />
                <span>Manage Account</span>
              </DropdownMenuItem>
              {isManagedPlan && (
                <DropdownMenuItem 
                  className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" 
                  onClick={handleSyncNow} 
                  disabled={isSyncing}
                >
                  <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                </DropdownMenuItem>
              )}
              <div className="my-1 mx-1 border-t border-border/40" />
              {mounted && (
                <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" onClick={(e) => {
                  e.preventDefault();
                  setTheme(theme === "dark" ? "light" : "dark");
                }}>
                  {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" onClick={() => onOpenKeyboardShortcuts()}>
                <Keyboard className="size-4" />
                <span>Keyboard Shortcuts</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" onClick={() => setIsAboutOpen(true)}>
                <HelpCircle className="size-4" />
                <span>About / Help</span>
              </DropdownMenuItem>
              <div className="my-1 mx-1 border-t border-border/40" />
              {user ? (
                <DropdownMenuItem
                  className="gap-2 cursor-pointer focus:bg-foreground/5 text-destructive focus:text-destructive rounded-md py-2"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <LogOut className={`size-4 ${isLoggingOut ? 'animate-pulse' : ''}`} />
                  <span>{isLoggingOut ? 'Signing out…' : 'Log out'}</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="gap-2 cursor-pointer focus:bg-foreground/5 text-primary focus:text-primary rounded-md py-2"
                  onClick={() => {
                    const ipc = typeof window !== "undefined" && (window as any).fikrStudio;
                    if (ipc?.openAuth) ipc.openAuth();
                  }}
                >
                  <LogIn className="size-4" />
                  <span>Sign in</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      <AboutPanel open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}



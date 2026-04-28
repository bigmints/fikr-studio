"use client";

import { useState, useRef, useEffect } from "react";
import { SettingsModal } from "@/components/settings-modal";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Settings,
  Trash2,
  Check,
  X,
  Edit3,
  LayoutGrid,
} from "lucide-react";
import { type AISettings } from "@/lib/ai-settings";
import { signInWithCustomToken, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";

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
  // AI Settings
  aiSettings: AISettings;
  onUpdateAISettings: (patch: Partial<AISettings>) => void;
  mcpPort?: number | null;
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
  mcpPort,
}: ProjectSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Firebase Auth State (kept in sidebar for continuous MCP relay)
  const [user, setUser] = useState<User | null>(null);
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
    const unsubscribeIpc = window.fikrpad?.onExternalEvent?.((eventData) => {
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

    console.log("[FikrPad Relay] Listening for cloud MCP payloads...");
    const unsubscribeQueue = onSnapshot(queueRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added" || change.type === "modified") {
          const data = change.doc.data();
          if (data.status === "pending" && data.payload) {
            console.log(
              "[FikrPad Relay] Received payload:",
              data.payload.method,
            );

            try {
              const payload =
                typeof data.payload === "string"
                  ? JSON.parse(data.payload)
                  : data.payload;
              // @ts-ignore
              const result = await window.fikrpad.executeMcp(payload);

              if (result !== null && payload.id !== undefined) {
                await updateDoc(
                  doc(db, "users", user.uid, "mcp_queue", change.doc.id),
                  { status: "completed", result },
                ).catch(async (e) => {
                  const noteRef = doc(
                    collection(db, "users", user.uid, "notes"),
                  );
                  await setDoc(noteRef, {
                    text: "Failed to updateDoc! Error: " + e.message,
                    timestamp: Date.now(),
                  });
                });
              } else {
                await updateDoc(
                  doc(db, "users", user.uid, "mcp_queue", change.doc.id),
                  { status: "completed", result: null },
                ).catch(async (e) => {
                  const noteRef = doc(
                    collection(db, "users", user.uid, "notes"),
                  );
                  await setDoc(noteRef, {
                    text:
                      "Failed to updateDoc notification! Error: " + e.message,
                    timestamp: Date.now(),
                  });
                });
              }
            } catch (err: any) {
              const errMsg = err.message || "Unknown error";
              const noteRef = doc(collection(db, "users", user.uid, "notes"));
              await setDoc(noteRef, {
                text: "executeMcp error: " + errMsg,
                timestamp: Date.now(),
              });
              await updateDoc(
                doc(db, "users", user.uid, "mcp_queue", change.doc.id),
                { status: "error", error: errMsg },
              );
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

  // Sync draft when panel opens
  // Jump straight to settings when requested externally
  useEffect(() => {
    if (openToSettings) {
      setShowSettingsModal(true);
      onSettingsOpened?.();
    }
  }, [openToSettings]);

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

  return (
    <div
      style={{
        width: isOpen ? 280 : 0,
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? "visible" : "hidden",
      }}
      className="relative z-50 transition-all duration-200 ease-in-out overflow-hidden bg-sidebar flex flex-col h-full"
    >
      <div className="w-[280px] flex flex-col h-full">
        <div
          className="flex h-10 items-center justify-between bg-card/5 backdrop-blur-md pr-3 pl-[76px] py-1.5 shrink-0 select-none"
          style={{ WebkitAppRegion: "drag" } as any}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-5 w-5 bg-primary/10 rounded-sm">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            </div>
            <h2 className="font-mono text-xs font-bold uppercase tracking-tight text-foreground/80 select-none">
              Spaces
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{ WebkitAppRegion: "no-drag" } as any}
            className="p-1 px-1.5 hover:bg-white/5 rounded-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content — project list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`group relative rounded-sm transition-all duration-150 ${
                activeProjectId === project.id
                  ? "bg-primary/10 shadow-[inset_0_1px_0px_rgba(255,255,255,0.05)]"
                  : "hover:bg-white/3"
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
                      className="bg-transparent font-mono text-xs font-bold text-foreground focus:outline-none w-full border-b border-primary/50 py-0"
                    />
                  ) : (
                    <span
                      className={`font-mono text-[12px] font-bold truncate ${
                        activeProjectId === project.id
                          ? "text-primary"
                          : "text-foreground/80 group-hover:text-foreground"
                      }`}
                    >
                      {project.name}
                    </span>
                  )}
                  <span className="font-mono text-[8px] text-muted-foreground uppercase tracking-tighter font-bold">
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
                        className="p-1 hover:bg-white/10 rounded-sm text-muted-foreground hover:text-primary transition-colors"
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
        <div className="p-3 bg-black/5 shrink-0">
          <div className="flex flex-col gap-1.5">
            <button
              onClick={onCreateProject}
              className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
            >
              <span>New Space</span>
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98]"
            >
              <span>Settings</span>
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        aiSettings={aiSettings}
        onUpdateAISettings={onUpdateAISettings}
        mcpPort={mcpPort}
      />
    </div>
  );
}

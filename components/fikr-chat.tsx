"use client";

import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Layers3,
  FileText,
  FolderPlus,
  ExternalLink,
  ImageIcon,
  Linkedin,
  Loader2,
  Plus,
  PlusSquare,
  Save,
  Search,
  Send,
  Square,
  Sparkles,
  X,
} from "lucide-react";
import {
  friendlyChatError,
  generateFikrChat,
  type ChatProject,
  type FikrArtifact,
  type FikrAgentEvent,
  type FikrChatAttachment,
  type FikrChatAttachmentInput,
  type FikrChatMessage,
  type FikrChatMemory,
  type FikrChatThread,
  type FikrOutputKind,
} from "@/lib/fikr-chat";
import { applyChatMemoryMutations } from "@/lib/chat-memory.mjs";
import { dedupeAgentEvents, recommendProjectForKnowledgeDraft, shouldOfferInsightSave, titleFromQuery } from "@/lib/chat-domain.mjs";
import { writeClipboardText } from "@/lib/clipboard";
import { creationDocumentFromArtifact } from "@/lib/creation-document.mjs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SharedMarkdown } from "@/components/shared-markdown";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

interface FikrChatProps {
  projects: ChatProject[];
  threads: FikrChatThread[];
  setThreads: Dispatch<SetStateAction<FikrChatThread[]>>;
  memories: FikrChatMemory[];
  setMemories: Dispatch<SetStateAction<FikrChatMemory[]>>;
  activeThreadId: string | null;
  onActiveThreadChange: (id: string | null) => void;
  onSaveKnowledge: (threadId: string, draft: { title: string; content: string; kind: Extract<FikrOutputKind, "insight" | "knowledge-note"> }, projectId: string) => boolean;
  onCreateSpace: (name: string) => string;
  isCreationSaved: (threadId: string, artifact: FikrArtifact) => boolean;
  onSaveCreation: (threadId: string, artifact: FikrArtifact) => boolean;
  onOpenCreations: () => void;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const IMAGE_ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/webp";
// Electron's macOS picker can leave valid PDFs disabled when MIME and extension
// filters are combined. The extension filter is portable and the selected file
// is still validated by attachmentMediaType before it enters chat state.
const PDF_ATTACHMENT_ACCEPT = ".pdf";
const CREATE_SPACE_VALUE = "__create-space__";

function attachmentMediaType(file: File): FikrChatAttachmentInput["mediaType"] | null {
  const type = file.type.toLowerCase();
  if (["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(type)) {
    return type as FikrChatAttachmentInput["mediaType"];
  }
  if (file.name.toLowerCase().endsWith(".pdf")) return "application/pdf";
  return null;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Couldn’t read that file"));
    reader.onerror = () => reject(new Error(`Couldn’t read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sourceForNote(projects: ChatProject[], noteId: string) {
  for (const project of projects) {
    const note = project.blocks.find((candidate) => candidate.id === noteId);
    if (note) return { project, note };
  }
  return null;
}

function knowledgeDraftForMessage(message: FikrChatMessage) {
  if (message.outputKind === "insight" && message.insightDraft) {
    return { ...message.insightDraft, kind: "insight" as const };
  }
  if (message.outputKind === "knowledge-note" && message.noteDraft) {
    return { ...message.noteDraft, kind: "knowledge-note" as const };
  }
  return null;
}

function artifactTypeLabel(artifact: FikrArtifact) {
  if (artifact.platform === "linkedin") return "LinkedIn post";
  if (artifact.platform === "x") return artifact.format === "thread" ? "X thread" : "X post";
  if (artifact.platform === "substack") return "Substack newsletter";
  return "Medium article";
}

export function FikrChat({
  projects,
  threads,
  setThreads,
  memories,
  setMemories,
  activeThreadId,
  onActiveThreadChange,
  onSaveKnowledge,
  onCreateSpace,
  isCreationSaved,
  onSaveCreation,
  onOpenCreations,
}: FikrChatProps) {
  const [draft, setDraft] = useState("");
  const [scopeProjectId, setScopeProjectId] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveKnowledgeMessageId, setSaveKnowledgeMessageId] = useState<string | null>(null);
  const [saveProjectId, setSaveProjectId] = useState(projects[0]?.id ?? "");
  const [suggestedSaveProjectId, setSuggestedSaveProjectId] = useState<string | null>(null);
  const [isCreateSpaceOpen, setIsCreateSpaceOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [savedKnowledgeIds, setSavedKnowledgeIds] = useState<Set<string>>(new Set());
  const [copiedArtifactIds, setCopiedArtifactIds] = useState<Set<string>>(new Set());
  const [expandedDetailIds, setExpandedDetailIds] = useState<Set<string>>(new Set());
  const [activeAgentEvents, setActiveAgentEvents] = useState<FikrAgentEvent[]>([]);
  const [pendingToolApproval, setPendingToolApproval] = useState<Pick<FikrAgentEvent, "runId" | "approvalId" | "serverName" | "toolName" | "arguments"> | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<FikrChatAttachmentInput[]>([]);
  const [sourcePreview, setSourcePreview] = useState<{ projectId: string; noteId: string } | null>(null);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const attachmentImageInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentPdfInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      if (saveProjectId) setSaveProjectId("");
      return;
    }
    if (!projects.some((project) => project.id === saveProjectId)) {
      setSaveProjectId(projects[0].id);
    }
  }, [projects, saveProjectId]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;
  const sourceProject = sourcePreview ? projects.find((project) => project.id === sourcePreview.projectId) : null;
  const sourceNote = sourceProject?.blocks.find((note) => note.id === sourcePreview?.noteId) ?? null;
  const currentScope = activeThread?.scope ?? (scopeProjectId === "all"
    ? { kind: "all" as const }
    : { kind: "projects" as const, projectIds: [scopeProjectId] });

  const scopeLabel = currentScope.kind === "all"
    ? "All knowledge"
    : projects.find((project) => project.id === currentScope.projectIds[0])?.name ?? "Selected workspace";

  const updateThread = (threadId: string, updater: (thread: FikrChatThread) => FikrChatThread) => {
    setThreads((current) => current.map((thread) => thread.id === threadId ? updater(thread) : thread));
  };

  const handleScopeChange = (projectId: string) => {
    const nextScope: FikrChatThread["scope"] = projectId === "all"
      ? { kind: "all" }
      : { kind: "projects", projectIds: [projectId] };
    setScopeProjectId(projectId);
    if (activeThread) {
      updateThread(activeThread.id, (thread) => ({ ...thread, scope: nextScope }));
    }
  };

  const addAttachments = async (selected: FileList | null) => {
    const files = Array.from(selected ?? []);
    if (files.length === 0) return;
    if (pendingAttachments.length + files.length > MAX_ATTACHMENTS) {
      setError(`Attach up to ${MAX_ATTACHMENTS} files at a time.`);
      return;
    }
    const currentBytes = pendingAttachments.reduce((total, attachment) => total + attachment.size, 0);
    const selectedBytes = files.reduce((total, file) => total + file.size, 0);
    if (files.some((file) => file.size > MAX_ATTACHMENT_BYTES)) {
      setError("Each attachment must be 10 MB or less.");
      return;
    }
    if (currentBytes + selectedBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      setError("Attachments must be 20 MB or less in total.");
      return;
    }
    const unsupported = files.find((file) => !attachmentMediaType(file));
    if (unsupported) {
      setError("Choose a PDF, PNG, JPEG, or WebP file.");
      return;
    }

    try {
      const prepared = await Promise.all(files.map(async (file) => {
        const mediaType = attachmentMediaType(file)!;
        return {
          id: makeId("attachment"),
          name: file.name.slice(0, 180),
          kind: mediaType === "application/pdf" ? "pdf" as const : "image" as const,
          mediaType,
          size: file.size,
          dataUrl: await readFileAsDataUrl(file),
        };
      }));
      setPendingAttachments((current) => [...current, ...prepared]);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t attach those files.");
    }
  };

  const submit = async (queryValue: string) => {
    const submittedAttachments = pendingAttachments;
    const query = queryValue.trim() || (submittedAttachments.length > 0 ? "Analyze the attached files." : "");
    if (!query || isLoading) return;
    setDraft("");
    setPendingAttachments([]);
    setError(null);
    setSaveKnowledgeMessageId(null);
    setActiveAgentEvents([]);
    setPendingToolApproval(null);

    const now = Date.now();
    const threadId = activeThread?.id ?? makeId("chat");
    const userMessage: FikrChatMessage = {
      id: makeId("message"),
      role: "user",
      content: query,
      createdAt: now,
      sourceNoteIds: [],
      outputKind: "answer",
      attachments: submittedAttachments.map((attachment): FikrChatAttachment => ({
        id: attachment.id,
        name: attachment.name,
        kind: attachment.kind,
        mediaType: attachment.mediaType,
        size: attachment.size,
      })),
    };
    const history = activeThread?.messages ?? [];
    const threadScope = activeThread?.scope ?? currentScope;

    if (activeThread) {
      updateThread(threadId, (thread) => ({ ...thread, messages: [...thread.messages, userMessage], updatedAt: now }));
    } else {
      setThreads((current) => [{
        id: threadId,
        title: titleFromQuery(query),
        createdAt: now,
        updatedAt: now,
        scope: threadScope,
        messages: [userMessage],
      }, ...current]);
      onActiveThreadChange(threadId);
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const generation = await generateFikrChat({
        query,
        projects,
        history,
        memories,
        attachments: submittedAttachments,
        scope: threadScope,
        signal: controller.signal,
        onAgentEvent: (event) => {
          setActiveAgentEvents((current) => [...current.slice(-7), event]);
          if (event.type === "approval_requested") setPendingToolApproval(event);
          if ((event.type === "approval_approved" || event.type === "approval_rejected")
            && event.approvalId === pendingToolApproval?.approvalId) setPendingToolApproval(null);
        },
      });
      const assistantMessage: FikrChatMessage = {
        id: makeId("message"),
        role: "assistant",
        content: generation.answer,
        createdAt: Date.now(),
        sourceNoteIds: generation.sources.map((source) => source.noteId),
        webSources: generation.webSources,
        documentSources: generation.documentSources,
        outputKind: generation.outputKind,
        artifact: generation.artifact,
        insightDraft: generation.insightDraft,
        noteDraft: generation.noteDraft,
        agentEvents: generation.agentEvents,
      };
      const generatedTitle = generation.artifact?.title
        ?? generation.insightDraft?.title
        ?? generation.noteDraft?.title
        ?? query;
      updateThread(threadId, (thread) => ({
        ...thread,
        title: activeThread ? thread.title : titleFromQuery(generatedTitle),
        messages: [...thread.messages, assistantMessage],
        updatedAt: assistantMessage.createdAt,
      }));
      if (generation.memoryMutations?.length) {
        setMemories((current) => applyChatMemoryMutations(current, generation.memoryMutations) as FikrChatMemory[]);
      }
      if (generation.artifact && !isCreationSaved(threadId, generation.artifact)) {
        onSaveCreation(threadId, generation.artifact);
      }
    } catch (caught) {
      if ((caught as { name?: string })?.name === "AbortError") {
        updateThread(threadId, (thread) => ({
          ...thread,
          messages: thread.messages.map((message) => message.id === userMessage.id
            ? { ...message, status: "stopped" }
            : message),
          updatedAt: Date.now(),
        }));
        setDraft(query);
        setPendingAttachments((current) => current.length > 0 ? current : submittedAttachments);
        setError("Stopped. Edit your message or send it again.");
      } else {
        setError(friendlyChatError(caught));
        setPendingAttachments((current) => current.length > 0 ? current : submittedAttachments);
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
      setActiveAgentEvents([]);
      setPendingToolApproval(null);
    }
  };

  const respondToToolApproval = async (approved: boolean) => {
    if (!pendingToolApproval?.approvalId) return;
    const ipc = typeof window !== "undefined" ? (window as any).fikrStudio : null;
    try {
      const accepted = await ipc?.respondAgentApproval?.(
        pendingToolApproval.runId,
        pendingToolApproval.approvalId,
        approved,
      );
      if (!accepted) throw new Error("This approval request is no longer active.");
      setPendingToolApproval(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t respond to this tool request.");
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(draft);
  };

  const saveKnowledge = (message: FikrChatMessage) => {
    if (!activeThread || !saveProjectId) return;
    const knowledgeDraft = knowledgeDraftForMessage(message);
    if (!knowledgeDraft) return;
    const saved = onSaveKnowledge(activeThread.id, knowledgeDraft, saveProjectId);
    if (saved) {
      setSavedKnowledgeIds((current) => new Set(current).add(message.id));
      setSaveKnowledgeMessageId(null);
    }
  };

  const toggleKnowledgeSave = (message: FikrChatMessage) => {
    if (saveKnowledgeMessageId === message.id) {
      setSaveKnowledgeMessageId(null);
      setSuggestedSaveProjectId(null);
      return;
    }
    const knowledgeDraft = knowledgeDraftForMessage(message);
    if (!knowledgeDraft) return;
    const recommendation = recommendProjectForKnowledgeDraft(knowledgeDraft, projects, {
      scope: currentScope,
      sourceNoteIds: [...message.sourceNoteIds, ...("sourceNoteIds" in knowledgeDraft ? knowledgeDraft.sourceNoteIds : [])],
    });
    const fallback = projects.some((project) => project.id === saveProjectId)
      ? saveProjectId
      : projects[0]?.id ?? "";
    setSaveProjectId(recommendation ?? fallback);
    setSuggestedSaveProjectId(recommendation);
    setSaveKnowledgeMessageId(message.id);
  };

  const handleSaveSpaceChange = (projectId: string) => {
    if (projectId === CREATE_SPACE_VALUE) {
      setNewSpaceName("");
      setIsCreateSpaceOpen(true);
      return;
    }
    setSaveProjectId(projectId);
    if (projectId !== suggestedSaveProjectId) setSuggestedSaveProjectId(null);
  };

  const createSpace = (event: FormEvent) => {
    event.preventDefault();
    const name = newSpaceName.trim();
    if (!name) return;
    const projectId = onCreateSpace(name);
    setSaveProjectId(projectId);
    setSuggestedSaveProjectId(null);
    setIsCreateSpaceOpen(false);
    setNewSpaceName("");
  };

  const copyArtifact = async (message: FikrChatMessage) => {
    if (!message.artifact) return;
    await writeClipboardText(creationDocumentFromArtifact(message.artifact));
    setCopiedArtifactIds((current) => new Set(current).add(message.id));
    window.setTimeout(() => setCopiedArtifactIds((current) => {
      const next = new Set(current);
      next.delete(message.id);
      return next;
    }), 1_500);
  };

  const renderAnswer = (message: FikrChatMessage) => {
    const citationMarkdown = message.content
      .replace(/\[([#\d,\s]+)\](?!\()/g, (marker, contents: string) => {
        const indices = Array.from(contents.matchAll(/\d+/g), (match) => Number(match[0]));
        if (indices.length === 0) return marker;
        return indices.map((index) => `[${index}](#fikr-source-${index})`).join(" ");
      })
      .replace(/\[W(\d+)\](?!\()/gi, (_marker, index: string) => `[W${index}](#fikr-web-source-${index})`);
    const linkedCitationMarkdown = citationMarkdown
      .replace(/\[D(\d+):p\.(\d+)\](?!\()/gi, (_marker, documentIndex: string, pageNumber: string) => `[D${documentIndex}:p.${pageNumber}](#fikr-document-source-D${documentIndex}-p-${pageNumber})`);
    return (
      <SharedMarkdown
        components={{
          a: ({ href, children }) => {
            const documentMatch = href?.match(/^#fikr-document-source-D(\d+)-p-(\d+)$/i);
            if (documentMatch) {
              const citation = `D${Number(documentMatch[1])}:p.${Number(documentMatch[2])}`;
              const source = message.documentSources?.find((candidate) => candidate.citation === citation);
              return source ? (
                <span
                  className="fikr-chat-citation"
                  aria-label={`${source.name}, page ${source.pageNumber}${source.extractionMethod === "ocr" ? ", read with OCR" : ""}`}
                  title={`${source.name} · page ${source.pageNumber}${source.extractionMethod === "ocr" ? " · OCR" : ""}`}
                >
                  {citation}
                </span>
              ) : <span>{children}</span>;
            }
            const webMatch = href?.match(/^#fikr-web-source-(\d+)$/);
            if (webMatch) {
              const source = message.webSources?.[Number(webMatch[1]) - 1];
              const canOpen = source?.finalUrl.startsWith("https://");
              return source ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="fikr-chat-citation"
                  aria-label={`Open web source ${webMatch[1]}: ${source.title}`}
                  disabled={!canOpen}
                  onClick={() => {
                    const ipc = (window as any).fikrStudio;
                    if (ipc?.openUrl) void ipc.openUrl(source.finalUrl);
                  }}
                >
                  W{webMatch[1]}
                </Button>
              ) : <span>{children}</span>;
            }
            const match = href?.match(/^#fikr-source-(\d+)$/);
            if (!match) return href ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span>;
            const noteId = message.sourceNoteIds[Number(match[1]) - 1];
            const source = noteId ? sourceForNote(projects, noteId) : null;
            return source ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="fikr-chat-citation"
                aria-label={`Open source ${match[1]}: ${source.note.title || source.note.category || "Knowledge note"}`}
                onClick={() => setSourcePreview({ projectId: source.project.id, noteId })}
              >
                {match[1]}
              </Button>
            ) : <span>{children}</span>;
          },
        }}
      >
        {linkedCitationMarkdown}
      </SharedMarkdown>
    );
  };

  const visibleAgentActivity = (events: FikrAgentEvent[] | undefined) => (dedupeAgentEvents(events ?? []) as FikrAgentEvent[])
    .filter((event) => event.type === "tool_completed" || event.type === "mcp_connected");

  const scopeControl = (
    <Select
      value={currentScope.kind === "all" ? "all" : currentScope.projectIds[0]}
      onValueChange={handleScopeChange}
    >
      <SelectTrigger aria-label="Knowledge scope" title="Choose knowledge scope" className="h-9 min-w-0 max-w-56 rounded-md border-0 bg-secondary/80 px-2.5 text-xs font-medium text-foreground hover:bg-secondary focus:ring-ring/25 sm:px-3">
        <Layers3 className="size-3.5 shrink-0 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value="all">All knowledge</SelectItem>
        {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const attachmentTray = pendingAttachments.length > 0 && (
    <div className="mb-2 flex flex-wrap gap-2" aria-label="Files ready to attach">
      {pendingAttachments.map((attachment) => (
        attachment.kind === "image" ? (
          <div key={attachment.id} className="group relative size-16 overflow-hidden rounded-xl border border-border/70 bg-muted" title={`${attachment.name} · ${formatFileSize(attachment.size)}`}>
            <img src={attachment.dataUrl} alt={attachment.name} className="size-full object-cover" />
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              onClick={() => setPendingAttachments((current) => current.filter((candidate) => candidate.id !== attachment.id))}
              aria-label={`Remove ${attachment.name}`}
              className="absolute right-1 top-1 rounded-full bg-background/90 text-foreground opacity-90 shadow-sm backdrop-blur-sm hover:bg-background group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div key={attachment.id} className="group flex h-16 max-w-60 items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/45 py-2 pl-2 pr-1.5 text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-primary"><FileText className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-foreground">{attachment.name}</span>
              <span className="block text-xs text-muted-foreground">PDF · {formatFileSize(attachment.size)}</span>
            </span>
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => setPendingAttachments((current) => current.filter((candidate) => candidate.id !== attachment.id))} aria-label={`Remove ${attachment.name}`} className="shrink-0 rounded-full text-muted-foreground">
              <X className="size-3.5" />
            </Button>
          </div>
        )
      ))}
    </div>
  );

  const attachmentInputs = (
    <>
      <input
        ref={attachmentImageInputRef}
        type="file"
        accept={IMAGE_ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        aria-label="Choose images"
        onChange={(event) => {
          void addAttachments(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={attachmentPdfInputRef}
        type="file"
        accept={PDF_ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        aria-label="Choose PDFs"
        onChange={(event) => {
          void addAttachments(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
    </>
  );

  const renderAttachmentMenu = (side: "top" | "bottom") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={pendingAttachments.length >= MAX_ATTACHMENTS}
          aria-label="Add photos or files"
          title={pendingAttachments.length >= MAX_ATTACHMENTS ? `Maximum ${MAX_ATTACHMENTS} attachments` : "Add photos or files"}
          className="group size-9 shrink-0 rounded-full bg-secondary/70 text-foreground hover:bg-secondary data-[state=open]:bg-secondary"
        >
          <Plus className="size-[18px] transition-transform duration-150 group-data-[state=open]:rotate-45" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={side} sideOffset={side === "top" ? 60 : 10} className="w-60">
        <DropdownMenuItem onSelect={() => attachmentImageInputRef.current?.click()} className="items-start py-2.5">
          <ImageIcon className="mt-0.5 text-primary" />
          <span className="grid gap-0.5">
            <span className="font-medium">Upload image</span>
            <span className="text-xs font-normal text-muted-foreground">PNG, JPG or WebP</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => attachmentPdfInputRef.current?.click()} className="items-start py-2.5">
          <FileText className="mt-0.5 text-primary" />
          <span className="grid gap-0.5">
            <span className="font-medium">Upload PDF</span>
            <span className="text-xs font-normal text-muted-foreground">PDF up to 10 MB</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!activeThread || activeThread.messages.length === 0) {
    return (
      <main className="fikr-chat-home min-h-0 flex-1 overflow-y-auto dark:bg-background dark:text-foreground" data-testid="chat-home">
        <div className="fikr-chat-home-layout mx-auto flex min-h-full w-full max-w-[900px] flex-col justify-start px-5 pb-10 pt-[16vh] sm:px-8 sm:pb-16 sm:pt-[20vh] lg:px-10 lg:pt-[22vh]">
          <div className="w-full text-center">
            <h1 className="fikr-chat-title mx-auto max-w-[680px] text-balance font-sans text-4xl font-bold leading-none tracking-tighter text-foreground sm:text-5xl">
              What do you want to know or <em className="font-bold text-primary">make?</em>
            </h1>
            <form
              onSubmit={handleSubmit}
              className="fikr-chat-home-composer mx-auto mt-7 max-w-[720px] rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-[border-color,box-shadow] focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/15 sm:px-5 sm:py-4"
            >
              {attachmentInputs}
              {attachmentTray}
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit(draft);
                  }
                }}
                rows={2}
                autoFocus
                aria-label="Ask Fikr"
                placeholder="Ask Fikr about your knowledge, an idea, or something you want to create…"
                className="w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="mt-3 flex items-end justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  {renderAttachmentMenu("bottom")}
                  {scopeControl}
                </div>
                <Button
                  type="submit"
                  size="icon"
                  disabled={(!draft.trim() && pendingAttachments.length === 0) || isLoading}
                  aria-label="Send message"
                  className="size-9 rounded-full shadow-none"
                >
                  <ArrowUp className="size-5" />
                </Button>
              </div>
            </form>

            <div className="fikr-chat-starters mt-4 grid w-full gap-1 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-1">
              <Button type="button" variant="ghost" onClick={() => void submit("Find patterns in my notes")} className="h-9 w-full justify-start rounded-md px-3 text-sm text-foreground/70 sm:w-auto sm:justify-center">
                <Search className="size-4 text-primary" />Find patterns in my notes
              </Button>
              <Button type="button" variant="ghost" onClick={() => void submit("Create a LinkedIn post from my knowledge")} className="h-9 w-full justify-start rounded-md px-3 text-sm text-foreground/70 sm:w-auto sm:justify-center">
                <Linkedin className="size-4 text-primary" />Create a LinkedIn post
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDraft("Save a new idea: ")} className="h-9 w-full justify-start rounded-md px-3 text-sm text-foreground/70 sm:w-auto sm:justify-center">
                <PlusSquare className="size-4 text-primary" />Save a new idea
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background" data-testid="chat-conversation">
      <header className="flex min-h-14 shrink-0 items-center border-b border-border/60 px-4 py-3 sm:px-5 sm:py-0">
        <div className="min-w-0 flex-1">
          <p className="fikr-toolbar-title truncate">{activeThread.title}</p>
          <p className="fikr-toolbar-subtitle">Grounded in {scopeLabel}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-[760px] space-y-7">
          {activeThread.messages.map((message) => message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[90%] rounded-md bg-secondary/75 px-3.5 py-2.5 text-sm leading-6 sm:max-w-[78%]">
                <p>{message.content}</p>
                {message.status === "stopped" && (
                  <p className="mt-1 text-xs text-muted-foreground">Stopped · ready to retry</p>
                )}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Attached files">
                    {message.attachments.map((attachment) => (
                      <span key={attachment.id} className="inline-flex max-w-52 items-center gap-1.5 rounded-md bg-background/65 px-2 py-1 text-xs text-muted-foreground">
                        {attachment.kind === "image" ? <ImageIcon className="size-3.5 shrink-0" /> : <FileText className="size-3.5 shrink-0" />}
                        <span className="truncate">{attachment.name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <article key={message.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 sm:grid-cols-[32px_minmax(0,1fr)] sm:gap-4">
              <span className="flex size-8 items-center justify-center rounded-md bg-secondary/75 text-primary"><Sparkles className="size-4" /></span>
              <div className="min-w-0">
                <div className="fikr-reading-markdown fikr-chat-markdown max-w-[680px]">{renderAnswer(message)}</div>
                {message.artifact && (
                  <Card className="mt-5 gap-0 overflow-hidden border-primary/20 py-0 shadow-sm" data-testid="social-artifact">
                    <CardHeader className="gap-1 border-b border-border/60 bg-primary/[0.045] px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="flex size-7 items-center justify-center rounded-md bg-primary/12 text-primary">
                            {message.artifact.platform === "linkedin" ? <Linkedin className="size-3.5" /> : <FileText className="size-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{message.artifact.title || artifactTypeLabel(message.artifact)}</p>
                            {message.artifact.subtitle && <p className="mt-0.5 text-xs font-normal text-muted-foreground">{message.artifact.subtitle}</p>}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{artifactTypeLabel(message.artifact)} · {message.artifact.sourceNoteIds.length > 0 ? "From your knowledge" : (message.artifact.sourceUrls?.length ?? 0) > 0 ? "From a webpage" : "From your attachment"}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 py-4 sm:px-5">
                      <SharedMarkdown className="fikr-artifact-markdown text-sm">
                        {message.artifact.content}
                      </SharedMarkdown>
                      {message.artifact.platform === "medium" && message.artifact.hashtags.length > 0 && (
                        <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                          Tags · {message.artifact.hashtags.join(" · ")}
                        </p>
                      )}
                    </CardContent>
                    <CardFooter className="flex-wrap justify-between gap-2 border-t border-border/60 bg-secondary/20 px-3 py-2.5 sm:px-4">
                      <span className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground" role="status">
                        {isCreationSaved(activeThread.id, message.artifact) ? <Check className="size-3.5 text-primary" /> : <X className="size-3.5" />}
                        {isCreationSaved(activeThread.id, message.artifact) ? "Saved to Creations" : "Not in Creations"}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => void copyArtifact(message)}>
                          {copiedArtifactIds.has(message.id) ? <Check className="size-4" /> : <Copy className="size-4" />}{copiedArtifactIds.has(message.id) ? "Copied" : "Copy"}
                        </Button>
                        {isCreationSaved(activeThread.id, message.artifact) ? (
                          <Button type="button" size="sm" onClick={onOpenCreations}>Open in Creations</Button>
                        ) : (
                          <Button type="button" size="sm" onClick={() => onSaveCreation(activeThread.id, message.artifact!)}>Save to Creations</Button>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                )}
                {(visibleAgentActivity(message.agentEvents).length > 0 || message.sourceNoteIds.length > 0 || (message.webSources?.length ?? 0) > 0 || (message.documentSources?.length ?? 0) > 0) && (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-expanded={expandedDetailIds.has(message.id)}
                      onClick={() => setExpandedDetailIds((current) => {
                        const next = new Set(current);
                        if (next.has(message.id)) next.delete(message.id); else next.add(message.id);
                        return next;
                      })}
                      className="h-8 px-2 text-xs text-muted-foreground"
                    >
                      Details
                      {visibleAgentActivity(message.agentEvents).length > 0 && ` · ${visibleAgentActivity(message.agentEvents).length} steps`}
                      {(message.sourceNoteIds.length + (message.webSources?.length ?? 0) + (message.documentSources?.length ?? 0)) > 0 && ` · ${message.sourceNoteIds.length + (message.webSources?.length ?? 0) + (message.documentSources?.length ?? 0)} sources`}
                      <ChevronDown className={`size-3.5 transition-transform ${expandedDetailIds.has(message.id) ? "rotate-180" : ""}`} />
                    </Button>
                    {expandedDetailIds.has(message.id) && (
                      <div className="mt-2 rounded-lg bg-secondary/35 p-3">
                        {visibleAgentActivity(message.agentEvents).length > 0 && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Agent activity">
                            {visibleAgentActivity(message.agentEvents).map((event, index) => (
                              <span key={`${message.id}-agent-event-${index}`} className="inline-flex items-center gap-1.5">
                                <Check className="size-3.5 text-primary" />{event.message}
                              </span>
                            ))}
                          </div>
                        )}
                        {message.sourceNoteIds.length > 0 && <ol className="mt-2 space-y-0.5" data-testid="chat-sources">
                      {message.sourceNoteIds.map((noteId, index) => {
                        const source = sourceForNote(projects, noteId);
                        return source ? (
                          <li key={noteId}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => setSourcePreview({ projectId: source.project.id, noteId })}
                              className="h-auto w-full justify-start whitespace-normal px-1.5 py-1.5 text-left text-xs font-normal leading-5 text-muted-foreground hover:text-foreground"
                            >
                              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-primary/12 text-xs font-semibold text-primary">{index + 1}</span>
                              <span className="min-w-0 break-words">{source.note.title || source.note.category || source.project.name}</span>
                            </Button>
                          </li>
                        ) : null;
                      })}
                        </ol>}
                        {(message.webSources?.length ?? 0) > 0 && (
                          <ol className="mt-2 space-y-0.5" data-testid="chat-web-sources">
                            {message.webSources!.map((source, index) => (
                              <li key={`${source.finalUrl}-${index}`}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  disabled={!source.finalUrl.startsWith("https://")}
                                  onClick={() => {
                                    const ipc = (window as any).fikrStudio;
                                    if (ipc?.openUrl) void ipc.openUrl(source.finalUrl);
                                  }}
                                  className="h-auto w-full justify-start whitespace-normal px-1.5 py-1.5 text-left text-xs font-normal leading-5 text-muted-foreground hover:text-foreground"
                                >
                                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-primary/12 text-[10px] font-semibold text-primary">W{index + 1}</span>
                                  <span className="min-w-0 flex-1 break-words">{source.title || source.siteName || source.finalUrl}</span>
                                  <ExternalLink className="size-3.5 shrink-0" />
                                </Button>
                              </li>
                            ))}
                          </ol>
                        )}
                        {(message.documentSources?.length ?? 0) > 0 && (
                          <ol className="mt-2 space-y-0.5" data-testid="chat-document-sources">
                            {message.documentSources!.map((source) => (
                              <li key={source.citation} className="flex min-h-8 items-center gap-2 px-1.5 py-1 text-xs text-muted-foreground">
                                <span className="inline-flex min-w-12 shrink-0 items-center justify-center rounded bg-primary/12 px-1.5 py-1 text-[10px] font-semibold text-primary">{source.citation}</span>
                                <FileText className="size-3.5 shrink-0" />
                                <span className="min-w-0 flex-1 break-words">{source.name} · page {source.pageNumber}</span>
                                {source.extractionMethod === "ocr" && <span className="text-[10px] uppercase tracking-wide">OCR</span>}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {shouldOfferInsightSave(message) && message.insightDraft && (
                  <section className="mt-6 border-t border-border pt-5" data-testid="insight-output">
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary"><Sparkles className="size-3.5" />Insight</p>
                    <h3 className="font-display text-lg font-medium">{message.insightDraft.title}</h3>
                    <SharedMarkdown className="mt-2">{message.insightDraft.content}</SharedMarkdown>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleKnowledgeSave(message)} className="mt-4">
                      {savedKnowledgeIds.has(message.id) ? <Check className="size-4" /> : <Save className="size-4" />}
                      {savedKnowledgeIds.has(message.id) ? "Insight saved" : "Save insight"}
                    </Button>
                  </section>
                )}

                {message.outputKind === "knowledge-note" && message.noteDraft && (
                  <section className="mt-6 border-t border-border pt-5" data-testid="knowledge-note-output">
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary"><BookOpen className="size-3.5" />Knowledge note</p>
                    <h3 className="font-display text-lg font-medium">{message.noteDraft.title}</h3>
                    <SharedMarkdown className="mt-2">{message.noteDraft.content}</SharedMarkdown>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleKnowledgeSave(message)} className="mt-4">
                      {savedKnowledgeIds.has(message.id) ? <Check className="size-4" /> : <Save className="size-4" />}
                      {savedKnowledgeIds.has(message.id) ? "Note saved" : "Save note"}
                    </Button>
                  </section>
                )}

                {knowledgeDraftForMessage(message) && saveKnowledgeMessageId === message.id && !savedKnowledgeIds.has(message.id) && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <BookOpen className="size-4 text-muted-foreground" />
                      <Select value={saveProjectId} onValueChange={handleSaveSpaceChange}>
                        <SelectTrigger aria-label="Space for saved note" className="min-w-0 flex-1 border-0 bg-secondary/70 sm:min-w-52 sm:flex-none">
                          <SelectValue placeholder="Choose a Space" />
                        </SelectTrigger>
                        <SelectContent align="start">
                          {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                          {projects.length > 0 && <SelectSeparator />}
                          <SelectItem value={CREATE_SPACE_VALUE}>
                            <span className="flex items-center gap-2"><FolderPlus className="size-4 text-primary" />Create Space</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" onClick={() => saveKnowledge(message)} disabled={!saveProjectId}>Save to Knowledge</Button>
                    </div>
                    {suggestedSaveProjectId === saveProjectId && (
                      <p className="ml-6 mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Sparkles className="size-3.5 text-primary" />Fikr suggested this Space from the conversation.
                      </p>
                    )}
                  </div>
                )}

              </div>
            </article>
          ))}

          {isLoading && (
            <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 text-sm text-muted-foreground sm:grid-cols-[32px_minmax(0,1fr)] sm:gap-4" role="status">
              <span className="flex size-8 items-center justify-center rounded-md bg-secondary/75 text-primary"><Loader2 className="size-4 animate-spin" /></span>
              <div className="pt-1.5">
                <p>{activeAgentEvents.at(-1)?.message ?? "Starting Fikr…"}</p>
                {visibleAgentActivity(activeAgentEvents).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {visibleAgentActivity(activeAgentEvents).map((event, index) => (
                      <span key={`${event.runId}-${index}`} className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-primary" />{event.message}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        </div>
      </div>

      <div className="shrink-0 px-3 pb-3 pt-2 sm:px-6 sm:pb-5">
        <form
          onSubmit={handleSubmit}
          data-expanded={isComposerFocused || Boolean(draft.trim()) || pendingAttachments.length > 0}
          onFocusCapture={() => setIsComposerFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsComposerFocused(false);
          }}
          className="fikr-chat-composer mx-auto max-w-3xl rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/15"
        >
          {attachmentInputs}
          {attachmentTray}
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(draft); }
          }} rows={1} placeholder="Ask Fikr or describe what you want to create…" aria-label="Message Fikr" className="max-h-36 min-h-9 w-full resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground" />
          <div className="fikr-chat-composer-tools mt-1 flex items-end justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {renderAttachmentMenu("top")}
              {scopeControl}
            </div>
            {isLoading ? (
              <Button type="button" variant="secondary" size="icon" onClick={() => abortRef.current?.abort()} aria-label="Stop Fikr" className="shrink-0 rounded-full text-primary"><Square className="size-4 fill-current" /></Button>
            ) : (
              <Button type="submit" size="icon" disabled={!draft.trim() && pendingAttachments.length === 0} aria-label="Send message" className="shrink-0 rounded-full"><Send className="size-[18px]" /></Button>
            )}
          </div>
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">All saves require your confirmation</p>
      </div>

      <Dialog open={isCreateSpaceOpen} onOpenChange={(open) => {
        setIsCreateSpaceOpen(open);
        if (!open) setNewSpaceName("");
      }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={createSpace} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Create Space</DialogTitle>
              <DialogDescription>Give this note a focused home. You can add more notes to it later.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <label htmlFor="new-save-space-name" className="text-sm font-medium">Space name</label>
              <Input
                id="new-save-space-name"
                value={newSpaceName}
                onChange={(event) => setNewSpaceName(event.target.value)}
                placeholder="e.g. Product research"
                maxLength={80}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateSpaceOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!newSpaceName.trim()}>Create Space</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingToolApproval)}
        onOpenChange={(open) => { if (!open && pendingToolApproval) void respondToToolApproval(false); }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Allow this tool once?</DialogTitle>
            <DialogDescription>
              Fikr wants to use {pendingToolApproval?.toolName ?? "an external tool"} from {pendingToolApproval?.serverName ?? "an MCP server"}. Nothing runs until you allow it.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-secondary/45 p-3">
            <p className="font-mono text-xs font-medium text-foreground">{pendingToolApproval?.toolName}</p>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-muted-foreground">
              {JSON.stringify(pendingToolApproval?.arguments ?? {}, null, 2)}
            </pre>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void respondToToolApproval(false)}>Reject</Button>
            <Button type="button" onClick={() => void respondToToolApproval(true)}>Allow once</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(sourceNote && sourceProject)} onOpenChange={(open) => { if (!open) setSourcePreview(null); }}>
        <SheetContent side="right" className="w-full gap-0 overflow-hidden border-l border-border bg-background p-0 sm:max-w-[520px]">
          {sourceNote && sourceProject && (
            <>
              <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-12 text-left">
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{sourceProject.name}</p>
                <SheetTitle className="text-base leading-6">{sourceNote.title || sourceNote.category || sourceProject.name}</SheetTitle>
                <SheetDescription className="text-xs">
                  {(sourceNote.contentType ?? "knowledge note").replace(/-/g, " ")}
                  {sourceNote.timestamp ? ` · ${new Date(sourceNote.timestamp).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-5 sm:px-7">
                {sourceNote.annotation?.trim() ? (
                  <Tabs key={sourceNote.id} defaultValue="original" className="gap-5">
                    <TabsList className="h-9 w-fit rounded-md bg-secondary/70 p-0.5">
                      <TabsTrigger value="original" className="h-8 px-3 text-xs">Original</TabsTrigger>
                      <TabsTrigger value="summary" className="h-8 px-3 text-xs">AI Summary</TabsTrigger>
                    </TabsList>
                    <TabsContent value="original" className="mt-0">
                      <SharedMarkdown>{sourceNote.text}</SharedMarkdown>
                    </TabsContent>
                    <TabsContent value="summary" className="mt-0">
                      <SharedMarkdown>{sourceNote.annotation}</SharedMarkdown>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <SharedMarkdown>{sourceNote.text}</SharedMarkdown>
                )}

                <div className="mt-10 border-t border-border pt-4">
                  <p className="text-xs leading-5 text-muted-foreground">Referenced in this conversation. Close this panel to continue where you left off.</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

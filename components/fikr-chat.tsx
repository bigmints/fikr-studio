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
  ImageIcon,
  Linkedin,
  Loader2,
  Paperclip,
  PlusSquare,
  Save,
  Search,
  Send,
  Square,
  Sparkles,
  X,
} from "lucide-react";
import {
  generateFikrChat,
  type ChatProject,
  type FikrArtifact,
  type FikrAgentEvent,
  type FikrChatAttachment,
  type FikrChatAttachmentInput,
  type FikrChatMessage,
  type FikrChatThread,
  type FikrOutputKind,
} from "@/lib/fikr-chat";
import { dedupeAgentEvents, recommendProjectForKnowledgeDraft, shouldOfferInsightSave, titleFromQuery } from "@/lib/chat-domain.mjs";
import { writeClipboardText } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
const ATTACHMENT_ACCEPT = ".pdf,application/pdf,image/png,image/jpeg,image/webp";
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

export function FikrChat({
  projects,
  threads,
  setThreads,
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
  const [savedCreationIds, setSavedCreationIds] = useState<Set<string>>(new Set());
  const [copiedArtifactIds, setCopiedArtifactIds] = useState<Set<string>>(new Set());
  const [expandedDetailIds, setExpandedDetailIds] = useState<Set<string>>(new Set());
  const [activeAgentEvents, setActiveAgentEvents] = useState<FikrAgentEvent[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<FikrChatAttachmentInput[]>([]);
  const [sourcePreview, setSourcePreview] = useState<{ projectId: string; noteId: string } | null>(null);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      if (saveProjectId) setSaveProjectId("");
      return;
    }
    if (!projects.some((project) => project.id === saveProjectId)) {
      setSaveProjectId(projects[0].id);
    }
  }, [projects, saveProjectId]);

  useEffect(() => {
    const unsavedArtifacts = threads.flatMap((thread) => thread.messages
      .filter((message) => message.role === "assistant" && message.artifact && !savedCreationIds.has(message.id))
      .map((message) => ({ threadId: thread.id, message })));
    if (unsavedArtifacts.length === 0) return;

    for (const { threadId, message } of unsavedArtifacts) {
      if (!isCreationSaved(threadId, message.artifact!)) {
        onSaveCreation(threadId, message.artifact!);
      }
    }
    setSavedCreationIds((current) => {
      const next = new Set(current);
      unsavedArtifacts.forEach(({ message }) => next.add(message.id));
      return next;
    });
  }, [isCreationSaved, onSaveCreation, savedCreationIds, threads]);

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
        attachments: submittedAttachments,
        scope: threadScope,
        signal: controller.signal,
        onAgentEvent: (event) => setActiveAgentEvents((current) => [...current.slice(-7), event]),
      });
      const assistantMessage: FikrChatMessage = {
        id: makeId("message"),
        role: "assistant",
        content: generation.answer,
        createdAt: Date.now(),
        sourceNoteIds: generation.sources.map((source) => source.noteId),
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
        setError(caught instanceof Error ? caught.message : "Fikr couldn’t answer that. Try again.");
        setPendingAttachments((current) => current.length > 0 ? current : submittedAttachments);
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
      setActiveAgentEvents([]);
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
    await writeClipboardText(message.artifact.content);
    setCopiedArtifactIds((current) => new Set(current).add(message.id));
    window.setTimeout(() => setCopiedArtifactIds((current) => {
      const next = new Set(current);
      next.delete(message.id);
      return next;
    }), 1_500);
  };

  const renderAnswer = (message: FikrChatMessage) => {
    const citationMarkdown = message.content.replace(/\[#?(\d+)\](?!\()/g, "[$1](#fikr-source-$1)");
    return (
      <SharedMarkdown
        components={{
          a: ({ href, children }) => {
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
        {citationMarkdown}
      </SharedMarkdown>
    );
  };

  const visibleAgentActivity = (events: FikrAgentEvent[] | undefined) => (dedupeAgentEvents(events ?? []) as FikrAgentEvent[])
    .filter((event) => (event.type === "tool_completed" && event.toolName !== "activate_skill") || event.type === "mcp_connected");

  const scopeControl = (
    <Select
      value={currentScope.kind === "all" ? "all" : currentScope.projectIds[0]}
      disabled={Boolean(activeThread?.messages.length)}
      onValueChange={setScopeProjectId}
    >
      <SelectTrigger aria-label="Knowledge scope" title={activeThread?.messages.length ? "Knowledge scope is fixed for this chat. Start a new chat to change it." : "Choose knowledge scope"} className="h-9 min-w-0 max-w-56 rounded-md border-0 bg-secondary/80 px-2.5 text-xs font-medium text-foreground hover:bg-secondary focus:ring-ring/25 disabled:cursor-default disabled:opacity-70 sm:px-3">
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
    <div className="mb-3 flex flex-wrap gap-2" aria-label="Files ready to attach">
      {pendingAttachments.map((attachment) => (
        <div key={attachment.id} className="group flex max-w-full items-center gap-2 rounded-lg border border-[#18212f]/10 bg-white/72 py-1.5 pl-1.5 pr-2 text-left dark:border-border dark:bg-card/80">
          {attachment.kind === "image" ? (
            <img src={attachment.dataUrl} alt="" className="size-9 shrink-0 rounded-md object-cover" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#3ca6a6]/10 text-[#287d7d] dark:bg-primary/10 dark:text-primary"><FileText className="size-4" /></span>
          )}
          <span className="min-w-0">
            <span className="block max-w-40 truncate text-xs font-medium text-[#18212f] dark:text-foreground">{attachment.name}</span>
            <span className="block text-xs text-[#18212f]/45 dark:text-muted-foreground">{formatFileSize(attachment.size)}</span>
          </span>
          <Button type="button" variant="ghost" size="icon-xs" onClick={() => setPendingAttachments((current) => current.filter((candidate) => candidate.id !== attachment.id))} aria-label={`Remove ${attachment.name}`} className="ml-1 shrink-0 text-muted-foreground">
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );

  const attachmentInput = (
    <input
      ref={attachmentInputRef}
      type="file"
      accept={ATTACHMENT_ACCEPT}
      multiple
      className="hidden"
      onChange={(event) => {
        void addAttachments(event.currentTarget.files);
        event.currentTarget.value = "";
      }}
    />
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
              {attachmentInput}
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
              {attachmentTray}
              <div className="mt-3 flex items-end justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => attachmentInputRef.current?.click()} disabled={pendingAttachments.length >= MAX_ATTACHMENTS} className="shrink-0 gap-2 text-xs" aria-label="Add PDF or image">
                    <Paperclip className="size-3.5 text-primary" /><span className="hidden sm:inline">Add files</span>
                  </Button>
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
                        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span className="flex size-7 items-center justify-center rounded-md bg-primary/12 text-primary"><Linkedin className="size-3.5" /></span>
                          {message.artifact.title || (message.artifact.platform === "linkedin" ? "LinkedIn post" : "Social post")}
                        </p>
                        <span className="text-xs text-muted-foreground">{message.artifact.sourceNoteIds.length > 0 ? "From your knowledge" : "From your attachment"}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 py-4 sm:px-5">
                      <SharedMarkdown className="fikr-artifact-markdown max-h-72 overflow-hidden text-sm">
                        {message.artifact.content}
                      </SharedMarkdown>
                    </CardContent>
                    <CardFooter className="flex-wrap justify-between gap-2 border-t border-border/60 bg-secondary/20 px-3 py-2.5 sm:px-4">
                      <span className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground" role="status">
                        {savedCreationIds.has(message.id) ? <Check className="size-3.5 text-primary" /> : <Loader2 className="size-3.5 animate-spin" />}
                        {savedCreationIds.has(message.id) ? "Saved to Creations" : "Saving…"}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => void copyArtifact(message)}>
                          {copiedArtifactIds.has(message.id) ? <Check className="size-4" /> : <Copy className="size-4" />}{copiedArtifactIds.has(message.id) ? "Copied" : "Copy"}
                        </Button>
                        <Button type="button" size="sm" onClick={onOpenCreations}>Open in Creations</Button>
                      </div>
                    </CardFooter>
                  </Card>
                )}
                {(visibleAgentActivity(message.agentEvents).length > 0 || message.sourceNoteIds.length > 0) && (
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
                      {message.sourceNoteIds.length > 0 && ` · ${message.sourceNoteIds.length} sources`}
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
          {attachmentInput}
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(draft); }
          }} rows={1} placeholder="Ask Fikr or describe what you want to create…" aria-label="Message Fikr" className="max-h-36 min-h-9 w-full resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground" />
          {attachmentTray}
          <div className="fikr-chat-composer-tools mt-1 flex items-end justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => attachmentInputRef.current?.click()} disabled={pendingAttachments.length >= MAX_ATTACHMENTS} aria-label="Add PDF or image" className="shrink-0 gap-2 text-xs">
                <Paperclip className="size-4 text-primary" /><span className="hidden sm:inline">Add files</span>
              </Button>
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
